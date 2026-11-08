import { z } from "zod";
import { db } from "@/lib/db";
import { errorResponse, HttpError, requireWallet } from "@/lib/server/auth";
import { fetchDuolingo, makeLinkCode } from "@/lib/duolingo";
import { attachDuolingo } from "@/lib/server/game";

export async function GET() {
  try {
    const wallet = await requireWallet();
    const link = await db.duoLink.findUnique({ where: { wallet } });
    // An account verified earlier also covers challenges joined since.
    if (link?.verified) await attachDuolingo(wallet, link.username);
    return Response.json({ link });
  } catch (e) {
    return errorResponse(e);
  }
}

const Start = z.object({ username: z.string().min(1).max(60) });

/** Step 1: choose a username → get a one-time code to paste into the Duolingo bio. */
export async function POST(req: Request) {
  try {
    const wallet = await requireWallet();
    const { username } = Start.parse(await req.json());
    const prof = await fetchDuolingo(username);
    if (!prof) throw new HttpError(404, "No public Duolingo profile with that username");
    const taken = await db.duoLink.findFirst({ where: { username: prof.username, verified: true, NOT: { wallet } } });
    if (taken) throw new HttpError(409, "That Duolingo account is already linked to another wallet");
    const code = makeLinkCode();
    const link = await db.duoLink.upsert({
      where: { wallet },
      create: { wallet, username: prof.username, userId: String(prof.id), code },
      update: { username: prof.username, userId: String(prof.id), code, verified: false, verifiedAt: null },
    });
    return Response.json({ link, profile: { totalXp: prof.totalXp, streak: prof.streak } });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Step 2: we read the public profile and look for the code in the bio. */
export async function PUT() {
  try {
    const wallet = await requireWallet();
    const link = await db.duoLink.findUnique({ where: { wallet } });
    if (!link) throw new HttpError(400, "Start linking first");
    const prof = await fetchDuolingo(link.username);
    if (!prof) throw new HttpError(404, "Profile not found or not public");
    if (!prof.bio.toUpperCase().includes(link.code)) {
      throw new HttpError(400, `Code not found in your bio yet. Your bio currently reads: "${prof.bio.slice(0, 80) || "(empty)"}". Duolingo can take a minute to update.`);
    }
    const updated = await db.duoLink.update({ where: { wallet }, data: { verified: true, verifiedAt: new Date() } });
    await attachDuolingo(wallet, updated.username);
    return Response.json({ link: updated, profile: { totalXp: prof.totalXp, streak: prof.streak } });
  } catch (e) {
    return errorResponse(e);
  }
}
