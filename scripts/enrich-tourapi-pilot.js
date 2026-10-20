import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditTourApiPlaces } from './tourapi-quality.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(root, process.env.TOUR_API_ENRICH_SOURCE || 'data/places.json');
const reportPath = resolve(root, process.env.TOUR_API_ENRICH_REPORT || 'data/tourapi-enrichment-report.json');
const DEFAULT_PER_REGION = 8;
const API_BASE = 'https://apis.data.go.kr/B551011/KorService2';

function clean(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function firstItem(json) {
  const raw = json?.response?.body?.items?.item;
  if (Array.isArray(raw)) return raw[0] || null;
  return raw && typeof raw === 'object' ? raw : null;
}

function items(json) {
  const raw = json?.response?.body?.items?.item;
  if (Array.isArray(raw)) return raw;
  return raw && typeof raw === 'object' ? [raw] : [];
}

function getServiceKey() {
  const key = process.env.TOUR_API_KEY;
  if (!key) throw new Error('TOUR_API_KEY가 필요합니다. GitHub Repository secret을 확인하세요.');
  let decoded = key.trim();
  try { decoded = decodeURIComponent(decoded); } catch {}
  return decoded;
}

async function fetchJson(operation, params) {
  const url = new URL(`${API_BASE}/${operation}`);
  url.search = new URLSearchParams({
    serviceKey: getServiceKey(),
    MobileOS: 'ETC',
    MobileApp: 'Nagachi',
    _type: 'json',
    ...params,
  });
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  } catch (error) {
    throw new Error(`${operation} 네트워크 오류: ${error?.name === 'TimeoutError' ? '시간 초과' : '요청 실패'}`);
  }
  const text = await response.text();
  if (!response.ok) throw new Error(`${operation} HTTP ${response.status}`);
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`${operation} JSON 응답 형식 오류`); }
  const code = json?.response?.header?.resultCode;
  if (code && code !== '0000') throw new Error(`${operation} API 오류 ${code}: ${clean(json?.response?.header?.resultMsg)}`);
  return json;
}

export function selectPilotCandidates(places, perRegion = DEFAULT_PER_REGION) {
  const { audited } = auditTourApiPlaces(places);
  const byId = new Map(places.map(place => [place.id, place]));
  const candidates = audited
    .filter(item => item.role === 'place' && item.status === 'candidate')
    .map(item => byId.get(item.id))
    .filter(Boolean);
  const regions = [...new Set(places.map(place => place.region))];
  const selected = [];
  for (const region of regions) {
    const pool = candidates.filter(place => place.region === region);
    const sortFresh = list => [...list].sort((a, b) => String(b.tourApi?.modifiedTime || '').localeCompare(String(a.tourApi?.modifiedTime || '')) || a.name.localeCompare(b.name, 'ko'));
    const outing = sortFresh(pool.filter(place => place.category === '나들이'));
    const food = sortFresh(pool.filter(place => place.category === '맛집'));
    const quotaEach = Math.floor(perRegion / 2);
    const picked = [...outing.slice(0, quotaEach), ...food.slice(0, quotaEach)];
    const pickedIds = new Set(picked.map(place => place.id));
    for (const place of sortFresh(pool)) {
      if (picked.length >= perRegion) break;
      if (!pickedIds.has(place.id)) {
        picked.push(place);
        pickedIds.add(place.id);
      }
    }
    selected.push(...picked.slice(0, perRegion));
  }
  return selected;
}

export function extractUsefulFacts(common = {}, intro = {}) {
  const pick = (...keys) => {
    for (const key of keys) {
      const value = clean(intro?.[key]);
      if (value) return value;
    }
    return null;
  };
  return {
    overview: clean(common.overview) || null,
    homepage: clean(common.homepage) || null,
    telephone: clean(common.tel) || null,
    parkingText: pick('parking', 'parkingfood'),
    operatingHoursText: pick('usetime', 'opentimefood'),
    restDayText: pick('restdate', 'restdatefood'),
    infoCenterText: pick('infocenter', 'infocenterfood'),
    reservationText: pick('reservationfood'),
    seatText: pick('seat'),
    firstMenuText: pick('firstmenu'),
    menuText: pick('treatmenu'),
    petText: pick('chkpet'),
    babyCarriageText: pick('chkbabycarriage'),
    creditCardText: pick('chkcreditcard', 'chkcreditcardfood'),
  };
}

export function summarizeFacts(facts) {
  const entries = Object.entries(facts).filter(([key]) => !['overview', 'homepage', 'telephone'].includes(key));
  return {
    knownOperationalFacts: entries.filter(([, value]) => Boolean(value)).length,
    totalOperationalFactFields: entries.length,
  };
}

