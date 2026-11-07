"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Alert, Badge, Button, Card, Field, Segmented, StrengthBadge, cx, inputCls } from "./ui";
import { useSession } from "./providers";
import { canonicalJson, sha256Hex, type ChallengeRules } from "@/lib/canonical";
import { localDate, memberStart, nextDate, nextDemoMidnight, utcMidnightOf } from "@/lib/time";
import { createChallengeTx, friendlyError } from "@/lib/client/tx";
import { DEMO_CHARITIES, SOLO_BONUS_BPS, SOLO_BONUS_CAP_SOL } from "@/lib/charities";
import type { ProofPlan, ProofType } from "@/lib/ai/types";

const EXAMPLES = ["Go to the gym 4x a week", "Do Duolingo Spanish every day", "Read 20 pages a day", "No sugar for 2 weeks", "Drink 2L of water daily"];

const DEFAULT_PLAN: ProofPlan = {
  title: "",
  proofType: "photo",
  rule: "",
  strength: "good",
  strengthReason: "A live photo with a random pose in a surprise window.",
  windowStartHour: 7,
  windowEndHour: 21,
  windowMinutes: 10,
  tips: [],
};

const strengthFor = (t: ProofType) => (t === "duolingo" ? "strong" : t === "honor" ? "honor" : "good");

