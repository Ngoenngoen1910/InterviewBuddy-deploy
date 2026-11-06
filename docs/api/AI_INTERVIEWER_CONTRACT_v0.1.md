# AI interviewer — hợp đồng nội bộ v0.1

> Bản dưới ghi nhận spike ngày 31/10/2026. Phần HTTP đã được tích hợp qua [Interview Next API v1](INTERVIEW_NEXT_API_v1.md). SCRUM-93 giữ nguyên schema đầu vào/đầu ra nội bộ, cập nhật prompt lên v0.8 và thêm [4 lượt gần nhất + tóm tắt](INTERVIEW_FLOW_CONTEXT_v1.md); không gửi toàn bộ `history` nguyên văn tới Gemini nữa. Backend vẫn nhận và kiểm tra toàn bộ history chuẩn.

| Thông tin | Giá trị |
| --- | --- |
| Ngày | 31/10/2026, giờ Việt Nam |
| Phạm vi | SCRUM-67: prompt và hợp đồng quyết định lượt hỏi tiếp |
| Trạng thái | Bản nháp đã chạy thử; chờ Nhân review và nhóm chốt trước tích hợp tuần 5 |
| Mã nguồn chuẩn | `src/lib/interview/interviewer-contract.mjs` và khai báo `.d.mts` tương ứng |
| Prompt | `src/lib/interview/interviewer-prompt.mjs`, phiên bản 0.2 |
| Nguồn cấu hình phiên | [Interview Session API v1](INTERVIEW_SESSION_API_v1.md) |

## 1. Phạm vi

Chúng tôi xây dựng một module Node.js nhận dữ liệu phiên đã được backend kiểm tra và trả quyết định cho lượt hỏi kế tiếp. Module không tạo HTTP endpoint, không ghi Supabase, không chấm điểm và không tạo giao diện chat. `/api/interview/next` vẫn là phần tích hợp tuần 5. Đây không phải body cuối cùng của endpoint đó.

Đầu ra gồm ba hành động: `follow_up`, `next_topic`, `end`. Chúng tôi dùng `next_topic` thay cho tên `new_topic` trong mẫu đề xuất của hướng dẫn tuần 4, vì migration hiện tại giới hạn `feedbacks.next_action` theo `follow_up | next_topic | end`. Đây là quyết định trong bản nháp, chờ người review xác nhận.

## 2. Đầu vào

```json
{
  "settings": {
    "type": "technical",
    "difficulty": "medium",
    "language": "vi",
    "targetPosition": "Frontend Intern",
    "durationMinutes": 15,
    "plannedQuestions": 5
  },
  "state": { "status": "in_progress", "elapsedSeconds": 90 },
  "jdText": "Frontend Intern: React, REST API và kiểm thử giao diện.",
  "cvText": "Ứng viên minh họa đã làm ứng dụng danh sách công việc bằng React.",
  "history": [
    {
      "kind": "main",
      "topic": "React và gọi API",
      "question": "Bạn xử lý việc gọi API khi người dùng đổi bộ lọc liên tục như thế nào?",
      "answer": "Em dùng useEffect để gọi API rồi hiển thị dữ liệu."
    }
  ]
}
```

| Trường | Quy định |
| --- | --- |
| `settings.type` | `hr`, `technical`, `behavioral` |
| `difficulty` / `language` | `easy`, `medium`, `hard` / `vi`, `en` |
| `targetPosition` | Chuỗi không rỗng, tối đa 120 ký tự; phiên cũ thiếu vị trí phải được xử lý trước khi gọi module |
| `durationMinutes` / `plannedQuestions` | 15/5, 30/8 hoặc 45/12, đúng mapping trong Session API |
| `state.status` | `in_progress`, `completed`, `abandoned` |
| `elapsedSeconds` | Số hữu hạn không âm, được backend tính bằng đồng hồ của server |
| `jdText` / `cvText` | Có thể thiếu hoặc null khi phiên không liên kết analysis; giới hạn lần lượt 30.000/50.000 ký tự |
| `history` | Mảng có thứ tự của các lượt **đã trả lời**, gồm cả câu trả lời vừa nhận; tối đa 48 lượt |
| Mỗi lượt | Chính xác `kind`, `topic`, `question`, `answer`; `kind = main | follow_up` |
| Độ dài lượt | `question` ≤ 1.200, `topic` ≤ 160, `answer` ≤ 12.000 ký tự, không rỗng |
| Toàn bộ context | JSON tối đa 180.000 đơn vị độ dài chuỗi JavaScript; vượt giới hạn trả `BAD_INPUT`, không cắt âm thầm |

