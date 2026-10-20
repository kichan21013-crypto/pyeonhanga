import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { publicConfig } from '../scripts/public-config.js';
import { anonymousId, savedIds } from '../storage.js';

async function analyticsHarness(config, run) {
  const directory = await mkdtemp(join(tmpdir(), 'pyeonhanga-test-'));
  const previous = Object.fromEntries(['document','localStorage','fetch'].map(key => [key, globalThis[key]]));
  const entries = new Map(), requests = [];
  try {
    await writeFile(join(directory, 'package.json'), '{"type":"module"}');
    for (const file of ['analytics.js', 'storage.js']) await cp(new URL(`../${file}`, import.meta.url), join(directory, file));
    await writeFile(join(directory, 'config.js'), `export default ${JSON.stringify(config)}`);
    globalThis.document = { body: { dataset: { page: 'detail' } } };
    globalThis.localStorage = { getItem: key => entries.get(key) ?? null, setItem: (key,value) => entries.set(key,value) };
    globalThis.fetch = async (url, options) => { requests.push({ url, options }); return { ok: true }; };
    const analytics = await import(pathToFileURL(join(directory, 'analytics.js')).href);
    await run({ ...analytics, requests, entries });
  } finally {
    Object.assign(globalThis, previous); await rm(directory, { recursive: true, force: true });
  }
}
const connected = { supabaseUrl: 'https://fixture.supabase.co', supabaseAnonKey: 'sb_publishable_fixture_test_only' };
test('Supabase 미설정이면 8개 이벤트가 모두 조용히 건너뛰어진다', async () => {
  await analyticsHarness({}, async ({ track, analyticsEnabled, requests, entries }) => {
    assert.equal(analyticsEnabled, false);
    for (const event of ['page_view','search','filter_used','place_view','save_place','share_place','companion_interest','premium_willingness']) assert.equal(await track(event), false);
    assert.equal(requests.length, 0); assert.equal(entries.size, 0);
  });
});
test('설정 후 8개 이벤트가 입력 함수로만 전송되고 검색 원문은 제외된다', async () => {
  await analyticsHarness(connected, async ({ track, requests, entries }) => {
    const events = ['page_view','search','filter_used','place_view','save_place','share_place','companion_interest','premium_willingness'];
    for (const event of events) assert.equal(await track(event, { place_id: 'demo-table', region: '경기', category: '맛집', is_demo: true, query: 'NEVER-SEND-RAW-SEARCH', name: 'NEVER-SEND-NAME', ...(event === 'premium_willingness' ? { age: '60~64', preference: '성별 상관없음', purpose: '식사동행', group_size: '3~4명', willingness: '약 2만원', response_id: anonymousId() } : {}) }), true);
    assert.equal(requests.length, 8);
    const sessions = new Set();
    for (const { url, options } of requests) {
      assert.equal(url, connected.supabaseUrl + '/rest/v1/rpc/record_event');
      assert.equal(options.method, 'POST'); const row = JSON.parse(options.body).payload;
      assert.ok(!Object.hasOwn(options.headers, 'Authorization'));
      assert.ok(events.includes(row.event_name)); assert.equal(row.page, 'detail'); assert.equal(row.is_demo, true);
      assert.ok(!options.body.includes('NEVER-SEND')); sessions.add(row.session_id);
    }
    assert.equal(sessions.size, 1); assert.equal(entries.size, 1);
  });
});
test('네트워크/서버 오류는 호출자를 중단하지 않고 실패를 반환한다', async () => {
  await analyticsHarness(connected, async ({ track }) => {
    globalThis.fetch = async () => { throw new Error('offline'); };
    assert.equal(await track('page_view'), false);
    globalThis.fetch = async () => ({ ok: false });
    assert.equal(await track('premium_willingness'), false);
    assert.equal(await track('unknown_event'), false);
  });
});
test('저장공간 차단/손상에도 익명 식별과 저장 목록 읽기가 안전하다', async () => {
  await analyticsHarness(connected, async ({ track, requests, entries }) => {
    entries.set('pyeonhanga.session', JSON.stringify('------------------------------------'));
    assert.equal(await track('page_view'), true);
    assert.match(JSON.parse(requests[0].options.body).payload.session_id, /^[a-f0-9]{8}-[a-f0-9]{4}-/);
    globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    assert.equal(await track('place_view'), true); assert.deepEqual(savedIds(), []);
  });
});
test('공개 설정 검증이 비공개 키와 부분 설정을 거부한다', () => {
  assert.deepEqual(publicConfig({}), { supabaseUrl: '', supabaseAnonKey: '' });
  assert.equal(publicConfig(connected).supabaseAnonKey, connected.supabaseAnonKey);
  assert.throws(() => publicConfig({ supabaseUrl: connected.supabaseUrl }), /함께/);
  assert.throws(() => publicConfig({ ...connected, supabaseAnonKey: 'sb_secret_TEST' }), /비공개/);
  const service = `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`;
  assert.throws(() => publicConfig({ ...connected, supabaseAnonKey: service }), /anon 역할/);
});
test('내리듬 논리 이벤트는 운영 스키마의 기존 이름으로 호환 기록하고 DEMO를 구분한다', async () => {
  await analyticsHarness(connected,async ({trackRhythm,RHYTHM_EVENT_MAP,requests})=>{
    const logical=[];globalThis.document.dispatchEvent=event=>logical.push(event.detail);
    for(const name of Object.keys(RHYTHM_EVENT_MAP)) assert.equal(await trackRhythm(name,{place_id:'demo-table',is_demo:true,companion:'혼자'}),true);
    assert.equal(requests.length,10);assert.deepEqual(logical.map(event=>event.name),Object.keys(RHYTHM_EVENT_MAP));assert.ok(logical.every(event=>event.isDemo));
    for(const request of requests){const row=JSON.parse(request.options.body).payload;assert.ok(['filter_used','search','save_place','share_place','companion_interest','premium_willingness'].includes(row.event_name));assert.equal(row.is_demo,true);}
    assert.equal(await trackRhythm('unsupported'),false);
  });
});
