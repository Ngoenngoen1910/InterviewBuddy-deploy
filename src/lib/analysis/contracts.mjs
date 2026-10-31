import { AnalysisError } from './errors.mjs';

export const LIMITS = Object.freeze({
  minCvCharacters: 30,
  maxCvCharacters: 50000,
  minJdCharacters: 30,
  maxJdCharacters: 30000,
  maxBodyBytes: 400000,
  maxRequirements: 40,
});

export function validateInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AnalysisError('VALIDATION_ERROR', 'Request must be a JSON object.', 400);
  }
  const errors = {};
  const allowed = new Set(['cvText', 'jdText', 'language']);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    errors.body = 'Only cvText, jdText and language are supported.';
  }
  const cvText = typeof value.cvText === 'string' ? value.cvText.trim() : '';
  const jdText = typeof value.jdText === 'string' ? value.jdText.trim() : '';
  const language = value.language === undefined ? 'vi' : value.language;
  if (cvText.length < LIMITS.minCvCharacters || cvText.length > LIMITS.maxCvCharacters) {
    errors.cvText = `Must contain ${LIMITS.minCvCharacters}-${LIMITS.maxCvCharacters} characters after trimming.`;
  }
  if (jdText.length < LIMITS.minJdCharacters || jdText.length > LIMITS.maxJdCharacters) {
    errors.jdText = `Must contain ${LIMITS.minJdCharacters}-${LIMITS.maxJdCharacters} characters after trimming.`;
  }
  if (!['vi', 'en'].includes(language)) errors.language = 'Must be vi or en.';
  if (Object.keys(errors).length) {
    throw new AnalysisError('VALIDATION_ERROR', 'Please check the request fields.', 400, errors);
  }
  return { cvText, jdText, language };
}

// Keep this schema small: Gemini supports a subset of JSON Schema.
export const GEMINI_ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    requirements: {
      type: 'array',
      // Enforce the limit in scoring.mjs. A maxItems constraint here can
      // exceed Gemini's structured-output grammar complexity budget.
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          skill: { type: 'string', description: 'One distinct job skill, without synonyms repeated as separate requirements.' },
          importance: { type: 'string', enum: ['required', 'preferred'] },
          matched: { type: 'boolean' },
          jdEvidence: { type: 'string', description: 'A short, exact quotation from the JD supporting this requirement.' },
          cvEvidence: { type: 'string', description: 'An exact CV quotation supporting the match; empty string when unmatched.' },
          reason: { type: 'string', description: 'Short explanation in the requested response language.' },
        },
        required: ['skill', 'importance', 'matched', 'jdEvidence', 'cvEvidence', 'reason'],
      },
    },
    summary: { type: 'string', description: 'A short skills-gap summary in the requested language; do not include a numeric score.' },
    coaching: {
      type: 'object',
      additionalProperties: false,
      properties: {
        beforeInterview: {
          type: 'array',
          items: {
            type: 'object', additionalProperties: false,
            properties: {
              skill: { type: 'string' },
              advice: { type: 'string', description: 'Two or three technically specific sentences: concept to review, practical exercise with an observable result, and interview discussion point.' },
            },
            required: ['skill', 'advice'],
          },
        },
        improvements: {
          type: 'array',
          items: {
            type: 'object', additionalProperties: false,
            properties: { skill: { type: 'string' }, advice: { type: 'string' } },
            required: ['skill', 'advice'],
          },
        },
        strengths: {
          type: 'array',
          items: {
            type: 'object', additionalProperties: false,
            properties: {
              skill: { type: 'string' },
              advice: { type: 'string', description: 'Two or three technical sentences grounded in proven CV skills; make unsupported details questions or conditional preparation, and do not quote or cite the CV.' },
            },
            required: ['skill', 'advice'],
          },
        },
      },
      required: ['beforeInterview', 'improvements', 'strengths'],
    },
  },
  required: ['requirements', 'summary', 'coaching'],
};
