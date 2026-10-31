-- InterviewBuddy: interview setup fields (Sprint 2, week 4 – SCRUM-56, SCRUM-57)
--
-- Adds the settings chosen on the Interview Setup page (UC-05, Screen 3) that the
-- initial schema did not have: target position, real interview date, duration
-- and answer mode. planned_questions stays and is derived from the duration by
-- the API (15 min -> 5, 30 min -> 8, 45 min -> 12 questions).
--
-- Also makes sure a session can only be linked to the user's own fit analysis.
-- The foreign key alone does not check ownership, because foreign key checks
-- bypass Row Level Security.
--
-- Run it once after 20261021000000_initial_schema.sql:
-- Supabase dashboard > SQL Editor > New query > paste this file > Run.

alter table public.interview_sessions
  add column target_position  text check (char_length(target_position) between 1 and 120),
  add column interview_date   date,
  add column duration_minutes smallint not null default 30 check (duration_minutes in (15, 30, 45)),
  add column input_mode       text not null default 'text' check (input_mode in ('text', 'voice'));

comment on column public.interview_sessions.interview_date is
  'Date of the real interview (optional). Used later by the practice plan. Must not be in the past when the session is created (checked by the API).';

-- UC-05 links "the latest saved fit analysis": index for that lookup.
create index if not exists fit_analyses_user_latest_idx
  on public.fit_analyses (user_id, created_at desc);

-- Ownership check for fit_analysis_id. security invoker: runs with the caller's
-- rights, so RLS on fit_analyses applies inside it.
create or replace function public.owns_fit_analysis(p_fit_analysis_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select p_fit_analysis_id is null or exists (
    select 1 from public.fit_analyses f
    where f.id = p_fit_analysis_id and f.user_id = (select auth.uid())
  );
$$;

drop policy "interview_sessions: own rows" on public.interview_sessions;

create policy "interview_sessions: own rows" on public.interview_sessions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_fit_analysis(fit_analysis_id));
