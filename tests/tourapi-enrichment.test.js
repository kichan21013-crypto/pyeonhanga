import test from 'node:test';
import assert from 'node:assert/strict';
import { selectPilotCandidates, extractUsefulFacts, summarizeFacts } from '../scripts/enrich-tourapi-pilot.js';

function place(id, region, category, modifiedTime, extra = {}) {
  return {
    id,
    slug: id,
    name: id,
    region,
    category,
    address: `${region} 주소`,
    latitude: 37,
    longitude: 127,
    image: 'https://example.com/image.jpg',
    sourceUrl: 'https://api.visitkorea.or.kr/',
    isDemo: false,
    tourApi: { contentId: id.replace(/\D/g, '') || '1', contentTypeId: category === '맛집' ? '39' : '12', modifiedTime },
    comfort: Object.fromEntries(['parking','stairs','accessibility','restroom','seating','walking','noise','waiting'].map(key => [key, { value: 'unknown' }])),
    ...extra,
  };
}

test('파일럿 후보는 지역별 나들이/맛집 균형을 우선하고 최신 수정일을 고른다', () => {
  const places = [
    place('tour-1', '서울', '나들이', '20260101'),
    place('tour-2', '서울', '나들이', '20260201'),
    place('tour-3', '서울', '맛집', '20260301'),
    place('tour-4', '서울', '맛집', '20260401'),
    place('tour-5', '경기', '나들이', '20260501'),
    place('tour-6', '경기', '맛집', '20260601'),
  ];
  const selected = selectPilotCandidates(places, 2);
  assert.deepEqual(selected.map(item => item.id), ['tour-2', 'tour-4', 'tour-5', 'tour-6']);
});

test('상세 소개정보에서 나가치에 유용한 운영 사실을 안전하게 추출한다', () => {
  const facts = extractUsefulFacts(
    { overview: '<b>조용한 공원</b>', homepage: '<a href="x">홈</a>', tel: '02-1234' },
    { parking: '주차 가능', usetime: '09:00~18:00', restdate: '월요일', chkpet: '불가' },
  );
  assert.equal(facts.overview, '조용한 공원');
  assert.equal(facts.parkingText, '주차 가능');
  assert.equal(facts.operatingHoursText, '09:00~18:00');
  assert.equal(facts.petText, '불가');
  assert.equal(summarizeFacts(facts).knownOperationalFacts, 4);
});

test('음식점 전용 필드도 공통 사실 이름으로 정규화한다', () => {
  const facts = extractUsefulFacts({}, {
    parkingfood: '주차 가능',
    opentimefood: '11:00~21:00',
    restdatefood: '화요일',
    reservationfood: '예약 가능',
    firstmenu: '칼국수',
  });
  assert.equal(facts.parkingText, '주차 가능');
  assert.equal(facts.operatingHoursText, '11:00~21:00');
  assert.equal(facts.reservationText, '예약 가능');
  assert.equal(facts.firstMenuText, '칼국수');
});
