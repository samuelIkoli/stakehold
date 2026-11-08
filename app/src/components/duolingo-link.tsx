"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, inputCls } from "./ui";
import { useSession } from "./providers";

type Link = { username: string; code: string; verified: boolean };

/**
 * Link a Duolingo username. It works straight away (marked "unverified"); owners can
 * optionally prove it by pasting a one-time code into their public bio for a ✓ badge.
 */
export function DuolingoLink({ onLinked }: { onLinked?: (username: string) => void }) {
  const { wallet, signIn } = useSession();
  const [link, setLink] = useState<Link | null>(null);
  const [editing, setEditing] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
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
          onLinked?.(j.link.username);
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
      setEditing(false);
      setMsg(
        j.conflicts?.length
          ? { tone: "out", text: `Linked, but another player in “${j.conflicts.join("”, “")}” already uses ${j.link.username}. One Duolingo account per player.` }
          : { tone: "alive", text: `Linked ${j.link.username} (${j.profile.totalXp.toLocaleString()} XP).` },
      );
      onLinked?.(j.link.username);
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
      setShowVerify(false);
      onLinked?.(j.link.username);
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

  if (link && !editing)
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xl">🦉</span>
          <span className="font-semibold">{link.username}</span>
          {link.verified ? <Badge tone="alive">verified ✓</Badge> : <Badge>unverified</Badge>}
          <button onClick={() => setEditing(true)} className="text-xs font-semibold text-muted hover:text-ink">
            change
          </button>
          {!link.verified && (
            <button onClick={() => setShowVerify((v) => !v)} className="text-xs font-semibold text-violet hover:underline">
              {showVerify ? "hide" : "verify it's mine (optional)"}
            </button>
          )}
        </div>
        {showVerify && !link.verified && (
          <div className="rounded-2xl border border-line bg-surface-2 p-4">
            <div className="text-sm">
              Optional: for a ✓ badge, open Duolingo → Profile → Edit profile and paste this into your <b>bio</b>:
            </div>
            <div className="mt-2 flex items-center gap-2">
              <code className="rounded-xl bg-ink px-3 py-2 font-mono text-lg font-bold tracking-wider text-gold">{link.code}</code>
              <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(link.code)}>
                Copy
              </Button>
            </div>
            <Button size="sm" className="mt-3" onClick={verify} loading={busy === "verify"}>
              I&apos;ve added it — verify
            </Button>
          </div>
        )}
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className={inputCls} placeholder="Duolingo username" value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === "Enter" && username.trim() && start()} />
        <Button variant="secondary" onClick={start} loading={busy === "start"} disabled={!username.trim()}>
          Link account
        </Button>
      </div>
      <button onClick={() => fileRef.current?.click()} className="text-xs font-semibold text-muted hover:text-ink">
        {busy === "shot" ? "Reading screenshot…" : "📷 Or upload a profile screenshot to pre-fill your username"}
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && fromScreenshot(e.target.files[0])} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <p className="text-[11px] text-muted">Your profile must be public. Linking is instant; you can verify ownership later for a ✓ badge.</p>
    </div>
  );
}
