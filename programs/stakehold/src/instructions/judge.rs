use anchor_lang::prelude::*;

use crate::{constants::*, error::ErrorCode, state::*};

pub const SLOT_HASHES_ID: Pubkey = pubkey!("SysvarS1otHashes111111111111111111111111111");

// The judge key can only sign the two instructions in this file. Neither moves any
// stake: the judge pays rent for the records it creates and nothing else.

#[derive(Accounts)]
#[instruction(day: u16, index: u8)]
pub struct OpenWindow<'info> {
    #[account(mut, address = challenge.judge)]
    pub judge: Signer<'info>,
    pub challenge: Account<'info, Challenge>,
    #[account(has_one = challenge)]
    pub participant: Account<'info, Participant>,
    #[account(
        init,
        payer = judge,
        space = 8 + Window::INIT_SPACE,
        seeds = [WINDOW_SEED, participant.key().as_ref(), &day.to_le_bytes(), &[index]],
        bump
    )]
    pub window: Account<'info, Window>,
    /// Earlier window the same day (e.g. the gym check-in), so the new pose can differ.
    pub prev_window: Option<Account<'info, Window>>,
    /// CHECK: address-constrained to the SlotHashes sysvar; parsed by hand because the
    /// full sysvar is too large to deserialize.
    #[account(address = SLOT_HASHES_ID)]
    pub slot_hashes: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_open_window(ctx: Context<OpenWindow>, day: u16, index: u8) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let challenge = &ctx.accounts.challenge;
    let p = &ctx.accounts.participant;
    require!(challenge.status == CHALLENGE_ACTIVE, ErrorCode::AlreadySettled);
    require!(p.status == PLAYER_ACTIVE, ErrorCode::NotActive);
    require!(index <= MAX_WINDOW_INDEX, ErrorCode::InvalidWindowIndex);
    require!(day >= 1 && day <= challenge.num_days, ErrorCode::InvalidDay);
    require!(p.day_at(challenge.day_len, now) == day as i64, ErrorCode::WrongDay);

    // SlotHashes layout: u64 count, then (u64 slot, [u8; 32] hash) entries, newest first.
    let (slot, hash) = {
        let data = ctx.accounts.slot_hashes.try_borrow_data()?;
        require!(data.len() >= 48, ErrorCode::SlotHashesUnavailable);
        let count = u64::from_le_bytes(data[0..8].try_into().unwrap());
        require!(count > 0, ErrorCode::SlotHashesUnavailable);
        let slot = u64::from_le_bytes(data[8..16].try_into().unwrap());
        let mut hash = [0u8; 32];
        hash.copy_from_slice(&data[16..48]);
        (slot, hash)
    };

    let mut pose = pose_from_hash(&hash);
    if let Some(prev) = &ctx.accounts.prev_window {
        require!(
            prev.participant == p.key() && prev.day == day && prev.index + 1 == index,
            ErrorCode::WindowMismatch
        );
        if prev.pose == pose {
            // Deterministic fallback so a check-out never repeats the check-in pose.
            pose = [hash[3] % 5 + 1, hash[4] % 4, hash[5] % 4];
            if pose == prev.pose {
                pose[2] = (pose[2] + 1) % 4;
            }
        }
    }

    let w = &mut ctx.accounts.window;
    w.challenge = challenge.key();
    w.participant = p.key();
    w.day = day;
    w.index = index;
    w.slot = slot;
    w.slot_hash = hash;
    w.opened_at = now;
    w.expires_at = now + challenge.window_secs as i64;
    w.pose = pose;
    w.bump = ctx.bumps.window;
    Ok(())
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CheckInArgs {
    pub day: u16,
    pub attempt: u8,
    pub verdict: u8,
    pub reason_code: u16,
    pub proof_hash: [u8; 32],
    pub metric_a: u64,
    pub metric_b: u64,
}

#[derive(Accounts)]
#[instruction(args: CheckInArgs)]
pub struct RecordCheckin<'info> {
    #[account(mut, address = challenge.judge)]
    pub judge: Signer<'info>,
    pub challenge: Account<'info, Challenge>,
    #[account(mut, has_one = challenge)]
    pub participant: Account<'info, Participant>,
    #[account(
        init,
        payer = judge,
        space = 8 + CheckIn::INIT_SPACE,
        seeds = [CHECKIN_SEED, participant.key().as_ref(), &args.day.to_le_bytes(), &[args.attempt]],
        bump
    )]
    pub checkin: Account<'info, CheckIn>,
    pub window: Option<Account<'info, Window>>,
    pub system_program: Program<'info, System>,
}

pub fn handle_record_checkin(ctx: Context<RecordCheckin>, args: CheckInArgs) -> Result<()> {
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;
    let challenge = &ctx.accounts.challenge;
    let p = &mut ctx.accounts.participant;
    require!(challenge.status == CHALLENGE_ACTIVE, ErrorCode::AlreadySettled);
    require!(p.status == PLAYER_ACTIVE, ErrorCode::NotActive);
    require!(args.attempt <= MAX_ATTEMPTS, ErrorCode::InvalidAttempt);
    require!(args.day <= challenge.num_days, ErrorCode::InvalidDay);

    if args.day == 0 {
        // Day-0 baseline snapshot (e.g. Duolingo XP + streak at the start).
        require!(args.verdict == VERDICT_BASELINE, ErrorCode::InvalidVerdict);
        require!(now < p.start_ts + challenge.day_len + challenge.grace_secs, ErrorCode::TooLate);
    } else {
        require!(args.verdict <= VERDICT_PASS, ErrorCode::InvalidVerdict);
        let day_start = p.start_ts + (args.day as i64 - 1) * challenge.day_len;
        require!(now >= day_start, ErrorCode::WrongDay);
        require!(
            now < p.day_end(challenge.day_len, args.day) + challenge.grace_secs,
            ErrorCode::TooLate
        );
    }

    let window_key = match &ctx.accounts.window {
        Some(w) => {
            require!(w.participant == p.key() && w.day == args.day, ErrorCode::WindowMismatch);
            require!(now <= w.expires_at + JUDGE_ALLOWANCE_SECS, ErrorCode::WindowExpired);
            w.key()
        }
        None => Pubkey::default(),
    };

    let c = &mut ctx.accounts.checkin;
    c.challenge = challenge.key();
    c.participant = p.key();
    c.day = args.day;
    c.attempt = args.attempt;
    c.verdict = args.verdict;
    c.reason_code = args.reason_code;
    c.proof_hash = args.proof_hash;
    c.metric_a = args.metric_a;
    c.metric_b = args.metric_b;
    c.window = window_key;
    c.slot = clock.slot;
    c.timestamp = now;
    c.bump = ctx.bumps.checkin;

    if args.verdict == VERDICT_PASS && !p.passed(args.day) {
        p.passed_bitmap |= 1u64 << (args.day - 1);
        p.days_passed += 1;
    }
    p.last_checkin_day = p.last_checkin_day.max(args.day);
    p.checkins = p.checkins.saturating_add(1);
    Ok(())
}
