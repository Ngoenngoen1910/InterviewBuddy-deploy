export class AnalysisError extends Error {
  constructor(code, message, status = 500, details = undefined) {
    super(message);
    this.name = 'AnalysisError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function invalidAiResponse() {
  return new AnalysisError(
    'INVALID_AI_RESPONSE',
    'The AI returned an invalid or unsupported analysis. Please try again.',
    502,
  );
}
