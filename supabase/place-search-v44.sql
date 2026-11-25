-- v44: preserve source attribution; enforce a global operator-only search limit.
alter table public.nagachi_external_places add column if not exists source text not null default 'manual' check(source in ('manual','geoapify'));
create table if not exists public.nagachi_place_search_quota(
 singleton boolean primary key default true check(singleton),
 day date not null, used integer not null check(used between 0 and 50),
 last_at timestamptz not null
);
alter table public.nagachi_place_search_quota enable row level security;
revoke all on public.nagachi_place_search_quota from public,anon,authenticated;
create or replace function public.nagachi_admin_claim_place_search()
returns boolean language plpgsql security definer set search_path='' as $$
declare today date:=(now() at time zone 'Asia/Seoul')::date; granted boolean;
begin
 if auth.uid() is null or not exists(select 1 from public.nagachi_companion_admins a where a.user_id=auth.uid()) then raise exception 'Not authorized' using errcode='42501';end if;
 insert into public.nagachi_place_search_quota(singleton,day,used,last_at) values(true,today,1,now())
 on conflict(singleton) do update set day=today,used=case when nagachi_place_search_quota.day=today then nagachi_place_search_quota.used+1 else 1 end,last_at=now()
 where nagachi_place_search_quota.last_at<=now()-interval '2 seconds' and (nagachi_place_search_quota.day<>today or nagachi_place_search_quota.used<50)
 returning true into granted;
 return coalesce(granted,false);
end $$;
create or replace function public.nagachi_admin_save_external_place_v44(p_name text,p_address text,p_region text,p_category text,p_map_url text,p_source text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb; src text;
begin
 if auth.uid() is null or not exists(select 1 from public.nagachi_companion_admins a where a.user_id=auth.uid()) then raise exception 'Not authorized' using errcode='42501';end if;
 if p_source is null or p_source not in ('manual','geoapify') then raise exception 'Invalid source' using errcode='22023';end if;
 r:=public.nagachi_admin_save_external_place(p_name,p_address,p_region,p_category,p_map_url);
 update public.nagachi_external_places e set source=case when p_source='geoapify' then 'geoapify' else e.source end where e.id=r->>'id' returning e.source into src;
 return r||jsonb_build_object('source',src);
end $$;
create or replace function public.nagachi_admin_external_places_v44()
returns table(id text,name text,address text,region text,category text,map_url text,source text) language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.nagachi_companion_admins a where a.user_id=auth.uid()) then raise exception 'Not authorized' using errcode='42501';end if;
 return query select e.id,e.name,e.address,e.region,e.category,e.map_url,e.source from public.nagachi_external_places e order by e.created_at desc;
end $$;
create or replace function public.nagachi_public_external_places_v44()
returns table(id text,name text,address text,region text,category text,map_url text,source text) language sql stable security definer set search_path='' as $$
 select e.id,e.name,e.address,e.region,e.category,e.map_url,e.source from public.nagachi_external_places e where exists(select 1 from public.nagachi_curated_courses c where c.status='published' and e.id=any(c.place_ids));
$$;
revoke all on function public.nagachi_admin_claim_place_search(),public.nagachi_admin_save_external_place_v44(text,text,text,text,text,text),public.nagachi_admin_external_places_v44(),public.nagachi_public_external_places_v44() from public,anon,authenticated;
grant execute on function public.nagachi_admin_claim_place_search(),public.nagachi_admin_save_external_place_v44(text,text,text,text,text,text),public.nagachi_admin_external_places_v44() to authenticated;
grant execute on function public.nagachi_public_external_places_v44() to anon;
