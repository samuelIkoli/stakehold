use anchor_lang::prelude::*;

use crate::{constants::*, error::ErrorCode, state::*};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateChallengeArgs {
    pub id: u64,
    pub mode: u8,
    pub demo: bool,
    pub stake_lamports: u64,
    pub start_ts: i64,
    pub day_len: i64,
    pub num_days: u16,
    pub grace_secs: i64,
    pub window_secs: u32,
    pub max_players: u8,
    pub config_hash: [u8; 32],
    pub fail_dest: u8,
    pub charity_index: u8,
}

#[derive(Accounts)]
#[instruction(args: CreateChallengeArgs)]
pub struct CreateChallenge<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = creator,
        space = 8 + Challenge::INIT_SPACE,
        seeds = [CHALLENGE_SEED, creator.key().as_ref(), &args.id.to_le_bytes()],
        bump
    )]
    pub challenge: Account<'info, Challenge>,
    #[account(
        init,
        payer = creator,
        space = 8 + Vault::INIT_SPACE,
        seeds = [VAULT_SEED, challenge.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_challenge(ctx: Context<CreateChallenge>, args: CreateChallengeArgs) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(args.mode <= MODE_SOLO, ErrorCode::InvalidMode);
    require!(
        args.stake_lamports >= MIN_STAKE && args.stake_lamports <= MAX_STAKE,
        ErrorCode::InvalidStake
    );
    require!(args.start_ts > now, ErrorCode::StartInPast);
    require!(
        args.day_len >= MIN_DAY_LEN && args.day_len <= MAX_DAY_LEN,
        ErrorCode::InvalidDayLength
    );
    require!(args.num_days >= 1 && args.num_days <= MAX_DAYS, ErrorCode::InvalidDays);
    require!(args.grace_secs >= 0 && args.grace_secs <= args.day_len, ErrorCode::InvalidGrace);
    let max_players = if args.mode == MODE_SOLO { 1 } else { args.max_players };
    require!(max_players >= 1 && max_players <= MAX_PLAYERS, ErrorCode::InvalidMaxPlayers);

    let config = &mut ctx.accounts.config;
    let charity = match (args.mode, args.fail_dest) {
        (_, FAIL_TO_POOL) => Pubkey::default(),
        (MODE_SOLO, FAIL_TO_CHARITY) => {
            let c = *config
                .charities
                .get(args.charity_index as usize)
                .ok_or(ErrorCode::InvalidCharity)?;
            require!(c != Pubkey::default(), ErrorCode::InvalidCharity);
            c
        }
        _ => return err!(ErrorCode::InvalidFailDestination),
    };

    let challenge = &mut ctx.accounts.challenge;
    challenge.id = args.id;
    challenge.creator = ctx.accounts.creator.key();
    challenge.judge = config.judge;
    challenge.mode = args.mode;
    challenge.demo = args.demo;
    challenge.stake_lamports = args.stake_lamports;
    challenge.start_ts = args.start_ts;
    challenge.day_len = args.day_len;
    challenge.num_days = args.num_days;
    challenge.grace_secs = args.grace_secs;
    challenge.window_secs = args.window_secs;
    challenge.max_players = max_players;
    challenge.config_hash = args.config_hash;
    challenge.fail_dest = args.fail_dest;
    challenge.charity = charity;
    challenge.status = CHALLENGE_ACTIVE;
    challenge.last_end_ts = 0;
    challenge.bump = ctx.bumps.challenge;
    challenge.vault_bump = ctx.bumps.vault;

    ctx.accounts.vault.challenge = challenge.key();
    ctx.accounts.vault.bump = ctx.bumps.vault;
    config.challenge_count = config.challenge_count.saturating_add(1);
    Ok(())
}

#[derive(Accounts)]
pub struct JoinChallenge<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(mut)]
    pub challenge: Account<'info, Challenge>,
    #[account(mut, seeds = [VAULT_SEED, challenge.key().as_ref()], bump = challenge.vault_bump)]
    pub vault: Account<'info, Vault>,
    #[account(
        init,
        payer = player,
        space = 8 + Participant::INIT_SPACE,
        seeds = [PARTICIPANT_SEED, challenge.key().as_ref(), player.key().as_ref()],
        bump
    )]
    pub participant: Account<'info, Participant>,
    pub system_program: Program<'info, System>,
}

pub fn handle_join_challenge(ctx: Context<JoinChallenge>, utc_offset_min: i16) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let challenge = &mut ctx.accounts.challenge;
    require!(challenge.status == CHALLENGE_ACTIVE, ErrorCode::AlreadySettled);
    require!(challenge.player_count < challenge.max_players, ErrorCode::ChallengeFull);
    require!(
        (-720..=840).contains(&utc_offset_min) && utc_offset_min % 15 == 0,
        ErrorCode::InvalidOffset
    );
    if challenge.mode == MODE_SOLO {
        require_keys_eq!(ctx.accounts.player.key(), challenge.creator, ErrorCode::SoloCreatorOnly);
    }

    // Each member starts at their own local midnight; demo challenges share one start.
    let start_ts = if challenge.demo {
        challenge.start_ts
    } else {
        challenge.start_ts - utc_offset_min as i64 * 60
    };
    require!(now < start_ts, ErrorCode::AlreadyStarted);
    // Joining also closes at the challenge's official start, so a self-reported time zone
    // can't be used to join after other players have begun.
    require!(now < challenge.start_ts, ErrorCode::AlreadyStarted);

    let cpi = anchor_lang::system_program::Transfer {
        from: ctx.accounts.player.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
    };
    anchor_lang::system_program::transfer(
        CpiContext::new(anchor_lang::system_program::ID, cpi),
        challenge.stake_lamports,
    )?;

    let p = &mut ctx.accounts.participant;
    p.challenge = challenge.key();
    p.player = ctx.accounts.player.key();
    p.start_ts = start_ts;
    p.utc_offset_min = utc_offset_min;
    p.status = PLAYER_ACTIVE;
    p.joined_at = now;
    p.bump = ctx.bumps.participant;

    challenge.player_count += 1;
    challenge.active_count += 1;
    challenge.pot_lamports = challenge
        .pot_lamports
        .checked_add(challenge.stake_lamports)
        .ok_or(ErrorCode::Overflow)?;
    let end = start_ts + challenge.num_days as i64 * challenge.day_len;
    challenge.last_end_ts = challenge.last_end_ts.max(end);
    Ok(())
}

#[derive(Accounts)]
pub struct Forfeit<'info> {
    pub player: Signer<'info>,
    #[account(mut)]
    pub challenge: Account<'info, Challenge>,
    #[account(
        mut,
        seeds = [PARTICIPANT_SEED, challenge.key().as_ref(), player.key().as_ref()],
        bump = participant.bump
    )]
    pub participant: Account<'info, Participant>,
}

/// Quit voluntarily. The stake stays in the pot for the survivors.
pub fn handle_forfeit(ctx: Context<Forfeit>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let challenge = &mut ctx.accounts.challenge;
    let p = &mut ctx.accounts.participant;
    require!(challenge.status == CHALLENGE_ACTIVE, ErrorCode::AlreadySettled);
    require!(p.status == PLAYER_ACTIVE, ErrorCode::NotActive);
    let day = p.day_at(challenge.day_len, now).clamp(1, challenge.num_days as i64) as u16;
    p.status = PLAYER_ELIMINATED;
    p.eliminated_day = day;
    p.eliminated_reason = ELIM_QUIT;
    challenge.active_count = challenge.active_count.saturating_sub(1);
    Ok(())
}
