export interface AnalysisRequest {
  cvText: string;
  jdText: string;
  language?: 'vi' | 'en';
}

export interface SkillRequirement {
  skill: string;
  importance: 'required' | 'preferred';
  matched: boolean;
  jdEvidence: string;
  cvEvidence: string;
  reason: string;
}

export interface CoachingItem {
  skill: string;
  advice: string;
}

export interface AnalysisResult {
  analysisId: string;
  fitScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  summary: string;
  coaching: {
    beforeInterview: CoachingItem[];
    improvements: CoachingItem[];
    strengths: CoachingItem[];
  };
  requirements: SkillRequirement[];
  scoreBreakdown: {
    matchedWeight: number;
    totalWeight: number;
    required: { matched: number; total: number; weight: 2 };
    preferred: { matched: number; total: number; weight: 1 };
  };
  meta: {
    provider: 'gemini';
    model: string;
    scoringVersion: 'weighted-skills-v1';
    language: 'vi' | 'en';
    generatedAt: string;
  };
}

export class AnalysisApiError extends Error {
  code: string;
  status: number;
  details?: Record<string, string>;
  constructor(code: string, message: string, status: number, details?: Record<string, string>);
}

export function createAnalysisClient(options?: {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}): (input: AnalysisRequest, options?: { signal?: AbortSignal }) => Promise<AnalysisResult>;
