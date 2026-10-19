-- Supabase SQL Editor에서 전체 실행. anon/publishable key는 오직 검증된 이벤트 입력 함수만 호출합니다.
begin;
create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  event_name text not null check (event_name in ('page_view','search','filter_used','place_view','save_place','share_place','companion_interest','premium_willingness')),
  session_id uuid not null,
  page text not null check (page in ('home','saved','detail','info')),
  place_id text check (place_id is null or place_id ~ '^[a-z0-9-]{1,100}$'),
  region text check (region is null or region in ('서울','경기','강릉','경주','부산','제주')),
  category text check (category is null or category in ('맛집','나들이','여행')),
  is_demo boolean not null default false,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 1600)
);
alter table public.analytics_events enable row level security;
-- 클라이언트의 직접 SELECT/INSERT/UPDATE/DELETE를 모두 막습니다. RLS의 허용 정책은 만들지 않습니다.
revoke all on public.analytics_events from public, anon, authenticated;
revoke all on sequence public.analytics_events_id_seq from public, anon, authenticated;
create index if not exists analytics_events_date on public.analytics_events(created_at);
create index if not exists analytics_events_place on public.analytics_events(place_id, event_name);
create index if not exists analytics_events_session on public.analytics_events(session_id, created_at);
create unique index if not exists analytics_unique_response on public.analytics_events ((details->>'response_id')) where event_name = 'premium_willingness';

create or replace function public.record_event(payload jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare d jsonb; k text; v text; ev text; sid uuid;
begin
  if jsonb_typeof(payload) <> 'object' or octet_length(payload::text) > 2400 then raise exception 'Invalid event'; end if;
  if exists(select 1 from jsonb_object_keys(payload) x where x not in ('event_name','session_id','page','place_id','region','category','is_demo','details')) then raise exception 'Unknown field'; end if;
  ev := payload->>'event_name'; sid := (payload->>'session_id')::uuid;
  d := coalesce(payload->'details','{}'::jsonb);
  if jsonb_typeof(d) <> 'object' then raise exception 'Invalid details'; end if;
  for k,v in select key,value from jsonb_each_text(d) loop
    if not (case k
      when 'filter' then v = any(array['region','category','companion','walking','parking','stairs','reset'])
      when 'companion' then v = any(array['','혼자','배우자/연인','친구','가족','새로운 사람'])
      when 'walking' then v = any(array['','good','moderate'])
      when 'parking' then v in ('true','false')
      when 'stairs' then v in ('true','false')
      when 'result_count' then v ~ '^[0-9]{1,6}$'
      when 'age' then v = any(array['50~54','55~59','60~64','65~69','70+'])
      when 'preference' then v = any(array['동성 선호','혼성 선호','성별 상관없음','새로운 이성도 괜찮음'])
      when 'purpose' then v = any(array['식사동행','나들이동행','여행동행','취미친구','데이트도 괜찮음'])
      when 'group_size' then v = any(array['2명','3~4명','5~8명','상관없음'])
      when 'willingness' then v = any(array['무료면 참여','약 1만원','약 2만원','약 3만원 이상','아직 모르겠음'])
      when 'response_id' then v ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      else false end) or v is null then raise exception 'Invalid detail'; end if;
  end loop;
  if ev = 'premium_willingness' and not (d ?& array['age','preference','purpose','group_size','willingness','response_id']) then raise exception 'Incomplete survey'; end if;
  if ev <> 'premium_willingness' and d ?| array['age','preference','purpose','group_size','willingness','response_id'] then raise exception 'Unexpected survey'; end if;
  if ev in ('place_view','save_place','share_place','companion_interest','premium_willingness') and payload->>'place_id' is null then raise exception 'Place required'; end if;
  if (select count(*) from public.analytics_events where session_id = sid and created_at > now() - interval '1 day') >= 1000 then raise exception 'Daily event limit'; end if;
  insert into public.analytics_events(event_name, session_id, page, place_id, region, category, is_demo, details)
  values(ev,sid,payload->>'page',nullif(payload->>'place_id',''),nullif(payload->>'region',''),nullif(payload->>'category',''),coalesce((payload->>'is_demo')::boolean,false),d)
  on conflict do nothing;
end;
$$;
revoke all on function public.record_event(jsonb) from public, anon, authenticated;
grant execute on function public.record_event(jsonb) to anon;
comment on table public.analytics_events is '익명 브라우저 행동. 직접 클라이언트 조회 금지. 관리자는 SQL Editor에서만 조회. 보관 기준 90일.';
commit;

-- 보관 정리: 매주 SQL Editor에서 실행하거나 무료 pg_cron을 설정하세요.
-- delete from public.analytics_events where created_at < now() - interval '90 days';
-- 선택: Supabase Database > Extensions에서 pg_cron을 켠 후 아래 한 번 실행.
-- select cron.schedule('pyeonhanga-retention', '0 19 * * *', $$delete from public.analytics_events where created_at < now() - interval '90 days'$$);
