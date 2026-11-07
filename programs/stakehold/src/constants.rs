pub const CONFIG_SEED: &[u8] = b"config";
pub const POOL_SEED: &[u8] = b"pool";
pub const CHALLENGE_SEED: &[u8] = b"challenge";
pub const VAULT_SEED: &[u8] = b"vault";
pub const PARTICIPANT_SEED: &[u8] = b"participant";
pub const WINDOW_SEED: &[u8] = b"window";
pub const CHECKIN_SEED: &[u8] = b"checkin";

// Challenge modes
pub const MODE_GROUP: u8 = 0;
pub const MODE_PUBLIC: u8 = 1;
pub const MODE_SOLO: u8 = 2;

// Where the pot goes when nobody survives. Group/public challenges always use the
// community pool; solo users choose pool or charity.
pub const FAIL_TO_POOL: u8 = 0;
pub const FAIL_TO_CHARITY: u8 = 1;

// Challenge status
pub const CHALLENGE_ACTIVE: u8 = 0;
pub const CHALLENGE_SETTLED: u8 = 1;

// Participant status
pub const PLAYER_ACTIVE: u8 = 0;
pub const PLAYER_ELIMINATED: u8 = 1;
pub const PLAYER_SURVIVED: u8 = 2;
pub const PLAYER_CLAIMED: u8 = 3;

// Elimination reasons
pub const ELIM_MISSED: u8 = 0;
pub const ELIM_QUIT: u8 = 1;

// Check-in verdicts
pub const VERDICT_FAIL: u8 = 0;
pub const VERDICT_PASS: u8 = 1;
pub const VERDICT_BASELINE: u8 = 2;

pub const MAX_DAYS: u16 = 60;
pub const MAX_PLAYERS: u8 = 16;
pub const MIN_STAKE: u64 = 1_000_000; // 0.001 SOL
pub const MAX_STAKE: u64 = 10_000_000_000; // 10 SOL
pub const MIN_DAY_LEN: i64 = 60;
pub const MAX_DAY_LEN: i64 = 7 * 86_400;
pub const MAX_WINDOW_INDEX: u8 = 7;
pub const MAX_ATTEMPTS: u8 = 7;
pub const MAX_BONUS_BPS: u16 = 2_000; // 20% of the pool per finisher, at most
/// Extra time after a proof window closes for the AI judge to finish and record.
pub const JUDGE_ALLOWANCE_SECS: i64 = 600;
