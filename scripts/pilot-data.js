const REGIONS = ['서울','경기','강릉','경주','부산','제주'];
const TARGET_PER_REGION = 12;
const SOURCE_URL = 'https://api.visitkorea.or.kr/';

const clean = value => String(value || '').replace(/<br\s*\/?>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/\s+/g,' ').trim();

function repeatedFacts(item = {}) {
  const facts = {};
  for (const row of item.repeatedInfo || []) {
    const name = clean(row.infoname);
    const text = clean(row.infotext);
    if (!text) continue;
    if (/화장실/.test(name) && !facts.restroomText) facts.restroomText = text;
    if (/입\s*장\s*료|이용요금|요금/.test(name) && !facts.feeText) facts.feeText = text;
  }
  return facts;
}

function derivedIntentTags(place) {
  const tags = new Set(place.intentTags || []);
  const text = `${place.name || ''} ${place.shortDescription || ''}`;
  if (place.category === '맛집') tags.add('food');
  if (place.category === '여행') tags.add('travel');
  if (place.category === '나들이') tags.add('outing');
  if (/카페|커피|다락/.test(text)) ['cafe','quiet_rest','conversation'].forEach(v => tags.add(v));
  if (/칼국수|국수|면|라멘|우동/.test(text)) tags.add('noodle');
  if (/갈비|숯불|고기|암소|돼지|한우/.test(text)) tags.add('meat');
  if (/횟집|회|해물|수산|생선/.test(text)) tags.add('seafood');
  if (/산|오름|계곡/.test(text)) ['hike','walk','scenery'].forEach(v => tags.add(v));
  if (/해변|바다|포구|항|해수욕/.test(text)) ['sea','walk','scenery'].forEach(v => tags.add(v));
  if (/공원|호수|광장|마을|서원|사\(|사$|터널|정원/.test(text)) ['walk','scenery'].forEach(v => tags.add(v));
  return [...tags];
}

function scoreCandidate(item, barrier, place) {
  const general = Number(item?.completeness?.knownOperationalFacts || 0);
  const barrierKnown = Number(barrier?.completeness?.knownFields || 0);
  const hasRealImage = Boolean(place?.tourApi?.imageSourceUrl);
  return general * 3 + barrierKnown * 4 + (hasRealImage ? 2 : 0);
}

function pickBalanced(items, count = TARGET_PER_REGION) {
  const categories = ['나들이','맛집','여행'];
  const selected = [];
  const byCategory = Object.fromEntries(categories.map(category => [category, items.filter(x => x.category === category)]));
  const firstPass = Math.floor(count / 2);
  for (const category of ['나들이','맛집']) selected.push(...byCategory[category].slice(0, firstPass));
  for (const item of items) {
    if (selected.length >= count) break;
    if (!selected.some(x => x.id === item.id)) selected.push(item);
  }
  return selected.slice(0, count);
}

export function buildPilotPlaces(places, generalReport, barrierReport, targetPerRegion = TARGET_PER_REGION) {
  // 상세 수집이 12개/지역까지 완료된 검증판에서는 이전 빌드의 8개 요청도 12개로 승격합니다.
  const publishCount = Math.max(TARGET_PER_REGION, Number(targetPerRegion) || 0);
  const placeMap = new Map(places.map(place => [place.id, place]));
  const barrierMap = new Map((barrierReport?.places || []).map(item => [item.id, item]));
  const candidates = (generalReport?.places || []).map(item => {
    const place = placeMap.get(item.id);
    if (!place) return null;
    const barrier = barrierMap.get(item.id) || null;
    return { ...item, _place: place, _barrier: barrier, _score: scoreCandidate(item, barrier, place) };
  }).filter(Boolean);
  const selected = [];
  for (const region of REGIONS) {
    const regionItems = candidates.filter(item => item.region === region).sort((a,b) => b._score - a._score || String(b.modifiedTime).localeCompare(String(a.modifiedTime)) || a.name.localeCompare(b.name,'ko'));
    selected.push(...pickBalanced(regionItems, publishCount));
  }
  const reportDate = String(generalReport?.generatedAt || new Date().toISOString()).slice(0,10);
  return selected.map(item => {
    const base = structuredClone(item._place);
    const repeated = repeatedFacts(item);
    const generalFacts = {
      parkingText: clean(item.facts?.parkingText) || null,
      operatingHoursText: clean(item.facts?.operatingHoursText) || null,
      restDayText: clean(item.facts?.restDayText) || null,
      infoCenterText: clean(item.facts?.infoCenterText) || null,
      reservationText: clean(item.facts?.reservationText) || null,
      seatText: clean(item.facts?.seatText) || null,
      firstMenuText: clean(item.facts?.firstMenuText) || null,
      menuText: clean(item.facts?.menuText) || null,
      restroomText: repeated.restroomText || null,
      feeText: repeated.feeText || null,
    };
    const barrierFacts = item._barrier ? Object.fromEntries(Object.entries(item._barrier.facts || {}).map(([key,value]) => [key, clean(value) || null])) : {};
    base.verifiedFacts = {
      verifiedAt: reportDate,
      sourceName: '한국관광공사 TourAPI',
      sourceUrl: SOURCE_URL,
      general: generalFacts,
      barrierFree: barrierFacts,
    };
    base.intentTags = derivedIntentTags(base);
    base.pilotRankScore = item._score;
    return base;
  });
}
