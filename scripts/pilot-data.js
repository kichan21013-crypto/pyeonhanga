import { auditTourApiPlaces } from './tourapi-quality.js';
import { scoreRecommendationReadiness } from './recommendation-readiness.js';

const REGIONS = ['서울','경기','강릉','경주','부산','제주'];
const TARGET_PER_REGION = 8;
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

function reserveCount(count) {
  if (count >= 6) return 2;
  if (count >= 2) return 1;
  return 0;
}

function pickBalanced(items, count = TARGET_PER_REGION) {
  const selected = [];
  const selectedIds = new Set();
  const reserveEach = reserveCount(count);
  const pick = item => {
    if (!item || selectedIds.has(item.id) || selected.length >= count) return;
    selected.push(item);
    selectedIds.add(item.id);
  };

  for (const category of ['나들이','맛집']) {
    items.filter(item => item.category === category).slice(0, reserveEach).forEach(pick);
  }
  for (const item of items) pick(item);
  return selected.slice(0, count);
}

function latestReferenceDate(audited, generalReport, barrierReport) {
  if (generalReport?.generatedAt) return generalReport.generatedAt;
  if (barrierReport?.generatedAt) return barrierReport.generatedAt;
  return audited.map(item => item.modifiedTime).filter(Boolean).sort().at(-1) || null;
}

export function buildPilotPlaces(places, generalReport, barrierReport, targetPerRegion = TARGET_PER_REGION) {
  const placeMap = new Map(places.map(place => [place.id, place]));
  const detailMap = new Map((generalReport?.places || []).map(item => [item.id, item]));
  const barrierMap = new Map((barrierReport?.places || []).map(item => [item.id, item]));
  const { audited } = auditTourApiPlaces(places);
  const qualityCandidates = audited.filter(item => item.role === 'place' && item.status === 'candidate');
  const referenceDate = latestReferenceDate(qualityCandidates, generalReport, barrierReport);

  const candidates = qualityCandidates.map(audit => {
    const place = placeMap.get(audit.id);
    if (!place) return null;
    const detail = detailMap.get(audit.id) || null;
    const barrier = barrierMap.get(audit.id) || null;
    const readiness = scoreRecommendationReadiness({ place, audit, detail, barrier, referenceDate });
    return {
      id: place.id,
      name: place.name,
      region: place.region,
      category: place.category,
      modifiedTime: detail?.modifiedTime || place.tourApi?.modifiedTime || null,
      _place: place,
      _detail: detail,
      _barrier: barrier,
      _readiness: readiness,
    };
  }).filter(Boolean);

  const selected = [];
  for (const region of REGIONS) {
    const regionItems = candidates.filter(item => item.region === region).sort((a,b) =>
      b._readiness.score - a._readiness.score
      || String(b.modifiedTime || '').localeCompare(String(a.modifiedTime || ''))
      || a.name.localeCompare(b.name,'ko'));
    selected.push(...pickBalanced(regionItems, targetPerRegion));
  }

  const reportDate = String(generalReport?.generatedAt || barrierReport?.generatedAt || '').slice(0,10);
  return selected.map(item => {
    const base = structuredClone(item._place);
    const detail = item._detail;
    if (detail) {
      const repeated = repeatedFacts(detail);
      const generalFacts = {
        parkingText: clean(detail.facts?.parkingText) || null,
        operatingHoursText: clean(detail.facts?.operatingHoursText) || null,
        restDayText: clean(detail.facts?.restDayText) || null,
        infoCenterText: clean(detail.facts?.infoCenterText) || null,
        reservationText: clean(detail.facts?.reservationText) || null,
        seatText: clean(detail.facts?.seatText) || null,
        firstMenuText: clean(detail.facts?.firstMenuText) || null,
        menuText: clean(detail.facts?.menuText) || null,
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
    }
    base.intentTags = derivedIntentTags(base);
    base.recommendationReadiness = item._readiness;
    base.pilotRankScore = item._readiness.score;
    return base;
  });
}
