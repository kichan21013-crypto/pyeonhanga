# 나가치

**나가치**는 나에게 맞는 하루를 찾는 서비스입니다. **내리듬**은 개인화 추천 개념이며 회사·앱 이름이 아닙니다.

“오늘, 내 리듬대로.” 막연히 뭔가 하고 싶은 날 **내 상황과 취향에 맞는 오늘 하루**를 찾는 모바일 웹 MVP입니다. 먹고, 걷고, 달리고, 쉬고, 떠나는 방법을 선택하고 저장·공유하거나 동행 의견을 남깁니다. 목적은 **투자비 0원**으로 시장 반응을 확인하는 것입니다. 로그인·실제 결제·사람 연결은 없습니다.

현재 장소 6개는 모두 **DEMO SAMPLE 가상 데이터**입니다. 실제 방문 정보나 편안함 수치를 꾸며 넣지 않았습니다. 실제 시장 검증을 시작하려면 검증한 실제 장소를 추가하고 무료 분석을 연결해야 합니다. 데모는 실제 KPI에서 제외됩니다. 현재 내부 검증 단계이므로 실제 장소를 포함한 모든 페이지도 검색엔진 색인에서 제외됩니다.

## 1. 내 컴퓨터에서 실행

1. 무료 Node.js **22 이상**을 설치합니다.
2. 터미널에서 이 README가 있는 `pyeonhanga` 폴더를 엽니다.
3. `npm run build`를 실행합니다.
4. `npm start`를 실행합니다.
5. 브라우저에서 **http://localhost:4173** 을 엽니다. 종료는 터미널에서 Ctrl+C입니다.

`npm install`은 필요 없습니다. 사용한 외부 npm 패키지는 0개입니다. HTML 파일을 직접 더블클릭하지 마세요. 변경 후 `npm run build`하고 브라우저를 새로고침합니다. `dist`가 실제 배포 폴더입니다. `npm start`는 로컬 확인용이며 외부 운영 서버가 아닙니다.

## 2. 현재 배포 구조와 무료 Pages 대안

현재 저장소는 **Cloudflare Workers 정적 에셋 배포**를 사용합니다. `wrangler.jsonc`의 프로젝트명·URL·`./dist` 설정과 GitHub Actions는 유지합니다. 이번 개편은 새 PR에서만 검토하며 운영 배포하지 않습니다. 아래 Pages 설명은 별도 대안 안내입니다. 현재 프로젝트의 배포 방식을 전환할 필요는 없습니다.

1. Cloudflare 무료 계정을 만들고 **Workers & Pages → Create → Pages**에서 Git 저장소를 연결합니다. Workers 유료 플랜을 선택하지 않습니다.
2. 이 폴더가 저장소 전체이면 Root directory를 비워 둡니다. 저장소 안의 `pyeonhanga` 폴더라면 Root directory를 `pyeonhanga`로 지정합니다.
3. Framework preset: **None**, Build command: **`npm run build`**, Build output directory: **`dist`**.
4. 환경변수 `NODE_VERSION`은 `22` 이상으로 설정합니다. 배포합니다.
5. 발급된 무료 `https://이름.pages.dev` 주소를 복사하고 환경변수 **`SITE_URL`**에 입력한 다음 다시 배포합니다. 마지막 `/`는 없어도 됩니다. 사용자 정의 유료 도메인은 필요 없습니다. SITE_URL이 없으면 Cloudflare의 CF_PAGES_URL을 사용하고 로컬은 localhost를 사용합니다.
6. 홈, 상세 URL, 저장, 공유, 360px 화면을 확인합니다. 실제 데이터 추가 후 `/robots.txt`, `/sitemap.xml`, 상세 페이지의 canonical 주소도 확인합니다.

Git 연결 없이 배포하려면 로컬에서 SITE_URL을 설정하여 빌드한 **dist 폴더**를 Pages의 직접 업로드 기능에 올릴 수 있습니다. 프로젝트의 키·계정은 제공되지 않아 현재 실제 Cloudflare 배포는 수행하지 않았습니다.

무료 한도를 넘으면 지출을 허용하지 말고 수집/배포를 중지하거나 줄이세요. 이 코드에는 유료 API, 결제, 자동 유료 전환이 없습니다.

## 3. Supabase Free 연결 (분석이 필요할 때만)

