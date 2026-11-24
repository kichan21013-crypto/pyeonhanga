import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { COMPANION_INTERESTS, normalizeCompanionInterest, normalizeCompanionRegion, companionPlaceMatches } from '../assets/v14-companion-model.js';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('동행의 네 가지 시작 방식은 장소 분류와 분리되고 URL 선택값이 검증된다',()=>{
  assert.deepEqual(Object.keys(COMPANION_INTERESTS),['walk','eat','outing','travel']);
  assert.equal(normalizeCompanionInterest('walk'),'walk');
  assert.equal(normalizeCompanionInterest('unknown'),null);
  assert.equal(normalizeCompanionRegion('경기'),'경기');
  assert.equal(normalizeCompanionRegion('조작된 지역'),'');
});

test('실제 데이터에서 활동·지역에 맞는 장소만 동행 설문 후보로 사용한다',async()=>{
  const published=JSON.parse(await read('dist/data/places.json'));
  const walk=published.filter(p=>companionPlaceMatches(p,{interest:'walk',region:'서울'}));
  const eat=published.filter(p=>companionPlaceMatches(p,{interest:'eat',region:'경기'}));
  assert.ok(walk.length>0,'서울 산책 후보');
  assert.ok(eat.length>0,'경기 식사 후보');
  assert.ok(walk.every(p=>p.region==='서울'&&!p.isDemo&&p.image.startsWith('https://')));
  assert.ok(eat.every(p=>p.category==='맛집'&&!p.isDemo&&p.region==='경기'));
  assert.equal(companionPlaceMatches({...walk[0],isDemo:true},{interest:'walk'}),false);
  assert.equal(companionPlaceMatches({...walk[0],image:'data:image/svg;base64,abc'},{interest:'walk'}),false);
  assert.equal(companionPlaceMatches(walk[0],{interest:'unknown'}),false);
});

test('홈은 동행 희망을 첫 화면에 두고, 장소는 두 번째 경험으로 분리한다',async()=>{
  const src=await read('assets/v12-direct-home.js');
  const css=await read('assets/v14-companion-first.css');
  assert.ok(src.indexOf('<section class="n14-hero"')<src.indexOf('id="n14-place-browse"'));
  assert.ok(src.indexOf('n14-moments-grid')<src.indexOf('id="n14-place-browse"'));
  assert.match(src,/가고 싶은 곳은 있는데/);
  assert.match(src,/나의 동행 희망 남기기/);
  for(const type of Object.keys(COMPANION_INTERESTS)) assert.ok(src.includes('/companion.html?interest='+type));
  assert.match(src,/실제 연결·예약·결제는 아직 제공하지 않습니다/);
  assert.match(css,/\.n14-hero h1/);
  assert.match(css,/\.n14-moments-grid/);
  assert.match(css,/\.n14-places/);
  assert.doesNotMatch(src,/모집 중인 동행|매칭 완료/);
});

test('동행 허브는 활동 → 지역 → 실제 장소 → 2단계 설문으로 이어진다',async()=>{
  const page=await read('dist/companion.html');
  const script=await read('assets/v14-companion-hub.js');
  const app=await read('app.js');
  assert.match(page,/n14-hub-types/);
  assert.match(page,/n14-hub-region/);
  assert.match(page,/n14-hub-grid/);
  assert.match(page,/v14-companion-hub\.js\?v=20261124-v14/);
  assert.match(page,/수요 조사 단계/);
  assert.match(page,/현재 모임이 개설돼 있거나 참가자가 있다는 의미는 아닙니다/);
  assert.match(script,/companionPlaceMatches\(place,state\)/);
  assert.match(script,/data-companion-interest/);
  assert.match(app,/trackRhythm\('companion_interest'/);
  assert.match(app,/trackRhythm\('premium_willingness'/);
});

test('새 화면은 외부 유료 의존성 없이 4개 주요 페이지에서 최종 디자인을 직접 로드한다',async()=>{
  const home=await read('dist/index.html');
  const saved=await read('dist/saved.html');
  const detail=await read('scripts/build-core.js');
  const css=await read('assets/v14-companion-first.css');
  const pkg=JSON.parse(await read('package.json'));
  assert.match(home,/v14-companion-first\.css\?v=20261124-v14/);
  assert.match(saved,/v14-companion-first\.css\?v=20261124-v14/);
  assert.match(detail,/v14-companion-first\.css\?v=20261124-v14/);
  assert.match(home,/v12-direct-home\.js\?v=20261124-v14/);
  assert.ok(!('dependencies' in pkg));
  assert.doesNotMatch(css,/@import|https?:\/\//);
});
