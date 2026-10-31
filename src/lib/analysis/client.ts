import { MOCK_ANALYZE_FIT } from "./mock";
import type {
  AnalyzeFitErrorCode,
  AnalyzeFitRequest,
  AnalyzeFitResponse,
  ApiError,
} from "./types";

export const USE_MOCK = process.env.NEXT_PUBLIC_ANALYZE_MOCK === "1";

export class AnalyzeFitError extends Error {
  constructor(
    public code: AnalyzeFitErrorCode,
    message: string,
  ) {
    super(message);
  }
}

// Messages shown to the user, by error code from the API contract.
const MESSAGES: Record<AnalyzeFitErrorCode, string> = {
  BAD_INPUT: "JD hoặc CV đang trống hoặc quá dài. Vui lòng kiểm tra lại.",
  RATE_LIMIT: "AI đang quá tải, vui lòng thử lại sau ít phút.",
  INVALID_OUTPUT: "AI trả kết quả không hợp lệ. Vui lòng bấm phân tích lại.",
  SERVER_ERROR: "Có lỗi ở máy chủ. Vui lòng thử lại sau.",
  NETWORK_ERROR: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.",
};

export async function analyzeFit(input: AnalyzeFitRequest): Promise<AnalyzeFitResponse> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 1200)); // pretend the AI is thinking
    return MOCK_ANALYZE_FIT;
  }

  let res: Response;
  try {
    res = await fetch("/api/analyze-fit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new AnalyzeFitError("NETWORK_ERROR", MESSAGES.NETWORK_ERROR);
  }

  const body = (await res.json().catch(() => null)) as AnalyzeFitResponse | ApiError | null;

  if (!res.ok || !body || "error" in body) {
    const code = toCode(res.status, body && "error" in body ? body.error.code : undefined);
    // Prefer the server message (already in the user's language), else our default.
    const message = body && "error" in body && body.error.message ? body.error.message : MESSAGES[code];
    throw new AnalyzeFitError(code, message);
  }

  const coaching = body.coaching;
  const validItems = (items: unknown): items is { skill: string; advice: string }[] =>
    Array.isArray(items) && items.every((item) =>
      item && typeof item.skill === "string" && typeof item.advice === "string");
  if (!coaching || !validItems(coaching.beforeInterview)
      || !validItems(coaching.improvements) || !validItems(coaching.strengths)) {
    throw new AnalyzeFitError("INVALID_OUTPUT", MESSAGES.INVALID_OUTPUT);
  }

  return body;
}

function toCode(status: number, code?: string): AnalyzeFitErrorCode {
  if (code && code in MESSAGES) return code as AnalyzeFitErrorCode;
  if (status === 400) return "BAD_INPUT";
  if (status === 429) return "RATE_LIMIT";
  if (status === 502) return "INVALID_OUTPUT";
  return "SERVER_ERROR";
}

export type ExtractCvResult = {
  text: string;
  pages: number;
  truncated: boolean;
  originalChars: number;
};

// NO_TEXT = the PDF is a scan/image: show a warning and let the user paste the CV.
export class CvExtractError extends Error {
  constructor(
    public code: "NO_TEXT" | "BAD_FILE" | "SERVER_ERROR",
    message: string,
  ) {
    super(message);
  }
}

// Sends the PDF to /api/extract-cv (pdf-parse runs on the server).
export async function extractCvText(file: File): Promise<ExtractCvResult> {
  const form = new FormData();
  form.append("file", file);

  let res: Response;
  try {
    res = await fetch("/api/extract-cv", { method: "POST", body: form });
  } catch {
    throw new CvExtractError("SERVER_ERROR", MESSAGES.NETWORK_ERROR);
  }

  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.error) {
    const code = body?.error?.code;
    throw new CvExtractError(
      code === "BAD_FILE" ? code : "SERVER_ERROR",
      body?.error?.message ?? "Không đọc được file PDF.",
    );
  }
  if (body.noText) {
    throw new CvExtractError(
      "NO_TEXT",
      "PDF này gần như không có chữ (có thể là ảnh scan). Hãy dán nội dung CV vào ô bên dưới.",
    );
  }
  return body as ExtractCvResult;
}
