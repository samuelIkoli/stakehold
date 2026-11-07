"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Countdown, Field, TxLink, inputCls, useNow } from "@/components/ui";

type DemoChallenge = {
  id: string;
  title: string;
  proofType: string;
  refStartTs: number;
  dayLen: number;
  numDays: number;
  graceSecs: number;
  status: string;
  settleTx: string | null;
  participants: { id: string; name: string | null; wallet: string; status: string; isBot: boolean; daysPassed: number; startTs: number }[];
};

type Health = {
  programId: string;
  programDeployed: boolean;
  config: { judge: string } | null;
  judge: { address: string; lamports: number };
  crank: { address: string; lamports: number };
  pool: { lamports: number } | null;
  ai: { configured: boolean; model: string | null };
};

/** Hidden control panel for running the live demo story in ~5 minutes. */
export default function DemoPanel() {
  const [key, setKey] = useState("");
  const [list, setList] = useState<DemoChallenge[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<{ t: string; msg: string; tx?: string; tone?: "out" | "alive" }[]>([]);
  const [dayLen, setDayLen] = useState(120);
  const [days, setDays] = useState(2);
  const [lead, setLead] = useState(90);
  const now = useNow();

  const call = useCallback(
    async (body: Record<string, unknown>) => {
      const r = await fetch("/api/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: key || undefined, ...body }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      return j;
    },
    [key],
  );

  const refresh = useCallback(async () => {
    try {
      setList(await call({ action: "list" }));
    } catch {}
  }, [call]);

  useEffect(() => {
    try {
      setKey(localStorage.getItem("demo-key") ?? "");
    } catch {}
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => {});
  }, []);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  async function run(name: string, body: Record<string, unknown>, describe: (j: Record<string, unknown>) => string) {
    setBusy(name);
    try {
      const j = await call(body);
      setLog((l) => [{ t: new Date().toLocaleTimeString(), msg: describe(j), tx: (j.tx as string) ?? undefined, tone: "alive" as const }, ...l].slice(0, 30));
      await refresh();
    } catch (e) {
      setLog((l) => [{ t: new Date().toLocaleTimeString(), msg: e instanceof Error ? e.message : String(e), tone: "out" as const }, ...l].slice(0, 30));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Badge tone="violet">hidden route</Badge>
          <h1 className="font-display mt-2 text-3xl font-extrabold">Demo control panel</h1>
          <p className="text-sm text-muted">Run the whole Stakehold story live in ~5 minutes on devnet.</p>
        </div>
        <input
          className={inputCls + " max-w-[200px]"}
          placeholder="Demo key (if set)"
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            try {
              localStorage.setItem("demo-key", e.target.value);
            } catch {}
          }}
        />
      </div>

      {health && (
        <div className="mt-5 grid gap-2 text-xs sm:grid-cols-4">
          <HealthChip ok={health.programDeployed === true} label="Program deployed" />
          <HealthChip ok={!!health.config} label="Config initialised" />
          <HealthChip ok={health.ai.configured} label={`AI: ${health.ai.model ?? "no key"}`} />
          <HealthChip ok={health.judge.lamports > 0.05e9} label={`Judge ${(health.judge.lamports / 1e9).toFixed(2)} ◎ · crank ${(health.crank.lamports / 1e9).toFixed(2)} ◎`} />
        </div>
      )}

      <Card className="mt-6 p-5">
        <h2 className="font-display text-lg font-bold">1 · Seed a demo challenge</h2>
        <p className="mt-1 text-sm text-muted">
          Creates a public demo challenge with 4 scripted bots: Ada & Kofi pass every day, Mei gets the pose wrong on day 2, Tunde quits on day 1. Join it with Phantom before it
          starts.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Field label="Day length">
            <select className={inputCls} value={dayLen} onChange={(e) => setDayLen(Number(e.target.value))}>
              {[60, 90, 120, 180].map((s) => (
                <option key={s} value={s}>
                  {s}s
                </option>
              ))}
            </select>
          </Field>
          <Field label="Days">
            <select className={inputCls} value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {[1, 2, 3].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Lobby time (to join)">
            <select className={inputCls} value={lead} onChange={(e) => setLead(Number(e.target.value))}>
              {[45, 90, 180, 300].map((s) => (
                <option key={s} value={s}>
                  ~{s}s
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            loading={busy === "seed"}
            onClick={() => run("seed", { action: "seed", kind: "photo", dayLen, days, leadSecs: lead }, (j) => `Seeded photo challenge ${String(j.challenge).slice(0, 6)}… with bots`)}
          >
            🌱 Seed photo challenge + bots
          </Button>
          <Button
            variant="secondary"
            loading={busy === "seed-duo"}
            onClick={() => run("seed-duo", { action: "seed", kind: "duolingo", dayLen: Math.max(dayLen, 180), days: 1, leadSecs: lead }, (j) => `Seeded Duolingo demo ${String(j.challenge).slice(0, 6)}…`)}
          >
            🦉 Seed 1-day Duolingo demo
          </Button>
          <Button variant="ghost" loading={busy === "donate"} onClick={() => run("donate", { action: "donate", sol: 0.1 }, () => "Donated 0.1 SOL to the community pool")}>
            🌊 Donate 0.1 ◎ to pool
          </Button>
        </div>
      </Card>

      <div className="mt-6 space-y-4">
        {list.map((c) => {
          const start = c.participants[0]?.startTs ?? c.refStartTs;
          const day = now < start ? 0 : Math.floor((now - start) / c.dayLen) + 1;
          const end = start + c.numDays * c.dayLen;
          return (
            <Card key={c.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/c/${c.id}`} className="font-display text-lg font-bold hover:text-flame" target="_blank">
                    {c.title} ↗
                  </Link>
                  <div className="text-xs text-muted">
                    {c.id.slice(0, 8)}… · {c.numDays} × {c.dayLen}s ·{" "}
                    {c.status === "settled" ? (
                      "settled"
                    ) : now < start ? (
                      <>
                        lobby — starts in <Countdown to={start} />
                      </>
                    ) : day <= c.numDays ? (
                      <>
                        day {day} — ends in <Countdown to={start + day * c.dayLen} />
                      </>
                    ) : (
                      <>
                        ended — settles after <Countdown to={end + c.graceSecs} done="grace (any moment)" />
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" loading={busy === `open-${c.id}`} disabled={c.status === "settled"} onClick={() => run(`open-${c.id}`, { action: "open", challengeId: c.id }, (j) => (j.results as string[]).join(" · ") || "No active players in a running day")}>
                    🎲 Open windows now
                  </Button>
                  <Button size="sm" variant="secondary" loading={busy === `proc-${c.id}`} disabled={c.status === "settled"} onClick={() => run(`proc-${c.id}`, { action: "process", challengeId: c.id }, () => "Processed: bots, eliminations, settlement checks")}>
                    ⏭ Process day end
                  </Button>
                  <Button size="sm" variant="success" loading={busy === `settle-${c.id}`} disabled={c.status === "settled"} onClick={() => run(`settle-${c.id}`, { action: "settle", challengeId: c.id }, (j) => (j.tx ? "Settled ✓" : "Nothing to settle yet"))}>
                    🏆 Settle
                  </Button>
                  {c.settleTx && <TxLink sig={c.settleTx} label="settle tx" />}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {c.participants.map((p) => (
                  <span key={p.id} className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs">
                    {p.status === "eliminated" ? "💀" : p.status === "active" ? "🔥" : "🏆"} {p.name ?? p.wallet.slice(0, 4)} · {p.daysPassed}d
                  </span>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {log.length > 0 && (
        <Card className="mt-6 p-5">
          <h2 className="font-display text-lg font-bold">Log</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {log.map((l, i) => (
              <li key={i} className={l.tone === "out" ? "text-out" : ""}>
                <span className="text-muted">{l.t}</span> {l.msg} {l.tx && <TxLink sig={l.tx} label="tx" />}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Alert className="mt-6">
        <b>Script:</b> seed → join with Phantom → day 1 window opens (auto, or 🎲) → take a fresh photo with the pose ✅ → day 2: try a pre-taken/wrong pose ❌ → retake ✅ → Mei
        eliminated on the leaderboard → challenge ends → 🏆 settle → claim with Explorer links.
      </Alert>
    </div>
  );
}

function HealthChip({ ok, label }: { ok: boolean; label: string }) {
  return <div className={`rounded-xl border px-3 py-2 font-semibold ${ok ? "border-alive/30 bg-alive/10 text-alive" : "border-out/30 bg-out/10 text-out"}`}>{ok ? "✓" : "✕"} {label}</div>;
}
