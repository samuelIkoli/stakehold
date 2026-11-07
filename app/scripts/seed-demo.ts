// Seed a demo group challenge with scripted bots (1 day = 2 minutes by default).
//   npm run seed:demo                 # photo challenge, 2 days, 4 bots
//   npm run seed:demo -- duolingo     # 1-day Duolingo demo (no bots)
//   DAY_LEN=90 DAYS=3 npm run seed:demo
import { seedDemo } from "../src/lib/server/demo";

async function main() {
  const kind = process.argv[2] === "duolingo" ? "duolingo" : "photo";
  const r = await seedDemo({
    kind,
    dayLen: process.env.DAY_LEN ? Number(process.env.DAY_LEN) : undefined,
    days: process.env.DAYS ? Number(process.env.DAYS) : undefined,
    leadSecs: process.env.LEAD ? Number(process.env.LEAD) : undefined,
  });
  const base = process.env.APP_URL || "http://localhost:3000";
  console.log(`\nDemo challenge created: ${base}/c/${r.challenge}`);
  console.log(`Starts at ${new Date(r.startTs * 1000).toLocaleTimeString()} · ${r.days} day(s) × ${r.dayLen}s`);
  console.log(`Join it with Phantom before it starts, then open ${base}/demo for the control panel.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
