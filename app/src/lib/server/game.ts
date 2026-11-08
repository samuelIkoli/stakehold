// Game engine shared by the API routes and the background scheduler.
// Onchain = truth for money and verdicts; the DB mirrors it and keeps the details.
import { PublicKey } from "@solana/web3.js";
import type { Challenge, Participant, ProofWindow } from "@prisma/client";
import { db } from "../db";
import { dayAt, dayEnd, pickWindowTime, type DayClock } from "../time";
import { PLAYER_STATUS, REASON_CODES } from "../solana/constants";
import { describePose, poseFromArray, poseForJudge } from "../pose";
import { fetchDuolingo, evaluateDuolingo } from "../duolingo";
import { countPushedCommits } from "../github";
import { judgePhoto, type JudgeResult } from "../ai";
import { withinGeofence } from "../geo";
import * as chain from "./chain";
import { sha256, storage } from "./storage";
import { HttpError, friendlyChainError } from "./auth";
import { botKeypair } from "./bots";

export type ChallengeWithPlayers = Challenge & { participants: Participant[] };

export const clockOf = (ch: Challenge, p: Participant): DayClock => ({
  startTs: p.startTs,
  dayLen: ch.dayLen,
  numDays: ch.numDays,
});

export const passedDay = (p: Participant, day: number) => day >= 1 && (BigInt(p.passedBitmap) & (BigInt(1) << BigInt(day - 1))) !== BigInt(0);

export async function logEvent(challengeId: string, type: string, message: string, extra: { participantId?: string; tx?: string } = {}) {
  await db.event.create({ data: { challengeId, type, message, ...extra } });
}

export function displayName(p: Participant) {
  return p.name || `${p.wallet.slice(0, 4)}…${p.wallet.slice(-4)}`;
}

// ---------------------------------------------------------------- chain sync

export async function syncChallenge(challengeId: string) {
  const ch = await db.challenge.findUnique({ where: { id: challengeId } });
  if (!ch) return;
  const key = new PublicKey(challengeId);
  const program = chain.readProgram();
  const onchain = await chain.fetchChallenge(key, program);
  if (!onchain) return;
  const parts = await chain.fetchParticipants(key, program);
  for (const p of parts) {
    const status = PLAYER_STATUS[p.account.status] ?? "active";
    const existing = await db.participant.findUnique({ where: { id: p.publicKey.toBase58() } });
    const data = {
      status,
      daysPassed: p.account.daysPassed,
      passedBitmap: p.account.passedBitmap.toString(),
      eliminatedDay: p.account.status === 1 ? p.account.eliminatedDay : null,
    };
    if (existing) {
      await db.participant.update({
        where: { id: existing.id },
        data: {
          ...data,
          eliminatedReason:
            p.account.status === 1 && !existing.eliminatedReason
              ? p.account.eliminatedReason === 1
                ? "Quit"
                : "No passing proof"
              : existing.eliminatedReason,
        },
      });
    } else {
      // Joined onchain without going through our app: still show them.
      await db.participant.create({
        data: {
          id: p.publicKey.toBase58(),
          challengeId,
          wallet: p.account.player.toBase58(),
          tz: "UTC",
          utcOffsetMin: p.account.utcOffsetMin,
          startTs: p.account.startTs.toNumber(),
          joinTx: "",
          ...data,
        },
      });
    }
  }
  await db.challenge.update({
    where: { id: challengeId },
    data: { status: onchain.status === 1 ? "settled" : "active", lastSync: Math.floor(Date.now() / 1000) },
  });
}

// ---------------------------------------------------------------- windows

