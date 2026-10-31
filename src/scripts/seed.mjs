// Seed script (SCRUM-55): two test users with a profile, a saved fit analysis and
// sample interview sessions (one in progress, one completed with a report).
//
//   npm run seed
//
// Needs in .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// SEED_USER_PASSWORD (at least 8 characters, used for both test users).
// Safe to run again: users are looked up by email and rows use fixed ids, so
// nothing is duplicated. It only touches the two test users' data.
// Run both migrations in src/supabase/migrations first.

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SEED_USER_PASSWORD;

if (!url || !serviceRoleKey) {
  fail('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.');
}
if (!password || password.length < 8) {
  fail('SEED_USER_PASSWORD must be set in .env.local (at least 8 characters).');
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const USERS = [
  {
    key: 'A',
    email: 'candidate.a@interviewbuddy.test',
    fullName: 'Test Candidate A',
    profile: { field_of_study: 'Information Technology', target_position: 'Frontend Intern', experience_level: 'student', preferred_language: 'vi' },
    analysisId: '00000000-0000-4000-8000-00000000a001',
    sessionIds: ['00000000-0000-4000-8000-00000000a101', '00000000-0000-4000-8000-00000000a102'],
  },
  {
    key: 'B',
    email: 'candidate.b@interviewbuddy.test',
    fullName: 'Test Candidate B',
    profile: { field_of_study: 'Business Administration', target_position: 'Marketing Intern', experience_level: 'fresher', preferred_language: 'en' },
    analysisId: '00000000-0000-4000-8000-00000000b001',
    sessionIds: ['00000000-0000-4000-8000-00000000b101', '00000000-0000-4000-8000-00000000b102'],
  },
];

// Anonymous sample data only – no real CVs (week-4 guide, section 4.2).
const SAMPLE = {
  A: {
    jd: 'Frontend Intern. Required: JavaScript, React, Git. Preferred: unit testing, Docker.',
    cv: 'Third-year IT student. Built two web projects with React and JavaScript. Uses Git in team projects.',
    language: 'vi',
    fitScore: 72,
    result: {
      fitScore: 72,
      matched: [{ skill: 'React', evidence: 'Built two web projects with React' }, { skill: 'Git', evidence: 'Uses Git in team projects' }],
      missing: [{ skill: 'Docker', note: 'Preferred in the JD, not mentioned in the CV' }],
      requirements: [
        { requirement: 'React', status: 'matched', evidence: 'Built two web projects with React' },
        { requirement: 'Docker', status: 'missing', evidence: '' },
      ],
      recommendation: 'Practise Docker basics and prepare one React project story.',
    },
    position: 'Frontend Intern',
    type: 'technical',
  },
  B: {
    jd: 'Marketing Intern. Required: content writing, social media, Excel. Preferred: SEO.',
    cv: 'Fresh graduate in Business Administration. Managed a student club Facebook page and wrote weekly posts.',
    language: 'en',
    fitScore: 58,
    result: {
      fitScore: 58,
      matched: [{ skill: 'Social media', evidence: 'Managed a student club Facebook page' }],
      missing: [{ skill: 'SEO', note: 'Preferred in the JD, not mentioned in the CV' }],
      requirements: [
        { requirement: 'Social media', status: 'matched', evidence: 'Managed a student club Facebook page' },
        { requirement: 'SEO', status: 'missing', evidence: '' },
      ],
      recommendation: 'Add measurable results from the club page and learn basic SEO.',
    },
    position: 'Marketing Intern',
    type: 'behavioral',
  },
};

console.log(`Seeding ${new URL(url).host} ...`);
for (const user of USERS) {
  const id = await upsertUser(user);
  await seedUserData(user, id);
  console.log(`  ✓ ${user.email}  (${id})`);
}
console.log('Done. Sign in with the emails above and SEED_USER_PASSWORD.');

async function upsertUser({ email, fullName }) {
  const existing = await findUserByEmail(email);
  if (existing) {
    // Keep the password in sync with .env.local.
    check(await supabase.auth.admin.updateUserById(existing.id, { password }), `update ${email}`);
    return existing.id;
  }
  const { data } = check(
    await supabase.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: fullName },
    }),
    `create ${email}`,
  );
  return data.user.id;
}

