-- Supabase SQL Editor에서 원하는 문단만 선택해 실행하세요. 시각은 한국 기준입니다.
-- 모든 사업 KPI는 DEMO SAMPLE을 제외합니다.
-- session_id는 사람/회원 수가 아니라 익명 브라우저 단위입니다.
-- 지불의향은 실제 결제가 아닙니다. 최종 사업검증은 실제 유료 파일럿 결제로 판단하세요.

-- A. 최근 30일 익명 방문자 수 / 페이지뷰
select count(distinct session_id) as anonymous_browsers,
       count(*) filter (where event_name='page_view') as page_views
from public.analytics_events
where not is_demo and created_at >= now() - interval '30 days';

-- B. rhythm_start -> recommendation_view 전환율
with s as (
  select session_id,
         bool_or(event_name='rhythm_start') as started,
         bool_or(event_name='recommendation_view') as recommended
  from public.analytics_events
  where not is_demo and created_at >= now() - interval '30 days'
  group by 1
)
select count(*) filter(where started) as started_browsers,
       count(*) filter(where started and recommended) as recommendation_browsers,
       round(100.0 * count(*) filter(where started and recommended) / nullif(count(*) filter(where started),0),2) as conversion_pct
from s;

-- C. 욕구별 선택 브라우저 수
select desire, count(distinct session_id) as browsers
from public.analytics_events e
cross join lateral jsonb_array_elements_text(coalesce(e.details->'desires','[]'::jsonb)) d(desire)
where e.event_name='desire_selected' and not e.is_demo and e.created_at >= now() - interval '30 days'
group by 1 order by 2 desc;

-- D. 활동별 선택 브라우저 수
select activity, count(distinct session_id) as browsers
from public.analytics_events e
cross join lateral jsonb_array_elements_text(coalesce(e.details->'activities','[]'::jsonb)) a(activity)
where e.event_name='activity_selected' and not e.is_demo and e.created_at >= now() - interval '30 days'
group by 1 order by 2 desc;

-- E. 동행 유형별 선택 브라우저 수
select companion, count(distinct session_id) as browsers
from public.analytics_events e
cross join lateral jsonb_array_elements_text(coalesce(e.details->'companions','[]'::jsonb)) c(companion)
where e.event_name='companion_selected' and not e.is_demo and e.created_at >= now() - interval '30 days'
group by 1 order by 2 desc;

-- F~H. 추천 후 저장/공유/동행관심률 (브라우저 기준)
with s as (
  select session_id,
         bool_or(event_name='recommendation_view') as recommended,
         bool_or(event_name='recommendation_save') as saved,
         bool_or(event_name='recommendation_share') as shared,
         bool_or(event_name='companion_interest') as interested
  from public.analytics_events
  where not is_demo and created_at >= now() - interval '30 days'
  group by 1
)
select count(*) filter(where recommended) as recommendation_browsers,
       round(100.0 * count(*) filter(where recommended and saved) / nullif(count(*) filter(where recommended),0),2) as save_rate_pct,
       round(100.0 * count(*) filter(where recommended and shared) / nullif(count(*) filter(where recommended),0),2) as share_rate_pct,
       round(100.0 * count(*) filter(where recommended and interested) / nullif(count(*) filter(where recommended),0),2) as companion_interest_rate_pct
from s;

-- I. companion_interest -> premium_willingness 응답률
with s as (
  select session_id,
         bool_or(event_name='companion_interest') as interested,
         bool_or(event_name='premium_willingness') as answered
  from public.analytics_events
  where not is_demo and created_at >= now() - interval '30 days'
  group by 1
)
select count(*) filter(where interested) as interested_browsers,
       count(*) filter(where interested and answered) as answered_browsers,
       round(100.0 * count(*) filter(where interested and answered) / nullif(count(*) filter(where interested),0),2) as response_rate_pct
from s;

-- J. 지불의향 분포 / 1만원 이상 / 2만원 이상
with latest as (
  select distinct on (session_id) session_id, details->>'willingness' as willingness
  from public.analytics_events
  where event_name='premium_willingness' and not is_demo and created_at >= now() - interval '30 days'
  order by session_id, created_at desc
)
select willingness, count(*) as browsers,
       round(100.0 * count(*) / nullif(sum(count(*)) over (),0),2) as share_pct
from latest group by 1 order by browsers desc;

-- J-2. 유료 의향 핵심 비율
with latest as (
  select distinct on (session_id) session_id, details->>'willingness' as willingness
  from public.analytics_events
  where event_name='premium_willingness' and not is_demo and created_at >= now() - interval '30 days'
  order by session_id, created_at desc
)
select count(*) as responses,
       round(100.0 * count(*) filter(where willingness in ('약 1만원','약 2만원','약 3만원 이상')) / nullif(count(*),0),2) as paid_10k_plus_pct,
       round(100.0 * count(*) filter(where willingness in ('약 2만원','약 3만원 이상')) / nullif(count(*),0),2) as paid_20k_plus_pct
