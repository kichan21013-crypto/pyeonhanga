import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {operatorMarkup} from '../assets/v22-admin-markup.js';
import {estimateRevenue,cleanCoursePlaceIds,sanitizePublicCourses} from '../assets/v22-operations-model.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('운영자만 로그인하는 별도 모바일 스튜디오에 4개 실제 관리 메뉴와 폼이 있다',()=>{
 const html=operatorMarkup();
 for(const name of ['운영 현황','코스 만들기','동행 모임','수익 계획'])
   assert.ok(html.includes(name),name);
 for(const id of ['n19-admin-login','n19-admin-panel','n22-course-form','n22-meetup-form',
  'n22-revenue-form','n22-course-list','n22-meetup-list','n22-revenue-list',
  'n22-place-query','n19-admin-notice-form','n19-admin-notices','n22-load-status'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/id="n19-admin-panel" hidden/);
 assert.match(html,/name="publish"/);
 assert.match(html,/무료 시범 동행의 기기별 참가 신청과 승인을 관리합니다/);
 assert.doesNotMatch(html,/(service_role|sb_secret_|관리자 비밀번호:\s*\S+@)/);
});

test('새 코스는 실제 관광공사 장소를 최대 5개 순서대로만 고를 수 있다',()=>{
 const allowed=new Set(['a','b','c','d','e','f']);
 assert.deepEqual(cleanCoursePlaceIds(['a','b','b','bad','c','d','e','f'],allowed),['a','b','c','d','e']);
 assert.deepEqual(cleanCoursePlaceIds(null,allowed),[]);
});

test('수익관리 예상치 계산은 실제 결제/매출이 아닌 가정이며 비용 차감이 가능하다',()=>{
 const sample={service_fee_krw:10000,expected_people:4,meetings_per_month:4,
  paid_conversion_pct:25,cost_per_meeting_krw:2000};
 assert.deepEqual(estimateRevenue(sample),{
  expectedPaying:4,expectedRevenue:40000,estimatedCosts:8000,estimateAfterCosts:32000
 });
 assert.equal(estimateRevenue({...sample,paid_conversion_pct:101}),null);
 assert.equal(estimateRevenue({...sample,service_fee_krw:-1}),null);
 assert.equal(estimateRevenue({}),null);
});

test('보통 이용자에게는 게시한 코스의 검증된 실제 장소만 보여 준다',()=>{
 const good={id:'p1',name:'강변공원',category:'나들이',region:'서울',image:'https://example.com/real.jpg',isDemo:false};
 const demo={id:'demo',name:'테스트 공원',isDemo:true};
 const course={id:1,title:'강변 산책',activity:'outing',description:'편안히 산책하는 하루',
  region:'서울',place_ids:['p1','demo','gone'],duration:'반나절'};
 const rows=sanitizePublicCourses([course,{...course,id:2,place_ids:['gone']},
   {...course,id:3,activity:'dating'}],[good,demo]);
 assert.equal(rows.length,1);
 assert.deepEqual(rows[0].places.map(p=>p.id),['p1']);
});

test('서버 권한은 UI 숨김이 아니라 Auth + DB 허용 목록으로 제한한다',async()=>{
 const sql=await read('supabase/operations-studio.sql');
 const admin=await read('assets/v22-operations-admin.js');
 for(const table of ['nagachi_curated_courses','nagachi_operated_meetups','nagachi_revenue_scenarios']){
  assert.match(sql,new RegExp('alter table public\\.'+table+' enable row level security'));
  assert.match(sql,new RegExp('revoke all on public\\.'+table+' from public,anon,authenticated'));
 }
 for(const fn of ['nagachi_admin_operations','nagachi_admin_save_course','nagachi_admin_save_meetup','nagachi_admin_save_pricing']){
  assert.match(sql,new RegExp('function public\\.'+fn+'\\('));
  assert.match(sql,new RegExp('grant execute on function public\\.'+fn+'.*to authenticated','s'));
  assert.doesNotMatch(sql,new RegExp('grant execute on function public\\.'+fn+'.*to anon','s'));
 }
 assert.ok((sql.match(/auth\.uid\(\) is null or not exists/g)||[]).length>=4);
 assert.match(sql,/nagachi_companion_admins/);
 assert.match(admin,/getToken/);
 assert.match(admin,/companionRpc\('nagachi_admin_operations',\{\},jwt\)/);
 assert.doesNotMatch(admin,/localStorage|sessionStorage|service_role|sb_secret_/);
});

