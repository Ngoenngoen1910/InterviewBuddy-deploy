# SCRUM-92 — phân tích bài toán và kết quả triển khai

Ngày đối chiếu: 03/11/2026. Nhánh local: `feat/scrum-92-interview-next`, dựa trên `origin/main` tại `0277462`. Đây là báo cáo kết quả kỹ thuật, chưa phải biên bản nghiệm thu của nhóm hoặc giảng viên.

## 1. Yêu cầu và phạm vi

Đã kiểm tra trực tiếp [SCRUM-92 trên Jira](https://nhom3-24c01-se.atlassian.net/browse/SCRUM-92). Tiêu đề: “Build /api/interview/next: each question is made from the JD skills, the CV, the round, the difficulty and the language.” Jira không có mô tả chi tiết, trạng thái hiện là In Progress. Các tiêu chí triển khai bên dưới là cách cụ thể hóa yêu cầu từ tiêu đề và hợp đồng ứng dụng, không phải tiêu chí bổ sung do giảng viên xác nhận.

Bài toán là tạo và lưu một câu hỏi phù hợp cho lượt hiện tại của phiên phỏng vấn. Backend phải lấy đúng hồ sơ, JD và cấu hình của người đăng nhập; chọn trọng tâm; gọi AI; kiểm tra kết quả; trả câu hỏi cho giao diện. Gửi lại cùng lượt phải lấy lại câu đã lưu để tránh tạo câu trùng và tốn quota.

| Đầu vào của task | Cách sử dụng | Bằng chứng hiện có |
| --- | --- | --- |
| JD skills | Bỏ dòng tiêu đề và tên vị trí đơn lẻ; ưu tiên đoạn JD ít trùng với các chủ đề đã hỏi. | Test chọn React rồi chuyển PostgreSQL; JD có Go/C#; JD chỉ có tiêu đề. |
| CV | Lấy tối đa hai đoạn trùng từ với trọng tâm, giữ nguyên văn và phủ định; toàn bộ CV vẫn được gửi trong context. Không coi trùng từ là đã có kỹ năng. | Test giữ “I have not used…”; alias JS/JavaScript; CV dài giữ được phần cuối. |
| Round | Technical hỏi kiến thức/cách thực hiện; behavioral mời kể trải nghiệm thật theo STAR; HR hỏi động lực và phối hợp công việc. | 18 tổ hợp payload và các ca Gemini thuộc đủ ba vòng. |
| Difficulty | Mỗi vòng có chính sách easy/medium/hard riêng, tránh dùng bài thiết kế kỹ thuật cho HR/behavioral. | Test hồi quy chính sách hard; ca live easy/medium/hard. |
| Language | Prompt ràng buộc câu hỏi, reason và topic mới theo vi/en; thuật ngữ kỹ thuật có thể giữ nguyên. | Kiểm tra payload cả hai ngôn ngữ và đọc kết quả live. Chưa có bộ chấm tự động chất lượng ngôn ngữ. |

Phần này không triển khai trang chat, API lưu câu trả lời, chấm điểm/report, streaming hoặc tóm tắt lịch sử. Những phần đó thuộc công việc tích hợp khác; endpoint đã chuẩn bị hợp đồng để kết nối.

## 2. Luồng hoạt động và các thành phần

1. Frontend gửi `POST /api/interview/next` với `sessionId` và `afterAnswerId`. Câu đầu dùng `afterAnswerId: null`; câu sau dùng ID câu trả lời vừa lưu. Client không tự gửi CV, JD, user ID hoặc lịch sử để ghi đè dữ liệu phiên.
2. Route Handler Next.js xác thực cookie/Bearer bằng Supabase. Repository gọi RPC bằng quyền người đăng nhập; SQL kiểm tra chủ sở hữu trước khi đọc hoặc ghi.
3. RPC claim khóa ngắn dòng session, kiểm tra trạng thái và tạo reservation cho lượt. Nếu đã có kết quả thì trả lại; nếu đang tạo thì báo `GENERATION_IN_PROGRESS`. Khóa database được nhả trước khi gọi Gemini.
4. Service dựng context từ snapshot JD/CV, cấu hình và các lượt hỏi–đáp đã lưu. Module `question-plan.mjs` chọn trọng tâm và chính sách; provider hiện có gọi Gemini ở server.
5. Kết quả phải qua schema và quy tắc trạng thái. SQL finish kiểm tra lại reservation, lượt hiện tại, thời gian và số câu trước khi lưu. HTTP chỉ trả action và câu hỏi; không trả reason nội bộ, score hoặc thông tin khóa.
6. Khi lỗi AI, không lưu câu hỏi giả và không retry trả phí ngầm. Khi mất xác nhận sau commit, request sau tìm lại kết quả đã lưu.

Các file chính và hợp đồng request/response được liệt kê trong [hướng dẫn triển khai](SCRUM-92_IMPLEMENTATION_VI.md) và [API v1](../api/INTERVIEW_NEXT_API_v1.md).

## 3. Nguồn nghiên cứu và skill đã áp dụng

| Nguồn | Cách áp dụng vào task | Giới hạn |
| --- | --- | --- |
| [EZInterviewer, WSDM 2023](https://doi.org/10.1145/3539597.3570476) | Chọn thông tin CV/JD trước khi sinh câu hỏi. | Dùng heuristic trùng từ và Gemini; không tái lập mô hình huấn luyện của bài báo. |
| [PolyInterview, Appendix C](https://arxiv.org/html/2607.10310v3) | Lập kế hoạch câu hỏi theo hồ sơ và trọng tâm. | Preprint; không gán kết quả benchmark của bài cho ứng dụng. |
| [Conversate, §3.2 và Appendix B.1](https://arxiv.org/html/2410.05570v2) | Phân biệt câu mở đầu, hỏi tiếp và chuyển chủ đề. | Chỉ tái sử dụng chính sách có sẵn; phần compaction chi tiết vẫn thuộc SCRUM-93. |
| [Siswanto et al., 2022](https://doi.org/10.14716/ijtech.v13i2.5018) | STAR cho câu hỏi behavioral. | Không áp STAR bắt buộc lên kiến thức kỹ thuật; không triển khai bộ chấm của bài. |
| `gemini-api-dev` | Structured output, context không đáng tin, timeout, khóa server, kiểm tra output và không retry ngầm. | Giữ REST provider hiện có, không chuyển SDK chỉ để làm task. |
| [supabase-postgres-best-practices](https://github.com/supabase/agent-skills/tree/main/skills/supabase-postgres-best-practices) | RLS/ownership, quyền tối thiểu, index khóa ngoại, transaction ngắn và thứ tự khóa. | Đã thử PostgreSQL cục bộ; chưa thay thế kiểm tra trên Supabase chung. |

Đã xem `ai-sdk` và xác định không cần thêm dependency đó. Chi tiết các lỗi được tái hiện và sửa nhờ rà soát skill nằm trong [báo cáo skill](SCRUM-92_SKILL_REVIEW_VI.md).

## 4. Kết quả kiểm tra

### Tự động trên máy

153/153 test đạt, tăng 37 test so với base 116 test. Nhóm kiểm tra mới bao gồm HTTP, context, provider, persistence, ownership, quyền truy cập, request trùng, request đồng thời, lease cũ, lỗi AI, mất xác nhận sau commit và hết thời gian/số câu. Bộ test dựng payload cho đủ 18 tổ hợp vòng × độ khó × ngôn ngữ; không có nghĩa 18 tổ hợp đã gọi Gemini hoặc được chuyên gia chấm.

Lint các file liên quan, kiểm tra kiểu TypeScript và production build đạt. Build đã đăng ký `/api/interview/next`.

### Gemini thật với dữ liệu tổng hợp

Lần cuối dùng prompt v0.4, context `jd-cv-context-v3`, model `gemini-3.5-flash-lite`. Sáu ca đều HTTP 200 và replay nhận cùng ID câu hỏi mà không gọi AI thêm. Tổng lượt gọi upstream của lần chạy cuối là sáu.

| Ca | Nội dung câu hỏi quan sát được | Rà soát bởi trợ lý |
| --- | --- | --- |
| Technical / medium / vi | Quản lý loading/error khi React gọi REST API. | Bám công nghệ được nêu; CV có dự án React và REST API. |
| Technical / hard / en | Concurrent inventory updates trên Node.js/PostgreSQL và race conditions. | Hỏi giả định, không gán kinh nghiệm production cho ứng viên. |
| Behavioral / easy / vi | Bất đồng trong bài tập nhóm website và cách xử lý. | Mời kể tình huống; không tự đưa thành tích/kết quả của ứng viên. |
| HR / medium / en | Động lực ứng tuyển QA Intern và cách học kiến thức testing. | Đúng vòng/ngôn ngữ, không bịa kinh nghiệm; còn khá khái quát và có hai ý liên quan trong một câu. |
| Technical / easy / vi / JD kỹ năng ngắn | Goroutine và khác biệt với OS thread. | Đã chọn Go sau khi bỏ tiêu đề; không gán kinh nghiệm C# khi CV nói chưa dùng. |
| Behavioral / hard / en | Bất đồng với đồng đội về quyết định kỹ thuật. | Không giả định chức danh lãnh đạo hoặc kết quả thành công; độ khó vẫn cần người dùng/chuyên gia nhận xét. |

Đây là rà soát nội dung do trợ lý thực hiện, không phải kết quả đánh giá độc lập. Không kết luận model “chính xác” chỉ vì JSON hợp lệ. Thời gian từ request đến JSON hoàn tất trong lần cuối khoảng 1,37–4,30 giây; không đo first-token và không chứng minh đạt mục tiêu streaming hai giây.

Bằng chứng: [kết quả live cuối](results/scrum92-next-live.json), [bản tổng hợp](results/scrum92-verification.json). Kết quả cũ được giữ theo từng giai đoạn để thấy lỗi và cách sửa. Tổng toàn bộ các lần thử được lưu là 18 request Gemini thật với CV/JD tổng hợp.

## 5. Trạng thái bàn giao và bước tích hợp còn lại

Phần code SCRUM-92 đã được triển khai và kiểm tra trong môi trường cục bộ; chưa thay đổi trạng thái Jira. Môi trường hiện có khóa Gemini nhưng thiếu cấu hình Supabase. Migration mới chưa được áp dụng lên database chung, và chưa kiểm thử đăng nhập thật qua endpoint này. Lần smoke route production cục bộ trước đó trả `503 DATABASE_NOT_READY`; không xem đây là ca tích hợp cloud đạt.

| Bước tiếp theo của nhóm | Điều kiện kiểm tra |
| --- | --- |
| Nhân review/apply migration `20261103000000_interview_next.sql` sau hai migration đang có; cấu hình Supabase. | Đăng nhập thật, tạo phiên và gọi câu mở đầu thành công; user khác không lấy được phiên. |
| Persistence lưu answer trước khi gọi next. | Truyền đúng ID answer mới nhất; gửi lại cùng ID nhận cùng câu hỏi. |
| Khang nối trang chat theo hợp đồng API. | Hiển thị loading, câu hỏi và lỗi; giữ một request đang chạy; xử lý 409 bằng đúng lượt hiện tại. |
| Ghép SCRUM-93/94 khi các phần đó sẵn sàng. | Tóm tắt lịch sử và streaming không làm mất các ràng buộc context, replay và ownership. |

Reservation phục vụ nhất quán dữ liệu, không thay hệ thống hạn mức gọi AI. Không cần đợi phần chat để review code API, nhưng chỉ nên nghiệm thu luồng end-to-end sau các bước tích hợp trên.
