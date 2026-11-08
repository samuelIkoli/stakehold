"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { AddressLink, Badge, Button, Card, PROOF_EMOJI, Stat, TxLink } from "@/components/ui";
import { DuolingoLink } from "@/components/duolingo-link";
import { useConnectWallet, useSession } from "@/components/providers";

type Profile = {
  wallet: string;
  created: number;
  history: {
    challengeId: string;
    title: string;
    proofType: string;
    mode: string;
    stakeLamports: number;
    numDays: number;
    status: string;
    daysPassed: number;
    eliminatedDay: number | null;
    claimTx: string | null;
    challengeStatus: string;
  }[];
};

export default function ProfilePage() {
  const { publicKey } = useWallet();
  const connect = useConnectWallet();
  const { wallet, signIn, signingIn } = useSession();
  const [p, setP] = useState<Profile | null>(null);

  useEffect(() => {
    if (!wallet) return setP(null);
    fetch("/api/profile")
      .then((r) => r.json())
      .then((j) => !j.error && setP(j));
  }, [wallet]);

  if (!publicKey)
    return (
      <Center>
        <div className="text-4xl">👤</div>
        <h1 className="font-display mt-2 text-2xl font-bold">Your profile</h1>
        <p className="mt-1 text-muted">Connect a wallet to see your challenges and linked accounts.</p>
        <Button className="mt-4" onClick={connect}>
          Connect wallet
        </Button>
      </Center>
    );
  if (!wallet)
    return (
      <Center>
        <div className="text-4xl">✍️</div>
        <h1 className="font-display mt-2 text-2xl font-bold">Sign in</h1>
        <p className="mt-1 text-muted">Sign a free message to prove this wallet is yours.</p>
        <Button className="mt-4" onClick={() => signIn()} loading={signingIn}>
          Sign in
        </Button>
      </Center>
    );

  const survived = p?.history.filter((h) => h.status === "survived" || h.status === "claimed").length ?? 0;
  const out = p?.history.filter((h) => h.status === "eliminated").length ?? 0;
  const live = p?.history.filter((h) => h.status === "active").length ?? 0;
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-flame to-violet text-2xl text-white">◎</div>
        <div>
          <h1 className="font-display text-3xl font-extrabold">Profile</h1>
          <AddressLink address={wallet} label={wallet} className="break-all" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Survived" value={`🏆 ${survived}`} />
        <Stat label="Active" value={`🔥 ${live}`} />
        <Stat label="Eliminated" value={out} />
        <Stat label="Created" value={p?.created ?? "…"} />
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_340px]">
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-display text-lg font-bold">Challenge history</h2>
          </div>
          <ul className="divide-y divide-line">
            {p?.history.map((h) => (
              <li key={h.challengeId}>
                <Link href={`/c/${h.challengeId}`} className="flex items-center gap-3 px-5 py-4 hover:bg-surface-2">
                  <span className="text-2xl">{PROOF_EMOJI[h.proofType]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{h.title}</div>
                    <div className="text-xs text-muted">
                      {h.stakeLamports / 1e9} SOL · {h.daysPassed}/{h.numDays} days passed · {h.mode}
                    </div>
                  </div>
                  {h.status === "active" && <Badge tone="flame">🔥 alive</Badge>}
                  {h.status === "eliminated" && <Badge tone="out">out day {h.eliminatedDay}</Badge>}
                  {h.status === "survived" && <Badge tone="alive">claim ready</Badge>}
                  {h.status === "claimed" && <Badge tone="gold">💰 claimed</Badge>}
                </Link>
                {h.claimTx && (
                  <div className="-mt-2 px-5 pb-3 pl-14">
                    <TxLink sig={h.claimTx} label="Payout tx" />
                  </div>
                )}
              </li>
            ))}
            {p && p.history.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-muted">
                No challenges yet.{" "}
                <Link href="/explore" className="font-semibold text-flame">
                  Find one →
                </Link>
              </li>
            )}
          </ul>
        </Card>
        <div className="space-y-6">
          <Card className="p-5">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Linked accounts</div>
            <div className="mt-3 space-y-4">
              <div>
                <div className="mb-2 text-sm font-semibold">Duolingo</div>
                <DuolingoLink />
              </div>
              {[
                ["GitHub", "🐙"],
                ["Strava", "🏃"],
              ].map(([n, e]) => (
                <div key={n} className="flex items-center justify-between rounded-2xl border border-dashed border-line px-4 py-3 text-sm">
                  <span>
                    {e} {n}
                  </span>
                  <Badge>coming soon</Badge>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Completion badges</div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {["🥉", "🥈", "🥇"].map((b, i) => (
                <div key={b} className="grid aspect-square place-items-center rounded-2xl bg-surface-2 text-3xl opacity-40 grayscale">
                  {b}
                  <span className="sr-only">badge {i}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              Coming soon: onchain completion badges for every challenge you survive. For now, your Participant account with status <i>survived/claimed</i> is your permanent
              onchain record.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">{children}</div>;
}
