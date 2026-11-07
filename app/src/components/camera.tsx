"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button } from "./ui";

/**
 * In-app camera only — no gallery upload. Captures a JPEG from the live stream.
 */
export function Camera({ onCapture, disabled }: { onCapture: (blob: Blob, preview: string) => void; disabled?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    (async () => {
      try {
        stop();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setReady(true);
        }
      } catch (e) {
        setError(
          e instanceof Error && e.name === "NotAllowedError"
            ? "Camera permission denied. Allow camera access in your browser settings."
            : `Camera unavailable: ${e instanceof Error ? e.message : e}. On phones, open this page over HTTPS.`,
        );
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [facing, stop]);

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const scale = Math.min(1, 1280 / v.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    const ctx = canvas.getContext("2d")!;
    if (facing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob, canvas.toDataURL("image/jpeg", 0.7));
      },
      "image/jpeg",
      0.88,
    );
  }

  if (error) return <Alert tone="out">{error}</Alert>;
  return (
    <div className="space-y-3">
      <div className="relative aspect-[3/4] overflow-hidden rounded-3xl bg-black sm:aspect-[4/3]">
        <video ref={videoRef} playsInline muted className={`h-full w-full object-cover ${facing === "user" ? "-scale-x-100" : ""}`} />
        {!ready && <div className="absolute inset-0 grid place-items-center text-sm text-white/70">Starting camera…</div>}
        <div className="pointer-events-none absolute inset-3 rounded-2xl border-2 border-white/20" />
        <div className="absolute left-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">● LIVE</div>
      </div>
      <div className="flex gap-2">
        <Button size="lg" className="flex-1" onClick={capture} disabled={!ready || disabled}>
          📸 Take photo
        </Button>
        <Button size="lg" variant="secondary" onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))} aria-label="Switch camera">
          🔄
        </Button>
      </div>
    </div>
  );
}

export function getPosition(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });
}
