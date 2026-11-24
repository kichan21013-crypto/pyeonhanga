-- 나가치 v23 통합 설치: 기존 4개 SQL을 순서대로 하나의 트랜잭션에서 적용합니다.
-- 먼저 운영 프로젝트 확인 및 백업/기존 데이터 호환성 검토. 오류 발생 시 전체 롤백.
-- 기존 테이블과 행을 삭제하지 않으며 관리자 계정을 자동 등록하지 않습니다.
-- 원본 기준: 1f6392fdeee806a7e90e451098cb45b586b4b66d
begin;

-- ===== schema.sql =====
-- Supabase SQL Editor에서 전체 실행. anon/publishable key는 검증된 이벤트 입력 함수만 호출합니다.

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

  if d ? 'age' and d->>'age' not in ('40~44','45~49','50~54','55~59','60~64','65~69','70+') then raise exception 'Invalid age'; end if;
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


-- 보관 정리: 매주 SQL Editor에서 실행하거나 무료 pg_cron을 설정하세요.
-- delete from public.analytics_events where created_at < now() - interval '90 days';
-- 선택: Supabase Database > Extensions에서 pg_cron을 켠 후 아래 한 번 실행.
-- select cron.schedule('pyeonhanga-retention', '0 19 * * *', $$delete from public.analytics_events where created_at < now() - interval '90 days'$$);

-- ===== companion-groups.sql =====
-- 나가치 | 동의 기반 관심 그룹 / 운영자 전용 모임 계획 / 앱 안 소식
-- 준비: Supabase Free에서 supabase/schema.sql이 먼저 실행돼 있어야 합니다.
-- 실행: 반드시 SQL Editor에서 운영자 확인 후 수동으로 적용합니다.
-- 구독 토큰은 무작위 256-bit 브라우저 로컬 비밀값이며 DB에는 SHA-256 해시만 저장합니다.
-- 이름/전화번호/메일은 수집하지 않습니다. 외부 이메일/푸시 발송 기능이 아닙니다.


create table if not exists public.nagachi_notice_subscriptions(
  token_hash text not null check(token_hash ~ '^[0-9a-f]{64}$'),
  activity text not null check(activity in ('food','hike','outing','travel')),
  subscribed_at timestamptz not null default now(),
  expires_at timestamptz not null default(now()+interval '90 days'),
  primary key(token_hash,activity)
);
alter table public.nagachi_notice_subscriptions enable row level security;
revoke all on public.nagachi_notice_subscriptions from public,anon,authenticated;

create table if not exists public.nagachi_companion_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table public.nagachi_companion_admins enable row level security;
revoke all on public.nagachi_companion_admins from public,anon,authenticated;

