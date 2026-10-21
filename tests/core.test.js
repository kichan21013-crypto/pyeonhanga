import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateComfort, WEIGHTS } from '../comfort-score.js';
import { filterPlaces, emptyFilters } from '../search.js';
import { card, detailMarkup } from '../ui.js';
import { validatePlaces } from '../scripts/validate-data.js';
import { convertItem } from '../scripts/import-tourapi.js';
const places = JSON.parse(await readFile(new URL('../data/places.json', import.meta.url)));
const fact = value => ({ value, sourceUrl: 'https://example.org/verified-fixture', verifiedAt: '2026-10-19', note: 'TEST FIXTURE ONLY' });

function fixture(id, overrides = {}) {
  const base = structuredClone(places[0]);
  return {
    ...base,
    id,
    slug: id,
    name: '테스트 장소',
    shortDescription: '테스트 전용 장소',
    region: '서울',
    category: '나들이',
    companions: [],
    intentTags: [],
    ...overrides,
  };
}

const filterFixtures = [
  fixture('fixture-hanjeongsik', { name: '정갈한 한정식', category: '맛집', region: '서울', companions: ['family'], intentTags: ['korean_food'] }),
  fixture('fixture-outing-1', { name: '도심 나들이 공원', category: '나들이', region: '서울', intentTags: ['outing','walk'] }),
  fixture('fixture-trip-1', { name: '강릉 바다 여행', category: '여행', region: '강릉', intentTags: ['travel','sea'] }),
  fixture('fixture-trip-2', { name: '제주 하루 여행', category: '여행', region: '제주', intentTags: ['travel'] }),
];

