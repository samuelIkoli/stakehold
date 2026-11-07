// DEMO charity wallets on devnet. These are NOT real charities — they are labelled
// placeholder wallets controlled by the Stakehold team for the hackathon demo.
export const DEMO_CHARITIES = [
  { index: 0, name: "Clean Water Fund (demo wallet)", emoji: "💧", address: "EwSbjYr6cVNbALjX1UaE5Cwe9eXD2vVhvGbxkJaMyj9E" },
  { index: 1, name: "Plant-a-Tree Fund (demo wallet)", emoji: "🌳", address: "7nqCmpCwX4siUtFabntjQgTv7U51xMkW8DEiR5LqS16y" },
  { index: 2, name: "School Supplies Fund (demo wallet)", emoji: "📚", address: "GDiwR1vpvkuPzJT4GsDMn6o3Ut4PZnMRAs1Bp9ip3AVj" },
] as const;

export const SOLO_BONUS_BPS = 1000; // 10% of the community pool per finisher…
export const SOLO_BONUS_CAP_SOL = 0.05; // …capped at 0.05 SOL