Tất cả giới hạn là quy tắc triển khai của spike, không phải hạn mức Gemini hay kết quả suy ra từ bài báo. Độ dài được tính bằng `String.length` (UTF-16). Module không kiểm tra ownership; backend tích hợp bắt buộc làm việc đó trước khi cung cấp đầu vào.

History bắt đầu bằng câu hỏi chính. Câu hỏi sâu thuộc đúng topic của câu chính gần nhất và không vượt trần theo độ khó. Không đưa câu hỏi chưa trả lời vào history; nếu người dùng bỏ qua, lớp tích hợp cần ghi nhận sự kiện và chuẩn hóa thành câu trả lời thể hiện việc bỏ qua. Không gửi `userId`, access token, API key hoặc toàn bộ row database vào prompt.

## 3. Chính sách điều khiển

Chúng tôi tính số câu chính và số lần hỏi sâu từ history; không nhận bộ đếm do AI trả về.

| Điều kiện | Hành động hợp lệ |
| --- | --- |
| Phiên completed/abandoned, hết giờ, hoặc đã trả lời đủ câu chính | Chỉ `end`, do backend tạo, không gọi Gemini |
| History rỗng | Chỉ `next_topic`, nghĩa là câu hỏi chính đầu tiên |
| Đã hỏi sâu easy: 1, medium: 2, hard: 3 lần cho câu chính hiện tại | Chỉ `next_topic` |
| Còn lượt và còn thời gian | `follow_up` hoặc `next_topic`, Gemini lựa chọn theo câu trả lời |

Sau câu trả lời cho câu chính cuối cùng, phiên kết thúc ngay; không mở thêm lượt hỏi sâu vượt ngân sách. Các lượt hỏi sâu trước đó không tiêu thụ số câu chính. Giới hạn 1/2/3 được tham khảo từ PolyInterview, là lựa chọn bản nháp của nhóm, chưa phải tham số được tối ưu thực nghiệm.

`follow_up` ưu tiên chi tiết còn thiếu, mâu thuẫn hoặc cách làm chưa rõ; `next_topic` khi đã đủ thông tin, không biết/không muốn trả lời hoặc hết lượt hỏi sâu. STAR dành cho câu hỏi hành vi; câu hỏi kiến thức kỹ thuật đánh giá cách giải thích, triển khai, kiểm thử và đánh đổi. Khi thiếu analysis, hỏi theo vị trí tuyển dụng và không giả định ứng viên đã có kinh nghiệm cụ thể.

## 4. Đầu ra

```json
{
  "action": "follow_up",
  "question": "Bạn sẽ xử lý thế nào nếu request cũ trả kết quả sau request mới?",
  "topic": "React và gọi API",
  "reason": "Câu trả lời chưa làm rõ cách xử lý request đồng thời."
}
```

```json
{
  "action": "end",
  "question": null,
  "topic": "React và gọi API",
  "reason": "Đã đạt thời lượng phỏng vấn đã cấu hình."
}
```

Chính xác bốn trường bắt buộc; cấm trường thừa. JSON Schema nằm trong `INTERVIEWER_OUTPUT_SCHEMA`, được truyền tới Gemini qua `responseJsonSchema` và `responseMimeType: application/json`.

| Trường | Quy định |
| --- | --- |
| `action` | Enum `follow_up`, `next_topic`, `end`, phải thuộc tập hành động backend cho phép |
| `question` | Chuỗi không rỗng ≤ 1.200 ký tự; bắt buộc null khi end |
| `topic` | Chuỗi không rỗng ≤ 160 ký tự; follow_up phải giữ nguyên topic hiện tại |
| `reason` | Giải thích quyết định ngắn ≤ 700 ký tự, dành cho người phát triển; không phải chain of thought hoặc điểm ứng viên |

