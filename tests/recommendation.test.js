import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inferIntent, recommendPlaces, recommendationReasons, emptyFilters, requestedComforts, comfortMatches } from '../search.js';
import { convertItem, mergeImportedPlace } from '../scripts/import-tourapi.js';
import { validatePlaces } from '../scripts/validate-data.js';
import { card } from '../ui.js';
const places = JSON.parse(await readFile(new URL('../data/places.json', import.meta.url)));
const evidence = value => ({ value, sourceUrl: 'https://example.org/demo-sample-fixture', verifiedAt: '2026-10-20', note: 'DEMO SAMPLE · 자동 테스트 전용 근거' });
function fixture(id, category = '나들이', tags = []) {
  const p = structuredClone(places[0]);
  return { ...p, id, slug: id, name: 'DEMO SAMPLE 테스트 장소', category, shortDescription: '자동 테스트 전용 가상 데이터', isDemo: false, sourceUrl: 'https://example.org/demo-sample-fixture', lastVerifiedAt: '2026-10-20', companions: [], intentTags: tags };
}
test('요청한 자연어 예문 7개의 활동/동행/편안함을 구분하고 문장 어미를 제거한다', () => {
  const examples = [
    ['칼국수 먹고 싶어', '맛집', 'noodle'], ['드라이브하고 싶어', '나들이', 'drive'],
    ['많이 걷지 않고 바람 쐬고 싶어', '나들이', 'scenery'], ['친구랑 조용히 밥 먹고 싶어', '맛집', 'food'],
    ['바다 보고 싶어', '여행', 'sea'], ['산책하고 싶어', '나들이', 'walk'], ['카페 가고 싶어', '나들이', 'cafe'],
  ];
  for (const [query, category, tag] of examples) {
    const intent = inferIntent(query); assert.equal(intent.category, category, query); assert.ok(intent.intents.includes(tag), query); assert.deepEqual(intent.tokens, [], query);
    const p = fixture('demo-fixture', category, [tag]);
    p.comfort.walking = evidence('good'); p.comfort.noise = evidence('good');
    assert.equal(recommendPlaces([p], { ...emptyFilters(), query }).length, 1, query);
  }
  assert.equal(inferIntent(examples[3][0]).companion, 'friend');
  assert.ok(inferIntent(examples[2][0]).comforts.includes('walking'));
  assert.equal(inferIntent('맛집과 드라이브').category, '');
});
test('동행 선택이 추천 순서를 바꾸며 동행 미확인 장소를 거짓으로 제외하지 않는다', () => {
  const family = fixture('demo-family'), friend = fixture('demo-friend'), unknown = fixture('demo-unknown');
  family.companions = ['family']; friend.companions = ['friend'];
  const source = [unknown, family, friend];
  const friendResults = recommendPlaces(source, { ...emptyFilters(), companion: '친구' });
  assert.equal(friendResults[0].place.id, friend.id); assert.equal(friendResults.length, 3);
  assert.equal(recommendPlaces(source, { ...emptyFilters(), companion: 'family' })[0].place.id, family.id);
  assert.deepEqual(source.map(p => p.id), ['demo-unknown','demo-family','demo-friend']);
});
test('자동 카테고리는 우선순위이고 수동 카테고리/전체 선택은 우선한다', () => {
  const cafe = fixture('demo-cafe', '맛집', ['cafe']), outing = fixture('demo-outing', '나들이', ['cafe']);
  let f = { ...emptyFilters(), query: '카페 가고 싶어' };
  assert.deepEqual(recommendPlaces([cafe, outing], f).map(r => r.place.id), [outing.id, cafe.id]);
  assert.equal(recommendPlaces([cafe, outing], { ...f, category: '맛집' })[0].place.id, cafe.id);
  assert.equal(recommendPlaces([cafe, outing], { ...f, category: '' }).length, 2);
  assert.equal(recommendPlaces([cafe], { ...emptyFilters(), query: '없는장소명' }).length, 0);
});
test('7가지 편안함은 확인 근거를 요구하고 화장실의 편의와 거리를 구분한다', () => {
  const unknown = fixture('demo-unknown'), good = fixture('demo-good');
  for (const key of ['parking','walking','stairs','restroom','noise','seating','waiting']) good.comfort[key] = evidence('good');
  for (const key of ['parking','walking','stairs','noise','seating','waiting']) {
    const results = recommendPlaces([unknown, good], { ...emptyFilters(), comforts: [key] });
    assert.equal(results.length, 2); assert.equal(results[0].place.id, good.id);
    assert.equal(results[0].matchedComforts, 1); assert.equal(results[1].matchedComforts, 0);
  }
  assert.equal(comfortMatches(good, 'restroom'), false);
  assert.equal(recommendPlaces([good], { ...emptyFilters(), comforts: ['restroom'] }).length, 1);
  good.comfort.restroom.proximity = 'near';
  assert.equal(recommendPlaces([good], { ...emptyFilters(), comforts: ['restroom'] }).length, 1);
  assert.equal(comfortMatches(good, 'restroom'), true);
  delete good.comfort.restroom.sourceUrl;
  assert.equal(comfortMatches(good, 'restroom'), false);
  assert.equal(recommendPlaces([good], { ...emptyFilters(), comforts: ['restroom'] })[0].matchedComforts, 0);
});
test('완전 충족→부분 충족→미충족 순서는 검색/동행 가중치보다 항상 우선한다', () => {
  const all = fixture('demo-all','맛집',['noodle']), part = fixture('demo-part','맛집',['noodle','korean_food']), none = fixture('demo-none','맛집',['noodle','korean_food']);
  all.comfort.parking = evidence('good'); all.comfort.noise = evidence('good');
  part.comfort.parking = evidence('good'); none.comfort.parking = evidence('poor'); none.comfort.noise = evidence('poor');
  part.companions = ['friend']; none.companions = ['friend'];
  const f = { ...emptyFilters(), query: '칼국수 한식', companion: '친구', comforts: ['parking','noise'] };
  const results = recommendPlaces([none,part,all],f);
  assert.deepEqual(results.map(r => r.place.id), [all.id,part.id,none.id]);
  assert.deepEqual(results.map(r => r.matchedComforts), [2,1,0]);
  assert.deepEqual(recommendationReasons(part,f).filter(text => text.includes('조용')), []);
  assert.deepEqual(recommendationReasons(none,f).filter(text => text.includes('주차') || text.includes('조용')), []);
});
test('선호 정보가 전부 unknown이어도 결과와 정보 부족 안내를 유지하며 내부 정렬값을 노출하지 않는다', () => {
  const f = { ...emptyFilters(), query: '조용한 곳', comforts: ['parking','walking','restroom'] };
  const results = recommendPlaces(places,f);
  assert.equal(results.length, places.length); assert.ok(results.every(r => r.matchedComforts === 0));
  for (const result of results) {
    const html = card(result.place,false,f);
    assert.match(html,/편안함 정보 수집 중/); assert.deepEqual(result.reasons,[]);
    assert.ok(!html.includes('matchedComforts')); assert.ok(!html.includes('relevance'));
  }
});
test('필수 조건은 명시했을 때만 강제하고 기본 UI의 선호 조건과 분리한다', () => {
  const unknown = fixture('demo-unknown'), good = fixture('demo-good'); good.comfort.parking = evidence('good');
  assert.equal(recommendPlaces([unknown,good],{...emptyFilters(),parking:true}).length,2);
  assert.deepEqual(recommendPlaces([unknown,good],{...emptyFilters(),requiredComforts:['parking']}).map(r=>r.place.id),[good.id]);
});
test('자동으로 읽은 편안함 조건을 사용자가 해제하거나 다시 선택할 수 있다', () => {
  const f = { ...emptyFilters(), query: '조용한 곳', comfortOverrides: { noise: false } };
  assert.ok(!requestedComforts(f).includes('noise'));
  f.comfortOverrides.noise = true; assert.ok(requestedComforts(f).includes('noise'));
  assert.deepEqual(inferIntent('주차 필요 없어').comforts, []);
});
test('추천 이유는 확인한 항목만 쓰며 데모에 실제 적합성을 주장하지 않는다', () => {
  const p = fixture('demo-reason');
  p.comfort.parking = evidence('good'); p.companions = ['friend'];
  const reasons = recommendationReasons(p, { ...emptyFilters(), parking: true, companion: '친구' });
  assert.ok(reasons.some(text => text.includes('주차'))); assert.ok(reasons.some(text => text.includes('친구')));
  assert.ok(!reasons.some(text => text.includes('조용')));
  assert.match(card(p, false, { ...emptyFilters(), parking: true }), /recommendation-reason/);
  assert.deepEqual(recommendationReasons({ ...p, isDemo: true }, { ...emptyFilters(), parking: true }), []);
  assert.ok(!card({ ...p, isDemo: true }).includes('recommendation-reason'));
});
test('근거가 있는 편안함 점수는 마지막 추천 우선순위이며 unknown 점수는 생성하지 않는다', () => {
  const unknown = fixture('demo-unknown'), verified = fixture('demo-verified');
  for (const key of ['parking','stairs','restroom']) verified.comfort[key] = evidence('good');
  assert.equal(recommendPlaces([unknown, verified])[0].place.id, verified.id);
  assert.ok(Object.values(unknown.comfort).every(f => f.value === 'unknown'));
});
test('TourAPI 원본 저작권 코드를 보존하고 확인한 태그·라이선스를 재수집 때 유지한다', () => {
  const incoming = convertItem({ contentid: '1234', title: 'DEMO SAMPLE', cpyrhtDivCd: 'RAW-UNMAPPED' }, '서울', '나들이');
  assert.equal(incoming.sourceLicense.copyrightCode, 'RAW-UNMAPPED');
  assert.equal(incoming.sourceLicense.name, null); assert.equal(incoming.imageLicense.name, null);
  assert.deepEqual(incoming.intentTags, []); assert.deepEqual(incoming.companions, []);
  assert.equal(incoming.comfort.restroom.proximity, 'unknown');
  const reviewed = { ...incoming, companions: ['friend'], intentTags: ['walk'], sourceLicense: { ...incoming.sourceLicense, name: 'DEMO SAMPLE 확인된 라이선스' } };
  const merged = mergeImportedPlace(reviewed, incoming);
  assert.deepEqual(merged.intentTags, ['walk']); assert.deepEqual(merged.companions, ['friend']);
  assert.equal(merged.sourceLicense.name, reviewed.sourceLicense.name); assert.equal(validatePlaces([merged]), true);
  const newImage = mergeImportedPlace({ ...reviewed, imageLicense: { name: 'DEMO SAMPLE 이전 사진 권한' } }, { ...incoming, image: 'https://example.org/new-demo-sample.jpg' });
  assert.equal(newImage.imageLicense.name, null);
  const newRights = mergeImportedPlace(reviewed, { ...incoming, sourceLicense: { ...incoming.sourceLicense, copyrightCode: 'CHANGED' } });
  assert.equal(newRights.sourceLicense.name, null); assert.equal(newRights.sourceLicense.copyrightCode, 'CHANGED');
  merged.comfort.restroom.proximity = 'near'; assert.throws(() => validatePlaces([merged]), /화장실 거리/);
});
test('홈의 상황 선택 순서·예시 칩 수·기본/추가 조건·Workers 배포 설정을 유지한다', async () => {
  const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  const positions = ['id="companions-title"','id="intent-title"','id="comfort-title"','id="results-title"'].map(value => html.indexOf(value));
  assert.ok(positions.every((value,i) => value >= 0 && (i === 0 || value > positions[i-1])));
  assert.equal([...html.matchAll(/data-intent="/g)].length, 6);
  assert.equal([...html.matchAll(/data-comfort="/g)].length, 7);
  assert.match(html, /id="extra-filters"[^>]*hidden/);
  const wrangler = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.equal(wrangler.assets.directory, './dist');
});
