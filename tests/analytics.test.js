import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { publicConfig } from '../scripts/public-config.js';
import { anonymousId } from '../storage.js';

async function analyticsHarness(config, run) {
  const directory=await mkdtemp(join(tmpdir(),'nagachi-consent-test-'));
  const previous=Object.fromEntries(['document','localStorage','fetch'].map(key=>[key,globalThis[key]]));
  const entries=new Map(),requests=[];
  try {
    await writeFile(join(directory,'package.json'),'{"type":"module"}');
    for(const name of ['analytics.js','storage.js']) await cp(new URL('../'+name,import.meta.url),join(directory,name));
    await writeFile(join(directory,'config.js'),'export default '+JSON.stringify(config));
    globalThis.document={body:{dataset:{page:'home'}}};
    globalThis.localStorage={getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value)};
    globalThis.fetch=async(url,options)=>{requests.push({url,options});return{ok:true}};
    const analytics=await import(pathToFileURL(join(directory,'analytics.js')).href);
    await run({...analytics,requests,entries});
  } finally{
    Object.assign(globalThis,previous);
    await rm(directory,{recursive:true,force:true});
  }
}
const connected={supabaseUrl:'https://fixture.supabase.co',supabaseAnonKey:'sb_publishable_fixture_only'};
const consented={
  place_id:'test-public-venue',region:'경기',category:'맛집',is_demo:false,
  activities:['food'],desires:['eat'],
  age:'60~64',preference:'성별 상관없음',purpose:'식사동행',
  group_size:'3~4명',willingness:'약 2만원',response_id:anonymousId(),
  query:'NEVER-SEND-SEARCH-STRING',name:'NEVER-SEND-NAME',
};

test('서버 미연결이면 탐색·설문 모두 전송하지 않고 식별자도 만들지 않는다',async()=>{
  await analyticsHarness({},async({track,trackRhythm,recordConsentedSurvey,analyticsEnabled,requests,entries})=>{
    assert.equal(analyticsEnabled,false);
    assert.equal(await track('page_view'),false);
    assert.equal(await trackRhythm('activity_selected',{activities:['food']}),false);
    assert.equal(await recordConsentedSurvey(consented),false);
    assert.equal(requests.length,0);
    assert.equal(entries.size,0);
  });
});

test('연결돼 있어도 동의 전의 방문·동행 관심·검색은 전송하지 않는다',async()=>{
  await analyticsHarness(connected,async({track,trackRhythm,requests,entries,analyticsEnabled})=>{
    assert.equal(analyticsEnabled,true);
    for(const name of ['page_view','place_view','save_place','companion_interest','premium_willingness'])
      assert.equal(await track(name,consented),false);
    assert.equal(await trackRhythm('activity_selected',{activities:['food']}),false);
    assert.equal(await trackRhythm('companion_interest',consented),false);
    assert.equal(requests.length,0,'동의 전 네트워크 요청 없음');
    assert.equal(entries.size,0,'동의 전 익명 식별자 생성 없음');
  });
});

test('명시적 동의 후 설문 완료/장소 관심/활동 선택을 같은 익명 세션으로 기록',async()=>{
  await analyticsHarness(connected,async({recordConsentedSurvey,requests,entries})=>{
    assert.equal(await recordConsentedSurvey(consented),true);
    assert.equal(requests.length,3);
    const payloads=requests.map(r=>JSON.parse(r.options.body).payload);
    assert.deepEqual(payloads.map(p=>p.event_name),[
      'premium_willingness','companion_interest','activity_selected',
    ]);
    assert.equal(payloads[0].place_id,'test-public-venue');
    assert.equal(payloads[0].region,'경기');
    assert.equal(payloads[0].details.willingness,'약 2만원');
    assert.equal(payloads[0].details.response_id,consented.response_id);
    assert.deepEqual(payloads[2].details.activities,['food']);
    assert.ok(payloads.every(p=>p.session_id===payloads[0].session_id));
    assert.equal(entries.size,1,'동의 후에만 익명 session 저장');
    assert.ok(!JSON.stringify(payloads).includes('NEVER-SEND'));
    assert.ok(requests.every(r=>r.url.endsWith('/rest/v1/rpc/record_event')));
  });
});

test('설문 저장이 실패하면 완료로 처리하지 않고 후속 이벤트를 보내지 않는다',async()=>{
  await analyticsHarness(connected,async({recordConsentedSurvey,requests})=>{
    globalThis.fetch=async(url,options)=>{requests.push({url,options});return{ok:false}};
    assert.equal(await recordConsentedSurvey(consented),false);
    assert.equal(requests.length,1);
    assert.equal(JSON.parse(requests[0].options.body).payload.event_name,'premium_willingness');
    globalThis.fetch=async()=>{throw Error('offline')};
    assert.equal(await recordConsentedSurvey({...consented,response_id:anonymousId()}),false);
  });
});

test('서버 설정 검증은 비공개 키와 부분 설정을 거부한다',async()=>{
  await analyticsHarness(connected,async({track,requests})=>{
    assert.equal(await track('unknown_event'),false);
    assert.equal(requests.length,0);
  });
  assert.deepEqual(publicConfig({}),{supabaseUrl:'',supabaseAnonKey:''});
  assert.equal(publicConfig(connected).supabaseAnonKey,connected.supabaseAnonKey);
  assert.throws(()=>publicConfig({supabaseUrl:connected.supabaseUrl}),/함께/);
  assert.throws(()=>publicConfig({...connected,supabaseAnonKey:'sb_secret_TEST'}),/비공개/);
  const service='header.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.signature';
  assert.throws(()=>publicConfig({...connected,supabaseAnonKey:service}),/anon 역할/);
});
