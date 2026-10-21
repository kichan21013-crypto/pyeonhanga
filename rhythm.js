import { inferIntent, recommendPlaces, requestedComforts, companionCode, COMPANIONS } from './search.js';

export const DESIRES = {
  eat: { label: '맛있는 걸 먹고 싶어요', icon: 'food', tone: 'food', activities: ['korean_food','noodle','meat','seafood','cafe'], tags: ['food','korean_food','noodle','meat','seafood','cafe'] },
  move: { label: '몸을 움직이고 싶어요', icon: 'running', tone: 'run', activities: ['walk','run','hike','bike'] },
  outdoor: { label: '바람 쐬고 싶어요', icon: 'garden', tone: 'walk', activities: ['walk','drive','sea','scenery'] },
  rest: { label: '편하게 쉬고 싶어요', icon: 'rest', tone: 'rest', activities: ['cafe','quiet_rest','scenery'] },
  explore: { label: '새로운 곳에 가고 싶어요', icon: 'travel', tone: 'drive', activities: ['outing','drive','travel','culture'] },
  social: { label: '사람들과 어울리고 싶어요', icon: 'people', tone: 'rest', activities: ['conversation','food','cafe'] },
};
export const ACTIVITIES = {
  food: ['식사','food','food'], korean_food: ['한식','food','food'], noodle: ['면요리','food','food'], meat: ['고기','food','food'], seafood: ['회·해산물','food','food'], cafe: ['카페','cafe','cafe'],
  walk: ['걷기','walking','walk'], run: ['러닝','running','run'], hike: ['등산','mountain','hike'], bike: ['자전거','bike','drive'],
  drive: ['드라이브','car','drive'], sea: ['바다 보기','sea','sea'], scenery: ['풍경 보기','garden','walk'], quiet_rest: ['조용히 쉬기','rest','rest'],
  outing: ['나들이','garden','walk'], travel: ['여행','travel','drive'], culture: ['문화생활','culture','culture'], conversation: ['대화','people','rest'],
};
export const DURATION_OPTIONS = { short: '1~2시간', half_day: '반나절', full_day: '하루', any: '상관없음' };
export const TRANSPORT_OPTIONS = { car: '차로', transit: '대중교통', any: '상관없음' };
export const COMFORT_OPTIONS = { parking: '주차 편함', walking: '걷기 적게', stairs: '계단 적음', restroom: '화장실', noise: '조용함', seating: '좌석 편함', waiting: '대기 적음' };
export function emptyRhythmFilters() {
  return { query: '', region: '', category: 'auto', companions: [], desires: [], activities: [], duration: 'any', transport: 'any', comforts: [], comfortOverrides: {}, requiredComforts: [], walking: '', parking: false, stairs: false };
}
export function toggleSelection(values, value) { return values.includes(value) ? values.filter(v => v !== value) : [...values,value]; }
export function activeActivities(desires, activities) {
  const allowed = new Set(desires.flatMap(key => DESIRES[key]?.activities || []));
  return activities.filter(key => allowed.has(key));
}
export function companionSummary(values) { return values.map(companionCode).filter(Boolean).map(key => COMPANIONS[key]).join(' · '); }
function activityTags(p) {
  const tags = new Set(p.intentTags || []);
  if (p.activityType && p.activityType !== 'unknown') tags.add(p.activityType);
  if (p.category === '맛집') tags.add('food');
  if (p.category === '여행') tags.add('travel');
  if (p.category === '나들이') tags.add('outing');
  return tags;
}
function hasActivity(tags, key) {
  if (key === 'food') return ['food','noodle','korean_food','meat','seafood'].some(v => tags.has(v));
  return tags.has(key);
}
export function unknownRoute() {
  return { distanceKm: 'unknown', difficulty: 'unknown', flatness: 'unknown', restroom: 'unknown', parking: 'unknown', lighting: 'unknown', crowd: 'unknown', scenery: 'unknown', loop: 'unknown', sourceUrl: null, verifiedAt: null };
}
export function recommendRhythms(places, f = emptyRhythmFilters()) {
  const intent = inferIntent(f.query), selectedCompanions = [...new Set((f.companions?.length ? f.companions : intent.companion ? [intent.companion] : []).map(companionCode).filter(Boolean))];
  const selectedDesires = (f.desires || []).filter(key => DESIRES[key]);
  const selectedActivities = activeActivities(selectedDesires, f.activities || []);
  const desiredTags = selectedDesires.flatMap(key => {
    const explicit = selectedActivities.filter(tag => DESIRES[key].activities.includes(tag));
    return explicit.length ? explicit : DESIRES[key].tags || DESIRES[key].activities;
  });
  const parsedTags = intent.intents.filter(key => ACTIVITIES[key]);
  const wanted = [...new Set([...desiredTags,...selectedActivities,...parsedTags])];
  const candidates = recommendPlaces(places, { ...f, query: intent.tokens.join(' '), companion: '', comforts: requestedComforts(f,intent), category: f.category || '', region: f.region || (intent.regions.length === 1 ? intent.regions[0] : '') });
  const ranked = candidates.map(candidate => {
    const p = candidate.place, tags = activityTags(p), matches = wanted.filter(key => hasActivity(tags,key));
    if (intent.regions.length > 1 && !f.region && !intent.regions.includes(p.region)) return null;
    const companionMatches = selectedCompanions.filter(key => p.companions?.some(value => companionCode(value) === key)).length;
    // 알 수 없는 동행 적합성은 허위 일치로 세지 않으며, 확인된 하나 이상의 일치를 먼저 추천합니다.
    const desireMatches = selectedDesires.filter(key => (DESIRES[key].tags || DESIRES[key].activities).some(tag => hasActivity(tags,tag))).length;
    const visit = p.visitContext, verifiedVisit = Boolean(visit?.sourceUrl && visit?.verifiedAt);
    const durationMatch = verifiedVisit && f.duration !== 'any' && visit.duration === f.duration ? 1 : 0;
    const transportMatch = verifiedVisit && ['car','transit'].includes(f.transport) && visit.transportModes?.includes(f.transport) ? 1 : 0;
    // 현재 위치를 수집하지 않으므로 '가까운 곳'과 이동시간을 임의로 만들지 않습니다.
    const conditionMatches = candidate.matchedComforts + durationMatch + transportMatch;
    const activity = matches.find(key => !['food','outing','travel'].includes(key)) || matches[0] || [...tags].find(key => ACTIVITIES[key]) || 'outing';
    const label = ACTIVITIES[activity]?.[0] || '장소 둘러보기';
    const route = p.route?.sourceUrl && p.route?.verifiedAt ? p.route : unknownRoute();
    const fallbackActivity = Boolean(wanted.length && !matches.length && desireMatches > 0);
    const fallbackReason = !p.isDemo && fallbackActivity ? '선택한 세부 활동 정보는 부족해 비슷한 유형부터 보여드려요' : null;
    return { ...candidate, id: `rhythm-${p.id}`, title: `${label} · ${p.name}`, activityType: activity, conditionMatches, companionMatches, desireMatches, activityMatches: matches.length, fallbackActivity,
      plan: { region: p.region, stops: [{ placeId: p.id, activityType: activity }], transfers: [], duration: verifiedVisit ? visit.duration : 'unknown', distanceKm: route.distanceKm, isDemo: Boolean(p.isDemo) },
      reasons: [...candidate.reasons, ...(fallbackReason ? [fallbackReason] : []), ...(!p.isDemo && durationMatch ? [`확인된 체류 시간: ${DURATION_OPTIONS[f.duration]}`] : []), ...(!p.isDemo && transportMatch ? [`${TRANSPORT_OPTIONS[f.transport]} 방문 정보 확인`] : [])].slice(0,2),
    };
  }).filter(Boolean);

  // 세부 활동이 희소해도 같은 욕구(예: 러닝→걷기/등산)의 후보는 남긴다.
  const related = wanted.length ? ranked.filter(result => result.activityMatches > 0 || result.desireMatches > 0) : ranked;
  const pool = related.length ? related : ranked;
  return pool.sort((a,b) => b.conditionMatches-a.conditionMatches || b.companionMatches-a.companionMatches || b.activityMatches-a.activityMatches || b.desireMatches-a.desireMatches || b.relevance-a.relevance || a.order-b.order);
}