from latest;

-- K. 연령대별 지불의향
select details->>'age' as age, details->>'willingness' as willingness, count(*) as responses
from public.analytics_events
where event_name='premium_willingness' and not is_demo and created_at >= now() - interval '30 days'
group by 1,2 order by 1,3 desc;

-- L. 욕구별 지불의향
select d.desire, e.details->>'willingness' as willingness, count(*) as responses
from public.analytics_events e
cross join lateral jsonb_array_elements_text(coalesce(e.details->'desires','[]'::jsonb)) d(desire)
where e.event_name='premium_willingness' and not e.is_demo and e.created_at >= now() - interval '30 days'
group by 1,2 order by 1,3 desc;

-- M. 활동별 지불의향
select a.activity, e.details->>'willingness' as willingness, count(*) as responses
from public.analytics_events e
cross join lateral jsonb_array_elements_text(coalesce(e.details->'activities','[]'::jsonb)) a(activity)
where e.event_name='premium_willingness' and not e.is_demo and e.created_at >= now() - interval '30 days'
group by 1,2 order by 1,3 desc;

-- N. 동행유형별 지불의향
select c.companion, e.details->>'willingness' as willingness, count(*) as responses
from public.analytics_events e
cross join lateral jsonb_array_elements_text(coalesce(e.details->'companions','[]'::jsonb)) c(companion)
where e.event_name='premium_willingness' and not e.is_demo and e.created_at >= now() - interval '30 days'
group by 1,2 order by 1,3 desc;

-- O. '새로운 사람' 선택자의 지불의향
select details->>'willingness' as willingness, count(*) as responses
from public.analytics_events
where event_name='premium_willingness' and not is_demo
  and created_at >= now() - interval '30 days'
  and coalesce(details->'companions','[]'::jsonb) ? 'new_people'
group by 1 order by 2 desc;

-- P. 활동 + 연령대 조합별 2만원 이상 의향
select e.details->>'age' as age, a.activity,
       count(*) as responses,
       count(*) filter(where e.details->>'willingness' in ('약 2만원','약 3만원 이상')) as paid_20k_plus,
       round(100.0 * count(*) filter(where e.details->>'willingness' in ('약 2만원','약 3만원 이상')) / nullif(count(*),0),2) as paid_20k_plus_pct
from public.analytics_events e
cross join lateral jsonb_array_elements_text(coalesce(e.details->'activities','[]'::jsonb)) a(activity)
where e.event_name='premium_willingness' and not e.is_demo and e.created_at >= now() - interval '30 days'
group by 1,2 order by paid_20k_plus_pct desc, responses desc;

-- Q. 동행 목적별 지불의향
select details->>'purpose' as purpose, details->>'willingness' as willingness, count(*) as responses
from public.analytics_events
where event_name='premium_willingness' and not is_demo and created_at >= now() - interval '30 days'
group by 1,2 order by 1,3 desc;

-- 유료 전환 가능성 높은 세그먼트 TOP 10
-- 초기에는 최소 5응답. 표본이 늘면 HAVING count(*) >= 20 등으로 올리세요.
with expanded as (
  select e.details->>'age' as age,
         a.activity,
         c.companion,
         e.details->>'willingness' as willingness
  from public.analytics_events e
  cross join lateral jsonb_array_elements_text(coalesce(e.details->'activities','[]'::jsonb)) a(activity)
  cross join lateral jsonb_array_elements_text(coalesce(e.details->'companions','[]'::jsonb)) c(companion)
  where e.event_name='premium_willingness' and not e.is_demo and e.created_at >= now() - interval '30 days'
)
select age, activity, companion,
       count(*) as responses,
       count(*) filter(where willingness in ('약 2만원','약 3만원 이상')) as paid_20k_plus,
       round(100.0 * count(*) filter(where willingness in ('약 2만원','약 3만원 이상')) / count(*),2) as paid_20k_plus_pct
from expanded
group by 1,2,3
having count(*) >= 5
order by paid_20k_plus_pct desc, responses desc
limit 10;

-- 기존 장소 퍼널 참고: 상세 조회 기준 저장/공유/동행 관심
with per_place_browser as (
  select session_id, place_id,
    bool_or(event_name='place_view') as viewed,
    bool_or(event_name in ('save_place','recommendation_save')) as saved,
    bool_or(event_name in ('share_place','recommendation_share')) as shared,
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

-- 운영 확인: 이벤트 수집 여부 (DEMO 포함)
-- select event_name,is_demo,count(*) from public.analytics_events group by 1,2 order by 1;
-- 보관 기간 90일을 지난 이벤트 삭제
-- delete from public.analytics_events where created_at < now() - interval '90 days';
