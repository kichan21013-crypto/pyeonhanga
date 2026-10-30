import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('v5 라이브 필터는 현재 UI 선택값으로 추천 엔진을 직접 다시 렌더한다', async () => {
  const source = await readFile(new URL('../assets/v5-app-home.js', import.meta.url), 'utf8');
  assert.match(source, /import \{ recommendRhythms, emptyRhythmFilters \} from '\/rhythm\.js\?v=20261030-v53'/);
  assert.match(source, /function filtersFromUi\(\)/);
  assert.match(source, /filters\.activities = selectedValues\('\[data-activity\]', 'activity'\)/);
  assert.match(source, /const rhythms = recommendRhythms\(places, filters\)/);
  assert.match(source, /grid\.innerHTML = rhythms\.length/);
  assert.doesNotMatch(source, /qs\('#recommend-button'\)[\s\S]{0,160}\.click\(\)/);
  assert.match(source, /fetch\('\/data\/places\.json\?v=20261030-v53', \{ cache: 'no-store' \}\)/);
});

test('세부활동 칩 DOM이 다시 그려져도 다음 틱에서 라이브 결과를 다시 계산한다', async () => {
  const source = await readFile(new URL('../assets/v5-app-home.js', import.meta.url), 'utf8');
  assert.match(source, /const activity = event\.target\.closest\?\.\('\[data-activity\]'\)/);
  assert.match(source, /if \(!activity \|\| !refinement\?\.contains\(activity\)\) return;\s*setTimeout\(\(\) => submitLive\(\), 0\);\s*\}, true\);/s);
  assert.match(source, /const liveFilter = event\.target\.closest\('\[data-companion\],\[data-duration\],\[data-transport\],\[data-comfort\]'\)/);
});

test('배포 HTML은 새 클라이언트 버전을 사용해 이전 Safari 캐시와 섞이지 않는다', async () => {
  const buildSource = await readFile(new URL('../scripts/build.js', import.meta.url), 'utf8');
  assert.match(buildSource, /const CLIENT_VERSION = '20261030-v53'/);
  assert.match(buildSource, /src=\\"\/app\.js\?v=\$\{CLIENT_VERSION\}\\"/);
  assert.match(buildSource, /v5-app-home\.js\?v=\$\{CLIENT_VERSION\}/);
});
