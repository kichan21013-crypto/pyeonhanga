import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { meaningfulDescription } from '../ui.js';

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


test('v6 하단 탭은 이전 중앙 정렬 변환을 제거해 세 메뉴 모두 표시한다', async () => {
  const css = await readFile(new URL('../assets/v6-ui.css', import.meta.url), 'utf8');
  assert.match(css, /\.app-bottom-nav\{[^}]*transform:none!important;[^}]*width:100%!important;/s);
  assert.match(css, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});

test('장소 상세·목록에서 무의미한 자동 생성 소개만 제거하고 실제 문장은 유지한다', () => {
  const sample = { region: '경기', category: '맛집', shortDescription: '경기의 맛집 장소입니다. 편안함 관련 정보는 추가 확인이 필요합니다.' };
  assert.equal(meaningfulDescription(sample), '');
  assert.equal(meaningfulDescription({ ...sample, shortDescription: '공식 운영시간은 18시까지입니다. 편안함 관련 정보는 추가 확인이 필요합니다.' }), '공식 운영시간은 18시까지입니다.');
  assert.equal(meaningfulDescription({ ...sample, shortDescription: '이 장소는 창가 좌석이 있는 카페입니다.' }), '이 장소는 창가 좌석이 있는 카페입니다.');
});


test('홈 검색창은 단일 입력 박스로 정리하며 안쪽 폼·입력 테두리를 제거한다', async () => {
  const css = await readFile(new URL('../assets/v6-ui.css', import.meta.url), 'utf8');
  assert.match(css, /\.app-home-search #search-form\.intent-search\{[^}]*border:0!important;[^}]*background:transparent!important;/s);
  assert.match(css, /\.app-home-search #search-form \.intent-input\{[^}]*border:0!important;[^}]*background:transparent!important;/s);
  assert.match(css, /\.app-home-search #search-input\{[^}]*border:0!important;[^}]*background:transparent!important;/s);
});


test('v6.3 활동 런처는 여섯 개 이미지 아이콘과 풍경 배너를 사용한다', async () => {
  const [sprite, css, visualCss, heroCss] = await Promise.all([
    readFile(new URL('../assets/activity-illustrations-v63.svg', import.meta.url), 'utf8'),
    readFile(new URL('../assets/v6-ui.css', import.meta.url), 'utf8'),
    readFile(new URL('../assets/visual-v3.css', import.meta.url), 'utf8'),
    readFile(new URL('../assets/v3-hero-mobile.css', import.meta.url), 'utf8'),
  ]);
  for (const id of ['eat', 'move', 'outdoor', 'rest', 'explore', 'social']) {
    assert.match(sprite, new RegExp('<g id="' + id + '"'));
  }
  assert.equal((sprite.match(/<g id="/g) || []).length, 6);
  assert.match(css, /background-image:url\('\/assets\/activity-illustrations-v63\.svg'\)!important/);
  for (const [desire, position] of [['eat', 0], ['move', 20], ['outdoor', 40], ['rest', 60], ['explore', 80], ['social', 100]]) {
    assert.ok(css.includes("[data-desire='" + desire + "'] .choice-icon{background-position:" + position + "% 50%!important}"), desire);
  }
  assert.ok(css.includes('.app-category-grid .choice-chip .choice-icon svg{display:none!important}'));
  assert.ok(css.includes('var(--v3-hero-mobile)!important'));
  assert.ok(css.includes('.app-promo-art{display:none!important}'));
  assert.ok(visualCss.includes("v3-hero-mobile.css"));
  assert.ok(heroCss.includes('--v3-hero-mobile:url('));
});

test('선택한 6개 활동 아이콘은 이전 배경 덮어쓰기를 피하고 그림이 계속 표시된다', async () => {
  const [css, legacy] = await Promise.all([
    readFile(new URL('../assets/v6-ui.css', import.meta.url), 'utf8'),
    readFile(new URL('../assets/v43-baemin-like.css', import.meta.url), 'utf8'),
  ]);
  assert.match(legacy, /#flow-step-1 \.desire-grid \.choice-chip\[aria-pressed=true\] \.choice-icon\{background:/);
  const selectedIconRule = css.match(/#flow-step-1 \.desire-grid\.app-category-grid \.choice-chip\[aria-pressed='true'\] \.choice-icon\{([^}]*)\}/);
  assert.ok(selectedIconRule, '선택 상태에서 레거시 id 선택자보다 높은 우선순위의 아이콘 복원 필요');
  assert.match(selectedIconRule[1], /background-image:url\('\/assets\/activity-illustrations-v63\.svg'\)!important/);
  assert.match(selectedIconRule[1], /background-repeat:no-repeat!important/);
  assert.match(selectedIconRule[1], /background-size:600% 100%!important/);
  for (const [key, pos] of [['eat',0],['move',20],['outdoor',40],['rest',60],['explore',80],['social',100]]) {
    assert.ok(css.includes("#flow-step-1 .desire-grid.app-category-grid .choice-chip[aria-pressed='true'][data-desire='" + key + "'] .choice-icon{background-position:" + pos + "% 50%!important}"), key);
  }
});
