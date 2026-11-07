"use client";

import { useEffect, useState } from "react";
import { CreateForm } from "@/components/create-form";
import { AddressLink, Card } from "@/components/ui";
import { DEMO_CHARITIES, SOLO_BONUS_BPS, SOLO_BONUS_CAP_SOL } from "@/lib/charities";
import { poolPda } from "@/lib/solana/pdas";

type Pool = { lamports: number; totalIn: number; totalOut: number; bonusesPaid: number } | null;

export default function SoloPage() {
  const [pool, setPool] = useState<Pool>(null);
  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((j) => setPool(j.pool))
      .catch(() => {});
  }, []);
  const bonus = pool ? Math.min((pool.lamports * SOLO_BONUS_BPS) / 10000, SOLO_BONUS_CAP_SOL * 1e9) / 1e9 : null;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <div className="grid gap-6 md:grid-cols-[1.3fr_1fr] md:items-end">
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-flame">Solo commitment</div>
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">Bet on yourself.</h1>
          <p className="mt-3 max-w-xl text-muted">
            No crew needed. Stake SOL on your own goal. Finish every day and get it all back <b className="text-ink">plus a bonus</b> from the community pool. Slip up and it goes to a
            charity you pick — or to the pool that rewards everyone who finishes.
          </p>
        </div>
        <Card className="relative overflow-hidden p-5">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet/20 blur-2xl" />
          <div className="relative">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted">🌊 Community pool</div>
            <div className="font-display mt-1 text-4xl font-extrabold tabular-nums">{pool ? (pool.lamports / 1e9).toFixed(3) : "…"} ◎</div>
            <div className="mt-1 text-sm text-muted">
              Finish today&apos;s solo goal → bonus ≈ <b className="text-ink">{bonus != null ? bonus.toFixed(4) : "…"} SOL</b> ({SOLO_BONUS_BPS / 100}% of pool, max {SOLO_BONUS_CAP_SOL})
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              {pool && <span>In: {(pool.totalIn / 1e9).toFixed(3)} ◎</span>}
              {pool && <span>Paid out: {(pool.totalOut / 1e9).toFixed(3)} ◎</span>}
              {pool && <span>Bonuses: {pool.bonusesPaid}</span>}
              <AddressLink address={poolPda().toBase58()} label="Pool account" />
            </div>
          </div>
        </Card>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {DEMO_CHARITIES.map((c) => (
          <div key={c.index} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-sm">
            <span className="text-2xl">{c.emoji}</span>
            <div className="min-w-0">
              <div className="font-semibold">{c.name}</div>
              <AddressLink address={c.address} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">The charities above are clearly labelled demo wallets on devnet — not real organisations.</p>
      <div className="mt-10">
        <CreateForm initialMode="solo" />
      </div>
    </div>
  );
}
