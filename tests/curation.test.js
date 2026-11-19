import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPilotPlaces } from '../scripts/pilot-data.js';
import { scoreRecommendationReadiness } from '../scripts/recommendation-readiness.js';
import { selectPilotCandidates, resolvePerRegion } from '../scripts/enrich-tourapi-pilot.js';
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
    common: { firstimage: null, firstimage2: null },
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

test('공개 추천 풀은 상세수집 목록에 갇히지 않고 품질게이트 원천 후보 전체를 본다', () => {
  const places = [place('101','상세 장소'), place('102','원천 후보 A'), place('103','원천 후보 B')];
  const generalReport = { generatedAt: '2026-10-21T00:00:00Z', places: [detail('101')] };
  const result = buildPilotPlaces(places, generalReport, { generatedAt: '2026-10-21T00:00:00Z', places: [] }, 2);
  assert.equal(result.length, 2);
  assert.ok(result.some(item => item.id === '101'));
  assert.ok(result.some(item => item.id !== '101'));
  assert.ok(result.every(item => Number.isFinite(item.pilotRankScore)));
});

test('사진 없는 review 후보도 상세조회에서 실제 이미지가 확인되면 추천 풀에 복구한다', () => {
  const reviewed = place('104','리뷰 후보');
  reviewed.image = '/assets/garden.svg';
  reviewed.tourApi.imageSourceUrl = null;
  const recoveredDetail = detail('104');
  recoveredDetail.common.firstimage = 'https://example.com/recovered-104.jpg';
  const result = buildPilotPlaces([reviewed], { generatedAt: '2026-10-21T00:00:00Z', places: [recoveredDetail] }, { generatedAt: '2026-10-21T00:00:00Z', places: [] }, 1);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, '104');
  assert.equal(result[0].image, 'https://example.com/recovered-104.jpg');
  assert.equal(result[0].recommendationReadiness.factors.visual, 10);
});

test('enrichment는 candidate를 우선하되 review까지 포함하고 지역당 30개 설정을 허용한다', () => {
  const strict = place('201','실사진 후보');
  const review = place('202','사진 확인 필요 후보');
  review.image = '/assets/garden.svg';
  review.tourApi.imageSourceUrl = null;
  const selected = selectPilotCandidates([review, strict], 2);
  assert.deepEqual(selected.map(item => item.id), ['201','202']);
  assert.equal(resolvePerRegion('30'), 30);
  assert.equal(resolvePerRegion('99'), 30);
});

test('추천 이유는 사실형 이용정보를 과장 없이 요약한다', () => {
  const p = place('301');
  p.verifiedFacts = {
    verifiedAt: '2026-10-21',
    sourceName: '한국관광공사 TourAPI',
    sourceUrl: 'https://api.visitkorea.or.kr/',
    general: { parkingText: '주차 가능 여부 안내', operatingHoursText: '09:00~18:00' },
    barrierFree: {},
  };
  assert.equal(verifiedRecommendationReason(p), '주차와 이용시간 정보를 확인해 두었어요');
});


test('새 공개 풀은 지역당 80개까지 확장하되 사진 없는 원천 장소를 무리하게 노출하지 않는다', () => {
 const places = Array.from({length:85}, (_,i)=>place(String(5000+i),'실사진 '+i, i%2 ? '나들이':'맛집'));
 places.push({...place('5999','사진 없는 장소'), image:'/assets/garden.svg'});
 const result = buildPilotPlaces(places, {places:[]}, {places:[]}, 80);
 assert.equal(result.length, 80);
 assert.ok(result.every(p=>p.image.startsWith('https://')));
 assert.ok(result.every(p=>p.comfort.parking.value==='unknown'));
});


test('사진이 없는 장소는 실사진 비율 80% 이내에서만 카테고리 부족분을 채운다', () => {
 const real = Array.from({length:24},(_,i)=>place(String(7000+i),'실사진 '+i,'나들이'));
 const food = Array.from({length:10},(_,i)=>({...place(String(8000+i),'음식점 '+i,'맛집'),image:'/assets/garden.svg'}));
 const result = buildPilotPlaces([...real,...food],{places:[]},{places:[]},80);
 assert.ok(result.filter(p=>p.category==='맛집').length>=5);
 assert.ok(result.filter(p=>p.image.startsWith('https://')).length / result.length >= .8);
 assert.ok(result.length <= 30);
});


test('실제 이름·공식 대표메뉴가 확인된 해산물 식당은 목록 상위가 아니어도 세부 추천에 남는다', () => {
  const ordinary = Array.from({length:28},(_,i)=>place(String(9000+i),'가나다 일반식당 '+i,'맛집'));
  const special = place('9999','하늘정식','맛집');
  const generalReport = {generatedAt:'2026-11-19T00:00:00Z', places:[detail('9999',{firstMenuText:'광어회',menuText:'광어회 / 생선회 / 매운탕'})]};
  const result = buildPilotPlaces([...ordinary,special],generalReport,{places:[]},12);
  assert.ok(result.some(p=>p.id==='9999'),'확인된 해산물 메뉴가 일반 인기 목록에 밀려 빠지지 않아야 함');
  assert.ok(result.find(p=>p.id==='9999').intentTags.includes('seafood'));
  assert.ok(result.every(p=>p.comfort.parking.value==='unknown'));
});

test('카페 이름에 해산물처럼 보이는 빵 메뉴가 있어도 회·해산물 분류를 생성하지 않는다', () => {
  const cafe = place('9998','강남할배제빵소','맛집');
  const report = {places:[detail('9998',{firstMenuText:'오이도치즈조개바타',menuText:'커피 / 라떼'})]};
  const [result] = buildPilotPlaces([cafe], report, {places:[]}, 1);
  assert.ok(!result.intentTags.includes('seafood'));
});


test('실사진 있는 경기 해산물 식당이 충분할 때 최소 12곳을 지역별 공개 후보에 남긴다', () => {
  const ordinary = Array.from({length:140},(_,i)=>({
    ...place(String(30000+i), '일반 식당 '+i,'맛집'),
    region:'경기',address:'경기도 수원시 팔달구 효원로 1',
  }));
  const seafood = Array.from({length:19},(_,i)=>({
    ...place(String(40000+i),'경기 해물탕 전문점 '+i,'맛집'),
    region:'경기',address:'경기도 수원시 팔달구 효원로 2',
  }));
  const result = buildPilotPlaces([...ordinary,...seafood], {places:[]}, {places:[]}, 120);
  const exact = result.filter(p=>p.region==='경기' && p.intentTags.includes('seafood'));
  assert.ok(exact.length >= 12, '사진이 확인된 해산물 19곳 중 최소 12곳을 보여줘야 함');
  assert.ok(result.every(p=>p.image.startsWith('https://')));
  assert.ok(result.every(p=>p.comfort.parking.value==='unknown'));
  assert.ok(result.length<=120);
});