create table if not exists public.nagachi_group_notices (
  id bigint generated by default as identity primary key,
  activity text not null check(activity in ('food','hike','outing','travel')),
  title text not null check(char_length(title) between 3 and 80),
  body text not null check(char_length(body) between 5 and 800),
  meet_at timestamptz,
  meet_place text check(meet_place is null or char_length(meet_place) <= 120),
  status text not null default 'draft' check(status in ('draft','published')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists nagachi_group_notices_target_idx
 on public.nagachi_group_notices(activity,status,published_at desc);
alter table public.nagachi_group_notices enable row level security;
revoke all on public.nagachi_group_notices from public,anon,authenticated;
revoke all on sequence public.nagachi_group_notices_id_seq from public,anon,authenticated;

-- 공개 화면에는 5개 이상 동의한 서로 다른 브라우저의 응답이 있어야 합계만 표시합니다.
-- 실제 참여 / 확정 참석자는 아님. 5개 미만 또는 연결 안 된 경우 숫자를 표시하지 않습니다.
create or replace function public.nagachi_public_interest_counts()
returns table(activity text, interest_count bigint)
language sql stable security definer set search_path = ''
as $$
  with signals as (
    select e.session_id, a.value as interest
    from public.analytics_events e
    cross join lateral pg_catalog.jsonb_array_elements_text(
      case when pg_catalog.jsonb_typeof(e.details->'activities')='array'
        then e.details->'activities' else '[]'::jsonb end
    ) as a(value)
    where e.event_name='premium_willingness'
      and not e.is_demo and e.created_at >= now()-interval '90 days'
      and a.value in ('food','hike','outing','travel')
  )
  select interest, count(distinct session_id)::bigint
  from signals
  group by interest
  having count(distinct session_id)>=5
$$;

-- 구독은 설문 저장이 확인된 경우에만 가능. 구독 동의는 설문 동의와 별개입니다.
create or replace function public.nagachi_subscribe_updates(
 p_token text, p_response_id text, p_activities text[]
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_activity text; v_hash text; v_allowed jsonb;
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$'
    or p_response_id is null or p_response_id !~ '^[0-9a-f-]{36}$'
    or p_activities is null or cardinality(p_activities) not between 1 and 4
 then return false; end if;
 if exists(select 1 from unnest(p_activities) as a(v)
           where v not in ('food','hike','outing','travel') or v is null) then return false; end if;
 -- 현재 제출된 설문에 정확히 포함된 활동에 대해서만 정보 수신을 등록합니다.
 select e.details->'activities' into v_allowed
 from public.analytics_events e
 where e.event_name='premium_willingness' and not e.is_demo
   and e.details->>'response_id'=p_response_id
   and e.created_at>=now()-interval '10 minutes'
 limit 1;
 if v_allowed is null or not (v_allowed @> to_jsonb(p_activities)) then return false; end if;
 v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex');
 foreach v_activity in array p_activities loop
  insert into public.nagachi_notice_subscriptions(token_hash,activity)
  values(v_hash,v_activity)
  on conflict(token_hash,activity) do update set
    subscribed_at=now(),expires_at=now()+interval '90 days';
 end loop;
 return true;
end $$;

-- 본인 기기에만 저장된 토큰으로 자신의 관심 활동별 발행 공지만 조회할 수 있습니다.
create or replace function public.nagachi_my_updates(p_token text)
returns table(id bigint, activity text, title text, body text, meet_at timestamptz,
              meet_place text, published_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
declare v_hash text;
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return; end if;
 v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex');
 return query
 select n.id,n.activity,n.title,n.body,n.meet_at,n.meet_place,n.published_at
 from public.nagachi_group_notices n
 where n.status='published' and exists(
   select 1 from public.nagachi_notice_subscriptions s
   where s.token_hash=v_hash and s.activity=n.activity and s.expires_at>now())
 order by n.published_at desc limit 30;
end $$;

-- 누구든 자기 브라우저의 토큰으로 알림 구독을 철회할 수 있습니다.
create or replace function public.nagachi_unsubscribe_updates(p_token text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_hash text;
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return false; end if;
 v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex');
 delete from public.nagachi_notice_subscriptions s where s.token_hash=v_hash;
 return true;
end $$;

-- 반드시 Supabase Auth에서 직접 만들고 user_id를 수동 허용한 관리자만 아래 데이터 접근.
create or replace function public.nagachi_admin_dashboard()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare output jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.nagachi_companion_admins
                                     where user_id=auth.uid()) then
   raise exception 'Not authorized' using errcode='42501';
 end if;
 select jsonb_build_object(
   'interest_counts',coalesce((
     select jsonb_agg(jsonb_build_object('activity',t.interest,'people',t.people))
     from (select a.value as interest,count(distinct e.session_id) as people
       from public.analytics_events e
       cross join lateral pg_catalog.jsonb_array_elements_text(
         case when pg_catalog.jsonb_typeof(e.details->'activities')='array'
           then e.details->'activities' else '[]'::jsonb end) as a(value)
       where e.event_name='premium_willingness' and not e.is_demo
         and e.created_at>=now()-interval '90 days'
         and a.value in ('food','hike','outing','travel')
       group by a.value) t),'[]'::jsonb),
   'subscribers',coalesce((
     select jsonb_agg(jsonb_build_object('activity',s.activity,'devices',s.devices))
     from (select activity,count(distinct token_hash) as devices
       from public.nagachi_notice_subscriptions where expires_at>now() group by activity) s),'[]'::jsonb),
   'notices',coalesce((
     select jsonb_agg(jsonb_build_object('id',n.id,'activity',n.activity,
       'title',n.title,'body',n.body,'meet_at',n.meet_at,
       'meet_place',n.meet_place,'status',n.status,'published_at',n.published_at))
     from (select * from public.nagachi_group_notices order by id desc limit 40)n),'[]'::jsonb)
 ) into output;
 return output;
end $$;

-- 파티 일정/모임장소를 '공지'로 작성. draft는 사용자에게 노출하지 않습니다.
create or replace function public.nagachi_admin_save_notice(
 p_activity text,p_title text,p_body text,p_meet_at timestamptz default null,
 p_meet_place text default null,p_publish boolean default false,p_notice_id bigint default null
) returns bigint language plpgsql security definer set search_path = ''
as $$
declare v_id bigint;
begin
 if auth.uid() is null or not exists(select 1 from public.nagachi_companion_admins
                                   where user_id=auth.uid()) then
   raise exception 'Not authorized' using errcode='42501';
 end if;
 if p_activity not in ('food','hike','outing','travel')
    or p_title is null or char_length(trim(p_title)) not between 3 and 80
    or p_body is null or char_length(trim(p_body)) not between 5 and 800
    or (p_meet_place is not null and char_length(p_meet_place)>120)
 then raise exception 'Invalid notice'; end if;
 if p_notice_id is null then
  insert into public.nagachi_group_notices
    (activity,title,body,meet_at,meet_place,status,created_by,published_at)
  values(p_activity,trim(p_title),trim(p_body),p_meet_at,
         nullif(trim(p_meet_place),''),case when p_publish then 'published' else 'draft' end,
         auth.uid(),case when p_publish then now() else null end)
  returning id into v_id;
 else
  update public.nagachi_group_notices n
  set activity=p_activity,title=trim(p_title),body=trim(p_body),meet_at=p_meet_at,
      meet_place=nullif(trim(p_meet_place),''),
      status=case when p_publish then 'published' else 'draft' end,
      published_at=case when p_publish then coalesce(n.published_at,now()) else null end
  where n.id=p_notice_id returning n.id into v_id;
  if v_id is null then raise exception 'Notice not found'; end if;
 end if;
 return v_id;
end $$;

revoke all on function public.nagachi_public_interest_counts() from public,anon,authenticated;
revoke all on function public.nagachi_subscribe_updates(text,text,text[]) from public,anon,authenticated;
revoke all on function public.nagachi_my_updates(text) from public,anon,authenticated;
revoke all on function public.nagachi_unsubscribe_updates(text) from public,anon,authenticated;
revoke all on function public.nagachi_admin_dashboard() from public,anon,authenticated;
revoke all on function public.nagachi_admin_save_notice(text,text,text,timestamptz,text,boolean,bigint)
  from public,anon,authenticated;
grant execute on function public.nagachi_public_interest_counts() to anon;
grant execute on function public.nagachi_subscribe_updates(text,text,text[]) to anon;
grant execute on function public.nagachi_my_updates(text) to anon;
grant execute on function public.nagachi_unsubscribe_updates(text) to anon;
grant execute on function public.nagachi_admin_dashboard() to authenticated;
grant execute on function public.nagachi_admin_save_notice(text,text,text,timestamptz,text,boolean,bigint) to authenticated;


-- 관리자를 자동 등록하지 않습니다. 본인 Supabase Auth 계정 확인 후 SQL Editor에서 수동 실행:
-- insert into public.nagachi_companion_admins(user_id)
-- values ('<직접 조회한 실제 auth.users.id UUID>') on conflict do nothing;
-- 알림은 사용자에게 이메일/푸시로 전달되지 않고, 구독 기기가 앱에 재방문했을 때만 읽습니다.
-- 구독 보존은 신청 시점부터 최대 90일이며 이후 기간을 연장하려면 새 동의 제출이 필요합니다.
-- 운영자는 정기적으로 만료 구독을 수동 정리할 수 있습니다:
-- delete from public.nagachi_notice_subscriptions where expires_at < now();
-- 실제 모임 운영/예약/유상 운송·여행상품 판매는 이 모듈의 범위가 아닙니다.

-- ===== popular-companion.sql =====
-- 나가치 v21: 공개 가능한 '가보고 싶어요' 관심 장소 순위.
-- 반드시 supabase/schema.sql 선행 적용. 실제 동의 후 저장된 데이터만 사용.
-- 동의자별 개별 응답, 익명 UUID, 나이/성별 등은 응답하지 않습니다.
-- 90일 이내 실제 관심 브라우저가 5개 이상인 장소·활동 조합만 공개합니다.

create or replace function public.nagachi_public_popular_places()
returns table(place_id text, activity text, interested_count bigint)
language sql stable security definer set search_path = ''
as $$
 with interest as (
   select e.place_id, a.value as activity, e.session_id
   from public.analytics_events e
   cross join lateral pg_catalog.jsonb_array_elements_text(
     case when pg_catalog.jsonb_typeof(e.details->'activities')='array'
       then e.details->'activities' else '[]'::jsonb end
   ) as a(value)
   where e.event_name='premium_willingness'
     and e.is_demo=false
     and e.place_id is not null
     and e.created_at>=now()-interval '90 days'
     and a.value in ('food','hike','outing','travel')
 )
 select i.place_id, i.activity, count(distinct i.session_id)::bigint as interested_count
 from interest i
 group by i.place_id, i.activity
 having count(distinct i.session_id)>=5
 order by interested_count desc, i.place_id, i.activity
 limit 12
$$;
revoke all on function public.nagachi_public_popular_places() from public,anon,authenticated;
grant execute on function public.nagachi_public_popular_places() to anon;
comment on function public.nagachi_public_popular_places() is
  '최근 90일 동의 저장 데이터 중 장소별 5개 이상 서로 다른 익명 브라우저의 관심만 반환. 실제 참여 확정 인원 아님.';

-- ===== operations-studio.sql =====
-- 나가치 v22 | 운영자 전용 코스/동행 준비/수익 계획
-- 필수: supabase/schema.sql + companion-groups.sql 선행 적용.
-- 무료 Supabase Auth 관리자 한 명만 nagachi_companion_admins에 수동 등록.
-- 직접 테이블 접근 차단: RLS + revoke, 모든 변경 RPC에서 auth.uid() 허용 확인.
-- 일반 이용자는 게시된 코스/모임 제안의 비개인정보만 읽을 수 있습니다.
-- 이름/연락처/계좌/카드/실제 참가명단/결제 내역은 저장하지 않습니다.


create table if not exists public.nagachi_curated_courses(
 id bigint generated always as identity primary key,
 title text not null check (char_length(title) between 4 and 90),
 activity text not null check (activity in ('food','hike','outing','travel')),
 region text not null check (region in ('서울','경기','강릉','경주','부산','제주')),
 description text not null check (char_length(description) between 12 and 600),
 place_ids text[] not null check (cardinality(place_ids) between 1 and 5),
 duration text not null check (duration in ('반나절','하루')),
 status text not null default 'draft' check (status in ('draft','published')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists nagachi_curated_courses_public_idx
  on public.nagachi_curated_courses(status, updated_at desc);
alter table public.nagachi_curated_courses enable row level security;
revoke all on public.nagachi_curated_courses from public,anon,authenticated;
revoke all on sequence public.nagachi_curated_courses_id_seq from public,anon,authenticated;

create table if not exists public.nagachi_operated_meetups(
 id bigint generated always as identity primary key,
 course_id bigint references public.nagachi_curated_courses(id) on delete set null,
 title text not null check (char_length(title) between 4 and 90),
 activity text not null check (activity in ('food','hike','outing','travel')),
 intro text not null check (char_length(intro) between 12 and 600),
 meet_at timestamptz,
 meet_place text check (meet_place is null or char_length(meet_place)<=120),
 preferred_size smallint not null check (preferred_size between 2 and 8),
 stage text not null default 'draft' check (stage in ('draft','planning','announced','closed')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists nagachi_operated_meetups_public_idx
  on public.nagachi_operated_meetups(stage,updated_at desc);
alter table public.nagachi_operated_meetups enable row level security;
revoke all on public.nagachi_operated_meetups from public,anon,authenticated;
revoke all on sequence public.nagachi_operated_meetups_id_seq from public,anon,authenticated;

create table if not exists public.nagachi_revenue_scenarios(
 id bigint generated always as identity primary key,
 name text not null check (char_length(name) between 3 and 80),
 service_fee_krw integer not null check (service_fee_krw between 0 and 100000),
 expected_people integer not null check (expected_people between 2 and 30),
 meetings_per_month integer not null check (meetings_per_month between 1 and 20),
 paid_conversion_pct integer not null check (paid_conversion_pct between 0 and 100),
 cost_per_meeting_krw integer not null check (cost_per_meeting_krw between 0 and 3000000),
 note text not null default '' check (char_length(note)<=400),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.nagachi_revenue_scenarios enable row level security;
revoke all on public.nagachi_revenue_scenarios from public,anon,authenticated;
revoke all on sequence public.nagachi_revenue_scenarios_id_seq from public,anon,authenticated;

-- Only previously published courses, no creator IDs, notes or emails.
create or replace function public.nagachi_public_courses()
returns table(id bigint,title text,activity text,region text,
              description text,place_ids text[],duration text,updated_at timestamptz)
language sql stable security definer set search_path=''
as $$
 select c.id,c.title,c.activity,c.region,c.description,c.place_ids,c.duration,c.updated_at
 from public.nagachi_curated_courses c
 where c.status='published'
 order by c.updated_at desc,c.id desc limit 20;
$$;
revoke all on function public.nagachi_public_courses() from public,anon,authenticated;
grant execute on function public.nagachi_public_courses() to anon;

-- Public notice only. Meeting spot is NOT exposed in public listing.
-- Specific meeting place is communicated separately to opted-in activity subscribers.
create or replace function public.nagachi_public_meetups()
returns table(id bigint,course_id bigint,title text,activity text,
              intro text,meet_at timestamptz,stage text)
language sql stable security definer set search_path=''
as $$
 select m.id,m.course_id,m.title,m.activity,m.intro,m.meet_at,m.stage
 from public.nagachi_operated_meetups m
 where m.stage='announced'
 order by m.meet_at asc nulls last,m.id desc limit 20;
$$;
revoke all on function public.nagachi_public_meetups() from public,anon,authenticated;
grant execute on function public.nagachi_public_meetups() to anon;

-- Every private RPC independently checks the Auth identity against DB allowlist.
create or replace function public.nagachi_admin_operations()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_result jsonb;
begin
 if auth.uid() is null or not exists(
   select 1 from public.nagachi_companion_admins a where a.user_id=auth.uid()
 ) then raise exception 'Not authorized' using errcode='42501'; end if;

 select pg_catalog.jsonb_build_object(
  'courses',coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c))
    from (select id,title,activity,region,description,place_ids,duration,status,updated_at
          from public.nagachi_curated_courses order by id desc limit 80)c),'[]'::jsonb),
  'meetups',coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(m))
    from (select id,course_id,title,activity,intro,meet_at,meet_place,preferred_size,stage,updated_at
          from public.nagachi_operated_meetups order by id desc limit 80)m),'[]'::jsonb),
  'pricing',coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p))
    from (select id,name,service_fee_krw,expected_people,meetings_per_month,
                 paid_conversion_pct,cost_per_meeting_krw,note,updated_at
          from public.nagachi_revenue_scenarios order by id desc limit 60)p),'[]'::jsonb)
 ) into v_result;
 return v_result;
