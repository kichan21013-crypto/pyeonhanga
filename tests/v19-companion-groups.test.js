import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,cp,writeFile,rm,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('v19 실제 앱 파일 전체가 Node JS 문법 검사를 통과한다',()=>{
 for(const p of ['app.js','assets/v12-direct-home.js','assets/v16-together.js','assets/v19-group-ui.js',
  'assets/v19-companion-service.js','assets/v19-admin.js','scripts/build-core.js','scripts/build.js']){
   const result=spawnSync(process.execPath,['--check',fileURLToPath(new URL('../'+p,import.meta.url))],{encoding:'utf8'});
   assert.equal(result.status,0,p+': '+result.stderr);
 }
});
test('상단 CTA는 4개 활동 카드 제목을 고정헤더 뒤로 숨기지 않는다',async()=>{
 const home=await read('assets/v12-direct-home.js'),css=await read('assets/v19-cohorts.css');
 assert.match(home,/href="#n21-popular"/);
 assert.match(home,/getBoundingClientRect\(\)\.height/);
 assert.match(home,/window\.scrollTo\(\{top,behavior:/);
 assert.match(home,/n19-photo-mosaic/);
 assert.match(home,/v38-hero\.webp/);
 for(const tone of ['peach','sage','lilac','blue'])assert.ok(css.includes('[data-tone='+tone+']'));
 assert.match(css,/#n16-invites-title,#n16-invites/);
});
test('연령 선택 다음 활동은 복수 체크 가능하며 명시적 동의 이후에만 저장한다',async()=>{
 const app=await read('app.js');
 assert.match(app,/radio\('age','어느 연령대이세요\?'/);
 assert.match(app,/name="activity-interest"/);
 assert.match(app,/chosenActivities\(\)/);
 assert.match(app,/interestMap\[program\?\.interest\]/);
 assert.match(app,/values\.activities=activities/);
 assert.match(app,/values\.purpose=mainPurpose/);
 assert.match(app,/!form\.reportValidity\(\)\|\|!form\.elements\.consent\.checked/);
 assert.match(app,/await recordConsentedSurvey/);
 assert.match(app,/name="updates" value="yes"/);
 assert.match(app,/rememberActivities\(activities\)/);
 assert.match(app,/로그인하고 일정 소식 받기/);
 assert.doesNotMatch(app,/실시간 참가|매칭 성공|예약이 확정됐습니다/);
});
test('5명 미만 비공개, 저장 안 된 응답으로 허위 관심 인원을 만들지 않는다',async()=>{
 const client=await read('assets/v19-companion-service.js');
 const ui=await read('assets/v19-group-ui.js'),sql=await read('supabase/companion-groups.sql');
 assert.match(client,/Number\(row\.interest_count\)>=5/);
 assert.match(ui,/집계 연결 준비 중/);
 assert.match(ui,/참가 확정 아님/);
 assert.match(sql,/having count\(distinct session_id\)>=5/);
 assert.match(sql,/not e\.is_demo/);
});
test('RLS + 관리자 Auth allowlist + 난수 토큰으로 관심 그룹 공지를 보호한다',async()=>{
 const sql=await read('supabase/companion-groups.sql');
 const admin=await read('assets/v19-admin.js'),page=await read('dist/admin.html');
 assert.match(sql,/enable row level security/g);
 assert.match(sql,/revoke all on public\.nagachi_group_notices from public,anon,authenticated/);
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/grant execute on function public\.nagachi_admin_dashboard\(\) to authenticated/);
 assert.doesNotMatch(sql,/grant execute on function public\.nagachi_admin_dashboard\(\) to anon/);
 assert.match(sql,/where s\.token_hash=v_hash and s\.activity=n\.activity and s\.expires_at>now\(\)/);
 assert.match(sql,/sha256\(pg_catalog\.convert_to/);
 assert.match(sql,/expires_at timestamptz/);
 assert.match(admin,/nagachi_admin_save_notice/);
 assert.match(page,/noindex,nofollow/);
 assert.match(page,/v19-admin\.js\?v=20261125-v42/);
});
test('홈/저장/동행·개인정보 안내에서 v19 버전을 사용하고 무료 의존성 유지',async()=>{
 const [home,saved,companion,core]=await Promise.all([
  read('dist/index.html'),read('dist/saved.html'),read('dist/companion.html'),read('scripts/build-core.js')
 ]);
 for(const p of [home,saved,companion])assert.match(p,/v19-cohorts\.css\?v=20261124-v41/);
 assert.match(home,/v12-direct-home\.js\?v=20261124-v41/);
 assert.match(core,/소식 조회 권한은 90일간 유효/);
 assert.match(core,/해지하면 서버 구독이 삭제/);
 assert.ok(!('dependencies' in JSON.parse(await read('package.json'))));
});
test('가짜 서버에서 공개 집계 5명 임계값, 수신신청, 앱 내 알림 및 해지를 검증한다',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'ng-group-'));
 const previous={localStorage:globalThis.localStorage,fetch:globalThis.fetch,document:globalThis.document};
 const entries=new Map(),requests=[];
 try{
  await mkdir(join(temp,'assets'),{recursive:true});
  await writeFile(join(temp,'package.json'),'{"type":"module"}');
  for(const p of ['assets/v19-companion-service.js','analytics.js','storage.js'])
   await cp(new URL('../'+p,import.meta.url),join(temp,p));
  await writeFile(join(temp,'config.js'),"export default {supabaseUrl:'https://fixture.supabase.co',supabaseAnonKey:'sb_publishable_fixture_only'};");
  globalThis.localStorage={getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v)};
  globalThis.document={body:{dataset:{page:'home'}},dispatchEvent:()=>true};
  globalThis.fetch=async(url,options)=>{
   requests.push({url,body:JSON.parse(options.body)});
   let answer;
   if(url.endsWith('nagachi_public_interest_counts'))answer=[{activity:'food',interest_count:12},{activity:'hike',interest_count:3}];
   else if(url.endsWith('nagachi_subscribe_updates')||url.endsWith('nagachi_unsubscribe_updates'))answer=true;
   else if(url.endsWith('nagachi_my_updates'))answer=[{id:1,activity:'food',title:'새 공지'}];
   else return{ok:false,status:404};
   return{ok:true,text:async()=>JSON.stringify(answer)};
  };
  const api=await import(pathToFileURL(join(temp,'assets/v19-companion-service.js')).href);
  assert.deepEqual(api.cleanGroupActivities(['food','hike','food','bad','travel']),['food','hike','travel']);
  assert.deepEqual((await api.fetchPublicInterestCounts()).counts,{food:12});
  assert.equal(api.localSubscriptionToken(),'');
  const consented='a9b7bb35-55a9-4f25-8b7e-51c0be0aab14';
  assert.equal((await api.optInCompanionUpdates(consented,['food','hike'])).ok,true);
  assert.match(api.localSubscriptionToken(),/^[0-9a-f]{64}$/);
  assert.deepEqual(requests.find(x=>x.url.endsWith('nagachi_subscribe_updates')).body.p_activities,['food','hike']);
  assert.equal((await api.myCompanionUpdates()).items[0].activity,'food');
  assert.equal((await api.stopCompanionUpdates()).ok,true);
  assert.equal(api.localSubscriptionToken(),'');
 }finally{
  Object.assign(globalThis,previous);
  await rm(temp,{recursive:true,force:true});
 }
});

