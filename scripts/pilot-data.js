const REGIONS = ['서울','경기','강릉','경주','부산','제주'];
const TARGET_PER_REGION = 6;
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
    selected.push(...pickBalanced(regionItems, targetPerRegion));
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
    base.pilotRankScore = item._score;
    return base;
  });
}
