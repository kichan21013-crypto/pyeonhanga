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
    const analytics = await import(pathToFileURL(join(directory, 'analytics.js')).href + `?t=${Date.now()}-${Math.random()}`);
    await run({ ...analytics, requests, entries });
  } finally {
    Object.assign(globalThis, previous); await rm(directory, { recursive: true, force: true });
  }
}
const connected = { supabaseUrl: 'https://fixture.supabase.co', supabaseAnonKey: 'sb_publishable_fixture_test_only' };
const allEvents = [
  'page_view','search','filter_used','place_view','save_place','share_place','companion_interest','premium_willingness',
  'rhythm_start','desire_selected','activity_selected','companion_selected','condition_selected','recommendation_view','recommendation_save','recommendation_share',
];

test('Supabase 미설정이면 모든 이벤트가 조용히 건너뛰어진다', async () => {
  await analyticsHarness({}, async ({ track, analyticsEnabled, requests, entries }) => {
    assert.equal(analyticsEnabled, false);
    for (const event of allEvents) assert.equal(await track(event), false);
    assert.equal(requests.length, 0); assert.equal(entries.size, 0);
  });
});

test('설정 후 신규 이벤트와 검증 context를 전송하고 자유입력 원문은 제외한다', async () => {
  await analyticsHarness(connected, async ({ track, requests, entries }) => {
    const context = {
      place_id: 'demo-table', region: '경기', category: '맛집', is_demo: true,
      desires: ['eat','rest'], activities: ['noodle','cafe'], companions: ['solo','friend'],
      duration: 'half_day', transport: 'car', comfort_preferences: ['parking','waiting'],
      recommended_activity: 'noodle', query: 'NEVER-SEND-RAW-SEARCH', name: 'NEVER-SEND-NAME',
    };
    assert.equal(await track('recommendation_view', context), true);
    assert.equal(await track('recommendation_save', context), true);
    assert.equal(await track('recommendation_share', context), true);
    assert.equal(await track('premium_willingness', {
      ...context, age: '60~64', preference: '성별 상관없음', purpose: '식사동행', group_size: '3~4명', willingness: '약 2만원', response_id: anonymousId(),
    }), true);
    assert.equal(requests.length, 4);
    const rows = requests.map(({ options }) => JSON.parse(options.body).payload);
    assert.deepEqual(rows.map(row => row.event_name), ['recommendation_view','recommendation_save','recommendation_share','premium_willingness']);
    for (const row of rows) {
      assert.deepEqual(row.details.desires, ['eat','rest']);
      assert.deepEqual(row.details.activities, ['noodle','cafe']);
      assert.deepEqual(row.details.companions, ['solo','friend']);
      assert.deepEqual(row.details.comfort_preferences, ['parking','waiting']);
      assert.equal(row.details.duration, 'half_day'); assert.equal(row.details.transport, 'car');
      assert.ok(!JSON.stringify(row).includes('NEVER-SEND'));
    }
    assert.equal(entries.size, 1);
  });
});

test('내리듬 logical event는 신규 서버 이벤트명으로 기록되고 DEMO를 구분한다', async () => {
  await analyticsHarness(connected, async ({ trackRhythm, RHYTHM_EVENT_MAP, requests }) => {
    const logical = []; globalThis.document.dispatchEvent = event => logical.push(event.detail);
    for (const name of Object.keys(RHYTHM_EVENT_MAP)) {
      const survey = name === 'premium_willingness' ? { age:'60~64', preference:'성별 상관없음', purpose:'식사동행', group_size:'3~4명', willingness:'약 2만원', response_id:anonymousId() } : {};
      assert.equal(await trackRhythm(name, { place_id:'demo-table', is_demo:true, desires:['eat'], activities:['noodle'], companions:['solo'], duration:'short', transport:'car', comfort_preferences:['parking'], ...survey }), true);
    }
    assert.equal(requests.length, 10);
    assert.deepEqual(logical.map(event => event.name), Object.keys(RHYTHM_EVENT_MAP));
    const events = requests.map(request => JSON.parse(request.options.body).payload.event_name);
    assert.deepEqual(events, Object.values(RHYTHM_EVENT_MAP));
    assert.ok(logical.every(event => event.isDemo));
    assert.equal(await trackRhythm('unsupported'), false);
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
