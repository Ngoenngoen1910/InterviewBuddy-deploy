-- SCRUM-92: atomic per-turn reservation and question persistence.
-- Review/apply after the two existing migrations. No AI call runs inside SQL.
create table public.interview_next_generations (
  session_id uuid not null references public.interview_sessions(id) on delete cascade,
  turn_key text not null,
  after_answer_id uuid references public.answers(id) on delete cascade,
  status text not null check (status in ('generating', 'completed', 'failed')),
  token uuid,
  expires_at timestamptz,
  question_id uuid references public.questions(id) on delete set null,
  response jsonb,
  decision jsonb,
  metadata jsonb,
  primary key (session_id, turn_key),
  check (turn_key = coalesce(after_answer_id::text, 'opening'))
);
-- The primary key already indexes session_id. Index the other foreign keys
-- for answer deletion and question deletion/SET NULL without scanning all turns.
create index interview_next_generations_answer_idx
  on public.interview_next_generations(after_answer_id) where after_answer_id is not null;
create index interview_next_generations_question_idx
  on public.interview_next_generations(question_id) where question_id is not null;
alter table public.interview_next_generations enable row level security;
revoke all on public.interview_next_generations from public, anon, authenticated;
grant select(session_id, turn_key, after_answer_id, status, question_id, response)
  on public.interview_next_generations to authenticated;
create policy "generations: read own sessions" on public.interview_next_generations
  for select to authenticated using (public.owns_session(session_id));

