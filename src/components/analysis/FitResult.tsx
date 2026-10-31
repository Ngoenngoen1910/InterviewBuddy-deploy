import Card from "@/components/ui/Card";
import type { AnalyzeFitResponse, RequirementStatus } from "@/lib/analysis/types";

const STATUS: Record<RequirementStatus, { label: string; dot: string; text: string }> = {
  matched: { label: "Đạt", dot: "bg-green-500", text: "text-green-700" },
  partial: { label: "Một phần", dot: "bg-amber-500", text: "text-amber-700" },
  missing: { label: "Thiếu", dot: "bg-red-500", text: "text-red-700" },
};

export default function FitResult({ result }: { result: AnalyzeFitResponse }) {
  const score = Math.max(0, Math.min(100, Math.round(result.fitScore)));
  return (
    <div className="space-y-4" aria-live="polite">
      {/* Score */}
      <Card className="flex flex-col items-center gap-5 sm:flex-row">
        <ScoreRing score={score} />
        <div>
          <h3 className="text-lg font-semibold">Mức độ phù hợp</h3>
          <p className="mt-1 text-sm text-slate-600">{scoreMessage(score)}</p>
        </div>
      </Card>

      {/* Gemini-written preparation priorities, checked against missing skills */}
      <Card>
        <h3 className="font-semibold text-amber-900">Nên bổ sung trước buổi phỏng vấn</h3>
        {result.coaching.beforeInterview.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            Chưa tìm thấy yêu cầu kỹ năng nào thiếu bằng chứng trong CV.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {result.coaching.beforeInterview.map((item) => (
              <li key={item.skill} className="rounded-lg bg-amber-50 p-3 text-sm">
                <p className="font-medium text-amber-950">{item.skill}</p>
                <p className="mt-1 leading-relaxed text-amber-900">{item.advice}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Requirement status without CV evidence */}
      <Card>
        <h3 className="font-semibold">Yêu cầu trong JD và CV của bạn</h3>
        <table className="mt-3 w-full table-fixed text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th scope="col" className="w-2/3 py-2 pr-3 font-medium">Yêu cầu</th>
              <th scope="col" className="w-1/3 py-2 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {result.requirements.map((item, index) => {
              const status = STATUS[item.status] ?? STATUS.missing;
              return (
                <tr key={`${item.requirement}-${index}`} className="border-b border-slate-100 last:border-0">
                  <td className="break-words py-2 pr-3 text-slate-900">{item.requirement}</td>
                  <td className={`py-2 ${status.text}`}>
                    <span className={`mr-2 inline-block h-2 w-2 rounded-full ${status.dot}`} aria-hidden="true" />
                    {status.label}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Gemini-written technical talking points */}
      <Card>
        <h3 className="font-semibold text-green-800">Điểm mạnh nên nhắc khi phỏng vấn</h3>
        {result.coaching.strengths.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            Chưa có kỹ năng phù hợp để nêu thành điểm mạnh.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {result.coaching.strengths.map((item) => (
              <li key={item.skill} className="rounded-lg bg-green-50 p-3 text-sm">
                <p className="font-medium text-green-900">{item.skill}</p>
                <p className="mt-1 leading-relaxed text-green-900">{item.advice}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-xs text-slate-500">
        Kết quả do AI tạo ra để bạn tham khảo khi luyện tập và có thể chưa chính xác.
      </p>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const color = score >= 70 ? "text-green-500" : score >= 40 ? "text-amber-500" : "text-red-500";

  return (
    <div className="relative h-28 w-28 shrink-0" role="img" aria-label={`Điểm phù hợp ${score}%`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="10" className="stroke-slate-200" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          className={color}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold">
        {score}%
      </span>
    </div>
  );
}

function scoreMessage(score: number) {
  if (score >= 70) return "Rất tốt! CV của bạn đáp ứng phần lớn yêu cầu của vị trí này.";
  if (score >= 40) return "Khá phù hợp. Hãy bổ sung các kỹ năng còn thiếu trước khi phỏng vấn.";
  return "Còn khá xa so với yêu cầu. Xem lời khuyên bên dưới để chuẩn bị tốt hơn.";
}
