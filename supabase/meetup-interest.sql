-- v24: consented meetup-specific interest, not booking or confirmed attendance.
-- Apply after install-v23.sql; no names, phone numbers, or payments.
begin;
create table if not exists public.nagachi_meetup_interest (
 meetup_id bigint not null references public.nagachi_operated_meetups(id) on delete cascade,
 token_hash text not null check(token_hash ~ '^[0-9a-f]{64}$'),
 consented_at timestamptz not null default now(),
 expires_at timestamptz not null default(now()+interval '90 days'),
 primary key(meetup_id,token_hash)
);
create index if not exists nagachi_meetup_interest_token_idx on public.nagachi_meetup_interest(token_hash);
alter table public.nagachi_meetup_interest enable row level security;
revoke all on public.nagachi_meetup_interest from public,anon,authenticated;

create or replace function public.nagachi_set_meetup_interest(p_meetup_id bigint,p_token text,p_interested boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_hash text;
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' or p_meetup_id is null or p_interested is null
 then raise exception 'Invalid interest' using errcode='22023'; end if;
 v_hash:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex');
 if not p_interested then
  delete from public.nagachi_meetup_interest where meetup_id=p_meetup_id and token_hash=v_hash;
  return true;
 end if;
 -- Serialize against stage edits. No interest in draft, closed or past meetings.
 perform 1 from public.nagachi_operated_meetups m where m.id=p_meetup_id
  and m.stage='announced' and (m.meet_at is null or m.meet_at>now()) for update;
 if not found then raise exception 'Meetup not open' using errcode='22023'; end if;
 insert into public.nagachi_meetup_interest(meetup_id,token_hash)
 values(p_meetup_id,v_hash)
 on conflict(meetup_id,token_hash) do update set consented_at=now(),expires_at=now()+interval '90 days';
 return true;
end $$;

create or replace function public.nagachi_my_meetup_interest(p_token text)
returns table(meetup_id bigint) language sql stable security definer set search_path='' as $$
 select i.meetup_id from public.nagachi_meetup_interest i
 where p_token ~ '^[0-9a-f]{64}$'
 and i.token_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex')
 and i.expires_at>now()
 order by i.meetup_id;
$$;

create or replace function public.nagachi_clear_meetup_interest(p_token text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception 'Invalid token' using errcode='22023'; end if;
 delete from public.nagachi_meetup_interest i
 where i.token_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex');
 return true;
end $$;

create or replace function public.nagachi_admin_meetup_interest_counts()
returns table(meetup_id bigint,interest_count bigint) language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.nagachi_companion_admins a where a.user_id=auth.uid())
 then raise exception 'Not authorized' using errcode='42501'; end if;
 return query select m.id,count(i.token_hash) from public.nagachi_operated_meetups m
 left join public.nagachi_meetup_interest i on i.meetup_id=m.id and i.expires_at>now()
 group by m.id order by m.id;
end $$;
revoke all on function public.nagachi_set_meetup_interest(bigint,text,boolean) from public,anon,authenticated;
revoke all on function public.nagachi_my_meetup_interest(text) from public,anon,authenticated;
revoke all on function public.nagachi_clear_meetup_interest(text) from public,anon,authenticated;
revoke all on function public.nagachi_admin_meetup_interest_counts() from public,anon,authenticated;
grant execute on function public.nagachi_set_meetup_interest(bigint,text,boolean) to anon;
grant execute on function public.nagachi_my_meetup_interest(text) to anon;
grant execute on function public.nagachi_clear_meetup_interest(text) to anon;
grant execute on function public.nagachi_admin_meetup_interest_counts() to authenticated;
commit;
-- Expired records excluded from counts; operator must periodically purge:
-- delete from public.nagachi_meetup_interest where expires_at <= now();
