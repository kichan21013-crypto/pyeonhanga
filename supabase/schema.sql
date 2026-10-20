-- Supabase SQL Editor에서 전체 실행. anon/publishable key는 검증된 이벤트 입력 함수만 호출합니다.
begin;
create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  event_name text not null,
  session_id uuid not null,
  page text not null check (page in ('home','saved','detail','info')),
  place_id text check (place_id is null or place_id ~ '^[a-z0-9-]{1,100}$'),
  region text check (region is null or region in ('서울','경기','강릉','경주','부산','제주')),
  category text check (category is null or category in ('맛집','나들이','여행')),
  is_demo boolean not null default false,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 1600)
);

-- 기존 설치에서도 안전하게 이벤트 허용 목록을 확장합니다.
alter table public.analytics_events drop constraint if exists analytics_events_event_name_check;
alter table public.analytics_events add constraint analytics_events_event_name_check check (event_name in (
  'page_view','search','filter_used','place_view','save_place','share_place','companion_interest','premium_willingness',
  'rhythm_start','desire_selected','activity_selected','companion_selected','condition_selected','recommendation_view','recommendation_save','recommendation_share'
));

alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from public, anon, authenticated;
revoke all on sequence public.analytics_events_id_seq from public, anon, authenticated;
create index if not exists analytics_events_date on public.analytics_events(created_at);
create index if not exists analytics_events_place on public.analytics_events(place_id, event_name);
create index if not exists analytics_events_session on public.analytics_events(session_id, created_at);
create index if not exists analytics_events_event_date on public.analytics_events(event_name, created_at);
create unique index if not exists analytics_unique_response on public.analytics_events ((details->>'response_id')) where event_name = 'premium_willingness';

