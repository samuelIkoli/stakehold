// Background loop started with the Next.js server (instrumentation.ts). Opens surprise
// windows, takes Duolingo snapshots, runs demo bots, eliminates and settles.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { db } from "../db";
import { tickChallenge } from "./game";

const g = globalThis as unknown as { _schedulerStarted?: boolean; _ticking?: boolean; _schedulerId?: string };
const ID = (g._schedulerId ??= crypto.randomBytes(6).toString("hex"));
// Next dev can load instrumentation in more than one context; a short file lease makes
// sure only one scheduler sends transactions at a time.
const LOCK = path.join(os.tmpdir(), `stakehold-scheduler-${Buffer.from(process.cwd() + (process.env.DATABASE_URL ?? "")).toString("hex").slice(-24)}.lock`);

function holdLease(): boolean {
  const now = Date.now();
  try {
    const [owner, ts] = fs.readFileSync(LOCK, "utf8").split(" ");
    if (owner !== ID && now - Number(ts) < 15_000) return false;
  } catch {}
  fs.writeFileSync(LOCK, `${ID} ${now}`);
  return true;
}

export async function tickAll() {
  if (g._ticking || !holdLease()) return;
  g._ticking = true;
  try {
    const now = Math.floor(Date.now() / 1000);
    const active = await db.challenge.findMany({ where: { status: "active" }, include: { participants: true } });
    for (const ch of active) {
      try {
        await tickChallenge(ch, now);
      } catch (e) {
        console.warn(`[scheduler] challenge ${ch.id.slice(0, 6)}:`, e instanceof Error ? e.message : e);
      }
    }
  } finally {
    g._ticking = false;
  }
}

export function startScheduler() {
  if (g._schedulerStarted) return;
  g._schedulerStarted = true;
  const every = Number(process.env.SCHEDULER_INTERVAL_MS || 4000);
  console.log(`[scheduler] started (every ${every} ms)`);
  setInterval(() => void tickAll(), every);
}
