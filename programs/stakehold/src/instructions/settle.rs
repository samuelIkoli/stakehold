use anchor_lang::prelude::*;

use crate::{constants::*, error::ErrorCode, state::*};

fn move_lamports(from: &AccountInfo, to: &AccountInfo, amount: u64) -> Result<()> {
    if amount > 0 {
        from.sub_lamports(amount)?;
        to.add_lamports(amount)?;
    }
    Ok(())
}

#[derive(Accounts)]
pub struct EliminateMissed<'info> {
    #[account(mut)]
    pub challenge: Account<'info, Challenge>,
    #[account(mut, has_one = challenge)]
    pub participant: Account<'info, Participant>,
}

/// Permissionless: anyone may eliminate a member once a day has ended (plus grace)
/// without a passing check-in.
pub fn handle_eliminate_missed(ctx: Context<EliminateMissed>, day: u16) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let challenge = &mut ctx.accounts.challenge;
    let p = &mut ctx.accounts.participant;
    require!(challenge.status == CHALLENGE_ACTIVE, ErrorCode::AlreadySettled);
    require!(p.status == PLAYER_ACTIVE, ErrorCode::NotActive);
    require!(day >= 1 && day <= challenge.num_days, ErrorCode::InvalidDay);
    require!(
        now >= p.day_end(challenge.day_len, day) + challenge.grace_secs,
        ErrorCode::DayNotOver
    );
    let missed = p.first_missed(day).ok_or(ErrorCode::DayWasPassed)?;
    p.status = PLAYER_ELIMINATED;
    p.eliminated_day = missed;
    p.eliminated_reason = ELIM_MISSED;
    challenge.active_count = challenge.active_count.saturating_sub(1);
    Ok(())
}

#[derive(Accounts)]
pub struct Settle<'info> {
    #[account(mut)]
    pub challenge: Account<'info, Challenge>,
    #[account(mut, seeds = [VAULT_SEED, challenge.key().as_ref()], bump = challenge.vault_bump)]
    pub vault: Account<'info, Vault>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [POOL_SEED], bump = pool.bump)]
    pub pool: Account<'info, CommunityPool>,
    /// CHECK: must equal challenge.charity; only needed for solo challenges that fail to charity.
    #[account(mut)]
    pub charity: Option<UncheckedAccount<'info>>,
}

/// Permissionless. Pass every participant account of the challenge as remaining accounts.
/// Payouts follow purely from the recorded check-ins.
pub fn handle_settle(ctx: Context<Settle>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let challenge = &mut ctx.accounts.challenge;
    require!(challenge.status == CHALLENGE_ACTIVE, ErrorCode::AlreadySettled);
    require!(now >= challenge.last_end_ts + challenge.grace_secs, ErrorCode::NotEnded);
    require!(
        ctx.remaining_accounts.len() == challenge.player_count as usize,
        ErrorCode::ParticipantsMismatch
    );

    let challenge_key = challenge.key();
    let mut seen: Vec<Pubkey> = Vec::with_capacity(ctx.remaining_accounts.len());
    let mut survivors: u8 = 0;
    for info in ctx.remaining_accounts.iter() {
        require!(!seen.contains(info.key), ErrorCode::DuplicateParticipant);
        seen.push(*info.key);
        require_keys_eq!(*info.owner, crate::ID, ErrorCode::ParticipantsMismatch);
        require!(info.is_writable, ErrorCode::ParticipantsMismatch);
        let mut data = info.try_borrow_mut_data()?;
        let mut p = Participant::try_deserialize(&mut &data[..])?;
        require_keys_eq!(p.challenge, challenge_key, ErrorCode::ParticipantsMismatch);
        if p.status == PLAYER_ACTIVE {
            match p.first_missed(challenge.num_days) {
                None => {
                    p.status = PLAYER_SURVIVED;
                    survivors += 1;
                }
                Some(day) => {
                    p.status = PLAYER_ELIMINATED;
                    p.eliminated_day = day;
                    p.eliminated_reason = ELIM_MISSED;
                }
            }
            p.try_serialize(&mut &mut data[..])?;
        }
    }

    let vault_info = ctx.accounts.vault.to_account_info();
    let pool_info = ctx.accounts.pool.to_account_info();
    let pot = challenge.pot_lamports;

    if survivors > 0 {
        let share = pot / survivors as u64;
        let dust = pot - share * survivors as u64;
        challenge.share_lamports = share;
        if dust > 0 {
            move_lamports(&vault_info, &pool_info, dust)?;
            ctx.accounts.pool.total_in += dust;
        }
        if challenge.mode == MODE_SOLO {
            // Solo finisher: stake back plus a capped bonus from the community pool.
            let rent = Rent::get()?.minimum_balance(pool_info.data_len());
            let available = pool_info.lamports().saturating_sub(rent);
            let bonus = ((available as u128 * ctx.accounts.config.bonus_bps as u128) / 10_000) as u64;
            let bonus = bonus.min(ctx.accounts.config.bonus_cap);
            if bonus > 0 {
                move_lamports(&pool_info, &vault_info, bonus)?;
                let pool = &mut ctx.accounts.pool;
                pool.total_out += bonus;
                pool.bonuses_paid += 1;
            }
            challenge.bonus_lamports = bonus;
        }
    } else if pot > 0 {
        if challenge.mode == MODE_SOLO && challenge.fail_dest == FAIL_TO_CHARITY {
            let charity = ctx.accounts.charity.as_ref().ok_or(ErrorCode::InvalidCharity)?;
            require_keys_eq!(charity.key(), challenge.charity, ErrorCode::InvalidCharity);
            move_lamports(&vault_info, &charity.to_account_info(), pot)?;
        } else {
            move_lamports(&vault_info, &pool_info, pot)?;
            ctx.accounts.pool.total_in += pot;
        }
    }

    challenge.survivor_count = survivors;
    challenge.active_count = survivors;
    challenge.status = CHALLENGE_SETTLED;
    challenge.settled_at = now;
    Ok(())
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(mut)]
    pub challenge: Account<'info, Challenge>,
    #[account(mut, seeds = [VAULT_SEED, challenge.key().as_ref()], bump = challenge.vault_bump)]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [PARTICIPANT_SEED, challenge.key().as_ref(), player.key().as_ref()],
        bump = participant.bump
    )]
    pub participant: Account<'info, Participant>,
}

/// Pull payment: each survivor withdraws their equal share once.
pub fn handle_claim(ctx: Context<Claim>) -> Result<()> {
    let challenge = &mut ctx.accounts.challenge;
    let p = &mut ctx.accounts.participant;
    require!(challenge.status == CHALLENGE_SETTLED, ErrorCode::NotSettled);
    require!(p.status == PLAYER_SURVIVED, ErrorCode::NotSurvivor);
    let amount = challenge
        .share_lamports
        .checked_add(challenge.bonus_lamports)
        .ok_or(ErrorCode::Overflow)?;
    p.status = PLAYER_CLAIMED;
    challenge.claimed_count += 1;
    move_lamports(
        &ctx.accounts.vault.to_account_info(),
        &ctx.accounts.player.to_account_info(),
        amount,
    )?;
    Ok(())
}
