# SCRUM-92: rà soát theo skill

Ngày kiểm tra: 03/11/2026. Nhánh: `feat/scrum-92-interview-next`.

Đã áp dụng hướng dẫn phù hợp từ `gemini-api-dev` và `supabase-postgres-best-practices`, bổ sung bảy ca kiểm thử và sửa ba điểm tái hiện được. Đây là rà soát kỹ thuật của trợ lý trên phạm vi SCRUM-92; chưa phải đánh giá bảo mật toàn hệ thống hoặc nghiệm thu trên Supabase dùng chung.

## 1. Skill đã dùng

| Skill | Nguồn và phạm vi áp dụng |
| --- | --- |
| `gemini-api-dev` | Skill đã có tại `C:/Users/hungl/.codex/skills/gemini-api-dev/SKILL.md`. Rà soát schema, phản hồi rỗng/sai cấu trúc, timeout, khóa server và tránh retry ngầm. Đã đối chiếu [Google generateContent reference](https://aistudio.google.com/api-reference/generate-content/generate-content). |
| `supabase-postgres-best-practices` | Cài từ [kho chính thức Supabase](https://github.com/supabase/agent-skills/tree/main/skills/supabase-postgres-best-practices). Đọc các quy tắc về quyền tối thiểu, RLS, index khóa ngoại, constraint và transaction ngắn/thứ tự khóa. |

Đã đọc `ai-sdk` để đánh giá khả năng áp dụng. Dự án hiện dùng REST provider và chưa dùng package `ai`; lần rà soát này không chuyển SDK hoặc thêm framework vào ứng dụng. Hướng dẫn Next.js theo phiên bản trong `src/AGENTS.md` tiếp tục được giữ làm căn cứ cho Route Handler.

## 2. Các điểm đã sửa

### DB-01: thiếu index cho khóa ngoại trong bảng generation

Trước sửa, truy vấn catalog xác nhận `after_answer_id` và `question_id` không có index với cột đó đứng đầu. Các thao tác xóa answer/question có thể phải quét bảng để xử lý CASCADE/SET NULL.

Đã thêm hai partial index tại `src/supabase/migrations/20261103000000_interview_next.sql:19` và dòng 21. Khóa chính đã phục vụ tra cứu theo `session_id`, nên không thêm index trùng cho cột này. Test kiểm tra catalog đã chuyển từ fail sang pass. Chưa đo mức tăng hiệu năng; không gán số liệu benchmark của skill cho đồ án.

### DB-02: quyền SELECT rộng hơn nhu cầu

Trước sửa, role `authenticated` có SELECT cả bảng generation, gồm token, thời hạn lease, decision/reason và metadata của chính phiên mình. Không phát hiện rò rỉ sang phiên của người khác trong kiểm thử.

Đã thay bằng quyền SELECT theo danh sách cột tại `src/supabase/migrations/20261103000000_interview_next.sql:25`. Đọc trực tiếp các cột nội bộ từ role người dùng hiện bị PostgreSQL từ chối; các cột trạng thái/response được phép vẫn đọc được qua RLS. Quyền ghi trực tiếp tiếp tục bị thu hồi.

Giới hạn: các RPC claim/finish/release vẫn là giao diện chủ ý dành cho role đăng nhập và kiểm tra ownership bằng `auth.uid()` ở từng hàm. RPC claim có trả token cho caller của chính phiên đó; việc thu hẹp SELECT không biến token thành thông tin mà chủ phiên tuyệt đối không lấy được. Đây là cơ chế nhất quán lượt hỏi, không thay thế hạn mức gọi AI chống lạm dụng của SCRUM-79. Các SECURITY DEFINER được giữ trong public vì là RPC cần gọi qua Data API, với search_path rỗng, kiểm tra owner và quyền EXECUTE giới hạn. Không coi đây là bằng chứng toàn bộ Data API đã được kiểm toán.

### HTTP-01: kiểm tra Content-Type theo tiền tố

Trước sửa, `startsWith('application/json')` chấp nhận `application/jsonp`. Đã chuyển sang so sánh chính xác media type sau khi tách tham số charset tại `src/lib/interview/next-http.mjs:9`.

Test xác nhận loại lookalike bị trả 400, còn `Application/JSON; charset=UTF-8` vẫn trả 200. Đây là lỗi kiểm tra hợp đồng HTTP; không kết luận endpoint đã thực thi JSONP hoặc có XSS.

## 3. Các cơ chế đã kiểm tra và giữ lại

- Các claim/finish/release đều khóa session trước, không giữ transaction mở trong lúc gọi Gemini.
- Ownership được kiểm tra trong RPC; user B không claim/finish/release hoặc đọc trạng thái phiên của A.
- Role `anon` không được EXECUTE cả ba RPC; người đăng nhập cũng không ghi trực tiếp bảng generation.
- Request trùng không tạo thêm câu hỏi; worker có lease cũ không ghi đè lease mới; mất acknowledgement sau commit có thể phục hồi kết quả đã lưu.
- Provider dùng khóa trong header ở server, chặn redirect, có timeout, không retry ngầm và không trả raw lỗi upstream.
- Hai test bổ sung với null/scalar content part xác nhận provider hiện có đã trả `INVALID_OUTPUT` đúng; không cần thay provider.
- JSON đúng schema không chứng minh câu hỏi bám nguồn hoặc đúng độ khó. Ba ca Gemini v0.4 và phần rà soát nội dung từ lần trước được giữ làm bằng chứng riêng; ở giai đoạn rà soát skill ban đầu không gọi AI thêm vì prompt/model không đổi. Giai đoạn tiếp tục bên dưới có đổi context và gọi lại để kiểm tra.

## 4. Kết quả và ranh giới

Giai đoạn rà soát skill ban đầu đạt 148 test, gồm bảy ca bổ sung so với lần triển khai 141 test. Giai đoạn tiếp tục đạt 153 test như mô tả ở mục 5. Lint, kiểm tra kiểu và production build được chạy trên bản sửa. Bằng chứng cuối cùng được cập nhật trong `docs/test/results/scrum92-verification.json`.

Migration mới chỉ được chạy trên PGlite với các role Auth giả lập. Chưa áp dụng migration lên Supabase chung, chưa kiểm thử phiên đăng nhập thật qua endpoint mới và chưa tích hợp trang chat. Bản production cục bộ đã được ghi nhận trả `503 DATABASE_NOT_READY` vì thiếu cấu hình Supabase; điều đó vẫn là giới hạn của môi trường, không phải ca tích hợp cloud đã đạt.

Nguồn kỹ thuật đối chiếu thêm: [Supabase Database Functions](https://supabase.com/docs/guides/database/functions), [PostgreSQL GRANT theo cột](https://www.postgresql.org/docs/current/sql-grant.html). Skill mới được lưu trong thư mục cá nhân của Codex và có thể được nhận diện tự động ở lượt làm việc tiếp theo.

## 5. Tiếp tục đối chiếu yêu cầu ngày 03/11/2026

Đã kiểm tra Jira: SCRUM-92 đang In Progress, nội dung là tạo `/api/interview/next` theo JD skills, CV, vòng phỏng vấn, độ khó và ngôn ngữ. Đã fetch các nhánh; `origin/main` vẫn tại `0277462`, chưa có phần chat/persistence mới để tích hợp. Không thay đổi trạng thái hoặc người phụ trách Jira.

Áp dụng lại các nguyên tắc Gemini về context, ràng buộc prompt và kiểm tra kết quả, đã tái hiện bốn ca chọn context sai trước khi sửa: ưu tiên tiêu đề/vị trí thay cho kỹ năng ngắn; bỏ đoạn CV ngắn; không khớp alias JS/JavaScript; không dùng role fallback khi JD chỉ có tiêu đề. Cả bốn ca đã chuyển từ fail sang pass. Việc tách chính sách độ khó theo vòng được bổ sung bằng một test hồi quy, tránh ép HR/behavioral dùng yêu cầu thiết kế kỹ thuật giả định.

Context cuối là `jd-cv-context-v3`. Hai lần live sáu ca kiểm tra sau thay đổi context dùng thêm 12 request Gemini thật; tổng toàn bộ bằng chứng của task là 18 request. Lần cuối sáu ca hợp lệ và sáu lượt replay đều giữ nguyên ID mà không gọi model thêm. Không dùng kết quả này để khẳng định độ chính xác chuyên môn hoặc độ khó đã được chuyên gia nghiệm thu. Báo cáo đối chiếu chi tiết nằm tại [SCRUM-92_ACCEPTANCE_VI.md](SCRUM-92_ACCEPTANCE_VI.md).