1. Supabase에서 **Free** 프로젝트를 만듭니다. 유료 플랜을 선택하지 않습니다.
2. 왼쪽 **SQL Editor → New query**를 열고 `supabase/schema.sql` 전체 내용을 붙여 넣어 **Run**합니다. 이벤트 표와 입력 전용 함수가 만들어집니다. 다시 실행해도 됩니다.
3. 프로젝트의 **Connect / Project Settings → API**에서 Project URL과 **anon key 또는 publishable key**를 확인합니다. `service_role`, `sb_secret_` 키는 절대 사용하지 않습니다.
4. 다음 두 방식 중 하나만 사용합니다.
   - 로컬: `config.example.js`를 복사해 **`config.js`**를 만들고 `supabaseUrl`, `supabaseAnonKey`를 입력합니다. 이 파일은 Git에서 제외됩니다.
   - Cloudflare: 환경변수 **`SUPABASE_URL`**, **`SUPABASE_ANON_KEY`**를 모두 추가합니다. 빌드 시 공개 가능한 설정 파일로 만들어집니다. SITE_URL도 함께 설정합니다. TourAPI 키는 이 파일에 넣지 않습니다.
5. `npm run build` / Cloudflare 재배포합니다. 브라우저에서 데모 장소 상세 조회, 저장, 공유, 설문 제출을 해봅니다.
6. SQL Editor에서 `select event_name, is_demo, count(*) from public.analytics_events group by 1,2;`를 실행해 확인합니다. 데모 응답은 `is_demo=true`입니다.
7. 공개 키로 표에 대한 조회·수정·삭제·직접 입력이 거부되는지 확인합니다. 입력은 `record_event` 함수만 허용합니다. 원문 KPI는 운영자의 SQL Editor에서만 조회합니다. 실제 Supabase 계정이 없어 원격 연결/RLS 실행 검증은 아직 하지 않았습니다.
8. 개인정보 안내의 운영자/연락 창구를 배포 전에 보완하고 **90일 보관 정리**를 운영합니다. 매주 아래 SQL을 실행하거나 schema.sql 끝의 무료 pg_cron 예시를 설정하세요: `delete from public.analytics_events where created_at < now() - interval '90 days';`

설정이 비어 있으면 네트워크 분석 요청 자체를 하지 않습니다. 설문 응답도 보관하지 않고 화면에 체험 모드를 표시합니다. 설정되어 있지만 전송에 실패한 설문은 성공으로 표시하지 않고 다시 제출할 수 있게 합니다. 분석 실패가 장소 탐색·저장·공유를 막지 않습니다.

검색어 원문·전체 URL·위치정보·자유 텍스트·이름·연락처를 이벤트로 수집하지 않습니다. 임의의 브라우저 식별값은 사람 수와 같지 않습니다. 공개 입력 API이므로 자동 입력/조작 가능성은 남습니다. 클라이언트의 수집 숫자를 결제 증거나 검증된 고객 수로 해석하지 마세요. 세션별 하루 1,000 이벤트 제한은 보조 장치입니다.

## 4. 실제 장소 추가·수정

`data/places.json`에서 객체 하나가 장소 하나입니다. 예시를 복사하되 실제 정보와 확인한 출처로 바꿉니다. 저장 후 다시 빌드하면 홈과 고유 상세 URL이 함께 생성됩니다. HTML을 직접 수정할 필요가 없습니다.

