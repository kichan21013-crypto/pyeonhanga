import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { recommendRhythms, emptyRhythmFilters, toggleSelection, activeActivities, companionSummary, unknownRoute, TRANSPORT_OPTIONS } from '../rhythm.js';
import { inferIntent } from '../search.js';
import { card } from '../ui.js';
import { validatePlaces } from '../scripts/validate-data.js';
const places = JSON.parse(await readFile(new URL('../data/places.json',import.meta.url)));
function sample(id, tags = ['walk']) {
  return {
    ...structuredClone(places[0]),
    id,
    slug:id,
    name:'DEMO SAMPLE 테스트 전용',
    isDemo:true,
    sourceName:'DEMO SAMPLE · 테스트 전용 가상 데이터',
    sourceUrl:null,
    lastVerifiedAt:null,
    intentTags:tags,
    companions:[],
    activityType:'unknown',
  };
}

test('동행 다중선택은 AND가 아니며 여러 선택과 맞는 결과를 먼저 추천한다', () => {
  const solo=sample('demo-solo'),friend=sample('demo-friend'),both=sample('demo-both'),unknown=sample('demo-unknown');
  solo.companions=['solo'];friend.companions=['friend'];both.companions=['solo','friend'];
  const results=recommendRhythms([unknown,solo,friend,both],{...emptyRhythmFilters(),companions:['solo','friend']});
  assert.equal(results[0].place.id,both.id);assert.equal(results[0].companionMatches,2);
  assert.ok(results.some(r=>r.place.id===solo.id));assert.ok(results.some(r=>r.place.id===friend.id));
  assert.equal(results.find(r=>r.place.id===unknown.id).companionMatches,0);
  assert.equal(companionSummary(['solo','friend']),'혼자 · 친구');
});
test('세부활동을 직접 고르면 해당 활동과 맞는 후보로 즉시 좁히고 다중선택은 OR로 유지한다', () => {
  const walk=sample('demo-walk',['walk']),food=sample('demo-food',['food']),both=sample('demo-multiple',['walk','food']);
  food.category='맛집';
  const f={...emptyRhythmFilters(),desires:['eat','move'],activities:['walk']};
  const results=recommendRhythms([walk,food,both],f);
  assert.equal(results[0].place.id,both.id);assert.equal(results.length,2);
  assert.ok(results.every(r=>r.selectedActivityMatches>0));
  assert.deepEqual(activeActivities(['move'],['walk','noodle']),['walk']);
  assert.deepEqual(toggleSelection(['move'],'move'),[]);

  const korean=sample('demo-korean',['korean_food']);korean.category='맛집';
  const noodle=sample('demo-noodle',['noodle']);noodle.category='맛집';
  const cafe=sample('demo-cafe',['cafe']);cafe.category='맛집';
  const foodResults=recommendRhythms([cafe,korean,noodle],{...emptyRhythmFilters(),desires:['eat'],activities:['korean_food','noodle']});
  assert.deepEqual(foodResults.map(r=>r.place.id).sort(),['demo-korean','demo-noodle']);
});
test('명시적으로 허용했을 때만 세부활동의 유사 추천을 제공한다', () => {
  const walk=sample('demo-walk-fallback',['walk']),food=sample('demo-food-fallback',['food']);
  food.category='맛집';
  const results=recommendRhythms([food,walk],{...emptyRhythmFilters(),desires:['move'],activities:['run'],allowActivityFallback:true});
  assert.equal(results.length,1);
  assert.equal(results[0].place.id,walk.id);
  assert.equal(results[0].selectedActivityMatches,0);
  assert.equal(results[0].activityMatches,0);
  assert.equal(results[0].desireMatches,1);
  assert.equal(results[0].fallbackActivity,true);
});
test('자연어와 선택한 칩을 함께 반영하고 복합 문장에서 거리·어미를 분리한다', () => {
  const query='혼자 10km 정도 뛰고 맛있는 거 먹고 싶어';
  const intent=inferIntent(query);assert.equal(intent.distanceKm,10);assert.deepEqual(intent.tokens,[]);
  assert.ok(intent.intents.includes('run'));assert.ok(intent.intents.includes('food'));
  const running=sample('demo-running',['run']),meal=sample('demo-meal',['food']);meal.category='맛집';
  const results=recommendRhythms([running,meal],{...emptyRhythmFilters(),query,desires:['move','eat'],activities:['run']});
  assert.equal(results.length,1);assert.equal(results[0].place.id,running.id);assert.ok(results.every(r=>r.plan.distanceKm==='unknown'));
  const compound=inferIntent('친구랑 드라이브하고 칼국수 먹고 싶어');assert.deepEqual(compound.tokens,[]);
  assert.ok(compound.intents.includes('drive'));assert.ok(compound.intents.includes('noodle'));
});
test('시간·이동·편안함은 확인 근거가 있을 때만 우선순위에 반영한다', () => {
  assert.deepEqual(Object.keys(TRANSPORT_OPTIONS),['car','transit','any']);
  const known=sample('demo-known'),unknown=sample('demo-unknown');
  known.visitContext={duration:'short',transportModes:['car'],sourceUrl:'https://example.org/demo-sample',verifiedAt:'2026-10-20'};
  const f={...emptyRhythmFilters(),duration:'short',transport:'car',comforts:['parking']};
  const results=recommendRhythms([unknown,known],f);assert.equal(results.length,2);assert.equal(results[0].place.id,known.id);
  assert.equal(results[0].conditionMatches,2);assert.equal(results[1].conditionMatches,0);
  assert.ok(recommendRhythms([known,unknown],{...f,transport:'nearby',duration:'any'}).every(r=>r.conditionMatches===0));
});
test('추천은 입력 장소 하나만 참조하며 코스·이동시간·거리를 생성하지 않는다', () => {
  const demo=[sample('demo-route-a',['walk']),sample('demo-route-b',['food'])];
  demo[1].category='맛집';
  for (const result of recommendRhythms(demo)) {
    assert.equal(result.plan.stops.length,1);assert.equal(result.plan.stops[0].placeId,result.place.id);
    assert.deepEqual(result.plan.transfers,[]);assert.equal(result.plan.duration,'unknown');assert.equal(result.plan.distanceKm,'unknown');
    assert.equal(result.plan.isDemo,true);
    const html=card(result.place,false,emptyRhythmFilters(),result);
    assert.match(html,/DEMO SAMPLE/);assert.match(html,/data-share=/);assert.match(html,/data-companion-interest=/);
    assert.match(html,/동행이 있으면 좋겠어요/);assert.match(html,/장소 자세히 보기/);assert.ok(!html.includes('relevance'));
  }
});
test('러닝 확장 정보는 unknown이며 실제 거리·순환 여부에는 출처와 확인일을 요구한다', () => {
  const p=sample('demo-route');assert.equal(validatePlaces([p]),true);
  assert.equal(p.activityType,'unknown');assert.deepEqual(p.route,unknownRoute());
  p.route.distanceKm=8;assert.throws(()=>validatePlaces([p]),/코스 정보/);
  p.route.sourceUrl='https://example.org/demo-sample';p.route.verifiedAt='2026-10-20';p.route.loop=true;
  assert.equal(validatePlaces([p]),true);
});
test('검증 기간의 모든 HTML과 응답 헤더가 noindex,nofollow이고 나가치 브랜드·정확한 저장 명칭을 사용한다', async () => {
  async function inspect(url) {
    for (const entry of await readdir(url,{withFileTypes:true})) {
      const next=new URL(entry.name+(entry.isDirectory()?'/':''),url);
      if(entry.isDirectory())await inspect(next);
      else if(entry.name.endsWith('.html')) { const html=await readFile(next,'utf8');assert.match(html,/<meta name="robots" content="noindex,nofollow">/);assert.ok(!html.includes('편한가?'));assert.match(html,/<title>[^<]*나가치[^<]*<\/title>/);assert.match(html,/<meta property="og:site_name" content="나가치">/);assert.match(html,/aria-label="나가치 홈"/);assert.match(html,/>나가치<\/a>/);assert.ok(!html.includes('저장한 리듬'));assert.match(html,/저장한 곳/); }
    }
  }
  await inspect(new URL('../dist/',import.meta.url));
  const home=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  assert.deepEqual([...home.matchAll(/data-transport="([^"]+)"/g)].map(match=>match[1]),['car','transit','any']);
  assert.ok(home.includes('오늘 내 리듬 찾기')&&home.includes('오늘의 리듬'));
  const about=await readFile(new URL('../dist/about.html',import.meta.url),'utf8');assert.ok(about.includes('‘내리듬’은 내 상황과 취향에 맞춘 추천'));
  assert.match(await readFile(new URL('../dist/_headers',import.meta.url),'utf8'),/X-Robots-Tag: noindex, nofollow/);
  assert.ok(!(await readFile(new URL('../dist/sitemap.xml',import.meta.url),'utf8')).includes('<url>'));
});


test('세부활동 정확한 후보가 없을 때만 유사 추천을 명확히 표시한다', () => {
  const general=sample('demo-general-food',['food']);general.category='맛집';
  const exact=sample('demo-exact-meat',['meat']);exact.category='맛집';
  const f={...emptyRhythmFilters(),desires:['eat'],activities:['meat'],region:general.region};
  const exactResults=recommendRhythms([general,exact],f);
  assert.deepEqual(exactResults.map(x=>x.place.id),['demo-exact-meat']);
  assert.equal(exactResults[0].fallbackActivity,false);
  assert.match(card(exactResults[0].place,false,f,exactResults[0]),/오늘의 리듬 · 고기/);
  assert.equal(recommendRhythms([general],f).length,0, '고기 선택시 일반 식사를 자동 추천하지 않는다');
  const similarResults=recommendRhythms([general],{...f,allowActivityFallback:true});
  assert.equal(similarResults.length,1);
  assert.equal(similarResults[0].selectedActivityMatches,0);
  assert.equal(similarResults[0].fallbackActivity,true);
  const html=card(similarResults[0].place,false,f,similarResults[0]);
  assert.match(html,/유사 추천 · 식사/);
  assert.ok(!html.includes('오늘의 리듬 · 식사'));
});


test('해산물 선택에 카페와 일반 음식점이 섞이지 않으며 다중 선택은 OR로 작동한다', () => {
  const seafood = sample('demo-seafood',['seafood']); seafood.category='맛집';
  const cafe = sample('demo-cafe',['cafe']); cafe.category='맛집';
  const food = sample('demo-food',['food']); food.category='맛집';
  const f = { ...emptyRhythmFilters(), desires:['eat'], activities:['seafood'], region:food.region };
  assert.deepEqual(recommendRhythms([cafe,food],f), []);
  assert.deepEqual(recommendRhythms([cafe,food,seafood],f).map(x=>x.place.id),['demo-seafood']);
  assert.deepEqual(recommendRhythms([seafood,cafe,food],{...f,activities:['seafood','cafe']}).map(x=>x.place.id).sort(), ['demo-cafe','demo-seafood']);
  assert.ok(recommendRhythms([cafe,food],{...f,allowActivityFallback:true}).every(x=>x.fallbackActivity));
});


test('해산물 대안에는 카페가 섞이지 않으며 실제 업종명으로 정직하게 표시한다', () => {
  const cafe = sample('cafe-alternative',['food','cafe']); cafe.category='맛집'; cafe.name='설문커피';
  const noodles = sample('noodle-alternative',['food','noodle']); noodles.category='맛집'; noodles.name='바지락칼국수';
  const f = {...emptyRhythmFilters(), desires:['eat'],activities:['seafood'],allowActivityFallback:true};
  const results = recommendRhythms([cafe,noodles],f);
  assert.deepEqual(results.map(result=>result.place.id),['noodle-alternative']);
  assert.equal(results[0].fallbackActivity,true);
  assert.equal(results[0].activityType,'noodle');
  assert.match(card(results[0].place,false,f,results[0]),/유사 추천 · 면요리/);
  assert.equal(recommendRhythms([cafe],f).length,0);
  const exact = sample('seafood-candidate',['food','seafood']); exact.category='맛집';
  assert.deepEqual(recommendRhythms([cafe,noodles,exact],f).map(result=>result.place.id),['seafood-candidate']);
});
