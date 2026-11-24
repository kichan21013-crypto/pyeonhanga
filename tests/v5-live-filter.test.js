import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { recommendRhythms } from '../rhythm.js';
import { BROWSE_CATEGORIES, createBrowseFilters, toggleBrowseCategory } from '../assets/v12-browse-state.js';

test('새 탐색은 카테고리 한 개만 유지하고 기분 선택을 자동으로 누르지 않는다', () => {
  let selected = null;
  selected = toggleBrowseCategory(selected,'cafe');
  assert.equal(selected,'cafe');
  selected = toggleBrowseCategory(selected,'seafood');
  assert.equal(selected,'seafood','이전 카페 선택은 자동 해제');
  selected = toggleBrowseCategory(selected,'seafood');
  assert.equal(selected,null,'같은 항목을 다시 누르면 전체 보기');
  const f = createBrowseFilters({activity:'cafe',region:'경기'});
  assert.deepEqual(f.desires,['rest']);
  assert.deepEqual(f.activities,['cafe']);
  assert.equal(f.region,'경기');
  assert.equal(f.allowActivityFallback,false);
  assert.equal(BROWSE_CATEGORIES.length,8);
});

test('경기 회·해산물 선택은 실제 해산물 장소만 추천한다', async () => {
  const places = JSON.parse(await readFile(new URL('../dist/data/places.json',import.meta.url),'utf8'));
  const filter = createBrowseFilters({activity:'seafood',region:'경기'});
  const result = recommendRhythms(places,filter);
  assert.ok(result.length>=8,'수집된 경기 해산물 후보 노출');
  assert.ok(result.every(item => item.place.region==='경기'));
  assert.ok(result.every(item => item.place.intentTags.includes('seafood')));
  assert.ok(!result.some(item => item.fallbackActivity),'다른 업종을 섞지 않음');
});

test('라이브 추천은 하나의 카테고리 선택과 지역/검색을 사용한다', async () => {
  const source = await readFile(new URL('../assets/v12-direct-home.js',import.meta.url),'utf8');
  assert.match(source,/state\.activity = toggleBrowseCategory\(state\.activity,category\.dataset\.n12Category\)/);
  assert.match(source,/const matches = recommendRhythms\(catalog,filters\)/);
  assert.match(source,/state\.region = event\.target\.value/);
  assert.match(source,/state\.query = \$\('#n12-query'\)\.value\.trim\(\)/);
  assert.match(source,/const requestId = \+\+state\.requestId/);
  assert.match(source,/if \(requestId !== state\.requestId\) return/);
  assert.match(source,/results\.id = 'n12-results'/);
  assert.match(source,/\$\('#n12-results'\)\?\.scrollIntoView/);
  assert.doesNotMatch(source,/oldResults\.id =/,'기존 3단계 흐름의 결과 영역을 건드리지 않음');
  assert.doesNotMatch(source,/desireButton\?\.click\(\)|data-desire|data-quick-desire/,'기분 선택 동기화 코드 없음');
});

test('배포는 v12 단독 홈을 사용하고 이전 v5·사진 로더는 읽지 않는다',async()=>{
  const build=await readFile(new URL('../scripts/build.js',import.meta.url),'utf8');
  assert.match(build,/const CLIENT_VERSION = '20261124-v33'/);
  assert.match(build,/v12-direct-home\.js/);
  assert.match(build,/v12-direct-home\.css/);
  assert.doesNotMatch(build,/v5-app-home\.js|v8-photo-icon-loader\.js/);
});
