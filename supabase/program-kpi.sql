-- 나가치 취향 동행 수요 검증 · 2026-11-24
-- Supabase 운영자 전용 SQL Editor에서 조회합니다. 정적 앱/익명 사용자는 원천 데이터 직접 조회 불가.
-- 수집은 분석 설정이 실제로 동작하고 참가자가 명시적 동의를 한 경우에만 발생합니다.
-- 자유입력, 연락처, 혼인상태, 건강/성생활 데이터는 받지 않습니다.
-- 이벤트 범위: 하고 싶은 일 선택(activity_selected) → 실제 장소에서 관심(companion_interest)
-- → 동의 후 설문 완료(premium_willingness). 의향이지 결제/참가확정이 아닙니다.

with recent as (
 select event_name,session_id,place_id,details
 from public.analytics_events
 where not is_demo and created_at >= now() - interval '30 days'
   and event_name in ('activity_selected','companion_interest','premium_willingness')
), classified as (
 select event_name,session_id,place_id,details,
 case details->'activities'->>0
   when 'food' then '맛있는 음식'
   when 'hike' then '산행'
   when 'outing' then '산책·카페'
   when 'travel' then '근교 나들이'
   else null
 end as invitation
 from recent
), grouped as (
 select invitation,
   count(distinct session_id) filter(where event_name='activity_selected') as invitation_sessions,
   count(distinct session_id) filter(where event_name='companion_interest') as venue_interest_sessions,
   count(distinct session_id) filter(where event_name='premium_willingness') as survey_sessions,
   count(distinct details->>'response_id') filter(where event_name='premium_willingness') as completed_surveys,
   count(distinct details->>'response_id') filter(where event_name='premium_willingness'
     and details->>'willingness' in ('약 1만원','약 2만원','약 3만원 이상')) as paid_intent_surveys
 from classified where invitation is not null
 group by invitation
)
select invitation,invitation_sessions,venue_interest_sessions,survey_sessions,completed_surveys,
 paid_intent_surveys,
 round(100.0 * survey_sessions/nullif(invitation_sessions,0),1) as invite_to_survey_pct,
 round(100.0 * paid_intent_surveys/nullif(completed_surveys,0),1) as paid_intent_pct
from grouped order by completed_surveys desc;

-- 장소별 선호: 사용자 직접 선택한 검증된 실제 장소 ID에서만 집계
select region,place_id,
 count(distinct session_id) filter(where event_name='companion_interest') as interested_sessions,
 count(distinct details->>'response_id') filter(where event_name='premium_willingness') as completed_surveys
from public.analytics_events
where not is_demo
  and event_name in ('companion_interest','premium_willingness')
  and place_id not like 'program-%'
  and created_at >= now() - interval '30 days'
group by region,place_id
order by completed_surveys desc,interested_sessions desc
limit 50;

-- 무료 프로젝트에서는 활동 적음으로 일시정지될 수 있습니다.
-- 데이터 보관/복구는 Supabase Free 기능과 프로젝트 운영 상태에 따릅니다.
-- 원천 이벤트는 운영 기준 90일이지만, 별도 자동 삭제나 자동 백업 실행 여부는 직접 확인해야 합니다.
