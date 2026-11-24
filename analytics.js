import config from './config.js';
import { readLocal, writeLocal, anonymousId } from './storage.js';

const EVENTS = [
  'page_view', 'search', 'filter_used', 'place_view', 'save_place', 'share_place',
  'companion_interest', 'premium_willingness',
  'rhythm_start', 'desire_selected', 'activity_selected', 'companion_selected',
  'condition_selected', 'recommendation_view', 'recommendation_save', 'recommendation_share',
];
const AGE = ['40~44', '45~49', '50~54', '55~59', '60~64', '65~69', '70+'];
const ARRAY_FIELDS = ['desires', 'activities', 'companions', 'comfort_preferences'];
const SCALAR_FIELDS = [
  'filter', 'companion', 'walking', 'parking', 'stairs', 'result_count',
  'duration', 'transport', 'recommended_activity',
  'age', 'preference', 'purpose', 'group_size', 'willingness', 'response_id',
];

// UI의 logical event와 서버 event를 분리해 이름을 정확히 유지합니다.
// 현재 저장 대상은 place이므로 rhythm_save/share는 recommendation_save/share로 기록합니다.
export const RHYTHM_EVENT_MAP = {
  rhythm_start: 'rhythm_start',
  companion_selected: 'companion_selected',
  desire_selected: 'desire_selected',
  activity_selected: 'activity_selected',
  condition_selected: 'condition_selected',
  recommendation_view: 'recommendation_view',
  rhythm_save: 'recommendation_save',
  rhythm_share: 'recommendation_share',
  companion_interest: 'companion_interest',
  premium_willingness: 'premium_willingness',
};

export function trackRhythm(name, values = {}) {
  const event = RHYTHM_EVENT_MAP[name];
  if (!event) return Promise.resolve(false);
  if (typeof document.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    document.dispatchEvent(new CustomEvent('naerhythm:analytics', {
      detail: { name, event, isDemo: Boolean(values.is_demo), placeId: values.place_id || null },
    }));
  }
  return track(event, values);
}

export const analyticsEnabled = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl || '') && Boolean(config.supabaseAnonKey);
let sessionId;
const recent = new Map();
// 운영 연결 이상을 '저장 실패' 한 문장으로 숨기지 않고, 기기 내 화면에서만 분류합니다.
// 오류 응답 원문, 응답 데이터 및 연락처를 콘솔이나 분석 서버로 재전송하지 않습니다.
let lastConsentSaveFailure = null;
export function consentSaveFailure() { return lastConsentSaveFailure; }
function session() {
  if (sessionId) return sessionId;
  const stored = readLocal('pyeonhanga.session', null);
  sessionId = typeof stored === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(stored) ? stored : anonymousId();
  writeLocal('pyeonhanga.session', sessionId);
  return sessionId;
}
function duplicate(event, row) {
  if (event === 'premium_willingness') return false;
  const key = `${event}|${row.place_id || ''}|${JSON.stringify(row.details)}`;
  const now = Date.now(), previous = recent.get(key) || 0;
  recent.set(key, now);
  if (recent.size > 80) for (const [k, at] of recent) if (now - at > 5000) recent.delete(k);
  return now - previous < 750;
}

// 검색어, URL query, referrer, IP, 브라우저 정보, 자유입력 자연어 원문은 전송하지 않습니다.
// 서버로의 이벤트 전송은 동행 설문에 명시적으로 동의한 제출에서만 허용합니다.
// 일반 방문·활동·저장 클릭은 브라우저 내에서만 처리하며 익명 식별자를 만들지 않습니다.
export async function track(event, values = {}) {
  return false;
}

// 동행 수요 조사 동의 체크 후 호출하는 전용 함수입니다.
// 매번 호출 시 딱 세 가지 수요 지표만 기록하며 일반 탐색 추적 권한을 부여하지 않습니다.
export async function recordConsentedSurvey(values = {}) {
  lastConsentSaveFailure = null;
  if (!analyticsEnabled) {
    lastConsentSaveFailure = 'not-configured';
    return false;
  }
  const base = { ...values };
  const survey = await sendConsentedEvent('premium_willingness', base);
  if (!survey) return false;
  // 실제 설문이 저장된 뒤에만 역으로 선택 단계를 기록합니다.
  // 목적/연령대/서비스비 응답은 완료 이벤트에만 넣고 선택 이벤트에는 재전송하지 않습니다.
  const engagement = {
    place_id: base.place_id, region: base.region,
    category: base.category, is_demo: base.is_demo,
    activities: base.activities, desires: base.desires,
  };
  await sendConsentedEvent('companion_interest', engagement);
  if (Array.isArray(base.activities) && base.activities.length) {
    await sendConsentedEvent('activity_selected', engagement);
  }
  lastConsentSaveFailure = null;
  return true;
}

async function sendConsentedEvent(event, values = {}) {
  if (!analyticsEnabled || !EVENTS.includes(event)) return false;
  const row = {
    event_name: event,
    session_id: session(),
    page: document.body.dataset.page || 'home',
    place_id: values.place_id || null,
    region: values.region || null,
    category: values.category || null,
    is_demo: Boolean(values.is_demo),
    details: {},
  };
  for (const key of SCALAR_FIELDS) if (values[key] !== undefined) row.details[key] = values[key];
  for (const key of ARRAY_FIELDS) if (Array.isArray(values[key])) row.details[key] = [...new Set(values[key])];
  if (row.details.age && !AGE.includes(row.details.age)) delete row.details.age;
  if (duplicate(event, row)) return true;
  try {
    const headers = { 'Content-Type': 'application/json', apikey: config.supabaseAnonKey };
    // 새 publishable 키는 JWT가 아니므로 Bearer 토큰으로 보내지 않습니다.
    if (!config.supabaseAnonKey.startsWith('sb_publishable_')) headers.Authorization = `Bearer ${config.supabaseAnonKey}`;
    const res = await fetch(`${config.supabaseUrl}/rest/v1/rpc/record_event`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ payload: row }),
      keepalive: true,
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) return true;
    const payload = await res.json().catch(() => null);
    const code = typeof payload?.code === 'string' ? payload.code : '';
    if (res.status === 404 || code === 'PGRST202') lastConsentSaveFailure = 'rpc-not-installed';
    else if (res.status === 401 || res.status === 403) lastConsentSaveFailure = 'permission';
    else if (res.status === 400 || res.status === 409 || res.status === 422) lastConsentSaveFailure = 'schema';
    else lastConsentSaveFailure = 'server';
    return false;
  } catch {
    lastConsentSaveFailure = 'network';
    return false;
  }
}
