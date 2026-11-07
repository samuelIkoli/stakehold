import { aiConfigured, aiModelName } from "@/lib/ai";
import { PROGRAM_ID } from "@/lib/solana/constants";
import { connection, crankKeypair, fetchConfig, judgeKeypair, poolBalance } from "@/lib/server/chain";

export async function GET() {
  const conn = connection();
  const safe = async <T,>(f: () => Promise<T>) => {
    try {
      return await f();
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) } as unknown as T;
    }
  };
  const [program, config, judgeBal, crankBal, pool, model] = await Promise.all([
    safe(() => conn.getAccountInfo(PROGRAM_ID).then((a) => !!a?.executable)),
    safe(() => fetchConfig().then((c) => (c ? { judge: c.judge.toBase58(), admin: c.admin.toBase58() } : null))),
    safe(() => conn.getBalance(judgeKeypair().publicKey)),
    safe(() => conn.getBalance(crankKeypair().publicKey)),
    safe(() => poolBalance()),
    aiConfigured() ? safe(() => aiModelName()) : Promise.resolve(null),
  ]);
  return Response.json({
    programId: PROGRAM_ID.toBase58(),
    programDeployed: program,
    config,
    judge: { address: judgeKeypair().publicKey.toBase58(), lamports: judgeBal },
    crank: { address: crankKeypair().publicKey.toBase58(), lamports: crankBal },
    pool,
    ai: { configured: aiConfigured(), model },
  });
}
