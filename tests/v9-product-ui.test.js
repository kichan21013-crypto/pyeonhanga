import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const fromRoot = path => readFile(new URL('../'+path, import.meta.url), 'utf8');

test('새 나가치 홈은 카테고리 단일 영역과 실제 사진 중심 목록으로 구성한다',async()=>{
  const js=await fromRoot('assets/v12-direct-home.js');
  const css=await fromRoot('assets/v12-direct-home.css');
  assert.match(js,/좋은 하루/);
  assert.match(js,/n12-categories/);
  assert.match(js,/n12-grid/);
  assert.match(js,/n12-card/);
  assert.match(js,/data-n12-category/);
  assert.doesNotMatch(js,/기분 따라 고르기|app-category-grid|shortcut.*desireButton/);
  assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.n12-photo img/);
  assert.match(css,/\.n12-save/);
  assert.match(css,/\.n12-nav/);
});

test('기존 추천·저장·상세·출처 데이터를 유지하고 가짜 평점은 넣지 않는다',async()=>{
  const js=await fromRoot('assets/v12-direct-home.js');
  assert.match(js,/recommendRhythms\(catalog,filters\)/);
  assert.match(js,/savedIds\(\)/);
  assert.match(js,/data-save/);
  assert.match(js,/placeUrl\(place\)/);
  assert.match(js,/verifiedFacts\?\.general/);
  assert.doesNotMatch(js,/userRating|4\.9|별점|배달/);
});

test('홈과 저장·상세 화면은 서로 이동하고 캐시 변경이 적용된다',async()=>{
  const index=await fromRoot('dist/index.html');
  const saved=await fromRoot('dist/saved.html');
  const build=await fromRoot('scripts/build-core.js');
  assert.match(index,/v12-direct-home\.js\?v=20261124-v21/);
  assert.match(index,/v12-direct-home\.css\?v=20261124-v21/);
  assert.match(index,/mobile-ux\.css\?v=20261124-v21/);
  assert.match(saved,/mobile-ux\.css\?v=20261124-v21/);
  assert.match(saved,/class="n-mobile-nav"/);
  assert.ok(build.includes("mobileNav(path === '/companion.html' ? 'companion' : 'recommend')"));
  assert.match(build,/mobileNav\('saved'\)/);
  assert.doesNotMatch(index,/v5-app-home\.js\?v=/);
});

test('무료 운영: 외부 UI·폰트·유료 SDK 없이 기존 스택만 사용한다',async()=>{
  const css=await fromRoot('assets/v12-direct-home.css');
  const js=await fromRoot('assets/v12-direct-home.js');
  const pkg=JSON.parse(await fromRoot('package.json'));
  assert.ok(!('dependencies' in pkg));
  assert.doesNotMatch(css,/@import|fonts\.googleapis|fonts\.gstatic/);
  assert.doesNotMatch(js,/https?:\/\/|openai\.com|maps\.googleapis\.com|billing/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(js,/aria-busy/);
});
