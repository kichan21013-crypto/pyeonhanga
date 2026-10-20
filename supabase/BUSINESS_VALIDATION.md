# 나가치 사업검증 Analytics

이 단계의 목적은 **어떤 하루/활동/동행 조합이 실제 유료 의향으로 이어지는지** 확인하는 것입니다.

## 수집 원칙

수집: 익명 session ID, 욕구/활동/동행 선택, 시간, 이동, 편안함 선호, 추천 활동, 장소 ID, 설문 연령대/목적/지불의향.

수집하지 않음: 이름, 전화번호, 이메일, 정확한 위치, 건강정보, IP 별도 필드, 광고 ID, **자유입력 자연어 원문**.

DEMO SAMPLE은 `is_demo=true`로 저장하며 사업 KPI에서 제외합니다. 보관 기준은 90일입니다.

## 기존 Supabase에 적용

운영 적용 전 PR을 검토한 뒤 Supabase SQL Editor에서 아래 파일 **하나만** 전체 실행합니다.

`supabase/migrations/20261020_business_validation_analytics.sql`

기존 이벤트 데이터는 삭제하지 않습니다. 이벤트 허용 목록과 `record_event` 검증 함수만 확장합니다.

새 프로젝트를 처음 만드는 경우에는 최신 `supabase/schema.sql` 전체를 실행합니다.

## 핵심 이벤트

- `rhythm_start`: 오늘의 리듬 찾기 시작
- `desire_selected`: 원하는 하루 선택
- `activity_selected`: 세부 활동 선택
- `companion_selected`: 동행 선택
- `condition_selected`: 시간/이동/편안함 선택
- `recommendation_view`: 최종 추천 확인
- `recommendation_save`: 추천 장소 저장
- `recommendation_share`: 추천 장소 공유
- `companion_interest`: 같이 할 사람에 관심
- `premium_willingness`: 동행 구성 서비스비 지불의향 응답

현재 저장 대상은 하루 plan 전체가 아니라 `place_id`이므로 저장/공유 이벤트 이름을 `recommendation_*`로 명확히 구분합니다.

## 사업 판단

`supabase/analytics_queries.sql`에서 최근 30일 기준 다음을 봅니다.

- 시작 → 추천 완료율
- 욕구/활동/동행별 선택자 수
- 추천 후 저장/공유/동행관심률
- 동행관심 → 지불의향 응답률
- 1만원 이상 / 2만원 이상 지불의향 비율
- 연령대, 욕구, 활동, 동행유형별 지불의향
- 최소 5응답 이상 세그먼트 중 2만원 이상 의향 TOP 10

**지불의향은 결제가 아닙니다.** 최종 Go/No-Go는 실제 유료 파일럿에서 결제가 발생하는지로 판단합니다.