test('v40 account notices require authenticated server identity and explicit consent',async()=>{
 const sql=await read('supabase/account-notices-v40.sql'),auth=await read('assets/v40-account-auth.js'),page=await read('assets/v40-account-page.js'),admin=await read('assets/v19-admin.js'),home=await read('assets/v12-direct-home.js');
 assert.match(sql,/alter table public\.nagachi_account_subscriptions enable row level security/);
 assert.match(sql,/s\.user_id=v_uid/);
 assert.match(sql,/revoke execute on function public\.nagachi_subscribe_updates/);
 assert.match(sql,/grant execute on function public\.nagachi_account_news\(\) to authenticated/);
 assert.match(sql,/a\.user_id=auth\.uid\(\)/);
 assert.match(auth,/provider:'kakao'/);
 assert.match(auth,/code_challenge_method:'s256'/);
 assert.match(auth,/grant_type=pkce/);
 assert.match(auth,/history\.replaceState/);
 assert.match(page,/redirectAdmin&&role\.ok&&role\.data===true/);
 assert.match(admin,/companionRpc\('nagachi_admin_dashboard',\{\},t\)/);
 assert.match(home,/href="\/account\.html" aria-label="내 계정"/);
});

test('v41 계정 구독자 집계와 연결 점검은 관리자 권한과 읽기 전용 진단으로 분리',async()=>{
 const sql=await read('supabase/account-notices-v41.sql'),check=await read('supabase/check-account-v41.sql'),auth=await read('assets/v40-account-auth.js'),admin=await read('assets/v19-admin.js'),page=await read('assets/v40-account-page.js');
 assert.match(sql,/nagachi_admin_account_subscribers\(\)/);
 assert.match(sql,/a\.user_id=auth\.uid\(\)/);
 assert.match(sql,/where expires_at>now\(\) group by activity/);
 assert.match(sql,/grant execute on function public\.nagachi_admin_account_subscribers\(\) to authenticated/);
 assert.match(check,/has_function_privilege\('anon',oid,'EXECUTE'\)/);
 assert.doesNotMatch(check,/\b(?:insert into|delete from|update public|create table)\b/i);
 assert.match(admin,/accounts===null\?'연결 확인 필요'/);
 assert.match(auth,/auth\/v1\/user/);
 assert.match(auth,/if\(accountToken\(\)!==t\)return \{ok:false,reason:'login'\}/);
 assert.match(page,/이 번호만으로 관리자 권한이 생기지 않습니다/);
});
