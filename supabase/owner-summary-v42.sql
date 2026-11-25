-- Owner-only aggregate snapshot. No member identities or tokens returned.
create or replace function public.nagachi_admin_owner_summary()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_today timestamptz := date_trunc('day',now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
 if auth.uid() is null or not exists(select 1 from public.nagachi_companion_admins a where a.user_id=auth.uid()) then
  raise exception 'Not authorized' using errcode='42501';
 end if;
 return jsonb_build_object(
 'members',(select count(*) from auth.users u where not exists(select 1 from public.nagachi_companion_admins a where a.user_id=u.id) and u.deleted_at is null and not coalesce(u.is_anonymous,false)),
 'new_today',(select count(*) from auth.users u where u.created_at>=v_today and not exists(select 1 from public.nagachi_companion_admins a where a.user_id=u.id) and u.deleted_at is null and not coalesce(u.is_anonymous,false)),
 'owners',(select count(*) from public.nagachi_companion_admins),
 'subscribed_members',(select count(distinct s.user_id) from public.nagachi_account_subscriptions s join auth.users u on u.id=s.user_id where s.expires_at>now() and u.deleted_at is null and not coalesce(u.is_anonymous,false) and not exists(select 1 from public.nagachi_companion_admins a where a.user_id=s.user_id)),
 'pending',(select count(*) from public.nagachi_party_applications where status='pending'),
 'pending_groups',coalesce((select jsonb_agg(to_jsonb(t) order by t.pending desc,t.id desc) from (select m.id,m.title,count(*) as pending from public.nagachi_party_applications a join public.nagachi_operated_meetups m on m.id=a.meetup_id where a.status='pending' group by m.id,m.title order by count(*) desc,m.id desc limit 5)t),'[]'::jsonb),
 'open_meetups',(select count(*) from public.nagachi_operated_meetups where recruitment_open and stage='announced' and meet_at>now()),
 'draft_courses',(select count(*) from public.nagachi_curated_courses where status='draft'),
 'draft_notices',(select count(*) from public.nagachi_group_notices where status='draft')
 );
end $$;
revoke all on function public.nagachi_admin_owner_summary() from public,anon,authenticated;
grant execute on function public.nagachi_admin_owner_summary() to authenticated;