export async function openWindowFor(ch: Challenge, p: Participant, day: number, index: number): Promise<ProofWindow> {
  const existing = await db.proofWindow.findUnique({ where: { participantId_day_index: { participantId: p.id, day, index } } });
  if (existing?.status === "open") return existing;
  const now = Math.floor(Date.now() / 1000);
  const base = existing ?? (await db.proofWindow.create({ data: { challengeId: ch.id, participantId: p.id, day, index, scheduledAt: now } }));
  try {
    const w = await chain.openWindow(new PublicKey(ch.id), new PublicKey(p.id), day, index);
    const updated = await db.proofWindow.update({
      where: { id: base.id },
      data: {
        status: "open",
        pda: w.pda,
        slot: w.slot,
        slotHash: w.slotHash,
        pose: JSON.stringify(w.pose),
        openedAt: w.openedAt,
        expiresAt: w.expiresAt,
        tx: w.sig,
        error: null,
      },
    });
    const what =
      ch.proofType === "gym" ? (index === 0 ? "Check-in window" : "Check-out window") : perDayOf(ch) > 1 ? "Photo window" : "Proof window";
    await logEvent(ch.id, "window", `${what} opened for ${displayName(p)} · day ${day} · ${describePose(poseFromArray(w.pose))}`, {
      participantId: p.id,
      tx: w.sig,
    });
    return updated;
  } catch (e) {
    const msg = friendlyChainError(String(e));
    // Someone (or a previous tick) may already have opened it onchain.
    if (/already in use/i.test(String(e))) {
      const w = await chain.readProgram().account.window.fetchNullable(chain.windowPda(new PublicKey(p.id), day, index));
      if (w) {
        return db.proofWindow.update({
          where: { id: base.id },
          data: {
            status: "open",
            pda: chain.windowPda(new PublicKey(p.id), day, index).toBase58(),
            slot: w.slot.toString(),
            slotHash: Buffer.from(w.slotHash).toString("hex"),
            pose: JSON.stringify(Array.from(w.pose)),
            openedAt: w.openedAt.toNumber(),
            expiresAt: w.expiresAt.toNumber(),
          },
        });
      }
    }
    await db.proofWindow.update({ where: { id: base.id }, data: { error: msg } });
    throw new HttpError(502, `Could not open window: ${msg}`);
  }
}

// ---------------------------------------------------------------- recording verdicts

async function recordVerdict(opts: {
  ch: Challenge;
  p: Participant;
  day: number;
  kind: string;
  verdict: "pass" | "fail" | "baseline";
  reason: string;
  reasonCode: number;
  proofHash: Buffer;
  checks?: unknown;
  files?: string[];
  metricA?: number;
  metricB?: number;
  windowPda?: string | null;
  windowIndex?: number;
  lat?: number;
  lng?: number;
  onchain?: boolean;
}) {
  const { ch, p } = opts;
  let tx: string | undefined;
  let checkinPda: string | undefined;
  if (opts.onchain !== false) {
    const attempt = await chain.nextAttempt(new PublicKey(p.id), opts.day);
    if (attempt > 7) throw new HttpError(429, "No attempts left for today");
    const r = await chain.recordCheckin({
      challenge: new PublicKey(ch.id),
      participant: new PublicKey(p.id),
      day: opts.day,
      attempt,
      verdict: opts.verdict === "pass" ? 1 : opts.verdict === "baseline" ? 2 : 0,
      reasonCode: opts.reasonCode,
      proofHash: opts.proofHash,
      metricA: opts.metricA,
      metricB: opts.metricB,
      window: opts.windowPda ? new PublicKey(opts.windowPda) : null,
    });
    tx = r.sig;
    checkinPda = r.pda;
  }
  const attemptNo = await db.proof.count({ where: { participantId: p.id, day: opts.day, kind: opts.kind } });
  const proof = await db.proof.create({
    data: {
      challengeId: ch.id,
      participantId: p.id,
      day: opts.day,
      attempt: attemptNo,
      kind: opts.kind,
      files: JSON.stringify(opts.files ?? []),
      proofHash: opts.proofHash.toString("hex"),
      verdict: opts.verdict,
      reason: opts.reason,
      reasonCode: opts.reasonCode,
      checks: JSON.stringify(opts.checks ?? {}),
      metricA: opts.metricA,
      metricB: opts.metricB,
      lat: opts.lat,
      lng: opts.lng,
      windowIndex: opts.windowIndex,
      onchain: opts.onchain !== false,
      checkinPda,
      tx,
    },
  });
  if (opts.verdict === "pass" && opts.onchain !== false && !passedDay(p, opts.day)) {
    const bitmap = BigInt(p.passedBitmap) | (BigInt(1) << BigInt(opts.day - 1));
    await db.participant.update({ where: { id: p.id }, data: { passedBitmap: bitmap.toString(), daysPassed: { increment: 1 } } });
  }
  if (opts.verdict !== "baseline" && opts.onchain !== false) {
    await logEvent(
      ch.id,
      opts.verdict === "pass" ? "pass" : "fail",
      `${displayName(p)} · day ${opts.day} · ${opts.verdict === "pass" ? "✅ passed" : "❌ rejected"}: ${opts.reason}`,
      { participantId: p.id, tx },
    );
  }
  return proof;
}

// ---------------------------------------------------------------- photo + gym proof

export type PhotoSubmission = {
  ch: Challenge;
  p: Participant;
  kind: "photo" | "gym_in" | "gym_out";
  image: Buffer;
  mimeType: string;
  lat?: number;
  lng?: number;
  accuracy?: number;
};