create or replace function public.record_event(payload jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  d jsonb;
  ev text;
  sid uuid;
begin
  if jsonb_typeof(payload) <> 'object' or octet_length(payload::text) > 2400 then raise exception 'Invalid event'; end if;
  if exists(
    select 1 from jsonb_object_keys(payload) as x(key)
    where key not in ('event_name','session_id','page','place_id','region','category','is_demo','details')
  ) then raise exception 'Unknown field'; end if;

  ev := payload->>'event_name';
  sid := (payload->>'session_id')::uuid;
  d := coalesce(payload->'details','{}'::jsonb);
  if jsonb_typeof(d) <> 'object' then raise exception 'Invalid details'; end if;
  if exists(
    select 1 from jsonb_object_keys(d) as x(key)
    where key not in (
      'filter','companion','walking','parking','stairs','result_count',
      'desires','activities','companions','duration','transport','comfort_preferences','recommended_activity',
      'age','preference','purpose','group_size','willingness','response_id'
    )
  ) then raise exception 'Invalid detail key'; end if;

  if d ? 'filter' and d->>'filter' <> all(array['region','category','companion','walking','parking','stairs','reset']) then raise exception 'Invalid filter'; end if;
  if d ? 'companion' and d->>'companion' <> all(array['','혼자','배우자/연인','친구','가족','새로운 사람']) then raise exception 'Invalid companion'; end if;
  if d ? 'walking' and d->>'walking' <> all(array['','good','moderate']) then raise exception 'Invalid walking'; end if;
  if d ? 'parking' and d->>'parking' not in ('true','false') then raise exception 'Invalid parking'; end if;
  if d ? 'stairs' and d->>'stairs' not in ('true','false') then raise exception 'Invalid stairs'; end if;
  if d ? 'result_count' and d->>'result_count' !~ '^[0-9]{1,6}$' then raise exception 'Invalid result count'; end if;
  if d ? 'duration' and d->>'duration' not in ('short','half_day','full_day','any') then raise exception 'Invalid duration'; end if;
  if d ? 'transport' and d->>'transport' not in ('car','transit','any') then raise exception 'Invalid transport'; end if;
  if d ? 'recommended_activity' and d->>'recommended_activity' not in ('food','korean_food','noodle','meat','seafood','cafe','walk','run','hike','bike','drive','sea','scenery','quiet_rest','outing','travel','culture','conversation') then raise exception 'Invalid recommended activity'; end if;

  if d ? 'desires' then
    if jsonb_typeof(d->'desires') <> 'array' or jsonb_array_length(d->'desires') > 6 or exists(
      select 1 from jsonb_array_elements_text(d->'desires') as x(value)
      where value not in ('eat','move','outdoor','rest','explore','social')
    ) then raise exception 'Invalid desires'; end if;
  end if;
  if d ? 'activities' then
    if jsonb_typeof(d->'activities') <> 'array' or jsonb_array_length(d->'activities') > 12 or exists(
      select 1 from jsonb_array_elements_text(d->'activities') as x(value)
      where value not in ('food','korean_food','noodle','meat','seafood','cafe','walk','run','hike','bike','drive','sea','scenery','quiet_rest','outing','travel','culture','conversation')
    ) then raise exception 'Invalid activities'; end if;
  end if;
  if d ? 'companions' then
    if jsonb_typeof(d->'companions') <> 'array' or jsonb_array_length(d->'companions') > 5 or exists(
      select 1 from jsonb_array_elements_text(d->'companions') as x(value)
      where value not in ('solo','couple','friend','family','new_people')
    ) then raise exception 'Invalid companions'; end if;
  end if;
  if d ? 'comfort_preferences' then
    if jsonb_typeof(d->'comfort_preferences') <> 'array' or jsonb_array_length(d->'comfort_preferences') > 7 or exists(
      select 1 from jsonb_array_elements_text(d->'comfort_preferences') as x(value)
      where value not in ('parking','walking','stairs','restroom','noise','seating','waiting')
    ) then raise exception 'Invalid comfort preferences'; end if;
  end if;

  if d ? 'age' and d->>'age' not in ('50~54','55~59','60~64','65~69','70+') then raise exception 'Invalid age'; end if;
  if d ? 'preference' and d->>'preference' not in ('동성 선호','혼성 선호','성별 상관없음','새로운 이성도 괜찮음') then raise exception 'Invalid preference'; end if;
  if d ? 'purpose' and d->>'purpose' not in ('식사동행','나들이동행','여행동행','취미친구','데이트도 괜찮음') then raise exception 'Invalid purpose'; end if;
  if d ? 'group_size' and d->>'group_size' not in ('2명','3~4명','5~8명','상관없음') then raise exception 'Invalid group size'; end if;
  if d ? 'willingness' and d->>'willingness' not in ('무료면 참여','약 1만원','약 2만원','약 3만원 이상','아직 모르겠음') then raise exception 'Invalid willingness'; end if;
  if d ? 'response_id' and d->>'response_id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Invalid response id'; end if;

  if ev = 'premium_willingness' and not (d ?& array['age','preference','purpose','group_size','willingness','response_id']) then raise exception 'Incomplete survey'; end if;
  if ev <> 'premium_willingness' and d ?| array['age','preference','purpose','group_size','willingness','response_id'] then raise exception 'Unexpected survey'; end if;
  if ev in ('place_view','save_place','share_place','recommendation_save','recommendation_share','companion_interest','premium_willingness') and payload->>'place_id' is null then raise exception 'Place required'; end if;
  if (select count(*) from public.analytics_events where session_id = sid and created_at > now() - interval '1 day') >= 1000 then raise exception 'Daily event limit'; end if;

  insert into public.analytics_events(event_name, session_id, page, place_id, region, category, is_demo, details)
  values(ev,sid,payload->>'page',nullif(payload->>'place_id',''),nullif(payload->>'region',''),nullif(payload->>'category',''),coalesce((payload->>'is_demo')::boolean,false),d)
  on conflict do nothing;
end;
$$;

revoke all on function public.record_event(jsonb) from public, anon, authenticated;
grant execute on function public.record_event(jsonb) to anon;
comment on table public.analytics_events is '익명 브라우저 행동. 직접 클라이언트 조회 금지. 자유입력 원문 저장 금지. 관리자 SQL 조회. 보관 기준 90일.';
commit;

-- 보관 정리: 매주 SQL Editor에서 실행하거나 무료 pg_cron을 설정하세요.
-- delete from public.analytics_events where created_at < now() - interval '90 days';
-- 선택: Supabase Database > Extensions에서 pg_cron을 켠 후 아래 한 번 실행.
-- select cron.schedule('pyeonhanga-retention', '0 19 * * *', $$delete from public.analytics_events where created_at < now() - interval '90 days'$$);