end $$;
revoke all on function public.nagachi_admin_operations() from public,anon,authenticated;
grant execute on function public.nagachi_admin_operations() to authenticated;

create or replace function public.nagachi_admin_save_course(
 p_title text,p_activity text,p_region text,p_description text,
 p_place_ids text[],p_duration text,p_publish boolean,p_id bigint default null
) returns bigint language plpgsql security definer set search_path=''
as $$
declare v_id bigint;
begin
 if auth.uid() is null or not exists(
  select 1 from public.nagachi_companion_admins a where a.user_id=auth.uid()
 ) then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_title is null or char_length(pg_catalog.btrim(p_title)) not between 4 and 90
   or p_description is null or char_length(pg_catalog.btrim(p_description)) not between 12 and 600
   or p_activity not in ('food','hike','outing','travel')
   or p_region not in ('서울','경기','강릉','경주','부산','제주')
   or p_duration not in ('반나절','하루')
   or p_place_ids is null or cardinality(p_place_ids) not between 1 and 5
   or exists(select 1 from unnest(p_place_ids) as x(v)
             where x.v is null or x.v !~ '^[a-z0-9-]{1,100}$')
   or (select count(distinct x.v) from unnest(p_place_ids) as x(v))<>cardinality(p_place_ids)
 then raise exception 'Invalid course' using errcode='22023'; end if;

 if p_id is null then
  insert into public.nagachi_curated_courses
   (title,activity,region,description,place_ids,duration,status,created_by)
  values (pg_catalog.btrim(p_title),p_activity,p_region,pg_catalog.btrim(p_description),
          p_place_ids,p_duration,case when p_publish then 'published' else 'draft' end,auth.uid())
  returning id into v_id;
 else
  update public.nagachi_curated_courses c
     set title=pg_catalog.btrim(p_title),activity=p_activity,region=p_region,
         description=pg_catalog.btrim(p_description),place_ids=p_place_ids,
         duration=p_duration,status=case when p_publish then 'published' else 'draft' end,
         updated_at=now()
   where c.id=p_id returning c.id into v_id;
  if v_id is null then raise exception 'Course not found' using errcode='22023'; end if;
 end if;
 return v_id;
