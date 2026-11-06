# SCRUM-92: triển khai và hướng dẫn kiểm thử

Đã rà soát bổ sung bằng skill Gemini và Supabase; xem [báo cáo áp dụng skill](SCRUM-92_SKILL_REVIEW_VI.md) và [phân tích yêu cầu, kết quả bàn giao](SCRUM-92_ACCEPTANCE_VI.md).

Nhánh triển khai: `feat/scrum-92-interview-next`, từ `origin/main` tại `0277462`.

## Nội dung đã làm

Đã thêm `POST /api/interview/next`, xác thực bằng cookie/Bearer hiện có và dựng context từ phiên thuộc người dùng. Endpoint tái sử dụng provider Gemini; module chọn trọng tâm lấy các đoạn JD/CV nguyên văn và thêm chính sách theo vòng/độ khó/ngôn ngữ vào prompt v0.4. Phần lưu câu hỏi và xử lý request gửi lại được thực hiện bằng migration mới.

Cơ sở nghiên cứu, hợp đồng HTTP và giới hạn nằm trong [INTERVIEW_NEXT_API_v1.md](../api/INTERVIEW_NEXT_API_v1.md). Hướng lựa chọn context được tham khảo từ EZInterviewer và PolyInterview; phân biệt mục đích câu hỏi tham khảo Conversate; STAR dùng cho behavioral theo Siswanto. Đây là bản điều chỉnh cho stack của nhóm, chưa tái lập mô hình nghiên cứu.

## Các file chính (tính từ thư mục repo)

| File | Vai trò |
| --- | --- |
| `src/app/api/interview/next/route.ts` | Gắn xác thực, repository và provider vào Route Handler. |
| `src/lib/interview/next-http.mjs` | Đọc request có giới hạn, trả HTTP và lỗi an toàn. |
| `src/lib/interview/next-service.mjs` | Điều phối context, gọi AI, kiểm tra kết quả, lưu/replay. |
| `src/lib/interview/next-repository.mjs` | Gọi ba RPC qua Supabase client của người đăng nhập. |
| `src/lib/interview/question-plan.mjs` | Chọn đoạn tài liệu và chính sách câu hỏi. |
| `src/lib/interview/interviewer-prompt.mjs` | Prompt v0.4, ưu tiên câu kỹ thuật giả định khi thiếu bằng chứng. |
| `src/supabase/migrations/20261103000000_interview_next.sql` | Claim/finish/release nguyên tử, RLS và lưu câu hỏi. |
| `src/tests/interview-next.test.mjs` | Test tích hợp HTTP/service/provider/PostgreSQL cục bộ. |
| `src/scripts/verify-interview-next.mjs` | Sáu ca tổng hợp để thử provider thật trên DB cục bộ, kèm kiểm tra replay không gọi AI thêm. |

## Chạy kiểm thử cục bộ

Trong `D:/BackUp/HCMUS_Semester_7/introSE/project/main/src`:

```powershell
npm install
npm test
npm run typecheck
npm run build
npm run verify:interview-next
```

Lệnh cuối chỉ chuẩn bị sáu ca, không gọi AI. Nếu cần gọi Gemini thật bằng khóa đã đặt trong `.env.local`:

```powershell
npm run verify:interview-next:live
```

Có thể chọn một ca để giảm số lượt gọi khi chỉ sửa một trường hợp:

```powershell
npm run verify:interview-next:live -- --case behavioral-hard-en
```

Script dùng CV/JD tổng hợp, PGlite cục bộ, HTTP handler thật và xác thực giả lập; không thay đổi Supabase chung. Chạy lệnh live dùng quota và ghi đè báo cáo `docs/test/results/scrum92-next-live.json`; lưu bản cũ trước nếu cần giữ bằng chứng. Báo cáo có số request ra Gemini, context đã chọn, câu hỏi và kết quả gửi lại request. Khi gặp lỗi provider hoặc replay sai, script dừng gọi thêm. Không đưa khóa hoặc CV thật vào fixtures.

## Thử endpoint thật sau khi migration được review và áp dụng

