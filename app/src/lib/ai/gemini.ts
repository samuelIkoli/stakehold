// Minimal Gemini REST client (no SDK). Picks a current Flash model automatically
// unless GEMINI_MODEL is set, because model names change often.
import type { AiProvider, GenerateRequest } from "./types";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

let pickedModel: string | undefined;

function key() {
  const k = process.env.GEMINI_API_KEY;
  if (!k || k.startsWith("PASTE_")) throw new Error("GEMINI_API_KEY is not set in .env.local");
  return k;
}

async function pickModel(): Promise<string> {
  if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;
  if (pickedModel) return pickedModel;
  try {
    const res = await fetch(`${BASE}/models?pageSize=200`, { headers: { "x-goog-api-key": key() } });
    const json = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
    const names = (json.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""));
    const score = (n: string) => {
      const m = n.match(/^gemini-(\d+(?:\.\d+)?)-flash(.*)$/);
      if (!m) return -1;
      const version = parseFloat(m[1]);
      const suffix = m[2];
      if (/lite|image|tts|live|audio|thinking/.test(suffix)) return -1;
      // Prefer stable names, then "-latest", then previews.
      const stability = suffix === "" ? 0.3 : suffix.includes("latest") ? 0.2 : 0.1;
      return version + stability;
    };
    const best = names.map((n) => [n, score(n)] as const).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1])[0];
    pickedModel = best?.[0] ?? (names.includes("gemini-flash-latest") ? "gemini-flash-latest" : "gemini-2.5-flash");
  } catch {
    pickedModel = "gemini-2.5-flash";
  }
  console.log(`[ai] using Gemini model ${pickedModel}`);
  return pickedModel;
}

export const gemini: AiProvider = {
  name: "gemini",
  async model() {
    return pickModel();
  },
  async generateJson<T>(req: GenerateRequest): Promise<T> {
    const model = await pickModel();
    const parts: unknown[] = [];
    for (const m of req.media ?? []) parts.push({ inline_data: { mime_type: m.mimeType, data: m.base64 } });
    parts.push({ text: req.prompt });
    const body = {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: req.temperature ?? 0.1,
        responseMimeType: "application/json",
        ...(req.schema ? { responseSchema: req.schema } : {}),
      },
    };
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${BASE}/models/${model}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": key() },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(`Gemini ${res.status}: ${json?.error?.message ?? "error"}`);
        const text: string | undefined = json?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? "")
          .join("");
        if (!text) throw new Error(`Gemini returned no content (${json?.candidates?.[0]?.finishReason ?? "unknown"})`);
        return JSON.parse(text.replace(/^```json\s*|```$/g, "")) as T;
      } catch (e) {
        lastErr = e;
        if (String(e).includes("GEMINI_API_KEY")) throw e;
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
    throw lastErr;
  },
};