| 항목 | 입력 방법 |
| --- | --- |
| id / slug | 중복 없는 영문 소문자·숫자·하이픈. 예: `verified-garden-01`. 배포 후에는 주소와 저장 목록 유지를 위해 바꾸지 않기 |
| name / category / region / address | 실제 이름·주소. category는 맛집/나들이/여행, region은 서울/경기/강릉/경주/부산/제주 |
| latitude / longitude | 확인한 숫자 좌표, 모르면 `null` |
| shortDescription / priceRange | 확인된 짧은 소개와 가격. 가격을 모르면 `확인 전` |
| image / imageAlt | 사용할 권리가 있는 사진의 URL 또는 `/assets/파일명`, 사진 설명. 일러스트는 대체 이미지임을 명시 |
| sourceName / sourceUrl / lastVerifiedAt | 출처 이름, 공개 HTTPS URL, 실제 확인한 날짜 `YYYY-MM-DD` |
| isDemo | 가상은 `true`, 검증된 실제 장소만 `false` |
| companions | 확인한 동행 적합성: `solo`, `couple`, `friend`, `family`, `new_people`. 모르면 `[]`. 선택한 동행에 맞는 태그를 가진 장소를 먼저 추천하며 미확인 장소도 남겨 둡니다. 이전 한글 태그도 호환합니다. |
| intentTags | 활동 태그 배열: `walk`, `drive`, `noodle`, `korean_food`, `cafe`, `sea`, `quiet`, `scenery`, `conversation`, `low_walking` 등. 근거 없이 편안함 태그를 채우지 않기 |
| sourceLicense / imageLicense | 각각 `name`, `url`, `attribution`, `copyrightCode`, `usageNotes`. 모르면 `null`. 장소 정보와 이미지의 이용 권한은 별도로 확인 |
| userRating | 이번에는 `null`. 알고리즘 점수를 여기에 넣지 않기 |

편안함은 `comfort` 안의 `parking`, `stairs`, `accessibility`, `restroom`, `seating`, `walking`, `noise`, `waiting`입니다. 각 항목 형태:

```json
{ "value": "unknown", "note": "확인 전", "sourceUrl": null, "verifiedAt": null }
```

실제 확인한 경우에만 `value`를 `good`(편함), `moderate`(보통), `poor`(부담 있음)로 바꾸고 `note`에 판단 근거, `sourceUrl`에 출처, `verifiedAt`에 확인 날짜를 넣습니다. 단순 추측으로 값을 채우지 마세요. 근거가 빠지면 빌드가 중지됩니다. 소음·대기는 시간에 따라 다르므로 확인 조건도 note에 남기세요. 객관적으로 판단할 수 없으면 계속 unknown입니다.

## 5. 나중에 무료 TourAPI 가져오기

1. 한국관광공사 TourAPI/공공데이터포털에서 **무료 한국관광정보 서비스** 사용 승인을 받고 키를 발급받습니다.
2. 키를 터미널 환경변수 **`TOUR_API_KEY`**에만 설정합니다. 클라이언트 설정·Git·화면에 넣지 않습니다.
3. `npm run import:tourapi`를 실행합니다. 키가 없으면 건너뛰며 정상 종료합니다.
4. 서울/경기/강릉/경주/부산/제주의 음식점(39), 관광지(12), 여행코스(25)를 가져옵니다. 기본은 지역·유형별 최대 **2페이지 × 50개**이며 더 필요하면 `TOUR_API_MAX_PAGES`를 1~100으로 설정합니다. 초기에는 실제 검토할 수 있는 소량을 권장합니다. 호출 한도와 API 버전은 발급 화면에서 확인합니다.
5. 결과 JSON에서 실제 주소, 이미지 이용 조건, 지역 분류와 운영 여부를 검토합니다. TourAPI 목록을 받은 날짜는 기본 장소 정보 확인일이며 편안함 확인일이 아닙니다.
6. `npm run build`로 반영하고 배포합니다. 한 번이라도 실제 데이터를 받으면 가상 데이터는 자동 제거합니다. 가져오기 중 오류가 나면 기존 JSON은 유지됩니다. 다시 가져와도 수동 확인한 편안함·가격·동행 태그는 보존합니다.

출처와 원본 contentId, API 작업명, 원본 수정 시각을 보존합니다. API에 없는 편안함, 가격, 동행 적합성은 만들어 넣지 않습니다. 실제 API 키가 없어 원격 호출은 검증하지 않았습니다. API 항목명/버전이 바뀌면 `scripts/import-tourapi.js`의 endpoint와 변환 함수를 조정하세요.

## 6. 편안함 점수 수정

`comfort-score.js`의 **WEIGHTS**가 수정 위치입니다. 기본 가중치와 50대/60대/70대+ 프로필이 분리되어 있습니다. 현재 UI는 기본 프로필 하나를 사용해 단순하게 유지합니다.

