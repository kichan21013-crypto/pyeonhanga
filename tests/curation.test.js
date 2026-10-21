import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPilotPlaces } from '../scripts/pilot-data.js';
import { scoreRecommendationReadiness } from '../scripts/recommendation-readiness.js';
import { verifiedRecommendationReason } from '../verified-facts.js';

const comfort = () => Object.fromEntries(['parking','stairs','accessibility','restroom','seating','walking','noise','waiting'].map(key => [key, { value: 'unknown' }]));

function place(id, name = `장소 ${id}`, category = '나들이') {
  return {
    id,
    slug: id,
    name,
    category,
    region: '서울',
    address: '서울특별시 종로구 세종대로 1',
    latitude: 37.57,
    longitude: 126.98,
    image: `https://example.com/${id}.jpg`,
    imageAlt: name,
    sourceUrl: 'https://api.visitkorea.or.kr/',
    sourceName: '한국관광공사 TourAPI',
    lastVerifiedAt: '2026-10-21',
    priceRange: '정보 확인 필요',
    shortDescription: `${name} 안내`,
    companions: [],
    intentTags: [],
    comfort: comfort(),
    isDemo: false,
    tourApi: { contentId: id.replace(/\D/g, '') || '1', contentTypeId: category === '맛집' ? '39' : '12', modifiedTime: '20261001000000', imageSourceUrl: `https://example.com/${id}.jpg` },
  };
}

function detail(id, overrides = {}) {
  return {
    id,
    name: id,
    region: '서울',
    category: '나들이',
    modifiedTime: '20261001000000',
    facts: {
      overview: '공식 상세 설명', homepage: 'https://example.com', telephone: '02-0000-0000',
      parkingText: '주차 정보', operatingHoursText: '09:00~18:00', restDayText: '월요일', infoCenterText: '안내소',
      reservationText: null, seatText: null, firstMenuText: null, menuText: null,
      ...overrides,
    },
    completeness: { knownOperationalFacts: 4 },
    repeatedInfo: [{ infoname: '화장실', infotext: '화장실 정보' }],
    images: [{ originimgurl: 'https://example.com/extra.jpg' }],
  };
}

test('오늘 추천 준비도는 운영·접근 정보가 많은 장소를 더 높게 평가한다', () => {
  const base = place('101');
  const sparse = scoreRecommendationReadiness({ place: base, audit: { score: 100, hasRealImage: true }, referenceDate: '2026-10-21' });
  const rich = scoreRecommendationReadiness({
    place: base,
    audit: { score: 100, hasRealImage: true },
    detail: detail('101'),
    barrier: { completeness: { knownFields: 3 } },
    referenceDate: '2026-10-21',
  });
  assert.ok(rich.score > sparse.score);
  assert.ok(rich.factors.operational > 0);
  assert.ok(rich.factors.accessibility > 0);
});

test('48개 선별 풀은 상세수집 목록에 갇히지 않고 품질게이트 원천 후보 전체를 본다', () => {
  const places = [place('101','상세 장소'), place('102','원천 후보 A'), place('103','원천 후보 B')];
  const generalReport = { generatedAt: '2026-10-21T00:00:00Z', places: [detail('101')] };
  const result = buildPilotPlaces(places, generalReport, { generatedAt: '2026-10-21T00:00:00Z', places: [] }, 2);
  assert.equal(result.length, 2);
  assert.ok(result.some(item => item.id === '101'));
  assert.ok(result.some(item => item.id !== '101'));
  assert.ok(result.every(item => Number.isFinite(item.pilotRankScore)));
});

test('추천 이유는 사실형 이용정보를 과장 없이 요약한다', () => {
  const p = place('201');
  p.verifiedFacts = {
    verifiedAt: '2026-10-21',
    sourceName: '한국관광공사 TourAPI',
    sourceUrl: 'https://api.visitkorea.or.kr/',
    general: { parkingText: '주차 가능 여부 안내', operatingHoursText: '09:00~18:00' },
    barrierFree: {},
  };
  assert.equal(verifiedRecommendationReason(p), '주차와 이용시간 정보를 확인해 두었어요');
});
