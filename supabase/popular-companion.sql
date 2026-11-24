-- 나가치 v21: 공개 가능한 '가보고 싶어요' 관심 장소 순위.
-- 반드시 supabase/schema.sql 선행 적용. 실제 동의 후 저장된 데이터만 사용.
-- 동의자별 개별 응답, 익명 UUID, 나이/성별 등은 응답하지 않습니다.
-- 90일 이내 실제 관심 브라우저가 5개 이상인 장소·활동 조합만 공개합니다.
begin;
create or replace function public.nagachi_public_popular_places()
returns table(place_id text, activity text, interested_count bigint)
language sql stable security definer set search_path = ''
as $$
 with interest as (
   select e.place_id, a.value as activity, e.session_id
   from public.analytics_events e
   cross join lateral pg_catalog.jsonb_array_elements_text(
     case when pg_catalog.jsonb_typeof(e.details->'activities')='array'
       then e.details->'activities' else '[]'::jsonb end
   ) as a(value)
   where e.event_name='premium_willingness'
     and e.is_demo=false
     and e.place_id is not null
     and e.created_at>=now()-interval '90 days'
     and a.value in ('food','hike','outing','travel')
 )
 select i.place_id, i.activity, count(distinct i.session_id)::bigint as interested_count
 from interest i
 group by i.place_id, i.activity
 having count(distinct i.session_id)>=5
 order by interested_count desc, i.place_id, i.activity
 limit 12
$$;
revoke all on function public.nagachi_public_popular_places() from public,anon,authenticated;
grant execute on function public.nagachi_public_popular_places() to anon;
comment on function public.nagachi_public_popular_places() is
  '최근 90일 동의 저장 데이터 중 장소별 5개 이상 서로 다른 익명 브라우저의 관심만 반환. 실제 참여 확정 인원 아님.';
commit;
