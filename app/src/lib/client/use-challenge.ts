"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ProofRow = {
  id: string;
  day: number;
  attempt: number;
  kind: string;
  verdict: string;
  reason: string;
  reasonCode: number;
  proofHash: string;
  checks: Record<string, unknown>;
  metricA: number | null;
  metricB: number | null;
  tx: string | null;
  checkinPda: string | null;
  onchain: boolean;
  windowIndex: number | null;
  createdAt: string;
};

export type ParticipantRow = {
  id: string;
  wallet: string;
  name: string | null;
  tz: string;
  utcOffsetMin: number;
  startTs: number;
  status: "active" | "eliminated" | "survived" | "claimed";
  eliminatedDay: number | null;
  eliminatedReason: string | null;
  daysPassed: number;
  passedBitmap: string;
  duolingoUsername: string | null;
  duolingoVerified?: boolean;
  isBot: boolean;
  joinTx: string;
  claimTx: string | null;
  proofs: ProofRow[];
};

export type WindowRow = {
  id: string;
  participantId: string;
  day: number;
  index: number;
  pda: string | null;
  slot: string | null;
  slotHash: string | null;
  pose: number[] | null;
  openedAt: number | null;
  expiresAt: number | null;
  tx: string | null;
};

export type ChallengeData = {
  challenge: {
    id: string;
    onchainId: string;
    creator: string;
    title: string;
    habit: string;
    description: string;
    proofType: "photo" | "gym" | "duolingo" | "honor";
    plan: Record<string, unknown> & { rule: string; windowStartHour: number; windowEndHour: number; windowMinutes: number };
    planHash: string;
    strength: string;
    mode: "group" | "public" | "solo";
    stakeLamports: number;
    demo: boolean;
    refStartTs: number;
    dayLen: number;
    numDays: number;
    graceSecs: number;
    windowSecs: number;
    maxPlayers: number;
    failDest: string;
    charity: string | null;
    gymLat: number | null;
    gymLng: number | null;
    gymRadiusM: number | null;
    gymLabel: string | null;
    minGapSecs: number | null;
    minXp: number | null;
    status: "active" | "settled";
    createTx: string;
    settleTx: string | null;
  };
  settlement: { survivors: number; share: number; bonus: number; pot: number; claimed: number } | null;
  vault: { address: string; lamports: number };
  participants: ParticipantRow[];
  windows: WindowRow[];
  events: { id: string; type: string; message: string; tx: string | null; createdAt: string; participantId: string | null }[];
  viewer: string | null;
  now: number;
};

export function useChallenge(id: string) {
  const [data, setData] = useState<ChallengeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const demoRef = useRef(false);
  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/challenges/${id}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      demoRef.current = j.challenge.demo;
      setData(j);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);
  useEffect(() => {
    load();
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(
        async () => {
          if (document.visibilityState === "visible") await load();
          loop();
        },
        demoRef.current ? 3000 : 10000,
      );
    };
    loop();
    return () => clearTimeout(t);
  }, [load]);
  return { data, error, reload: load };
}

export const passed = (p: ParticipantRow, day: number) => day >= 1 && (BigInt(p.passedBitmap) & (BigInt(1) << BigInt(day - 1))) !== BigInt(0);
export const dayOf = (p: { startTs: number }, dayLen: number, now: number) => (now < p.startTs ? 0 : Math.floor((now - p.startTs) / dayLen) + 1);
