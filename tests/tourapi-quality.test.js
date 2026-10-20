import test from 'node:test';
import assert from 'node:assert/strict';
import { auditTourApiPlace, auditTourApiPlaces, classifyTourApiRole, isKoreaCoordinate } from '../scripts/tourapi-quality.js';

function sample(overrides = {}) {
  return {
    id: 'tour-1',
    name: '경포호수광장',
    category: '나들이',
    region: '강릉',
    address: '강원특별자치도 강릉시 해안로 415',
    latitude: 37.7977,
    longitude: 128.9095,
    image: 'https://example.com/photo.jpg',
    sourceUrl: 'https://api.visitkorea.or.kr/',
    isDemo: false,
    tourApi: { contentId: '1', contentTypeId: '12' },
    comfort: Object.fromEntries(['parking','stairs','accessibility','restroom','seating','walking','noise','waiting'].map(key => [key, { value: 'unknown' }])),
    ...overrides,
  };
}

test('한국 밖 좌표와 0,0 좌표를 거른다', () => {
  assert.equal(isKoreaCoordinate(37.5, 127), true);
  assert.equal(isKoreaCoordinate(19.69, 117.99), false);
  assert.equal(isKoreaCoordinate(0, 0), false);
});

test('여행 코스와 편의시설을 일반 추천 장소와 분리한다', () => {
  assert.equal(classifyTourApiRole(sample({ category: '여행', tourApi: { contentId: '2', contentTypeId: '25' } })), 'course');
  assert.equal(classifyTourApiRole(sample({ name: '강문해변화장실' })), 'facility');
  assert.equal(classifyTourApiRole(sample()), 'place');
});

test('좌표 오류나 주소 누락은 source_only로 보관한다', () => {
  const badCoord = auditTourApiPlace(sample({ latitude: 19.69, longitude: 117.99 }));
  assert.equal(badCoord.status, 'source_only');
  assert.ok(badCoord.flags.includes('invalid_korea_coordinate'));

  const missingAddress = auditTourApiPlace(sample({ address: '주소 확인 필요' }));
  assert.equal(missingAddress.status, 'source_only');
  assert.ok(missingAddress.flags.includes('missing_address'));
});

test('정상 장소는 후보로 남기고 편안함 미확인을 별도 표시한다', () => {
  const audited = auditTourApiPlace(sample());
  assert.equal(audited.status, 'candidate');
  assert.equal(audited.role, 'place');
  assert.ok(audited.flags.includes('comfort_unknown'));

  const report = auditTourApiPlaces([
    sample(),
    sample({ id: 'tour-2', name: '강문해변화장실', tourApi: { contentId: '2', contentTypeId: '12' } }),
    sample({ id: 'tour-3', category: '여행', tourApi: { contentId: '3', contentTypeId: '25' } }),
  ]);
  assert.equal(report.summary.total, 3);
  assert.equal(report.summary.byRole.place, 1);
  assert.equal(report.summary.byRole.facility, 1);
  assert.equal(report.summary.byRole.course, 1);
});
