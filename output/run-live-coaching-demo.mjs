import { writeFile } from 'node:fs/promises';
import { createAnalysisService } from '../src/lib/analysis/service.mjs';
import { formatFitResult } from '../src/lib/analysis/analysis-fit.mjs';
import { fixtures } from '../src/tests/helpers.mjs';

const fixture = fixtures.find((item) => item.id === 'CVJD-04');
if (!fixture) throw new Error('Synthetic CVJD-04 fixture is missing.');

const analysis = await createAnalysisService()(fixture.input);
const uiResult = formatFitResult(analysis, fixture.input);
const report = {
  kind: 'synthetic-live-gemini-demo',
  generatedAt: new Date().toISOString(),
  fixtureId: fixture.id,
  input: fixture.input,
  analysis,
  uiResult,
};

await writeFile(new URL('./interviewbuddy-live-coaching-result.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);

const lines = [
  '# Kết quả thử InterviewBuddy',
  '',
  `- Dữ liệu: CV/JD giả lập ${fixture.id}`,
  `- Thời gian: ${report.generatedAt}`,
  `- Model: ${analysis.meta.model}`,
  `- Fit Score: ${uiResult.fitScore}%`,
  '',
  '## Nên bổ sung trước buổi phỏng vấn',
  '',
  ...uiResult.coaching.beforeInterview.map((item) => `### ${item.skill}\n\n${item.advice}\n`),
  '## Điểm mạnh nên nhắc khi phỏng vấn',
  '',
  ...uiResult.coaching.strengths.map((item) => `### ${item.skill}\n\n${item.advice}\n`),
  '## Trạng thái yêu cầu',
  '',
  '| Yêu cầu | Trạng thái |',
  '|---|---|',
  ...uiResult.requirements.map((item) => `| ${item.requirement.replaceAll('|', '\\|')} | ${item.status === 'matched' ? 'Đạt' : 'Thiếu'} |`),
  '',
  '> Nhận xét do AI tạo cho dữ liệu giả lập. Chỉ trình bày kinh nghiệm thực tế của bản thân khi phỏng vấn.',
  '',
];
await writeFile(new URL('./interviewbuddy-live-coaching-result.md', import.meta.url), lines.join('\n'));

console.log(JSON.stringify({
  fixtureId: fixture.id,
  fitScore: uiResult.fitScore,
  preparationItems: uiResult.coaching.beforeInterview.length,
  strengthItems: uiResult.coaching.strengths.length,
  generatedAt: report.generatedAt,
}, null, 2));