const MAX_PHOTO_SUBMISSIONS_PER_WINDOW = 2; // the photo + one retake

/** Photos needed per day (photo challenges); > 1 means players open each window themselves. */
export function perDayOf(ch: Challenge): number {
  if (ch.proofType !== "photo") return 1;
  try {
    return Math.min(5, Math.max(1, Number((JSON.parse(ch.plan) as { perDay?: number }).perDay) || 1));
  } catch {
    return 1;
  }
}

/** Passing photos already taken today (multi-photo days keep all but the last offchain). */
export function photoPassesToday(p: Participant, day: number) {
  return db.proof.findMany({ where: { participantId: p.id, day, kind: "photo", verdict: "pass" }, orderBy: { createdAt: "asc" } });
}

export async function submitPhoto(s: PhotoSubmission) {
  const { ch, p } = s;
  const now = Math.floor(Date.now() / 1000);
  if (p.status !== "active") throw new HttpError(400, "You're no longer active in this challenge");
  const day = dayAt(clockOf(ch, p), now);
  if (day < 1 || day > ch.numDays) throw new HttpError(400, "The challenge isn't running for you right now");
  if (passedDay(p, day)) throw new HttpError(400, "You've already passed today 🎉");
  const perDay = perDayOf(ch);
  const earlier = s.kind === "photo" && perDay > 1 ? await photoPassesToday(p, day) : [];
  const latest = perDay > 1 ? await db.proofWindow.findFirst({ where: { participantId: p.id, day }, orderBy: { index: "desc" } }) : null;
  const index = s.kind === "gym_out" ? 1 : perDay > 1 ? (latest?.index ?? 0) : 0;
  const win = await db.proofWindow.findUnique({ where: { participantId_day_index: { participantId: p.id, day, index } } });
  if (!win || win.status !== "open" || !win.pose) throw new HttpError(400, "No proof window is open for you right now");
  if (now > (win.expiresAt ?? 0) + 30) throw new HttpError(400, "This proof window has closed");
  if (perDay > 1 && earlier.some((e) => e.windowIndex === index)) throw new HttpError(400, "That photo is done — open a new window for the next one");
  const used = await db.proof.count({ where: { participantId: p.id, day, kind: s.kind, windowIndex: index } });
  if (used >= MAX_PHOTO_SUBMISSIONS_PER_WINDOW) throw new HttpError(400, "You've used your photo and your one retake for this window");

  const pose = poseFromArray(JSON.parse(win.pose));
  const imageHash = sha256(s.image);
  const file = await storage.put(`${p.id.slice(0, 8)}-d${day}-${s.kind}`, s.image, s.mimeType);
  const rules = JSON.parse(ch.plan) as { rule: string };

  // ---- Layer 1: code checks hard facts (location, time gap) ----
  const codeChecks: Record<string, unknown> = {};
  let codeFail: { reason: string; code: number } | null = null;
  let gymIn: Awaited<ReturnType<typeof db.proof.findFirst>> = null;
  if (s.kind !== "photo") {
    if (ch.gymLat == null || ch.gymLng == null) throw new HttpError(500, "Gym location missing");
    if (s.lat == null || s.lng == null) {
      codeFail = { reason: "We need your GPS location to verify you're at the gym. Allow location access and retake.", code: 4 };
    } else {
      const g = withinGeofence({ lat: s.lat, lng: s.lng, accuracy: s.accuracy }, { lat: ch.gymLat, lng: ch.gymLng }, ch.gymRadiusM ?? 100);
      codeChecks.distance_m = g.distance;
      codeChecks.gps_accuracy_m = g.accuracy;
      codeChecks.at_gym = g.ok;
      if (!g.ok) codeFail = { reason: `You're ${g.distance} m from ${ch.gymLabel || "the gym"} (limit ${ch.gymRadiusM ?? 100} m).`, code: 4 };
    }
    if (s.kind === "gym_out") {
      gymIn = await db.proof.findFirst({ where: { participantId: p.id, day, kind: "gym_in", verdict: "pass" }, orderBy: { createdAt: "desc" } });
      if (!gymIn) throw new HttpError(400, "Check in first");
      const gap = now - Math.floor(gymIn.createdAt.getTime() / 1000);
      codeChecks.gap_secs = gap;
      const need = ch.minGapSecs ?? 2700;
      if (gap < need) codeFail = { reason: `Only ${Math.floor(gap / 60)} min since check-in — need ${Math.ceil(need / 60)} min.`, code: 5 };
    }
  }

  // ---- Layer 2: AI judges the photo ----
  let ai: JudgeResult | null = null;
  if (!codeFail) {
    ai = await judgePhoto({
      image: { mimeType: s.mimeType, base64: s.image.toString("base64") },
      poseText: poseForJudge(pose),
      poseShort: describePose(pose),
      habit: ch.habit,
      rule: rules.rule,
      kind: s.kind,
      part: perDay > 1 ? { n: earlier.length + 1, of: perDay } : undefined,
    });
  }
  const pass = !codeFail && ai?.verdict === "pass";
  const reason = codeFail?.reason ?? ai!.reason;
  const reasonCode = codeFail?.code ?? ai!.reasonCode;
  const checks = { ...codeChecks, ...(ai?.checks ?? {}), model: ai?.model };

  // Proof hash commits to the photo, the pose window and (gym) the check-in photo + GPS.
  // Multi-photo days: the last photo's hash also commits to the day's earlier photos.
  const proofHash =
    s.kind === "gym_out" && gymIn
      ? sha256(Buffer.concat([Buffer.from(gymIn.proofHash, "hex"), imageHash, Buffer.from(JSON.stringify({ lat: s.lat, lng: s.lng, w: win.pda }))]))
      : sha256(Buffer.concat([...earlier.map((e) => Buffer.from(e.proofHash, "hex")), imageHash, Buffer.from(win.pda ?? "")]));

  // Gym check-in passes and all but the last photo of a multi-photo day are kept
  // offchain; the day's onchain verdict commits to every photo. Every rejection is
  // recorded onchain.
  const partial = pass && (s.kind === "gym_in" || (s.kind === "photo" && earlier.length < perDay - 1));
  const onchain = !partial;
  const minutes = gymIn ? Math.floor((now - Math.floor(gymIn.createdAt.getTime() / 1000)) / 60) : undefined;
  const proof = await recordVerdict({
    ch,
    p,
    day,
    kind: s.kind,
    verdict: pass ? "pass" : "fail",
    reason,
    reasonCode,
    proofHash,
    checks,
    files: [file],
    metricA: minutes,
    windowPda: win.pda,
    windowIndex: index,
    lat: s.lat,
    lng: s.lng,
    onchain,
  });
  if (s.kind === "gym_in" && pass) {
    await logEvent(ch.id, "checkin", `${displayName(p)} checked in at ${ch.gymLabel || "the gym"} · day ${day}`, { participantId: p.id });
  }
  if (s.kind === "photo" && partial) {
    await logEvent(ch.id, "checkin", `${displayName(p)} · day ${day} · 📸 photo ${earlier.length + 1} of ${perDay} accepted`, { participantId: p.id });
  }
  return {
    verdict: pass ? "pass" : "fail",
    reason,
    reasonCode,
    reasonLabel: REASON_CODES[reasonCode],
    checks,
    tx: proof.tx,
    proofHash: proof.proofHash,
    retakesLeft: Math.max(0, MAX_PHOTO_SUBMISSIONS_PER_WINDOW - used - 1),
    day,
    part: perDay > 1 ? { n: earlier.length + 1, of: perDay, dayDone: pass && !partial } : undefined,
  };
}

