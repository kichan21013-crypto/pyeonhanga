-- 나가치 취향 동행 · 동의한 설문 응답만으로 무료 사업성 검증 (2026-11-24)
-- Supabase SQL Editor 운영자 전용. 공개 API 조회 금지.
-- 실제 모집/결제/고객 수가 아니라 응답자 브라우저가 제출한 관심 및 지불 의향입니다.
-- 설문 제출 전 활동 클릭과 방문은 개인정보 최소 수집을 위해 서버에 저장하지 않습니다.
-- therefore click→survey 전환율은 계산할 수 없으며, '관심 클릭률' 등으로 표현하지 않습니다.

with responses as (
 select created_at,place_id,region,category,session_id,details
 from public.analytics_events
 where not is_demo
   and event_name='premium_willingness'
   and created_at >= now() - interval '30 days'
   and place_id not like 'program-%'
), classified as (
 select *,
 case details->'activities'->>0
   when 'food' then '맛있는 음식'
   when 'hike' then '산행'
   when 'outing' then '산책·카페'
   when 'travel' then '근교 나들이'
   else '기타/미지정'
 end as interest
 from responses
)
select interest,
 count(distinct session_id) as responding_browsers,
 count(distinct details->>'response_id') as saved_surveys,
 count(distinct details->>'response_id') filter(
   where details->>'willingness' in ('약 1만원','약 2만원','약 3만원 이상')
 ) as positive_service_fee_intent,
 round(100.0 * count(distinct details->>'response_id') filter(
   where details->>'willingness' in ('약 1만원','약 2만원','약 3만원 이상')
 ) / nullif(count(distinct details->>'response_id'),0), 1) as positive_intent_pct
from classified
group by interest
order by saved_surveys desc;

-- 서비스비 의향 분포
select details->>'willingness' as proposed_service_fee,
 count(distinct details->>'response_id') as saved_surveys
from public.analytics_events
where not is_demo
  and event_name='premium_willingness'
  and created_at >= now()-interval '30 days'
group by 1 order by saved_surveys desc;

-- 선호 장소 (확정 참가자/모임이 아니라 동의 후 희망 의사를 표현한 장소)
select region,place_id,
 count(distinct details->>'response_id') as saved_surveys
from public.analytics_events
where not is_demo
  and event_name='premium_willingness'
  and place_id not like 'program-%'
  and created_at >= now()-interval '30 days'
group by region,place_id
order by saved_surveys desc
limit 50;

-- 실제 데이터 보존 및 Supabase Free 비활성 상태는 운영자가 별도 확인해야 합니다.
-- 공개 데모 데이터와 실제 응답을 혼합하지 마세요.