end $$;
revoke all on function public.nagachi_admin_save_course(text,text,text,text,text[],text,boolean,bigint)
 from public,anon,authenticated;
grant execute on function public.nagachi_admin_save_course(text,text,text,text,text[],text,boolean,bigint)
 to authenticated;

create or replace function public.nagachi_admin_save_meetup(
 p_title text,p_activity text,p_intro text,p_course_id bigint,
 p_meet_at timestamptz,p_meet_place text,p_preferred_size integer,
 p_stage text,p_id bigint default null
) returns bigint language plpgsql security definer set search_path=''
as $$
declare v_id bigint;
begin
 if auth.uid() is null or not exists(
  select 1 from public.nagachi_companion_admins a where a.user_id=auth.uid()
 ) then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_title is null or char_length(pg_catalog.btrim(p_title)) not between 4 and 90
   or p_intro is null or char_length(pg_catalog.btrim(p_intro)) not between 12 and 600
   or p_activity not in ('food','hike','outing','travel')
   or p_stage not in ('draft','planning','announced','closed')
   or p_preferred_size not between 2 and 8
   or (p_meet_place is not null and char_length(p_meet_place)>120)
   or (p_course_id is not null and not exists(
        select 1 from public.nagachi_curated_courses c
        where c.id=p_course_id and c.activity=p_activity))
 then raise exception 'Invalid meetup' using errcode='22023'; end if;
 if p_id is null then
  insert into public.nagachi_operated_meetups
   (course_id,title,activity,intro,meet_at,meet_place,preferred_size,stage,created_by)
  values (p_course_id,pg_catalog.btrim(p_title),p_activity,pg_catalog.btrim(p_intro),
    p_meet_at,nullif(pg_catalog.btrim(p_meet_place),''),p_preferred_size,p_stage,auth.uid())
  returning id into v_id;
 else
  update public.nagachi_operated_meetups m
    set course_id=p_course_id,title=pg_catalog.btrim(p_title),activity=p_activity,
        intro=pg_catalog.btrim(p_intro),meet_at=p_meet_at,
        meet_place=nullif(pg_catalog.btrim(p_meet_place),''),
        preferred_size=p_preferred_size,stage=p_stage,updated_at=now()
  where m.id=p_id returning m.id into v_id;
  if v_id is null then raise exception 'Meetup not found' using errcode='22023'; end if;
 end if;
 return v_id;
