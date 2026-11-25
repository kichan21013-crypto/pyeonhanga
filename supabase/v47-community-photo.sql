-- Bounded photo pilot: one JPEG per post; 300 images, 120 KB each.
create schema if not exists nagachi_photo;
revoke all on schema nagachi_photo from public,anon,authenticated;
grant usage on schema nagachi_photo to anon,authenticated;
create table if not exists nagachi_photo.images(post_id bigint primary key references public.nagachi_community_posts(id) on delete cascade,jpeg bytea not null check(octet_length(jpeg) between 4 and 120000));
alter table nagachi_photo.images enable row level security;
revoke all on nagachi_photo.images from public,anon,authenticated;
create or replace function nagachi_photo.read_photo(p_id bigint,p_admin boolean)
returns text language plpgsql stable security definer set search_path='' as $$
begin
 if p_admin is true and (auth.uid() is null or not exists(select 1 from public.nagachi_companion_admins a where a.user_id=auth.uid())) then raise exception 'Not authorized' using errcode='42501';end if;
 return (select replace(encode(i.jpeg,'base64'),chr(10),'') from nagachi_photo.images i join public.nagachi_community_posts p on p.id=i.post_id where p.id=p_id and (not p.hidden or p_admin is true));
end $$;
create or replace function nagachi_photo.create_post(p_nickname text,p_category text,p_title text,p_body text,p_photo text)
returns bigint language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); j bytea; n bigint;
begin
 if u is null or not exists(select 1 from auth.identities i where i.user_id=u and i.provider='kakao') then raise exception 'Login required' using errcode='42501';end if;
 if p_photo is null or length(p_photo)>160000 then raise exception 'Photo size limit' using errcode='22023';end if;
 j:=decode(p_photo,'base64');
 if octet_length(j) not between 4 and 120000 or substring(j from 1 for 3)<>decode('ffd8ff','hex') or substring(j from octet_length(j)-1 for 2)<>decode('ffd9','hex') then raise exception 'JPEG required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(470001);
 if (select count(*) from nagachi_photo.images)>=300 then raise exception 'Pilot photo limit' using errcode='22023';end if;
 n:=public.nagachi_community_post(p_nickname,p_category,p_title,p_body);
 insert into nagachi_photo.images(post_id,jpeg) values(n,j);
 return n;
end $$;
revoke all on function nagachi_photo.read_photo(bigint,boolean),nagachi_photo.create_post(text,text,text,text,text) from public,anon,authenticated;
grant execute on function nagachi_photo.read_photo(bigint,boolean) to anon,authenticated;
grant execute on function nagachi_photo.create_post(text,text,text,text,text) to authenticated;
create or replace function public.nagachi_community_photo(p_id bigint,p_admin boolean default false)
returns text language sql stable security invoker set search_path='' as $$ select nagachi_photo.read_photo(p_id,p_admin) $$;
create or replace function public.nagachi_community_post_photo(p_nickname text,p_category text,p_title text,p_body text,p_photo text)
returns bigint language sql security invoker set search_path='' as $$ select nagachi_photo.create_post(p_nickname,p_category,p_title,p_body,p_photo) $$;
revoke all on function public.nagachi_community_photo(bigint,boolean),public.nagachi_community_post_photo(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.nagachi_community_photo(bigint,boolean) to anon,authenticated;
grant execute on function public.nagachi_community_post_photo(text,text,text,text,text) to authenticated;
notify pgrst,'reload schema';
