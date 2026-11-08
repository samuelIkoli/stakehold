"use client";

import { useEffect, useState } from "react";
import { cx } from "./ui";

/**
 * Shown instead of the wallet-adapter modal when no Solana wallet is detected
 * (that modal renders an empty "You'll need a wallet" screen with no actions).
 */
export function NoWalletDialog({ onClose }: { onClose: () => void }) {
  const [env, setEnv] = useState({ mobile: false, phantomLink: "" });
  useEffect(() => {
    const url = window.location.href;
    setEnv({
      mobile: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
      phantomLink: `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(window.location.origin)}`,
    });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const link = "flex h-11 w-full items-center justify-center rounded-full text-[15px] font-semibold transition";
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[rgba(10,8,15,0.6)] p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="no-wallet-title" className="w-full max-w-sm rounded-3xl border border-line bg-surface p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
        <div className="text-3xl">👛</div>
        <h2 id="no-wallet-title" className="mt-3 font-display text-xl font-bold">No Solana wallet found</h2>
        <p className="mt-2 text-sm text-muted">
          {env.mobile
            ? "Mobile browsers can't talk to wallets directly. Open Stakehold inside the Phantom app's browser instead."
            : "Install the Phantom browser extension, then reload this page. Switch Phantom to Solana Devnet (Settings → Developer Settings)."}
        </p>
        <div className="mt-5 space-y-2">
          {env.mobile && env.phantomLink && (
            <a href={env.phantomLink} className={cx(link, "bg-flame text-white hover:brightness-110")}>
              Open in Phantom
            </a>
          )}
          <a
            href="https://phantom.com/download"
            target="_blank"
            rel="noreferrer"
            className={cx(link, env.mobile ? "border border-line bg-surface text-ink hover:bg-surface-2" : "bg-flame text-white hover:brightness-110")}
          >
            {env.mobile ? "Get the Phantom app ↗" : "Install Phantom ↗"}
          </a>
          {!env.mobile && (
            <button onClick={() => window.location.reload()} className={cx(link, "border border-line bg-surface text-ink hover:bg-surface-2")}>
              I&apos;ve installed it — reload
            </button>
          )}
          <button onClick={onClose} className={cx(link, "text-muted hover:bg-surface-2")}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
