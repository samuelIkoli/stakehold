"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useChallenge, passed, dayOf, type ChallengeData, type ParticipantRow } from "@/lib/client/use-challenge";
import { Alert, Badge, Button, Card, Countdown, Spinner, TxLink, cx, inputCls, useNow } from "@/components/ui";
import { PoseCard } from "@/components/pose-card";
import { Camera, getPosition } from "@/components/camera";
import { useSession } from "@/components/providers";
import { poseFromArray } from "@/lib/pose";

type Verdict = {
  verdict: "pass" | "fail";
  reason: string;
  reasonLabel?: string;
  checks?: Record<string, unknown>;
  tx?: string | null;
  proofHash?: string;
  retakesLeft?: number;
};

export default function ProvePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, reload } = useChallenge(id);
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  if (!data)
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spinner className="h-6 w-6 text-flame" />
      </div>
    );
  const me = data.participants.find((p) => p.wallet === publicKey?.toBase58());
  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <Link href={`/c/${id}`} className="text-sm font-semibold text-muted hover:text-ink">
        ← {data.challenge.title}
      </Link>
      <h1 className="font-display mt-2 text-3xl font-extrabold">Submit today&apos;s proof</h1>
      {!publicKey ? (
        <Card className="mt-6 p-6 text-center">
          <p className="text-muted">Connect the wallet you joined with.</p>
          <Button className="mt-4" onClick={() => setVisible(true)}>
            Connect wallet
          </Button>
        </Card>
      ) : !me ? (
        <Alert className="mt-6">This wallet isn&apos;t in the challenge.</Alert>
      ) : me.status !== "active" ? (
        <Alert className="mt-6" tone={me.status === "eliminated" ? "out" : "alive"}>
          {me.status === "eliminated" ? `You're out (day ${me.eliminatedDay}).` : "You've finished — head back to claim."}
        </Alert>
      ) : (
        <SignedIn>
          <ProofFlow d={data} me={me} reload={reload} />
        </SignedIn>
      )}
    </div>
  );
}

function SignedIn({ children }: { children: React.ReactNode }) {
  const { wallet, signIn, signingIn } = useSession();
  const [err, setErr] = useState<string | null>(null);
  if (wallet) return <>{children}</>;
  return (
    <Card className="mt-6 p-6 text-center">
      <div className="text-3xl">✍️</div>
      <p className="mt-2 text-muted">Sign a free message once so the referee knows it&apos;s you. No transaction, no fee.</p>
      <Button className="mt-4" loading={signingIn} onClick={() => signIn().catch((e) => setErr(e.message))}>
        Sign in with wallet
      </Button>
      {err && <Alert tone="out" className="mt-3">{err}</Alert>}
    </Card>
  );
}

function ProofFlow({ d, me, reload }: { d: ChallengeData; me: ParticipantRow; reload: () => Promise<void> }) {
  const c = d.challenge;
  const now = useNow();
  const day = dayOf(me, c.dayLen, now);
  if (day < 1) return <Alert className="mt-6">Day 1 starts in <Countdown to={me.startTs} />.</Alert>;
  if (day > c.numDays) return <Alert className="mt-6">The challenge has ended. Settlement is on its way.</Alert>;
  if (passed(me, day))
    return (
      <Card className="mt-6 p-8 text-center">
        <div className="text-5xl">✅</div>
        <div className="font-display mt-2 text-2xl font-bold text-alive">You&apos;re safe for day {day}</div>
        <p className="mt-1 text-muted">
          Next day starts in <Countdown to={me.startTs + day * c.dayLen} />
        </p>
        <Button className="mt-5" variant="secondary" href={`/c/${c.id}`}>
          Back to leaderboard
        </Button>
      </Card>
    );
  if (c.proofType === "photo") return <PhotoProof d={d} me={me} day={day} reload={reload} />;
  if (c.proofType === "gym") return <GymProof d={d} me={me} day={day} reload={reload} />;
  if (c.proofType === "duolingo") return <DuolingoProof d={d} reload={reload} />;
  return <HonorProof d={d} reload={reload} />;
}

// ------------------------------------------------------------------ photo

