import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const fromRoot = path => readFile(new URL('../'+path, import.meta.url), 'utf8');

test('새 나가치 디자인은 외부 CSS·유료 폰트 없이 기존 자산 위에 마지막으로 적용한다', async () => {
  const mobile = await fromRoot('mobile-ux.css');
  const design = await fromRoot('assets/v9-product-redesign.css');
  assert.ok(mobile.trimEnd().endsWith("@import url('/assets/v9-product-redesign.css');"));
  assert.match(design,/--n-primary:/);
  assert.match(design,/app-quick-shortcuts/);
  assert.match(design,/prefers-reduced-motion/);
  assert.doesNotMatch(design,/@import\s+url\(['"]https?:/);
  assert.doesNotMatch(design,/fonts\.googleapis|fonts\.gstatic/);
});

test('원터치 선택은 기존 활동·욕구 버튼을 사용해 정확 일치 추천을 실행한다', async () => {
  const source = await fromRoot('assets/v5-app-home.js');
  for (const activity of ['seafood','cafe','walk','meat','drive','run'])
    assert.match(source,new RegExp("activity:'"+activity+"'"));
  assert.match(source,/shortcuts\.addEventListener\('click'/);
  assert.match(source,/data-quick-activity/);
  assert.match(source,/desireButton\?\.click\(\)/);
  assert.match(source,/allowSimilarOnEmpty = false/);
  assert.match(source,/submitLive\(\{scroll:true\}\)/);
  assert.match(source,/data-edit-choices/);
  assert.match(source,/data-retry-recommend/);
  assert.match(source,/aria-busy/);
});

test('빌드된 모든 핵심 화면은 같은 디자인과 모바일 3개 메뉴를 사용한다', async () => {
  const index = await fromRoot('dist/index.html');
  const saved = await fromRoot('dist/saved.html');
  const build = await fromRoot('scripts/build-core.js');
  const packageJson = JSON.parse(await fromRoot('package.json'));
  assert.match(index,/mobile-ux\.css\?v=20261119-v11/);
  assert.match(saved,/mobile-ux\.css\?v=20261119-v11/);
  assert.match(index,/v5-app-home\.js\?v=20261119-v11/);
  assert.match(saved,/class="n-mobile-nav"/);
  assert.match(saved,/저장<\/span>/);
  assert.match(build,/mobileNav\('recommend'\)/);
  assert.match(build,/mobileNav\('saved'\)/);
  assert.ok(!('dependencies' in packageJson),'기본 기능에 유료 SDK나 외부 패키지 의존을 추가하지 않음');
});

test('장소 카드 제목은 활동 분류가 아니라 실제 장소명을 먼저 노출한다', async () => {
  const source = await fromRoot('ui.js');
  assert.ok(source.includes('escapeHtml(p.name)}</a></h3>'));
  assert.match(source,/aria-label=.*저장/);
  assert.match(source,/rhythm\?\.fallbackActivity/);
});
