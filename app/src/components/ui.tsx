"use client";

import Link from "next/link";
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { explorerAddress, explorerTx, shortKey } from "@/lib/solana/constants";
import { formatDuration } from "@/lib/time";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  href?: string;
};

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap";
const btnVariants = {
  primary: "bg-flame text-white shadow-[0_8px_24px_-10px_var(--flame)] hover:brightness-110",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
  ghost: "text-ink hover:bg-surface-2",
  danger: "bg-out/10 text-out border border-out/30 hover:bg-out/15",
  success: "bg-alive text-white shadow-[0_8px_24px_-10px_var(--alive)] hover:brightness-110 dark:text-[#06210f]",
};
const btnSizes = { sm: "h-9 px-4 text-sm", md: "h-11 px-5 text-[15px]", lg: "h-14 px-7 text-base" };

export function Button({ variant = "primary", size = "md", loading, className, children, href, ...rest }: BtnProps) {
  const cls = cx(btnBase, btnVariants[variant], btnSizes[size], className);
  if (href)
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  return (
    <button className={cls} disabled={loading || rest.disabled} {...rest}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx("h-4 w-4 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("rounded-3xl border border-line bg-surface shadow-card", className)} {...rest}>
      {children}
    </div>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "flame" | "alive" | "out" | "gold" | "violet"; className?: string }) {
  const tones = {
    neutral: "bg-surface-2 text-muted border-line",
    flame: "bg-flame/10 text-flame border-flame/25",
    alive: "bg-alive/10 text-alive border-alive/25",
    out: "bg-out/10 text-out border-out/25",
    gold: "bg-gold/15 text-[color-mix(in_oklab,var(--gold)_75%,var(--ink))] border-gold/30",
    violet: "bg-violet/10 text-violet border-violet/25",
  };
  return <span className={cx("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>{children}</span>;
}

export function StrengthBadge({ strength }: { strength: string }) {
  if (strength === "strong") return <Badge tone="alive">🛡️ Strong proof</Badge>;
  if (strength === "good") return <Badge tone="violet">📸 Good proof</Badge>;
  return <Badge tone="gold">🤝 Honor system</Badge>;
}

export const PROOF_LABEL: Record<string, string> = {
  photo: "Photo + pose",
  gym: "Gym check-in/out",
  duolingo: "Duolingo XP",
  github: "GitHub commits",
  honor: "Honor system",
};
export const PROOF_EMOJI: Record<string, string> = { photo: "📸", gym: "🏋️", duolingo: "🦉", github: "🐙", honor: "🤝" };

export function TxLink({ sig, label = "View on Explorer", className }: { sig?: string | null; label?: string; className?: string }) {
  if (!sig) return null;
  return (
    <a href={explorerTx(sig)} target="_blank" rel="noreferrer" className={cx("inline-flex items-center gap-1 text-xs font-medium text-violet hover:underline", className)}>
      {label}
      <ExternalIcon />
    </a>
  );
}

export function AddressLink({ address, label, className }: { address: string; label?: string; className?: string }) {
  return (
    <a href={explorerAddress(address)} target="_blank" rel="noreferrer" className={cx("inline-flex items-center gap-1 font-mono text-xs text-violet hover:underline", className)}>
      {label ?? shortKey(address)}
      <ExternalIcon />
    </a>
  );
}

export function ExternalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M4.5 2H2.5A.5.5 0 0 0 2 2.5v7a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5V7.5M7 2h3v3M10 2 5.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function Countdown({ to, prefix, done }: { to: number; prefix?: string; done?: ReactNode }) {
  const now = useNow();
  const left = to - now;
  if (left <= 0) return <>{done ?? "now"}</>;
  return (
    <span className="tabular-nums">
      {prefix}
      {formatDuration(left)}
    </span>
  );
}

export function Stat({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-2xl border border-line bg-surface-2/60 p-4", className)}>
      <div className="text-xs font-medium uppercase tracking-wider text-muted">{label}</div>
      <div className="font-display mt-1 text-2xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function SectionTitle({ eyebrow, title, sub, className }: { eyebrow?: string; title: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={className}>
      {eyebrow && <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-flame">{eyebrow}</div>}
      <h2 className="font-display text-3xl font-extrabold sm:text-4xl">{title}</h2>
      {sub && <p className="mt-2 max-w-2xl text-muted">{sub}</p>}
    </div>
  );
}

export function Alert({ tone = "neutral", children, className }: { tone?: "neutral" | "out" | "alive" | "gold" | "flame"; children: ReactNode; className?: string }) {
  const tones = {
    neutral: "border-line bg-surface-2 text-ink",
    out: "border-out/30 bg-out/10 text-out",
    alive: "border-alive/30 bg-alive/10 text-alive",
    gold: "border-gold/40 bg-gold/10",
    flame: "border-flame/30 bg-flame/10",
  };
  return <div className={cx("rounded-2xl border px-4 py-3 text-sm", tones[tone], className)}>{children}</div>;
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[15px] outline-none transition placeholder:text-muted/70 focus:border-flame focus:ring-4 focus:ring-flame/15";

export function Segmented<T extends string | number>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-2xl border border-line bg-surface-2 p-1">
      {options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={cx(
            "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition",
            value === o.value ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
