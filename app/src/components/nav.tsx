"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Logo } from "./art";
import { cx } from "./ui";
import { useSession, useTheme } from "./providers";
import { shortKey } from "@/lib/solana/constants";

const LINKS = [
  { href: "/explore", label: "Explore", icon: "🧭" },
  { href: "/create", label: "Create", icon: "➕" },
  { href: "/solo", label: "Solo", icon: "🎯" },
  { href: "/stake", label: "Stake", icon: "🎮", soon: true },
  { href: "/sponsor", label: "Sponsor", icon: "🎁", soon: true },
];

const TABS = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/explore", label: "Explore", icon: CompassIcon },
  { href: "/create", label: "Create", icon: PlusIcon },
  { href: "/solo", label: "Solo", icon: TargetIcon },
  { href: "/profile", label: "Me", icon: UserIcon },
];

export function Nav() {
  const path = usePathname();
  const { theme, toggle } = useTheme();
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2">
            <Logo size={30} />
            <span className="font-display text-lg font-extrabold tracking-tight">Stakehold</span>
            <span className="hidden rounded-full border border-violet/30 bg-violet/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet sm:inline">
              devnet
            </span>
          </Link>
          <nav className="ml-6 hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cx(
                  "rounded-full px-3 py-1.5 text-sm font-semibold transition",
                  path.startsWith(l.href) ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
                )}
              >
                {l.label}
                {l.soon && <span className="ml-1 text-[10px] font-bold uppercase text-flame">soon</span>}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={toggle}
              aria-label="Toggle dark mode"
              className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-sm transition hover:bg-surface-2"
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <WalletButton />
          </div>
        </div>
      </header>
      {/* mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {TABS.map((t) => {
            const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href} className={cx("flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold", active ? "text-flame" : "text-muted")}>
                <t.icon />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export function WalletButton({ className }: { className?: string }) {
  const { publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const { connection } = useConnection();
  const { wallet: session, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!publicKey) return setBalance(null);
    let live = true;
    const load = () => connection.getBalance(publicKey).then((b) => live && setBalance(b / 1e9)).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [publicKey, connection]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  if (!publicKey)
    return (
      <button
        onClick={() => setVisible(true)}
        className={cx("h-9 rounded-full bg-ink px-4 text-sm font-semibold text-bg transition hover:opacity-90", className)}
      >
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
    );
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface pl-2 pr-3 text-sm font-semibold transition hover:bg-surface-2"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-flame to-violet text-[10px] text-white">◎</span>
        <span className="font-mono">{shortKey(publicKey.toBase58())}</span>
        {balance != null && <span className="hidden text-muted sm:inline">{balance.toFixed(2)}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-line bg-surface p-2 shadow-card">
          <div className="px-3 py-2 text-xs text-muted">
            {balance != null ? `${balance.toFixed(4)} devnet SOL` : "…"}
            {session ? " · signed in" : ""}
          </div>
          <Link href="/profile" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 text-sm font-semibold hover:bg-surface-2">
            Profile
          </Link>
          <a href="https://faucet.solana.com" target="_blank" rel="noreferrer" className="block rounded-xl px-3 py-2 text-sm font-semibold hover:bg-surface-2">
            Get devnet SOL ↗
          </a>
          <button
            onClick={async () => {
              setOpen(false);
              await signOut();
              await disconnect();
            }}
            className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-out hover:bg-surface-2"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}
function CompassIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="6" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}
function TargetIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}