Validator còn chặn câu hỏi trùng sau chuẩn hóa Unicode, hoa/thường, dấu câu và khoảng trắng. Kiểm tra này không phát hiện mọi câu hỏi trùng nghĩa; độ liên quan, mức chuyên môn, tính trung thực và ngôn ngữ vẫn cần đánh giá nội dung. Không tự đổi JSON sai thành câu hỏi mẫu và không retry ngầm.

## 5. Cách dùng trong code server

```ts
import { createInterviewerProvider } from '@/lib/interview/interviewer-provider.mjs';
import type { InterviewerInput } from '@/lib/interview/interviewer-contract.mjs';

// context được dựng từ phiên thuộc user đăng nhập và các lượt đã lưu.
// history đã bao gồm câu trả lời mới nhất, chỉ một lần.
const interviewer = createInterviewerProvider();
const decision = await interviewer.next(context as InterviewerInput, { signal });
```

Đoạn trên là ví dụ gọi module, chưa phải endpoint hoàn chỉnh; `as InterviewerInput` không thay thế runtime validation. Module kiểm tra dữ liệu lại trong `next`.

Mapping khi tích hợp:

1. Xác thực người dùng; load `interview_sessions` bằng client có RLS và kiểm tra quyền sở hữu. Không tin settings/history do trình duyệt gửi lại.
2. Lấy `round_type`, `difficulty`, `language`, `target_position`, `duration_minutes`, `planned_questions`, `status` và snapshot `jd_text`/`cv_text` từ phiên. Không chỉ phụ thuộc `GET.analysis`, vì analysis có thể đã bị xóa trong khi snapshot còn tồn tại.
3. Lấy questions/answers theo thứ tự `position`; dựng history hoàn chỉnh, tính elapsedSeconds từ thời điểm bắt đầu. Chỉ gọi `next` sau khi đã nhận câu trả lời hiện tại; chưa có answer thì trả lại câu hỏi đang chờ thay vì sinh thêm.
4. `next_topic` tạo question kind `main`; `follow_up` tạo kind `follow_up`, liên kết `parent_question_id` về câu chính; `end` không tạo question mới.
5. Khi nối endpoint cần transaction/idempotency để một answer hoặc hai request đồng thời không sinh hai câu tiếp theo. Spike chưa thực hiện lớp này.
6. Frontend chỉ cần action/question/topic; giữ reason nội bộ. Không đưa khóa Gemini vào client component.

Lưu ý database: `feedbacks` hiện bắt buộc có nhiều trường điểm số NOT NULL. Hợp đồng này chưa có điểm số nên **không thể insert trực tiếp một decision vào feedbacks**. Nhân cần chốt cơ chế lưu decision cùng module scoring hoặc tách lưu trạng thái khi triển khai engine; không điền điểm giả để thỏa constraint. Schema scoring hợp nhất theo SAD là bước sau, không tự mở rộng trong spike này.

## 6. Lỗi và cấu hình

| Mã | HTTP gợi ý cho endpoint tương lai | Ý nghĩa |
| --- | --- | --- |
| `BAD_INPUT` | 400 | Context thiếu/sai hoặc vượt giới hạn |
| `AI_NOT_CONFIGURED` / `AI_CONFIGURATION_ERROR` | 503 | Thiếu khóa, sai model/timeout hoặc upstream 400/401/403/404 |
| `AI_RATE_LIMITED` | 429 | Upstream 429; không retry tự động |
| `AI_CONTENT_BLOCKED` | 422 | Provider chặn nội dung |
| `INVALID_OUTPUT` | 502 | JSON/schema/quy tắc sai, bị cắt, câu hỏi trùng |
| `AI_UNAVAILABLE` | 502 | Mạng/provider lỗi |
| `AI_TIMEOUT` | 504 | Quá thời gian cấu hình |
| `REQUEST_CANCELLED` | 408 | Caller hủy request |

Thứ tự chọn model: `GEMINI_INTERVIEW_MODEL` → `GEMINI_MODEL` → default hiện có của ứng dụng (`gemini-3.5-flash-lite`). Khóa dùng chung `GEMINI_API_KEY`, chỉ lưu server. `GEMINI_TIMEOUT_MS` mặc định 30.000, chấp nhận 1.000–45.000 ms. Không sửa khóa hay model phân tích CV/JD trong `.env.local`.