확인된 항목만 가중 평균하고, 확인된 가중치 비중 **40% 미만이면 숫자를 표시하지 않습니다**. 40~59%는 신뢰도 낮음, 60~79%는 보통, 80% 이상은 높음입니다. 예를 들어 확인된 정보가 전부 좋더라도 일부 정보밖에 없으면 신뢰도는 낮게 표시됩니다. 실제 이용자 평점은 별개이며 가짜 별점이나 리뷰는 없습니다. 가중치 수정 시 `scripts/build.js`의 점수 안내 문구도 일치시킵니다.

## 7. 시장 반응 KPI 확인

Supabase SQL Editor에서 **`supabase/analytics_queries.sql`**의 필요한 문단만 선택해서 Run합니다.

- 일별 방문/익명 브라우저 수, 장소 상세 조회수
- 상세를 본 브라우저-장소 쌍 중 저장률·공유율·동행 관심 클릭률 (최근 30일)
- 브라우저별 마지막 응답을 기준으로 한 Premium 지불의향 분포
- 인기 지역·카테고리·장소

데모는 기본 제외됩니다. 가상 장소만 있을 때 실제 KPI가 비어 있는 것이 정상입니다. 방문 대비 유료 의향까지의 흐름과 기간별 변화를 비교하고, 수치만으로 실제 구매를 단정하지 마세요. 실제 결제나 사용자 연결은 하지 않습니다.

## 8. 구조와 검증

- `index.html`, `saved.html`, `styles.css`, `app.js`: 화면과 동작
- `ui.js`, `flow.js`, `rhythm.js`, `search.js`, `comfort-score.js`, `actions.js`, `storage.js`, `analytics.js`: 출력·필터·점수·저장·분석 분리
- `data/places.json`, `assets/`: 장소와 직접 제작한 무료 SVG 일러스트
- `scripts/build.js`: 정적 상세 HTML·고유 SEO 정보·사이트맵·robots·보안 헤더 생성
- `scripts/import-tourapi.js`: 선택적 무료 데이터 가져오기
- `supabase/`: 분석 저장 구조/RLS와 KPI 조회 SQL
- `tests/`: Node 자동 테스트와 선택적 브라우저 smoke test
- `dist/places/각-slug/index.html`: 생성한 상세 페이지. **dist를 직접 편집하지 않습니다.**

기본 검사: `npm run build` → `npm test`. 브라우저 smoke test는 Playwright가 이미 설치된 개발 환경에서 `PLAYWRIGHT_MODULE`에 해당 패키지의 import 가능한 경로를 지정하고 `node tests/browser-smoke.mjs`로 실행합니다. 기본 사용자에게 설치할 추가 의존성은 없습니다. 자세한 실행 결과는 `TESTING.md`를 참조하세요.

## 이번에 제공하지 않는 것

실제 결제, Premium 운영, 회원가입, 채팅, 사람 연결/매칭, 식당·숙박·여행 예약, 여행상품 판매, SMS, 푸시, CMS, 러닝 기록/GPS/운동 분석, 광고·제휴입니다. 러닝·걷기·등산은 원하는 하루를 고르는 하위 활동으로만 제공합니다. 계정/키가 필요한 Cloudflare 실제 배포, Supabase 원격 연결, TourAPI 원격 수집은 운영자 설정 후 확인해야 합니다.

향후 검토만 할 항목: 실제 편안함 현장 검증, 별도 이용자 평가 데이터, 동행 멤버 구성 서비스 실험. 현재 MVP에는 추가 구현하지 않습니다. 장기 Premium 원칙은 `AGENTS.md`에 기록했습니다.

## 나가치의 내리듬 추천 흐름과 데이터 (2026-10-20)

1. **어떤 하루**: “오늘 내 리듬 찾기”를 누르면 이 질문만 먼저 열립니다. 여섯 욕구를 여러 개 선택하고, 고른 욕구의 세부 활동만 펼칩니다. 자연어 입력과 칩을 함께 반영합니다. 하나 이상 선택하거나 문장을 입력하면 다음 질문이 나타납니다.
2. **누구와**: 여러 동행을 함께 선택하고 작은 “내 선택” 요약을 확인합니다. 동행을 고르면 조건 질문이 열립니다.
3. **오늘의 조건**: 시간과 이동(차·대중교통·상관없음)을 고르고 “나에게 중요한 조건 더하기”를 펼쳐 편안함 선호를 고릅니다. 지역·기존 카테고리는 보조 필터로 남아 있습니다.
4. **오늘의 리듬**: “오늘의 리듬 보기”를 눌렀을 때만 결과를 열고 이동합니다. 선택 중에는 결과를 바꾸거나 결과로 스크롤하지 않습니다. 확인된 활동과 장소 한 곳을 제안합니다. 저장·공유·“같이 할 사람이 있으면 좋겠어요”로 이어집니다. 저장 키와 장소 ID를 유지해 기존 저장 목록도 계속 사용합니다. 저장 대상은 plan이 아닌 장소 ID이므로 화면에는 **저장한 곳**으로 표시합니다. 여러 stop의 plan 저장을 구현할 때만 “저장한 리듬” 명칭을 검토합니다.