async function findUserByEmail(email) {
  for (let page = 1; ; page++) {
    const { data } = check(await supabase.auth.admin.listUsers({ page, perPage: 200 }), 'list users');
    const found = data.users.find((u) => u.email === email);
    if (found || data.users.length < 200) return found ?? null;
  }
}

async function seedUserData(user, userId) {
  const s = SAMPLE[user.key];

  // The sign-up trigger creates the profile; upsert in case it was deleted.
  check(await supabase.from('profiles').upsert({ id: userId, full_name: user.fullName, ...user.profile }), 'profile');

  check(await supabase.from('fit_analyses').upsert({
    id: user.analysisId, user_id: userId, jd_text: s.jd, cv_text: s.cv, cv_file_name: null,
    language: s.language, fit_score: s.fitScore, result: s.result,
  }), 'fit analysis');

  const [inProgressId, completedId] = user.sessionIds;
  const common = {
    user_id: userId, fit_analysis_id: user.analysisId, round_type: s.type, difficulty: 'medium',
    language: s.language, target_position: s.position, jd_text: s.jd, cv_text: s.cv,
  };
  check(await supabase.from('interview_sessions').upsert([
    { id: inProgressId, ...common, title: `${s.position} – ${s.type}`, status: 'in_progress',
      duration_minutes: 30, planned_questions: 8, input_mode: 'text', interview_date: null,
      started_at: '2026-10-29T20:00:00+07:00', ended_at: null },
    { id: completedId, ...common, title: `${s.position} – ${s.type} (completed)`, status: 'completed',
      duration_minutes: 15, planned_questions: 5, input_mode: 'voice', interview_date: null,
      started_at: '2026-10-25T09:00:00+07:00', ended_at: '2026-10-25T09:16:00+07:00' },
  ]), 'sessions');

  // One answered question with feedback and a report for the completed session,
  // so the history and report pages have something to show.
  const questionId = completedId.replace(/..$/, 'f1');
  const answerId = completedId.replace(/..$/, 'f2');
  check(await supabase.from('questions').upsert({
    id: questionId, session_id: completedId, position: 1, kind: 'main', topic: 'Introduction',
    content: s.language === 'vi' ? 'Hãy giới thiệu ngắn về bản thân và dự án gần nhất của bạn.' : 'Tell me briefly about yourself and your latest project.',
  }), 'question');
  check(await supabase.from('answers').upsert({
    id: answerId, question_id: questionId, input_mode: 'voice', duration_seconds: 75, word_count: 140,
    content: s.language === 'vi' ? 'Em là sinh viên năm ba, gần nhất em làm một website bán sách bằng React...' : 'I recently graduated and managed our club page, where I wrote weekly posts...',
  }), 'answer');
  check(await supabase.from('feedbacks').upsert({
    answer_id: answerId, content_score: 7, structure_score: 6, clarity_score: 8, confidence_score: 7,
    overall_score: 7.0, explanation: 'Clear introduction; the project result could be more specific.',
    strengths: ['Clear and relevant'], improvements: ['Add a measurable result'], sample_answer: null,
    next_action: 'end', model: 'seed-data',
  }, { onConflict: 'answer_id' }), 'feedback');
  check(await supabase.from('reports').upsert({
    session_id: completedId, overall_score: 7.0,
    criteria_scores: { content: 7, structure: 6, clarity: 8, confidence: 7 },
    strengths: ['Clear and relevant answers'], improvements: ['Use the STAR structure', 'Add measurable results'],
    speaking_metrics: { filler_words: 3, words_per_minute: 112, avg_answer_words: 140 },
    summary: 'Seed report for testing the report page.',
  }, { onConflict: 'session_id' }), 'report');
}

function check(result, what) {
  if (result.error) fail(`${what}: ${result.error.message}`);
  return result;
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}
