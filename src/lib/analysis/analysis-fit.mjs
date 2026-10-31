// Adapter for the request/response contract already used by Khang's analysis page.
// The Gemini call and weighted scoring remain in the shared analysis service.
import { AnalysisError } from './errors.mjs';
import { LIMITS, validateInput } from './contracts.mjs';
import { createAnalysisHandler } from './http.mjs';

const JD_UI_MAX_CHARS = 3000;

export function normalizeFitInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AnalysisError('BAD_INPUT', 'JD hoặc CV không hợp lệ.', 400);
  }
  const details = {};
  if (Object.keys(value).some((key) => !['cv', 'jd', 'language'].includes(key))) {
    details.body = 'Chỉ hỗ trợ cv, jd và language.';
  }
  const cv = typeof value.cv === 'string' ? value.cv.trim() : '';
  const jd = typeof value.jd === 'string' ? value.jd.trim() : '';
  const language = value.language === undefined ? 'vi' : value.language;
  if (cv.length < LIMITS.minCvCharacters || cv.length > LIMITS.maxCvCharacters) {
    details.cv = `CV cần ${LIMITS.minCvCharacters}-${LIMITS.maxCvCharacters} ký tự.`;
  }
  if (jd.length < LIMITS.minJdCharacters || jd.length > JD_UI_MAX_CHARS) {
    details.jd = `JD cần ${LIMITS.minJdCharacters}-${JD_UI_MAX_CHARS} ký tự.`;
  }
  if (language !== 'vi' && language !== 'en') details.language = 'Chọn vi hoặc en.';
  if (Object.keys(details).length) {
    throw new AnalysisError('BAD_INPUT', 'JD hoặc CV đang trống hoặc quá dài. Vui lòng kiểm tra lại.', 400, details);
  }
  return validateInput({ cvText: cv, jdText: jd, language });
}

export function formatFitResult(result, input) {
  const requirements = result.requirements.map((item) => ({
    requirement: item.skill,
    status: item.matched ? 'matched' : 'missing',
    evidence: item.cvEvidence,
  }));
  const matched = result.requirements.filter((item) => item.matched)
    .map((item) => ({ skill: item.skill, evidence: item.cvEvidence }));
  const missing = result.requirements.filter((item) => !item.matched)
    .map((item) => ({ skill: item.skill, note: item.reason }));
  const missingNames = missing.slice(0, 3).map((item) => item.skill).join(', ');
  const recommendation = input.language === 'en'
    ? (missing.length
      ? `Add evidence for ${missingNames} to your CV or practise these skills before the interview.`
      : 'Prepare concrete project examples to explain the skills shown in your CV.')
    : (missing.length
      ? `Hãy bổ sung minh chứng về ${missingNames} vào CV hoặc luyện tập các kỹ năng này trước buổi phỏng vấn.`
      : 'Hãy chuẩn bị ví dụ dự án cụ thể để giải thích các kỹ năng đã thể hiện trong CV.');
  return { fitScore: result.fitScore, matched, missing, requirements, recommendation, coaching: result.coaching };
}

export function formatFitError(error, status) {
  let code = 'SERVER_ERROR';
  if ([400, 413, 415].includes(status) || error.code === 'NO_JOB_REQUIREMENTS') code = 'BAD_INPUT';
  else if (status === 429) code = 'RATE_LIMIT';
  else if (error.code === 'INVALID_AI_RESPONSE' || error.code === 'AI_CONTENT_BLOCKED') code = 'INVALID_OUTPUT';
  const messages = {
    BAD_INPUT: 'JD hoặc CV không hợp lệ. Vui lòng kiểm tra lại.',
    RATE_LIMIT: 'AI đang quá tải. Vui lòng thử lại sau.',
    INVALID_OUTPUT: 'AI chưa tạo được kết quả hợp lệ. Vui lòng thử lại.',
    SERVER_ERROR: 'Không thể phân tích lúc này. Vui lòng thử lại sau.',
  };
  const message = error.code === 'AI_TIMEOUT'
    ? 'Phân tích mất quá nhiều thời gian. Vui lòng thử lại với CV ngắn hơn hoặc thử lại sau.'
    : messages[code];
  return { code, message, ...(error.details ? { details: error.details } : {}) };
}

export function createAnalysisFitHandler(options = {}) {
  return createAnalysisHandler({
    ...options,
    normalizeInput: normalizeFitInput,
    formatResult: formatFitResult,
    formatError: formatFitError,
    endpoint: '/api/analyze-fit',
  });
}
