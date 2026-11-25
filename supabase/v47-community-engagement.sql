-- Additive: no change to v45 posts, accounts or meetup functions.
begin;
create table public.nagachi_community_comments(
 id bigint generated always as identity primary key,
 post_id bigint not null references public.nagachi_community_posts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 nickname text not null check(char_length(nickname) between 2 and 16),
 body text not null check(char_length(body) between 2 and 500),
 hidden boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.nagachi_community_likes(
 post_id bigint not null references public.nagachi_community_posts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(post_id,user_id)
);
create table public.nagachi_community_comment_reports(
 comment_id bigint not null references public.nagachi_community_comments(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 primary key(comment_id,user_id)
);
alter table public.nagachi_community_comments enable row level security;
alter table public.nagachi_community_likes enable row level security;
alter table public.nagachi_community_comment_reports enable row level security;
revoke all on public.nagachi_community_comments,public.nagachi_community_likes,public.nagachi_community_comment_reports from public,anon,authenticated;
revoke all on sequence public.nagachi_community_comments_id_seq from public,anon,authenticated;
create index nagachi_comments_post_idx on public.nagachi_community_comments(post_id,hidden,id);
create index nagachi_comments_user_idx on public.nagachi_community_comments(user_id,created_at);
create index nagachi_likes_user_idx on public.nagachi_community_likes(user_id,created_at);
create or replace function public.nagachi_community_engagement(p_ids bigint[])
returns table(post_id bigint,likes bigint,comments bigint,liked boolean)
language sql stable security definer set search_path='' as $$
 select p.id,
 (select count(*) from public.nagachi_community_likes l where l.post_id=p.id),
 (select count(*) from public.nagachi_community_comments c where c.post_id=p.id and not c.hidden),
 exists(select 1 from public.nagachi_community_likes l where l.post_id=p.id and l.user_id=auth.uid())
 from public.nagachi_community_posts p
 where not p.hidden and p.id=any(p_ids[1:100]);
$$;
create or replace function public.nagachi_community_set_like(p_id bigint,p_enabled boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null or not exists(select 1 from auth.identities i where i.user_id=u and i.provider='kakao') then raise exception 'Login required' using errcode='42501';end if;
 if p_enabled is null then return false;end if;
 perform 1 from public.nagachi_community_posts p where p.id=p_id and not p.hidden for share;
 if not found then return false;end if;
 if not p_enabled then delete from public.nagachi_community_likes l where l.post_id=p_id and l.user_id=u;return true;end if;
 perform 1 from auth.users x where x.id=u for update;
 if exists(select 1 from public.nagachi_community_likes l where l.post_id=p_id and l.user_id=u) then return true;end if;
 if (select count(*) from public.nagachi_community_likes l where l.user_id=u and l.created_at>now()-interval '1 day')>=100 then return false;end if;
 insert into public.nagachi_community_likes(post_id,user_id) values(p_id,u) on conflict do nothing;return true;
end $$;
create or replace function public.nagachi_community_comments_list(p_id bigint,p_admin boolean default false)
returns table(id bigint,nickname text,body text,created_at timestamptz,mine boolean,hidden boolean,reports bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if p_admin is true and (auth.uid() is null or not exists(select 1 from public.nagachi_companion_admins a where a.user_id=auth.uid())) then raise exception 'Not authorized' using errcode='42501';end if;
 return query select c.id,c.nickname,c.body,c.created_at,coalesce(c.user_id=auth.uid(),false),c.hidden,
 case when p_admin is true then (select count(*) from public.nagachi_community_comment_reports r where r.comment_id=c.id) else 0::bigint end
 from public.nagachi_community_comments c join public.nagachi_community_posts p on p.id=c.post_id
 where p.id=p_id and (p_admin is true or (not p.hidden and not c.hidden)) order by c.id desc limit 100;
end $$;
create or replace function public.nagachi_community_comment_add(p_id bigint,p_nickname text,p_body text)
returns bigint language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();new_id bigint;
begin
 if u is null or not exists(select 1 from auth.identities i where i.user_id=u and i.provider='kakao') then raise exception 'Login required' using errcode='42501';end if;
 perform 1 from public.nagachi_community_posts p where p.id=p_id and not p.hidden for share;
 if not found then return null;end if;
 perform 1 from auth.users x where x.id=u for update;
 if (select count(*) from public.nagachi_community_comments c where c.user_id=u and c.created_at>now()-interval '1 day')>=20 then return null;end if;
 insert into public.nagachi_community_comments(post_id,user_id,nickname,body) values(p_id,u,pg_catalog.btrim(p_nickname),pg_catalog.btrim(p_body)) returning id into new_id;
 return new_id;
end $$;
create or replace function public.nagachi_community_comment_delete(p_id bigint)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Login required' using errcode='42501';end if;
 delete from public.nagachi_community_comments c where c.id=p_id and c.user_id=auth.uid();return found;
end $$;
create or replace function public.nagachi_community_comment_report(p_id bigint)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Login required' using errcode='42501';end if;
 if not exists(select 1 from public.nagachi_community_comments c join public.nagachi_community_posts p on p.id=c.post_id where c.id=p_id and not c.hidden and not p.hidden and c.user_id<>auth.uid()) then return false;end if;
 insert into public.nagachi_community_comment_reports(comment_id,user_id) values(p_id,auth.uid()) on conflict do nothing;return true;
end $$;
create or replace function public.nagachi_admin_comment_hide(p_id bigint,p_hidden boolean)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.nagachi_companion_admins a where a.user_id=auth.uid()) then raise exception 'Not authorized' using errcode='42501';end if;
 if p_hidden is null then return false;end if;
 update public.nagachi_community_comments c set hidden=p_hidden where c.id=p_id;return found;
end $$;
create or replace function public.nagachi_admin_comment_report_queue()
returns table(post_id bigint,reports bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.nagachi_companion_admins a where a.user_id=auth.uid()) then raise exception 'Not authorized' using errcode='42501';end if;
 return query select c.post_id,count(*) from public.nagachi_community_comment_reports r join public.nagachi_community_comments c on c.id=r.comment_id where not c.hidden group by c.post_id order by count(*) desc limit 100;
end $$;
revoke all on function public.nagachi_community_engagement(bigint[]),public.nagachi_community_set_like(bigint,boolean),public.nagachi_community_comments_list(bigint,boolean),public.nagachi_community_comment_add(bigint,text,text),public.nagachi_community_comment_delete(bigint),public.nagachi_community_comment_report(bigint),public.nagachi_admin_comment_hide(bigint,boolean),public.nagachi_admin_comment_report_queue() from public,anon,authenticated;
grant execute on function public.nagachi_community_engagement(bigint[]),public.nagachi_community_comments_list(bigint,boolean) to anon,authenticated;
grant execute on function public.nagachi_community_set_like(bigint,boolean),public.nagachi_community_comment_add(bigint,text,text),public.nagachi_community_comment_delete(bigint),public.nagachi_community_comment_report(bigint),public.nagachi_admin_comment_hide(bigint,boolean),public.nagachi_admin_comment_report_queue() to authenticated;
commit;
