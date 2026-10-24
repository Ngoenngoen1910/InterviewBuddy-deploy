// API contract of POST /api/analyze-fit (provider: Hưng, consumer: Khang).
// Source: week-3 guide, section 6. If Hưng changes the JSON shape, update this file first.

export type AnalysisLanguage = "vi" | "en";

export type AnalyzeFitRequest = {
  jd: string; // max 3000 characters
  cv: string; // text extracted from the CV
  language: AnalysisLanguage;
};

export type MatchedSkill = { skill: string; evidence: string };
export type MissingSkill = { skill: string; note: string };

// "partial" is not in the sample JSON yet, but Screen 2 shows "Partial match".
// The UI accepts it so nothing breaks if Hưng adds it.
export type RequirementStatus = "matched" | "partial" | "missing";

export type RequirementRow = {
  requirement: string;
  status: RequirementStatus;
  evidence: string;
};

export type AnalyzeFitResponse = {
  fitScore: number; // 0–100
  matched: MatchedSkill[];
  missing: MissingSkill[];
  requirements: RequirementRow[];
  recommendation: string;
};

export type AnalyzeFitErrorCode =
  | "BAD_INPUT"
  | "RATE_LIMIT"
  | "INVALID_OUTPUT"
  | "SERVER_ERROR"
  | "NETWORK_ERROR"; // client side only: the request never reached the server

export type ApiError = { error: { code: string; message: string } };

export const JD_MAX_CHARS = 3000;
// /api/analyze-fit rejects JD or CV shorter than this (after trimming).
export const MIN_TEXT_CHARS = 30;
export const CV_MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
