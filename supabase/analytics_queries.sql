-- Supabase SQL Editor에서 원하는 문단만 선택해 실행하세요. 시각은 한국 기준입니다.
-- 모든 사업 KPI는 DEMO SAMPLE을 제외합니다. 테스트 확인 때만 "not is_demo"를 "is_demo"로 바꾸세요.
-- 브라우저 식별값은 사람이 아닙니다. 기기/브라우저 중복 및 자동 입력이 있을 수 있습니다.

-- 1. 일별 방문 이벤트 / 익명 브라우저 수
select (created_at at time zone 'Asia/Seoul')::date as day,
       count(*) as page_views, count(distinct session_id) as anonymous_browsers
from public.analytics_events where event_name='page_view' and not is_demo
group by 1 order by 1 desc;

-- 2. 장소 상세 조회수
select place_id, count(*) as detail_views, count(distinct session_id) as browsers
from public.analytics_events where event_name='place_view' and not is_demo
group by 1 order by detail_views desc;

-- 3~5. 저장률 / 공유율 / 같이 가보고 싶어요 클릭률
-- 분모: 장소를 상세 조회한 브라우저-장소 쌍. 분자: 같은 쌍에서 해당 행동을 한 경우.
-- 홈에서 저장하고 상세를 보지 않은 경우 이 퍼널 계산에서는 제외됩니다.
with per_place_browser as (
  select session_id, place_id,
    bool_or(event_name='place_view') as viewed,
    bool_or(event_name='save_place') as saved,
    bool_or(event_name='share_place') as shared,
    bool_or(event_name='companion_interest') as interested
  from public.analytics_events
  where not is_demo and place_id is not null and created_at >= now() - interval '30 days'
  group by 1,2
)
select count(*) filter(where viewed) as viewed_pairs,
  round(100.0 * count(*) filter(where viewed and saved) / nullif(count(*) filter(where viewed),0),2) as save_rate_pct,
  round(100.0 * count(*) filter(where viewed and shared) / nullif(count(*) filter(where viewed),0),2) as share_rate_pct,
  round(100.0 * count(*) filter(where viewed and interested) / nullif(count(*) filter(where viewed),0),2) as companion_click_rate_pct
from per_place_browser;

-- 6. Premium 지불의향별 브라우저 수 (최근 응답 1개로 집계)
with latest as (
 select distinct on (session_id) session_id, details->>'willingness' as willingness
 from public.analytics_events
 where event_name='premium_willingness' and not is_demo
 order by session_id, created_at desc
)
select willingness, count(*) as anonymous_browsers from latest group by 1 order by 2 desc;

-- 7. 인기 지역 (장소 상세 조회 기준)
select region, count(*) as detail_views from public.analytics_events
where event_name='place_view' and not is_demo and region is not null group by 1 order by 2 desc;

-- 8. 인기 카테고리
select category, count(*) as detail_views from public.analytics_events
where event_name='place_view' and not is_demo and category is not null group by 1 order by 2 desc;

-- 9. 인기 장소 (상세 조회, 저장, 공유, 동행 관심을 나란히 비교)
select place_id,
 count(*) filter(where event_name='place_view') as views,
 count(distinct session_id) filter(where event_name='save_place') as saves,
 count(distinct session_id) filter(where event_name='share_place') as shares,
 count(distinct session_id) filter(where event_name='companion_interest') as companion_browsers
from public.analytics_events where not is_demo and place_id is not null group by 1 order by views desc;

-- 운영 확인: 이벤트 수집 여부 (데모 포함)
-- select event_name,is_demo,count(*) from public.analytics_events group by 1,2 order by 1;
-- 보관 기간 90일을 지난 이벤트 삭제
-- delete from public.analytics_events where created_at < now() - interval '90 days';
