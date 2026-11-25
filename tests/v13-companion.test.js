import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { detailMarkup } from '../ui.js';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('카테고리 아이콘 안의 이미지를 이전보다 크게 표시한다',async()=>{
  const css=await read('assets/v12-direct-home.css');
  assert.match(css,/\.n12-emoji\{font-size:48px!important/);
  assert.match(css,/font-size:43px!important/);
  assert.match(css,/\.n12-category\[aria-pressed=true\] \.n12-emoji::after/);
});

test('홈의 동행은 카테고리보다 먼저 보여주고, 카드에서도 바로 설문을 연다',async()=>{
  const source=await read('assets/v12-direct-home.js');
  assert.ok(source.indexOf('<section class="n16-hero n18-hero"')<source.indexOf('n15-place-drawer'));
  assert.match(source,/href="\/companion\.html"/);
  assert.match(source,/data-companion-interest/);
  assert.match(source,/동행 수요 조사/);
  assert.match(source,/실제 동행 연결은 아직 제공하지 않아요/);
  assert.match(source,/analyticsEnabled/);
  assert.doesNotMatch(source,/모집확정|실시간 파티원|잔여석/);
});

test('동행이 전용 콘텐츠와 네 번째 하단 메뉴로 노출된다',async()=>{
  const page=await read('dist/companion.html');
  const home=await read('dist/index.html');
  const saved=await read('dist/saved.html');
  const detailFiles=await read('scripts/build-core.js');
  assert.match(page,/오늘, 누구랑/);
  assert.match(page,/\?together=eat/);
  assert.match(page,/아직 실제 동행 모집·예약·결제는 제공하지 않아요/);
  assert.match(page,/class="n13-landing n15-program-hub n16-companion-hub"/);
  assert.match(page,/data-companion="true"/);
  assert.match(home,/v12-direct-home\.js\?v=20261125-v44/);
  assert.match(saved,/app\.js\?v=20261125-v44/);
  assert.match(detailFiles,/mobileNav\(path === '\/companion\.html' \? 'companion' : 'recommend'\)/);
  assert.match(detailFiles,/class="n13-nav-companion/);
});

test('장소 상세는 동행 콘텐츠가 방문 핵심정보보다 먼저 보인다',async()=>{
  const src=await read('ui.js');
  assert.match(src,/id="companion"/);
  assert.match(src,/나가치 · 같이갈래\?/);
  assert.match(src,/간단한 취향 선택/);
  assert.ok(src.indexOf('<section id="companion"')<src.indexOf('\${verifiedFactsPanel(p)}'));
});

test('2단계 설문은 익명/동의/저장결과/실패를 명확히 표시한다',async()=>{
  const src=await read('app.js');
  const styles=await read('assets/v13-companion.css');
  assert.match(src,/n13-survey-step/);
  assert.match(src,/data-n13-next/);
  assert.match(src,/data-n13-back/);
  assert.match(src,/name="consent" value="yes" required/);
  assert.match(src,/delete values\.consent/);
  assert.match(src,/recordConsentedSurvey/);
  assert.match(src,/response_id:responseId/);
  assert.match(src,/await recordConsentedSurvey/);
  assert.match(src,/저장하지 못했어요/);
  assert.match(src,/관심이 서버에 저장됐어요/);
  assert.match(src,/선택한 내용은 아직 저장되지 않았습니다/);
  assert.match(src,/어느 연령대이세요\?/);
  assert.match(styles,/\.n13-survey-step\[hidden\]/);
  assert.doesNotMatch(src,/예약이 확정됐습니다|동행 신청 완료/);
});

test('기존 저장·무료 운영·개인정보 경계가 유지된다',async()=>{
  const pkg=JSON.parse(await read('package.json'));
  const build=await read('scripts/build-core.js');
  const css=await read('assets/v13-companion.css');
  const analytics=await read('analytics.js');
  assert.ok(!('dependencies' in pkg));
  assert.doesNotMatch(css,/@import|fonts\.googleapis/);
  assert.match(build,/data-companion/);
  assert.match(analytics,/if \(!analyticsEnabled \|\| !EVENTS\.includes\(event\)\) return false/);
  assert.match(analytics,/premium_willingness/);
  assert.doesNotMatch(analytics,/\'email\'|\'phone_number\'|\'full_name\'/);
});
