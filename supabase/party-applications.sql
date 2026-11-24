-- v25: opt-in free pilot applications, device-based, no identity or payment.
-- Apply after install-v23.sql and meetup-interest.sql. No automatic recruitment.
begin;
alter table public.nagachi_operated_meetups add column if not exists recruitment_open boolean not null default false;
create table if not exists public.nagachi_party_applications(
 id bigint generated always as identity primary key,
 meetup_id bigint not null references public.nagachi_operated_meetups(id) on delete cascade,
 token_hash text not null check(token_hash ~ '^[0-9a-f]{64}$'),
 status text not null default 'pending' check(status in ('pending','approved','waitlisted','cancelled')),
 requested_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(meetup_id,token_hash)
);
alter table public.nagachi_party_applications enable row level security;
revoke all on public.nagachi_party_applications from public,anon,authenticated;
revoke all on sequence public.nagachi_party_applications_id_seq from public,anon,authenticated;
create index if not exists nagachi_party_token_idx on public.nagachi_party_applications(token_hash);
-- All mutations lock the parent meetup first, including existing v22 edits.
create or replace function public.nagachi_party_guard_meetup()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.nagachi_party_applications a where a.meetup_id=old.id
  and a.status in ('pending','approved','waitlisted')) then
  if new.meet_at is distinct from old.meet_at or new.meet_place is distinct from old.meet_place
   or new.activity is distinct from old.activity or new.course_id is distinct from old.course_id
   or new.title is distinct from old.title or new.intro is distinct from old.intro
   or new.stage in ('draft','planning') then
   raise exception 'Cancel active applications before changing meetup details' using errcode='22023';
  end if;
 end if;
 if new.preferred_size < (select count(*) from public.nagachi_party_applications a
  where a.meetup_id=old.id and a.status='approved') then
  raise exception 'Capacity below approvals' using errcode='22023';
 end if;
 if new.stage<>'announced' or new.meet_at is null or new.meet_at<=now()
  or new.meet_at>now()+interval '90 days' or nullif(pg_catalog.btrim(new.meet_place),'') is null
 then new.recruitment_open:=false; end if;
 return new;
end $$;
revoke all on function public.nagachi_party_guard_meetup() from public,anon,authenticated;
drop trigger if exists nagachi_party_guard on public.nagachi_operated_meetups;
create trigger nagachi_party_guard before update on public.nagachi_operated_meetups
 for each row execute function public.nagachi_party_guard_meetup();

create or replace function public.nagachi_public_party_open()
returns table(meetup_id bigint) language sql stable security definer set search_path='' as $$
 select m.id from public.nagachi_operated_meetups m where m.recruitment_open
 and m.stage='announced' and m.meet_at>now() and m.meet_at<=now()+interval '90 days';
