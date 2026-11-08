// Browser + server: canonical JSON and SHA-256 of the proof plan (stored onchain as config_hash).

export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .filter((k) => o[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The exact rules object that gets hashed onchain. */
export type ChallengeRules = {
  v: 1;
  title: string;
  habit: string;
  proofType: string;
  rule: string;
  strength: string;
  windowStartHour: number;
  windowEndHour: number;
  windowMinutes: number;
  minXp?: number;
  minGapSecs?: number;
  /** Photos needed per day (only present when > 1). */
  perDay?: number;
  gym?: { lat: number; lng: number; radiusM: number; label?: string };
};
