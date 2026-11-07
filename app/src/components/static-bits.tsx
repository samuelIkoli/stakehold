// Server-safe small bits (no "use client").
export const PROOF_LABEL_S: Record<string, string> = {
  photo: "Photo + pose",
  gym: "Gym check-in/out",
  duolingo: "Duolingo",
  honor: "Honor system",
};
export const PROOF_EMOJI_S: Record<string, string> = { photo: "📸", gym: "🏋️", duolingo: "🦉", honor: "🤝" };

export function StrengthChip({ strength }: { strength: string }) {
  const map: Record<string, [string, string]> = {
    strong: ["🛡️ Strong", "bg-alive/10 text-alive border-alive/25"],
    good: ["📸 Good", "bg-violet/10 text-violet border-violet/25"],
    honor: ["🤝 Honor", "bg-gold/15 border-gold/30"],
  };
  const [label, cls] = map[strength] ?? map.good;
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${cls}`}>{label}</span>;
}
