# SCRUM-39 — Báo cáo triển khai và kiểm thử

## Cập nhật 26/10/2026: ba mục nhận xét cho màn hình kết quả

Gemini nay trả `coaching.beforeInterview`, `coaching.improvements` và `coaching.strengths` trong cùng lần phân tích CV/JD. Backend kiểm tra mỗi mục gắn với một kỹ năng trong kết quả đối chiếu; `beforeInterview` chỉ dùng kỹ năng thiếu và `strengths` chỉ dùng kỹ năng có bằng chứng trong CV. Fit Score vẫn do backend tính.

- Bộ kiểm thử hiện tại: **80/80 đạt** (bao gồm các ca xác minh ràng buộc của ba mục nhận xét và trường hợp khớp 100%).
- TypeScript và ESLint cho các file giao diện liên quan: đạt.
- Ba lần gọi Gemini thật với các cặp giả lập: CVJD-01 trả **100** điểm và số mục `2/1/1`; CVJD-02 trả **60** điểm và `1/1/1`; CVJD-04 tiếng Việt trả **80** điểm và `1/1/1` (theo thứ tự `beforeInterview/improvements/strengths`). Lệnh kiểm tra chỉ in trạng thái, điểm, số mục và cờ xác nhận có dấu tiếng Việt; không in API key hoặc văn bản CV/JD.
- Ngày 27/10/2026, đã dùng CV/JD giả lập CVJD-04 gọi Gemini thật và chụp giao diện kết quả bằng trình duyệt: Fit Score **80%**, một nhận xét chuẩn bị Selenium và một nhận xét điểm mạnh Postman. Ảnh và JSON nằm trong `output/interviewbuddy-live-coaching-*`. Đây là bản xem trước của thành phần kết quả, chưa phải kiểm thử toàn bộ luồng đăng nhập và nhập CV/JD. Lời khuyên AI vẫn cần người dùng kiểm tra, đặc biệt khi nêu kỹ thuật chưa được CV chứng minh. Các số liệu 5/5 bên dưới là kết quả trước khi bổ sung `coaching`.

Ngày: 23/10/2026. Kiểm thử do Codex thực hiện; không phải đánh giá của giảng viên hoặc xác nhận review của thành viên nhóm.

## 1. Truy vết nhiệm vụ

| Jira | Yêu cầu | Phần triển khai | Ranh giới xác minh |
|---|---|---|---|
| SCRUM-40 | Gọi Gemini xử lý CV/JD text | `src/lib/analysis/gemini.mjs`, `service.mjs`, `http.mjs`; adapter Next.js và server Node | Đã kiểm thử transport/lỗi và đã gọi Gemini thật trên 5 cặp CV/JD. |
| SCRUM-41 | Fit Score, matched/missing skills | `scoring.mjs`, kiểm tra trích dẫn và gộp alias | Đã kiểm tra cách tính điểm với kết quả kỳ vọng cho 5 cặp dữ liệu. |
| SCRUM-42 | API contract cho Khang | `docs/api/CV_JD_ANALYSIS_API_v1.md`, `HANDOFF_TO_KHANG.md`, client helper, ví dụ JSON | Sẵn nội dung bàn giao qua repo; chưa có xác nhận của Khang. |
| SCRUM-43 | Xác minh ít nhất 5 cặp CV/JD | Fixtures, unit tests, script offline và script live | 5/5 cặp đạt qua HTTP nội bộ giả lập và 5/5 cặp đạt với Gemini thật. |

Sau khi nhánh `feat/analysis-page` của Khang xuất hiện, đã thêm adapter `/api/analyze-fit` khớp `client.ts`/`types.ts` của nhánh đó tại commit `90f39da`. Adapter dùng lại cùng lõi Gemini và cách tính điểm; không tạo một thuật toán phân tích khác. Helper contract gốc được đổi thành `core-client.mjs` để không xung đột module `client.ts` của Khang. Xem [contract tương thích](../api/KHANG_ANALYZE_FIT_COMPAT.md).

## 2. Dữ liệu kiểm thử

Toàn bộ CV/JD là **dữ liệu giả lập do AI soạn**, không phải khảo sát, hồ sơ cá nhân hay kết quả phỏng vấn thật.
Kết quả Gemini giả lập được chỉ định trong fixture để kiểm tra đường đi dữ liệu và số học.

| Mã | Tình huống | Trọng số khớp / tổng | Điểm kỳ vọng |
|---|---|---|---|
| CVJD-01 | Frontend khớp đầy đủ React, TypeScript, Git | 5/5 | 100 |
| CVJD-02 | Backend có Node.js và Docker, thiếu PostgreSQL | 3/5 | 60 |
| CVJD-03 | Data analyst không khớp; CV có phủ định rõ kỹ năng | 0/5 | 0 |
| CVJD-04 | CV/JD tiếng Việt cho QA; thiếu Selenium | 4/5 | 80 |
| CVJD-05 | Java internship; thiếu Spring Boot; kiểm tra làm tròn | 4/6 | 66,67 |

