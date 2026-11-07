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

export type ProofType = "photo" | "gym" | "duolingo" | "honor";
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
  reframe?: string | null;
  tips: string[];
};