test('일반 공개 영역에서 관리자 ID/정확한 만남장소/수익비용은 서버에서 내려주지 않는다',async()=>{
 const sql=await read('supabase/operations-studio.sql');
 const publicUi=await read('assets/v22-public-programs.js');
 const body=sql.slice(sql.indexOf('create or replace function public.nagachi_public_meetups()'),
  sql.indexOf('revoke all on function public.nagachi_public_meetups()'));
 assert.match(body,/m\.stage='announced'/);
 assert.doesNotMatch(body,/m\.meet_place|m\.created_by|service_fee_krw/);
 const publicCourse=sql.slice(sql.indexOf('create or replace function public.nagachi_public_courses()'),
  sql.indexOf('revoke all on function public.nagachi_public_courses()'));
 assert.match(publicCourse,/c\.status='published'/);
 assert.doesNotMatch(publicCourse,/c\.created_by|c\.note|service_fee_krw/);
 assert.match(publicUi,/setupPublicPrograms/);
 assert.match(publicUi,/운영자가 실제로 게시한/);
 assert.match(publicUi,/아직 실제 참가 예약은 아닙니다|실제 참가 확정 아님/);
 assert.doesNotMatch(publicUi,/Math\.random\(\)|잔여 좌석|지금 결제|참가 확정되었습니다/);
});

test('빌드한 실제 admin.html은 검색 제외·비로그인 차단·운영자 스튜디오를 제공한다',async()=>{
 const [page,home,build,core]=await Promise.all([
  read('dist/admin.html'),read('dist/index.html'),read('scripts/build.js'),read('scripts/build-core.js')
 ]);
 assert.match(page,/noindex,nofollow/);
 assert.match(page,/id="n19-admin-panel" hidden/);
 assert.match(page,/id="n22-course-form"/);
 assert.match(page,/id="n22-meetup-form"/);
 assert.match(page,/id="n22-revenue-form"/);
 assert.match(page,/v22-admin-studio\.css\?v=20261124-v25/);
 assert.match(page,/v19-admin\.js\?v=20261124-v25/);
 assert.match(home,/v22-public-programs\.css\?v=20261124-v25/);
 assert.match(build,/CLIENT_VERSION = '20261124-v25'/);
 assert.match(core,/operatorMarkup\(\)/);
 const homeCode=await read('assets/v12-direct-home.js');
 assert.match(homeCode,/setupPublicPrograms\(\{home,loadPlaces:loadCatalog\}\)/);
 assert.match(homeCode,/id="n22-public-programs"/);
});

test('새로운 관리실 JS는 node --check 통과하고 신규 유료 패키지가 없다',async()=>{
 for(const path of ['assets/v22-admin-markup.js','assets/v22-operations-admin.js',
  'assets/v22-operations-model.js','assets/v22-public-programs.js',
  'assets/v12-direct-home.js','assets/v19-admin.js','scripts/build-core.js']){
  const check=spawnSync(process.execPath,['--check',fileURLToPath(new URL('../'+path,import.meta.url))],{encoding:'utf8'});
  assert.equal(check.status,0,path+': '+check.stderr);
 }
 const pkg=JSON.parse(await read('package.json'));
 assert.ok(!('dependencies' in pkg));
 assert.ok(!('devDependencies' in pkg));
});
