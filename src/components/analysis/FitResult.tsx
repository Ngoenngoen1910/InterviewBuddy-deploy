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

      {/* Matched / missing skills */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-semibold text-green-700">
            Kỹ năng đã có ({result.matched.length})
          </h3>
          {result.matched.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa tìm thấy kỹ năng nào khớp với JD.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {result.matched.map((s) => (
                <li
                  key={s.skill}
                  title={s.evidence}
                  className="rounded-full bg-green-50 px-3 py-1 text-sm text-green-800"
                >
                  {s.skill}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="mb-3 font-semibold text-red-700">
            Kỹ năng còn thiếu ({result.missing.length})
          </h3>
          {result.missing.length === 0 ? (
            <p className="text-sm text-slate-500">Không thiếu kỹ năng nào. Tuyệt vời!</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {result.missing.map((s) => (
                <li
                  key={s.skill}
                  title={s.note}
                  className="rounded-full bg-red-50 px-3 py-1 text-sm text-red-800"
                >
                  {s.skill}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Requirements table */}
      <Card>
        <h3 className="font-semibold">Yêu cầu trong JD và CV của bạn</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs text-slate-500 uppercase">
              <tr>
                <th scope="col" className="py-2 pr-3 font-medium">Yêu cầu</th>
                <th scope="col" className="py-2 pr-3 font-medium">Trạng thái</th>
                <th scope="col" className="py-2 font-medium">Bằng chứng từ CV</th>
              </tr>
            </thead>
            <tbody>
              {result.requirements.map((r, i) => {
                const s = STATUS[r.status] ?? STATUS.missing;
                return (
                  <tr key={`${r.requirement}-${i}`} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3 text-slate-900">{r.requirement}</td>
                    <td className={`py-2 pr-3 whitespace-nowrap ${s.text}`}>
                      <span className={`mr-2 inline-block h-2 w-2 rounded-full ${s.dot}`} aria-hidden="true" />
                      {s.label}
                    </td>
                    <td className="py-2 text-slate-600">{r.evidence || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Recommendation */}
      <Card className="border-amber-200 bg-amber-50">
        <h3 className="font-semibold text-amber-900">Lời khuyên</h3>
        <p className="mt-1 text-sm text-amber-900">{result.recommendation}</p>
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
