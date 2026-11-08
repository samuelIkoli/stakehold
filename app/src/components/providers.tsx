"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { WalletModalProvider, useWalletModal } from "@solana/wallet-adapter-react-ui";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { NoWalletDialog } from "./no-wallet";
import bs58 from "bs58";
import { RPC_URL } from "@/lib/solana/constants";
import "@solana/wallet-adapter-react-ui/styles.css";

// ---------------- theme ----------------
type Theme = "light" | "dark";
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "dark", toggle: () => {} });
export const useTheme = () => useContext(ThemeCtx);

function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);
  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      try {
        localStorage.setItem("theme", next);
      } catch {}
      return next;
    });
  }, []);
  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}

// ---------------- session (wallet sign-in) ----------------
type SessionCtx = {
  wallet: string | null; // signed-in wallet (server session)
  signingIn: boolean;
  signIn: () => Promise<string | null>;
  signOut: () => Promise<void>;
};
const Session = createContext<SessionCtx>({ wallet: null, signingIn: false, signIn: async () => null, signOut: async () => {} });
export const useSession = () => useContext(Session);

function SessionProvider({ children }: { children: ReactNode }) {
  const { publicKey, signMessage } = useWallet();
  const [wallet, setWallet] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((j) => setWallet(j.wallet ?? null))
      .catch(() => {});
  }, []);

  const signIn = useCallback(async () => {
    if (!publicKey || !signMessage) return null;
    const pk = publicKey.toBase58();
    if (wallet === pk) return pk;
    setSigningIn(true);
    try {
      const { message, issuedAt } = await fetch(`/api/auth?wallet=${pk}`).then((r) => r.json());
      const sig = await signMessage(new TextEncoder().encode(message));
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: pk, issuedAt, signature: bs58.encode(sig) }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setWallet(pk);
      return pk;
    } finally {
      setSigningIn(false);
    }
  }, [publicKey, signMessage, wallet]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setWallet(null);
  }, []);

  // A different wallet connected → the old session doesn't apply.
  const effective = wallet && publicKey && wallet !== publicKey.toBase58() ? null : wallet;
  return <Session.Provider value={{ wallet: effective, signingIn, signIn, signOut }}>{children}</Session.Provider>;
}

// ---------------- connect (wallet picker, or install help when none is detected) ----------------
const Connect = createContext<() => void>(() => {});
export const useConnectWallet = () => useContext(Connect);

function ConnectProvider({ children }: { children: ReactNode }) {
  const { wallets } = useWallet();
  const { setVisible } = useWalletModal();
  const [noWallet, setNoWallet] = useState(false);
  const connect = useCallback(() => {
    if (wallets.some((w) => w.readyState === WalletReadyState.Installed)) setVisible(true);
    else setNoWallet(true);
  }, [wallets, setVisible]);
  const close = useCallback(() => setNoWallet(false), []);
  return (
    <Connect.Provider value={connect}>
      {children}
      {noWallet && <NoWalletDialog onClose={close} />}
    </Connect.Provider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const wallets = useMemo(() => [], []); // Phantom & co. register via Wallet Standard
  return (
    <ThemeProvider>
      <ConnectionProvider endpoint={RPC_URL} config={{ commitment: "confirmed" }}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <ConnectProvider>
              <SessionProvider>{children}</SessionProvider>
            </ConnectProvider>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </ThemeProvider>
  );
}
