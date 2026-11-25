
-- Account-only applications; preserve all existing records and operator workflows.
alter table public.nagachi_party_applications add column if not exists user_id uuid references auth.users(id) on delete cascade;
create unique index if not exists nagachi_party_account_unique on public.nagachi_party_applications(meetup_id,user_id) where user_id is not null;
revoke execute on function public.nagachi_party_apply(bigint,text) from public,anon,authenticated;
create or replace function public.nagachi_account_party_apply(p_meetup_id bigint)
returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null or not exists(select 1 from auth.identities i where i.user_id=u and i.provider='kakao') then raise exception 'Login required' using errcode='42501'; end if;
 perform 1 from public.nagachi_operated_meetups m where m.id=p_meetup_id and m.recruitment_open and m.stage='announced' and m.meet_at>now() and m.meet_at<=now()+interval '90 days' for update;
 if not found then raise exception 'Applications closed' using errcode='22023'; end if;
 if exists(select 1 from public.nagachi_party_applications a where a.meetup_id=p_meetup_id and a.user_id=u) then return true; end if;
 if (select count(*) from public.nagachi_party_applications a where a.meetup_id=p_meetup_id)>=200 then raise exception 'Application limit reached' using errcode='22023'; end if;
 insert into public.nagachi_party_applications(meetup_id,user_id,token_hash) values(p_meetup_id,u,pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to('account:'||u::text,'UTF8')),'hex'));
 return true;
end $$;
create or replace function public.nagachi_account_party_withdraw(p_meetup_id bigint)
returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise exception 'Login required' using errcode='42501'; end if;
 perform 1 from public.nagachi_operated_meetups m where m.id=p_meetup_id for update;
 delete from public.nagachi_party_applications a where a.meetup_id=p_meetup_id and a.user_id=u;
 return true;
end $$;
create or replace function public.nagachi_account_party_list()
returns table(meetup_id bigint,title text,status text,meet_at timestamptz,meet_place text)
language sql stable security definer set search_path='' as $$
 select m.id,m.title,a.status,m.meet_at,case when a.status='approved' and m.stage in ('announced','closed') and m.meet_at>now() then m.meet_place else null end
 from public.nagachi_party_applications a join public.nagachi_operated_meetups m on m.id=a.meetup_id
 where auth.uid() is not null and a.user_id=auth.uid() order by m.meet_at desc nulls last,m.id desc;
$$;
-- Exact meetup subscription (separate from activity preference).
create table if not exists public.nagachi_meetup_subscriptions(
 user_id uuid not null references auth.users(id) on delete cascade,
 meetup_id bigint not null references public.nagachi_operated_meetups(id) on delete cascade,
 expires_at timestamptz not null default now()+interval '90 days',primary key(user_id,meetup_id));
