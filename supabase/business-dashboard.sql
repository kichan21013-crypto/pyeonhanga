-- v26 owner-only demand dashboard. Requires v23, v24 and v25 SQL.
-- No new tracking, identities, token hashes or raw survey records returned.
begin;
create or replace function public.nagachi_admin_business_dashboard(p_days integer default 7)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_today date; v_from date; v_start timestamptz; v_end timestamptz; v_result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.nagachi_companion_admins a where a.user_id=auth.uid())
 then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_days is null or p_days not in (1,7,30) then raise exception 'Invalid period' using errcode='22023'; end if;
 v_today:=(now() at time zone 'Asia/Seoul')::date;
 v_from:=v_today-(p_days-1);
 v_start:=v_from::timestamp at time zone 'Asia/Seoul';
 v_end:=now();
 with surveys as (
  select e.session_id,e.place_id,e.region,e.details->>'willingness' as willingness,e.created_at,e.id
  from public.analytics_events e
  where e.event_name='premium_willingness' and e.is_demo=false
   and e.created_at>=v_start and e.created_at<=v_end
 ), latest as (
  select distinct on (s.session_id) s.session_id,s.willingness
  from surveys s order by s.session_id,s.created_at desc,s.id desc
 ), interests as (
  select i.meetup_id,i.consented_at from public.nagachi_meetup_interest i
  where i.consented_at>=v_start and i.consented_at<=v_end and i.expires_at>v_end
 ), applications as (
  select a.meetup_id,a.requested_at,a.status from public.nagachi_party_applications a
  where a.requested_at>=v_start and a.requested_at<=v_end
 ), daily as (
  select d.day::date as day,
   (select count(distinct s.session_id) from surveys s where (s.created_at at time zone 'Asia/Seoul')::date=d.day::date) as survey_devices,
   (select count(*) from interests i where (i.consented_at at time zone 'Asia/Seoul')::date=d.day::date) as interest_records,
   (select count(*) from applications a where (a.requested_at at time zone 'Asia/Seoul')::date=d.day::date) as application_records
  from pg_catalog.generate_series(v_from::timestamp,v_today::timestamp,interval '1 day') d(day)
 ), regions as (
  select s.region as name,count(distinct s.session_id) as n from surveys s
  where s.region in ('서울','경기','강릉','경주','부산','제주') group by s.region order by n desc,name limit 10
 ), places as (
  select s.place_id,count(distinct s.session_id) as n from surveys s where s.place_id is not null
  group by s.place_id order by n desc,s.place_id limit 10
 ), meetup_counts as (
  select m.id,m.title,m.preferred_size as capacity,
   (select count(*) from interests i where i.meetup_id=m.id) as interests,
   (select count(*) from applications a where a.meetup_id=m.id) as applications,
   (select count(*) from applications a where a.meetup_id=m.id and a.status='approved') as approved,
   (select count(*) from applications a where a.meetup_id=m.id and a.status='pending') as pending,
   (select count(*) from applications a where a.meetup_id=m.id and a.status='waitlisted') as waitlisted,
   (select count(*) from applications a where a.meetup_id=m.id and a.status='cancelled') as cancelled
  from public.nagachi_operated_meetups m
  where exists(select 1 from interests i where i.meetup_id=m.id)
     or exists(select 1 from applications a where a.meetup_id=m.id)
  order by applications desc,interests desc,m.id desc limit 10
 ), courses as (
  select c.id,c.title,
   (select count(*) from interests i join public.nagachi_operated_meetups m on m.id=i.meetup_id where m.course_id=c.id) as interests,
   (select count(*) from applications a join public.nagachi_operated_meetups m on m.id=a.meetup_id where m.course_id=c.id) as applications
  from public.nagachi_curated_courses c
  where exists(select 1 from public.nagachi_operated_meetups m where m.course_id=c.id and
   (exists(select 1 from interests i where i.meetup_id=m.id) or exists(select 1 from applications a where a.meetup_id=m.id)))
  order by applications desc,interests desc,c.id desc limit 10
 ), willingness as (
  select w.label,count(l.session_id) as n,w.ord from (values
   ('무료면 참여',1),('약 1만원',2),('약 2만원',3),('약 3만원 이상',4),('아직 모르겠음',5)) w(label,ord)
  left join latest l on l.willingness=w.label group by w.label,w.ord
 )
 select pg_catalog.jsonb_build_object(
  'from',v_from,'through',v_today,'as_of',v_end,'days',p_days,
  'survey_responses',(select count(*) from surveys),'survey_devices',(select count(*) from latest),
  'interest_records',(select count(*) from interests),'application_records',(select count(*) from applications),
  'approved',(select count(*) from applications a where a.status='approved'),
  'pending',(select count(*) from applications a where a.status='pending'),
  'waitlisted',(select count(*) from applications a where a.status='waitlisted'),
  'cancelled',(select count(*) from applications a where a.status='cancelled'),
  'paid_intent',(select count(*) from latest l where l.willingness in ('약 1만원','약 2만원','약 3만원 이상')),
  'valid_willingness',(select coalesce(sum(w.n),0) from willingness w),
  'daily',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(d) order by d.day) from daily d),'[]'::jsonb),
  'regions',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) order by r.n desc,r.name) from regions r),'[]'::jsonb),
  'places',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p) order by p.n desc,p.place_id) from places p),'[]'::jsonb),
  'meetups',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(m) order by m.applications desc,m.interests desc,m.id desc) from meetup_counts m),'[]'::jsonb),
  'courses',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c) order by c.applications desc,c.interests desc,c.id desc) from courses c),'[]'::jsonb),
  'willingness',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('label',w.label,'n',w.n) order by w.ord) from willingness w),'[]'::jsonb)
 ) into v_result;
 return v_result;
end $$;
revoke all on function public.nagachi_admin_business_dashboard(integer) from public,anon,authenticated;
grant execute on function public.nagachi_admin_business_dashboard(integer) to authenticated;
commit;
-- Counts reflect retained records and current status, not immutable event history.
-- Survey, interest and application identifiers are deliberately different; no person-level funnel.