function PhotoProof({ d, me, day, reload }: { d: ChallengeData; me: ParticipantRow; day: number; reload: () => Promise<void> }) {
  const now = useNow();
  const w = d.windows.find((x) => x.participantId === me.id && x.day === day && x.index === 0);
  const used = me.proofs.filter((p) => p.day === day && p.kind === "photo").length;
  if (!w || !w.pose || (w.expiresAt ?? 0) < now - 30)
    return (
      <Card className="mt-6 p-6 text-center">
        <div className="text-4xl">⏳</div>
        <div className="font-display mt-2 text-xl font-bold">{w && (w.expiresAt ?? 0) < now ? "Today's window has closed" : "No window open yet"}</div>
        <p className="mt-1 text-sm text-muted">
          {w && (w.expiresAt ?? 0) < now
            ? "If you didn't pass, you'll be eliminated when the day ends."
            : "Today's surprise window hasn't opened. This page updates automatically — keep it open."}
        </p>
      </Card>
    );
  return (
    <CaptureAndJudge
      title="Strike the pose and snap a live photo"
      pose={poseFromArray(w.pose)}
      expiresAt={w.expiresAt!}
      kind="photo"
      challengeId={d.challenge.id}
      attemptsLeft={2 - used}
      onDone={reload}
      rule={d.challenge.plan.rule}
    />
  );
}

function CaptureAndJudge({
  title,
  pose,
  expiresAt,
  kind,
  challengeId,
  attemptsLeft,
  onDone,
  rule,
  needGps,
}: {
  title: string;
  pose: ReturnType<typeof poseFromArray>;
  expiresAt: number;
  kind: "photo" | "gym_in" | "gym_out";
  challengeId: string;
  attemptsLeft: number;
  onDone: () => Promise<void>;
  rule: string;
  needGps?: boolean;
}) {
  const [shot, setShot] = useState<{ blob: Blob; preview: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Verdict | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [stage, setStage] = useState("");
  const now = useNow();
  const expired = now > expiresAt + 20;

  async function submit() {
    if (!shot) return;
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("challengeId", challengeId);
      fd.append("kind", kind);
      fd.append("image", shot.blob, "proof.jpg");
      if (needGps) {
        setStage("Getting your location…");
        const pos = await getPosition();
        if (pos) {
          fd.append("lat", String(pos.coords.latitude));
          fd.append("lng", String(pos.coords.longitude));
          fd.append("accuracy", String(pos.coords.accuracy));
        }
      }
      setStage("The AI referee is looking…");
      const r = await fetch("/api/proof/photo", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setResult(j);
      await onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setStage("");
    }
  }

  if (result)
    return (
      <div className="mt-6 space-y-4">
        <VerdictCard v={result} />
        {result.verdict === "fail" && (result.retakesLeft ?? 0) > 0 && !expired && (
          <Button
            size="lg"
            className="w-full"
            onClick={() => {
              setResult(null);
              setShot(null);
            }}
          >
            🔁 Use my one retake
          </Button>
        )}
      </div>
    );

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <Badge tone="flame">⏱ <Countdown to={expiresAt} done="closing…" /> left</Badge>
        <span className="text-xs text-muted">{attemptsLeft > 1 ? "1 photo + 1 retake" : attemptsLeft === 1 ? "Last attempt" : "No attempts left"}</span>
      </div>
      <PoseCard pose={pose} />
      <p className="text-sm text-muted">
        <b className="text-ink">{title}.</b> The photo must also show: {rule}
      </p>
      {attemptsLeft <= 0 ? (
        <Alert tone="out">You&apos;ve used your photo and retake for this window.</Alert>
      ) : shot ? (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shot.preview} alt="Your proof" className="w-full rounded-3xl" />
          <div className="flex gap-2">
            <Button size="lg" className="flex-1" onClick={submit} loading={busy} disabled={expired}>
              Submit to referee
            </Button>
            <Button size="lg" variant="secondary" onClick={() => setShot(null)} disabled={busy}>
              Redo
            </Button>
          </div>
          {stage && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted">
              <Spinner /> {stage}
            </div>
          )}
        </div>
      ) : (
        <Camera onCapture={(blob, preview) => setShot({ blob, preview })} disabled={expired} />
      )}
      {err && <Alert tone="out">{err}</Alert>}
      <p className="text-center text-[11px] text-muted">Only the SHA-256 hash of your photo goes onchain. Text in the photo is treated as data, never as instructions to the referee.</p>
    </div>
  );
}

