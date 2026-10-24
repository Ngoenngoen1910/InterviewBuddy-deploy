import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ProgressOverview from "@/components/dashboard/ProgressOverview";
import UpcomingPractice from "@/components/dashboard/UpcomingPractice";

const stats = [
  { label: "Total Sessions", value: "12", note: "+3 phiên trong tháng" },
  { label: "Average Score", value: "78%", note: "+12% so với tháng trước" },
  {
    label: "Upcoming Interview",
    value: "28/10/2026",
    note: "Software Engineer Intern",
  },
  {
    label: "Strongest Area",
    value: "Problem Solving",
    note: "Dựa trên các phiên gần đây",
  },
];

const sessions = [
  {
    role: "Software Engineer",
    type: "Technical Interview",
    date: "20/10/2026",
    score: 85,
  },
  {
    role: "Product Manager",
    type: "Behavioral Interview",
    date: "16/10/2026",
    score: 72,
  },
  {
    role: "Data Analyst",
    type: "Technical + Behavioral",
    date: "10/10/2026",
    score: 68,
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Dữ liệu bên dưới là dữ liệu minh họa.
        </p>
      </div>

      <section className="rounded-2xl border border-indigo-100 bg-indigo-50 p-6 sm:p-8">
        <p className="text-xs font-semibold tracking-widest text-indigo-600">
          WELCOME BACK!
        </p>

        <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
          Ready for your next interview?
        </h2>

        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
          Luyện phỏng vấn với AI theo vị trí mong muốn, nhận phản hồi
          và cải thiện sự tự tin qua từng buổi luyện tập.
        </p>

        <Button
          disabled
          aria-describedby="new-interview-note"
          className="mt-5"
        >
          Start New Interview
        </Button>

        <p
          id="new-interview-note"
          className="mt-2 text-xs text-slate-500"
        >
          Tính năng sẽ được bật khi trang Interview Setup hoàn thành.
        </p>
      </section>

      <section
        aria-label="Thống kê tổng quan"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {stats.map((stat) => (
          <Card key={stat.label}>
            <h2 className="text-sm text-slate-500">{stat.label}</h2>
            <p className="mt-3 text-xl font-bold">{stat.value}</p>
            <p className="mt-2 text-xs text-slate-500">{stat.note}</p>
          </Card>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="min-w-0">
          <h2 className="text-lg font-semibold">Recent Sessions</h2>

          <ul className="mt-4 divide-y divide-slate-100">
            {sessions.map((session) => (
              <li
                key={`${session.role}-${session.date}`}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div>
                  <h3 className="text-sm font-semibold">
                    {session.role}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {session.type}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {session.date}
                  </p>
                </div>

                <span className="rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700">
                  {session.score}%
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <ProgressOverview />

        <Card className="min-w-0">
          <h2 className="text-lg font-semibold">
            Recommended Next Steps
          </h2>

          <ol className="mt-4 list-inside list-decimal space-y-4 text-sm text-slate-600">
            <li>Luyện cấu trúc dữ liệu và giải thuật.</li>
            <li>Chuẩn bị câu trả lời theo phương pháp STAR.</li>
            <li>Thực hiện một buổi phỏng vấn thử đầy đủ.</li>
          </ol>
        </Card>

        <UpcomingPractice />
      </div>
    </div>
  );
}