각 질문에는 1 / 3, 2 / 3, 3 / 3 진행 표시가 있습니다. 다음 단계에서 선택하거나 “다음” 버튼을 누르면 이전 선택지는 접히며, 질문 제목을 눌러 다시 수정할 수 있습니다. 자연어 입력의 Enter 키는 다음 질문으로만 이동합니다. 시간·이동의 기본값은 “상관없음”이며 마지막 버튼으로 확인합니다. 선택을 수정하면 이전 결과는 숨기고 마지막 버튼에서 다시 엽니다. 새 영역은 180ms만 살짝 나타나며 reduced-motion 설정에서는 애니메이션과 부드러운 스크롤을 생략합니다. 진행 상태는 `flow.js`에서 관리하고 기존 추천 알고리즘과 분리합니다.

Hero의 “오늘 하루의 여러 갈림길”은 `index.html` 안의 자체 제작 inline SVG입니다. 외부 사진·아이콘 라이브러리를 사용하지 않았습니다. 활동별 의미색과 연한 배지는 선택 후에도 유지하며, 강한 테두리·체크 표시로 선택을 구분합니다. 동행과 조건은 브랜드 그린을 유지합니다.

`rhythm.js`의 `DESIRES`, `ACTIVITIES`, `recommendRhythms`가 욕구·세부활동과 추천 순서를 관리합니다. `search.js`는 무료 규칙으로 자연어를 읽습니다. 외부 AI API를 호출하지 않습니다. 활동은 선택한 욕구·세부활동·자연어 중 하나라도 맞으면 남기고, 여러 선택에 맞을수록 우선합니다. 동행은 AND 필터가 아니며 일치 수를 추천에 반영합니다. 선택과 미확인 상태의 동행도 하위에 남깁니다.

확인된 편안함·시간·이동 조건 충족 수 → 동행 일치 수 → 욕구·활동 일치 수 → 기존 검색/정보 기반 점수 순으로 비교합니다. unknown은 충족으로 세지 않으며 부분 충족도 남깁니다. “가까운 곳” 이동 버튼은 위치·거리 계산이 없어 제거했습니다. 가까움은 위치 수집 없이 추정하지 않습니다. 향후 지역·거리 근거를 확보하면 기존 visitContext/route 구조를 확장해 다시 제공할 수 있습니다. 내부 추천 정렬값은 별점이나 공개 편안함 점수가 아닙니다. 향후 필수 조건은 `requiredComforts`로 분리할 수 있으나 이번 UI에서는 사용하지 않습니다.

추천 이유는 확인된 편안함 또는 출처·확인일이 있는 방문 정보만 사용합니다. DEMO에는 실제 방문 적합성을 주장하는 이유를 만들지 않습니다. `comfort.restroom.proximity`는 `near` / `far` / `unknown`이며 이용 편의만으로 거리를 추정하지 않습니다.

추가 데이터 필드는 선택 사항이므로 이전 JSON도 호환됩니다.

| 항목 | 의미와 기본값 |
| --- | --- |
| activityType | `run`, `walk`, `hike` 등 확인한 활동. 모르면 `unknown` |
| route | `distanceKm`, `difficulty`, `flatness`, `restroom`, `parking`, `lighting`, `crowd`, `scenery`, `loop` 모두 기본 `unknown` |
| route.sourceUrl / verifiedAt | 코스 수치나 상태를 넣으려면 실제 출처·확인일 필수 |
| visitContext | `duration`: `unknown` / `short` / `half_day` / `full_day`, `transportModes`: `[]` / `car` / `transit`. 알려진 값에는 `sourceUrl`, `verifiedAt` 필수 |
| 추천 결과의 plan | 같은 지역의 `stops`, `transfers`, `duration`, `distanceKm`로 향후 코스 확장 가능. 현재는 장소 1개만 참조하며 이동 구간은 빈 배열 |

