# Bàn giao SCRUM-42 cho Khang — tích hợp SCRUM-46

## Tệp cần đọc

1. [API contract v1](CV_JD_ANALYSIS_API_v1.md).
2. [Lớp tương thích với trang `/analysis` đã có trên nhánh của Khang](KHANG_ANALYZE_FIT_COMPAT.md).
3. [Request mẫu của contract gốc](examples/analyze.request.json).
4. [Response mẫu từ kiểm thử offline](examples/analyze.success.json).
5. Client helper của contract gốc: `src/lib/analysis/core-client.mjs` và khai báo kiểu `core-client.d.mts`. Nhánh Khang đang có `client.ts`; giữ tệp đó khi ghép ứng dụng.

## Luồng tích hợp

```text
PDF CV → /api/extract-cv của Khang → cvText
Ô nhập JD                           → jdText
                     ↓
         POST /api/analyze-fit
                     ↓
         fitScore / matched / missing
                     ↓
          Màn hình kết quả của Khang
```

### Cách A — thử với backend độc lập

Từ thư mục `src` của nhánh này:

```powershell
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
# Nếu mới tạo tệp, thêm GEMINI_API_KEY vào .env.local.
npm run api:standalone
```

Frontend Khang đang gọi URL tương đối `/api/analyze-fit`. Để thử backend độc lập trên port 3001, client phải dùng `http://127.0.0.1:3001/api/analyze-fit`; nếu không đổi client, hãy ghép route vào cùng app Next.js.
Khác port/domain: thêm origin đầy đủ vào `ALLOWED_ORIGINS`, rồi khởi động lại server.
Thiếu key sẽ nhận `503 AI_NOT_CONFIGURED`; dùng response mẫu để thiết kế giao diện trong thời gian chờ, ghi rõ dữ liệu mẫu trong bản demo.

### Cách B — ghép vào Next.js của Khang

Giữ `package.json`, `client.ts`, `types.ts`, `mock.ts` và cấu trúc hiện có của app Khang. Chép:

```text
lib/analysis/                 → thư mục lib/analysis của app
app/api/analyze/route.js      → thư mục app/api/analyze của app
app/api/analyze-fit/route.js  → thư mục app/api/analyze-fit của app
```

Hai thư mục `lib` và `app` phải cùng cấp, thường là dưới `src/`.
Adapter dùng Node runtime, không dùng Edge runtime. Không cần thêm thư viện ngoài.
Thêm key vào `.env.local` của app Next.js, khởi động lại, rồi gọi URL tương đối `/api/analyze-fit` theo client hiện có của Khang. Mock phải được tắt. Xem [chi tiết input/output của adapter](KHANG_ANALYZE_FIT_COMPAT.md).

## Checklist để kiểm tra SCRUM-46 khi tích hợp

- Nút Analyze của nhánh Khang gửi JSON gồm `cv`, `jd`, `language` tới `/api/analyze-fit`; adapter đổi sang input lõi.
- Hiện trạng thái loading và ngăn gửi lặp trong lúc chờ.
- HTTP 200: hiển thị đúng tỷ lệ và hai danh sách `matched`/`missing`, kể cả danh sách rỗng hoặc điểm 0.
- HTTP lỗi: hiển thị lỗi; không giữ điểm cũ như thể đó là kết quả của lần gửi mới.
- Chưa cấu hình key: xử lý `AI_NOT_CONFIGURED`, không tự đổi sang kết quả mẫu.
- Thử lại luồng upload CV → trích xuất text → Analyze → màn hình kết quả với API thật khi có key.

## Trạng thái bàn giao

- Mã API và contract đã được viết; có 5 cặp dữ liệu giả lập và kiểm thử offline tái chạy được.
- Đã kiểm chứng Gemini thật với `gemini-3.5-flash-lite`: 5/5 cặp giả lập đạt kết quả kỳ vọng. Xem báo cáo trong `docs/test/results/SCRUM-39-live.json`.
- Key được giữ ở cấu hình cục bộ, không đi kèm nhánh hoặc tài liệu. Mỗi môi trường chạy cần tự cấu hình key ở server.
- Đã đọc nhánh `feat/analysis-page` tại commit `90f39da` và thêm adapter theo đúng route, request, response và mã lỗi trong `client.ts`/`types.ts` của Khang. Bản xem trước cục bộ đã build/typecheck bằng Webpack và gọi Gemini thật qua route Next.js với ca CVJD-02; chưa xác nhận thao tác giao diện trọn luồng hoặc tích hợp trên nhánh của Khang.
- Tài liệu này là nội dung bàn giao qua repository; chưa có xác nhận Khang đã đọc hoặc tích hợp.