export function CreateForm({ initialMode = "group" }: { initialMode?: "group" | "public" | "solo" }) {
  const router = useRouter();
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { setVisible } = useWalletModal();
  const { signIn } = useSession();

  const [habit, setHabit] = useState("");
  const [plan, setPlan] = useState<ProofPlan | null>(null);
  const [planSource, setPlanSource] = useState<"ai" | "rules" | "manual" | null>(null);
  const [planning, setPlanning] = useState(false);

  const [mode, setMode] = useState<"group" | "public" | "solo">(initialMode);
  const [stake, setStake] = useState(0.1);
  const [days, setDays] = useState(7);
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [tz, setTz] = useState("UTC");
  const [startDate, setStartDate] = useState("");
  const [playing, setPlaying] = useState(true);
  const [demo, setDemo] = useState(false);
  const [demoDayLen, setDemoDayLen] = useState(120);
  const [demoLead, setDemoLead] = useState(180);
  const [failDest, setFailDest] = useState<"pool" | "charity">("charity");
  const [charity, setCharity] = useState(0);
  const [description, setDescription] = useState("");
  const [gym, setGym] = useState<{ lat: string; lng: string; radiusM: number; label: string }>({ lat: "", lng: "", radiusM: 100, label: "" });
  const [locating, setLocating] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    setTz(zone);
    setStartDate(nextDate(localDate(zone)));
  }, []);
  useEffect(() => setMode(initialMode), [initialMode]);

  async function draftPlan(text = habit) {
    if (text.trim().length < 3) return;
    setPlanning(true);
    setError(null);
    try {
      const r = await fetch("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ habit: text }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setPlan(j.plan);
      setPlanSource(j.source);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setPlanning(false);
    }
  }

  function manualPlan() {
    setPlan({ ...DEFAULT_PLAN, title: habit.slice(0, 40), rule: habit ? `The photo clearly shows: ${habit}` : "" });
    setPlanSource("manual");
  }

  const p = plan;
  const set = <K extends keyof ProofPlan>(k: K, v: ProofPlan[K]) => setPlan((x) => (x ? { ...x, [k]: v, ...(k === "proofType" ? { strength: strengthFor(v as ProofType) } : {}) } : x));

  const dayLen = demo ? demoDayLen : 86400;
  const timing = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    if (demo) {
      const start = nextDemoMidnight(now, demoDayLen, demoLead);
      return { refStart: start, myStart: start, offset: 0 };
    }
    if (!startDate) return null;
    const refStart = utcMidnightOf(startDate);
    const m = memberStart(refStart, tz);
    return { refStart, myStart: m.startTs, offset: m.offsetMin };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, demoDayLen, demoLead, startDate, tz, busy]);

  async function useMyLocation() {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGym((g) => ({ ...g, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) }));
        setLocating(false);
      },
      (err) => {
        setError(`Location: ${err.message}`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function create() {
    setError(null);
    if (!wallet) return setVisible(true);
    if (!p) return setError("Add a proof plan first");
    if (!p.title.trim() || !p.rule.trim()) return setError("Give the challenge a title and a rule");
    if (!timing) return;
    const now = Math.floor(Date.now() / 1000);
    if (timing.myStart <= now + 30) return setError("Start time must be in the future — pick a later date");
    if (p.proofType === "gym" && (!gym.lat || !gym.lng)) return setError("Set the gym location");
    setBusy(true);
    try {
      await signIn();
      const windowSecs = demo ? Math.round(Math.min(p.windowMinutes * 60, demoDayLen * 0.65)) : p.windowMinutes * 60;
      const minGapSecs =
        p.proofType === "gym" ? (demo ? Math.max(20, Math.round(((p.minGapMinutes ?? 45) * 60 * demoDayLen) / 86400)) : (p.minGapMinutes ?? 45) * 60) : undefined;
      const rules: ChallengeRules = {
        v: 1,
        title: p.title.trim(),
        habit: habit.trim() || p.title.trim(),
        proofType: p.proofType,
        rule: p.rule.trim(),
        strength: p.strength,
        windowStartHour: p.windowStartHour,
        windowEndHour: p.windowEndHour,
        windowMinutes: p.windowMinutes,
        ...(p.proofType === "duolingo" ? { minXp: p.minXp ?? 30 } : {}),
        ...(minGapSecs ? { minGapSecs } : {}),
        ...(p.proofType === "gym" ? { gym: { lat: Number(gym.lat), lng: Number(gym.lng), radiusM: gym.radiusM, label: gym.label || undefined } } : {}),
      };
      const hash = await sha256Hex(canonicalJson(rules));
      const solo = mode === "solo";
      const joinNow = solo || (playing && p.proofType !== "duolingo");
      const { sig, challenge } = await createChallengeTx(connection, wallet, {
        mode: mode === "group" ? 0 : mode === "public" ? 1 : 2,
        demo,
        stakeLamports: Math.round(stake * 1e9),
        startTs: timing.refStart,
        dayLen,
        numDays: days,
        graceSecs: demo ? Math.max(15, Math.round(demoDayLen / 6)) : 7200,
        windowSecs,
        maxPlayers: solo ? 1 : maxPlayers,
        configHashHex: hash,
        failDest: solo && failDest === "charity" ? 1 : 0,
        charityIndex: charity,
        joinOffsetMin: joinNow ? timing.offset : null,
      });
      const reg = await fetch("/api/challenges", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pubkey: challenge, rules, description, tx: sig }),
      });
      if (!reg.ok) throw new Error((await reg.json()).error);
      if (joinNow) {
        await fetch(`/api/challenges/${challenge}/join`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tz, tx: sig }),
        });
      }
      router.push(`/c/${challenge}?created=1`);
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  const solo = mode === "solo";
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {/* STEP 1 */}
        <Card className="p-5 sm:p-6">
          <StepTitle n={1} title={solo ? "What will you commit to?" : "What's the habit?"} sub="Say it in plain English. The AI referee drafts a fair proof plan." />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              className={inputCls}
              placeholder="e.g. Go to the gym every weekday"
              value={habit}
              onChange={(e) => setHabit(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && draftPlan()}
              maxLength={300}
            />
            <Button onClick={() => draftPlan()} loading={planning} disabled={habit.trim().length < 3} className="sm:w-48">
              ✨ Draft proof plan
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((x) => (
              <button
                key={x}
                onClick={() => {
                  setHabit(x);
                  draftPlan(x);
                }}
                className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs font-medium text-muted transition hover:text-ink"
              >
                {x}
              </button>
            ))}
          </div>
          {!p && (
            <button onClick={manualPlan} className="mt-4 text-sm font-semibold text-muted underline-offset-4 hover:text-ink hover:underline">
              or write the plan yourself →
            </button>
          )}
        </Card>

        {/* STEP 2 */}
        {p && (
          <Card className="rise p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <StepTitle n={2} title="Proof plan" sub="Accept it or tweak anything. The rules are hashed onchain so nobody can change them later." />
              <div className="flex items-center gap-2">
                {planSource === "ai" && <Badge tone="violet">✨ AI drafted</Badge>}
                {planSource === "rules" && <Badge>Template (AI offline)</Badge>}
                <StrengthBadge strength={p.strength} />
              </div>
            </div>
            {p.strengthReason && <p className="mt-3 text-sm text-muted">{p.strengthReason}</p>}
            {p.reframe && (
              <Alert tone="gold" className="mt-3">
                <b>Honest note:</b> {p.reframe}
              </Alert>
            )}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Title">
                <input className={inputCls} value={p.title} onChange={(e) => set("title", e.target.value)} maxLength={60} />
              </Field>
              <Field label="Proof type">
                <select className={inputCls} value={p.proofType} onChange={(e) => set("proofType", e.target.value as ProofType)}>
                  <option value="photo">📸 Photo + random pose</option>
                  <option value="gym">🏋️ Gym check-in + check-out + GPS</option>
                  <option value="duolingo">🦉 Duolingo XP + streak (verified data)</option>
                  <option value="honor">🤝 Honor system (self-report)</option>
                </select>
              </Field>
            </div>
            <div className="mt-4">
              <Field label={p.proofType === "duolingo" ? "Data rule" : "What the photo must show"} hint={p.proofType === "photo" || p.proofType === "gym" ? "The AI judge checks this, plus the random pose and that it's a live photo." : undefined}>
                <textarea className={cx(inputCls, "min-h-20")} value={p.rule} onChange={(e) => set("rule", e.target.value)} maxLength={500} />
              </Field>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {p.proofType === "photo" && (
                <>
                  <Field label="Window opens after" hint="Local time, each player's own zone">
                    <select className={inputCls} value={p.windowStartHour} onChange={(e) => set("windowStartHour", Number(e.target.value))}>
                      {Array.from({ length: 24 }, (_, h) => (
                        <option key={h} value={h}>
                          {String(h).padStart(2, "0")}:00
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="…and before">
                    <select className={inputCls} value={p.windowEndHour} onChange={(e) => set("windowEndHour", Number(e.target.value))}>
                      {Array.from({ length: 24 }, (_, h) => h + 1)
                        .filter((h) => h > p.windowStartHour)
                        .map((h) => (
                          <option key={h} value={h}>
                            {String(h % 24).padStart(2, "0")}:00
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Window length">
                    <select className={inputCls} value={p.windowMinutes} onChange={(e) => set("windowMinutes", Number(e.target.value))}>
                      {[5, 10, 15, 30].map((m) => (
                        <option key={m} value={m}>
                          {m} minutes
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              )}
              {p.proofType === "duolingo" && (
                <Field label="Minimum XP per day">
                  <input type="number" min={1} className={inputCls} value={p.minXp ?? 30} onChange={(e) => set("minXp", Number(e.target.value))} />
                </Field>
              )}
              {p.proofType === "gym" && (
                <>
                  <Field label="Min. minutes between check-in and check-out">
                    <input type="number" min={5} className={inputCls} value={p.minGapMinutes ?? 45} onChange={(e) => set("minGapMinutes", Number(e.target.value))} />
                  </Field>
                  <Field label="Pose window length">
                    <select className={inputCls} value={p.windowMinutes} onChange={(e) => set("windowMinutes", Number(e.target.value))}>
                      {[5, 10, 15].map((m) => (
                        <option key={m} value={m}>
                          {m} minutes
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              )}
            </div>
            {p.proofType === "gym" && (
              <div className="mt-4 rounded-2xl border border-line bg-surface-2/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold">📍 Gym location</div>
                  <Button size="sm" variant="secondary" onClick={useMyLocation} loading={locating}>
                    Use my current location
                  </Button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  <input className={inputCls} placeholder="Gym name" value={gym.label} onChange={(e) => setGym({ ...gym, label: e.target.value })} />
                  <input className={inputCls} placeholder="Latitude" value={gym.lat} onChange={(e) => setGym({ ...gym, lat: e.target.value })} />
                  <input className={inputCls} placeholder="Longitude" value={gym.lng} onChange={(e) => setGym({ ...gym, lng: e.target.value })} />
                  <select className={inputCls} value={gym.radiusM} onChange={(e) => setGym({ ...gym, radiusM: Number(e.target.value) })}>
                    {[75, 100, 150, 250].map((r) => (
                      <option key={r} value={r}>
                        within {r} m
                      </option>
                    ))}
                  </select>
                </div>
                {gym.lat && gym.lng && (
                  <a
                    className="mt-2 inline-block text-xs text-violet hover:underline"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://www.openstreetmap.org/?mlat=${gym.lat}&mlon=${gym.lng}#map=17/${gym.lat}/${gym.lng}`}
                  >
                    Check on map ↗
                  </a>
                )}
              </div>
            )}
            {p.tips.length > 0 && (
              <ul className="mt-4 space-y-1 text-sm text-muted">
                {p.tips.map((t) => (
                  <li key={t}>💡 {t}</li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {/* STEP 3 */}
        {p && (
          <Card className="rise p-5 sm:p-6">
            <StepTitle n={3} title="Stakes & format" />
            {!solo && (
              <div className="mt-4">
                <Segmented
                  value={mode}
                  onChange={(v) => setMode(v)}
                  options={[
                    { value: "group", label: "🔒 Private group" },
                    { value: "public", label: "🌍 Public" },
                  ]}
                />
                <p className="mt-2 text-xs text-muted">
                  {mode === "group" ? "Only people with your invite link can join." : "Listed on Explore for anyone to join."}
                </p>
              </div>
            )}
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field label="Stake per player (devnet SOL)">
                <div className="flex flex-wrap gap-2">
                  {[0.05, 0.1, 0.25, 0.5].map((v) => (
                    <button key={v} onClick={() => setStake(v)} className={chip(stake === v)}>
                      {v} ◎
                    </button>
                  ))}
                  <input type="number" step="0.01" min={0.001} max={10} className={cx(inputCls, "w-24 py-2")} value={stake} onChange={(e) => setStake(Number(e.target.value))} />
                </div>
              </Field>
              <Field label="Duration">
                <div className="flex flex-wrap gap-2">
                  {(demo ? [1, 2, 3, 5] : [3, 7, 14, 30]).map((v) => (
                    <button key={v} onClick={() => setDays(v)} className={chip(days === v)}>
                      {v} {v === 1 ? "day" : "days"}
                    </button>
                  ))}
                </div>
              </Field>
              {!solo && (
                <Field label="Max players">
                  <input type="number" min={2} max={16} className={inputCls} value={maxPlayers} onChange={(e) => setMaxPlayers(Math.min(16, Math.max(2, Number(e.target.value))))} />
                </Field>
              )}
              {!demo && (
                <Field label="Start date" hint={`Starts at midnight in each player's own time zone (yours: ${tz}).`}>
                  <input type="date" className={inputCls} value={startDate} min={nextDate(localDate(tz))} onChange={(e) => setStartDate(e.target.value)} />
                </Field>
              )}
            </div>

            {solo && (
              <div className="mt-6">
                <div className="mb-2 text-sm font-semibold">If you fail, your stake goes to…</div>
                <Segmented
                  value={failDest}
                  onChange={setFailDest}
                  options={[
                    { value: "charity", label: "💝 A charity" },
                    { value: "pool", label: "🌊 Community pool" },
                  ]}
                />
                {failDest === "charity" && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {DEMO_CHARITIES.map((c) => (
                      <button key={c.index} onClick={() => setCharity(c.index)} className={cx("rounded-2xl border p-3 text-left text-sm transition", charity === c.index ? "border-flame bg-flame/5" : "border-line bg-surface-2 hover:border-ink/30")}>
                        <div className="text-xl">{c.emoji}</div>
                        <div className="mt-1 font-semibold">{c.name.replace(" (demo wallet)", "")}</div>
                        <div className="text-[11px] text-muted">Demo wallet · devnet</div>
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-xs text-muted">
                  Succeed and you get your stake back <b>plus a bonus</b> of {SOLO_BONUS_BPS / 100}% of the community pool (max {SOLO_BONUS_CAP_SOL} SOL). Charities listed are
                  clearly-labelled demo wallets for the hackathon.
                </p>
              </div>
            )}

            {!solo && p.proofType !== "duolingo" && (
              <label className="mt-5 flex items-center gap-3 text-sm">
                <input type="checkbox" className="h-5 w-5 accent-[var(--flame)]" checked={playing} onChange={(e) => setPlaying(e.target.checked)} />
                I&apos;m playing too (stake {stake} SOL now)
              </label>
            )}
            {!solo && p.proofType === "duolingo" && <p className="mt-5 text-xs text-muted">Duolingo challenges: you&apos;ll join from the challenge page after linking your Duolingo account.</p>}

            <div className="mt-6 rounded-2xl border border-dashed border-violet/40 bg-violet/5 p-4">
              <label className="flex items-center gap-3 text-sm font-semibold">
                <input type="checkbox" className="h-5 w-5 accent-[var(--violet)]" checked={demo} onChange={(e) => {
                  setDemo(e.target.checked);
                  setDays(e.target.checked ? 2 : 7);
                }} />
                Demo mode — 1 day = {demoDayLen / 60} minutes
              </label>
              {demo && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Day length">
                    <select className={inputCls} value={demoDayLen} onChange={(e) => setDemoDayLen(Number(e.target.value))}>
                      {[60, 90, 120, 180, 300].map((s) => (
                        <option key={s} value={s}>
                          {s / 60} min
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Starts in about">
                    <select className={inputCls} value={demoLead} onChange={(e) => setDemoLead(Number(e.target.value))}>
                      {[60, 180, 300, 600].map((s) => (
                        <option key={s} value={s}>
                          {s / 60} min
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              )}
            </div>

            <div className="mt-5">
              <Field label="Description (optional)">
                <textarea className={cx(inputCls, "min-h-16")} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} placeholder="Trash talk welcome." />
              </Field>
            </div>
          </Card>
        )}
      </div>

      {/* SUMMARY */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <Card className="overflow-hidden">
          <div className="bg-ink p-5 text-bg">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-gold">{solo ? "Bet on yourself" : "Your challenge"}</div>
            <div className="font-display mt-1 text-2xl font-extrabold">{p?.title || "Untitled challenge"}</div>
            <div className="mt-1 text-sm opacity-70">{habit || "Describe a habit to begin"}</div>
          </div>
          <div className="space-y-3 p-5 text-sm">
            <Row k="Stake" v={`${stake} SOL ${solo ? "" : "per player"}`} />
            <Row k="Duration" v={`${days} ${demo ? "demo " : ""}day${days > 1 ? "s" : ""}${demo ? ` (${(days * demoDayLen) / 60} min)` : ""}`} />
            {!solo && <Row k="Max pot" v={`${(stake * maxPlayers).toFixed(2)} SOL`} />}
            <Row k="Proof" v={p ? { photo: "📸 Photo + pose", gym: "🏋️ Gym", duolingo: "🦉 Duolingo", honor: "🤝 Honor" }[p.proofType] : "—"} />
            <Row
              k="Starts"
              v={timing ? new Date(timing.myStart * 1000).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
            />
            {solo && <Row k="If you fail" v={failDest === "charity" ? DEMO_CHARITIES[charity].emoji + " " + DEMO_CHARITIES[charity].name.replace(" (demo wallet)", "") : "🌊 Community pool"} />}
            <div className="border-t border-line pt-3 text-xs text-muted">
              {solo ? "Finish every day → stake back + pool bonus." : "Miss a day → eliminated. Survivors split the whole pot equally."}
            </div>
            {error && <Alert tone="out">{error}</Alert>}
            <Button size="lg" className="w-full" onClick={create} loading={busy} disabled={!p}>
              {wallet ? (solo ? `Stake ${stake} SOL on myself` : "Create onchain") : "Connect wallet to create"}
            </Button>
            <p className="text-center text-[11px] text-muted">Solana devnet · you&apos;ll sign one transaction{(solo || playing) && p?.proofType !== "duolingo" ? " (create + your stake)" : ""}.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function chip(active: boolean) {
  return cx("rounded-full border px-4 py-2 text-sm font-semibold transition", active ? "border-flame bg-flame text-white" : "border-line bg-surface-2 hover:border-ink/30");
}

function StepTitle({ n, title, sub }: { n: number; title: string; sub?: string }) {
  return (
    <div className="flex gap-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-bg">{n}</div>
      <div>
        <h2 className="font-display text-xl font-bold">{title}</h2>
        {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{k}</span>
      <span className="text-right font-semibold">{v}</span>
    </div>
  );
}