자연어에 “10km”를 입력해도 확인된 코스 거리로 채우지 않습니다. 현재 데모의 코스·시간·이동 정보는 전부 미확인입니다. TourAPI 가져오기는 이 필드를 unknown으로 초기화하고 재수집 시 수동 확인 정보를 보존합니다. 출처·라이선스·이미지 권한 보존 원칙은 같습니다. 이번 작업은 관광 API를 실제 호출하지 않았습니다.

## 새 분석 이벤트와 기존 Supabase 호환

`analytics.js`의 `trackRhythm`은 다음 논리 이벤트를 `naerhythm:analytics` 브라우저 이벤트로 알리고, 기존 서버 허용 이벤트로 변환해 전송합니다. DEMO는 계속 `is_demo=true`입니다.

| 논리 이벤트 | 현재 서버에 저장하는 이벤트 |
| --- | --- |
| rhythm_start, companion_selected, desire_selected, activity_selected, condition_selected | filter_used |
| recommendation_view | search |
| rhythm_save / rhythm_share | save_place / share_place |
| companion_interest / premium_willingness | 기존 동일 이름 |

**현재 SQL은 새 이벤트 이름과 욕구·활동·시간·이동의 상세 선택값을 허용하지 않습니다.** 이번 작업에서는 `supabase/schema.sql`, KPI SQL, 실제 프로젝트 연결을 변경하지 않았습니다. 따라서 서버에서 시작·욕구·활동·조건 각각의 전환율을 완전히 분리할 수는 없습니다. 향후 분리 분석에는 이벤트명 제약 조건, `record_event` 허용 목록/상세값 검증, KPI SQL을 함께 확장한 별도 검토가 필요합니다. 기존 저장·공유·동행·지불의향 KPI는 유지됩니다. 자유 입력 검색문은 전송하지 않습니다.

## 공개 테스트 전 필수 TODO: 동행 수익검증 context analytics

**실제 사용자에게 공개 테스트하기 전에 아래 context analytics 확장이 필요합니다.** 이번 PR에서는 운영 Supabase 스키마나 연결을 변경하지 않으며 아래 컨텍스트를 새로 전송하지 않습니다.

- `selected_desires`: 선택한 욕구
- `selected_activities`: 선택한 세부 활동
- `companions`: 다중 동행 선택
- `duration`: 선택한 시간
- `transport`: 선택한 이동 수단
- `selected_comfort_preferences`: 선택한 편안함 선호
- `recommended_rhythm` / `recommended_activity`: 어떤 추천·활동에서 동행 관심/설문이 발생했는지
- `place_id`: 추천 장소 ID
- `premium_willingness`: 서비스비 지불의향

선택 → 추천 → 동행 관심 → 지불의향에 동일한 구조화 컨텍스트가 연결되도록 설계하고, 서버 이벤트/필드 허용 목록·값 검증·KPI 조회 SQL·DEMO 구분·RLS를 함께 검토해야 합니다. `place_id`와 지불의향은 이미 기존 이벤트로 저장 가능하지만 나머지 선택·추천 컨텍스트와 연결하는 작업은 남아 있습니다. **자유입력 자연어 원문은 계속 서버로 전송하지 않습니다.** 실제 위치·이동거리도 수집하거나 추정하지 않습니다.

## 검색엔진 비공개 검증 상태

모든 생성 HTML에 `noindex,nofollow`, 응답 헤더에 `X-Robots-Tag`를 붙이고 사이트맵은 비워 둡니다. `robots.txt`는 크롤러가 noindex를 읽을 수 있게 접근을 허용합니다. 이미 색인된 페이지의 제거에는 검색엔진 재방문 시간이 걸립니다. 정식 공개 시 `scripts/build.js`의 **INDEXING_ENABLED**를 `true`로 바꾸고 다시 빌드하면 실제 데이터 페이지의 색인을 허용할 수 있습니다. DEMO·저장·404는 계속 제외됩니다. noindex는 접근 제어가 아니므로 비밀 정보를 공개 파일에 넣지 않습니다.
