import { calculateComfort, comfortText } from './comfort-score.js';

export const COMPANIONS = { solo: '혼자', couple: '배우자/연인', friend: '친구', family: '가족', new_people: '새로운 사람' };
export const RECOMMENDATION_WEIGHTS = { text: 10, companion: 6, comfort: 3, category: 2, score: 1 };
export const emptyFilters = () => ({ query: '', region: '', category: 'auto', companion: '', walking: '', parking: false, stairs: false, comforts: [], comfortOverrides: {} });
export function companionCode(value) {
  return Object.hasOwn(COMPANIONS, value) ? value : Object.keys(COMPANIONS).find(key => COMPANIONS[key] === value) || '';
}
const RULES = [
  { tag: 'noodle', category: '맛집', pattern: /칼국수|국수|냉면/g },
  { tag: 'korean_food', category: '맛집', pattern: /한정식|한식|백반/g },
  { tag: 'food', category: '맛집', pattern: /맛있는\s*거|맛있는\s*곳|맛집|식사|식당|밥|먹고|먹을|먹으러/g },
  { tag: 'walk', category: '나들이', pattern: /산책|공원|걷고|걷기/g },
  { tag: 'drive', category: '나들이', pattern: /드라이브/g },
  { tag: 'cafe', category: '나들이', pattern: /카페|커피|찻집/g },
  { tag: 'scenery', category: '나들이', pattern: /바람\s*쐬(?:고|기)?|풍경|경치/g },
  { tag: 'outing', category: '나들이', pattern: /나들이/g },
  { tag: 'sea', category: '여행', pattern: /바다|해안|해변/g },
  { tag: 'travel', category: '여행', pattern: /여행|1박|2박/g },
];
const COMFORT_RULES = {
  parking: /주차\s*(편\S*|필요\S*|가능\S*)?/g,
  walking: /많이\s*걷지\s*않\S*|걷지\s*않\S*|적게\s*걷\S*|덜\s*걷\S*|걷기\s*(?:부담\s*)?적\S*|보행\s*부담\s*적\S*/g,
  stairs: /계단\s*(?:적\S*|없\S*|최소)/g,
  restroom: /화장실\s*(?:가까\S*|근처)/g,
  noise: /조용\S*|한적\S*/g,
  seating: /좌석\s*편\S*|의자\s*편\S*|편한\s*좌석/g,
  waiting: /대기\s*적\S*|웨이팅\s*없\S*|줄\s*서지\s*않\S*|기다리지\s*않\S*/g,
};
function hasMatch(pattern, value) { return new RegExp(pattern.source, pattern.flags.replace('g', '')).test(value); }
export function inferIntent(query = '') {
  let remaining = String(query).toLowerCase().trim();
  const comforts = [];
  if (/주차\s*(?:는|가)?\s*필요\s*없/.test(remaining)) remaining = remaining.replace(/주차\s*(?:는|가)?\s*필요\s*없\S*/g, ' ');
  for (const [key, pattern] of Object.entries(COMFORT_RULES)) {
    if (hasMatch(pattern, remaining)) { comforts.push(key); remaining = remaining.replace(pattern, ' '); }
  }
  const companions = [ ['new_people', /새로운\s*사람/g], ['couple', /배우자|연인/g], ['friend', /친구(?:랑|와|하고)?/g], ['family', /가족(?:이랑|과|하고)?/g], ['solo', /혼자/g] ];
  let companion = '';
  for (const [code, pattern] of companions) if (hasMatch(pattern, remaining)) { companion ||= code; remaining = remaining.replace(pattern, ' '); }
  const regions = ['서울','경기','강릉','경주','부산','제주'].filter(region => remaining.includes(region));
  for (const region of regions) remaining = remaining.replaceAll(region, ' ');
  const intents = [], categories = new Set();
  for (const { tag, category, pattern } of RULES) if (hasMatch(pattern, remaining)) {
    intents.push(tag); categories.add(category); remaining = remaining.replace(pattern, ' ');
  }
  if (regions.some(region => ['강릉','부산','제주'].includes(region))) categories.add('여행');
  if (comforts.includes('walking')) intents.push('low_walking');
  if (comforts.includes('noise')) intents.push('quiet');
  remaining = remaining.replace(/하고|보고|가고|쐬고|마시고|싶어요|싶어|싶다|싶습니다|싶은|어요|오늘|편하게|조금|좀|좋은|있는|곳/g, ' ');
  const tokens = remaining.replace(/[^가-힣a-z0-9\s-]/g, ' ').split(/\s+/).filter(token => token && !/^(과|와|랑|이랑|하고|도|에서|으로|로|을|를|에|가|이|고|한번)$/.test(token));
  return { intents: [...new Set(intents)], category: categories.size === 1 ? [...categories][0] : '', companion, comforts, regions, tokens };
}
export function requestedComforts(f, intent = inferIntent(f.query)) {
  const selected = new Set([...(f.comforts || []), ...intent.comforts]);
  if (f.parking) selected.add('parking'); if (f.stairs) selected.add('stairs'); if (f.walking) selected.add('walking');
  for (const [key, selectedByUser] of Object.entries(f.comfortOverrides || {})) {
    if (selectedByUser) selected.add(key); else selected.delete(key);
  }
  return [...selected].filter(key => Object.hasOwn(COMFORT_RULES, key));
}
function hasEvidence(field) { return Boolean(field?.sourceUrl && field?.verifiedAt); }
export function comfortMatches(p, key, f = {}) {
  const field = p.comfort?.[key];
  if (!hasEvidence(field)) return false;
  // '이용 편함'에서 거리를 추정하지 않습니다. 가까움이 별도로 확인되어야 합니다.
  if (key === 'restroom') return field.proximity === 'near';
  return (key === 'walking' && f.walking === 'moderate' ? ['good', 'moderate'] : ['good']).includes(field.value);
}
function matchesIntent(p, tag, haystack) {
  if (p.intentTags?.includes(tag)) return true;
  if (tag === 'food') return p.category === '맛집';
  if (tag === 'travel') return p.category === '여행';
  const rule = RULES.find(rule => rule.tag === tag);
  return rule ? hasMatch(rule.pattern, haystack) : false;
}
export function recommendationReasons(p, f = emptyFilters()) {
  if (p.isDemo) return [];
  const intent = inferIntent(f.query), selected = requestedComforts(f, intent);
  const phrases = { parking: '주차가 편해요', walking: f.walking === 'moderate' ? '걷기 부담이 보통 이하예요' : '걷기 부담이 적어요', stairs: '계단 없이 들어갈 수 있어요', restroom: '화장실이 가까워요', noise: '조용한 편이에요', seating: '좌석이 편해요', waiting: '대기가 적어요' };
  const reasons = selected.filter(key => comfortMatches(p, key, f)).map(key => phrases[key]);
  const companion = companionCode(f.companion) || intent.companion;
  if (companion && p.sourceUrl && p.lastVerifiedAt && p.companions?.some(value => companionCode(value) === companion)) reasons.push(`${COMPANIONS[companion]} 동행에 맞는 곳으로 분류돼 있어요`);
  if (!reasons.length) {
    const key = ['parking','walking','noise','seating'].find(key => comfortMatches(p, key));
    if (key) reasons.push(comfortText(key, p.comfort[key].value));
  }
  return reasons.slice(0, 2);
}
export function recommendPlaces(places, f = emptyFilters()) {
  const intent = inferIntent(f.query), selected = requestedComforts(f, intent);
  const companion = companionCode(f.companion) || intent.companion;
  const preferredCategory = f.category === 'auto' ? intent.category : f.category;
  const specific = intent.intents.filter(tag => !['food','travel','quiet','low_walking'].includes(tag));
  const searchableIntents = specific.length ? specific : intent.intents.filter(tag => ['food','travel'].includes(tag));
  return places.map((p, order) => {
    if (f.region && p.region !== f.region) return null;
    if (!f.region && intent.regions.length && !intent.regions.includes(p.region)) return null;
    // 자동 분류는 우선순위이므로 카페(맛집)도 나들이에서 찾을 수 있습니다.
    if (f.category && f.category !== 'auto' && p.category !== f.category) return null;
    if (!selected.every(key => comfortMatches(p, key, f))) return null;
    const haystack = `${p.name} ${p.category} ${p.region} ${p.address} ${p.shortDescription}`.toLowerCase();
    if (!intent.tokens.every(token => haystack.includes(token))) return null;
    const intentHits = searchableIntents.filter(tag => matchesIntent(p, tag, haystack)).length;
    if (searchableIntents.length && !intentHits) return null;
    const companionHit = companion && p.companions?.some(value => companionCode(value) === companion) ? 1 : 0;
    const comfort = calculateComfort(p.comfort);
    const relevance = intentHits * RECOMMENDATION_WEIGHTS.text + companionHit * RECOMMENDATION_WEIGHTS.companion
      + selected.length * RECOMMENDATION_WEIGHTS.comfort + (preferredCategory && p.category === preferredCategory ? RECOMMENDATION_WEIGHTS.category : 0)
      + (comfort.score === null ? 0 : comfort.score / 100 * comfort.coverage * RECOMMENDATION_WEIGHTS.score);
    return { place: p, relevance, reasons: recommendationReasons(p, f), order };
  }).filter(Boolean).sort((a,b) => b.relevance - a.relevance || a.order - b.order);
}
export function filterPlaces(places, filters) { return recommendPlaces(places, filters).map(result => result.place); }
