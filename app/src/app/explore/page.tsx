import Link from "next/link";
import { db } from "@/lib/db";
import { ChallengeCard } from "@/components/challenge-card";
import { EmptyArt } from "@/components/art";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "", label: "All" },
  { key: "photo", label: "📸 Photo" },
  { key: "gym", label: "🏋️ Gym" },
  { key: "duolingo", label: "🦉 Duolingo" },
  { key: "honor", label: "🤝 Honor" },
];

export default async function Explore({ searchParams }: { searchParams: Promise<{ type?: string; show?: string }> }) {
  const { type = "", show = "open" } = await searchParams;
  const rows = await db.challenge
    .findMany({
      where: { mode: "public", ...(type ? { proofType: type } : {}), ...(show === "open" ? { status: "active" } : {}) },
      orderBy: { createdAt: "desc" },
      take: 60,
      include: { participants: { select: { status: true } } },
    })
    .catch(() => []);
  const now = Math.floor(Date.now() / 1000);
  // Joinable first (not started), then live, then the rest.
  const rank = (c: (typeof rows)[number]) => (c.status !== "active" ? 2 : now < c.refStartTs ? 0 : 1);
  rows.sort((a, b) => rank(a) - rank(b));
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-flame">Explore</div>
          <h1 className="font-display text-4xl font-extrabold">Public challenges</h1>
          <p className="mt-2 text-muted">Join strangers, stake together, outlast them.</p>
        </div>
        <Link href="/create" className="inline-flex h-11 items-center rounded-full bg-flame px-5 font-semibold text-white">
          + New challenge
        </Link>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/explore?type=${f.key}&show=${show}`}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${type === f.key ? "border-ink bg-ink text-bg" : "border-line bg-surface text-muted hover:text-ink"}`}
          >
            {f.label}
          </Link>
        ))}
        <span className="mx-1 w-px bg-line" />
        <Link
          href={`/explore?type=${type}&show=${show === "open" ? "all" : "open"}`}
          className="rounded-full border border-line bg-surface px-4 py-1.5 text-sm font-semibold text-muted hover:text-ink"
        >
          {show === "open" ? "Show finished too" : "Hide finished"}
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <EmptyArt className="h-28 w-36" />
          <h2 className="font-display mt-4 text-xl font-bold">No public challenges here yet</h2>
          <p className="mt-1 text-muted">Be the first — start one and share it.</p>
          <Link href="/create" className="mt-5 inline-flex h-11 items-center rounded-full bg-flame px-5 font-semibold text-white">
            Create a challenge
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <ChallengeCard
              key={c.id}
              c={{ ...c, players: c.participants.length, active: c.participants.filter((p) => p.status !== "eliminated").length }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
