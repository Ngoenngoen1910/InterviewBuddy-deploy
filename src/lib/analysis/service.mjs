import { randomUUID } from 'node:crypto';
import { validateInput } from './contracts.mjs';
import { createGeminiProvider } from './gemini.mjs';
import { scoreAnalysis, SCORING_VERSION } from './scoring.mjs';

export function createAnalysisService({ provider = createGeminiProvider(), now = () => new Date(), createId = randomUUID } = {}) {
  return async function analyze(value, { signal } = {}) {
    const input = validateInput(value);
    const raw = await provider.analyze(input, { signal });
    const result = scoreAnalysis(raw, input);
    return {
      analysisId: createId(),
      ...result,
      meta: {
        provider: 'gemini',
        model: provider.model,
        scoringVersion: SCORING_VERSION,
        language: input.language,
        generatedAt: now().toISOString(),
      },
    };
  };
}