alter table public.nagachi_meetup_subscriptions enable row level security;
revoke all on public.nagachi_meetup_subscriptions from public,anon,authenticated;
create or replace function public.nagachi_account_meetup_subscribe(p_meetup_id bigint,p_enabled boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null or not exists(select 1 from auth.identities i where i.user_id=u and i.provider='kakao') then raise exception 'Login required' using errcode='42501'; end if;
 if p_enabled is null then return false; end if;
 if not p_enabled then delete from public.nagachi_meetup_subscriptions s where s.user_id=u and s.meetup_id=p_meetup_id;return true;end if;
 perform 1 from public.nagachi_operated_meetups m where m.id=p_meetup_id and m.stage='announced' and (m.meet_at is null or m.meet_at>now()) for update;
 if not found then return false;end if;
 insert into public.nagachi_meetup_subscriptions(user_id,meetup_id) values(u,p_meetup_id) on conflict(user_id,meetup_id) do update set expires_at=now()+interval '90 days';
 return true;
end $$;
create or replace function public.nagachi_account_meetup_news()
returns table(meetup_id bigint,title text,meet_at timestamptz,stage text,recruitment_open boolean)
language sql stable security definer set search_path='' as $$
 select m.id,case when m.stage in ('announced','closed') then m.title else '모임 공개 준비 중' end,
 case when m.stage in ('announced','closed') then m.meet_at else null end,m.stage,
 (m.recruitment_open and m.stage='announced' and m.meet_at>now())
 from public.nagachi_meetup_subscriptions s join public.nagachi_operated_meetups m on m.id=s.meetup_id
 where auth.uid() is not null and s.user_id=auth.uid() and s.expires_at>now() order by m.updated_at desc limit 100;
$$;
revoke all on function public.nagachi_account_party_apply(bigint),public.nagachi_account_party_withdraw(bigint),public.nagachi_account_party_list(),public.nagachi_account_meetup_subscribe(bigint,boolean),public.nagachi_account_meetup_news() from public,anon,authenticated;
grant execute on function public.nagachi_account_party_apply(bigint),public.nagachi_account_party_withdraw(bigint),public.nagachi_account_party_list(),public.nagachi_account_meetup_subscribe(bigint,boolean),public.nagachi_account_meetup_news() to authenticated;
-- Community MVP. Public reads expose only public text and nickname, not account IDs.
create table if not exists public.nagachi_community_posts(
 id bigint generated always as identity primary key,user_id uuid not null references auth.users(id) on delete cascade,
 nickname text not null check(char_length(nickname) between 2 and 16),
 category text not null check(category in ('daily','trip','food','hike','review')),
 title text not null check(char_length(title) between 2 and 80),
 body text not null check(char_length(body) between 2 and 1500),
 hidden boolean not null default false,created_at timestamptz not null default now());
create table if not exists public.nagachi_community_reports(
 post_id bigint not null references public.nagachi_community_posts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now(),primary key(post_id,user_id));
alter table public.nagachi_community_posts enable row level security;
alter table public.nagachi_community_reports enable row level security;
revoke all on public.nagachi_community_posts,public.nagachi_community_reports from public,anon,authenticated;
revoke all on sequence public.nagachi_community_posts_id_seq from public,anon,authenticated;
create index if not exists nagachi_community_recent on public.nagachi_community_posts(hidden,created_at desc);
create or replace function public.nagachi_community_feed()
returns table(id bigint,nickname text,category text,title text,body text,created_at timestamptz)
language sql stable security definer set search_path='' as $$
 select p.id,p.nickname,p.category,p.title,p.body,p.created_at from public.nagachi_community_posts p where not p.hidden order by p.created_at desc,p.id desc limit 60;
$$;
create or replace function public.nagachi_community_mine()
returns table(id bigint) language sql stable security definer set search_path='' as $$
 select p.id from public.nagachi_community_posts p where auth.uid() is not null and p.user_id=auth.uid();
$$;
create or replace function public.nagachi_community_post(p_nickname text,p_category text,p_title text,p_body text)
returns bigint language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();new_id bigint;
begin
 if u is null or not exists(select 1 from auth.identities i where i.user_id=u and i.provider='kakao') then raise exception 'Login required' using errcode='42501';end if;
 perform 1 from auth.users x where x.id=u for update;
 if (select count(*) from public.nagachi_community_posts p where p.user_id=u and p.created_at>now()-interval '1 day')>=10 then raise exception 'Daily post limit' using errcode='22023';end if;
 insert into public.nagachi_community_posts(user_id,nickname,category,title,body) values(u,pg_catalog.btrim(p_nickname),p_category,pg_catalog.btrim(p_title),pg_catalog.btrim(p_body)) returning id into new_id;
 return new_id;
end $$;
create or replace function public.nagachi_community_delete(p_id bigint)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Login required' using errcode='42501';end if;
 delete from public.nagachi_community_posts p where p.id=p_id and p.user_id=auth.uid();return found;
end $$;
create or replace function public.nagachi_community_report(p_id bigint)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Login required' using errcode='42501';end if;
 if not exists(select 1 from public.nagachi_community_posts p where p.id=p_id and not p.hidden and p.user_id<>auth.uid()) then return false;end if;
 insert into public.nagachi_community_reports(post_id,user_id) values(p_id,auth.uid()) on conflict do nothing;return true;
end $$;
create or replace function public.nagachi_admin_community()
returns table(id bigint,nickname text,category text,title text,body text,hidden boolean,created_at timestamptz,reports bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.nagachi_companion_admins a where a.user_id=auth.uid()) then raise exception 'Not authorized' using errcode='42501';end if;
 return query select p.id,p.nickname,p.category,p.title,p.body,p.hidden,p.created_at,(select count(*) from public.nagachi_community_reports r where r.post_id=p.id) from public.nagachi_community_posts p order by (select count(*) from public.nagachi_community_reports r where r.post_id=p.id) desc,p.created_at desc limit 100;
end $$;
create or replace function public.nagachi_admin_community_hide(p_id bigint,p_hidden boolean)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.nagachi_companion_admins a where a.user_id=auth.uid()) then raise exception 'Not authorized' using errcode='42501';end if;
 if p_hidden is null then return false;end if;
 update public.nagachi_community_posts p set hidden=p_hidden where p.id=p_id;return found;
end $$;
revoke all on function public.nagachi_community_feed(),public.nagachi_community_mine(),public.nagachi_community_post(text,text,text,text),public.nagachi_community_delete(bigint),public.nagachi_community_report(bigint),public.nagachi_admin_community(),public.nagachi_admin_community_hide(bigint,boolean) from public,anon,authenticated;
grant execute on function public.nagachi_community_feed() to anon,authenticated;
grant execute on function public.nagachi_community_mine(),public.nagachi_community_post(text,text,text,text),public.nagachi_community_delete(bigint),public.nagachi_community_report(bigint),public.nagachi_admin_community(),public.nagachi_admin_community_hide(bigint,boolean) to authenticated;
