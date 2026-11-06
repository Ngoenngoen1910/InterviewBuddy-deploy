import type { AnalyzeFitResponse } from "./types";

// Sample response used while /api/analyze-fit is not merged yet.
// Turn it on with NEXT_PUBLIC_ANALYZE_MOCK=1 in .env.local. Replace it with
// the exact example Hưng posts on Slack so both sides test the same JSON.
export const MOCK_ANALYZE_FIT: AnalyzeFitResponse = {
  fitScore: 78,
  matched: [
    { skill: "JavaScript", evidence: "CV: mục Kỹ năng và 2 dự án web" },
    { skill: "React", evidence: "CV: 2 dự án dùng React" },
    { skill: "Node.js", evidence: "CV: backend dự án quản lý thư viện" },
    { skill: "Git", evidence: "CV: làm việc nhóm qua GitHub" },
    { skill: "REST API", evidence: "CV: tự viết API cho dự án cá nhân" },
  ],
  missing: [
    { skill: "Docker", note: "JD yêu cầu, CV không nhắc đến" },
    { skill: "Unit testing", note: "CV có nhắc nhưng không có chi tiết" },
    { skill: "System design", note: "JD yêu cầu, CV không nhắc đến" },
  ],
  requirements: [
    { requirement: "Biết React", status: "matched", evidence: "2 dự án dùng React" },
    { requirement: "Backend với Node.js", status: "matched", evidence: "Dự án quản lý thư viện" },
    { requirement: "Dùng Git", status: "matched", evidence: "Nhắc trong kỹ năng và dự án" },
    { requirement: "Viết unit test", status: "partial", evidence: "Có nhắc, không có chi tiết" },
    { requirement: "Docker / container", status: "missing", evidence: "Không có trong CV" },
  ],
  recommendation:
    "Nên bổ sung kinh nghiệm Docker và viết unit test cho một dự án nhỏ trước khi phỏng vấn.",
  coaching: {
    beforeInterview: [
      { skill: "Docker", advice: "Ôn sự khác nhau giữa image và container, Dockerfile, ánh xạ cổng và biến môi trường. Hãy đóng gói một ứng dụng Node.js nhỏ, build image, chạy container rồi kiểm tra một endpoint hoạt động; ghi lại lỗi build hoặc runtime bạn đã xử lý. Khi phỏng vấn, giải thích cách bạn chọn base image và vì sao không đưa khóa bí mật vào image; nếu đây chỉ là bài thực hành, hãy nói rõ như vậy." },
      { skill: "Unit testing", advice: "Ôn cách tách logic cần kiểm thử, tạo dữ liệu đầu vào và so sánh kết quả mong đợi với kết quả thực tế. Chọn một hàm trong dự án bạn từng làm, viết ca kiểm thử cho trường hợp bình thường, dữ liệu biên và lỗi đầu vào, rồi chạy test để xem báo cáo. Khi phỏng vấn, trình bày bạn chọn các trường hợp đó vì rủi ro gì và test nào sẽ phát hiện lỗi hồi quy." },
    ],
    improvements: [
      { skill: "React", advice: "Làm rõ vai trò của bạn và kết quả đạt được trong dự án React đã nêu ở CV." },
      { skill: "Docker", advice: "Đối chiếu yêu cầu Docker với kinh nghiệm thực tế trước khi bổ sung vào CV." },
    ],
    strengths: [
      { skill: "React", advice: "Hãy chọn một tính năng React bạn thực sự đã triển khai và giải thích cách chia component, quản lý state và truyền dữ liệu giữa các phần giao diện. Chuẩn bị mô tả một lỗi cập nhật giao diện hoặc trường hợp dữ liệu bất thường bạn từng xử lý, cùng cách bạn kiểm tra bản sửa. Nếu được hỏi về hiệu năng, hãy phân biệt vấn đề bạn đã gặp với những tối ưu chỉ mới tìm hiểu." },
      { skill: "Git", advice: "Hãy trình bày quy trình Git bạn thực sự dùng khi làm việc nhóm: tạo nhánh, commit thay đổi và hợp nhất mã. Chuẩn bị giải thích cách nhóm rà soát thay đổi hoặc xử lý xung đột nếu bạn đã tham gia các bước đó. Người phỏng vấn có thể hỏi khi nào nên rebase hoặc merge; hãy nêu lựa chọn phù hợp với quy trình nhóm thay vì khẳng định một cách luôn đúng." },
    ],
  },
};

export const MOCK_ANALYZE_FIT_EN: AnalyzeFitResponse = {
  fitScore: 78,
  matched: [
    { skill: "JavaScript", evidence: "CV: skills section and two web projects" },
    { skill: "React", evidence: "CV: two React projects" },
    { skill: "Node.js", evidence: "CV: library management backend" },
    { skill: "Git", evidence: "CV: team collaboration through GitHub" },
    { skill: "REST API", evidence: "CV: APIs built for a personal project" },
  ],
  missing: [
    { skill: "Docker", note: "Required by the JD but not mentioned in the CV" },
    { skill: "Unit testing", note: "Mentioned without implementation details" },
    { skill: "System design", note: "Required by the JD but not mentioned in the CV" },
  ],
  requirements: [
    { requirement: "React", status: "matched", evidence: "Two React projects" },
    { requirement: "Node.js backend development", status: "matched", evidence: "Library management project" },
    { requirement: "Git", status: "matched", evidence: "Listed under skills and projects" },
    { requirement: "Unit testing", status: "partial", evidence: "Mentioned without details" },
    { requirement: "Docker / containers", status: "missing", evidence: "Not mentioned in the CV" },
  ],
  recommendation: "Practise Docker and add unit tests to a small project before your interview.",
  coaching: {
    beforeInterview: [
      { skill: "Docker", advice: "Review images versus containers, Dockerfiles, port mapping and environment variables. Package a small Node.js application, build its image and verify an endpoint inside the running container. Prepare to explain your base-image choice and why secrets must stay outside the image; describe this honestly as practice if it is not professional experience." },
      { skill: "Unit testing", advice: "Review how to isolate logic, prepare inputs and compare actual results with expected outcomes. Write tests for a normal case, a boundary case and invalid input in a project you have worked on. Explain which risks these cases cover and which test would catch a regression." },
    ],
    improvements: [
      { skill: "React", advice: "Clarify your contribution and the results of the React project listed in your CV." },
      { skill: "Docker", advice: "Compare the Docker requirement with your actual experience before updating your CV." },
    ],
    strengths: [
      { skill: "React", advice: "Choose a React feature you actually implemented and explain component boundaries, state management and data flow. Prepare an example of a UI update bug or unusual input you handled and how you checked the fix. Distinguish performance improvements you implemented from techniques you have only studied." },
      { skill: "Git", advice: "Explain the Git workflow you used with your team, including branches, commits and integration. Prepare to discuss code review or conflict resolution if you participated in those activities. Explain when a rebase or merge would suit that workflow rather than presenting one option as universally correct." },
    ],
  },
};
