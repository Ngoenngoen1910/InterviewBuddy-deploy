-- InterviewBuddy: initial database schema (Sprint 2, week 3)
--
-- Users are stored by Supabase Auth in auth.users. Every table below belongs to
-- exactly one user, directly (user_id) or through its interview session.
-- Row Level Security (RLS) is enabled on every table: a signed-in user can only
-- read and change their own rows. The service_role key bypasses RLS and is used
-- only on the server.
--
-- Run it once: Supabase dashboard > SQL Editor > New query > paste this file > Run.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (Sign-up, Login and Profile): one row per auth user, created automatically on sign-up
-- ---------------------------------------------------------------------------

create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  full_name          text,
  avatar_url         text,
  field_of_study     text,
  target_position    text,
  experience_level   text check (experience_level in ('student', 'fresher', 'junior', 'experienced', 'career_changer')),
  preferred_language text not null default 'vi' check (preferred_language in ('vi', 'en')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Copies the name and avatar from email or Google sign-up into profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- fit_analyses (JD and CV Fit Analysis): result of comparing a JD with a CV (/api/analyze-fit)
-- ---------------------------------------------------------------------------

create table public.fit_analyses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  jd_text      text not null check (char_length(jd_text) between 1 and 3000),
  cv_text      text not null,
  cv_file_name text,
  language     text not null default 'vi' check (language in ('vi', 'en')),
  fit_score    smallint check (fit_score between 0 and 100),
  -- Full API response: matched, missing, requirements, recommendation.
  result       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index fit_analyses_user_id_idx on public.fit_analyses (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- interview_sessions (Interview Setup, Chat Interview): one mock interview
-- ---------------------------------------------------------------------------

create table public.interview_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fit_analysis_id   uuid references public.fit_analyses (id) on delete set null,
  title             text,
  round_type        text not null check (round_type in ('hr', 'technical', 'behavioral')),
  difficulty        text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  language          text not null default 'vi' check (language in ('vi', 'en')),
  planned_questions smallint not null default 5 check (planned_questions between 1 and 20),
  status            text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  -- Snapshot of the JD and CV used, so the session still works if the analysis is deleted.
  jd_text           text,
  cv_text           text,
  started_at        timestamptz not null default now(),
  ended_at          timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index interview_sessions_user_id_idx on public.interview_sessions (user_id, created_at desc);
create index interview_sessions_fit_analysis_id_idx on public.interview_sessions (fit_analysis_id);

create trigger interview_sessions_set_updated_at
  before update on public.interview_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- questions (Chat Interview, Targeted Practice): asked by the AI interviewer, in order
-- ---------------------------------------------------------------------------

create table public.questions (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid not null references public.interview_sessions (id) on delete cascade,
  parent_question_id uuid references public.questions (id) on delete cascade,
  position           smallint not null check (position >= 1),
  kind               text not null default 'main' check (kind in ('main', 'follow_up', 'practice')),
  topic              text,
  content            text not null,
  created_at         timestamptz not null default now(),
  unique (session_id, position)
);

create index questions_parent_question_id_idx on public.questions (parent_question_id);

-- ---------------------------------------------------------------------------
-- answers (Chat Interview, Voice Answers): the user's answer to one question
-- ---------------------------------------------------------------------------

create table public.answers (
  id               uuid primary key default gen_random_uuid(),
  question_id      uuid not null unique references public.questions (id) on delete cascade,
  content          text not null,
  input_mode       text not null default 'text' check (input_mode in ('text', 'voice')),
  -- Filled for voice answers; used for speaking pace in the report.
  duration_seconds numeric(6, 1) check (duration_seconds >= 0),
  word_count       integer check (word_count >= 0),
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- feedbacks (Per-answer Scoring and Feedback): rubric scores 0-10 for one answer
-- ---------------------------------------------------------------------------

create table public.feedbacks (
  id              uuid primary key default gen_random_uuid(),
  answer_id       uuid not null unique references public.answers (id) on delete cascade,
  content_score   smallint not null check (content_score between 0 and 10),
  structure_score smallint not null check (structure_score between 0 and 10),
  clarity_score   smallint not null check (clarity_score between 0 and 10),
  confidence_score smallint not null check (confidence_score between 0 and 10),
  overall_score   numeric(4, 1) not null check (overall_score between 0 and 10),
  explanation     text not null,
  strengths       text[] not null default '{}',
  improvements    text[] not null default '{}',
  sample_answer   text,
  -- The AI's next move after this answer: ask a follow-up, change topic or end.
  next_action     text check (next_action in ('follow_up', 'next_topic', 'end')),
  model           text,
  raw_output      jsonb,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- reports (Post-interview Report, PDF Export and Sharing): one per finished session
-- ---------------------------------------------------------------------------

create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null unique references public.interview_sessions (id) on delete cascade,
  overall_score    numeric(4, 1) not null check (overall_score between 0 and 10),
  -- e.g. {"content": 7.5, "structure": 6, "clarity": 8, "confidence": 7}
  criteria_scores  jsonb not null default '{}'::jsonb,
  strengths        text[] not null default '{}',
  improvements     text[] not null default '{}',
  -- e.g. {"filler_words": 12, "words_per_minute": 118, "avg_answer_words": 85}
  speaking_metrics jsonb not null default '{}'::jsonb,
  summary          text,
  -- Sharing: read-only share link. Null = not shared. Revoke by setting it back to null.
  share_token      text unique,
  shared_at        timestamptz,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Ownership helpers for RLS on child tables.
-- security invoker: they run with the caller's rights, so RLS on
-- interview_sessions still applies inside them.
-- ---------------------------------------------------------------------------

create or replace function public.owns_session(p_session_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.interview_sessions s
    where s.id = p_session_id and s.user_id = (select auth.uid())
  );
$$;

create or replace function public.owns_question(p_question_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.questions q
    join public.interview_sessions s on s.id = q.session_id
    where q.id = p_question_id and s.user_id = (select auth.uid())
  );
$$;

create or replace function public.owns_answer(p_answer_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.answers a
    join public.questions q on q.id = a.question_id
    join public.interview_sessions s on s.id = q.session_id
    where a.id = p_answer_id and s.user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles           enable row level security;
alter table public.fit_analyses       enable row level security;
alter table public.interview_sessions enable row level security;
alter table public.questions          enable row level security;
alter table public.answers            enable row level security;
alter table public.feedbacks          enable row level security;
alter table public.reports            enable row level security;

-- profiles: created by the trigger, never deleted directly (deleted with the auth user).
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Tables with a user_id column.
create policy "fit_analyses: own rows" on public.fit_analyses
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "interview_sessions: own rows" on public.interview_sessions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Child tables: allowed when the parent session belongs to the user.
create policy "questions: own sessions" on public.questions
  for all to authenticated
  using (public.owns_session(session_id))
  with check (public.owns_session(session_id));

create policy "answers: own questions" on public.answers
  for all to authenticated
  using (public.owns_question(question_id))
  with check (public.owns_question(question_id));

create policy "feedbacks: own answers" on public.feedbacks
  for all to authenticated
  using (public.owns_answer(answer_id))
  with check (public.owns_answer(answer_id));

create policy "reports: own sessions" on public.reports
  for all to authenticated
  using (public.owns_session(session_id))
  with check (public.owns_session(session_id));

-- Shared reports are NOT readable through RLS. A server route looks the
-- report up by share_token with the service_role client and returns a read-only view.
