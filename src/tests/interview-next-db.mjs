import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createNextRepository } from '../lib/interview/next-repository.mjs';

export const USER_A = '00000000-0000-4000-8000-000000000001';
export const USER_B = '00000000-0000-4000-8000-000000000002';
export async function createTestDatabase() {
  const db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to authenticated, anon;`);
  for (const file of ['20261021000000_initial_schema.sql', '20261030000000_interview_session_settings.sql', '20261103000000_interview_next.sql']) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  }
  await db.exec(`grant select, insert, update, delete on public.interview_sessions, public.questions,
    public.answers, public.fit_analyses to authenticated;
    insert into auth.users(id) values ('${USER_A}'), ('${USER_B}');`);
  async function user(id = USER_A) {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
    await db.exec('set role authenticated');
  }
  await user();
  const functions = {
    claim_interview_next: ['p_session_id', 'p_after_answer_id'],
    finish_interview_next: ['p_session_id', 'p_after_answer_id', 'p_token', 'p_decision', 'p_metadata'],
    release_interview_next: ['p_session_id', 'p_after_answer_id', 'p_token'],
  };
  const repository = createNextRepository({ rpc: async (name, args) => {
    if (!functions[name]) throw new Error('Unexpected test RPC');
    const params = functions[name].map((key) => args[key]);
    try {
      const result = await db.query(`select public.${name}(${params.map((_, i) => '$' + (i + 1)).join(',')}) as result`, params);
      return { data: result.rows[0].result, error: null };
    } catch (error) { return { data: null, error }; }
  } });
  async function session(settings = {}) {
    const id = randomUUID();
    await db.query(`insert into public.interview_sessions(id,round_type,difficulty,language,target_position,
      duration_minutes,planned_questions,jd_text,cv_text) values($1,$2,$3,$4,$5,15,5,$6,$7)`,
    [id, settings.type ?? 'technical', settings.difficulty ?? 'medium', settings.language ?? 'vi',
      settings.position ?? 'Frontend Intern', settings.jd ?? 'Use React and REST API. Test loading states and failed requests.',
      settings.cv ?? 'Built a React task list that calls a REST API. No professional experience.']);
    return id;
  }
  async function answer(questionId, content = 'I would cancel outdated requests and test the loading state.') {
    const result = await db.query('insert into public.answers(question_id,content) values($1,$2) returning id', [questionId, content]);
    return result.rows[0].id;
  }
  return { db, user, repository, session, answer };
}
