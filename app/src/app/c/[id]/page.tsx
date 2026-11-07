"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useChallenge, passed, dayOf, type ChallengeData, type ParticipantRow, type WindowRow } from "@/lib/client/use-challenge";
import { AddressLink, Alert, Badge, Button, Card, Countdown, PROOF_EMOJI, PROOF_LABEL, Spinner, StrengthBadge, TxLink, cx, useNow } from "@/components/ui";
import { Flame } from "@/components/art";
import { PoseCard } from "@/components/pose-card";
import { DuolingoLink } from "@/components/duolingo-link";
import { useSession } from "@/components/providers";
import { claimTx, forfeitTx, friendlyError, joinTx, settleTx } from "@/lib/client/tx";
import { memberStart } from "@/lib/time";
import { canonicalJson, sha256Hex } from "@/lib/canonical";
import { describePose, hexToBytes, poseFromArray, poseFromHash, samePose, DIRECTIONS, EXTRA_SHORT } from "@/lib/pose";
import { DEMO_CHARITIES } from "@/lib/charities";
import { shortKey } from "@/lib/solana/constants";

export default function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, reload } = useChallenge(id);
  const created = useSearchParams().get("created");
  if (error && !data)
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold">Challenge not found</h1>
        <p className="mt-2 text-muted">{error}</p>
      </div>
    );
  if (!data)
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spinner className="h-6 w-6 text-flame" />
      </div>
    );
  return <ChallengeView data={data} reload={reload} created={!!created} />;
}

function useTiming(d: ChallengeData, me: ParticipantRow | undefined) {
  const now = useNow();
  const c = d.challenge;
  const startTs = me?.startTs ?? (d.participants[0]?.startTs ?? c.refStartTs);
  const endTs = startTs + c.numDays * c.dayLen;
  const lastEnd = Math.max(endTs, ...d.participants.map((p) => p.startTs + c.numDays * c.dayLen));
  const day = dayOf({ startTs }, c.dayLen, now);
  const phase = c.status === "settled" ? "settled" : now < startTs ? "lobby" : day <= c.numDays ? "live" : "ended";
  return { now, startTs, endTs, lastEnd, day: Math.min(day, c.numDays), rawDay: day, phase, dayEndsAt: startTs + day * c.dayLen };
}

function ChallengeView({ data: d, reload, created }: { data: ChallengeData; reload: () => Promise<void>; created: boolean }) {
  const c = d.challenge;
  const { publicKey } = useWallet();
  const meWallet = publicKey?.toBase58();
  const me = d.participants.find((p) => p.wallet === meWallet);
  const t = useTiming(d, me);
  const alive = d.participants.filter((p) => p.status !== "eliminated").length;
  const pot = c.stakeLamports * d.participants.length;
  const canJoin = t.phase === "lobby" && !me && d.participants.length < c.maxPlayers && !(c.mode === "solo");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      {created && (
        <Alert tone="alive" className="mb-5">
          🎉 Challenge created onchain. {c.mode === "group" ? "Share the invite link below with your crew." : "It's live on Explore."} <TxLink sig={c.createTx} />
        </Alert>
      )}

      {/* HEADER */}
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="flame">
              {PROOF_EMOJI[c.proofType]} {PROOF_LABEL[c.proofType]}
            </Badge>
            <StrengthBadge strength={c.strength} />
            <Badge>{c.mode === "group" ? "🔒 Private group" : c.mode === "public" ? "🌍 Public" : "🎯 Solo"}</Badge>
            {c.demo && <Badge tone="violet">DEMO · 1 day = {c.dayLen / 60} min</Badge>}
          </div>
          <h1 className="font-display mt-3 text-4xl font-extrabold leading-tight md:text-5xl">{c.title}</h1>
          <p className="mt-2 max-w-2xl text-muted">{c.description || c.habit}</p>
        </div>
        <PhaseBanner d={d} t={t} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* POT */}
          <Card className="grid grid-cols-2 gap-px overflow-hidden bg-line sm:grid-cols-4">
            {[
              ["Pot", `${(pot / 1e9).toFixed(3)} ◎`, "text-gold"],
              ["Stake", `${c.stakeLamports / 1e9} ◎`, ""],
              ["Alive", `${alive}/${d.participants.length}`, "text-alive"],
              [
                c.mode === "solo" ? "If you finish" : "Share if it ended now",
                alive ? `${(pot / Math.max(1, alive) / 1e9).toFixed(3)} ◎` : "—",
                "text-flame",
              ],
            ].map(([k, v, tone]) => (
              <div key={k} className="bg-surface p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{k}</div>
                <div className={cx("font-display mt-1 text-2xl font-extrabold tabular-nums", tone)}>{v}</div>
              </div>
            ))}
          </Card>

          <Leaderboard d={d} t={t} meWallet={meWallet} />
          <Activity d={d} />
        </div>

        <div className="space-y-6">
          <MyPanel d={d} me={me} t={t} canJoin={canJoin} reload={reload} />
          {c.mode === "group" && t.phase === "lobby" && <InviteCard id={c.id} />}
          <RulesCard d={d} />
          <VerifyPanel d={d} me={me} />
        </div>
      </div>
    </div>
  );
}

