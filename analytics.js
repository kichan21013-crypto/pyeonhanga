import config from './config.js';
import { readLocal, writeLocal, anonymousId } from './storage.js';
const EVENTS = ['page_view', 'search', 'filter_used', 'place_view', 'save_place', 'share_place', 'companion_interest', 'premium_willingness'];
const AGE = ['50~54', '55~59', '60~64', '65~69', '70+'];
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
