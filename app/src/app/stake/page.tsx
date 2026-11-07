import { ComingSoon } from "@/components/coming-soon";
import { StakeArt } from "@/components/art";

export const metadata = { title: "Stake — skill games with real pots · Stakehold" };

export default function StakePage() {
  return (
    <ComingSoon
      page="stake"
      eyebrow="Stakehold Stake"
      title={
        <>
          Skill games. <span className="text-gradient">Real pots.</span>
        </>
      }
      lede="Multiplayer games where every player stakes SOL into an onchain pot and the winner — or the top players — take it. Provably fair: randomness and results are recorded on Solana, payouts are automatic, and nobody can run off with the pot."
      art={<StakeArt className="mx-auto w-full max-w-md" />}
      features={[
        { icon: "🧠", title: "Trivia battles", body: "Quick-fire rounds against friends or strangers. Questions drawn with onchain randomness so nobody gets a head start." },
        { icon: "⚡", title: "Reaction & puzzle duels", body: "Head-to-head reflex tests and logic puzzles. Scores are signed and recorded, so the leaderboard can't be faked." },
        { icon: "🏟️", title: "Tournament brackets", body: "8, 16 or 64 players. Entry fees flow into one escrow; the bracket pays out automatically as rounds finish." },
        { icon: "🤖", title: "AI-opponent matches", body: "Play against an AI with a published difficulty. Free practice mode, or stake to beat it for the pot." },
      ]}
      flow={[
        { title: "Pick a game", body: "Choose a game and entry fee — from tiny amounts, or free practice." },
        { title: "Stake into escrow", body: "Everyone's entry sits in a program-owned vault until the match ends." },
        { title: "Play, provably fair", body: "Seeds come from Solana slot hashes; results are committed onchain." },
        { title: "Auto payout", body: "The program pays the winner (or top 3) instantly. No middleman." },
      ]}
    />
  );
}
