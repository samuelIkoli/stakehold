use {
    anchor_lang::{
        prelude::Pubkey,
        solana_program::{
            instruction::{AccountMeta, Instruction},
            system_program,
        },
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    solana_clock::Clock,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_slot_hashes::SlotHashes,
    solana_transaction::versioned::VersionedTransaction,
    stakehold::{constants::*, state::*, CheckInArgs, ConfigArgs, CreateChallengeArgs},
};

const SOL: u64 = 1_000_000_000;
const STAKE: u64 = SOL / 10;
const DAY: i64 = 120;
const GRACE: i64 = 20;
const T0: i64 = 1_800_000_000;
const SLOT_HASHES: Pubkey = stakehold::SLOT_HASHES_ID;

struct Env {
    svm: LiteSVM,
    admin: Keypair,
    judge: Keypair,
    charity: Keypair,
}

fn pid() -> Pubkey {
    stakehold::id()
}
fn pda(seeds: &[&[u8]]) -> Pubkey {
    Pubkey::find_program_address(seeds, &pid()).0
}
fn config_pda() -> Pubkey {
    pda(&[CONFIG_SEED])
}
fn pool_pda() -> Pubkey {
    pda(&[POOL_SEED])
}
fn challenge_pda(creator: &Pubkey, id: u64) -> Pubkey {
    pda(&[CHALLENGE_SEED, creator.as_ref(), &id.to_le_bytes()])
}
fn vault_pda(ch: &Pubkey) -> Pubkey {
    pda(&[VAULT_SEED, ch.as_ref()])
}
fn participant_pda(ch: &Pubkey, player: &Pubkey) -> Pubkey {
    pda(&[PARTICIPANT_SEED, ch.as_ref(), player.as_ref()])
}
fn window_pda(p: &Pubkey, day: u16, index: u8) -> Pubkey {
    pda(&[WINDOW_SEED, p.as_ref(), &day.to_le_bytes(), &[index]])
}
fn checkin_pda(p: &Pubkey, day: u16, attempt: u8) -> Pubkey {
    pda(&[CHECKIN_SEED, p.as_ref(), &day.to_le_bytes(), &[attempt]])
}

impl Env {
    fn new() -> Self {
        let mut svm = LiteSVM::new();
        let bytes = include_bytes!(concat!(env!("CARGO_TARGET_TMPDIR"), "/../deploy/stakehold.so"));
        svm.add_program(pid(), bytes).unwrap();
        let admin = Keypair::new();
        let judge = Keypair::new();
        let charity = Keypair::new();
        svm.airdrop(&admin.pubkey(), 100 * SOL).unwrap();
        svm.airdrop(&judge.pubkey(), 10 * SOL).unwrap();
        svm.airdrop(&charity.pubkey(), SOL).unwrap();
        let mut env = Env { svm, admin, judge, charity };
        env.set_time(T0);
        let args = ConfigArgs {
            judge: env.judge.pubkey(),
            charities: [env.charity.pubkey(), Pubkey::default(), Pubkey::default()],
            bonus_bps: 1_000,
            bonus_cap: SOL / 20,
        };
        let ix = Instruction::new_with_bytes(
            pid(),
            &stakehold::instruction::InitConfig { args }.data(),
            stakehold::accounts::InitConfig {
                admin: env.admin.pubkey(),
                config: config_pda(),
                pool: pool_pda(),
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        let admin = env.admin.insecure_clone();
        env.send(ix, &[&admin]).unwrap();
        env
    }

    fn set_time(&mut self, ts: i64) {
        let mut clock = self.svm.get_sysvar::<Clock>();
        clock.unix_timestamp = ts;
        clock.slot += 10;
        self.svm.set_sysvar(&clock);
    }

    fn send(&mut self, ix: Instruction, signers: &[&Keypair]) -> Result<(), String> {
        self.svm.expire_blockhash();
        let blockhash = self.svm.latest_blockhash();
        let msg = Message::new_with_blockhash(&[ix], Some(&signers[0].pubkey()), &blockhash);
        let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers).unwrap();
        self.svm.send_transaction(tx).map(|_| ()).map_err(|e| format!("{:?}", e.err))
    }

    fn funded(&mut self, lamports: u64) -> Keypair {
        let k = Keypair::new();
        self.svm.airdrop(&k.pubkey(), lamports).unwrap();
        k
    }

    fn lamports(&self, key: &Pubkey) -> u64 {
        self.svm.get_account(key).map(|a| a.lamports).unwrap_or(0)
    }

    fn load<T: AccountDeserialize>(&self, key: &Pubkey) -> T {
        let acc = self.svm.get_account(key).unwrap();
        T::try_deserialize(&mut &acc.data[..]).unwrap()
    }

    fn create(&mut self, creator: &Keypair, id: u64, mode: u8, days: u16, fail_dest: u8) -> Pubkey {
        let ch = challenge_pda(&creator.pubkey(), id);
        let args = CreateChallengeArgs {
            id,
            mode,
            demo: true,
            stake_lamports: STAKE,
            start_ts: T0 + DAY,
            day_len: DAY,
            num_days: days,
            grace_secs: GRACE,
            window_secs: 60,
            max_players: 4,
            config_hash: [7u8; 32],
            fail_dest,
            charity_index: 0,
        };
        let ix = Instruction::new_with_bytes(
            pid(),
            &stakehold::instruction::CreateChallenge { args }.data(),
            stakehold::accounts::CreateChallenge {
                creator: creator.pubkey(),
                config: config_pda(),
                challenge: ch,
                vault: vault_pda(&ch),
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        self.send(ix, &[creator]).unwrap();
        ch
    }

    fn join(&mut self, ch: &Pubkey, player: &Keypair) -> Result<Pubkey, String> {
        let p = participant_pda(ch, &player.pubkey());
        let ix = Instruction::new_with_bytes(
            pid(),
            &stakehold::instruction::JoinChallenge { utc_offset_min: 60 }.data(),
            stakehold::accounts::JoinChallenge {
                player: player.pubkey(),
                challenge: *ch,
                vault: vault_pda(ch),
                participant: p,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        self.send(ix, &[player]).map(|_| p)
    }

    fn open_window(&mut self, signer: &Keypair, ch: &Pubkey, p: &Pubkey, day: u16, index: u8) -> Result<Pubkey, String> {
        let w = window_pda(p, day, index);
        let prev = if index > 0 { Some(window_pda(p, day, index - 1)) } else { None };
        let ix = Instruction::new_with_bytes(
            pid(),
            &stakehold::instruction::OpenWindow { day, index }.data(),
            stakehold::accounts::OpenWindow {
                judge: signer.pubkey(),
                challenge: *ch,
                participant: *p,
                window: w,
                prev_window: prev,
                slot_hashes: SLOT_HASHES,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        self.send(ix, &[signer]).map(|_| w)
    }

    fn checkin(
        &mut self,
        signer: &Keypair,
        ch: &Pubkey,
        p: &Pubkey,
        day: u16,
        attempt: u8,
        verdict: u8,
        window: Option<Pubkey>,
    ) -> Result<(), String> {
        let args = CheckInArgs {
            day,
            attempt,
            verdict,
            reason_code: if verdict == VERDICT_PASS { 0 } else { 2 },
            proof_hash: [day as u8; 32],
            metric_a: 1234,
            metric_b: 56,
        };
        let ix = Instruction::new_with_bytes(
            pid(),
            &stakehold::instruction::RecordCheckin { args }.data(),
            stakehold::accounts::RecordCheckin {
                judge: signer.pubkey(),
                challenge: *ch,
                participant: *p,
                checkin: checkin_pda(p, day, attempt),
                window,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        self.send(ix, &[signer])
    }

    fn eliminate(&mut self, payer: &Keypair, ch: &Pubkey, p: &Pubkey, day: u16) -> Result<(), String> {
        let ix = Instruction::new_with_bytes(
            pid(),
            &stakehold::instruction::EliminateMissed { day }.data(),
            stakehold::accounts::EliminateMissed { challenge: *ch, participant: *p }.to_account_metas(None),
        );
        self.send(ix, &[payer])
    }

    fn forfeit(&mut self, player: &Keypair, ch: &Pubkey) -> Result<(), String> {
        let ix = Instruction::new_with_bytes(
            pid(),
            &stakehold::instruction::Forfeit {}.data(),
            stakehold::accounts::Forfeit {
                player: player.pubkey(),
                challenge: *ch,
                participant: participant_pda(ch, &player.pubkey()),
            }
            .to_account_metas(None),
        );
        self.send(ix, &[player])
    }

    fn settle(&mut self, payer: &Keypair, ch: &Pubkey, parts: &[Pubkey], charity: Option<Pubkey>) -> Result<(), String> {
        let mut metas = stakehold::accounts::Settle {
            challenge: *ch,
            vault: vault_pda(ch),
            config: config_pda(),
            pool: pool_pda(),
            charity,
        }
        .to_account_metas(None);
        metas.extend(parts.iter().map(|k| AccountMeta::new(*k, false)));
        let ix = Instruction::new_with_bytes(pid(), &stakehold::instruction::Settle {}.data(), metas);
        self.send(ix, &[payer])
    }

    fn claim(&mut self, player: &Keypair, ch: &Pubkey) -> Result<(), String> {
        let ix = Instruction::new_with_bytes(
            pid(),
            &stakehold::instruction::Claim {}.data(),
            stakehold::accounts::Claim {
                player: player.pubkey(),
                challenge: *ch,
                vault: vault_pda(ch),
                participant: participant_pda(ch, &player.pubkey()),
            }
            .to_account_metas(None),
        );
        self.send(ix, &[player])
    }

    fn donate(&mut self, donor: &Keypair, amount: u64) {
        let ix = Instruction::new_with_bytes(
            pid(),
            &stakehold::instruction::DonateToPool { amount }.data(),
            stakehold::accounts::DonateToPool {
                donor: donor.pubkey(),
                pool: pool_pda(),
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        self.send(ix, &[donor]).unwrap();
    }
}

#[test]
fn group_challenge_full_loop() {
    let mut env = Env::new();
    let judge = env.judge.insecure_clone();
    let creator = env.funded(5 * SOL);
    let ch = env.create(&creator, 1, MODE_GROUP, 2, FAIL_TO_POOL);

    let players: Vec<Keypair> = (0..4).map(|_| env.funded(2 * SOL)).collect();
    let parts: Vec<Pubkey> = players.iter().map(|k| env.join(&ch, k).unwrap()).collect();
    let state: Challenge = env.load(&ch);
    assert_eq!(state.player_count, 4);
    assert_eq!(state.pot_lamports, 4 * STAKE);
    assert_eq!(state.judge, judge.pubkey());

    // Cannot join twice, cannot exceed max players.
    assert!(env.join(&ch, &players[0]).is_err());
    let late = env.funded(2 * SOL);
    assert!(env.join(&ch, &late).is_err(), "challenge is full");

    // Day 1 starts.
    env.set_time(T0 + DAY + 5);

    // Only the judge can open windows; pose comes from the SlotHashes sysvar.
    let slot_hashes = env.svm.get_sysvar::<SlotHashes>();
    let (recent_slot, recent_hash) = *slot_hashes.first().unwrap();
    assert!(env.open_window(&players[0], &ch, &parts[0], 1, 0).is_err());
    let w0 = env.open_window(&judge, &ch, &parts[0], 1, 0).unwrap();
    let win: Window = env.load(&w0);
    assert_eq!(win.slot, recent_slot);
    assert_eq!(win.slot_hash, recent_hash.to_bytes());
    assert_eq!(win.pose, pose_from_hash(&recent_hash.to_bytes()));
    assert!((1..=5).contains(&win.pose[0]) && win.pose[1] < 4 && win.pose[2] < 4);
    assert!(env.open_window(&judge, &ch, &parts[0], 2, 0).is_err(), "not day 2 yet");

    // Check-out window must produce a different pose than the check-in.
    let w1 = env.open_window(&judge, &ch, &parts[0], 1, 1).unwrap();
    let win1: Window = env.load(&w1);
    assert_ne!(win1.pose, win.pose);

    // Only the judge records verdicts.
    assert!(env.checkin(&players[0], &ch, &parts[0], 1, 0, VERDICT_PASS, None).is_err());
    env.checkin(&judge, &ch, &parts[0], 1, 0, VERDICT_PASS, Some(w0)).unwrap();
    env.checkin(&judge, &ch, &parts[1], 1, 0, VERDICT_PASS, None).unwrap();
    env.checkin(&judge, &ch, &parts[2], 1, 0, VERDICT_PASS, None).unwrap();
    // Player 3 fails twice (wrong pose, then retake also wrong).
    env.checkin(&judge, &ch, &parts[3], 1, 0, VERDICT_FAIL, None).unwrap();
    env.checkin(&judge, &ch, &parts[3], 1, 1, VERDICT_FAIL, None).unwrap();
    let ci: CheckIn = env.load(&checkin_pda(&parts[0], 1, 0));
    assert_eq!(ci.verdict, VERDICT_PASS);
    assert_eq!(ci.window, w0);
    assert_eq!(ci.proof_hash, [1u8; 32]);

    // Cannot eliminate before the day (plus grace) is over.
    assert!(env.eliminate(&creator, &ch, &parts[3], 1).is_err());
    env.set_time(T0 + 2 * DAY + GRACE);
    // Anyone can eliminate a member who missed; a member who passed cannot be eliminated.
    assert!(env.eliminate(&creator, &ch, &parts[0], 1).is_err());
    env.eliminate(&creator, &ch, &parts[3], 1).unwrap();
    let p3: Participant = env.load(&parts[3]);
    assert_eq!(p3.status, PLAYER_ELIMINATED);
    assert_eq!(p3.eliminated_day, 1);
    // Eliminated members get no more check-ins.
    assert!(env.checkin(&judge, &ch, &parts[3], 2, 0, VERDICT_PASS, None).is_err());

    // Day 2: players 0 and 1 pass, player 2 quits.
    env.checkin(&judge, &ch, &parts[0], 2, 0, VERDICT_PASS, None).unwrap();
    env.checkin(&judge, &ch, &parts[1], 2, 0, VERDICT_PASS, None).unwrap();
    env.forfeit(&players[2], &ch).unwrap();
    assert!(env.claim(&players[0], &ch).is_err(), "not settled");
    assert!(env.settle(&creator, &ch, &parts, None).is_err(), "not ended");

    // After the end: settle must include every participant exactly once.
    env.set_time(T0 + 3 * DAY + GRACE);
    assert!(env.checkin(&judge, &ch, &parts[0], 2, 1, VERDICT_PASS, None).is_err(), "too late");
    assert!(env.settle(&creator, &ch, &parts[..3], None).is_err());
    let dup = vec![parts[0], parts[0], parts[1], parts[2]];
    assert!(env.settle(&creator, &ch, &dup, None).is_err());
    env.settle(&creator, &ch, &parts, None).unwrap();
    assert!(env.settle(&creator, &ch, &parts, None).is_err(), "settle once");

    let state: Challenge = env.load(&ch);
    assert_eq!(state.status, CHALLENGE_SETTLED);
    assert_eq!(state.survivor_count, 2);
    assert_eq!(state.share_lamports, 2 * STAKE);

    let before = env.lamports(&players[0].pubkey());
    env.claim(&players[0], &ch).unwrap();
    // claim tx fee is paid by player: 5000 lamports
    assert_eq!(env.lamports(&players[0].pubkey()), before + 2 * STAKE - 5000);
    assert!(env.claim(&players[0], &ch).is_err(), "no double claim");
    assert!(env.claim(&players[2], &ch).is_err(), "quitter cannot claim");
    assert!(env.claim(&players[3], &ch).is_err(), "eliminated cannot claim");
    env.claim(&players[1], &ch).unwrap();

    // Vault keeps only its rent.
    let vault = vault_pda(&ch);
    let rent = env.svm.minimum_balance_for_rent_exemption(env.svm.get_account(&vault).unwrap().data.len());
    assert_eq!(env.lamports(&vault), rent);
}

#[test]
fn nobody_survives_goes_to_pool() {
    let mut env = Env::new();
    let creator = env.funded(5 * SOL);
    let ch = env.create(&creator, 2, MODE_PUBLIC, 1, FAIL_TO_POOL);
    let a = env.funded(SOL);
    let b = env.funded(SOL);
    let pa = env.join(&ch, &a).unwrap();
    let pb = env.join(&ch, &b).unwrap();
    let pool_before = env.lamports(&pool_pda());
    env.set_time(T0 + 2 * DAY + GRACE);
    env.settle(&creator, &ch, &[pa, pb], None).unwrap();
    assert_eq!(env.lamports(&pool_pda()), pool_before + 2 * STAKE);
    let pool: CommunityPool = env.load(&pool_pda());
    assert_eq!(pool.total_in, 2 * STAKE);
}

#[test]
fn solo_success_gets_bonus_and_failure_goes_to_charity() {
    let mut env = Env::new();
    let donor = env.funded(5 * SOL);
    env.donate(&donor, SOL);

    // Success: stake back + 10% of pool, capped at 0.05 SOL.
    let solo = env.funded(2 * SOL);
    let ch = env.create(&solo, 3, MODE_SOLO, 1, FAIL_TO_POOL);
    let other = env.funded(SOL);
    assert!(env.join(&ch, &other).is_err(), "solo is creator-only");
    let p = env.join(&ch, &solo).unwrap();
    env.set_time(T0 + DAY + 10);
    let judge = env.judge.insecure_clone();
    env.checkin(&judge, &ch, &p, 1, 0, VERDICT_PASS, None).unwrap();
    env.set_time(T0 + 2 * DAY + GRACE);
    env.settle(&donor, &ch, &[p], None).unwrap();
    let state: Challenge = env.load(&ch);
    assert_eq!(state.bonus_lamports, SOL / 20);
    let before = env.lamports(&solo.pubkey());
    env.claim(&solo, &ch).unwrap();
    assert_eq!(env.lamports(&solo.pubkey()), before + STAKE + SOL / 20 - 5000);

    // Failure to charity: the charity must be the approved one.
    let solo2 = env.funded(2 * SOL);
    env.set_time(T0);
    let ch2 = env.create(&solo2, 4, MODE_SOLO, 1, FAIL_TO_CHARITY);
    let p2 = env.join(&ch2, &solo2).unwrap();
    env.set_time(T0 + 2 * DAY + GRACE);
    let impostor = Keypair::new().pubkey();
    assert!(env.settle(&donor, &ch2, &[p2], Some(impostor)).is_err());
    assert!(env.settle(&donor, &ch2, &[p2], None).is_err());
    let charity = env.charity.pubkey();
    let before = env.lamports(&charity);
    env.settle(&donor, &ch2, &[p2], Some(charity)).unwrap();
    assert_eq!(env.lamports(&charity), before + STAKE);
}

#[test]
fn join_after_start_rejected() {
    let mut env = Env::new();
    let creator = env.funded(5 * SOL);
    let ch = env.create(&creator, 5, MODE_GROUP, 3, FAIL_TO_POOL);
    env.set_time(T0 + DAY);
    let late = env.funded(SOL);
    assert!(env.join(&ch, &late).is_err());
}

#[test]
fn early_settle_last_one_standing() {
    let mut env = Env::new();
    let creator = env.funded(5 * SOL);
    let ch = env.create(&creator, 6, MODE_GROUP, 3, FAIL_TO_POOL);
    let a = env.funded(SOL);
    let b = env.funded(SOL);
    let pa = env.join(&ch, &a).unwrap();
    let pb = env.join(&ch, &b).unwrap();
    // Two players still in: no early settlement.
    env.set_time(T0 + DAY + 10);
    assert!(env.settle(&creator, &ch, &[pa, pb], None).is_err());
    // b quits on day 1 → a is the last one standing and takes the pot immediately.
    env.forfeit(&b, &ch).unwrap();
    env.settle(&creator, &ch, &[pa, pb], None).unwrap();
    let state: Challenge = env.load(&ch);
    assert_eq!(state.survivor_count, 1);
    assert_eq!(state.share_lamports, 2 * STAKE);
    let before = env.lamports(&a.pubkey());
    env.claim(&a, &ch).unwrap();
    assert_eq!(env.lamports(&a.pubkey()), before + 2 * STAKE - 5000);
}

#[test]
fn early_settle_still_checks_finished_days() {
    let mut env = Env::new();
    let creator = env.funded(5 * SOL);
    let ch = env.create(&creator, 7, MODE_GROUP, 3, FAIL_TO_POOL);
    let a = env.funded(SOL);
    let b = env.funded(SOL);
    let pa = env.join(&ch, &a).unwrap();
    let pb = env.join(&ch, &b).unwrap();
    // Day 1 is over (with grace) and b never passed it; a quits on day 2.
    env.set_time(T0 + 2 * DAY + GRACE + 1);
    env.forfeit(&a, &ch).unwrap();
    let pool_before = env.lamports(&pool_pda());
    env.settle(&creator, &ch, &[pa, pb], None).unwrap();
    let state: Challenge = env.load(&ch);
    assert_eq!(state.survivor_count, 0, "b missed a finished day, so nobody survives");
    assert_eq!(env.lamports(&pool_pda()), pool_before + 2 * STAKE);
}

#[test]
fn solo_settles_early_once_out() {
    let mut env = Env::new();
    let solo = env.funded(2 * SOL);
    let ch = env.create(&solo, 8, MODE_SOLO, 3, FAIL_TO_POOL);
    let p = env.join(&ch, &solo).unwrap();
    env.set_time(T0 + DAY + 10);
    assert!(env.settle(&solo, &ch, &[p], None).is_err(), "solo player still in: wait for the end");
    env.forfeit(&solo, &ch).unwrap();
    let pool_before = env.lamports(&pool_pda());
    env.settle(&solo, &ch, &[p], None).unwrap();
    assert_eq!(env.lamports(&pool_pda()), pool_before + STAKE);
}