Nguồn: [fixtures/cv-jd-pairs.json](fixtures/cv-jd-pairs.json).
Chạy offline xác minh đường đi dữ liệu và số học. Lần kiểm thử live cũng đã đạt kết quả kỳ vọng cho cả 5 cặp, bao gồm ca phủ định kỹ năng và ca tiếng Việt. Đây là chứng cứ cho 5 ca cụ thể, không phải kết luận về độ chính xác trên mọi CV/JD.

## 3. Các lớp kiểm tra

- Input: kiểu dữ liệu, trim, độ dài, ngôn ngữ, trường lạ và giới hạn body.
- Gemini adapter: JSON schema, tách instruction khỏi tài liệu, key trong header, timeout, hủy request, quota, lỗi cấu hình, lỗi mạng, phản hồi bị chặn hoặc bị cắt.
- Kết quả: trích dẫn CV/JD, thiếu bằng chứng, alias trùng, phân biệt C/C++/C#, kỹ năng rỗng, điểm do backend tính.
- HTTP/client: mã lỗi, CORS, không cache, không lộ nội dung lỗi nội bộ, helper cho Khang và adapter Next.js.
- Local HTTP: browser client helper → server Node → Gemini adapter giả lập → kiểm tra kết quả → JSON trả về.

## 4. Lệnh tái chạy và chứng cứ

Kết quả sau khi thêm adapter: **76/76 kiểm thử tự động đạt**, gồm 5 ca ánh xạ contract Khang và một ca HTTP localhost; **5/5 cặp qua HTTP nội bộ đạt** với Gemini transport giả lập ở contract gốc.
Kiểm thử Gemini thật: **passed, 5/5**, dùng `gemini-3.5-flash-lite`; điểm lần lượt **100, 60, 0, 80, 66,67**.

Lần thử đầu với cấu hình cũ có timeout/lỗi request. Chẩn đoán thật xác định `maxItems` trong schema gây request bị từ chối; đã bỏ ràng buộc đó khỏi schema, giữ giới hạn 40 ở backend và thêm regression tests. Model mặc định được đổi sang Flash-Lite sau khi xác minh lời gọi thật. Kết quả trong file live là lần chạy thành công sau bản sửa.

Từ thư mục `src`:

```powershell
npm test
npm run verify:offline
npm run verify:live
npm run verify:secrets
```

- [Kết quả HTTP offline cho 5 cặp](results/SCRUM-39-offline.json).
- [Nhật ký bộ kiểm thử tự động](results/SCRUM-39-unit.tap).
- [Trạng thái kiểm thử Gemini thật](results/SCRUM-39-live.json).
- [Kết quả kiểm tra không lộ key](results/SCRUM-39-secret-check.json).
- `verify:live` thiếu key: ghi `blocked`, không gửi request ngoài, exit code **2**. Có key: gửi đúng 5 cặp giả lập và so sánh với kết quả kỳ vọng.
- Nếu có khác biệt về điểm/kỹ năng trong lần chạy thật, báo cáo ghi `needs-review`; không tự đánh dấu đạt.

## 5. Bảo vệ key và phần tích hợp còn chờ

- Key nằm trong `.env.local` được Git bỏ qua, không được tracking; quyền truy cập tệp cục bộ đã giới hạn cho tài khoản Windows hiện tại.
- Lời gọi Gemini gửi key trong header, không đưa vào URL, prompt hoặc dữ liệu trả về. Không ghi key hoặc lỗi provider thô vào log.
- Script `verify:secrets` quét tệp có thể được commit, staged diff và diff của nhánh so với `origin/main`; kết quả phải là `leaksFound: 0` trước khi push.
- Khang còn cần ghép mã frontend và xác minh luồng sử dụng hoàn chỉnh của SCRUM-46.
- Bản xem trước cục bộ từ nhánh Khang tại commit `90f39da` đã build với `next build --webpack` và `npm run typecheck` đạt. Build mặc định qua Turbopack gặp lỗi tạo tiến trình ở `globals.css` trong môi trường này; lần Webpack cuối không còn cảnh báo import client sai.
- Route `/api/analyze-fit` trên bản xem trước Next.js đã gọi Gemini thật bằng dữ liệu giả lập CVJD-02 và nhận 60 điểm, khớp Node.js/Docker, thiếu PostgreSQL. Không chép key vào bản xem trước; key được nạp cục bộ vào tiến trình server.
- Chưa xác nhận thao tác giao diện trọn luồng trong trình duyệt, đăng nhập, hoặc việc Khang đã ghép mã vào nhánh của mình.
- Nhóm còn cần review nhánh/PR trước khi merge vào `main`.

Chưa xác nhận build trong app Next.js hoàn chỉnh, kết nối database/auth, hay triển khai Vercel vì repo hiện chưa có các phần đó.
