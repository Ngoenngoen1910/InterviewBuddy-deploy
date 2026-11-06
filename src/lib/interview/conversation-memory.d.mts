import type { InterviewerInput } from './interviewer-contract.mjs';
export const CONVERSATION_MEMORY_VERSION: string;
export const RECENT_TURN_LIMIT: number;
export const SUMMARY_CHARACTER_LIMIT: number;
export function buildConversationMemory(history: InterviewerInput['history']): {
  completedTurns: InterviewerInput['history'];
  conversationSummary: null | {
    version: string; source: string; earlierTurnCount: number;
    coverage: Array<{ topic: string; mainQuestions: number; followUps: number }>;
    coverageClipped: boolean;
    excerpts: Array<{ turn: number; question: string; answer: string; clipped: boolean }>;
    omittedExcerptCount: number;
  };
};
