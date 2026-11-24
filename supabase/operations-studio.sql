-- 나가치 v22 | 운영자 전용 코스/동행 준비/수익 계획
-- 필수: supabase/schema.sql + companion-groups.sql 선행 적용.
-- 무료 Supabase Auth 관리자 한 명만 nagachi_companion_admins에 수동 등록.
-- 직접 테이블 접근 차단: RLS + revoke, 모든 변경 RPC에서 auth.uid() 허용 확인.
-- 일반 이용자는 게시된 코스/모임 제안의 비개인정보만 읽을 수 있습니다.
-- 이름/연락처/계좌/카드/실제 참가명단/결제 내역은 저장하지 않습니다.
begin;

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
commit;

-- 운영용 SQL 설치 후:
-- Auth에서 본인 이메일/비밀번호 등록 → 관리자 user_id를 nagachi_companion_admins에 수동 등록.
-- 현재 코스/모임은 '콘텐츠와 준비 소식'일 뿐, 참가 신청/결제/운송은 미구현입니다.
-- 정확한 집결지는 공개 목록에서 숨기고 기존 수신 동의자 대상 공지로만 안내할 수 있습니다.