$$;
create or replace function public.nagachi_party_apply(p_meetup_id bigint,p_token text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception 'Invalid token' using errcode='22023'; end if;
 perform 1 from public.nagachi_operated_meetups m where m.id=p_meetup_id
 and m.recruitment_open and m.stage='announced' and m.meet_at>now()
 and m.meet_at<=now()+interval '90 days' for update;
 if not found then raise exception 'Applications closed' using errcode='22023'; end if;
 if not exists(select 1 from public.nagachi_party_applications a where a.meetup_id=p_meetup_id
 and a.token_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex'))
 and (select count(*) from public.nagachi_party_applications a where a.meetup_id=p_meetup_id)>=200
 then raise exception 'Application limit reached' using errcode='22023'; end if;
 insert into public.nagachi_party_applications(meetup_id,token_hash)
 values(p_meetup_id,pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex'))
 on conflict(meetup_id,token_hash) do nothing;
 return true;
end $$;
create or replace function public.nagachi_party_withdraw(p_meetup_id bigint,p_token text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception 'Invalid token' using errcode='22023'; end if;
 perform 1 from public.nagachi_operated_meetups m where m.id=p_meetup_id for update;
 delete from public.nagachi_party_applications a where a.meetup_id=p_meetup_id
 and a.token_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex');
 return true;
end $$;
create or replace function public.nagachi_my_party_applications(p_token text)
returns table(meetup_id bigint,title text,status text,meet_at timestamptz,meet_place text)
language sql stable security definer set search_path='' as $$
 select m.id,m.title,a.status,m.meet_at,
 case when a.status='approved' and m.stage in ('announced','closed') and m.meet_at>now()
 then m.meet_place else null end
 from public.nagachi_party_applications a join public.nagachi_operated_meetups m on m.id=a.meetup_id
 where p_token ~ '^[0-9a-f]{64}$'
 and a.token_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex')
 order by m.meet_at desc nulls last,m.id desc;
$$;
create or replace function public.nagachi_admin_party_open(p_meetup_id bigint,p_open boolean)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.nagachi_companion_admins x where x.user_id=auth.uid())
 then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_open is null then raise exception 'Invalid option' using errcode='22023'; end if;
 update public.nagachi_operated_meetups m set recruitment_open=p_open
 where m.id=p_meetup_id and (not p_open or (m.stage='announced' and m.meet_at>now()
 and m.meet_at<=now()+interval '90 days' and nullif(pg_catalog.btrim(m.meet_place),'') is not null));
 if not found then raise exception 'Publish meetup with future date and meeting place first' using errcode='22023'; end if;
 return true;
end $$;
create or replace function public.nagachi_admin_party_list(p_meetup_id bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.nagachi_companion_admins x where x.user_id=auth.uid())
 then raise exception 'Not authorized' using errcode='42501'; end if;
 select pg_catalog.jsonb_build_object('open',m.recruitment_open,'capacity',m.preferred_size,
 'applications',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',a.id,'status',a.status,'requested_at',a.requested_at) order by a.requested_at,a.id)
 from public.nagachi_party_applications a where a.meetup_id=m.id),'[]'::jsonb)) into v
 from public.nagachi_operated_meetups m where m.id=p_meetup_id;
 return v;
end $$;
create or replace function public.nagachi_admin_party_decide(p_meetup_id bigint,p_application_id bigint,p_status text)
returns boolean language plpgsql security definer set search_path='' as $$
declare m public.nagachi_operated_meetups%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from public.nagachi_companion_admins x where x.user_id=auth.uid())
 then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_status is null or p_status not in ('approved','waitlisted','cancelled') then raise exception 'Invalid status' using errcode='22023'; end if;
 select * into m from public.nagachi_operated_meetups x where x.id=p_meetup_id for update;
 if not found then raise exception 'Meetup not found' using errcode='22023'; end if;
 if p_status<>'cancelled' and (m.stage not in ('announced','closed') or m.meet_at is null or m.meet_at<=now()) then
 raise exception 'Meetup not active' using errcode='22023'; end if;
 if p_status='approved' and (select count(*) from public.nagachi_party_applications a
 where a.meetup_id=m.id and a.status='approved' and a.id<>p_application_id)>=m.preferred_size
 then raise exception 'Capacity full' using errcode='22023'; end if;
 update public.nagachi_party_applications a set status=p_status,updated_at=now()
 where a.id=p_application_id and a.meetup_id=m.id and a.status<>'cancelled';
 if not found then raise exception 'Application not active' using errcode='22023'; end if;
 return true;
end $$;
revoke all on function public.nagachi_public_party_open(),public.nagachi_party_apply(bigint,text),public.nagachi_party_withdraw(bigint,text),public.nagachi_my_party_applications(text),public.nagachi_admin_party_open(bigint,boolean),public.nagachi_admin_party_list(bigint),public.nagachi_admin_party_decide(bigint,bigint,text) from public,anon,authenticated;
grant execute on function public.nagachi_public_party_open(),public.nagachi_party_apply(bigint,text),public.nagachi_party_withdraw(bigint,text),public.nagachi_my_party_applications(text) to anon;
grant execute on function public.nagachi_admin_party_open(bigint,boolean),public.nagachi_admin_party_list(bigint),public.nagachi_admin_party_decide(bigint,bigint,text) to authenticated;
commit;
-- Operator: periodically delete records 30 days after the scheduled meetup.
-- delete from public.nagachi_party_applications a using public.nagachi_operated_meetups m where a.meetup_id=m.id and m.meet_at<now()-interval '30 days';
