"use client";

import { useState, type ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Alert, Button, Card, inputCls } from "./ui";

export type Feature = { icon: string; title: string; body: string };

export function ComingSoon({
  page,
  eyebrow,
  title,
  lede,
  art,
  features,
  flow,
  extra,
}: {
  page: "stake" | "sponsor";
  eyebrow: string;
  title: ReactNode;
  lede: ReactNode;
  art: ReactNode;
  features: Feature[];
  flow: { title: string; body: string }[];
  extra?: ReactNode;
}) {
  const { publicKey } = useWallet();
  const [contact, setContact] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [count, setCount] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function notify() {
    const value = contact.trim() || publicKey?.toBase58() || "";
    if (!value) return setErr("Enter an email, or connect a wallet");
    setState("busy");
    setErr(null);
    try {
      const r = await fetch("/api/notify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ page, contact: value }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setCount(j.count);
      setState("done");
      try {
        localStorage.setItem(`notify-${page}`, value);
      } catch {}
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setState("idle");
    }
  }

  return (
    <div>
      <section className="hero-glow relative overflow-hidden">
        <div className="grid-lines pointer-events-none absolute inset-0" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 md:grid-cols-2 md:py-20">
          <div className="rise">
            <div className="inline-flex items-center gap-2 rounded-full border border-flame/30 bg-flame/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-flame">
              ● Coming soon
            </div>
            <div className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-muted">{eyebrow}</div>
            <h1 className="font-display mt-2 text-5xl font-extrabold leading-[0.95] md:text-6xl">{title}</h1>
            <p className="mt-5 max-w-xl text-lg text-muted">{lede}</p>
            <div className="mt-7 flex max-w-md flex-col gap-2 sm:flex-row">
              {state === "done" ? (
                <Alert tone="alive" className="w-full">
                  You&apos;re on the list ✓ {count ? `(${count} waiting)` : ""} We&apos;ll ping you at launch.
                </Alert>
              ) : (
                <>
                  <input className={inputCls} placeholder={publicKey ? "Email (or leave blank to use wallet)" : "you@email.com"} value={contact} onChange={(e) => setContact(e.target.value)} />
                  <Button size="lg" onClick={notify} loading={state === "busy"}>
                    🔔 Notify me
                  </Button>
                </>
              )}
            </div>
            {err && <p className="mt-2 text-sm text-out">{err}</p>}
          </div>
          <div className="relative">{art}</div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <Card key={f.title} className="p-5">
              <div className="text-3xl">{f.icon}</div>
              <h3 className="font-display mt-3 text-lg font-bold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="font-display text-2xl font-extrabold sm:text-3xl">How it will work</h2>
        <ol className="mt-6 grid gap-3 md:grid-cols-4">
          {flow.map((s, i) => (
            <li key={s.title} className="relative rounded-3xl border border-line bg-surface p-5">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-ink text-sm font-bold text-bg">{i + 1}</div>
              <div className="font-display mt-3 font-bold">{s.title}</div>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
              {i < flow.length - 1 && <div className="absolute -right-3 top-9 hidden text-muted md:block">→</div>}
            </li>
          ))}
        </ol>
        {extra}
      </section>
    </div>
  );
}
