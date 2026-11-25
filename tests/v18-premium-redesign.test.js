import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SURVEY_CHOICES } from '../actions.js';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('홈은 승인된 카테고리 이미지와 기존 카테고리 클릭 동작을 보존한다',async()=>{
 const src=await read('assets/v12-direct-home.js');
 const css=await read('assets/v18-premium.css');
 const home=await read('dist/index.html');
 for(const name of ['food','eat','hike','cafe','outing','travel','hero']){
   const svg=await read('assets/v18-'+name+'.svg');
   assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
   assert.match(svg,/viewBox="0 0 480 340"|viewBox="0 0 780 490"/);
   assert.doesNotMatch(svg,/href="https?:|<script|<foreignObject/i);
 }
 assert.match(src,/n19-photo-mosaic/);
 assert.match(src,/n19-photo-main/);
 assert.match(src,/src="\/assets\/v28-'\+id\+'\.webp"/);
 assert.match(src,/data-v16-invite/);
 assert.match(src,/setupTogetherJourney\(\{home,loadPlaces:loadCatalog\}\)/);
 assert.match(css,/\.n18-hero-art/);
 assert.match(css,/\.n16-invite\[aria-pressed=true\]/);
 assert.match(home,/v18-premium\.css\?v=20261125-v44/);
});

test('선호도는 dropdown이 아닌 터치 가능한 원래 라디오 카드로 입력한다',async()=>{
 const app=await read('app.js');
 const css=await read('assets/v18-premium.css');
 assert.match(app,/class="n18-option"/);
 assert.match(app,/input type="radio"/);
 assert.match(app,/data-n13-step="1"/);
 assert.match(app,/data-n13-step="2"/);
 assert.match(app,/data-n13-next/);
 assert.match(app,/data-n13-back/);
 assert.match(app,/form\.reportValidity\(\)/);
 assert.match(app,/form\.elements\.consent\.checked/);
 assert.match(app,/recordConsentedSurvey/);
 assert.match(css,/n18-option:has\(input:checked\)/);
 assert.match(css,/n18-option:has\(input:focus-visible\)/);
 assert.match(css,/max-height:min\(91dvh,850px\)/);
 assert.doesNotMatch(app,/name="age"[^>]*<select/);
});

test('40대 연령 선택도 설문·이벤트 필터·Supabase 서버 검증에 동일 적용한다',async()=>{
 const age=SURVEY_CHOICES.age;
 const analytics=await read('analytics.js');
 const schema=await read('supabase/schema.sql');
 assert.deepEqual(age,['40~44','45~49','50~54','55~59','60~64','65~69','70+']);
 for (const choice of age) {
   assert.ok(analytics.includes("'"+choice+"'"),choice+' client');
   assert.ok(schema.includes("'"+choice+"'"),choice+' server');
 }
 assert.match(schema,/d \? 'age'/);
});

test('서비스 화면에서 결혼 관련 포지셔닝 문구를 전부 제거한다',async()=>{
 const paths=['assets/v12-direct-home.js','app.js','scripts/build-core.js','index.html','ui.js'];
 for (const path of paths) {
   const source=await read(path);
   assert.doesNotMatch(source,/결혼|혼인|데이트도 괜찮음|새로운 이성도 괜찮음/,path);
 }
 const companion=await read('dist/companion.html');
 const detail=await read('ui.js');
 assert.doesNotMatch(companion,/결혼|혼인/);
 assert.match(detail,/여기, 같이 가보고 싶어요/);
 assert.match(companion,/이름·연락처는 받지 않습니다/);
});

test('실제 장소 정보·개인정보 동의·무료 운영을 유지한다',async()=>{
 const pkg=JSON.parse(await read('package.json'));
 const published=JSON.parse(await read('dist/data/places.json'));
 const home=await read('assets/v12-direct-home.js');
 const css=await read('assets/v18-premium.css');
 const browser=await read('tests/browser-smoke.mjs');
 assert.equal(published.length,636);
 assert.ok(published.every(p=>!p.isDemo&&p.sourceUrl));
 assert.match(home,/여기, 같이 가보고 싶어요/);
 assert.match(home,/식비·교통비·입장료/);
 assert.match(browser,/\[name=age\]\[value="45~49"\]/);
 assert.match(browser,/rows\.length===0/);
 assert.ok(!('dependencies' in pkg));
 assert.doesNotMatch(css,/@import|https?:\/\//);
});

test('모든 페이지의 실제 빌드 자산 URL이 v19로 버전 갱신된다',async()=>{
 const home=await read('dist/index.html');
 const companion=await read('dist/companion.html');
 const saved=await read('dist/saved.html');
 const core=await read('scripts/build-core.js');
 const build=await read('scripts/build.js');
 for(const page of [home,companion,saved]) assert.match(page,/v18-premium\.css\?v=20261125-v44/);
 assert.match(home,/v12-direct-home\.js\?v=20261125-v47/);
 assert.match(companion,/app\.js\?v=20261125-v44/);
 assert.match(build,/const CLIENT_VERSION = '20261125-v44'/);
 assert.match(core,/20261125-v44/);
});