// ---------------------------------------------------------------- honor system

export async function submitHonor(ch: Challenge, p: Participant, note: string) {
  const now = Math.floor(Date.now() / 1000);
  const day = dayAt(clockOf(ch, p), now);
  if (p.status !== "active") throw new HttpError(400, "You're no longer active");
  if (day < 1 || day > ch.numDays) throw new HttpError(400, "The challenge isn't running for you right now");
  if (passedDay(p, day)) throw new HttpError(400, "Already checked in today");
  const proof = await recordVerdict({
    ch,
    p,
    day,
    kind: "honor",
    verdict: "pass",
    reason: note ? `Self-reported: "${note.slice(0, 120)}"` : "Self-reported (honor system)",
    reasonCode: 11,
    proofHash: sha256(JSON.stringify({ p: p.id, day, note, now })),
  });
  return { verdict: "pass", reason: proof.reason, tx: proof.tx, day };
}

// ---------------------------------------------------------------- Duolingo

async function takeSnapshot(p: Participant, boundary: number, source: "scheduled" | "manual") {
  if (!p.duolingoUsername) throw new HttpError(400, "No Duolingo account linked");
  const prof = await fetchDuolingo(p.duolingoUsername);
  if (!prof) throw new HttpError(404, "Duolingo profile not found or not public");
  return db.duoSnapshot.create({
    data: { participantId: p.id, boundary, totalXp: prof.totalXp, streak: prof.streak, takenAt: Math.floor(Date.now() / 1000), source },
  });
}

