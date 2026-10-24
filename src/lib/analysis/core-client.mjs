// Browser-safe helper for Khang's SCRUM-46. This file never imports server code.
export class AnalysisApiError extends Error {
  constructor(code, message, status, details) {
    super(message);
    this.name = 'AnalysisApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function createAnalysisClient({ baseUrl = '', fetchImpl = globalThis.fetch } = {}) {
  const endpoint = `${baseUrl.replace(/\/$/u, '')}/api/analyze`;
  return async function analyzeCvJd({ cvText, jdText, language = 'vi' }, { signal } = {}) {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cvText, jdText, language }),
      signal,
      cache: 'no-store',
    });
    let result;
    try { result = await response.json(); } catch {
      throw new AnalysisApiError('INVALID_RESPONSE', 'The server returned an invalid response.', response.status);
    }
    if (!response.ok) {
      throw new AnalysisApiError(
        result?.error?.code || 'API_ERROR', result?.error?.message || 'Analysis failed.', response.status, result?.error?.details,
      );
    }
    if (!result || !Number.isFinite(result.fitScore) || result.fitScore < 0 || result.fitScore > 100
        || !Array.isArray(result.matchedSkills) || !result.matchedSkills.every((skill) => typeof skill === 'string')
        || !Array.isArray(result.missingSkills) || !result.missingSkills.every((skill) => typeof skill === 'string')) {
      throw new AnalysisApiError('INVALID_RESPONSE', 'The server returned an invalid analysis.', response.status);
    }
    return result;
  };
}