function PhaseBanner({ d, t }: { d: ChallengeData; t: ReturnType<typeof useTiming> }) {
  const c = d.challenge;
  if (t.phase === "settled") return <div className="rounded-2xl bg-ink px-5 py-3 text-bg">🏆 Settled · {d.settlement?.survivors ?? 0} survivor(s)</div>;
  if (t.phase === "lobby")
    return (
      <div className="rounded-2xl border border-alive/30 bg-alive/10 px-5 py-3">
        <div className="text-xs font-bold uppercase tracking-wider text-alive">Lobby open</div>
        <div className="font-display text-2xl font-extrabold tabular-nums">
          <Countdown to={t.startTs} prefix="Starts in " />
        </div>
      </div>
    );
  if (t.phase === "live")
    return (
      <div className="rounded-2xl border border-flame/30 bg-flame/10 px-5 py-3">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-flame">
          <Flame size={14} /> Day {t.day} of {c.numDays}
        </div>
        <div className="font-display text-2xl font-extrabold tabular-nums">
          <Countdown to={t.dayEndsAt} prefix="Day ends in " />
        </div>
      </div>
    );
  return (
    <div className="rounded-2xl border border-gold/40 bg-gold/10 px-5 py-3">
      <div className="text-xs font-bold uppercase tracking-wider">Finished</div>
      <div className="font-display text-xl font-extrabold">
        <Countdown to={t.lastEnd + c.graceSecs} prefix="Settles in " done="Settling…" />
      </div>
    </div>
  );
}

// ------------------------------------------------------------ my panel

