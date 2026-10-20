import test from 'node:test';
import assert from 'node:assert/strict';
import { extractBarrierFreeFacts, summarizeBarrierFreeFacts } from '../scripts/enrich-barrierfree-pilot.js';

test('무장애 원문 필드는 HTML을 제거하고 사실 그대로 보관한다', () => {
  const facts = extractBarrierFreeFacts({
    wheelchair: '<b>대여 가능</b>',
    route: '주출입구까지&nbsp;경사로 있음',
    restroom: '장애인 화장실 있음',
    elevator: '',
  });
  assert.equal(facts.wheelchair, '대여 가능');
  assert.equal(facts.route, '주출입구까지 경사로 있음');
  assert.equal(facts.restroom, '장애인 화장실 있음');
  assert.equal(facts.elevator, null);
});

test('무장애 정보 충실도는 존재 여부만 요약하고 편안함 평가는 만들지 않는다', () => {
  const facts = extractBarrierFreeFacts({
    parking: '장애인 전용 주차구역 있음',
    wheelchair: '휠체어 접근 가능',
    route: '경사로 있음',
    stroller: '유모차 대여 가능',
    signguide: '수어 안내 가능',
  });
  const summary = summarizeBarrierFreeFacts(facts);
  assert.equal(summary.knownFields, 5);
  assert.equal(summary.hasParkingInfo, true);
  assert.equal(summary.hasMobilityInfo, true);
  assert.equal(summary.hasFamilyInfo, true);
  assert.equal(summary.hasHearingInfo, true);
  assert.equal(Object.hasOwn(summary, 'score'), false);
});
