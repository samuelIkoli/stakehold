use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Only the admin can do this")]
    Unauthorized,
    #[msg("Invalid challenge mode")]
    InvalidMode,
    #[msg("Stake amount out of range")]
    InvalidStake,
    #[msg("Start time must be in the future")]
    StartInPast,
    #[msg("Invalid day length")]
    InvalidDayLength,
    #[msg("Invalid number of days")]
    InvalidDays,
    #[msg("Invalid grace period")]
    InvalidGrace,
    #[msg("Invalid max players")]
    InvalidMaxPlayers,
    #[msg("Invalid failure destination")]
    InvalidFailDestination,
    #[msg("Charity is not on the approved list")]
    InvalidCharity,
    #[msg("Challenge is full")]
    ChallengeFull,
    #[msg("Challenge has already started for you")]
    AlreadyStarted,
    #[msg("Invalid UTC offset")]
    InvalidOffset,
    #[msg("Solo challenges can only be joined by their creator")]
    SoloCreatorOnly,
    #[msg("Challenge is already settled")]
    AlreadySettled,
    #[msg("Challenge is not settled yet")]
    NotSettled,
    #[msg("Participant is not active")]
    NotActive,
    #[msg("Day is out of range")]
    InvalidDay,
    #[msg("That day is not open right now")]
    WrongDay,
    #[msg("Too late to record this day")]
    TooLate,
    #[msg("Invalid verdict")]
    InvalidVerdict,
    #[msg("Window does not belong to this participant/day")]
    WindowMismatch,
    #[msg("Proof window has expired")]
    WindowExpired,
    #[msg("Invalid window index")]
    InvalidWindowIndex,
    #[msg("Invalid attempt number")]
    InvalidAttempt,
    #[msg("SlotHashes sysvar data is unavailable")]
    SlotHashesUnavailable,
    #[msg("Day has not ended yet")]
    DayNotOver,
    #[msg("Participant passed that day")]
    DayWasPassed,
    #[msg("Challenge has not ended yet")]
    NotEnded,
    #[msg("All participants must be passed to settle")]
    ParticipantsMismatch,
    #[msg("Duplicate participant account")]
    DuplicateParticipant,
    #[msg("Participant did not survive")]
    NotSurvivor,
    #[msg("Invalid bonus settings")]
    InvalidBonus,
    #[msg("Math overflow")]
    Overflow,
}
