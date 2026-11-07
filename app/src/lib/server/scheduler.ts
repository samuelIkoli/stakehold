// Background loop started with the Next.js server (instrumentation.ts). Opens surprise
// windows, takes Duolingo snapshots, runs demo bots, eliminates and settles.
import { db } from "../db";
import { tickChallenge } from "./game";

const g = globalThis as unknown as { _schedulerStarted?: boolean; _ticking?: boolean };

export async function tickAll() {
  if (g._ticking) return;
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
