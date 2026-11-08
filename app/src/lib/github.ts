// Public GitHub activity, no account verification (yet). Pushes are counted by the time
// GitHub received them, which (unlike commit dates) can't be backdated.
// Unauthenticated requests are limited to 60/hour per server IP; set GITHUB_TOKEN to raise it.

const API = "https://api.github.com";

function headers(): HeadersInit {
  const h: Record<string, string> = { accept: "application/vnd.github+json", "user-agent": "stakehold-app" };
  if (process.env.GITHUB_TOKEN) h.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

export async function fetchGithubUser(username: string): Promise<{ login: string; id: number } | null> {
  const r = await fetch(`${API}/users/${encodeURIComponent(username.trim())}`, { headers: headers(), signal: AbortSignal.timeout(10000) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(r.status === 403 || r.status === 429 ? "GitHub rate limit reached — try again in a few minutes" : `GitHub ${r.status}`);
  const j = (await r.json()) as { login: string; id: number };
  return { login: j.login, id: j.id };
}

type PushEvent = { id: string; type: string; created_at: string; repo?: { name: string }; payload?: { size?: number; distinct_size?: number; commits?: unknown[] } };

/** Commits pushed to public repos between `from` and `to` (unix seconds). */
export async function countPushedCommits(username: string, from: number, to: number) {
  const events: PushEvent[] = [];
  for (let page = 1; page <= 3; page++) {
    const r = await fetch(`${API}/users/${encodeURIComponent(username)}/events/public?per_page=100&page=${page}`, { headers: headers(), signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(r.status === 403 || r.status === 429 ? "GitHub rate limit reached — try again in a few minutes" : `GitHub ${r.status}`);
    const batch = (await r.json()) as PushEvent[];
    events.push(...batch);
    const oldest = batch[batch.length - 1];
    if (batch.length < 100 || !oldest || Date.parse(oldest.created_at) / 1000 < from) break;
  }
  const pushes = events.filter((e) => {
    const t = Date.parse(e.created_at) / 1000;
    return e.type === "PushEvent" && t >= from && t < to;
  });
  // Newer API payloads may omit commit counts; a push then counts as at least one commit.
  const commits = pushes.reduce((n, e) => n + Math.max(1, e.payload?.distinct_size ?? e.payload?.size ?? e.payload?.commits?.length ?? 1), 0);
  return { pushes: pushes.length, commits, repos: [...new Set(pushes.map((e) => e.repo?.name).filter(Boolean))] as string[], ids: pushes.map((e) => e.id) };
}
