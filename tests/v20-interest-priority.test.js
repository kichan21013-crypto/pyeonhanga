import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,cp,writeFile,mkdtemp,mkdir,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('v20은 실제 HTML/JS에 설문보다 중요한 동행 관심 등록 UI를 배치한다',async()=>{
 const app=await read('app.js'),css=await read('assets/v20-interest-priority.css');
 const [home,saved,detail]=await Promise.all([
  read('dist/index.html'),read('dist/saved.html'),read('dist/companion.html')
 ]);
 assert.match(app,/class="n20-core-reason"/);
 assert.match(app,/가장 중요한 한 가지/);
 assert.match(app,/이 동행에 <em>관심 있어요!/);
 assert.match(app,/n20-interest-summary/);
 assert.match(app,/n20-interest-people/);
 assert.match(app,/fetchPublicInterestCounts\(\)/);
 assert.match(app,/publicInterest\.counts\[item\.id\]>=5/);
 assert.match(app,/참가 확정 아님/);
 assert.match(app,/class="n20-action-dock"/);
 assert.match(app,/n20-submit-interest/);
 assert.match(app,/♡ 이 동행에 관심 있어요/);
 assert.match(css,/position:sticky/);
 assert.match(css,/\.n20-interest-dialog \.n20-submit-interest/);
 assert.match(css,/\.n20-save-status\[data-state='error'\]/);
 for(const page of [home,saved,detail])assert.match(page,/v20-interest-priority\.css\?v=20261124-v25/);
 assert.match(home,/v12-direct-home\.js\?v=20261124-v25/);
});

test('비용 옵션은 접히고 기본 미응답으로 유지하며 서버에 선택한 값만 보낸다',async()=>{
 const app=await read('app.js');
 assert.match(app,/<details class="n20-optional-fee"/);
 assert.match(app,/v==='아직 모르겠음'/);
 assert.match(app,/선택하지 않으면 “아직 모르겠음”으로 기록/);
 assert.match(app,/radio\('willingness','서비스비에 대한 생각'/);
 assert.match(app,/form\.reportValidity\(\)/);
 assert.match(app,/!form\.elements\.consent\.checked/);
 assert.match(app,/const subscribe=values\.updates==='yes'/);
 assert.match(app,/delete values\.consent;delete values\.updates/);
 assert.match(app,/await recordConsentedSurvey/);
 assert.match(app,/if\(!success\)/);
 assert.match(app,/button\.disabled=false/);
 assert.match(app,/status\.dataset\.state='error'/);
 assert.match(app,/선택한 내용은 아직 저장되지 않았습니다/);
 assert.match(app,/status\.dataset\.state='success'/);
 assert.doesNotMatch(app,/입력 체험 마치기 \(미저장\)/);
});

test('첫 단계 경고가 숨겨진 두 번째 화면에 남지 않고 실제로 보인다',async()=>{
 const app=await read('app.js');
 assert.match(app,/n20-first-status/);
 assert.match(app,/firstStatus\.textContent='같이 해보고 싶은 일을 하나 이상 골라주세요\.'/);
 assert.match(app,/firstStatus\.textContent=''/);
});

test('오류 메시지는 비밀 정보나 원본 데이터 없이 HTTP 상태별로만 분류한다',async()=>{
 const analytics=await read('analytics.js'),app=await read('app.js');
 assert.match(analytics,/export function consentSaveFailure\(\)/);
 for(const reason of ['not-configured','rpc-not-installed','permission','schema','network','server'])
  assert.ok(app.includes("'"+reason+"'"),reason+' 안내');
 assert.match(analytics,/res\.status === 404/);
 assert.match(analytics,/res\.status === 401 \|\| res\.status === 403/);
 assert.match(analytics,/res\.status === 400 \|\| res\.status === 409/);
 assert.doesNotMatch(analytics,/console\.log\(|console\.error\(/);
 assert.doesNotMatch(app,/navigator\.sendBeacon|localStorage\.setItem\(/);
});

test('가짜 Supabase 연결에 대한 저장 성공·실패 구분을 실제 JS로 검증한다',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'ng-interest-'));
 const prior={localStorage:globalThis.localStorage,fetch:globalThis.fetch,document:globalThis.document};
 const values=new Map();
 try {
  await writeFile(join(temp,'package.json'),'{"type":"module"}');
  await cp(new URL('../analytics.js',import.meta.url),join(temp,'analytics.js'));
  await cp(new URL('../storage.js',import.meta.url),join(temp,'storage.js'));
  await writeFile(join(temp,'config.js'),"export default {supabaseUrl:'https://fixture.supabase.co',supabaseAnonKey:'sb_publishable_fixture'};");
  globalThis.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
  globalThis.document={body:{dataset:{page:'detail'}},dispatchEvent:()=>{}};
  const module=await import(pathToFileURL(join(temp,'analytics.js')).href);
  const event={place_id:'test-place',region:'서울',category:'맛집',is_demo:false,age:'45~49',
   preference:'성별 상관없음',purpose:'식사동행',group_size:'3~4명',willingness:'아직 모르겠음',
   activities:['food','hike'],desires:['eat','outdoor'],
   response_id:'1ed11bbf-d031-4eba-bce3-d600c5eb158e'};
  for(const [http,code,reason] of [
    [404,'PGRST202','rpc-not-installed'],
    [403,'42501','permission'],
    [400,'23514','schema'],
    [503,'','server']
  ]){
    globalThis.fetch=async()=>({ok:false,status:http,json:async()=>({code})});
    const ok=await module.recordConsentedSurvey(event);
    assert.equal(ok,false);
    assert.equal(module.consentSaveFailure(),reason);
  }
  globalThis.fetch=async()=>{throw new Error('offline')};
  assert.equal(await module.recordConsentedSurvey(event),false);
  assert.equal(module.consentSaveFailure(),'network');
  const sent=[];
  globalThis.fetch=async(url,opts)=>{
    sent.push(JSON.parse(opts.body).payload);
    return {ok:true,status:204};
  };
  assert.equal(await module.recordConsentedSurvey(event),true);
  assert.equal(module.consentSaveFailure(),null);
  assert.equal(sent[0].event_name,'premium_willingness');
  assert.deepEqual(sent[0].details.activities,['food','hike']);
  assert.equal(sent[0].details.willingness,'아직 모르겠음');
 } finally {
  Object.assign(globalThis,prior);
  await rm(temp,{recursive:true,force:true});
 }
});

test('v20 빌드와 브라우저 실사 검증은 문법 오류 없는 캐시 갱신 구조다',async()=>{
 const build=await read('scripts/build.js'),core=await read('scripts/build-core.js');
 const smoke=await read('tests/browser-smoke.mjs');
 assert.match(build,/CLIENT_VERSION = '20261124-v25'/);
 assert.match(core,/20261124-v25/);
 assert.match(smoke,/\.n20-optional-fee summary/);
 assert.match(smoke,/\.n20-save-status\[data-state=error\]/);
 const files=['analytics.js','app.js','scripts/build.js'];
 for(const p of files){
  const syntax=spawnSync(process.execPath,['--check',fileURLToPath(new URL('../'+p,import.meta.url))],{encoding:'utf8'});
  assert.equal(syntax.status,0,p+': '+syntax.stderr);
 }
});
