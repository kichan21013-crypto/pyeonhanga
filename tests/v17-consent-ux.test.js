import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('방문/활동 통계는 선택 동의를 확인해야 전송된다',async()=>{
  const analytics=await read('analytics.js');
  assert.match(analytics,/export function usageAnalyticsConsent/);
  assert.match(analytics,/export function setUsageAnalyticsConsent/);
  assert.match(analytics,/if \(!surveySubmission && usageAnalyticsConsent\(\) !== true\) return false/);
  assert.match(analytics,/event === 'premium_willingness' && values\.surveyConsent === true/);
  assert.doesNotMatch(analytics,/SCALAR_FIELDS[\s\S]{0,260}'surveyConsent'/,'설문 동의 플래그는 전송 payload 필드에 넣지 않음');
});

test('동행 설문은 별도 동의만으로 제출할 수 있고 일반 방문 통계에는 동의하지 않는다',async()=>{
  const app=await read('app.js');
  assert.match(app,/name="consent" value="yes" required/);
  assert.match(app,/surveyConsent:true/);
  assert.match(app,/const success = analyticsEnabled && await trackRhythm\('premium_willingness'/);
  assert.match(app,/if \(analyticsEnabled && !success\)/);
  assert.match(app,/응답이 저장되지 않았습니다/);
  assert.match(app,/서버에 저장하지 못했습니다/);
});

test('설문과 방문 통계의 동의·거부를 명확히 안내하고 설정을 바꿀 수 있다',async()=>{
  const built=await read('dist/privacy.html');
  const app=await read('app.js');
  const styles=await read('assets/v16-together.css');
  assert.match(built,/id="usage-consent-settings"/);
  assert.match(built,/data-usage-decision="allow"/);
  assert.match(built,/data-usage-decision="decline"/);
  assert.match(built,/별도로 허용한 경우에만 Supabase에 전송합니다/);
  assert.match(app,/data-usage-allow/);
  assert.match(app,/data-usage-decline/);
  assert.match(app,/선택이며, 거절해도 이용할 수 있어요/);
  assert.match(styles,/\.nagachi-usage-consent/);
  assert.match(styles,/calc\(77px \+ env\(safe-area-inset-bottom\)\)/);
});

test('동행 희망 클릭은 두 장소 로더 간 순서가 달라도 설문 또는 오류 안내를 제공한다',async()=>{
  const app=await read('app.js');
  const home=await read('assets/v16-together.js');
  assert.match(home,/data-companion-interest/);
  assert.match(home,/data-companion-activity/);
  assert.match(app,/document\.addEventListener\('click', async event =>/);
  assert.match(app,/const latest = await response\.json\(\)/);
  assert.match(app,/places = latest/);
  assert.match(app,/if \(place\) companionDialog\(place,interest\)/);
  assert.match(app,/이 장소의 동행 정보를 불러오지 못했습니다/);
});

test('앱 운영 상태 페이지는 빌드 시각·버전·DB 설정 유무만 공개하고 비밀키는 노출하지 않는다',async()=>{
  const html=await read('dist/status.html');
  const manifest=JSON.parse(await read('dist/release-status.json'));
  const app=await read('dist/index.html');
  const core=await read('scripts/build-core.js');
  assert.equal(manifest.version,'20261124-v17');
  assert.match(manifest.built_at,/^\d{4}-\d\d-\d\dT/);
  assert.equal(typeof manifest.analytics_setup_present,'boolean');
  assert.equal(manifest.storage_verified,false,'서버 저장 성공 확인을 흉내 내지 않음');
  assert.equal(manifest.public_venue_count,636);
  assert.match(html,/Supabase 설정/);
  assert.match(html,/실제 저장 여부는 동행 설문 제출 결과 및 Supabase 관리자 조회로 확인/);
  assert.match(html,/개인정보·통계 설정 확인/);
  assert.match(app,/v12-direct-home\.js\?v=20261124-v17/);
  assert.match(core,/release-status\.json/);
  assert.doesNotMatch(html,/sb_secret_|supabaseAnonKey|service_role/);
});
