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
};