function VerdictCard({ v }: { v: Verdict }) {
  const pass = v.verdict === "pass";
  const checks = v.checks ?? {};
  const rows: [string, unknown][] = [
    ["Pose correct", checks.pose_correct],
    ["Live photo", checks.live_photo],
    ["Rule followed", checks.rule_followed],
    ["At the gym (GPS)", checks.at_gym],
    ["No manipulation", checks.injection_detected === undefined ? undefined : !checks.injection_detected],
  ];
  return (
    <Card className={cx("rise overflow-hidden", pass ? "border-alive/40" : "border-out/40")}>
      <div className={cx("p-6 text-center", pass ? "bg-alive/10" : "bg-out/10")}>
        <div className="text-5xl">{pass ? "✅" : "❌"}</div>
        <div className={cx("font-display mt-2 text-2xl font-extrabold", pass ? "text-alive" : "text-out")}>{pass ? "Proof accepted" : "Proof rejected"}</div>
        <p className="mx-auto mt-2 max-w-sm text-[15px]">{v.reason}</p>
      </div>
      <div className="space-y-2 p-5 text-sm">
        {rows
          .filter(([, val]) => val !== undefined)
          .map(([k, val]) => (
            <div key={k} className="flex justify-between">
              <span className="text-muted">{k}</span>
              <span className={val ? "text-alive" : "text-out"}>{val ? "✓" : "✕"}</span>
            </div>
          ))}
        {typeof checks.pose_observed === "string" && (
          <div className="flex justify-between gap-4">
            <span className="text-muted">Referee saw</span>
            <span className="text-right">{checks.pose_observed}</span>
          </div>
        )}
        {typeof checks.distance_m === "number" && (
          <div className="flex justify-between">
            <span className="text-muted">Distance to gym</span>
            <span>{checks.distance_m} m</span>
          </div>
        )}
        <div className="border-t border-line pt-3 text-xs text-muted">
          {v.tx ? (
            <>
              Verdict recorded onchain · <TxLink sig={v.tx} />
            </>
          ) : (
            "Check-in saved — your onchain verdict is recorded at check-out."
          )}
          {v.proofHash && <div className="mt-1 break-all font-mono">proof hash {v.proofHash}</div>}
        </div>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ gym

function GymProof({ d, me, day, reload }: { d: ChallengeData; me: ParticipantRow; day: number; reload: () => Promise<void> }) {
  const c = d.challenge;
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inPass = me.proofs.find((p) => p.day === day && p.kind === "gym_in" && p.verdict === "pass");
  const index = inPass ? 1 : 0;
  const w = d.windows.find((x) => x.participantId === me.id && x.day === day && x.index === index);
  const kind = index === 0 ? "gym_in" : "gym_out";
  const used = me.proofs.filter((p) => p.day === day && p.kind === kind).length;
  const readyAt = inPass ? Math.floor(new Date(inPass.createdAt).getTime() / 1000) + (c.minGapSecs ?? 2700) : 0;

  async function open() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/window", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ challengeId: c.id, index }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const live = w && w.pose && (w.expiresAt ?? 0) > now - 20;
  return (
    <div className="mt-6 space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Step active={!inPass} done={!!inPass} n={1} label="Check in" />
        <Step active={!!inPass} done={false} n={2} label="Check out" />
      </div>
      {inPass && !live && now < readyAt && (
        <Card className="p-6 text-center">
          <div className="text-4xl">🏋️</div>
          <div className="font-display mt-2 text-xl font-bold">Checked in — go train!</div>
          <p className="mt-1 text-sm text-muted">
            Check-out unlocks in <Countdown to={readyAt} />. You&apos;ll get a <b>new</b> pose.
          </p>
        </Card>
      )}
      {!live && (!inPass || now >= readyAt) && (
        <Card className="p-6 text-center">
          <div className="text-4xl">{inPass ? "🏁" : "📍"}</div>
          <div className="font-display mt-2 text-xl font-bold">{inPass ? "Ready to check out" : `At ${c.gymLabel || "the gym"}?`}</div>
          <p className="mt-1 text-sm text-muted">
            Tapping below opens a {Math.round(c.windowSecs / 60) || 1}-minute window with a fresh random pose. Be inside {c.gymLabel || "the gym"} (within {c.gymRadiusM} m) with location on.
          </p>
          <Button size="lg" className="mt-4 w-full" onClick={open} loading={busy}>
            {inPass ? "🏁 Check out now" : "📍 I'm at the gym"}
          </Button>
          {err && <Alert tone="out" className="mt-3">{err}</Alert>}
        </Card>
      )}
      {live && (
        <CaptureAndJudge
          key={kind}
          title={inPass ? "Check-out photo with the NEW pose" : "Check-in photo at the gym"}
          pose={poseFromArray(w.pose!)}
          expiresAt={w.expiresAt!}
          kind={kind}
          challengeId={c.id}
          attemptsLeft={2 - used}
          onDone={reload}
          rule={c.plan.rule}
          needGps
        />
      )}
    </div>
  );
}

function Step({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className={cx("flex items-center gap-2 rounded-2xl border p-3 text-sm font-semibold", done ? "border-alive/40 bg-alive/10 text-alive" : active ? "border-flame/40 bg-flame/5" : "border-line text-muted")}>
      <span className={cx("grid h-6 w-6 place-items-center rounded-full text-xs", done ? "bg-alive text-white" : active ? "bg-flame text-white" : "bg-surface-2")}>{done ? "✓" : n}</span>
      {label}
    </div>
  );
}

// ------------------------------------------------------------------ duolingo

function DuolingoProof({ d, reload }: { d: ChallengeData; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<{ pass: boolean; message: string; xpGained?: number; streakNow?: number; tx?: string; unchanged?: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [retryIn, setRetryIn] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  async function check() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/proof/duolingo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ challengeId: d.challenge.id }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setR(j);
      if (j.pass) await reload();
      else if (j.unchanged || j.streakNow === j.streakBefore) {
        // Duolingo's public profile can lag a minute behind — retry automatically.
        setRetryIn(60);
        if (timer.current) clearInterval(timer.current);
        timer.current = setInterval(() => {
          setRetryIn((s) => {
            if (s <= 1) {
              clearInterval(timer.current!);
              void check();
              return 0;
            }
            return s - 1;
          });
        }, 1000);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <Card className="p-6 text-center">
        <div className="text-5xl">🦉</div>
        <p className="mt-3 text-muted">
          Finish today&apos;s lesson(s) in Duolingo, then tap below. We read your public profile: you need <b className="text-ink">≥ {d.challenge.minXp} XP</b> since the last snapshot{" "}
          <b className="text-ink">and</b> your streak must go up by exactly 1.
        </p>
        <Button size="lg" className="mt-5 w-full" onClick={check} loading={busy}>
          I&apos;m done for today
        </Button>
        {retryIn > 0 && <p className="mt-3 text-sm text-muted">Duolingo hasn&apos;t updated yet — checking again in {retryIn}s…</p>}
      </Card>
      {r && (
        <Card className={cx("rise p-6 text-center", r.pass ? "border-alive/40 bg-alive/10" : "border-out/30 bg-out/5")}>
          <div className="font-display text-2xl font-extrabold">{r.pass ? r.message : "Not yet"}</div>
          {!r.pass && <p className="mt-2 text-sm">{r.message}</p>}
          {r.tx && (
            <div className="mt-2">
              <TxLink sig={r.tx} label="Verdict onchain" />
            </div>
          )}
        </Card>
      )}
      {err && <Alert tone="out">{err}</Alert>}
      <p className="text-center text-[11px] text-muted">A scheduled snapshot also runs at your midnight, so if you forget to tap, a qualifying day still counts.</p>
    </div>
  );
}

// ------------------------------------------------------------------ honor

function HonorProof({ d, reload }: { d: ChallengeData; reload: () => Promise<void> }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<{ tx?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/proof/honor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ challengeId: d.challenge.id, note }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setR(j);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="mt-6 p-6">
      <Badge tone="gold">🤝 Honor system</Badge>
      <p className="mt-3 text-muted">This habit can&apos;t be photographed, so it runs on trust. Your word is recorded onchain — make it count.</p>
      <input className={cx(inputCls, "mt-4")} placeholder="Optional note (e.g. 'Skipped dessert at lunch')" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
      <Button size="lg" className="mt-4 w-full" onClick={go} loading={busy}>
        I kept it today
      </Button>
      {r && (
        <Alert tone="alive" className="mt-3">
          Recorded ✓ <TxLink sig={r.tx} />
        </Alert>
      )}
      {err && <Alert tone="out" className="mt-3">{err}</Alert>}
    </Card>
  );
}
