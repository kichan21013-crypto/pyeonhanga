-- v43: curated external places, no third-party scraping or photo storage.
create table if not exists public.nagachi_external_places(
 id text primary key default ('ext-'||gen_random_uuid()::text) check(id ~ '^ext-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
 name text not null check(char_length(name) between 2 and 100),
 address text not null check(char_length(address) between 2 and 240),
 region text not null check(region in ('서울','경기','강릉','경주','부산','제주','인천','강원','충북','충남','대전','세종','전북','전남','광주','경북','경남','대구','울산')),
 category text not null check(category in ('맛집','카페','산행','나들이','여행','기타')),
 map_url text not null check(char_length(map_url)<=1000 and map_url !~ '[[:space:][:cntrl:]]' and map_url ~ '^https://(map[.]naver[.]com|place[.]map[.]naver[.]com|m[.]place[.]naver[.]com|naver[.]me|maps[.]app[.]goo[.]gl|maps[.]google[.]com)(/|$)|^https://(www[.]google[.]com|google[.]com)/maps(/|[?]|$)'),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.nagachi_external_places enable row level security;
revoke all on public.nagachi_external_places from public,anon,authenticated;
create or replace function public.nagachi_admin_save_external_place(p_name text,p_address text,p_region text,p_category text,p_map_url text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.nagachi_external_places;
begin
 if auth.uid() is null or not exists(select 1 from public.nagachi_companion_admins a where a.user_id=auth.uid()) then raise exception 'Not authorized' using errcode='42501';end if;
 -- Serialize identical submissions by the same operator to prevent double-click duplicates.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,43));
 select * into r from public.nagachi_external_places e where e.name=btrim(p_name) and e.address=btrim(p_address) and e.region=p_region and e.category=p_category and e.map_url=p_map_url limit 1;
 if not found then insert into public.nagachi_external_places(name,address,region,category,map_url,created_by)
 values(btrim(p_name),btrim(p_address),p_region,p_category,p_map_url,auth.uid()) returning * into r; end if;
 return jsonb_build_object('id',r.id,'name',r.name,'address',r.address,'region',r.region,'category',r.category,'map_url',r.map_url);
end $$;
create or replace function public.nagachi_admin_external_places()
returns table(id text,name text,address text,region text,category text,map_url text) language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.nagachi_companion_admins a where a.user_id=auth.uid()) then raise exception 'Not authorized' using errcode='42501';end if;
 return query select e.id,e.name,e.address,e.region,e.category,e.map_url from public.nagachi_external_places e order by e.created_at desc;
end $$;
create or replace function public.nagachi_public_external_places()
returns table(id text,name text,address text,region text,category text,map_url text) language sql stable security definer set search_path='' as $$
 select e.id,e.name,e.address,e.region,e.category,e.map_url from public.nagachi_external_places e
 where exists(select 1 from public.nagachi_curated_courses c where c.status='published' and e.id=any(c.place_ids));
$$;
revoke all on function public.nagachi_admin_save_external_place(text,text,text,text,text),public.nagachi_admin_external_places(),public.nagachi_public_external_places() from public,anon,authenticated;
grant execute on function public.nagachi_admin_save_external_place(text,text,text,text,text),public.nagachi_admin_external_places() to authenticated;
grant execute on function public.nagachi_public_external_places() to anon;
-- Expand only curated course regions. Existing catalog and anonymous analytics remain unchanged.
alter table public.nagachi_curated_courses drop constraint if exists nagachi_curated_courses_region_check;
alter table public.nagachi_curated_courses add constraint nagachi_curated_courses_region_check check(region in ('서울','경기','강릉','경주','부산','제주','인천','강원','충북','충남','대전','세종','전북','전남','광주','경북','경남','대구','울산'));

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
   or p_region not in ('서울','경기','강릉','경주','부산','제주','인천','강원','충북','충남','대전','세종','전북','전남','광주','경북','경남','대구','울산')
   or p_duration not in ('반나절','하루')
   or p_place_ids is null or cardinality(p_place_ids) not between 1 and 5
   or exists(select 1 from unnest(p_place_ids) as x(v)
             where x.v is null or x.v !~ '^[a-z0-9-]{1,100}$')
   or exists(select 1 from unnest(p_place_ids) x(v) where x.v like 'ext-%' and not exists(select 1 from public.nagachi_external_places e where e.id=x.v))
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

