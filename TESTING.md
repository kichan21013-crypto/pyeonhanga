# 나가치 검증 기록 — 2026-10-20

현재 기준: GitHub main `82e6546c06b737ebe1259da2406346751b1362a2`, Node.js v24.19.0. 추가 npm 의존성 없음.

## 실행한 자동 검사

- `npm run build`: 성공. 장소 상세 6개를 포함한 HTML 11개 생성. 전 페이지 `noindex,nofollow`, X-Robots-Tag, 빈 사이트맵 확인.
- `npm test`: **39개 통과**. 기존 점수·신뢰도·데이터·TourAPI 변환/라이선스 보존·추천·분석 검사 28개와 신규 11개.
- 신규: 동행 다중선택 OR/일치 수 정렬, 욕구/활동 OR, 자연어+칩 복합 조건, 입력 거리를 실제 코스로 사용하지 않음, 근거 있는 시간/이동 선호, 장소 1개만 참조하는 추천 구조, 러닝 코스 출처 검증, 브랜드/noindex, 논리 이벤트의 기존 스키마 호환/DEMO 분리.
- 저장 회귀: 기존 localStorage 키·장소 ID 유지, 저장/해제, 저장공간 차단.
- 공유 회귀: Web Share 성공/취소, 클립보드 복사, API 실패 및 수동 복사 fallback.
- 동행 회귀: 연령·희망 동행·목적·인원·지불의향 선택 유지. 모의 RPC의 설문 응답·익명 식별·네트워크 실패 반환 검사. 실제 Supabase 저장 검증은 아님.
- JS 구문 검사와 생성 HTML 파서 검사: 문서 언어, 중복 ID, label/ARIA 참조, 외부 form 연결, main, noindex 확인.

## 브라우저 검사는 실행 차단됨

이번 작업에서도 `npm start`는 `listen EPERM`, 설치된 `/usr/bin/chromium` 실행은 `setsockopt: Operation not permitted`로 차단됐습니다. 기본 Playwright 브라우저 실행 파일도 설치돼 있지 않아 시스템 Chromium을 지정해 재시도했습니다. 이 환경에서 실제 레이아웃·클릭·브라우저 콘솔을 검증 완료했다고 주장하지 않습니다.

`tests/browser-smoke.mjs`에는 다음 실행 가능한 검사를 준비했습니다.

- 360 / 390 / 402 / 800 / 1280px, 기본 글씨와 200%(36px)에서 가로 넘침 검사
- 동행 다중선택·요약, 욕구 다중선택·세부 활동 펼침, 러닝 하위 활동
- 자연어 입력 유지·복합 검색·허위 거리 미표시·unknown 선호 결과 유지
- 저장 → 저장 목록 → 상세, Web Share mock와 수동 복사
- 동행 설문, 키보드 Escape·초점 복귀, 미연결 시 미저장 안내
- 모의 Supabase 연결에서 논리 이벤트 10종·DEMO 지불의향, 서버 오류 시 재시도

일반 개발 환경에서:

1. `npm run build`, 별도 터미널에서 `npm start`.
2. Playwright가 이미 import 가능한 환경에서 `node tests/browser-smoke.mjs` 실행.
3. 필요하면 경로를 지정합니다:

```sh
PLAYWRIGHT_MODULE=/설치경로/playwright-core/index.mjs CHROMIUM_PATH=/브라우저경로/chromium node tests/browser-smoke.mjs
```

이 도구는 배포 의존성이 아닙니다. 실제 iPhone/Galaxy Tab의 터치·글씨 확대 확인은 별도로 필요합니다.

## 유지한 운영 경계

- wrangler.jsonc, GitHub Actions, Worker 이름·URL, Supabase 설정/스키마/KPI SQL은 변경하지 않음.
- 새 이벤트명은 현재 서버 스키마가 허용하지 않으므로 기존 이벤트로 호환 기록. 상세 분리 분석에 필요한 후속 스키마 작업은 README에 명시.
- 실제 Supabase/TourAPI 호출 없음. 실제 장소·후기·편안함·거리·이동시간 생성 없음.
- 새 PR 검토까지만 진행. main 병합 및 운영 배포 없음.

## PR #2 후속: 나가치 외부 브랜드 정리

- 외부 브랜드만 나가치로 변경하고 “오늘, 내 리듬대로.”, “오늘 내 리듬 찾기”, “오늘의 리듬”은 유지합니다. about에서는 내리듬을 개인화 추천 개념으로 설명합니다.
- 위치·거리 계산이 없는 “가까운 곳” 버튼은 제거하고 차로/대중교통/상관없음만 노출합니다. 거리·코스 확장 모델은 그대로입니다.
- 저장 대상이 place ID임에 맞춰 “저장한 곳”으로 통일합니다. 저장 키와 ID는 바꾸지 않습니다.
- README/analytics TODO에 실제 공개 테스트 전 구조화 컨텍스트 분석 확장을 명시합니다. 자유입력 원문은 계속 전송하지 않으며 운영 스키마 변경은 없습니다.
- `npm run build` 성공, `npm test` 39/39 통과. 브랜드·저장 명칭·이동 옵션·noindex 회귀 검사를 포함합니다. 브라우저 실행 제한은 위 기록과 같습니다.

## 한 단계씩 여는 추천 UX

- `npm run build`: 성공. 기존 Workers 이름·URL·wrangler/Actions, Supabase 설정·스키마, DEMO 데이터, noindex는 유지합니다. 빌드에 새 화면 진행 모듈 flow.js만 추가합니다.
- `npm test`: **46/46 통과**. 기존 39개를 유지하며 의도적으로 바뀐 질문 순서 기대값만 수정했습니다.
- 새 진행 검사 7개: CTA 뒤 1단계만 표시, 욕구 선택 뒤 2단계 열림, 동행 뒤 3단계 열림, 마지막 CTA 전후 결과 숨김/표시, 다중선택·세부활동 유지, 수정·초기화 전제조건, 자연어 대체 입력, reduced-motion 즉시 표시. 실제 UI와 같은 flow.js 컨트롤러를 최소 요소 어댑터에서 검사합니다. 생성 HTML의 숨김·진행 표시·자체 Hero SVG도 확인합니다.
- JS 구문 및 생성 HTML 11개의 중복 ID/label/ARIA/form 참조 검사 통과.
- `npm start`와 시스템 Chromium을 재실행했으나 각각 listen EPERM 및 setsockopt: Operation not permitted로 차단됐습니다. 실제 모바일 레이아웃/클릭/콘솔 검증은 미완료입니다.
- 브라우저 smoke test는 새 단계 순서·다중선택·Enter 결과 방지·이전 질문 접기·선택 요약·최종 결과·수정/초기화·의미색 유지·reduced-motion 검사로 갱신했습니다. Hero/조건/결과 각 상태에서 360/390/402/800/1280px와 200% 글씨 넘침을 검사하도록 준비했습니다. 기존 저장·공유·설문·분석 모의 회귀도 유지합니다. 이 환경에서 통과했다고 주장하지 않습니다.
- 새 PR만 생성하며 운영 배포는 수행하지 않습니다.
