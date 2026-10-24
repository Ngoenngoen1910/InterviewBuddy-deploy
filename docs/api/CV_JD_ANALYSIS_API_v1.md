# CV–JD Analysis API — Contract v1.0

Ngày: 23/10/2026. Phạm vi: SCRUM-39, SCRUM-40, SCRUM-41, SCRUM-42, SCRUM-43; bên gọi: SCRUM-46 của Khang.

Đây là contract được triển khai trong nhánh `feature/SCRUM-39-cv-jd-analysis`.
Đã kiểm thử tự động và đã xác minh Gemini thật với 5 cặp CV/JD giả lập ngày 23/10/2026: 5/5 đạt kết quả kỳ vọng. Model được xác minh: `gemini-3.5-flash-lite`.
Giao diện hiện có của Khang dùng một contract khác; xem [adapter `/api/analyze-fit`](KHANG_ANALYZE_FIT_COMPAT.md) để ghép mà không sửa client của Khang.

## 1. Endpoint

```http
POST /api/analyze
Content-Type: application/json
```

- Ghép cùng Next.js: gọi đường dẫn tương đối `/api/analyze`.
- Chạy backend độc lập: `http://127.0.0.1:3001/api/analyze`.
- API nhận text đã được trích xuất; không nhận file PDF hoặc `multipart/form-data`.
- API key chỉ cấu hình ở server qua `GEMINI_API_KEY`. Frontend không gửi key.

## 2. Request

| Trường | Kiểu | Bắt buộc | Quy định |
|---|---|---|---|
| `cvText` | string | Có | 30–50.000 đơn vị độ dài JavaScript `.length`, sau khi trim. |
| `jdText` | string | Có | 30–30.000 đơn vị độ dài JavaScript `.length`, sau khi trim. |
| `language` | `"vi"` hoặc `"en"` | Không | Ngôn ngữ của `summary` và `reason`; mặc định `"vi"`. |

Giới hạn body: **400.000 byte UTF-8**. Các trường không có trong bảng bị từ chối.
Trích dẫn trong `jdEvidence`/`cvEvidence` giữ ngôn ngữ gốc của văn bản đầu vào.

```json
{
  "cvText": "Backend developer. Implemented REST APIs with Node.js. Packaged a demonstration service with Docker. Stored project records in MongoDB.",
  "jdText": "Required skills: Node.js and PostgreSQL. Preferred skill: Docker.",
  "language": "en"
}
```

## 3. Response thành công — HTTP 200

| Trường | Kiểu | Ý nghĩa |
|---|---|---|
| `analysisId` | string UUID | ID cho lần phân tích; hiện chưa lưu database. |
| `fitScore` | number, 0–100 | Điểm mức độ khớp kỹ năng, làm tròn tối đa 2 chữ số thập phân. |
| `matchedSkills` | string[] | Kỹ năng có bằng chứng trong CV. Có thể rỗng. |
| `missingSkills` | string[] | Kỹ năng yêu cầu trong JD chưa có bằng chứng khẳng định trong CV. Có thể rỗng. |
| `summary` | string | Nhận xét ngắn về khoảng thiếu kỹ năng. |
| `requirements` | object[] | Tối đa 40 yêu cầu, gồm lý do và trích dẫn để đối chiếu. |
| `scoreBreakdown` | object | Số lượng và trọng số dùng để tính lại điểm. |
| `meta` | object | Provider, model, phiên bản cách tính điểm, ngôn ngữ, thời điểm. |

Mỗi phần tử `requirements`:

```json
{
  "skill": "PostgreSQL",
  "importance": "required",
  "matched": false,
  "jdEvidence": "Required skills: Node.js and PostgreSQL.",
  "cvEvidence": "",
  "reason": "MongoDB experience does not establish PostgreSQL experience."
}
```

- `importance`: `required` hoặc `preferred`.
- `matched`: boolean. Khi `false`, `cvEvidence` là chuỗi rỗng.
- Backend kiểm tra trích dẫn tồn tại trong văn bản gốc, có chuẩn hóa Unicode, chữ hoa/thường và khoảng trắng để so sánh.
- Giới hạn tối đa 40 yêu cầu được thực thi ở backend. Không đưa `maxItems` vào schema gửi Gemini vì ràng buộc này đã làm request thật bị từ chối; có regression test cho cả hai điều kiện.
- Kiểm tra trích dẫn giúp phát hiện trích dẫn bịa; ngữ nghĩa của việc khớp kỹ năng vẫn cần kiểm chứng bằng kết quả Gemini thật.
- [Response đầy đủ mẫu](examples/analyze.success.json) được tạo từ **transport giả lập**, có `model: "gemini-offline-fixture"`. Đây là mẫu contract cho frontend, không phải chứng cứ chạy Gemini thật.

### Cách tính `fitScore`

Phiên bản `weighted-skills-v1` là lựa chọn triển khai cho bản này, chưa phải rubric được giảng viên phê duyệt:

- Kỹ năng bắt buộc: trọng số **2**.
- Kỹ năng ưu tiên: trọng số **1**.
- `fitScore = round(100 × matchedWeight / totalWeight, 2)`.
- Ví dụ Node.js khớp (2), PostgreSQL thiếu (2), Docker khớp (1): `100 × 3/5 = 60`.
- Gemini nhận diện yêu cầu và bằng chứng; **backend tính điểm**, không nhận một tỷ lệ do model tự đặt.
- Alias trùng nhau như JS/JavaScript được gộp để không nhân đôi trọng số. `C`, `C++`, `C#` là các kỹ năng khác nhau.
- Không có yêu cầu kỹ năng nào để đánh giá: trả `422 NO_JOB_REQUIREMENTS`.

