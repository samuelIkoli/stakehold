pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("87upMZXfZad7wuReP9LeoKW3HpFGfhgyF5nEhVSZx5ec");

#[program]
pub mod stakehold {
    use super::*;

    pub fn init_config(ctx: Context<InitConfig>, args: ConfigArgs) -> Result<()> {
        crate::instructions::admin::handle_init_config(ctx, args)
    }

    pub fn update_config(ctx: Context<UpdateConfig>, args: ConfigArgs) -> Result<()> {
        crate::instructions::admin::handle_update_config(ctx, args)
    }

    pub fn donate_to_pool(ctx: Context<DonateToPool>, amount: u64) -> Result<()> {
        crate::instructions::admin::handle_donate_to_pool(ctx, amount)
    }

    pub fn create_challenge(ctx: Context<CreateChallenge>, args: CreateChallengeArgs) -> Result<()> {
        crate::instructions::challenge::handle_create_challenge(ctx, args)
    }

    pub fn join_challenge(ctx: Context<JoinChallenge>, utc_offset_min: i16) -> Result<()> {
        crate::instructions::challenge::handle_join_challenge(ctx, utc_offset_min)
    }

    pub fn forfeit(ctx: Context<Forfeit>) -> Result<()> {
        crate::instructions::challenge::handle_forfeit(ctx)
    }

    pub fn open_window(ctx: Context<OpenWindow>, day: u16, index: u8) -> Result<()> {
        crate::instructions::judge::handle_open_window(ctx, day, index)
    }

    pub fn record_checkin(ctx: Context<RecordCheckin>, args: CheckInArgs) -> Result<()> {
        crate::instructions::judge::handle_record_checkin(ctx, args)
    }

    pub fn eliminate_missed(ctx: Context<EliminateMissed>, day: u16) -> Result<()> {
        crate::instructions::settle::handle_eliminate_missed(ctx, day)
    }

    pub fn settle(ctx: Context<Settle>) -> Result<()> {
        crate::instructions::settle::handle_settle(ctx)
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        crate::instructions::settle::handle_claim(ctx)
    }
}
