import type { AnalysisLanguage, AnalyzeFitErrorCode, RequirementStatus } from "./types";

type ResultText = {
  heading: string;
  fit: string;
  beforeInterview: string;
  noPreparationGaps: string;
  requirements: string;
  requirement: string;
  status: string;
  statuses: Record<RequirementStatus, string>;
  strengths: string;
  noStrengths: string;
  disclaimer: string;
  scoreLabel: (score: number) => string;
  scoreMessages: { high: string; medium: string; low: string };
  empty: string;
  latest: string;
  viewLatest: string;
  retry: string;
  saving: string;
  saved: string;
  saveFailed: string;
  retrySave: string;
  loadingLabel: string;
  loading: string;
  errors: Record<AnalyzeFitErrorCode, string>;
  unexpectedError: string;
  locale: string;
};

export const RESULT_TEXT: Record<AnalysisLanguage, ResultText> = {
  vi: {
    heading: "Kết quả phân tích",
    fit: "Mức độ phù hợp",
    beforeInterview: "Nên bổ sung trước buổi phỏng vấn",
    noPreparationGaps: "Chưa tìm thấy yêu cầu kỹ năng nào thiếu bằng chứng trong CV.",
    requirements: "Yêu cầu trong JD và CV của bạn",
    requirement: "Yêu cầu",
    status: "Trạng thái",
    statuses: { matched: "Đạt", partial: "Một phần", missing: "Thiếu" },
    strengths: "Điểm mạnh nên nhắc khi phỏng vấn",
    noStrengths: "Chưa có kỹ năng phù hợp để nêu thành điểm mạnh.",
    disclaimer: "Kết quả do AI tạo ra để bạn tham khảo khi luyện tập và có thể chưa chính xác.",
    scoreLabel: (score) => `Điểm phù hợp ${score}%`,
    scoreMessages: {
      high: "Rất tốt! CV của bạn đáp ứng phần lớn yêu cầu của vị trí này.",
      medium: "Khá phù hợp. Hãy bổ sung các kỹ năng còn thiếu trước khi phỏng vấn.",
      low: "Còn khá xa so với yêu cầu. Xem lời khuyên bên dưới để chuẩn bị tốt hơn.",
    },
    empty: "Kết quả sẽ hiện ở đây sau khi bạn bấm phân tích: điểm phù hợp, nội dung cần chuẩn bị, bảng trạng thái yêu cầu và điểm mạnh nên nhắc khi phỏng vấn.",
    latest: "Bản phân tích gần nhất",
    viewLatest: "Xem lại",
    retry: "Thử lại",
    saving: "Đang lưu kết quả...",
    saved: "Đã lưu vào tài khoản. Buổi phỏng vấn thử tiếp theo sẽ dùng bản phân tích này.",
    saveFailed: "Chưa lưu được kết quả vào tài khoản. Kết quả vẫn hiện bên dưới.",
    retrySave: "Lưu lại",
    loadingLabel: "Đang phân tích",
    loading: "AI đang đọc JD và CV, thường mất 5–15 giây...",
    errors: {
      BAD_INPUT: "JD hoặc CV đang trống hoặc quá dài. Vui lòng kiểm tra lại.",
      RATE_LIMIT: "AI đang quá tải, vui lòng thử lại sau ít phút.",
      INVALID_OUTPUT: "AI trả kết quả không hợp lệ. Vui lòng bấm phân tích lại.",
      SERVER_ERROR: "Có lỗi ở máy chủ. Vui lòng thử lại sau.",
      NETWORK_ERROR: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.",
    },
    unexpectedError: "Có lỗi không xác định. Vui lòng thử lại.",
    locale: "vi-VN",
  },
  en: {
    heading: "Analysis results",
    fit: "Job fit",
    beforeInterview: "Prepare before your interview",
    noPreparationGaps: "No skill requirements lacking CV evidence were found.",
    requirements: "Job requirements and your CV",
    requirement: "Requirement",
    status: "Status",
    statuses: { matched: "Matched", partial: "Partial match", missing: "Missing" },
    strengths: "Strengths to highlight in your interview",
    noStrengths: "No matched skills are available to highlight as strengths yet.",
    disclaimer: "These AI-generated results support interview practice and may contain inaccuracies.",
    scoreLabel: (score) => `Fit score ${score}%`,
    scoreMessages: {
      high: "Great! Your CV meets most requirements for this position.",
      medium: "A reasonable fit. Prepare for the skills not yet demonstrated in your CV before the interview.",
      low: "Your CV shows limited alignment with this role. Use the guidance below to prepare.",
    },
    empty: "Your analysis will appear here: fit score, preparation priorities, requirement statuses and strengths to highlight in your interview.",
    latest: "Latest saved analysis",
    viewLatest: "View analysis",
    retry: "Try again",
    saving: "Saving your results...",
    saved: "Saved to your account. Your next mock interview will use this analysis.",
    saveFailed: "Your results could not be saved to your account. They are still available below.",
    retrySave: "Retry saving",
    loadingLabel: "Analyzing",
    loading: "AI is reading your JD and CV. This usually takes 5–15 seconds...",
    errors: {
      BAD_INPUT: "The JD or CV is empty or too long. Please check your input.",
      RATE_LIMIT: "The AI service is busy. Please try again in a few minutes.",
      INVALID_OUTPUT: "The AI returned an invalid result. Please run the analysis again.",
      SERVER_ERROR: "A server error occurred. Please try again later.",
      NETWORK_ERROR: "Could not reach the server. Check your connection and try again.",
    },
    unexpectedError: "An unexpected error occurred. Please try again.",
    locale: "en-US",
  },
};

export function scoreMessage(score: number, language: AnalysisLanguage) {
  const messages = RESULT_TEXT[language].scoreMessages;
  return score >= 70 ? messages.high : score >= 40 ? messages.medium : messages.low;
}
