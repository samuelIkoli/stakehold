"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, inputCls } from "./ui";
import { useSession } from "./providers";

type Link = { username: string; code: string; verified: boolean };

/** Ownership check: paste a one-time code into your public Duolingo bio. */
export function DuolingoLink({ onVerified }: { onVerified?: (username: string) => void }) {
  const { wallet, signIn } = useSession();
  const [link, setLink] = useState<Link | null>(null);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "out" | "alive" | "neutral"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!wallet) return;
    fetch("/api/duolingo/link")
      .then((r) => r.json())
      .then((j) => {
        if (j.link) {
          setLink(j.link);
          setUsername(j.link.username);
          if (j.link.verified) onVerified?.(j.link.username);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet]);

  async function call(method: "POST" | "PUT", body?: unknown) {
    const r = await fetch("/api/duolingo/link", { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    return j;
  }

  async function start() {
    setBusy("start");
    setMsg(null);
    try {
      if (!wallet) await signIn();
      const j = await call("POST", { username });
      setLink(j.link);
      setMsg({ tone: "neutral", text: `Found ${j.link.username}: ${j.profile.totalXp.toLocaleString()} XP.` });
    } catch (e) {
      setMsg({ tone: "out", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  }

  async function verify() {
    setBusy("verify");
    setMsg(null);
    try {
      const j = await call("PUT");
      setLink(j.link);
      setMsg({ tone: "alive", text: "Verified ✅ You can remove the code from your bio now." });
      onVerified?.(j.link.username);
    } catch (e) {
      setMsg({ tone: "out", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  }

  async function fromScreenshot(file: File) {
    setBusy("shot");
    setMsg(null);
    try {
      if (!wallet) await signIn();
      const fd = new FormData();
      fd.append("image", file);
      const r = await fetch("/api/duolingo/screenshot", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if (j.username) {
        setUsername(j.username);
        setMsg({ tone: "neutral", text: `Read "${j.username}" from your screenshot — check it and continue.` });
      } else setMsg({ tone: "out", text: "Couldn't read a username from that screenshot." });
    } catch (e) {
      setMsg({ tone: "out", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  }

  if (link?.verified)
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-xl">🦉</span>
        <span className="font-semibold">{link.username}</span>
        <Badge tone="alive">verified</Badge>
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className={inputCls} placeholder="Duolingo username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <Button variant="secondary" onClick={start} loading={busy === "start"} disabled={!username.trim()}>
          {link ? "Get new code" : "Get my code"}
        </Button>
      </div>
      <button onClick={() => fileRef.current?.click()} className="text-xs font-semibold text-muted hover:text-ink">
        {busy === "shot" ? "Reading screenshot…" : "📷 Or upload a profile screenshot to pre-fill your username"}
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && fromScreenshot(e.target.files[0])} />
      {link && !link.verified && (
        <div className="rounded-2xl border border-line bg-surface-2 p-4">
          <div className="text-sm">
            1. Open Duolingo → Profile → Edit profile, and paste this into your <b>bio</b>:
          </div>
          <div className="mt-2 flex items-center gap-2">
            <code className="rounded-xl bg-ink px-3 py-2 font-mono text-lg font-bold tracking-wider text-gold">{link.code}</code>
            <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(link.code)}>
              Copy
            </Button>
          </div>
          <div className="mt-2 text-sm">2. Make sure your profile is public, then:</div>
          <Button size="sm" className="mt-2" onClick={verify} loading={busy === "verify"}>
            I&apos;ve added it — verify
          </Button>
        </div>
      )}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <p className="text-[11px] text-muted">Screenshots only help pre-fill your username — they&apos;re never accepted as daily proof.</p>
    </div>
  );
}
