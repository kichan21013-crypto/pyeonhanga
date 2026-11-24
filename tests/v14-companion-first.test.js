import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TOGETHER_INVITES, TOGETHER_REGIONS, MEAL_TAGS, invitationById,
  togetherPlaceMatches, cleanTogetherRegion, cleanMealTag } from '../assets/v16-together-model.js';
import { PROGRAMS, programById } from '../assets/v15-programs.js';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('동행 모집 문구는 50+가 자연스럽게 누를 4가지 질문으로 구성한다',()=>{
  assert.deepEqual(TOGETHER_INVITES.map(x=>x.id),['eat','hike','outing','travel']);
  assert.ok(TOGETHER_INVITES.every(x=>x.label.includes('사람?')));
  assert.equal(invitationById('eat').label,'같이 맛있는 거 먹으러 갈 사람?');
  assert.equal(invitationById('invalid'),null);
  assert.equal(cleanTogetherRegion('경기'),'경기');
  assert.equal(cleanTogetherRegion('경기/서울'),'');
  assert.equal(cleanMealTag('seafood'),'seafood');
  assert.equal(cleanMealTag('fake'),'');
  assert.deepEqual(TOGETHER_REGIONS,['서울','경기','강릉','경주','부산','제주']);
  assert.equal(MEAL_TAGS.length,5);
});