/** Snapshot to compare day `day` against: the scheduled one at the start of that day. */
async function baseFor(ch: Challenge, p: Participant, day: number) {
  const boundaryTs = p.startTs + (day - 1) * ch.dayLen;
  const exact = await db.duoSnapshot.findFirst({ where: { participantId: p.id, boundary: day - 1, source: "scheduled" }, orderBy: { takenAt: "asc" } });
  const lateLimit = Math.max(60, Math.min(900, ch.dayLen / 8));
  if (exact && exact.takenAt - boundaryTs <= lateLimit) return { snap: exact, missed: false };
  const earlier = await db.duoSnapshot.findFirst({
    where: { participantId: p.id, boundary: { lt: day }, source: "scheduled" },
    orderBy: [{ boundary: "desc" }, { takenAt: "asc" }],
  });
  return { snap: earlier, missed: true };
}

export async function recordBaseline(ch: Challenge, p: Participant) {
  const snap = await takeSnapshot(p, 0, "scheduled");
  const proof = await recordVerdict({
    ch,
    p,
    day: 0,
    kind: "baseline",
    verdict: "baseline",
    reason: `Starting point: ${snap.totalXp} XP`,
    reasonCode: 14,
    proofHash: sha256(JSON.stringify({ u: p.duolingoUsername, xp: snap.totalXp, streak: snap.streak, t: snap.takenAt })),
    metricA: snap.totalXp,
    metricB: snap.streak,
  });
  await logEvent(ch.id, "baseline", `${displayName(p)} starting point recorded: ${snap.totalXp} XP`, { participantId: p.id, tx: proof.tx ?? undefined });
  return snap;
}

/**
 * After a wallet links its Duolingo account: attach it to every active Duolingo
 * challenge that wallet joined without one, and take the starting point right away if
 * the challenge has already begun (otherwise the scheduler takes it at the start).
 * One Duolingo account can't be used by two players in the same challenge; those
 * challenges are returned as conflicts.
 */
export async function attachDuolingo(wallet: string, username: string): Promise<string[]> {
  const conflicts: string[] = [];
  const now = Math.floor(Date.now() / 1000);
  const parts = await db.participant.findMany({
    where: { wallet, status: "active", duolingoUsername: null, challenge: { proofType: "duolingo", status: "active" } },
    include: { challenge: true },
  });
  for (const part of parts) {
    const clash = await db.participant.findFirst({
      where: { challengeId: part.challengeId, NOT: { id: part.id }, duolingoUsername: { equals: username } },
    });
    if (clash) {
      conflicts.push(part.challenge.title);
      continue;
    }
    const p = await db.participant.update({ where: { id: part.id }, data: { duolingoUsername: username } });
    const ch = part.challenge;
    const day = dayAt(clockOf(ch, p), now);
    if (day >= 1 && day <= ch.numDays) {
      const hasBase = await db.duoSnapshot.count({ where: { participantId: p.id, boundary: 0, source: "scheduled" } });
      if (!hasBase) await recordBaseline(ch, p).catch((e) => console.warn("[duolingo] baseline on link failed:", String(e)));
    }
  }
  return conflicts;
}

/** "I'm done for today" (manual) or the scheduled end-of-day check. */
export async function checkDuolingo(ch: Challenge, p: Participant, opts: { day?: number; source: "scheduled" | "manual" }) {
  const now = Math.floor(Date.now() / 1000);
  const day = opts.day ?? dayAt(clockOf(ch, p), now);
  if (p.status !== "active") throw new HttpError(400, "You're no longer active");
  if (day < 1 || day > ch.numDays) throw new HttpError(400, "The challenge isn't running for you right now");
  if (passedDay(p, day)) return { pass: true, already: true, message: "Already passed today ✅", day };
  if (!p.duolingoUsername) throw new HttpError(400, "Link your Duolingo account first");
  const { snap: base } = await baseFor(ch, p, day);
  if (!base) {
    // No baseline yet (e.g. linked late): take it now. XP from before this moment doesn't count.
    const b = await recordBaseline(ch, p);
    return {
      pass: false,
      day,
      recorded: false,
      baselineJustTaken: true,
      xpGained: 0,
      message: `Starting point recorded just now: ${b.totalXp} XP. Earn ${ch.minXp ?? 30} XP from here, then tap again.`,
    };
  }
  const snap = await takeSnapshot(p, opts.source === "scheduled" ? day : day - 1, opts.source);
  const r = evaluateDuolingo(base, snap, ch.minXp ?? 30);
  if (!r.pass) return { ...r, day, recorded: false, unchanged: snap.totalXp === base.totalXp };
  const proof = await recordVerdict({
    ch,
    p,
    day,
    kind: "duolingo",
    verdict: "pass",
    reason: `${r.message} (${base.totalXp} → ${snap.totalXp} XP)`,
    reasonCode: r.reasonCode,
    proofHash: sha256(JSON.stringify({ u: p.duolingoUsername, base: [base.totalXp, base.streak], now: [snap.totalXp, snap.streak], t: snap.takenAt })),
    metricA: snap.totalXp,
    metricB: snap.streak,
    checks: { xpGained: r.xpGained, xpBefore: base.totalXp, xpNow: snap.totalXp, minXp: ch.minXp ?? 30 },
  });
  return { ...r, day, recorded: true, tx: proof.tx };
}

