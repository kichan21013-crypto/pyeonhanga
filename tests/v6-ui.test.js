import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('v6 디자인 레이어는 마지막으로 로드되어 모바일 주요 영역을 구분한다', async () => {
  const [imports, css, client] = await Promise.all([
    readFile(new URL('../mobile-ux.css', import.meta.url), 'utf8'),
    readFile(new URL('../assets/v6-ui.css', import.meta.url), 'utf8'),
    readFile(new URL('../assets/v5-app-home.js', import.meta.url), 'utf8'),
  ]);
  assert.ok(imports.trimEnd().endsWith("@import url('/assets/v6-ui.css');"));
  for(const token of ['.app-category-grid','.app-promo','.app-bottom-nav','.app-load-more','.app-area-nav']) assert.ok(css.includes(token),token);
  assert.match(client,/regionRow\.addEventListener\('click'/);
  assert.match(client,/renderLiveResults\(\{more:true\}\)/);
  assert.match(client,/rhythms\.slice\(0, liveVisibleCount\)/);
  assert.match(client,/data-v6-region/);
});

test('추천 풀 180개는 기능 테스트 동안 유지하며 출처 기반 사실만 보여준다', async () => {
  const published = JSON.parse(await readFile(new URL('../dist/data/places.json', import.meta.url), 'utf8'));
  assert.equal(published.length, 180);
  assert.ok(published.every(p => !p.isDemo));
  assert.ok(published.every(p => p.sourceUrl && p.sourceName));
});
