# SCRUM-39 → nhánh `feat/analysis-page` của Khang

Đối chiếu với commit `90f39dad8628709677f4691114aaa9888a09b492` do Nguyễn Đặng Hoàng Khang tạo ngày 23/10/2026. Đây là lớp tương thích để giao diện hiện có của Khang dùng lại lõi Gemini và cách tính điểm của SCRUM-39. Contract gốc tại [`/api/analyze`](CV_JD_ANALYSIS_API_v1.md) vẫn hoạt động.

## Cách ghép khi ứng dụng Next.js của Khang sẵn sàng

Chép các tệp `analysis-fit.mjs`, `contracts.mjs`, `errors.mjs`, `gemini.mjs`, `http.mjs`, `scoring.mjs`, `service.mjs` từ `src/lib/analysis/` của nhánh `feature/SCRUM-39-cv-jd-analysis` vào `src/lib/analysis/` của ứng dụng. Chép `src/app/api/analyze-fit/route.js` vào cùng đường dẫn trong ứng dụng. Có thể chép thêm `src/app/api/analyze/route.js` nếu muốn giữ cả contract gốc. Giữ nguyên `src/lib/analysis/client.ts`, `types.ts`, `mock.ts`, `/api/extract-cv`, `package.json` và giao diện của Khang. Helper `core-client.mjs` của contract gốc không cần cho trang Khang.

Đặt `GEMINI_API_KEY` và `GEMINI_MODEL=gemini-3.5-flash-lite` trong **cấu hình server** của ứng dụng. Không đưa key vào tệp `NEXT_PUBLIC_*`, trình duyệt, mã nguồn, Git hoặc ảnh chụp màn hình. Nếu `.env.local` đã tồn tại, chỉnh tệp đó; không chép `.env.example` đè lên.

Trên nhánh Khang, bỏ hoặc đặt `NEXT_PUBLIC_ANALYZE_MOCK=0` để `client.ts` gửi request thật. Khi cùng ứng dụng Next.js, client dùng URL tương đối `/api/analyze-fit`; không cần đổi endpoint trong `client.ts`.

## Request mà `client.ts` của Khang đang gửi

```http
POST /api/analyze-fit
Content-Type: application/json
```

```json
{
  "jd": "Required skills: Node.js and PostgreSQL. Preferred skill: Docker.",
  "cv": "Backend developer. Implemented REST APIs with Node.js. Packaged a demonstration service with Docker. Stored project records in MongoDB.",
  "language": "en"
}
```

`jd` cần 30–3000 ký tự sau khi trim, khớp giới hạn ô nhập của Khang. `cv` cần 30–50000 ký tự; route `/api/extract-cv` của Khang cắt ở 20000 ký tự. `language` là `vi` hoặc `en`, mặc định `vi`. Tệp PDF cần đi qua `/api/extract-cv` trước; route phân tích chỉ nhận văn bản.

## Response tương thích với `FitResult.tsx`

```json
{
  "fitScore": 60,
  "matched": [
    { "skill": "Node.js", "evidence": "Implemented REST APIs with Node.js." },
    { "skill": "Docker", "evidence": "Packaged a demonstration service with Docker." }
  ],
  "missing": [
    { "skill": "PostgreSQL", "note": "MongoDB experience does not establish PostgreSQL experience." }
  ],
  "requirements": [
    { "requirement": "Node.js", "status": "matched", "evidence": "Implemented REST APIs with Node.js." },
    { "requirement": "PostgreSQL", "status": "missing", "evidence": "" },
    { "requirement": "Docker", "status": "matched", "evidence": "Packaged a demonstration service with Docker." }
  ],
  "recommendation": "Add evidence for PostgreSQL to your CV or practise these skills before the interview."
}
```

Ví dụ trên minh họa cấu trúc từ cặp dữ liệu giả lập CVJD-02, không phải trích xuất mới từ Gemini. Danh sách và trích dẫn thực tế do kết quả Gemini tạo ra; backend xác minh bằng chứng và tự tính điểm. Trạng thái `partial` mà giao diện Khang cho phép hiện chưa có trong cách tính điểm; API trả `matched` hoặc `missing`. Giao diện Khang làm tròn `fitScore` khi hiển thị vòng điểm: 66,67 từ API sẽ hiện 67%.

`recommendation` được tạo theo quy tắc từ danh sách kỹ năng thiếu, không phải một lượt gọi Gemini thứ hai. Nếu không thiếu kỹ năng, API gợi ý chuẩn bị ví dụ dự án. API không ghi CV/JD vào cơ sở dữ liệu.

## Mã lỗi

Body lỗi có dạng `{ "error": { "code": "BAD_INPUT", "message": "...", "details": {} } }`. Lớp tương thích dùng đúng bốn mã mà `client.ts` của Khang nhận: `BAD_INPUT`, `RATE_LIMIT`, `INVALID_OUTPUT`, `SERVER_ERROR`. HTTP status vẫn phản ánh nguyên nhân: 400 khi dữ liệu sai, 429 khi giới hạn Gemini, 502 khi kết quả AI không hợp lệ, 503 khi thiếu cấu hình, 504 khi quá thời gian. UI nên hiển thị mã lỗi và cho phép thử lại phù hợp; không hiển thị điểm mẫu thay cho lỗi.

## Việc Khang cần kiểm tra khi nhận mã

1. Cập nhật nhánh Khang từ nhánh tích hợp hoặc lấy các tệp ở trên; giữ nguyên client TypeScript hiện có.
2. Chạy ứng dụng Next.js với biến môi trường **server only** và mock tắt. Xác nhận không có lỗi build/typecheck.
3. Thử cả dán CV và tải PDF; ô Analyze cần chờ trích xuất xong trước khi gọi API.
4. Kiểm tra điểm 0, danh sách trống, trường hợp thiếu kỹ năng và thông báo lỗi. Nút Analyze hiện chỉ kiểm tra có chữ; API yêu cầu ít nhất 30 ký tự cho mỗi văn bản, vì vậy Khang có thể cải thiện kiểm tra tại giao diện.
5. Kiểm tra auth/RLS và quyết định có lưu `fit_analyses` hay không trước khi triển khai công khai. Tài liệu kiến trúc nhóm còn ở trạng thái bản nháp; lớp này chưa tích hợp Supabase hay lưu kết quả.

Đã kiểm thử adapter bằng 5 cặp dữ liệu giả lập qua lõi Gemini giả lập và qua HTTP localhost. Lõi `/api/analyze` đã được xác minh trước đó với Gemini thật 5/5 cặp. Bản xem trước cục bộ lấy từ commit Khang `90f39da`, chép các tệp server ở trên, build Next.js 16.4.2 bằng Webpack và typecheck đều đạt. Route Next.js `/api/analyze-fit` đã gọi Gemini thật với cặp giả lập CVJD-02 và trả 60 điểm, khớp Node.js/Docker, thiếu PostgreSQL. Build mặc định bằng Turbopack trong môi trường này gặp lỗi tạo tiến trình ở `globals.css`, nên dùng Webpack để kiểm chứng. Chưa kiểm thử bằng tài khoản đăng nhập hoặc thao tác giao diện từ trình duyệt, và chưa có xác nhận Khang đã tích hợp trên nhánh của Khang.
