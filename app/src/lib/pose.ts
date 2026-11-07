// Pose derivation — identical to `pose_from_hash` in the program, so anyone can
// recompute the pose from the window's slot hash.

export const DIRECTIONS = ["left", "right", "up", "at the camera"] as const;
export const EXTRAS = ["smile", "thumbs up (other hand)", "other hand on head", "peace sign (other hand)"] as const;
export const EXTRA_SHORT = ["smile", "thumbs up", "hand on head", "peace sign"] as const;

export type Pose = { fingers: number; direction: number; extra: number };

export function poseFromHash(hash: Uint8Array): Pose {
  return { fingers: (hash[0] % 5) + 1, direction: hash[1] % 4, extra: hash[2] % 4 };
}

/** Check-out fallback used when the check-out pose would repeat the check-in pose. */
export function altPoseFromHash(hash: Uint8Array, prev: Pose): Pose {
  const p = { fingers: (hash[3] % 5) + 1, direction: hash[4] % 4, extra: hash[5] % 4 };
  if (samePose(p, prev)) p.extra = (p.extra + 1) % 4;
  return p;
}

export function samePose(a: Pose, b: Pose) {
  return a.fingers === b.fingers && a.direction === b.direction && a.extra === b.extra;
}

export function poseFromArray(a: number[] | Uint8Array): Pose {
  return { fingers: a[0], direction: a[1], extra: a[2] };
}

export function describePose(p: Pose): string {
  const f = `${p.fingers} finger${p.fingers > 1 ? "s" : ""}`;
  return `Show ${f} + point ${DIRECTIONS[p.direction]} + ${EXTRA_SHORT[p.extra]}`;
}

/** Wording given to the AI judge. */
export function poseForJudge(p: Pose): string {
  return [
    `One hand holds up exactly ${p.fingers} finger${p.fingers > 1 ? "s" : ""} (count raised fingers, thumb counts as a finger only if clearly raised as part of the count).`,
    `The raised fingers point ${DIRECTIONS[p.direction]}${p.direction === 3 ? " (toward the lens)" : " from the person's perspective or the camera's — accept either"}.`,
    p.extra === 0
      ? "The person is visibly smiling."
      : p.extra === 1
        ? "The person's other hand gives a thumbs up."
        : p.extra === 2
          ? "The person's other hand rests on top of their head."
          : "The person's other hand makes a peace (V) sign.",
  ].join(" ");
}

export function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToHex(b: Uint8Array | number[]): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** Random pages for the reading proof (stretch), derived from the same hash. */
export function pagesFromHash(hash: Uint8Array, from: number, to: number, count = 2): number[] {
  const span = Math.max(1, to - from + 1);
  const pages: number[] = [];
  for (let i = 0; pages.length < Math.min(count, span) && i < 16; i++) {
    const n = from + (((hash[6 + i * 2] << 8) | hash[7 + i * 2]) % span);
    if (!pages.includes(n)) pages.push(n);
  }
  return pages.sort((a, b) => a - b);
}