test('실제 636곳 가운데 음식 종류·지역이 정확히 일치하는 곳만 보여준다',async()=>{
  const places=JSON.parse(await read('dist/data/places.json'));
  const results=places.filter(p=>togetherPlaceMatches(p,{interest:'eat',region:'경기',mealTag:'seafood'}));
  assert.ok(results.length>=8,'경기 회·해산물 공식 데이터는 최소 8곳');
  assert.ok(results.every(p=>p.region==='경기' && p.category==='맛집'));
  assert.ok(results.every(p=>(p.intentTags||[]).includes('seafood')));
  assert.ok(results.every(p=>p.isDemo!==true && /^https:\/\//.test(p.image)));
  assert.equal(togetherPlaceMatches({...results[0],isDemo:true},{interest:'eat'}),false);
  assert.equal(togetherPlaceMatches({...results[0],image:'data:fake'},{interest:'eat'}),false);
  assert.equal(togetherPlaceMatches(results[0],{interest:'hike'}),false);
});

test('산책·카페는 구분된 실제 출처를 보여주며 산행에 일반 음식점을 섞지 않는다',async()=>{
  const places=JSON.parse(await read('dist/data/places.json'));
  const outing=places.filter(p=>togetherPlaceMatches(p,{interest:'outing'}));
  assert.ok(outing.length>0);
  assert.ok(outing.every(p=>(p.intentTags||[]).includes('cafe') ||
    (['나들이','여행'].includes(p.category) &&
     (p.intentTags||[]).some(t=>['walk','outing','culture','scenery'].includes(t)))));
  const hike=places.filter(p=>togetherPlaceMatches(p,{interest:'hike'}));
  assert.ok(hike.every(p=>(p.intentTags||[]).some(t=>['hike','trail'].includes(t))));
  const travel=places.filter(p=>togetherPlaceMatches(p,{interest:'travel'}));
  assert.ok(travel.length>0);
  assert.ok(travel.every(p=>p.category==='여행' || (p.intentTags||[]).some(t=>['drive','travel'].includes(t))));
});

test('첫 화면에서 자연스러운 질문을 클릭하면 지역·메뉴·실제 장소를 제시한다',async()=>{
  const home=await read('assets/v12-direct-home.js');
  const flow=await read('assets/v16-together.js');
  const css=await read('assets/v16-together.css');
  assert.match(home,/n16-invites/);
  assert.match(home,/n16-journey/);
  assert.match(home,/n16-meals/);
  assert.match(home,/취향으로 만나는 동행/);
  assert.ok(home.indexOf('n16-invites') < home.indexOf('n15-place-drawer'));
  assert.match(home,/setupTogetherJourney\(\{home,loadPlaces:loadCatalog\}\)/);
  assert.match(flow,/togetherPlaceMatches\(place,state\)/);
  assert.match(flow,/data-companion-interest/);
  assert.match(flow,/여기, 같이 가보고 싶어요/);
  assert.match(flow,/trackRhythm\('activity_selected'/);
  assert.match(flow,/data-v16-retry/);
  assert.match(flow,/aria-busy/);
  assert.match(css,/\.n16-venue-grid/);
  assert.match(css,/\.n16-invite\[aria-pressed=true\]/);
  assert.match(css,/prefers-reduced-motion/);
});

test('동행 전용 메뉴는 사람을 먼저 모집하지 않고 동일한 실제 장소 선택으로 연결한다',async()=>{
  const page=await read('dist/companion.html');
  const build=await read('scripts/build-core.js');
  assert.match(page,/같이 맛있는 거 먹으러 갈 사람\?/);
  assert.match(page,/\/\?together=eat/);
  assert.match(page,/\/\?together=hike/);
  assert.match(page,/\/\?together=outing/);
  assert.match(page,/\/\?together=travel/);
  assert.match(page,/관심사가 비슷한 사람들/);
  assert.match(page,/아직 실제 동행 모집·예약·결제는 제공하지 않아요/);
  assert.doesNotMatch(page,/data-program-interest=|data-companion-interest=|data-n14-interest=/);
  assert.match(build,/TOGETHER_INVITES/);
  assert.doesNotMatch(build,/v14-companion-hub\.js\?v=20261124-v29/);
});

test('익명 동행 설문은 장소 이름·취향·동행 구성·서비스비 의향을 수집한다',async()=>{
  const app=await read('app.js');
  const analytics=await read('analytics.js');
  const schema=await read('supabase/schema.sql');
  assert.match(app,/data-companion-interest/);
  assert.match(app,/companionDialog\(p,interest\)/);
  assert.match(app,/GROUP_ACTIVITIES\.map/);
  assert.match(app,/어떤 분들이 편하세요\?/);
  assert.match(app,/name="consent" value="yes" required/);
  assert.match(app,/chosenActivities\(\)/);
  assert.match(app,/recordConsentedSurvey/);
  assert.match(app,/await recordConsentedSurvey/);
  assert.match(app,/선택한 내용은 아직 저장되지 않았습니다/);
  assert.match(analytics,/if \(!analyticsEnabled \|\| !EVENTS\.includes\(event\)\) return false/);
  assert.match(schema,/place_id text check/);
  assert.ok(!/동행 신청 완료|매칭 성공|잔여석 [0-9]+/.test(app));
});

test('차량 유상 연결·여행업 운영·개인정보 위험을 소비자에게 오인시키지 않는다',async()=>{
  const homepage=await read('assets/v12-direct-home.js');
  const page=await read('dist/companion.html');
  assert.match(homepage,/관심을 남기면 나가치가 모임을 제안해요/);
  assert.match(homepage,/현재는 무료 수요 검증을 진행하며 유료 모집·차량 연결은 제공하지 않습니다/);
  assert.match(homepage,/좋은 하루는, 마음 맞는 사람과 함께/);
  assert.match(page,/유료 여행상품·차량 배차·유상 자가용 운송 알선은 제공하지 않습니다/);
  assert.match(page,/이름·연락처는 받지 않습니다/);
  assert.doesNotMatch(page,/지금 예약|참가비 결제|남은 자리/);
});

test('코스 제안과 모임 구성의 미래 수익모델은 분리하고 계속 무료 스택만 쓴다',async()=>{
  const home=await read('assets/v12-direct-home.js');
  const index=await read('dist/index.html');
  const saved=await read('dist/saved.html');
  const pkg=JSON.parse(await read('package.json'));
  const css=await read('assets/v16-together.css');
  assert.match(home,/코스 제안과 동행 구성·일정 조율 서비스비/);
  assert.match(home,/식비·교통비·입장료/);
  assert.match(index,/v16-together\.css\?v=20261124-v29/);
  assert.match(index,/v12-direct-home\.js\?v=20261124-v29/);
  assert.match(saved,/mobile-ux\.css\?v=20261124-v29/);
  assert.ok(!('dependencies' in pkg));
  assert.doesNotMatch(css,/@import|https?:\/\//);
  assert.equal(PROGRAMS.length,4);
  assert.ok(PROGRAMS.every(p=>!('price' in p)&&!('date' in p)&&!('availableSeats' in p)));
  assert.equal(programById('program-food')?.interest,'eat');
});
