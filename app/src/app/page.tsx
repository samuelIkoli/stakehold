import Link from "next/link";
import { db } from "@/lib/db";
import { HeroArt, Flame } from "@/components/art";
import { ChallengeCard } from "@/components/challenge-card";
import { PROGRAM_ID } from "@/lib/solana/constants";

export const dynamic = "force-dynamic";

async function stats() {
  try {
    const [challenges, players, eliminated, survivors, proofs, staked] = await Promise.all([
      db.challenge.count(),
      db.participant.count(),
      db.participant.count({ where: { status: "eliminated" } }),
      db.participant.count({ where: { status: { in: ["survived", "claimed"] } } }),
      db.proof.count({ where: { onchain: true } }),
      db.challenge.findMany({ select: { stakeLamports: true, _count: { select: { participants: true } } } }),
    ]);
    const totalStaked = staked.reduce((s, c) => s + c.stakeLamports * c._count.participants, 0) / 1e9;
    const featured = await db.challenge.findMany({
      where: { mode: "public", status: "active" },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { participants: { select: { status: true } } },
    });
    return { challenges, players, eliminated, survivors, proofs, totalStaked, featured };
  } catch {
    return { challenges: 0, players: 0, eliminated: 0, survivors: 0, proofs: 0, totalStaked: 0, featured: [] };
  }
}

export default async function Home() {
  const s = await stats();
  return (
    <div>
      {/* HERO */}
      <section className="hero-glow relative overflow-hidden">
        <div className="grid-lines pointer-events-none absolute inset-0" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 pb-12 pt-10 md:grid-cols-[1.1fr_1fr] md:pb-20 md:pt-16">
          <div className="rise">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 text-xs font-semibold text-muted backdrop-blur">
              <Flame size={14} /> Survivor for your habits
            </div>
            <h1 className="font-display text-[44px] font-extrabold leading-[0.95] sm:text-6xl md:text-7xl">
              Put money on <br className="hidden sm:block" />
              your <span className="text-gradient">habits.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              An AI referee checks your proof. The people who quit pay the people who don&apos;t —{" "}
              <span className="font-semibold text-ink">and Solana makes every step verifiable.</span>
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/create" className="inline-flex h-14 items-center rounded-full bg-flame px-7 font-semibold text-white shadow-[0_10px_30px_-10px_var(--flame)] transition hover:brightness-110">
                Start a challenge
              </Link>
              <Link href="/explore" className="inline-flex h-14 items-center rounded-full border border-line bg-surface px-7 font-semibold transition hover:bg-surface-2">
                Join one →
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
              <span>🛡️ AI referee can&apos;t touch funds</span>
              <span>🎲 Poses from Solana slot hashes</span>
              <span>⚡ Automatic payouts</span>
            </div>
          </div>
          <HeroArt className="mx-auto w-full max-w-md drop-shadow-xl md:max-w-none" />
        </div>
      </section>

      {/* LIVE STATS */}
      <section className="mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ["Challenges", s.challenges],
            ["Players", s.players],
            ["SOL staked", s.totalStaked.toFixed(2)],
            ["Verdicts onchain", s.proofs],
            ["Eliminated 🔥", s.eliminated],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">{k}</div>
              <div className="font-display mt-1 text-3xl font-extrabold tabular-nums">{v}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-alive opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-alive" />
          </span>
          Live from Solana devnet · program{" "}
          <a className="font-mono text-violet hover:underline" href={`https://explorer.solana.com/address/${PROGRAM_ID.toBase58()}?cluster=devnet`} target="_blank" rel="noreferrer">
            {PROGRAM_ID.toBase58().slice(0, 6)}…
          </a>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8">
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-flame">How it works</div>
          <h2 className="font-display text-3xl font-extrabold sm:text-4xl">Three steps. Real stakes.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              n: "01",
              t: "Stake on a habit",
              d: "Pick a habit — gym, Duolingo, reading, anything. The AI drafts a fair proof plan and rates how strong it is. Your SOL goes into an onchain vault.",
              e: "💰",
            },
            {
              n: "02",
              t: "Prove it daily",
              d: "A surprise 10-minute window opens. Strike the random pose drawn from a Solana slot hash, snap a live photo. Code checks the facts, the AI checks the photo.",
              e: "📸",
            },
            {
              n: "03",
              t: "Survive & split",
              d: "Miss a day and you're out — live on the leaderboard. When it ends, survivors split the whole pot, including everyone who dropped out.",
              e: "🏆",
            },
          ].map((x) => (
            <div key={x.n} className="group relative overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-card">
              <div className="absolute -right-4 -top-6 text-[120px] font-black leading-none text-ink/[0.04]">{x.n}</div>
              <div className="text-4xl">{x.e}</div>
              <h3 className="font-display mt-4 text-xl font-bold">{x.t}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURED */}
      {s.featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="font-display text-2xl font-extrabold sm:text-3xl">Open challenges</h2>
            <Link href="/explore" className="text-sm font-semibold text-flame">
              See all →
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {s.featured.map((c) => (
              <ChallengeCard
                key={c.id}
                c={{ ...c, players: c.participants.length, active: c.participants.filter((p) => p.status !== "eliminated").length }}
              />
            ))}
          </div>
        </section>
      )}

      {/* TRUST */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="relative overflow-hidden rounded-[32px] bg-ink p-8 text-bg md:p-12">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-flame/30 blur-3xl" />
          <div className="relative grid gap-8 md:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-flame">Verifiable by anyone</div>
              <h2 className="font-display text-3xl font-extrabold">Everything that matters is on Solana.</h2>
              <p className="mt-3 opacity-70">Photos stay private — only their SHA-256 hash goes onchain. Everything else is public and checkable.</p>
            </div>
            <ul className="grid gap-3 text-[15px]">
              {[
                ["🏦", "Stakes sit in a program-owned vault — no one can run off with the pot."],
                ["🎲", "Each window's pose is derived from the SlotHashes sysvar. Recompute it yourself."],
                ["🧾", "Every verdict is a permanent onchain record with a proof hash and reason code."],
                ["🤖", "The AI referee has its own key. It can record verdicts — and nothing else."],
                ["⚡", "Settlement and payouts follow purely from recorded state."],
              ].map(([e, t]) => (
                <li key={t} className="flex gap-3">
                  <span>{e}</span>
                  <span className="opacity-90">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
