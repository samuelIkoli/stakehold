// Minimal Gemini REST client (no SDK). Picks a current Flash model automatically
// unless GEMINI_MODEL is set, because model names change often.
import type { AiProvider, GenerateRequest } from "./types";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

let ranked: string[] | undefined;
let preferred: string | undefined; // last model that answered

const FALLBACKS = ["gemini-3.5-flash", "gemini-3-flash-preview", "gemini-3.5-flash-lite", "gemini-flash-latest"];
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 20000);

function key() {
  const k = process.env.GEMINI_API_KEY;
  if (!k || k.startsWith("PASTE_")) throw new Error("GEMINI_API_KEY is not set in .env.local");
  return k;
}

/** Candidate models, best first. GEMINI_MODEL (if set) goes first, then the newest Flash models. */
async function candidates(): Promise<string[]> {
  if (!ranked) {
    let names: string[] = [];
    try {
      const res = await fetch(`${BASE}/models?pageSize=200`, { headers: { "x-goog-api-key": key() }, signal: AbortSignal.timeout(10000) });
      const json = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
      names = (json.models ?? [])
        .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m) => m.name.replace(/^models\//, ""));
    } catch {}
    const score = (n: string) => {
      const m = n.match(/^gemini-(\d+(?:\.\d+)?)-flash(.*)$/);
      if (!m) return -1;
      const suffix = m[2];
      if (/lite|image|tts|live|audio|thinking/.test(suffix)) return -1;
      // Prefer stable names, then "-latest", then previews.
      return parseFloat(m[1]) + (suffix === "" ? 0.3 : suffix.includes("latest") ? 0.2 : 0.1);
    };
    const best = names.map((n) => [n, score(n)] as const).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).map(([n]) => n);
    ranked = [...new Set([...best.slice(0, 3), ...FALLBACKS.filter((f) => !names.length || names.includes(f))])];
    console.log(`[ai] Gemini models, in order: ${ranked.join(", ")}`);
  }
  const list = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL, ...ranked] : ranked;
  return [...new Set(preferred ? [preferred, ...list] : list)];
}

/** Errors worth trying another model for: overloaded, rate-limited, missing, or too slow. */
const retryable = (e: unknown) => /Gemini (404|429|500|503|504)|timeout|aborted|no content|fetch failed/i.test(String(e));

export const gemini: AiProvider = {
  name: "gemini",
  async model() {
    return (await candidates())[0];
  },
  async generateJson<T>(req: GenerateRequest): Promise<T> {
    const parts: unknown[] = [];
    for (const m of req.media ?? []) parts.push({ inline_data: { mime_type: m.mimeType, data: m.base64 } });
    parts.push({ text: req.prompt });
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: req.temperature ?? 0.1,
        responseMimeType: "application/json",
        ...(req.schema ? { responseSchema: req.schema } : {}),
      },
    });
    let lastErr: unknown;
    for (const model of (await candidates()).slice(0, 4)) {
      try {
        const res = await fetch(`${BASE}/models/${model}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": key() },
          body,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(`Gemini ${res.status}: ${json?.error?.message ?? "error"}`);
        const text: string | undefined = json?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? "")
          .join("");
        if (!text) throw new Error(`Gemini returned no content (${json?.candidates?.[0]?.finishReason ?? "unknown"})`);
        const out = JSON.parse(text.replace(/^```json\s*|```$/g, "")) as T;
        if (preferred !== model) console.log(`[ai] answered by ${model}`);
        preferred = model;
        lastModel = model;
        return out;
      } catch (e) {
        lastErr = e;
        console.warn(`[ai] ${model} failed: ${String(e).slice(0, 160)}`);
        if (String(e).includes("GEMINI_API_KEY") || !retryable(e)) throw e;
        if (preferred === model) preferred = undefined;
      }
    }
    throw lastErr;
  },
};

/** The model that produced the most recent answer (for display on verdicts). */
export let lastModel: string | undefined;
