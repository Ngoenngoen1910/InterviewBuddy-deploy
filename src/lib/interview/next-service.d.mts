import type { InterviewDecision, InterviewerInput } from './interviewer-contract.mjs';
export interface NextRequest { sessionId: string; afterAnswerId: string | null }
export interface NextResponse {
  sessionId: string; action: 'follow_up' | 'next_topic' | 'end';
  question: null | { id: string; content: string; topic: string; kind: 'main' | 'follow_up'; position: number };
}
export interface NextRepository {
  claim(request: NextRequest): Promise<Record<string, unknown>>;
  finish(request: NextRequest, token: string, decision: InterviewDecision, metadata: Record<string, string>): Promise<NextResponse>;
  release(request: NextRequest, token: string): Promise<unknown>;
}
export function validateNextRequest(body: unknown): NextRequest;
export function createNextService(options: {
  repository: NextRepository;
  provider: { model: string; next(input: InterviewerInput, options?: { signal?: AbortSignal }): Promise<InterviewDecision> };
  now?: () => number;
}): (body: unknown, options?: { signal?: AbortSignal }) => Promise<NextResponse>;