Điểm này phản ánh các kỹ năng được nêu trong CV/JD, không phải xác suất được tuyển dụng.

## 4. Response lỗi

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the request fields.",
    "details": {
      "cvText": "Must contain 30-50000 characters after trimming."
    }
  }
}
```

`details` chỉ xuất hiện khi có lỗi trường dữ liệu. UI nên ánh xạ `error.code` sang thông báo tiếng Việt phù hợp; không phụ thuộc chuỗi `message` để xử lý logic.

| HTTP | `error.code` | Xử lý phía frontend |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Đánh dấu trường cần sửa. |
| 400 | `INVALID_JSON` | Kiểm tra cách gửi body JSON. |
| 403 | `ORIGIN_NOT_ALLOWED` | Kiểm tra URL frontend trong `ALLOWED_ORIGINS`. |
| 405 | `METHOD_NOT_ALLOWED` | Dùng POST. |
| 408 | `REQUEST_CANCELLED` | Kết thúc trạng thái loading; không coi là kết quả thành công. |
| 413 | `PAYLOAD_TOO_LARGE` | Yêu cầu rút gọn nội dung. |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Gửi `Content-Type: application/json`. |
| 422 | `NO_JOB_REQUIREMENTS` | Nhập JD chi tiết hơn. |
| 422 | `AI_CONTENT_BLOCKED` | Cho phép sửa nội dung trước khi thử lại. |
| 429 | `AI_RATE_LIMITED` | Chờ rồi thử lại; không tự lặp vô hạn. |
| 502 | `INVALID_AI_RESPONSE` | Hiện lỗi phân tích; có thể cho người dùng thử lại. |
| 502 | `AI_UNAVAILABLE` | Hiện lỗi dịch vụ tạm thời. |
| 503 | `AI_NOT_CONFIGURED` | Server chưa có key; không hiển thị điểm giả. |
| 503 | `AI_CONFIGURATION_ERROR` | Kiểm tra key, model và cấu hình timeout ở server. |
| 504 | `AI_TIMEOUT` | Cho phép người dùng thử lại. |
| 500 | `INTERNAL_ERROR` | Hiện lỗi chung. |

Standalone server trả `404 NOT_FOUND` cho đường dẫn khác. Next.js xử lý đường dẫn không tồn tại theo app chủ.
Các response không được cache. API không trả nguyên văn lỗi provider hoặc ghi CV/JD/key vào log.

## 5. Gọi từ client của contract gốc

```javascript
import { createAnalysisClient, AnalysisApiError } from '@/lib/analysis/core-client.mjs';

// Cùng Next.js app: bỏ baseUrl. Khi chạy API độc lập dùng URL local bên dưới.
const analyzeCvJd = createAnalysisClient({ baseUrl: 'http://127.0.0.1:3001' });

async function handleAnalyze(cvText, jdText, signal) {
  try {
    const result = await analyzeCvJd({ cvText, jdText, language: 'vi' }, { signal });
    // Cập nhật state của màn hình kết quả:
    // result.fitScore, result.matchedSkills, result.missingSkills, result.summary
    return result;
  } catch (error) {
    if (error instanceof AnalysisApiError) {
      // Dùng error.code và error.details để cập nhật lỗi giao diện.
    }
    throw error;
  }
}
```

Với client này, giữ nguyên phần `/api/extract-cv`: lấy chuỗi text sau khi trích xuất, gán vào `cvText`, rồi gửi cùng `jdText` đến API này. Trang `/analysis` hiện tại của Khang gọi `/api/analyze-fit` với `cv` và `jd`; dùng adapter ở trên cho trang đó.
Khi người dùng gửi lại hoặc rời màn hình, có thể hủy request bằng `AbortController`.

## 6. Cấu hình server

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `GEMINI_API_KEY` | Không có | Bắt buộc để gọi Gemini thật. |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Model đã chạy đạt cả 5 ca thật; có thể đổi sang model structured output mà key truy cập được. |
| `GEMINI_TIMEOUT_MS` | `30000` | Số nguyên từ 1.000 đến 45.000 ms. |
| `ALLOWED_ORIGINS` | Rỗng nếu không cấu hình | Danh sách origin frontend, phân cách bằng dấu phẩy. Cùng origin luôn được phép. |
| `HOST` | `127.0.0.1` | Chỉ dùng cho server độc lập. |
| `PORT` | `3001` | Chỉ dùng cho server độc lập. |

`.env.example` đã có hai origin frontend local làm ví dụ. Giữ key trong `.env.local` của app chủ khi tích hợp Next.js.
Module chưa kết nối lớp đăng nhập hoặc giới hạn tần suất chung của ứng dụng; phần đó cần ghép với hạ tầng nhóm trước khi mở endpoint công khai.

## 7. Tham chiếu kỹ thuật

- [Gemini generateContent API](https://ai.google.dev/api/generate-content): endpoint, system instruction, generation config, trạng thái kết thúc.
- [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/generate-content/structured-output): JSON schema và kiểm tra dữ liệu trả về ở ứng dụng.
- [Danh sách Gemini models](https://ai.google.dev/gemini-api/docs/models): kiểm tra model khả dụng khi có key.

Các tài liệu được đối chiếu ngày 23/10/2026. Xem [kết quả kiểm thử thật](../test/results/SCRUM-39-live.json); file này chỉ chứa dữ liệu giả lập, kết quả phân tích và metadata của model, không có thông tin xác thực.
