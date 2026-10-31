// End-to-end test of the Interview Session API (SCRUM-56, SCRUM-57) against a
// running app and the real Supabase project, signed in as the two seed users.
//
//   npm run seed                 (once)
//   npm run dev                  (in another terminal)
//   npm run test:session-api     (or API_BASE_URL=https://<staging> npm run test:session-api)
//
// Needs in .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
// SEED_USER_PASSWORD. Sessions created by the test are deleted at the end.

import { createClient } from '@supabase/supabase-js';

const base = (process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const password = process.env.SEED_USER_PASSWORD;
if (!url || !anonKey || !password) {
  console.error('✗ Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SEED_USER_PASSWORD in .env.local.');
  process.exit(1);
}

const SEED_ANALYSIS = { A: '00000000-0000-4000-8000-00000000a001', B: '00000000-0000-4000-8000-00000000b001' };

async function signIn(email) {
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    console.error(`✗ Cannot sign in as ${email}: ${error.message}. Did you run "npm run seed"?`);
    process.exit(1);
  }
  return { client, token: data.session.access_token };
}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const results = [];
function expect(name, condition, detail) {
  results.push({ name, pass: Boolean(condition) });
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${condition ? '' : `  -> ${JSON.stringify(detail)}`}`);
}

const settings = {
  type: 'technical', difficulty: 'medium', language: 'vi', targetPosition: 'Frontend Intern',
  interviewDate: null, durationMinutes: 30, inputMode: 'text',
};

console.log(`Testing ${base}/api/interview\n`);
const A = await signIn('candidate.a@interviewbuddy.test');
const B = await signIn('candidate.b@interviewbuddy.test');
const created = [];

// 1. Create a session: 201 + sessionId, latest analysis linked automatically.
const r1 = await call('POST', '/api/interview', { token: A.token, body: settings });
expect('1. A creates a session -> 201 with sessionId', r1.status === 201 && r1.body?.sessionId, r1);
expect('   latest saved analysis is linked (UC-05 step 13)', r1.body?.fitAnalysisId === SEED_ANALYSIS.A, r1.body);
if (r1.body?.sessionId) created.push(r1.body.sessionId);

// 2. Missing / invalid fields: 400 with the field names.
const missing = { ...settings };
delete missing.targetPosition;
const r2 = await call('POST', '/api/interview', { token: A.token, body: { ...missing, durationMinutes: 20 } });
expect('2. Missing targetPosition, bad duration -> 400 BAD_INPUT',
  r2.status === 400 && r2.body?.error?.code === 'BAD_INPUT'
  && r2.body.error.fields?.targetPosition && r2.body.error.fields?.durationMinutes, r2);

// 3. Not signed in: 401 for both endpoints.
const r3a = await call('POST', '/api/interview', { body: settings });
const r3b = await call('GET', `/api/interview/${r1.body?.sessionId}`);
expect('3. Not signed in -> 401 (POST and GET)', r3a.status === 401 && r3b.status === 401, { r3a, r3b });

// 4. Cross-user access: B cannot read A's session.
const r4 = await call('GET', `/api/interview/${r1.body?.sessionId}`, { token: B.token });
expect("4. B reads A's session -> 404", r4.status === 404 && r4.body?.error?.code === 'NOT_FOUND', r4);

// Extra checks.
const r5 = await call('GET', `/api/interview/${r1.body?.sessionId}`, { token: A.token });
expect('5. A reads own session -> 200 with settings and analysis',
  r5.status === 200 && r5.body?.settings?.durationMinutes === 30 && r5.body?.settings?.plannedQuestions === 8
  && r5.body?.analysis?.id === SEED_ANALYSIS.A && typeof r5.body?.analysis?.fitScore === 'number', r5);

const r6 = await call('POST', '/api/interview', { token: B.token, body: { ...settings, fitAnalysisId: SEED_ANALYSIS.A } });
expect("6. B links A's analysis -> 400 (analysis not found)",
  r6.status === 400 && r6.body?.error?.fields?.fitAnalysisId, r6);
if (r6.body?.sessionId) created.push(r6.body.sessionId);

const r7 = await call('POST', '/api/interview', { token: A.token, body: { ...settings, fitAnalysisId: null } });
if (r7.body?.sessionId) created.push(r7.body.sessionId);
const r7get = r7.body?.sessionId && await call('GET', `/api/interview/${r7.body.sessionId}`, { token: A.token });
expect('7. fitAnalysisId: null -> session without analysis', r7.status === 201 && r7get?.body?.analysis === null, { r7, r7get });

const r8 = await call('GET', '/api/interview/not-a-uuid', { token: A.token });
expect('8. Invalid id -> 404', r8.status === 404, r8);

// Clean up the sessions this test created (RLS lets each owner delete their own).
for (const id of created) {
  await A.client.from('interview_sessions').delete().eq('id', id);
}

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
