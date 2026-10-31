// Types for the Interview Session API. Import these in the Setup page, e.g.
// import type { CreateInterviewRequest } from "@/lib/interview/session-contract.mjs";

export type InterviewType = 'hr' | 'technical' | 'behavioral';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type InterviewLanguage = 'vi' | 'en';
export type DurationMinutes = 15 | 30 | 45;
export type InputMode = 'text' | 'voice';
export type SessionStatus = 'in_progress' | 'completed' | 'abandoned';

/** Body of POST /api/interview. */
export interface CreateInterviewRequest {
  type: InterviewType;
  difficulty: Difficulty;
  language: InterviewLanguage;
  targetPosition: string;
  /** YYYY-MM-DD, today or later. Optional. */
  interviewDate?: string | null;
  durationMinutes: DurationMinutes;
  inputMode: InputMode;
  /** Omit to link the latest saved analysis; null for none. */
  fitAnalysisId?: string | null;
}

/** 201 response of POST /api/interview. */
export interface CreateInterviewResponse {
  sessionId: string;
  fitAnalysisId: string | null;
}

export interface InterviewSettings {
  type: InterviewType;
  difficulty: Difficulty;
  language: InterviewLanguage;
  targetPosition: string | null;
  interviewDate: string | null;
  durationMinutes: DurationMinutes;
  inputMode: InputMode;
  plannedQuestions: number;
}

/** 200 response of GET /api/interview/{id}. */
export interface InterviewSessionResponse {
  id: string;
  status: SessionStatus;
  createdAt: string;
  settings: InterviewSettings;
  analysis: {
    id: string;
    fitScore: number | null;
    language: InterviewLanguage;
    createdAt: string;
    /** The saved /api/analyze-fit response. */
    result: Record<string, unknown>;
  } | null;
}

export type InterviewApiErrorCode =
  | 'BAD_INPUT' | 'UNAUTHORIZED' | 'NOT_FOUND' | 'SERVER_ERROR';

export interface InterviewApiError {
  error: {
    code: InterviewApiErrorCode;
    message: string;
    /** For BAD_INPUT: field name -> problem. */
    fields?: Record<string, string>;
  };
}

export type ValidationResult =
  | { ok: true; value: Required<Omit<CreateInterviewRequest, 'fitAnalysisId'>> & { fitAnalysisId: string | null | undefined } }
  | { ok: false; fields: Record<string, string> };

export const INTERVIEW_TYPES: InterviewType[];
export const DIFFICULTIES: Difficulty[];
export const LANGUAGES: InterviewLanguage[];
export const DURATIONS: DurationMinutes[];
export const INPUT_MODES: InputMode[];
export const QUESTIONS_BY_DURATION: Record<DurationMinutes, number>;
export const TARGET_POSITION_MAX: number;

export function isUuid(value: unknown): value is string;
export function todayInVietnam(now?: Date): string;
export function validateCreateSession(body: unknown, options: { today: string }): ValidationResult;
export function toSessionRow(
  value: Extract<ValidationResult, { ok: true }>['value'],
  context: { userId: string; analysis: { id: string; jd_text: string; cv_text: string } | null },
): Record<string, unknown>;
export function toSessionResponse(row: Record<string, unknown>): InterviewSessionResponse;