test('모든 현재 데이터가 검증되며 DEMO가 있으면 unknown 원칙을 지킨다', () => {
  assert.equal(validatePlaces(places), true);
  for (const p of places.filter(p => p.isDemo)) {
    assert.match(p.sourceName, /DEMO SAMPLE/);
    assert.equal(calculateComfort(p.comfort).score, null);
  }
});
test('unknown과 근거 없는 값은 점수를 높이지 않는다', () => {
  assert.equal(calculateComfort().score, null);
  assert.equal(calculateComfort({ parking: { value: 'good' } }).coverage, 0);
  assert.equal(calculateComfort({ parking: fact('good'), stairs: fact('good'), noise: fact('unknown') }).score, null);
});
test('40% 경계와 불리한 확인값을 정확히 계산한다', () => {
  const at40 = { parking: fact('good'), stairs: fact('poor'), restroom: fact('moderate') };
  assert.equal(calculateComfort(at40).coverage, .4);
  assert.equal(calculateComfort(at40).score, 50);
  const at35 = { parking: fact('good'), restroom: fact('good'), noise: fact('good') };
  assert.equal(calculateComfort(at35).score, null);
});
test('정보 신뢰도와 연령 프로필을 구분한다', () => {
  const all = Object.fromEntries(Object.keys(WEIGHTS.default).map(k => [k, fact('good')]));
  assert.deepEqual(calculateComfort(all), { score: 100, coverage: 1, confidence: '높음', label: '정보 기반 편안함' });
  const sixty = { parking: fact('good'), stairs: fact('good'), accessibility: fact('good'), restroom: fact('good'), noise: fact('poor') };
  assert.equal(calculateComfort(sixty).confidence, '보통');
  assert.notEqual(calculateComfort(sixty, '50s').score, calculateComfort(sixty, '70plus').score);
});
test('검색과 지역/카테고리 조건을 유지하고 동행 태그를 호환한다', () => {
  assert.equal(filterPlaces(filterFixtures, { ...emptyFilters(), query: '한정식' }).length, 1);
  assert.equal(filterPlaces(filterFixtures, { ...emptyFilters(), category: '여행' }).length, 2);
  assert.equal(filterPlaces(filterFixtures, { ...emptyFilters(), region: '서울', companion: '가족' }).length, 2);
  assert.equal(filterPlaces(filterFixtures, { ...emptyFilters(), region: '부산', category: '맛집' }).length, 0);
});
test('편안함 선호와 자연어 검색이 unknown 장소를 남기되 충족으로 판단하지 않는다', () => {
  assert.equal(filterPlaces(filterFixtures, { ...emptyFilters(), parking: true }).length, filterFixtures.length);
  assert.equal(filterPlaces(filterFixtures, { ...emptyFilters(), query: '많이 걷지 않는 나들이' }).length, 1);
  const f = fixture('fixture-comfort', { name: '주차 편한 한정식', category: '맛집', intentTags: ['korean_food'] });
  f.comfort.parking = fact('good'); f.comfort.stairs = fact('good'); f.comfort.walking = fact('moderate');
  assert.equal(filterPlaces([f], { ...emptyFilters(), query: '주차 편한 한정식', stairs: true, walking: 'moderate' }).length, 1);
  assert.equal(filterPlaces([f], { ...emptyFilters(), walking: 'good' }).length, 1);
});
test('출력에서 HTML 삽입을 차단하고 unknown 안내를 제공한다', () => {
  const p = { ...fixture('fixture-xss'), name: '<script>alert(1)</script>', image: 'javascript:alert(1)' };
  assert.ok(!card(p).includes('<script>'));
  assert.ok(!card(p).includes('src="javascript:'));
  assert.match(detailMarkup(p), /편안함 정보는 확인된 것만/);
  assert.match(detailMarkup(p), /편안함 점수는 확인 근거 40% 이상일 때 표시/);
});
test('실제 데이터는 출처를 요구하고 중복 URL을 거부한다', () => {
  const missingSource = { ...fixture('fixture-source'), isDemo: false, sourceName: null, sourceUrl: null };
  assert.throws(() => validatePlaces([missingSource]), /sourceName|출처/);
  const duplicate = fixture('fixture-duplicate');
  assert.throws(() => validatePlaces([duplicate, duplicate]), /중복/);
});
test('TourAPI 변환은 원본 식별자를 보존하고 편안함을 생성하지 않는다', () => {
  const p = convertItem({ contentid: '12345', title: 'TEST FIXTURE', contenttypeid: '12', mapx: '128.1', mapy: '37.2', addr1: 'TEST ADDRESS', modifiedtime: '20261019000000' }, '강릉', '나들이', '2026-10-19');
  assert.equal(p.tourApi.contentId, '12345');
  assert.equal(p.longitude, 128.1); assert.equal(p.isDemo, false);
  assert.equal(validatePlaces([p]), true);
  assert.equal(calculateComfort(p.comfort).score, null);
  assert.deepEqual(p.companions, []);
  assert.equal(convertItem({ contentid: 'bad' }, '서울', '맛집'), null);
});
test('배포용 추천 풀은 최대 180개로 확대되고 확인된 사실과 unknown 원칙을 함께 유지한다', async () => {
  const builtPlaces = JSON.parse(await readFile(new URL('../dist/data/places.json', import.meta.url)));
  assert.ok(builtPlaces.length >= 150 && builtPlaces.length <= 180, `배포 장소 수 ${builtPlaces.length}`);
  assert.equal(new Set(builtPlaces.map(p => p.region)).size, 6);
  const withFacts = builtPlaces.filter(p => p.verifiedFacts?.verifiedAt);
  assert.ok(withFacts.length >= 60, `확인된 사실 장소 ${withFacts.length}`);
  assert.ok(withFacts.some(p => Object.values(p.verifiedFacts?.barrierFree || {}).some(Boolean)));
  assert.ok(builtPlaces.some(p => (p.intentTags || []).includes('walk') || (p.intentTags || []).includes('cafe') || (p.intentTags || []).includes('food')));
  assert.ok(builtPlaces.every(p => calculateComfort(p.comfort).score === null));
});
test('정적 HTML 상세/SEO/사이트맵이 배포용 추천 풀 기준으로 빌드된다', async () => {
  const sitemap = await readFile(new URL('../dist/sitemap.xml', import.meta.url), 'utf8');
  const builtPlaces = JSON.parse(await readFile(new URL('../dist/data/places.json', import.meta.url)));
  const canonicals = new Set();
  for (const p of builtPlaces) {
    const html = await readFile(new URL(`../dist/places/${p.slug}/index.html`, import.meta.url), 'utf8');
    assert.match(html, /property="og:title"/);
    assert.ok(html.includes('방문 전에 필요한 정보부터') || html.includes('편안함 정보는 확인된 것만') || html.includes('확인된 편안함 정보'));
    assert.match(html, /class="nav-home" href="\/"/);
    const canonical = html.match(/rel="canonical" href="([^"]+)"/)[1];
    assert.ok(!canonicals.has(canonical)); canonicals.add(canonical);
    if (p.isDemo) { assert.match(html, /noindex,nofollow/); assert.ok(!sitemap.includes(`/places/${p.slug}/`)); }
  }
  const headers = await readFile(new URL('../dist/_headers', import.meta.url), 'utf8');
  assert.match(headers, /frame-ancestors 'none'/);
});
test('생성한 모든 HTML의 기본 접근성과 내부 링크가 유효하다', async () => {
  const root = fileURLToPath(new URL('../dist/', import.meta.url));
  async function visit(directory) {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const file = resolve(directory, item.name);
      if (item.isDirectory()) { await visit(file); continue; }
      if (!item.name.endsWith('.html')) continue;
      const html = await readFile(file, 'utf8');
      assert.match(html, /<html lang="ko">/); assert.equal((html.match(/<main\b/g) || []).length, 1);
      const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
      assert.equal(ids.length, new Set(ids).size, `${file}: 중복 ID`);
      for (const label of html.matchAll(/<label[^>]*\bfor="([^"]+)"/g)) assert.ok(ids.includes(label[1]), `${file}: label 연결`);
      for (const match of html.matchAll(/(?:href|src)="(\/[^"#?]*)(?:[?#][^"]*)?"/g)) {
        const target = resolve(root, '.' + decodeURIComponent(match[1]));
        const info = await stat(target);
        if (info.isDirectory()) await stat(resolve(target, 'index.html'));
      }
    }
  }
  await visit(root);
});
