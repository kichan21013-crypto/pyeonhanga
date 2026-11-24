-- 나가치 50+ 파티 프로그램 시장성 검증 (운영자 전용 Supabase SQL Editor)
-- 프로그램 ID를 현행 analytics_events.place_id에 program-* 접두어로 임시 기록합니다.
-- 현재 수요 조사만 제공합니다. 결제 또는 모집 확정, 활성 파티를 의미하지 않습니다.
-- Supabase 분석 설정이 실제 연결된 경우에만 데이터가 집계됩니다.
-- 90일 원천 데이터 보관 시 월별 지표를 별도 보존해야 합니다.

with recent as (
 select * from public.analytics_events
 where created_at >= now()-interval '30 days'
   and is_demo=false
   and place_id in ('program-food','program-hike','program-outing','program-travel')
),
interests as (
 select place_id, count(distinct session_id) as interested_sessions,
        count(*) as interest_clicks
 from recent where event_name='companion_interest'
 group by place_id
),
responses as (
 select place_id,
    count(distinct details->>'response_id') as completed_responses,
    count(distinct session_id) as responding_sessions,
    count(*) filter(where details->>'willingness' in ('약 1만원','약 2만원','약 3만원 이상')) as paid_intent_responses
 from recent where event_name='premium_willingness'
 group by place_id
)
select
 case coalesce(i.place_id,r.place_id)
 when 'program-food' then '미식 파티'
 when 'program-hike' then '산행 파티'
 when 'program-outing' then '나들이 파티'
 when 'program-travel' then '당일여행 파티' end as programme,
 coalesce(i.interest_clicks,0) as interest_clicks,
 coalesce(i.interested_sessions,0) as interested_sessions,
 coalesce(r.completed_responses,0) as completed_responses,
 coalesce(r.paid_intent_responses,0) as paid_intent_responses,
 round(100.0*coalesce(r.responding_sessions,0)/nullif(i.interested_sessions,0),1) as interest_to_survey_pct,
 round(100.0*coalesce(r.paid_intent_responses,0)/nullif(r.completed_responses,0),1) as paid_intent_pct
from interests i full join responses r using (place_id)
order by paid_intent_responses desc, completed_responses desc;

-- 보조: 각 프로그램의 희망 인원 구성/서비스비 의향.
select
  place_id as programme_id,
  details->>'group_size' as preferred_group_size,
  details->>'willingness' as service_fee_willingness,
  count(distinct details->>'response_id') as responses
from public.analytics_events
where event_name='premium_willingness'
  and not is_demo
  and place_id like 'program-%'
  and created_at >= now()-interval '30 days'
group by 1,2,3
order by responses desc;

-- 주의: 본 데이터는 서비스 관심과 지불 의향이며, 실제 유료 예약이나 매출이 아닙니다.
-- 성향·집합장소·실제 파티원 검증은 별도의 동의 기반 서비스 설계 후 수집하세요.
