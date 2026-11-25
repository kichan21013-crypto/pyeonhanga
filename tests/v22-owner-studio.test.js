import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {operatorMarkup} from '../assets/v22-admin-markup.js';
import {estimateRevenue,cleanCoursePlaceIds,sanitizePublicCourses,draftCourseFromPlace} from '../assets/v22-operations-model.js';
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
 assert.match(page,/v22-admin-studio\.css\?v=20261125-v43/);
 assert.match(page,/v19-admin\.js\?v=20261125-v43/);
 assert.match(home,/v22-public-programs\.css\?v=20261125-v43/);
 assert.match(build,/CLIENT_VERSION = '20261125-v43'/);
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

test('v39 장소에서 새 비공개 코스 초안을 준비한다',()=>{
 assert.deepEqual(draftCourseFromPlace({id:'a',name:'강릉 카페',category:'맛집',region:'강릉'}),{placeId:'a',title:'강릉 카페 함께 가요',activity:'food',region:'강릉'});
 assert.equal(draftCourseFromPlace({id:'d',name:'가짜',region:'서울',isDemo:true}),null);
 assert.equal(draftCourseFromPlace({id:'d',name:'장소',region:'미지원 지역'}),null);
 assert.equal(draftCourseFromPlace({id:'h',name:'산',region:'서울',intentTags:['hike']}).activity,'hike');
});
test('v39 업무 연결은 자동 게시하지 않으며 로그인 세션을 보호한다',async()=>{
 const admin=await read('assets/v22-operations-admin.js'),login=await read('assets/v19-admin.js');
 assert.match(admin,/f\.publish\.checked=false/);
 assert.match(admin,/f\.stage\.value='draft'/);
 assert.match(admin,/data-n39-pending-meetup/);
 assert.match(admin,/getToken\(\)!==token/);
 assert.match(login,/if\(jwt!==token\)return/);
 assert.match(login,/form\._notices=\[\]/);
});

test('v42 owner summary exposes only aggregate data, actionable pending groups and safe rendering',async()=>{
 const sql=await read('supabase/owner-summary-v42.sql'),src=await read('assets/v42-owner-summary.js'),admin=await read('assets/v22-operations-admin.js'),markup=operatorMarkup();
 assert.match(sql,/a\.user_id=auth\.uid\(\)/);
 assert.match(sql,/revoke all on function public\.nagachi_admin_owner_summary\(\) from public,anon,authenticated/);
 assert.match(sql,/count\(distinct s\.user_id\)/);
 assert.match(sql,/where status='pending'/);
 assert.match(markup,/id="n42-owner-summary"/);
 assert.match(markup,/data-n42-notice/);
 assert.match(admin,/form\.elements\.id\.value=String\(savedId\)/);
 assert.match(admin,/ownerSummary\.reset\(\)/);
 assert.match(admin,/data-n42-move-place/);
 const pure=src.replace(/^import .*?;\s*$/gm,'').replace(/^export /gm,'');
 const render=new Function('escapeHtml',pure+'\nreturn renderOwnerSummary;')(x=>String(x).replace(/</g,'&lt;').replace(/>/g,'&gt;'));
 const html=render({members:0,owners:1,pending:2,pending_groups:[{id:7,title:'<script>',pending:2}]});
 assert.match(html,/일반 가입 회원/);
 assert.match(html,/data-n39-pending-meetup="7"/);
 assert.match(html,/&lt;script&gt;/);
 assert.doesNotMatch(html,/<script>/);
 assert.match(render({}),/—/);
});

test('v43 external place link allowlist, course rendering and draft handling',async()=>{
 const {mapLink,externalPlace}=await import('../assets/v43-external-places.js');
 const {sanitizePublicCourses}=await import('../assets/v22-operations-model.js');
 const id='ext-12345678-1234-1234-1234-123456789abc';
 assert.equal(mapLink('https://naver.me/test').provider,'네이버 지도');
 assert.equal(mapLink('https://maps.app.goo.gl/test').provider,'구글 지도');
 assert.ok(mapLink('https://www.google.com/maps/search/?api=1&query=a'));
 for(const u of ['http://map.naver.com/a','https://map.naver.com.evil.example/a','https://map.naver.com@evil.example/a','javascript:alert(1)','https://www.google.com/search?q=x'])assert.equal(mapLink(u),null);
 const p=externalPlace({id,name:'테스트 장소',address:'테스트 주소',region:'인천',category:'맛집',map_url:'https://naver.me/test'});
 const course={id:1,title:'코스',description:'외부 장소 코스',activity:'food',place_ids:[id],region:'인천',duration:'반나절'};
 assert.equal(sanitizePublicCourses([course],[p]).length,1);
 assert.equal(sanitizePublicCourses([course],[]).length,0);
 const src=await read('assets/v22-public-programs.js');
 const pure=src.replace(/^import .*?;\s*$/gm,'').replace(/^export /gm,'');
 const render=new Function('escapeHtml','safeUrl','placeUrl','ADMIN_ACTIVITY_LABELS',pure+'\nreturn courseCard;')(String,String,p=>'/places/'+p.slug+'/',{food:'맛집'});
 const html=render({...course,places:[p]});
 assert.match(html,/https:\/\/naver\.me\/test/);
 assert.match(html,/data-n43-course-news/);
 assert.doesNotMatch(html,/<img|\/places\//);
 const sql=await read('supabase/external-places-v43.sql');
 assert.match(sql,/where c\.status='published' and e\.id=any\(c\.place_ids\)/);
 assert.match(sql,/alter table public\.nagachi_external_places enable row level security/);
 assert.match(sql,/a\.user_id=auth\.uid\(\)/);
});