// ---------------------------------------------------------------- GitHub

/** "I pushed — check" (manual) or the scheduled check during the grace period after a day. */
export async function checkGithub(ch: Challenge, p: Participant, opts: { day?: number; source: "scheduled" | "manual" }) {
  const now = Math.floor(Date.now() / 1000);
  const day = opts.day ?? dayAt(clockOf(ch, p), now);
  if (p.status !== "active") throw new HttpError(400, "You're no longer active");
  if (day < 1 || day > ch.numDays) throw new HttpError(400, "The challenge isn't running for you right now");
  if (passedDay(p, day)) return { pass: true, already: true, message: "Already passed today ✅", day };
  if (!p.githubUsername) throw new HttpError(400, "Add your GitHub username first");
  const min = (JSON.parse(ch.plan) as { minCommits?: number }).minCommits ?? 1;
  const from = p.startTs + (day - 1) * ch.dayLen;
  const r = await countPushedCommits(p.githubUsername, from, from + ch.dayLen);
  if (r.commits < min)
    return {
      pass: false,
      day,
      commits: r.commits,
      message: `${r.commits} commit${r.commits === 1 ? "" : "s"} pushed to public repos so far this ${ch.demo ? "round" : "day"} — you need ${min}. GitHub's feed can lag a few minutes after a push.`,
    };
  const proof = await recordVerdict({
    ch,
    p,
    day,
    kind: "github",
    verdict: "pass",
    reason: `${r.commits} commit${r.commits === 1 ? "" : "s"} pushed (${r.repos.slice(0, 3).join(", ")}) ✅`,
    reasonCode: 0,
    proofHash: sha256(JSON.stringify({ u: p.githubUsername, day, events: r.ids })),
    metricA: r.commits,
    metricB: r.pushes,
    checks: { commits: r.commits, pushes: r.pushes, repos: r.repos, minCommits: min },
  });
  return { pass: true, day, commits: r.commits, message: proof.reason, tx: proof.tx };
}

const githubChecked = new Map<string, number>();

// ---------------------------------------------------------------- bots (demo)

type BotScript = { name?: string; days?: Record<string, "pass" | "wrong_pose" | "skip">; quitDay?: number };

async function runBot(ch: Challenge, p: Participant, day: number, now: number) {
  const script = JSON.parse(p.botScript || "{}") as BotScript;
  if (script.quitDay === day) {
    const kp = botKeypair(p.wallet);
    if (!kp) return;
    const sig = await chain.botForfeit(kp, new PublicKey(ch.id));
    await db.participant.update({ where: { id: p.id }, data: { status: "eliminated", eliminatedDay: day, eliminatedReason: "Quit" } });
    await logEvent(ch.id, "quit", `${displayName(p)} quit on day ${day} 🏳️ — their stake stays in the pot`, { participantId: p.id, tx: sig });
    return;
  }
  const action = script.days?.[String(day)] ?? "pass";
  if (action === "skip" || passedDay(p, day)) return;
  const done = await db.proof.count({ where: { participantId: p.id, day } });
  if (action === "wrong_pose" && done >= 2) return;
  if (action === "pass" && done >= 1) return;
  // Photo challenges: bots act a few seconds after their window opens.
  let windowPda: string | null = null;
  if (ch.proofType === "photo") {
    const w = await db.proofWindow.findUnique({ where: { participantId_day_index: { participantId: p.id, day, index: 0 } } });
    if (!w || w.status !== "open" || now < (w.openedAt ?? 0) + 6 + (p.id.charCodeAt(3) % 10)) return;
    windowPda = w.pda;
  }
  const w = windowPda ? await db.proofWindow.findFirst({ where: { pda: windowPda } }) : null;
  const pose = w?.pose ? describePose(poseFromArray(JSON.parse(w.pose))) : "today's pose";
  const pass = action === "pass";
  await recordVerdict({
    ch,
    p,
    day,
    kind: "bot",
    verdict: pass ? "pass" : "fail",
    reason: pass
      ? `Scripted demo bot: pose matched (${pose}).`
      : `Scripted demo bot: wrong pose — showed 2 fingers pointing up, but the window asked for "${pose}".`,
    reasonCode: pass ? 12 : 1,
    proofHash: sha256(JSON.stringify({ bot: p.wallet, day, action, n: done })),
    windowPda,
  });
}

