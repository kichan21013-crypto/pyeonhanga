import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PROGRAMS, programById, programContext } from '../assets/v15-programs.js';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('4개 파티 프로그램은 소개팅·실제 모집상품이 아닌 취미별 기획안이다',()=>{
 assert.equal(PROGRAMS.length,4);
 assert.deepEqual(PROGRAMS.map(p=>p.id),['program-food','program-hike','program-outing','program-travel']);
 for(const plan of PROGRAMS){
   assert.ok(plan.id.startsWith('program-'));
   assert.ok(plan.title && plan.summary && plan.outline.length>=3);
   assert.ok(!('price' in plan)&&!('availableSeats' in plan)&&!('date' in plan));
   assert.ok(!/데이트|결혼|연애|즉시 모집/.test(plan.title+plan.summary));
   assert.match(plan.transport,/이동|교통/);
   const event=programContext(plan);
   assert.equal(event.id,plan.id);
   assert.equal(event.region,null);
   assert.equal(event.category,null);
   assert.equal(event.isDemo,false);
   assert.equal(programById(plan.id),plan);
 }
 assert.equal(programById('missing'),null);
});

test('홈의 첫 상품은 파티 프로그램이며 장소 탐색은 접힌 보조 메뉴이다',async()=>{
 const src=await read('assets/v12-direct-home.js');
 const css=await read('assets/v15-party-program.css');
 assert.match(src,/PROGRAMS\.map/);
 assert.match(src,/NAGACHI · 50\+ 취향 동행 프로그램/);
 assert.match(src,/아직, 함께 놀/);
 assert.match(src,/파티원 구성을 돕습니다/);
 assert.ok(src.indexOf('n15-program-grid')<src.indexOf('n15-place-drawer'));
 assert.match(src,/data-program-interest/);
 assert.match(src,/기획안 · 참여 희망 조사/);
 assert.match(src,/실제 요금·일정은 아직 확정되지 않았습니다/);
 assert.match(src,/결혼 여부를 묻지 않고/);
 assert.match(css,/n15-program-grid/);
 assert.match(css,/\.n15-place-drawer/);
 assert.match(css,/\.n12-results\{display:none!important/);
 assert.match(src,/placeDrawer\?\.addEventListener\('toggle'/);
 assert.match(src,/n15-browse-open/);
});

test('별도 동행 페이지에서 실제 모집·참가인원이나 매칭을 허위로 표시하지 않는다',async()=>{
 const page=await read('dist/companion.html');
 const html=await read('dist/index.html');
 const build=await read('scripts/build-core.js');
 assert.match(page,/같은 취향이라면/);
 assert.match(page,/data-program-interest/);
 assert.equal((page.match(/class="n15-program-card"/g)||[]).length,4);
 assert.match(page,/실제 모임이 아닌 사업 검증용 기획안입니다/);
 assert.match(page,/식사·카페·교통·입장료는 이용처에 각자 직접 결제/);
 assert.match(page,/사생활/);
 assert.doesNotMatch(page,/data-companion-interest=|data-n14-interest=|n14-hub-grid/);
 assert.match(html,/v15-party-program\.css\?v=20261124-v15/);
 assert.match(html,/v12-direct-home\.js\?v=20261124-v15/);
 assert.match(build,/v15-programs\.js/);
 assert.doesNotMatch(build,/v14-companion-hub\.js\?v=20261124-v15/);
});

test('프로그램 수요는 기존 검증된 설문 수집 경로에 임시 분리 식별자로 보관한다',async()=>{
 const app=await read('app.js');
 const analytics=await read('analytics.js');
 const sql=await read('supabase/schema.sql');
 assert.match(app,/programById\(planButton\.dataset\.programInterest\)/);
 assert.match(app,/companionDialog\(programContext\(program\),planButton,program\)/);
 assert.match(app,/form\.elements\.purpose\.value = program\.purpose/);
 assert.match(app,/hike:'hike'/);
 assert.match(app,/premium_willingness/);
 assert.match(analytics,/premium_willingness/);
 assert.match(sql,/place_id text check/);
 assert.match(sql,/premium_willingness/);
 assert.doesNotMatch(app,/데이트도 괜찮음|새로운 이성도 괜찮음/);
 assert.match(app,/실제 사람 연결/);
});

test('개인별 현장 결제와 합법적 이동 및 개인정보 최소수집 경계',async()=>{
 const home=await read('assets/v12-direct-home.js');
 const page=await read('dist/companion.html');
 const styles=await read('assets/v15-party-program.css');
 const pkg=JSON.parse(await read('package.json'));
 assert.match(home,/식비·카페비·교통비·입장료/);
 assert.match(page,/자가용 유상 운송을 주선하지 않으며/);
 assert.match(page,/결혼 여부는 참여 기준이 아니며 공개를 요구하지 않습니다/);
 assert.match(home,/결혼 여부를 묻지 않고/);
 assert.doesNotMatch(styles,/@import|fonts\.googleapis|https?:\/\//);
 assert.ok(!('dependencies' in pkg),'유료 SDK 없이 공공 장소 데이터·자체 CSS 재사용');
});
