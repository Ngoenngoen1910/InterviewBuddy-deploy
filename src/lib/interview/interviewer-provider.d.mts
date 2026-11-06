import type { InterviewDecision, InterviewerInput } from './interviewer-contract.mjs';

/** Import only from server-side code. */
export function createInterviewerProvider(options?: {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}): {
  model: string;
  next(input: InterviewerInput, options?: { signal?: AbortSignal }): Promise<InterviewDecision>;
};