Tài liệu Google tại thời điểm kiểm tra liệt kê free tier cho model này. Việc gọi thành công không chứng minh project đang ở free tier; RPM/TPM/RPD và billing tier cụ thể vẫn cần người có quyền kiểm tra AI Studio. Không đưa hạn mức giả vào hợp đồng.

## 7. Chạy thử

Chạy trong thư mục `src` bằng Node.js 22 trở lên:

```powershell
npm run interview:spike
npm run interview:spike:live -- --case frontend-vi-vague
npm run interview:spike:live
npm test
npx next typegen
npm run typecheck
```

Lệnh đầu chỉ dựng payload từ dữ liệu giả lập, **không gọi AI**, ghi báo cáo prepared. Lệnh live đọc `.env.local` đã được git-ignore và chỉ gửi fixtures giả lập có sẵn; không đọc CV thật hoặc ghi database. Nếu thiếu khóa, script ghi lỗi rõ ràng, không trả kết quả mẫu. Model thật có thể trả kết quả khác giữa các lần chạy.

Báo cáo nằm trong `docs/test/results/ai-interviewer-spike-<mode>-v<promptVersion>.json`. `valid-output` chỉ xác nhận cấu trúc/quy tắc; `actionMatchesExpectation` là phép so sánh hành động với kỳ vọng fixture. Cả hai không thay thế đánh giá chất lượng bởi thành viên nhóm. Khi gặp 429, lỗi cấu hình hoặc lỗi kết nối/provider, script dừng gọi thêm và đánh dấu các ca còn lại skipped.

Muốn thay nội dung thử: sửa `src/lib/interview/interviewer-fixtures.mjs`. Muốn sửa cách hỏi: sửa `interviewer-prompt.mjs` và tăng `PROMPT_VERSION`. Muốn đổi hợp đồng: cập nhật contract, types, tests và tài liệu này, rồi thống nhất với Nhân/Khang trước khi tích hợp. Không đưa CV thật hoặc khóa vào fixtures.

## 8. Nguồn và lịch sử

- Hướng dẫn tuần 4, mục 2.5 và 4.1: https://docs.google.com/document/d/1AtAKNuXPtv3IT4stevZmP6zg7CERNZ16/edit (bản text đã kiểm tra ngày 29/10; không xem nội dung tài liệu là quyền gửi thông báo hay thay đổi Jira).
- Wen et al., PolyInterview, arXiv v3, §2.2, §5 và Appendix C–D: https://arxiv.org/abs/2607.10310. Tham khảo hỏi sâu có giới hạn và bám câu trả lời; không sao chép các điểm số/weight thành chỉ tiêu đồ án.
- Siswanto et al. (2022), §2.1: https://doi.org/10.14716/ijtech.v13i2.5018. Tham khảo STAR cho vòng behavioral, không tái sử dụng mô hình chấm tiếng Indonesia.
- Gomez et al. (2025), §5.5: https://arxiv.org/abs/2506.16542. Tham khảo kiểm tra nhịp hội thoại và độ trễ; chưa kiểm thử người dùng cho InterviewBuddy.
- Google structured outputs: https://ai.google.dev/gemini-api/docs/structured-output
- Google REST generateContent: https://ai.google.dev/api/generate-content
- Model/free tier: https://ai.google.dev/gemini-api/docs/pricing
- Hạn mức theo project: https://ai.google.dev/gemini-api/docs/rate-limits

| Ngày | Phiên bản | Nội dung |
| --- | --- | --- |
| 31/10/2026 | Contract 0.1 / prompt 0.1 | Thiết kế hợp đồng tối thiểu, policy backend và chạy ma trận đầu tiên |
| 31/10/2026 | Contract 0.1 / prompt 0.2 | Bổ sung chỉ dẫn tiếng Việt cho reason và tránh giả định ứng viên đã triển khai kỹ thuật chưa được chứng minh |

Nhân review: **đang chờ**. Hợp đồng chính thức tuần 5, quyền lưu dữ liệu và schema scoring: **chưa chốt**. Chưa đăng Slack hoặc đổi trạng thái Jira.