1. Nhân review/apply migration mới sau hai migration hiện có. Migration này chưa được áp dụng lên Supabase dùng chung trong lần triển khai.
2. Chạy `npm run dev`, đăng nhập và tạo phiên bằng API `POST /api/interview` hiện có. Ghi lại `sessionId` thật.
3. Trong DevTools Console của ứng dụng đã đăng nhập, thay `SESSION_ID_THAT` trong đoạn sau. Đoạn này chỉ yêu cầu câu mở đầu:

```javascript
const response = await fetch('/api/interview/next', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionId: 'SESSION_ID_THAT', afterAnswerId: null })
});
console.log(response.status, await response.json());
```

4. Gửi lại cùng request: nhận đúng ID câu hỏi cũ, không sinh câu khác. Hai request chồng nhau: một request xử lý, request còn lại nhận `GENERATION_IN_PROGRESS` hoặc kết quả đã lưu nếu request trước đã xong.
5. Khi phần persistence của Nhân lưu câu trả lời, dùng ID của answer làm `afterAnswerId` để yêu cầu câu tiếp. Không gửi nội dung answer thẳng vào endpoint này.
6. Thử vi/en, technical/behavioral/HR và ba độ khó. Rà soát nội dung: bám JD, không gán kỹ thuật/thành tích chưa có trong CV. Lỗi schema và sự phù hợp nội dung là hai phép kiểm tra khác nhau.
7. Tài khoản B dùng session của A phải nhận 404; không đăng nhập nhận 401.

## Bằng chứng kiểm thử và giới hạn

Kết quả cuối nằm trong `docs/test/results/scrum92-next-live.json`: prompt v0.4, context `jd-cv-context-v3`, sáu ca trả HTTP 200, gửi lại cả sáu request nhận cùng câu hỏi và không gọi Gemini thêm. Bộ test tự động đạt 153/153; kiểm tra payload đủ 18 tổ hợp vòng/độ khó/ngôn ngữ. Sáu ca live phủ mọi giá trị cấu hình nhưng không phải phép thử đầy đủ 18 tổ hợp hay đánh giá độc lập về chất lượng.

Lần đầu prompt v0.3 có câu tiếng Anh ngầm giả định ứng viên đã dùng isolation levels; kết quả ban đầu được giữ ở `scrum92-next-live-initial.json`. Bản v0.4 với context cũ được giữ ở `scrum92-next-live-context-v1.json`; sáu ca sau khi sửa chọn context được giữ ở `scrum92-next-live-context-v2.json`. Bản cuối thêm chính sách độ khó riêng theo từng vòng. Toàn bộ các lượt này dùng tổng cộng 18 request Gemini thật; lần chạy cuối dùng sáu request. Đây là rà soát bởi trợ lý, không phải đánh giá chuyên gia hay người dùng.

Trong lần tiếp tục, đã sửa việc chọn tiêu đề/vị trí thay cho kỹ năng, bỏ sót kỹ năng ngắn, không nối được JS với JavaScript, xử lý JD chỉ có tiêu đề và dùng chung chính sách độ khó giữa các vòng. Đoạn trích vẫn giữ nguyên văn, kể cả phủ định; mức trùng từ không được coi là bằng chứng ứng viên có kỹ năng.

Chưa nối giao diện chat (SCRUM-95), chưa xây API lưu answer của phần persistence (SCRUM-79), chưa thêm tóm tắt last-four-turn (SCRUM-93), chưa streaming (SCRUM-94). Các bảng feedbacks/report không bị điền điểm giả. Đã kiểm thử SQL trên PGlite nhưng chưa xác nhận migration và luồng đăng nhập trên Supabase dùng chung.

Production build đã nhận route `/api/interview/next`. Gọi route thật trên localhost trả `503 DATABASE_NOT_READY` vì môi trường hiện thiếu cấu hình Supabase. Trường hợp 401 được kiểm tra qua HTTP handler với bộ xác thực giả lập; chưa ghi nhận một lần đăng nhập thật thành công qua endpoint mới. Các ca Gemini thật dùng cùng handler/service/repository và migration nhưng thay xác thực bằng tài khoản thử trong database cục bộ.
