-- v40: account-based activity notices. Apply after install-v26.sql.
begin;
create table if not exists public.nagachi_account_subscriptions(
 user_id uuid not null references auth.users(id) on delete cascade,
 activity text not null check(activity in ('food','hike','outing','travel')),
 expires_at timestamptz not null default(now()+interval '90 days'),
 primary key(user_id,activity)
);
alter table public.nagachi_account_subscriptions enable row level security;
revoke all on public.nagachi_account_subscriptions from public,anon,authenticated;
create or replace function public.nagachi_account_is_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.nagachi_companion_admins a where a.user_id=auth.uid())
$$;
create or replace function public.nagachi_account_subscribe(p_activities text[]) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();
begin
 if v_uid is null then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_activities is null or cardinality(p_activities)>4 or exists(select 1 from unnest(p_activities) a(v) where v is null or v not in ('food','hike','outing','travel')) then return false; end if;
 perform 1 from auth.users u where u.id=v_uid for update;
 delete from public.nagachi_account_subscriptions s where s.user_id=v_uid;
 insert into public.nagachi_account_subscriptions(user_id,activity) select distinct v_uid,v from unnest(p_activities) a(v);
 return true;
end $$;
create or replace function public.nagachi_account_news() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();
begin
 if v_uid is null then raise exception 'Not authorized' using errcode='42501'; end if;
 return jsonb_build_object('activities',coalesce((select jsonb_agg(s.activity) from public.nagachi_account_subscriptions s where s.user_id=v_uid and s.expires_at>now()),'[]'::jsonb),
 'items',coalesce((select jsonb_agg(to_jsonb(n) order by n.published_at desc) from
 (select g.id,g.activity,g.title,g.body,g.meet_at,g.meet_place,g.published_at from public.nagachi_group_notices g
 where g.status='published' and exists(select 1 from public.nagachi_account_subscriptions s where s.user_id=v_uid and s.activity=g.activity and s.expires_at>now())
 order by g.published_at desc limit 30)n),'[]'::jsonb));
end $$;
revoke all on function public.nagachi_account_is_admin() from public,anon,authenticated;
revoke all on function public.nagachi_account_subscribe(text[]) from public,anon,authenticated;
revoke all on function public.nagachi_account_news() from public,anon,authenticated;
grant execute on function public.nagachi_account_is_admin() to authenticated;
grant execute on function public.nagachi_account_subscribe(text[]) to authenticated;
grant execute on function public.nagachi_account_news() to authenticated;
-- Legacy users can still read/unsubscribe existing device notices; new subscriptions require login.
revoke execute on function public.nagachi_subscribe_updates(text,text,text[]) from public,anon,authenticated;
commit;
-- Operator cleanup: delete from public.nagachi_account_subscriptions where expires_at<=now();