async function enrichPlace(place) {
  const contentId = String(place.tourApi?.contentId || '');
  const contentTypeId = String(place.tourApi?.contentTypeId || '');
  const commonJson = await fetchJson('detailCommon2', {
    contentId,
    defaultYN: 'Y',
    firstImageYN: 'Y',
    areacodeYN: 'Y',
    catcodeYN: 'Y',
    addrinfoYN: 'Y',
    mapinfoYN: 'Y',
    overviewYN: 'Y',
  });
  const introJson = await fetchJson('detailIntro2', { contentId, contentTypeId });
  const infoJson = await fetchJson('detailInfo2', { contentId, contentTypeId, numOfRows: '20', pageNo: '1' });
  const imageJson = await fetchJson('detailImage2', { contentId, imageYN: 'Y', subImageYN: 'Y', numOfRows: '10', pageNo: '1' });
  const common = firstItem(commonJson) || {};
  const intro = firstItem(introJson) || {};
  const repeated = items(infoJson).slice(0, 20);
  const imageItems = items(imageJson).slice(0, 10).map(item => ({
    originimgurl: item.originimgurl || null,
    smallimageurl: item.smallimageurl || null,
    imgname: clean(item.imgname) || null,
    cpyrhtDivCd: item.cpyrhtDivCd ? String(item.cpyrhtDivCd) : null,
  }));
  const facts = extractUsefulFacts(common, intro);
  return {
    id: place.id,
    name: place.name,
    region: place.region,
    category: place.category,
    contentId,
    contentTypeId,
    modifiedTime: place.tourApi?.modifiedTime || null,
    facts,
    completeness: summarizeFacts(facts),
    common: {
      title: clean(common.title) || place.name,
      addr1: clean(common.addr1) || null,
      addr2: clean(common.addr2) || null,
      zipcode: clean(common.zipcode) || null,
      tel: clean(common.tel) || null,
      homepage: clean(common.homepage) || null,
      overview: clean(common.overview) || null,
      firstimage: common.firstimage || null,
      firstimage2: common.firstimage2 || null,
    },
    intro,
    repeatedInfo: repeated,
    images: imageItems,
  };
}

async function main() {
  const places = JSON.parse(await readFile(sourcePath, 'utf8'));
  const perRegion = Math.min(12, Math.max(2, Number(process.env.TOUR_API_ENRICH_PER_REGION) || DEFAULT_PER_REGION));
  const selected = selectPilotCandidates(places, perRegion);
  const enriched = [];
  const errors = [];
  for (let index = 0; index < selected.length; index++) {
    const place = selected[index];
    try {
      enriched.push(await enrichPlace(place));
      console.log(`[${index + 1}/${selected.length}] ${place.region} · ${place.name} 상세정보 완료`);
    } catch (error) {
      errors.push({ id: place.id, name: place.name, region: place.region, message: error.message });
      console.error(`[${index + 1}/${selected.length}] ${place.name}: ${error.message}`);
    }
    await new Promise(resolvePromise => setTimeout(resolvePromise, 120));
  }
  const byRegion = enriched.reduce((acc, item) => {
    acc[item.region] = (acc[item.region] || 0) + 1;
    return acc;
  }, {});
  const withParking = enriched.filter(item => item.facts.parkingText).length;
  const withHours = enriched.filter(item => item.facts.operatingHoursText).length;
  const withOverview = enriched.filter(item => item.facts.overview).length;
  const withExtraImages = enriched.filter(item => item.images.length > 0).length;
  const report = {
    generatedAt: new Date().toISOString(),
    source: sourcePath.replace(root + '/', ''),
    strategy: `region-balanced candidate sample, up to ${perRegion} per region, 나들이/맛집 균형 우선`,
    summary: {
      selected: selected.length,
      enriched: enriched.length,
      errors: errors.length,
      byRegion,
      withOverview,
      withParking,
      withHours,
      withExtraImages,
    },
    errors,
    places: enriched,
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(`상세정보 파일럿 완료: ${enriched.length}/${selected.length}개 · 오류 ${errors.length}개`);
  console.log(`- 설명: ${withOverview}개 · 주차 텍스트: ${withParking}개 · 이용시간: ${withHours}개 · 추가 이미지: ${withExtraImages}개`);
  console.log(`리포트: ${reportPath.replace(root + '/', '')}`);
  if (errors.length > Math.max(3, Math.floor(selected.length * 0.2))) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
