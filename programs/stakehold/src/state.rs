use anchor_lang::prelude::*;

/// Global settings. The admin sets which key is the AI judge and which demo charity
/// wallets solo users may pick.
#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub judge: Pubkey,
    pub charities: [Pubkey; 3],
    /// Bonus paid to each solo finisher, in basis points of the pool balance.
    pub bonus_bps: u16,
    /// Upper bound on a single solo bonus.
    pub bonus_cap: u64,
    pub challenge_count: u64,
    pub bump: u8,
}

/// Program-owned community pool. Its lamports are the pool balance (minus rent).
#[account]
#[derive(InitSpace)]
pub struct CommunityPool {
    pub total_in: u64,
    pub total_out: u64,
    pub bonuses_paid: u32,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Challenge {
    pub id: u64,
    pub creator: Pubkey,
    pub judge: Pubkey,
    pub mode: u8,
    pub demo: bool,
    pub stake_lamports: u64,
    /// Reference start. Real challenges: 00:00 UTC of the start date; each member starts
    /// at their own local midnight (start_ts - utc_offset). Demo: everyone starts here.
    pub start_ts: i64,
    pub day_len: i64,
    pub num_days: u16,
    /// Time after a day ends during which the judge may still record that day.
    pub grace_secs: i64,
    pub window_secs: u32,
    pub max_players: u8,
    pub player_count: u8,
    pub active_count: u8,
    pub survivor_count: u8,
    pub claimed_count: u8,
    /// SHA-256 of the offchain proof plan (rules the AI judges against).
    pub config_hash: [u8; 32],
    pub fail_dest: u8,
    pub charity: Pubkey,
    pub status: u8,
    /// Latest end time across all members (members in different time zones end at different times).
    pub last_end_ts: i64,
    pub pot_lamports: u64,
    pub share_lamports: u64,
    pub bonus_lamports: u64,
    pub settled_at: i64,
    pub bump: u8,
    pub vault_bump: u8,
}

/// Holds the stakes for one challenge. Program-owned so only this program can debit it.
#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub challenge: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Participant {
    pub challenge: Pubkey,
    pub player: Pubkey,
    /// This member's own day-1 start (their local midnight), Unix seconds.
    pub start_ts: i64,
    pub utc_offset_min: i16,
    pub status: u8,
    pub eliminated_day: u16,
    pub eliminated_reason: u8,
    /// Bit (d-1) is set once day d has a passing check-in.
    pub passed_bitmap: u64,
    pub days_passed: u16,
    pub last_checkin_day: u16,
    pub checkins: u16,
    pub joined_at: i64,
    pub bump: u8,
}

/// A proof window for one member on one day. The pose (and any random pages) are
/// derived from `slot_hash`, read from the SlotHashes sysvar when the window opened.
#[account]
#[derive(InitSpace)]
pub struct Window {
    pub challenge: Pubkey,
    pub participant: Pubkey,
    pub day: u16,
    pub index: u8,
    pub slot: u64,
    pub slot_hash: [u8; 32],
    pub opened_at: i64,
    pub expires_at: i64,
    /// [fingers 1-5, direction 0-3, extra 0-3]
    pub pose: [u8; 3],
    pub bump: u8,
}

/// Permanent record of one judged proof (or a day-0 baseline).
#[account]
#[derive(InitSpace)]
pub struct CheckIn {
    pub challenge: Pubkey,
    pub participant: Pubkey,
    pub day: u16,
    pub attempt: u8,
    pub verdict: u8,
    pub reason_code: u16,
    /// SHA-256 of the proof bundle. Photos themselves never go onchain.
    pub proof_hash: [u8; 32],
    /// Proof-type specific numbers, e.g. Duolingo total XP / streak, gym minutes.
    pub metric_a: u64,
    pub metric_b: u64,
    pub window: Pubkey,
    pub slot: u64,
    pub timestamp: i64,
    pub bump: u8,
}

impl Participant {
    /// 1-based day index at `now` (0 before start). May exceed num_days after the end.
    pub fn day_at(&self, day_len: i64, now: i64) -> i64 {
        if now < self.start_ts {
            0
        } else {
            (now - self.start_ts) / day_len + 1
        }
    }

    pub fn day_end(&self, day_len: i64, day: u16) -> i64 {
        self.start_ts + day as i64 * day_len
    }

    pub fn passed(&self, day: u16) -> bool {
        day >= 1 && day <= 64 && self.passed_bitmap & (1u64 << (day - 1)) != 0
    }

    /// First day in 1..=up_to without a pass, if any.
    pub fn first_missed(&self, up_to: u16) -> Option<u16> {
        (1..=up_to).find(|d| !self.passed(*d))
    }
}

/// Deterministic pose from a slot hash: anyone can recompute it.
pub fn pose_from_hash(h: &[u8; 32]) -> [u8; 3] {
    [h[0] % 5 + 1, h[1] % 4, h[2] % 4]
}
