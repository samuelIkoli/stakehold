import Link from "next/link";
import { PROOF_EMOJI_S, PROOF_LABEL_S, StrengthChip } from "./static-bits";

export type CardChallenge = {
  id: string;
  title: string;
  habit: string;
  proofType: string;
  strength: string;
  mode: string;
  stakeLamports: number;
  demo: boolean;
  refStartTs: number;
  dayLen: number;
  numDays: number;
  maxPlayers: number;
  status: string;
  players: number;
  active: number;
};

function timing(c: CardChallenge, now: number) {
  // Members start at their own midnight; the reference start is close enough for a card.
  const start = c.refStartTs;
  const end = start + c.numDays * c.dayLen;
  if (c.status === "settled") return { label: "Settled", tone: "text-muted" };
  if (now < start) {
    const s = start - now;
    return { label: `Starts in ${s > 86400 ? Math.ceil(s / 86400) + "d" : s > 3600 ? Math.ceil(s / 3600) + "h" : Math.ceil(s / 60) + "m"}`, tone: "text-alive" };
  }
  if (now < end) {
    const left = end - now;
    const unit = c.demo ? `${Math.ceil(left / 60)}m left` : `${Math.ceil(left / 86400)}d left`;
    return { label: `Live · ${unit}`, tone: "text-flame" };
  }
  return { label: "Settling…", tone: "text-gold" };
}

export function ChallengeCard({ c }: { c: CardChallenge }) {
  const now = Math.floor(Date.now() / 1000);
  const t = timing(c, now);
  const pot = (c.stakeLamports * c.players) / 1e9;
  return (
    <Link
      href={`/c/${c.id}`}
      className="group flex flex-col rounded-3xl border border-line bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:border-flame/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-surface-2 text-2xl">{PROOF_EMOJI_S[c.proofType] ?? "🔥"}</div>
        <div className="flex flex-wrap justify-end gap-1">
          {c.demo && <span className="rounded-full bg-violet/10 px-2 py-0.5 text-[11px] font-bold text-violet">DEMO</span>}
          <StrengthChip strength={c.strength} />
        </div>
      </div>
      <h3 className="font-display mt-4 line-clamp-1 text-lg font-bold group-hover:text-flame">{c.title}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-muted">{c.habit}</p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-surface-2 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Stake</div>
          <div className="text-sm font-bold">{(c.stakeLamports / 1e9).toString()} ◎</div>
        </div>
        <div className="rounded-xl bg-surface-2 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Players</div>
          <div className="text-sm font-bold">
            {c.active}/{c.players}
            <span className="text-muted">·{c.maxPlayers}</span>
          </div>
        </div>
        <div className="rounded-xl bg-surface-2 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Pot</div>
          <div className="text-sm font-bold text-gold">{pot.toFixed(2)} ◎</div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs">
        <span className={`font-semibold ${t.tone}`}>{t.label}</span>
        <span className="text-muted">
          {c.numDays} {c.demo ? "demo " : ""}days · {PROOF_LABEL_S[c.proofType]}
        </span>
      </div>
    </Link>
  );
}