-- These definer functions have a fixed empty search_path, explicit auth.uid()
-- ownership checks and no dynamic SQL. Clients cannot write reservations directly.
create function public.claim_interview_next(p_session_id uuid, p_after_answer_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s public.interview_sessions%rowtype;
  g public.interview_next_generations%rowtype;
  q public.questions%rowtype;
  a public.answers%rowtype;
  expected_answer uuid;
  key text := coalesce(p_after_answer_id::text, 'opening');
  lease uuid := gen_random_uuid();
begin
  select * into s from public.interview_sessions
    where id = p_session_id and user_id = auth.uid() for update;
  if not found then return jsonb_build_object('error', 'NOT_FOUND'); end if;
  if s.status <> 'in_progress' then
    return jsonb_build_object('kind', 'ready', 'response', jsonb_build_object(
      'sessionId', s.id, 'action', 'end', 'question', null));
  end if;
  if clock_timestamp() >= s.started_at + make_interval(mins => s.duration_minutes)
      and (exists(select 1 from public.questions where session_id = s.id)
        or exists(select 1 from public.interview_next_generations where session_id = s.id)) then
    update public.interview_sessions set status = 'completed', ended_at = coalesce(ended_at, clock_timestamp()) where id = s.id;
    return jsonb_build_object('kind', 'ready', 'response', jsonb_build_object(
      'sessionId', s.id, 'action', 'end', 'question', null));
  end if;
  select * into g from public.interview_next_generations where session_id = s.id and turn_key = key;
  if g.status = 'completed' then
    if g.question_id is not null or g.response->>'action' = 'end' then
      return jsonb_build_object('kind', 'ready', 'response', g.response);
    end if;
    return jsonb_build_object('error', 'STALE_TURN');
  end if;
  if g.status = 'generating' and g.expires_at > clock_timestamp() then
    return jsonb_build_object('kind', 'busy');
  end if;
  select * into q from public.questions where session_id = s.id order by position desc limit 1;
  if q.id is not null then
    select * into a from public.answers where question_id = q.id;
    if a.id is null then
      -- Resume a question created by another integration without generating again.
      select ans.id into expected_answer from public.questions prev
        join public.answers ans on ans.question_id = prev.id
        where prev.session_id = s.id and prev.position = q.position - 1;
      if p_after_answer_id is distinct from expected_answer or q.kind not in ('main', 'follow_up') then
        return jsonb_build_object('error', 'STALE_TURN');
      end if;
      return jsonb_build_object('kind', 'ready', 'response', jsonb_build_object(
        'sessionId', s.id, 'action', case when q.kind = 'main' then 'next_topic' else 'follow_up' end,
        'question', jsonb_build_object('id', q.id, 'content', q.content, 'topic', q.topic, 'kind', q.kind, 'position', q.position)));
    end if;
    if p_after_answer_id is distinct from a.id then return jsonb_build_object('error', 'STALE_TURN'); end if;
  elsif p_after_answer_id is not null then
    return jsonb_build_object('error', 'STALE_TURN');
  elsif g.session_id is null then
    -- Actual practice starts on the first opening request, not the scheduled
    -- real interview date or the earlier setup form submission.
    update public.interview_sessions set started_at = clock_timestamp() where id = s.id returning * into s;
  end if;
  insert into public.interview_next_generations(session_id, turn_key, after_answer_id, status, token, expires_at)
    values(s.id, key, p_after_answer_id, 'generating', lease, clock_timestamp() + interval '120 seconds')
    on conflict(session_id, turn_key) do update
      set status = 'generating', token = lease, expires_at = clock_timestamp() + interval '120 seconds';
  return jsonb_build_object('kind', 'claimed', 'token', lease, 'session', to_jsonb(s),
    'questions', coalesce((select jsonb_agg(to_jsonb(qs) || jsonb_build_object('answer',
      (select to_jsonb(ans) from public.answers ans where ans.question_id = qs.id)) order by qs.position)
      from public.questions qs where qs.session_id = s.id), '[]'::jsonb));
end;
$$;

create function public.finish_interview_next(
  p_session_id uuid, p_after_answer_id uuid, p_token uuid, p_decision jsonb, p_metadata jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s public.interview_sessions%rowtype;
  g public.interview_next_generations%rowtype;
  latest public.questions%rowtype;
  saved public.questions%rowtype;
  parent public.questions%rowtype;
  latest_answer uuid;
  key text := coalesce(p_after_answer_id::text, 'opening');
  action text := p_decision->>'action';
  result jsonb;
begin
  select * into s from public.interview_sessions
    where id = p_session_id and user_id = auth.uid() for update;
  if not found then return jsonb_build_object('error', 'NOT_FOUND'); end if;
  select * into g from public.interview_next_generations where session_id = s.id and turn_key = key;
  if g.status = 'completed' then return g.response; end if;
  if g.status is distinct from 'generating' or g.token is distinct from p_token
      or g.expires_at <= clock_timestamp() then return jsonb_build_object('error', 'LEASE_LOST'); end if;
  if jsonb_typeof(p_decision) is distinct from 'object' then
    return jsonb_build_object('error', 'INVALID_OUTPUT');
  end if;
  if not (p_decision ?& array['action','question','topic','reason'])
      or (select count(*) from jsonb_object_keys(p_decision)) <> 4
      or jsonb_typeof(p_decision->'action') is distinct from 'string'
      or action not in ('next_topic', 'follow_up', 'end')
      or jsonb_typeof(p_decision->'topic') is distinct from 'string'
      or char_length(btrim(p_decision->>'topic')) not between 1 and 160
      or jsonb_typeof(p_decision->'reason') is distinct from 'string'
      or char_length(btrim(p_decision->>'reason')) not between 1 and 700
      or (action = 'end' and p_decision->'question' is distinct from 'null'::jsonb)
      or (action <> 'end' and (jsonb_typeof(p_decision->'question') is distinct from 'string'
        or char_length(btrim(p_decision->>'question')) not between 1 and 1200)) then
    return jsonb_build_object('error', 'INVALID_OUTPUT');
  end if;
  select * into latest from public.questions where session_id = s.id order by position desc limit 1;
  if latest.id is not null then select id into latest_answer from public.answers where question_id = latest.id; end if;
  if (latest.id is not null and latest_answer is null) or latest_answer is distinct from p_after_answer_id then
    return jsonb_build_object('error', 'STALE_TURN');
  end if;
  -- Recheck time/status after the external call, including a concurrent close.
  if s.status <> 'in_progress' or clock_timestamp() >= s.started_at + make_interval(mins => s.duration_minutes)
      or (select count(*) from public.questions qs join public.answers ans on ans.question_id = qs.id
        where qs.session_id = s.id and qs.kind = 'main') >= s.planned_questions then
    action := 'end';
  elsif action = 'end' then
    return jsonb_build_object('error', 'INVALID_OUTPUT');
  end if;
  if action = 'end' then
    update public.interview_sessions set status = case when status = 'abandoned' then status else 'completed' end,
      ended_at = coalesce(ended_at, clock_timestamp()) where id = s.id;
    result := jsonb_build_object('sessionId', s.id, 'action', 'end', 'question', null);
  else
    if action = 'follow_up' then
      select * into parent from public.questions where session_id = s.id and kind = 'main' order by position desc limit 1;
      if parent.id is null or p_decision->>'topic' is distinct from parent.topic
          or (select count(*) from public.questions where session_id = s.id and parent_question_id = parent.id)
            >= (case s.difficulty when 'easy' then 1 when 'medium' then 2 else 3 end) then
        return jsonb_build_object('error', 'INVALID_OUTPUT');
      end if;
    end if;
    insert into public.questions(session_id, parent_question_id, position, kind, topic, content)
      values(s.id, case when action = 'follow_up' then parent.id else null end,
        coalesce(latest.position, 0) + 1, case when action = 'follow_up' then 'follow_up' else 'main' end,
        p_decision->>'topic', p_decision->>'question') returning * into saved;
    result := jsonb_build_object('sessionId', s.id, 'action', action, 'question', jsonb_build_object(
      'id', saved.id, 'content', saved.content, 'topic', saved.topic, 'kind', saved.kind, 'position', saved.position));
  end if;
  update public.interview_next_generations set status = 'completed', token = null, expires_at = null,
    question_id = saved.id, response = result, decision = p_decision, metadata = p_metadata
    where session_id = s.id and turn_key = key;
  return result;
end;
$$;

create function public.release_interview_next(p_session_id uuid, p_after_answer_id uuid, p_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.interview_sessions where id = p_session_id and user_id = auth.uid() for update;
  if not found then return jsonb_build_object('error', 'NOT_FOUND'); end if;
  update public.interview_next_generations set status = 'failed', token = null, expires_at = null
    where session_id = p_session_id and turn_key = coalesce(p_after_answer_id::text, 'opening')
      and token = p_token and status = 'generating';
  return jsonb_build_object('released', found);
end;
$$;
revoke all on function public.claim_interview_next(uuid, uuid) from public, anon;
revoke all on function public.finish_interview_next(uuid, uuid, uuid, jsonb, jsonb) from public, anon;
revoke all on function public.release_interview_next(uuid, uuid, uuid) from public, anon;
grant execute on function public.claim_interview_next(uuid, uuid) to authenticated;
grant execute on function public.finish_interview_next(uuid, uuid, uuid, jsonb, jsonb) to authenticated;
grant execute on function public.release_interview_next(uuid, uuid, uuid) to authenticated;
