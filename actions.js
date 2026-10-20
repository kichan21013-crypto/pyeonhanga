import { savedIds, writeLocal } from './storage.js';
export function toggleSavedPlace(id) {
  const ids = savedIds(), removing = ids.includes(id);
  const ok = writeLocal('pyeonhanga.saved',removing ? ids.filter(value=>value!==id) : [...ids,id]);
  return { ok, removing };
}
// 플랫폼 API를 주입할 수 있게 해 기존 공유 동작을 브라우저 없이도 회귀 검사합니다.
export async function shareOrCopy(data, platform = navigator) {
  if (typeof platform.share === 'function') {
    try { await platform.share(data); return 'shared'; }
    catch (error) { if (error?.name === 'AbortError') return 'cancelled'; }
  }
  try { if (!platform.clipboard?.writeText) return 'manual'; await platform.clipboard.writeText(data.url); return 'copied'; }
  catch { return 'manual'; }
}
export const SURVEY_CHOICES = {
  age: ['50~54','55~59','60~64','65~69','70+'], preference: ['동성 선호','혼성 선호','성별 상관없음','새로운 이성도 괜찮음'],
  purpose: ['식사동행','나들이동행','여행동행','취미친구','데이트도 괜찮음'], group_size: ['2명','3~4명','5~8명','상관없음'],
  willingness: ['무료면 참여','약 1만원','약 2만원','약 3만원 이상','아직 모르겠음'],
};
