import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('세부활동 칩은 DOM 재생성 전에 클릭을 캡처해 라이브 추천을 다시 계산한다', async () => {
  const source = await readFile(new URL('../assets/v5-app-home.js', import.meta.url), 'utf8');
  assert.match(source, /const activity = event\.target\.closest\?\.\('\[data-activity\]'\)/);
  assert.match(source, /if \(!activity \|\| !refinement\?\.contains\(activity\)\) return;\s*setTimeout\(\(\) => submitLive\(\), 0\);\s*\}, true\);/s);
  assert.match(source, /const liveFilter = event\.target\.closest\('\[data-companion\],\[data-duration\],\[data-transport\],\[data-comfort\]'\)/);
});
