import config from './config.js';
import { readLocal, writeLocal, anonymousId } from './storage.js';
const EVENTS = ['page_view', 'search', 'filter_used', 'place_view', 'save_place', 'share_place', 'companion_interest', 'premium_willingness'];
const AGE = ['50~54', '55~59', '60~64', '65~69', '70+'];
// 운영 스키마의 8종 이벤트는 그대로 유지합니다. 새 이름은 클라이언트 논리 이벤트입니다.
// TODO(실제 공개 테스트 전 필수): 선택→추천→동행 관심→지불의향을 연결하는 context analytics.
// selected_desires, selected_activities, companions, duration, transport,
// selected_comfort_preferences, recommended_rhythm/recommended_activity, place_id, premium_willingness.
// 현재는 이 context를 새로 전송하지 않습니다. 기존 place_id/지불의향 저장만 유지합니다.
// 운영 스키마/record_event 허용 목록·검증/KPI/DEMO·RLS를 별도 검토한 뒤 확장합니다.
// 자유입력 자연어 원문은 계속 서버 전송 금지. README의 공개 테스트 전 TODO 참조.
export const RHYTHM_EVENT_MAP = { rhythm_start: 'filter_used', companion_selected: 'filter_used', desire_selected: 'filter_used', activity_selected: 'filter_used', condition_selected: 'filter_used', recommendation_view: 'search', rhythm_save: 'save_place', rhythm_share: 'share_place', companion_interest: 'companion_interest', premium_willingness: 'premium_willingness' };
export function trackRhythm(name, values = {}) {
  const legacy = RHYTHM_EVENT_MAP[name];
  if (!legacy) return Promise.resolve(false);
  const filter = name === 'companion_selected' ? 'companion' : ['desire_selected','activity_selected'].includes(name) ? 'category' : undefined;
  if (typeof document.dispatchEvent === 'function' && typeof CustomEvent === 'function') document.dispatchEvent(new CustomEvent('naerhythm:analytics', { detail: { name, legacyEvent: legacy, isDemo: Boolean(values.is_demo), placeId: values.place_id || null } }));
  return track(legacy, { ...values, ...(filter ? { filter } : {}) });
}
export const analyticsEnabled = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl || '') && Boolean(config.supabaseAnonKey);
let sessionId;
function session() {
  if (sessionId) return sessionId;
  const stored = readLocal('pyeonhanga.session', null);
  sessionId = typeof stored === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(stored) ? stored : anonymousId();
  writeLocal('pyeonhanga.session', sessionId);
  return sessionId;
}
// 검색어, URL query, referrer, IP, 브라우저 정보, 자유 입력은 전송하지 않습니다.
export async function track(event, values = {}) {
  if (!analyticsEnabled || !EVENTS.includes(event)) return false;
  const row = { event_name: event, session_id: session(), page: document.body.dataset.page || 'home',
    place_id: values.place_id || null, region: values.region || null, category: values.category || null,
    is_demo: Boolean(values.is_demo), details: {} };
  const allowed = ['filter', 'companion', 'walking', 'parking', 'stairs', 'result_count', 'age', 'preference', 'purpose', 'group_size', 'willingness', 'response_id'];
  for (const key of allowed) if (values[key] !== undefined) row.details[key] = values[key];
  if (row.details.age && !AGE.includes(row.details.age)) delete row.details.age;
  try {
    const headers = { 'Content-Type': 'application/json', apikey: config.supabaseAnonKey };
    // 새 publishable 키는 JWT가 아니므로 Bearer 토큰으로 보내지 않습니다.
    if (!config.supabaseAnonKey.startsWith('sb_publishable_')) headers.Authorization = `Bearer ${config.supabaseAnonKey}`;
    const res = await fetch(`${config.supabaseUrl}/rest/v1/rpc/record_event`, {
      method: 'POST', headers,
      body: JSON.stringify({ payload: row }), keepalive: true, signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch { return false; }
}