function MyPanel({ d, me, t, canJoin, reload }: { d: ChallengeData; me?: ParticipantRow; t: ReturnType<typeof useTiming>; canJoin: boolean; reload: () => Promise<void> }) {
  const c = d.challenge;
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const { signIn } = useSession();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [okTx, setOkTx] = useState<string | null>(null);
  const [duoOk, setDuoOk] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);

  async function act(name: string, f: () => Promise<void>) {
    setBusy(name);
    setErr(null);
    try {
      await f();
      await reload();
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  const join = () =>
    act("join", async () => {
      if (!wallet) return setVisible(true);
      await signIn();
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const offset = c.demo ? 0 : memberStart(c.refStartTs, tz).offsetMin;
      const sig = await joinTx(connection, wallet, c.id, offset);
      const r = await fetch(`/api/challenges/${c.id}/join`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tz, tx: sig }) });
      if (!r.ok) throw new Error((await r.json()).error);
      setOkTx(sig);
    });

  const claim = () =>
    act("claim", async () => {
      if (!wallet) return setVisible(true);
      await signIn().catch(() => null);
      const sig = await claimTx(connection, wallet, c.id);
      setOkTx(sig);
      await fetch(`/api/challenges/${c.id}/sync`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "claim", tx: sig }) });
    });

  const quit = () =>
    act("quit", async () => {
      if (!wallet) return;
      const sig = await forfeitTx(connection, wallet, c.id);
      setOkTx(sig);
      setConfirmQuit(false);
      await fetch(`/api/challenges/${c.id}/sync`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "forfeit", tx: sig }) });
    });

  const settle = () =>
    act("settle", async () => {
      if (wallet) {
        const sig = await settleTx(connection, wallet, c.id, d.participants.map((p) => p.id), c.failDest === "charity" ? c.charity : null);
        setOkTx(sig);
        await fetch(`/api/challenges/${c.id}/sync`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "settle", tx: sig }) });
      } else {
        const r = await fetch(`/api/challenges/${c.id}/settle`, { method: "POST" });
        if (!r.ok) throw new Error((await r.json()).error);
      }
    });

  const myWindow = me ? d.windows.find((w) => w.participantId === me.id && w.day === t.rawDay && (w.expiresAt ?? 0) > t.now) : undefined;
  const todayPassed = me ? passed(me, t.rawDay) : false;
  const settleReady = t.phase === "ended" && t.now >= t.lastEnd + c.graceSecs;

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted">You</div>
      </div>
      <div className="space-y-4 p-5">
        {!me && canJoin && (
          <>
            <p className="text-sm text-muted">
              Stake <b className="text-ink">{c.stakeLamports / 1e9} SOL</b> to enter. Your day 1 starts at{" "}
              {c.demo ? "the next demo midnight" : "midnight in your own time zone"}. Miss a day and you&apos;re out.
            </p>
            {c.proofType === "duolingo" && (
              <div className="rounded-2xl border border-line p-4">
                <div className="mb-2 text-sm font-semibold">Link your Duolingo account (required)</div>
                <DuolingoLink onVerified={() => setDuoOk(true)} />
              </div>
            )}
            <Button size="lg" className="w-full" onClick={join} loading={busy === "join"} disabled={c.proofType === "duolingo" && !duoOk && !!wallet}>
              {wallet ? `Join & stake ${c.stakeLamports / 1e9} SOL` : "Connect wallet to join"}
            </Button>
          </>
        )}
        {!me && !canJoin && (
          <p className="text-sm text-muted">
            {c.mode === "solo"
              ? "This is someone's solo commitment. Cheer them on!"
              : t.phase === "lobby"
                ? "This challenge is full."
                : "Joining is closed — the challenge has started. Watch the leaderboard!"}
          </p>
        )}

        {me && me.status === "active" && t.phase === "lobby" && (
          <div className="text-center">
            <div className="text-4xl">🔥</div>
            <div className="font-display mt-2 text-xl font-bold">You&apos;re in!</div>
            <p className="mt-1 text-sm text-muted">
              Day 1 starts in <Countdown to={me.startTs} />.
              {c.proofType === "photo" && " A surprise proof window will pop up each day — keep this page or your phone handy."}
            </p>
          </div>
        )}

        {me && me.status === "active" && t.phase === "live" && (
          <>
            {todayPassed ? (
              <div className="rounded-2xl border border-alive/30 bg-alive/10 p-4 text-center">
                <div className="text-3xl">✅</div>
                <div className="font-display mt-1 text-lg font-bold text-alive">Safe for day {t.rawDay}</div>
                <p className="text-sm text-muted">
                  Next day starts in <Countdown to={t.dayEndsAt} />
                </p>
              </div>
            ) : c.proofType === "photo" ? (
              myWindow ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="pulse-ring inline-flex items-center gap-1.5 rounded-full bg-flame px-3 py-1 text-xs font-bold text-white">● WINDOW OPEN</span>
                    <span className="text-sm font-semibold tabular-nums text-flame">
                      <Countdown to={myWindow.expiresAt!} /> left
                    </span>
                  </div>
                  {myWindow.pose && <PoseCard pose={poseFromArray(myWindow.pose)} compact />}
                  <Button size="lg" className="w-full" href={`/c/${c.id}/prove`}>
                    📸 Prove it now
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl border border-line bg-surface-2 p-4 text-center">
                  <div className="text-3xl">⏳</div>
                  <div className="font-display mt-1 text-lg font-bold">Waiting for today&apos;s surprise window</div>
                  <p className="text-sm text-muted">
                    It opens at a random time {c.demo ? "early in the demo day" : `between ${String(c.plan.windowStartHour).padStart(2, "0")}:00 and ${String(c.plan.windowEndHour).padStart(2, "0")}:00`} and lasts{" "}
                    {Math.round(c.windowSecs / 60) || 1} min. Stay close.
                  </p>
                </div>
              )
            ) : (
              <Button size="lg" className="w-full" href={`/c/${c.id}/prove`}>
                {c.proofType === "gym" ? "🏋️ Check in / out" : c.proofType === "duolingo" ? "🦉 I'm done for today" : "🤝 Check in for today"}
              </Button>
            )}
            {!todayPassed && (
              <p className="text-center text-xs text-muted">
                Day {t.rawDay} ends in <Countdown to={t.dayEndsAt} />
              </p>
            )}
          </>
        )}

        {me && me.status === "eliminated" && (
          <div className="rounded-2xl border border-out/30 bg-out/10 p-4 text-center">
            <Flame dim size={36} className="mx-auto" />
            <div className="font-display mt-1 text-lg font-bold text-out">
              {me.eliminatedReason === "Quit" ? "You quit" : `Eliminated on day ${me.eliminatedDay}`}
            </div>
            <p className="mt-1 text-sm text-muted">{me.eliminatedReason}</p>
            <p className="mt-2 text-xs text-muted">Your stake stays in the pot for the survivors. Run it back next time.</p>
          </div>
        )}

        {me && me.status === "survived" && (
          <div className="space-y-3 text-center">
            <div className="text-5xl">🏆</div>
            <div className="font-display text-xl font-extrabold">You survived!</div>
            {d.settlement && (
              <div className="text-sm text-muted">
                Your share: <b className="text-gold">{((d.settlement.share + d.settlement.bonus) / 1e9).toFixed(4)} SOL</b>
                {d.settlement.bonus > 0 && <> (incl. {(d.settlement.bonus / 1e9).toFixed(4)} SOL pool bonus)</>}
              </div>
            )}
            <Button size="lg" variant="success" className="w-full" onClick={claim} loading={busy === "claim"}>
              💰 Claim my share
            </Button>
          </div>
        )}
        {me && me.status === "claimed" && (
          <div className="rounded-2xl border border-gold/40 bg-gold/10 p-4 text-center">
            <div className="text-3xl">💰</div>
            <div className="font-display mt-1 text-lg font-bold">Claimed</div>
            <TxLink sig={me.claimTx} />
          </div>
        )}

        {me && me.status === "active" && t.phase === "ended" && <p className="text-sm text-muted">The challenge is over — settlement runs automatically. Then you can claim.</p>}

        {settleReady && c.status === "active" && (
          <Button variant="secondary" className="w-full" onClick={settle} loading={busy === "settle"}>
            ⚖️ Settle now (anyone can)
          </Button>
        )}

        {err && <Alert tone="out">{err}</Alert>}
        {okTx && (
          <Alert tone="alive">
            Done ✓ <TxLink sig={okTx} />
          </Alert>
        )}

        {me && me.status === "active" && t.phase !== "ended" && (
          <div className="border-t border-line pt-3 text-center">
            {confirmQuit ? (
              <div className="space-y-2">
                <p className="text-xs text-muted">Quitting is final — your stake stays in the pot.</p>
                <div className="flex justify-center gap-2">
                  <Button size="sm" variant="danger" onClick={quit} loading={busy === "quit"}>
                    Yes, I quit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmQuit(false)}>
                    Keep going
                  </Button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmQuit(true)} className="text-xs font-semibold text-muted hover:text-out">
                🏳️ Quit challenge
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function InviteCard({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/c/${id}` : `/c/${id}`;
  return (
    <Card className="p-5">
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Invite link</div>
      <div className="mt-2 flex gap-2">
        <input readOnly value={url} className="w-full truncate rounded-xl border border-line bg-surface-2 px-3 py-2 font-mono text-xs" />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted">Private challenges don&apos;t appear on Explore. Everyone must join before their own start.</p>
    </Card>
  );
}

// ------------------------------------------------------------ leaderboard

function Leaderboard({ d, t, meWallet }: { d: ChallengeData; t: ReturnType<typeof useTiming>; meWallet?: string }) {
  const c = d.challenge;
  const order = { claimed: 0, survived: 0, active: 1, eliminated: 2 } as const;
  const rows = [...d.participants].sort((a, b) => order[a.status] - order[b.status] || b.daysPassed - a.daysPassed || (b.eliminatedDay ?? 0) - (a.eliminatedDay ?? 0));
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="font-display text-lg font-bold">Leaderboard</h2>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-alive" /> live
        </span>
      </div>
      {rows.length === 0 && <div className="p-8 text-center text-sm text-muted">No players yet. Be the first to stake.</div>}
      <ul className="divide-y divide-line">
        {rows.map((p, i) => {
          const out = p.status === "eliminated";
          const last = p.proofs.filter((x) => x.kind !== "baseline").at(-1);
          const myDay = Math.min(dayOf(p, c.dayLen, t.now), c.numDays + 1);
          return (
            <li key={p.id} className={cx("rise flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center", out && "opacity-60", p.wallet === meWallet && "bg-flame/[0.04]")}>
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold", out ? "bg-out/10 text-out" : "bg-alive/10 text-alive")}>
                  {out ? <Flame dim size={20} /> : p.status === "active" ? <Flame size={20} /> : "🏆"}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cx("truncate font-semibold", out && "line-through decoration-out/60")}>{p.name || shortKey(p.wallet)}</span>
                    {p.wallet === meWallet && <Badge tone="flame">you</Badge>}
                    {p.isBot && <Badge tone="violet">scripted bot</Badge>}
                    <span className="text-xs text-muted">#{i + 1}</span>
                  </div>
                  <div className="truncate text-xs text-muted">
                    {out ? (
                      <span className="text-out">
                        {p.eliminatedReason === "Quit" ? `Quit on day ${p.eliminatedDay}` : `Out on day ${p.eliminatedDay}`} · {p.eliminatedReason ?? "No passing proof"}
                      </span>
                    ) : p.status === "survived" ? (
                      "Survived — ready to claim"
                    ) : p.status === "claimed" ? (
                      <>
                        Claimed <TxLink sig={p.claimTx} label="tx" />
                      </>
                    ) : last ? (
                      <>
                        Day {last.day}: {last.verdict === "pass" ? "✅" : "❌"} {last.reason.slice(0, 80)}
                      </>
                    ) : (
                      `Joined · ${p.tz}`
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:justify-end">
                {Array.from({ length: c.numDays }, (_, k) => {
                  const day = k + 1;
                  const ok = passed(p, day);
                  const failed = out && p.eliminatedDay === day;
                  const today = p.status === "active" && day === myDay;
                  const fails = p.proofs.filter((x) => x.day === day && x.verdict === "fail").length;
                  return (
                    <span
                      key={day}
                      title={`Day ${day}${ok ? ": passed" : failed ? ": eliminated" : fails ? `: ${fails} rejected` : ""}`}
                      className={cx(
                        "grid h-6 w-6 place-items-center rounded-md text-[10px] font-bold",
                        ok ? "bg-alive text-white dark:text-[#06210f]" : failed ? "bg-out text-white" : today ? "pulse-ring bg-flame/20 text-flame" : "bg-surface-2 text-muted",
                        c.numDays > 14 && "h-4 w-4 rounded",
                      )}
                    >
                      {c.numDays <= 14 ? (ok ? "✓" : failed ? "✕" : day) : ""}
                    </span>
                  );
                })}
                {last?.tx && <TxLink sig={last.tx} label="" className="ml-2" />}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ------------------------------------------------------------ activity

function Activity({ d }: { d: ChallengeData }) {
  const icon: Record<string, string> = {
    created: "✨",
    joined: "🪙",
    window: "🎲",
    pass: "✅",
    fail: "❌",
    eliminated: "🔥",
    quit: "🏳️",
    settled: "🏆",
    claimed: "💰",
    baseline: "📏",
    checkin: "📍",
  };
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <h2 className="font-display text-lg font-bold">Activity · onchain receipts</h2>
      </div>
      <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
        {d.events.map((e) => (
          <li key={e.id} className="flex items-start gap-3 px-5 py-3 text-sm">
            <span className="mt-0.5">{icon[e.type] ?? "•"}</span>
            <div className="min-w-0 flex-1">
              <div className="break-words">{e.message}</div>
              <div className="mt-0.5 flex gap-3 text-xs text-muted">
                <span>{new Date(e.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                <TxLink sig={e.tx} label="Explorer" />
              </div>
            </div>
          </li>
        ))}
        {d.events.length === 0 && <li className="px-5 py-6 text-center text-sm text-muted">Nothing yet.</li>}
      </ul>
    </Card>
  );
}

// ------------------------------------------------------------ rules + verify

function RulesCard({ d }: { d: ChallengeData }) {
  const c = d.challenge;
  const [hashOk, setHashOk] = useState<boolean | null>(null);
  useEffect(() => {
    sha256Hex(canonicalJson(c.plan)).then((h) => setHashOk(h === c.planHash));
  }, [c.plan, c.planHash]);
  const charity = DEMO_CHARITIES.find((x) => x.address === c.charity);
  return (
    <Card className="p-5">
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Rules</div>
      <p className="mt-2 text-[15px] font-medium">{c.plan.rule}</p>
      <ul className="mt-3 space-y-1.5 text-sm text-muted">
        <li>
          📅 {c.numDays} day{c.numDays > 1 ? "s" : ""} · day = {c.demo ? `${c.dayLen / 60} min (demo)` : "24 h, from your local midnight"}
        </li>
        {c.proofType === "photo" && (
          <li>
            🎲 Surprise {Math.round(c.windowSecs / 60) || 1}-min window {c.demo ? "early each demo day" : `between ${c.plan.windowStartHour}:00–${c.plan.windowEndHour}:00`} · 1 retake
          </li>
        )}
        {c.proofType === "gym" && (
          <li>
            📍 {c.gymLabel || "Gym"} (within {c.gymRadiusM} m) · check-out ≥ {Math.round((c.minGapSecs ?? 2700) / 60)} min after check-in
          </li>
        )}
        {c.proofType === "duolingo" && <li>🦉 ≥ {c.minXp} XP since last snapshot AND streak +1 each day</li>}
        {c.proofType === "honor" && <li>🤝 Daily self-report (honor system)</li>}
        <li>⚖️ Code checks facts → AI judges proof → appeals (coming soon)</li>
        <li>
          💸 {c.mode === "solo" ? (c.failDest === "charity" ? `Fail → ${charity?.name ?? "charity"}` : "Fail → community pool") : "Survivors split the pot equally · nobody survives → community pool"}
        </li>
      </ul>
      <div className="mt-4 rounded-2xl bg-surface-2 p-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Rules hash (onchain config_hash)</span>
          {hashOk === true && <Badge tone="alive">✓ matches</Badge>}
          {hashOk === false && <Badge tone="out">mismatch</Badge>}
        </div>
        <div className="mt-1 break-all font-mono text-muted">{c.planHash}</div>
        <div className="mt-2 flex flex-wrap gap-3">
          <AddressLink address={c.id} label="Challenge account" />
          <AddressLink address={d.vault.address} label={`Vault · ${(d.vault.lamports / 1e9).toFixed(3)} ◎`} />
        </div>
      </div>
    </Card>
  );
}

function VerifyPanel({ d, me }: { d: ChallengeData; me?: ParticipantRow }) {
  const c = d.challenge;
  const windows = useMemo(() => {
    const ws = [...d.windows].sort((a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0));
    const mine = me ? ws.filter((w) => w.participantId === me.id) : [];
    return (mine.length ? mine : ws).slice(0, 3);
  }, [d.windows, me]);
  if (c.proofType === "duolingo" || c.proofType === "honor") return null;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Verify the pose</div>
        <Badge tone="violet">SlotHashes</Badge>
      </div>
      <p className="mt-2 text-sm text-muted">
        When a window opens, the program reads the newest entry of Solana&apos;s <span className="font-mono">SlotHashes</span> sysvar. The pose is derived from that hash — nobody, not even us, can know it in advance.
      </p>
      {windows.length === 0 && <p className="mt-3 text-sm text-muted">No windows opened yet.</p>}
      <div className="mt-3 space-y-3">
        {windows.map((w) => (
          <WindowProof key={w.id} w={w} d={d} />
        ))}
      </div>
    </Card>
  );
}

function WindowProof({ w, d }: { w: WindowRow; d: ChallengeData }) {
  if (!w.slotHash || !w.pose) return null;
  const h = hexToBytes(w.slotHash);
  const derived = poseFromHash(h);
  const onchain = poseFromArray(w.pose);
  const usedAlt = !samePose(derived, onchain);
  const who = d.participants.find((p) => p.id === w.participantId);
  return (
    <div className="rounded-2xl border border-line bg-surface-2/60 p-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold">
          {who?.name || shortKey(who?.wallet ?? "")} · day {w.day}
          {w.index === 1 ? " · check-out" : ""}
        </span>
        <span className="text-muted">slot {w.slot}</span>
      </div>
      <div className="mt-1 break-all font-mono text-muted">
        <span className="rounded bg-flame/20 px-0.5 text-flame">{w.slotHash.slice(0, 2)}</span>
        <span className="rounded bg-violet/20 px-0.5 text-violet">{w.slotHash.slice(2, 4)}</span>
        <span className="rounded bg-gold/25 px-0.5">{w.slotHash.slice(4, 6)}</span>
        {w.slotHash.slice(6)}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1 font-mono">
        <span>
          0x{w.slotHash.slice(0, 2)} % 5 + 1 = <b className="text-ink">{derived.fingers}</b>
        </span>
        <span>
          0x{w.slotHash.slice(2, 4)} % 4 = <b className="text-ink">{DIRECTIONS[derived.direction]}</b>
        </span>
        <span>
          0x{w.slotHash.slice(4, 6)} % 4 = <b className="text-ink">{EXTRA_SHORT[derived.extra]}</b>
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span>
          → <b>{describePose(onchain)}</b> {usedAlt ? <span className="text-muted">(check-out uses bytes 3–5 so it differs from check-in)</span> : <span className="text-alive">✓ matches onchain</span>}
        </span>
        <span className="flex gap-2">
          {w.pda && <AddressLink address={w.pda} label="window acct" />}
          <TxLink sig={w.tx} label="tx" />
        </span>
      </div>
    </div>
  );
}

