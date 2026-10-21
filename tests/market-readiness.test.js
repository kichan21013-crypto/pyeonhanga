import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { recommendRhythms, emptyRhythmFilters } from '../rhythm.js';

const places = JSON.parse(await readFile(new URL('../dist/data/places.json', import.meta.url)));
const regions = ['서울','경기','강릉','경주','부산','제주'];

function results(region, overrides = {}) {
  return recommendRhythms(places, { ...emptyRhythmFilters(), region, ...overrides });
}

test('외부 테스트 핵심 욕구는 6개 지역 모두 최소 5개 추천을 유지한다', () => {
  const scenarios = [
    ['먹기', { desires: ['eat'] }],
    ['바람', { desires: ['outdoor'] }],
    ['새로운 곳', { desires: ['explore'] }],
    ['어울리기', { desires: ['social'] }],
  ];
  for (const region of regions) {
    for (const [label, filters] of scenarios) {
      const found = results(region, filters);
      assert.ok(found.length >= 5, `${region} · ${label}: ${found.length}개`);
      assert.ok(found.every(item => item.place.region === region), `${region} · ${label}: 타지역 혼입`);
    }
  }
});

test('편안함 선호 여러 개를 골라도 broad 추천 결과가 0건으로 줄지 않는다', () => {
  const comfortSets = [
    ['parking','walking','restroom'],
    ['stairs','seating','waiting'],
    ['parking','noise','seating'],
  ];
  for (const region of regions) {
    for (const comforts of comfortSets) {
      const baseline = results(region, { desires: ['outdoor'] });
      const conditioned = results(region, { desires: ['outdoor'], comforts });
      assert.ok(baseline.length >= 5, `${region}: 기본 바람 추천 부족`);
      assert.ok(conditioned.length >= 5, `${region} · ${comforts.join('+')}: ${conditioned.length}개`);
      assert.equal(conditioned.length, baseline.length, `${region}: 미확인 편안함 선호가 후보를 제거함`);
    }
  }
});

test('희소한 세부 활동도 같은 욕구의 부분일치 후보로 완화된다', () => {
  for (const region of regions) {
    const running = results(region, { desires: ['move'], activities: ['run'], comforts: ['walking','restroom'] });
    assert.ok(running.length >= 1, `${region} · 러닝 fallback 0건`);
    assert.ok(running.some(item => item.activityMatches > 0 || item.fallbackActivity), `${region} · 러닝 부분일치 표시 없음`);
  }
});

test('180개 공개 추천 풀은 지역당 충분한 후보와 실제 이미지를 유지한다', () => {
  assert.equal(places.length, 180);
  for (const region of regions) {
    const regional = places.filter(place => place.region === region);
    assert.ok(regional.length >= 25, `${region}: ${regional.length}개`);
    const realImages = regional.filter(place => /^https:\/\//.test(place.image || ''));
    assert.ok(realImages.length >= Math.ceil(regional.length * 0.8), `${region}: 실사진 ${realImages.length}/${regional.length}`);
  }
});