end $$;
revoke all on function public.nagachi_admin_save_meetup(text,text,text,bigint,timestamptz,text,integer,text,bigint)
 from public,anon,authenticated;
grant execute on function public.nagachi_admin_save_meetup(text,text,text,bigint,timestamptz,text,integer,text,bigint)
 to authenticated;

-- Estimates only, no actual sales, payment, tax or compensation records.
create or replace function public.nagachi_admin_save_pricing(
 p_name text,p_service_fee_krw integer,p_expected_people integer,
 p_meetings_per_month integer,p_paid_conversion_pct integer,
 p_cost_per_meeting_krw integer,p_note text,p_id bigint default null
) returns bigint language plpgsql security definer set search_path=''
as $$
declare v_id bigint;
begin
 if auth.uid() is null or not exists(
  select 1 from public.nagachi_companion_admins a where a.user_id=auth.uid()
 ) then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_name is null or char_length(pg_catalog.btrim(p_name)) not between 3 and 80
    or p_service_fee_krw not between 0 and 100000
    or p_expected_people not between 2 and 30
    or p_meetings_per_month not between 1 and 20
    or p_paid_conversion_pct not between 0 and 100
    or p_cost_per_meeting_krw not between 0 and 3000000
    or (p_note is not null and char_length(p_note)>400)
 then raise exception 'Invalid price plan' using errcode='22023'; end if;
 if p_id is null then
  insert into public.nagachi_revenue_scenarios
   (name,service_fee_krw,expected_people,meetings_per_month,
    paid_conversion_pct,cost_per_meeting_krw,note,created_by)
  values(pg_catalog.btrim(p_name),p_service_fee_krw,p_expected_people,
         p_meetings_per_month,p_paid_conversion_pct,p_cost_per_meeting_krw,
         coalesce(p_note,''),auth.uid())
  returning id into v_id;
 else
  update public.nagachi_revenue_scenarios p
    set name=pg_catalog.btrim(p_name),service_fee_krw=p_service_fee_krw,
        expected_people=p_expected_people,meetings_per_month=p_meetings_per_month,
        paid_conversion_pct=p_paid_conversion_pct,cost_per_meeting_krw=p_cost_per_meeting_krw,
        note=coalesce(p_note,''),updated_at=now()
   where p.id=p_id returning p.id into v_id;
  if v_id is null then raise exception 'Scenario not found' using errcode='22023'; end if;
 end if;
 return v_id;
end $$;
revoke all on function public.nagachi_admin_save_pricing(text,integer,integer,integer,integer,integer,text,bigint)
 from public,anon,authenticated;
grant execute on function public.nagachi_admin_save_pricing(text,integer,integer,integer,integer,integer,text,bigint)
 to authenticated;


-- 운영용 SQL 설치 후:
-- Auth에서 본인 이메일/비밀번호 등록 → 관리자 user_id를 nagachi_companion_admins에 수동 등록.
-- 현재 코스/모임은 '콘텐츠와 준비 소식'일 뿐, 참가 신청/결제/운송은 미구현입니다.
-- 정확한 집결지는 공개 목록에서 숨기고 기존 수신 동의자 대상 공지로만 안내할 수 있습니다.

commit;