// ---------------------------------------------------------------- scheduler tick

const lastWarn = new Map<string, number>();
function warnOnce(key: string, msg: string) {
  const now = Date.now();
  if ((lastWarn.get(key) ?? 0) + 60_000 < now) {
    lastWarn.set(key, now);
    console.warn(`[scheduler] ${msg}`);
  }
}

export async function tickChallenge(ch: ChallengeWithPlayers, now: number) {
  if (now - ch.lastSync > (ch.demo ? 15 : 60)) {
    await syncChallenge(ch.id);
    const fresh = await db.challenge.findUnique({ where: { id: ch.id }, include: { participants: true } });
    if (!fresh || fresh.status !== "active") return;
    ch = fresh;
  }

  for (const p of ch.participants) {
    if (p.status !== "active") continue;
    const c = clockOf(ch, p);
    const day = dayAt(c, now);
    try {
      // Duolingo baseline at the member's own midnight.
      if (ch.proofType === "duolingo" && !p.isBot && day >= 1 && now < p.startTs + ch.dayLen + ch.graceSecs) {
        const hasBase = await db.duoSnapshot.count({ where: { participantId: p.id, boundary: 0, source: "scheduled" } });
        if (!hasBase) await recordBaseline(ch, p);
      }
      // Duolingo end-of-day snapshots + automatic check.
      if (ch.proofType === "duolingo" && !p.isBot) {
        for (let b = 1; b <= Math.min(day - 1, ch.numDays); b++) {
          if (now >= dayEnd(c, b) + ch.graceSecs) continue;
          const has = await db.duoSnapshot.count({ where: { participantId: p.id, boundary: b, source: "scheduled" } });
          if (has) continue;
          if (passedDay(p, b)) {
            await takeSnapshot(p, b, "scheduled");
          } else {
            const r = await checkDuolingo(ch, p, { day: b, source: "scheduled" });
            if (!r.pass) await logEvent(ch.id, "fail", `${displayName(p)} · day ${b} · ❌ ${r.message}`, { participantId: p.id });
          }
        }
      }
      // GitHub: re-check a finished day during its grace period (the public feed can lag).
      // Throttled to stay inside GitHub's unauthenticated rate limit.
      if (ch.proofType === "github" && !p.isBot && p.githubUsername && day >= 2) {
        const b = Math.min(day - 1, ch.numDays);
        const key = `${p.id}:${b}`;
        const every = ch.dayLen >= 3600 ? 300 : 45;
        if (!passedDay(p, b) && now < dayEnd(c, b) + ch.graceSecs && now - (githubChecked.get(key) ?? 0) >= every) {
          githubChecked.set(key, now);
          await checkGithub(ch, p, { day: b, source: "scheduled" });
        }
      }
      // Surprise windows for photo challenges.
      if (ch.proofType === "photo" && perDayOf(ch) === 1 && day >= 1 && day <= ch.numDays && !passedDay(p, day)) {
        let w = await db.proofWindow.findUnique({ where: { participantId_day_index: { participantId: p.id, day, index: 0 } } });
        if (!w) {
          const at = pickWindowTime(c, day, {
            demo: ch.demo,
            startHour: ch.windowStartHr,
            endHour: ch.windowEndHr,
            windowSecs: ch.windowSecs,
          });
          w = await db.proofWindow.create({ data: { challengeId: ch.id, participantId: p.id, day, index: 0, scheduledAt: at } });
        }
        if (w.status === "scheduled" && now >= w.scheduledAt && now < dayEnd(c, day) - 5) {
          await openWindowFor(ch, p, day, 0);
        }
      }
      if (p.isBot && day >= 1 && day <= ch.numDays) {
        const fresh = await db.participant.findUnique({ where: { id: p.id } });
        if (fresh?.status === "active") await runBot(ch, fresh, day, now);
      }
      // Eliminate members whose day ended without a pass.
      const fresh = await db.participant.findUnique({ where: { id: p.id } });
      if (!fresh || fresh.status !== "active") continue;
      for (let d = 1; d <= Math.min(day - 1, ch.numDays); d++) {
        if (passedDay(fresh, d) || now < dayEnd(c, d) + ch.graceSecs) continue;
        await eliminate(ch, fresh, d);
        break;
      }
    } catch (e) {
      warnOnce(`${p.id}`, `${ch.id.slice(0, 6)}/${p.id.slice(0, 6)}: ${friendlyChainError(String(e))}`);
    }
  }

  // Settle once every member's last day (plus grace) is over, or earlier as soon as the
  // outcome is decided after joining closed: at most one player left (group/public) or
  // the solo player is out. The program enforces the same rule.
  const lastEnd = Math.max(0, ...ch.participants.map((p) => p.startTs + ch.numDays * ch.dayLen));
  const startedOrEmpty = ch.participants.length > 0 || now > ch.refStartTs + 14 * 3600;
  const stillIn = await db.participant.count({ where: { challengeId: ch.id, status: "active" } });
  const decided = now >= ch.refStartTs + 2 && ch.participants.length > 0 && (ch.mode === "solo" ? stillIn === 0 : stillIn <= 1);
  if (decided || (startedOrEmpty && now >= Math.max(lastEnd, ch.refStartTs) + ch.graceSecs + 2)) {
    await settleChallenge(ch.id).catch((e) => warnOnce(`settle-${ch.id}`, `settle ${ch.id.slice(0, 6)}: ${friendlyChainError(String(e))}`));
  }
}

