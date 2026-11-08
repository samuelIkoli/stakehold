// Demo bot wallets (devnet only). Keys live in keys/demo-bots.json (git-ignored), or BOTS_FILE when hosted.
import fs from "node:fs";
import path from "node:path";
import { Keypair } from "@solana/web3.js";

const FILE = process.env.BOTS_FILE || path.resolve(process.cwd(), "..", "keys", "demo-bots.json");

export const BOT_NAMES = ["Ada", "Kofi", "Mei", "Tunde", "Zara"];

let cache: Keypair[] | undefined;

export function loadBots(count = 4): Keypair[] {
  if (!cache) {
    try {
      cache = (JSON.parse(fs.readFileSync(FILE, "utf8")) as number[][]).map((s) => Keypair.fromSecretKey(Uint8Array.from(s)));
    } catch {
      cache = [];
    }
  }
  if (cache.length < count) {
    while (cache.length < count) cache.push(Keypair.generate());
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(cache.map((k) => Array.from(k.secretKey))));
  }
  return cache.slice(0, count);
}

export function botKeypair(wallet: string): Keypair | undefined {
  return loadBots(BOT_NAMES.length).find((k) => k.publicKey.toBase58() === wallet);
}
