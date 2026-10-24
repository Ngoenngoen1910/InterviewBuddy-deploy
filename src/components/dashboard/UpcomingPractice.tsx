import Card from "@/components/ui/Card";

export default function UpcomingPractice() {
  return (
    <Card className="min-w-0">
      <h2 className="text-lg font-semibold">Upcoming Practice</h2>

      <p className="mt-2 text-sm text-slate-500">
        Lịch luyện tập minh họa.
      </p>

      <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-lg bg-white px-3 py-2 text-center">
            <p className="text-xs font-medium text-indigo-600">
              THÁNG 10
            </p>
            <p className="text-2xl font-bold text-indigo-700">24</p>
          </div>

          <div className="min-w-0">
            <h3 className="text-sm font-semibold">
              Technical Interview
            </h3>

            <p className="mt-1 text-sm text-slate-600">
              Software Engineer Intern
            </p>

            <p className="mt-2 text-xs text-slate-500">
              24/10/2026 · 16:00–16:45 · Giờ Việt Nam
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-sky-50 p-4">
        <h3 className="text-sm font-semibold text-sky-800">
          Tip for Success
        </h3>

        <p className="mt-2 text-sm leading-6 text-sky-700">
          Dành 2–3 buổi mỗi tuần để luyện tập. Sau mỗi buổi,
          xem lại phản hồi và chọn một điểm cần cải thiện.
        </p>
      </div>
    </Card>
  );
}
