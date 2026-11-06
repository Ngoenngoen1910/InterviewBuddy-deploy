import type { Difficulty, DurationMinutes, InterviewLanguage, InterviewType, SessionStatus } from './session-contract.mjs';

export type InterviewAction = 'follow_up' | 'next_topic' | 'end';
export interface InterviewerInput {
  settings: {
    type: InterviewType; difficulty: Difficulty; language: InterviewLanguage;
    targetPosition: string; durationMinutes: DurationMinutes; plannedQuestions: number;
  };
  state: { status: SessionStatus; elapsedSeconds: number };
  jdText?: string | null;
  cvText?: string | null;
  history: Array<{ kind: 'main' | 'follow_up'; topic: string; question: string; answer: string }>;
}
export type InterviewDecision =
  | { action: 'follow_up' | 'next_topic'; question: string; topic: string; reason: string }
  | { action: 'end'; question: null; topic: string; reason: string };
export interface InterviewPolicy {
  allowedActions: InterviewAction[];
  endReason: 'session_closed' | 'time_limit' | 'question_limit' | null;
  mainQuestionsAnswered: number; followUpsForCurrent: number; maxFollowUps: number;
}
export class InterviewerError extends Error {
  code: string; status: number;
  constructor(code: string, message: string, status?: number);
}
export const CONTRACT_VERSION: string;
export const FOLLOW_UP_LIMITS: Readonly<Record<Difficulty, number>>;
export const INTERVIEW_LIMITS: Readonly<Record<'jd' | 'cv' | 'answer' | 'history' | 'total', number>>;
export const INTERVIEWER_OUTPUT_SCHEMA: Record<string, unknown>;
export function normalizeQuestion(value: string): string;
export function validateInterviewerInput(value: unknown): InterviewerInput & { jdText: string; cvText: string };
/** Call with already-validated input. */
export function getInterviewPolicy(input: InterviewerInput): InterviewPolicy;
export function validateInterviewerOutput(value: unknown, input: InterviewerInput): InterviewDecision;
export function createEndDecision(input: InterviewerInput): Extract<InterviewDecision, { action: 'end' }> | null;
