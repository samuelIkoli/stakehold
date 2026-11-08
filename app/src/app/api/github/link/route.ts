import { z } from "zod";
import { db } from "@/lib/db";
import { errorResponse, HttpError, requireWallet } from "@/lib/server/auth";
import { fetchGithubUser } from "@/lib/github";

const Body = z.object({ challengeId: z.string(), username: z.string().min(1).max(39) });

/** Set the GitHub username for this player in a challenge. Not verified (yet): public profile only. */
export async function POST(req: Request) {
  try {
    const wallet = await requireWallet();
    const { challengeId, username } = Body.parse(await req.json());
    const p = await db.participant.findFirst({ where: { challengeId, wallet } });
    if (!p) throw new HttpError(403, "Join the challenge first");
    const gh = await fetchGithubUser(username);
    if (!gh) throw new HttpError(404, "No GitHub user with that username");
    const clash = await db.participant.findFirst({ where: { challengeId, githubUsername: gh.login, NOT: { id: p.id } } });
    if (clash) throw new HttpError(409, "Another player in this challenge already uses that GitHub account");
    await db.participant.update({ where: { id: p.id }, data: { githubUsername: gh.login } });
    return Response.json({ username: gh.login });
  } catch (e) {
    return errorResponse(e);
  }
}
