import type { Metadata } from "next";
import AnalysisWorkspace from "@/components/analysis/AnalysisWorkspace";

export const metadata: Metadata = {
  title: "Phân tích CV và JD – InterviewBuddy",
};

// Screen 2 (JD & CV Analysis). Owner: Khang.
export default function AnalysisPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analyze Your Fit</h1>
        <p className="mt-1 text-sm text-slate-500">
          So sánh JD với CV để biết bạn phù hợp đến đâu, điểm mạnh, kỹ năng còn thiếu và nên chuẩn
          bị gì trước buổi phỏng vấn.
        </p>
      </div>

      <AnalysisWorkspace />
    </div>
  );
}
