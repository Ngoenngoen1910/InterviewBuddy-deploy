import Card from "@/components/ui/Card";

const results = [
  { date: "25/09", score: 50 },
  { date: "01/10", score: 60 },
  { date: "08/10", score: 68 },
  { date: "14/10", score: 72 },
  { date: "20/10", score: 80 },
  { date: "22/10", score: 85 },
];

const points = results.map((result, index) => ({
  ...result,
  x: 40 + index * 60,
  y: 180 - result.score * 1.5,
}));

const linePoints = points
  .map((point) => `${point.x},${point.y}`)
  .join(" ");

export default function ProgressOverview() {
  return (
    <Card className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Progress Overview</h2>

        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500">
          6 phiên gần nhất
        </span>
      </div>

      <p className="mt-2 text-sm text-slate-500">
        Điểm số qua các buổi luyện tập — dữ liệu mẫu.
      </p>

      <svg
        viewBox="0 0 380 220"
        role="img"
        aria-label="Điểm 6 phiên mẫu lần lượt là 50, 60, 68, 72, 80 và 85 trên 100."
        className="mt-4 block h-auto w-full"
      >
        {[0, 25, 50, 75, 100].map((score) => {
          const y = 180 - score * 1.5;

          return (
            <g key={score}>
              <line
                x1="40"
                y1={y}
                x2="340"
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
              />
              <text
                x="30"
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="#64748b"
              >
                {score}
              </text>
            </g>
          );
        })}

        <polygon
          points={`40,180 ${linePoints} 340,180`}
          fill="#eef2ff"
        />

        <polyline
          points={linePoints}
          fill="none"
          stroke="#4f46e5"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((point) => (
          <g key={point.date}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill="#4f46e5"
              stroke="white"
              strokeWidth="2"
            />

            <text
              x={point.x}
              y={point.y - 12}
              textAnchor="middle"
              fontSize="11"
              fill="#4338ca"
            >
              {point.score}
            </text>

            <text
              x={point.x}
              y="205"
              textAnchor="middle"
              fontSize="11"
              fill="#64748b"
            >
              {point.date}
            </text>
          </g>
        ))}
      </svg>
    </Card>
  );
}
