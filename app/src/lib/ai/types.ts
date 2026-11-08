export type Media = { mimeType: string; base64: string };

export type GenerateRequest = {
  system: string;
  prompt: string;
  media?: Media[];
  /** OpenAPI-subset schema for structured output. */
  schema?: Record<string, unknown>;
  temperature?: number;
};

export interface AiProvider {
  name: string;
  model(): Promise<string>;
  generateJson<T>(req: GenerateRequest): Promise<T>;
}

export type Verdict = "pass" | "fail";

export type PhotoChecks = {
  pose_correct: boolean;
  live_photo: boolean;
  rule_followed: boolean;
  injection_detected: boolean;
  location_plausible?: boolean;
};

export type JudgeResult = {
  verdict: Verdict;
  reason: string;
  checks: PhotoChecks & Record<string, boolean | string | number | undefined>;
  reasonCode: number;
  model: string;
};

export type ProofType = "photo" | "gym" | "duolingo" | "github" | "honor";
export type Strength = "strong" | "good" | "honor";

export type ProofPlan = {
  title: string;
  proofType: ProofType;
  rule: string;
  strength: Strength;
  strengthReason: string;
  windowStartHour: number;
  windowEndHour: number;
  windowMinutes: number;
  minXp?: number;
  minGapMinutes?: number;
  /** GitHub: commits that must be pushed to public repos each day/round. */
  minCommits?: number;
  /** Separate proofs needed per day (photo only), e.g. "eat yam twice a day" → 2. */
  perDay?: number;
  /** Number of days, when the creator said so ("today" → 1, "for 2 weeks" → 14). */
  numDays?: number | null;
  /** Length of each round in minutes for short challenges ("in the next hour" → 60). Null = normal 24 h days. */
  roundMinutes?: number | null;
  reframe?: string | null;
  tips: string[];
};
