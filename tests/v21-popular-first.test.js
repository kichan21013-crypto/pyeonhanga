import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {normalizePopularPlaces,rankPopularActivities,choosePopularView,POPULAR_ACTIVITIES} from '../assets/v21-popular-model.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const catalog=[
 {id:'food-1',name:'도일처',image:'https://images.example/cafe.jpg',region:'서울',category:'맛집',isDemo:false},
 {id:'walk-1',name:'서대문독립공원',image:'https://images.example/walk.jpg',region:'서울',category:'나들이',isDemo:false},
 {id:'demo',name:'모형',image:'https://images.example/demo.jpg',isDemo:true},
 {id:'bad',name:'사진 미확인',image:'/assets/garden.svg',isDemo:false},
];
test('인기는 실제 동의·저장 관심 5건 이상만 사용하며 인원과 장소를 꾸며내지 않는다',()=>{
 const rows=[
  {place_id:'food-1',activity:'food',interested_count:7},
  {place_id:'walk-1',activity:'outing',interested_count:'12'},
  {place_id:'food-1',activity:'outing',interested_count:8},
  {place_id:'walk-1',activity:'food',interested_count:4},
  {place_id:'demo',activity:'food',interested_count:90},
  {place_id:'bad',activity:'food',interested_count:90},
  {place_id:'unknown',activity:'food',interested_count:100},
  {place_id:'food-1',activity:'dating',interested_count:55},
 ];
 const top=normalizePopularPlaces(rows,catalog);
 assert.equal(top.length,2);
 assert.equal(top[0].place.id,'walk-1');
 assert.equal(top[0].interestedCount,12);
 assert.equal(top[1].place.id,'food-1');
 assert.equal(top[1].interestedCount,8);
 assert.deepEqual(normalizePopularPlaces(null,catalog),[]);
 assert.deepEqual(normalizePopularPlaces(rows,null),[]);
});
test('특정 인기 장소가 없어도 활동별 실제 응답으로 정렬하고 없으면 탐색으로 돌아간다',()=>{
 const activity=rankPopularActivities({food:7,hike:14,outing:4,travel:5});
 assert.deepEqual(activity.map(x=>x.id),['hike','food','travel']);
 assert.deepEqual(activity.map(x=>x.interestedCount),[14,7,5]);
 assert.equal(choosePopularView({places:[],activities:activity}),'activities');
 assert.equal(choosePopularView({places:[{id:'p'}],activities:activity}),'places');
 assert.equal(choosePopularView({places:[],activities:[]}),'discovery');
 assert.equal(POPULAR_ACTIVITIES.length,4);
});
test('실제 홈페이지는 짧은 히어로 직후 인기 동행 → 4개 활동 → 실제 장소 순서다',async()=>{
 const home=await read('assets/v12-direct-home.js');
 const ui=await read('assets/v21-popular-first.js');
 const css=await read('assets/v21-popular-first.css');
 assert.ok(home.indexOf('n21-hero')<home.indexOf('n21-popular" id="n21-popular"'));
 assert.ok(home.indexOf('n21-popular" id="n21-popular"')<home.indexOf('n16-invites-section'));
 assert.match(home,/좋은 하루,<br><em>같이 갈 사람\?/);
 assert.match(home,/href="#n21-popular"/);
 assert.match(home,/setupPopularFirst\(\{home,loadPlaces:loadCatalog,scrollToInvites\}\)/);
 assert.match(home,/scrollToPopular/);
 assert.match(ui,/fetchPopularCompanionPlaces\(\)/);
 assert.match(ui,/fetchPublicInterestCounts\(\)/);
 assert.match(ui,/normalizePopularPlaces/);
 assert.match(ui,/rankPopularActivities/);
 assert.match(ui,/data-n21-activity/);
 assert.match(ui,/data-companion-interest/);
 assert.match(ui,/button\.click\(\)/);
 assert.match(ui,/첫 번째 동행을 찾아볼까요\?/);
 assert.match(ui,/아직 관심 데이터 연결을 준비하고 있어요/);
 assert.match(css,/min-height:298px!important/);
 assert.match(css,/n21-popular-rail/);
});
test('인기 표시의 근거는 최근 90일 실제 설문, 5개 이상 서로 다른 브라우저이며 실제 모임과 구분한다',async()=>{
 const sql=await read('supabase/popular-companion.sql');
 const ui=await read('assets/v21-popular-first.js');
 const client=await read('assets/v19-companion-service.js');
 assert.match(sql,/e\.event_name='premium_willingness'/);
 assert.match(sql,/e\.is_demo=false/);
 assert.match(sql,/interval '90 days'/);
 assert.match(sql,/count\(distinct i\.session_id\)>=5/);
 assert.match(sql,/limit 12/);
 assert.match(sql,/grant execute on function public\.nagachi_public_popular_places\(\) to anon/);
 assert.doesNotMatch(sql,/returns table\([^)]*(session_id|age|willingness|email)/i);
 assert.match(client,/companionRpc\('nagachi_public_popular_places'\)/);
 assert.match(ui,/실제 참가 확정이나 현재 모집 중인 모임은 아닙니다/);
 assert.match(ui,/동의·저장된 관심/);
 assert.doesNotMatch(ui,/(가상 인원|Math\.random\(\)|하트 수 999|모집 확정된 모임)/);
});
test('실제 빌드 버전 v21을 모든 페이지에 적용하고 기존 장소 탐색·동의 UI 유지',async()=>{
 const [index,companion,saved,core,build]=await Promise.all([
  read('dist/index.html'),read('dist/companion.html'),read('dist/saved.html'),
  read('scripts/build-core.js'),read('scripts/build.js')
 ]);
 for(const page of [index,companion,saved])assert.match(page,/v21-popular-first\.css\?v=20261124-v28/);
 assert.match(index,/v12-direct-home\.js\?v=20261124-v28/);
 assert.match(core,/href="\/#n21-popular"/);
 assert.match(build,/const CLIENT_VERSION = '20261124-v28'/);
 assert.match(index,/id="main"/);
 const home=await read('assets/v12-direct-home.js');
 assert.match(home,/n14-place-browse/);
 assert.match(home,/setupGroupExperience\(home\)/);
});
test('새 브라우저 모듈과 SQL 외 추가 npm 의존성 없이 동작',async()=>{
 for(const file of ['assets/v21-popular-first.js','assets/v21-popular-model.js',
    'assets/v19-companion-service.js','assets/v12-direct-home.js']){
  const proc=spawnSync(process.execPath,['--check',fileURLToPath(new URL('../'+file,import.meta.url))],{encoding:'utf8'});
  assert.equal(proc.status,0,file+proc.stderr);
 }
 const pkg=JSON.parse(await read('package.json'));
 assert.ok(!('dependencies' in pkg));
 assert.ok(!('devDependencies' in pkg));
});
