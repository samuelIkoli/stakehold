use anchor_lang::prelude::*;

use crate::{constants::*, error::ErrorCode, state::*};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ConfigArgs {
    pub judge: Pubkey,
    pub charities: [Pubkey; 3],
    pub bonus_bps: u16,
    pub bonus_cap: u64,
}

#[derive(Accounts)]
pub struct InitConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + Config::INIT_SPACE, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, Config>,
    #[account(init, payer = admin, space = 8 + CommunityPool::INIT_SPACE, seeds = [POOL_SEED], bump)]
    pub pool: Account<'info, CommunityPool>,
    pub system_program: Program<'info, System>,
}

pub fn handle_init_config(ctx: Context<InitConfig>, args: ConfigArgs) -> Result<()> {
    require!(args.bonus_bps <= MAX_BONUS_BPS, ErrorCode::InvalidBonus);
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.judge = args.judge;
    config.charities = args.charities;
    config.bonus_bps = args.bonus_bps;
    config.bonus_cap = args.bonus_cap;
    config.challenge_count = 0;
    config.bump = ctx.bumps.config;
    ctx.accounts.pool.bump = ctx.bumps.pool;
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump, has_one = admin @ ErrorCode::Unauthorized)]
    pub config: Account<'info, Config>,
}

/// Rotating the judge only affects challenges created afterwards.
pub fn handle_update_config(ctx: Context<UpdateConfig>, args: ConfigArgs) -> Result<()> {
    require!(args.bonus_bps <= MAX_BONUS_BPS, ErrorCode::InvalidBonus);
    let config = &mut ctx.accounts.config;
    config.judge = args.judge;
    config.charities = args.charities;
    config.bonus_bps = args.bonus_bps;
    config.bonus_cap = args.bonus_cap;
    Ok(())
}

#[derive(Accounts)]
pub struct DonateToPool<'info> {
    #[account(mut)]
    pub donor: Signer<'info>,
    #[account(mut, seeds = [POOL_SEED], bump = pool.bump)]
    pub pool: Account<'info, CommunityPool>,
    pub system_program: Program<'info, System>,
}

pub fn handle_donate_to_pool(ctx: Context<DonateToPool>, amount: u64) -> Result<()> {
    let cpi = anchor_lang::system_program::Transfer {
        from: ctx.accounts.donor.to_account_info(),
        to: ctx.accounts.pool.to_account_info(),
    };
    anchor_lang::system_program::transfer(CpiContext::new(anchor_lang::system_program::ID, cpi), amount)?;
    let pool = &mut ctx.accounts.pool;
    pool.total_in = pool.total_in.checked_add(amount).ok_or(ErrorCode::Overflow)?;
    Ok(())
}