export async function eliminate(ch: Challenge, p: Participant, day: number) {
  try {
    const sig = await chain.eliminateMissed(new PublicKey(ch.id), new PublicKey(p.id), day);
    const lastFail = await db.proof.findFirst({ where: { participantId: p.id, day, verdict: "fail" }, orderBy: { createdAt: "desc" } });
    const reason = lastFail ? lastFail.reason : `No passing proof on day ${day}`;
    await db.participant.update({ where: { id: p.id }, data: { status: "eliminated", eliminatedDay: day, eliminatedReason: reason } });
    await logEvent(ch.id, "eliminated", `${displayName(p)} was eliminated on day ${day} 🔥 ${reason}`, { participantId: p.id, tx: sig });
    return sig;
  } catch (e) {
    if (/DayWasPassed|NotActive/.test(String(e))) await syncChallenge(ch.id);
    throw e;
  }
}

export async function settleChallenge(challengeId: string) {
  const ch = await db.challenge.findUnique({ where: { id: challengeId }, include: { participants: true } });
  if (!ch || ch.status !== "active") return null;
  let sig: string;
  try {
    sig = await chain.settle(new PublicKey(challengeId));
  } catch (e) {
    if (/AlreadySettled/.test(String(e))) {
      await syncChallenge(challengeId);
      return null;
    }
    throw e;
  }
  await syncChallenge(challengeId);
  const onchain = await chain.fetchChallenge(new PublicKey(challengeId));
  await db.challenge.update({ where: { id: challengeId }, data: { status: "settled", settleTx: sig } });
  const survivors = onchain?.survivorCount ?? 0;
  const share = onchain ? onchain.shareLamports.toNumber() + onchain.bonusLamports.toNumber() : 0;
  await logEvent(
    challengeId,
    "settled",
    survivors > 0
      ? `Settled 🏆 ${survivors} survivor${survivors > 1 ? "s" : ""} split the pot — ${(share / 1e9).toFixed(4)} SOL each`
      : ch.failDest === "charity"
        ? "Settled — nobody finished, the stake went to the chosen charity"
        : "Settled — nobody survived, the pot went to the community pool",
    { tx: sig },
  );
  // Bots claim automatically so the demo shows every payout.
  const parts = await db.participant.findMany({ where: { challengeId, isBot: true, status: "survived" } });
  for (const p of parts) {
    const kp = botKeypair(p.wallet);
    if (!kp) continue;
    try {
      const c = await chain.botClaim(kp, new PublicKey(challengeId));
      await db.participant.update({ where: { id: p.id }, data: { status: "claimed", claimTx: c } });
      await logEvent(challengeId, "claimed", `${displayName(p)} claimed ${(share / 1e9).toFixed(4)} SOL`, { participantId: p.id, tx: c });
    } catch (e) {
      console.warn("[bot claim]", friendlyChainError(String(e)));
    }
  }
  return sig;
}
