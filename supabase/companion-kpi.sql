-- 나가치 동행 수요 검증용 KPI
-- Supabase SQL Editor에서 운영자 권한으로 실행하세요 (홈페이지에 공개하지 않음).
-- 설문 데이터 수집은 public config + record_event 함수가 실제로 작동할 때만 가능합니다.
-- is_demo=false 만 사업 검증에 포함하며 클릭과 완성 응답을 분리합니다.
-- 아래 집계는 저장된 최근 90일 원천 데이터 범위 내에서 유효합니다.

-- 1) 최근 30일 수요 전환 퍼널: 관심 열람 / 고유 설문 완료 / 지불 의향
with period as (
 select * from public.analytics_events
 where created_at >= now() - interval '30 days' and is_demo = false
),
visitors as (
 select count(distinct session_id) as interested_sessions
 from period where event_name = 'companion_interest'
),
responses as (
 select count(distinct details->>'response_id') as completed_responses,
        count(distinct session_id) as completed_sessions,
        count(*) filter(where details->>'willingness' in ('약 1만원','약 2만원','약 3만원 이상')) as paid_interest_responses
 from period where event_name = 'premium_willingness'
)
select visitors.interested_sessions, responses.completed_sessions, responses.completed_responses,
       responses.paid_interest_responses,
       round(100.0*responses.completed_sessions/nullif(visitors.interested_sessions,0),1) as submit_rate_pct,
       round(100.0*responses.paid_interest_responses/nullif(responses.completed_responses,0),1) as paid_intent_pct
from visitors cross join responses;

-- 2) 월별 누적: 수요/유료 의향 변화 (실제 구매 전환 아님)
select date_trunc('month',created_at)::date as month,
       count(distinct session_id) as responding_sessions,
       count(distinct details->>'response_id') as completed_responses,
       count(*) filter(where details->>'willingness' in ('약 1만원','약 2만원','약 3만원 이상')) as paid_interest_responses
from public.analytics_events
where event_name='premium_willingness' and not is_demo
group by 1 order by 1 desc;

-- 3) 희망 동행 유형, 목적, 서비스비 선택 분포
select details->>'purpose' as purpose, details->>'willingness' as service_fee_intent,
       count(distinct details->>'response_id') as responses
from public.analytics_events
where event_name='premium_willingness'
  and not is_demo
  and created_at >= now() - interval '90 days'
group by 1,2 order by responses desc;

-- 4) 지역·장소별 실제 관심: 동행 미모집 장소를 '동행 가능'으로 오인하지 않습니다.
select region, place_id,
       count(*) filter(where event_name='companion_interest') as interest_clicks,
       count(distinct details->>'response_id') filter(where event_name='premium_willingness') as completed_responses
from public.analytics_events
where not is_demo
  and event_name in ('companion_interest','premium_willingness')
  and created_at >= now() - interval '30 days'
group by 1,2
order by completed_responses desc, interest_clicks desc
limit 50;

-- 운영 판단: 90일 보관으로 원천 데이터가 삭제되기 전에 월별 집계 결과를
-- 관리자 전용 보고서로 따로 보존하세요. 외부 공개 시 소수 응답 그룹을 개별 공개하지 마세요.
-- 동행 사업의 전환율/지불 가능성은 수요 '의향'이므로, 실제 결제/예약으로 간주하면 안 됩니다.
