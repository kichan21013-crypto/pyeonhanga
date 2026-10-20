import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectPilotCandidates } from './enrich-tourapi-pilot.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(root, process.env.BARRIERFREE_SOURCE || 'data/places.json');
const reportPath = resolve(root, process.env.BARRIERFREE_REPORT || 'data/barrierfree-enrichment-report.json');
const API_BASE = 'https://apis.data.go.kr/B551011/KorWithService1';
const DEFAULT_PER_REGION = 8;
const FACT_FIELDS = [
  'parking','route','publictransport','ticketoffice','promotion',
  'wheelchair','exit','elevator','restroom','auditorium','room','handicapetc',
  'braileblock','helpdog','guidehuman','audioguide','bigprint','brailepromotion','guidesystem','blindhandicapetc',
  'signguide','videoguide','hearingroom','hearinghandicapetc','stroller','lactationroom','babysparechair','infantsfamilyetc',
];

function clean(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getServiceKey() {
  const key = process.env.TOUR_API_KEY2;
  if (!key) throw new Error('TOUR_API_KEY2가 필요합니다. GitHub Repository secret을 확인하세요.');
  let decoded = key.trim();
  try { decoded = decodeURIComponent(decoded); } catch {}
  return decoded;
}

function firstItem(json) {
  const raw = json?.response?.body?.items?.item;
  if (Array.isArray(raw)) return raw[0] || null;
  return raw && typeof raw === 'object' ? raw : null;
}

async function fetchBarrierFree(contentId) {
  const url = new URL(`${API_BASE}/detailWithTour1`);
  url.search = new URLSearchParams({
    serviceKey: getServiceKey(),
    MobileOS: 'ETC',
    MobileApp: 'Nagachi',
    _type: 'json',
    numOfRows: '20',
    pageNo: '1',
    contentId: String(contentId),
  });
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  } catch (error) {
    throw new Error(`detailWithTour1 네트워크 오류: ${error?.name === 'TimeoutError' ? '시간 초과' : '요청 실패'}`);
  }
  const text = await response.text();
  if (!response.ok) throw new Error(`detailWithTour1 HTTP ${response.status}`);
  let json;
  try { json = JSON.parse(text); } catch { throw new Error('detailWithTour1 JSON 응답 형식 오류'); }
  const code = json?.response?.header?.resultCode;
  if (code && code !== '0000') throw new Error(`detailWithTour1 API 오류 ${code}: ${clean(json?.response?.header?.resultMsg)}`);
  return firstItem(json);
}

export function extractBarrierFreeFacts(item = {}) {
  const facts = {};
  for (const key of FACT_FIELDS) {
    const value = clean(item?.[key]);
    facts[key] = value || null;
  }
  return facts;
}

export function summarizeBarrierFreeFacts(facts) {
  const knownFields = FACT_FIELDS.filter(key => facts?.[key]).length;
  return {
    knownFields,
    totalFields: FACT_FIELDS.length,
    hasMobilityInfo: Boolean(facts?.wheelchair || facts?.route || facts?.exit || facts?.elevator),
    hasRestroomInfo: Boolean(facts?.restroom),
    hasParkingInfo: Boolean(facts?.parking),
    hasFamilyInfo: Boolean(facts?.stroller || facts?.lactationroom || facts?.babysparechair || facts?.infantsfamilyetc),
    hasVisualInfo: Boolean(facts?.braileblock || facts?.helpdog || facts?.guidehuman || facts?.audioguide || facts?.bigprint || facts?.brailepromotion || facts?.guidesystem || facts?.blindhandicapetc),
    hasHearingInfo: Boolean(facts?.signguide || facts?.videoguide || facts?.hearingroom || facts?.hearinghandicapetc),
  };
}

async function main() {
  const places = JSON.parse(await readFile(sourcePath, 'utf8'));
  const perRegion = Math.min(12, Math.max(2, Number(process.env.BARRIERFREE_PER_REGION) || DEFAULT_PER_REGION));
  const selected = selectPilotCandidates(places, perRegion);
  const matched = [];
  const unmatched = [];
  const errors = [];

  for (let index = 0; index < selected.length; index++) {
    const place = selected[index];
    try {
      const item = await fetchBarrierFree(place.tourApi?.contentId);
      if (!item) {
        unmatched.push({ id: place.id, name: place.name, region: place.region, contentId: place.tourApi?.contentId || null });
        console.log(`[${index + 1}/${selected.length}] ${place.region} · ${place.name} 무장애 상세 없음`);
      } else {
        const facts = extractBarrierFreeFacts(item);
        matched.push({
          id: place.id,
          name: place.name,
          region: place.region,
          category: place.category,
          contentId: place.tourApi?.contentId || null,
          facts,
          completeness: summarizeBarrierFreeFacts(facts),
        });
        console.log(`[${index + 1}/${selected.length}] ${place.region} · ${place.name} 무장애 상세 완료`);
      }
    } catch (error) {
      errors.push({ id: place.id, name: place.name, region: place.region, message: error.message });
      console.error(`[${index + 1}/${selected.length}] ${place.name}: ${error.message}`);
    }
    await new Promise(resolvePromise => setTimeout(resolvePromise, 120));
  }

  const byRegion = matched.reduce((acc, item) => {
    acc[item.region] = (acc[item.region] || 0) + 1;
    return acc;
  }, {});
  const count = predicate => matched.filter(item => predicate(item.facts)).length;
  const report = {
    generatedAt: new Date().toISOString(),
    source: sourcePath.replace(root + '/', ''),
    service: 'Korea Tourism Organization KorWithService1/detailWithTour1',
    strategy: `same region-balanced pilot as TourAPI detail enrichment, up to ${perRegion} per region`,
    summary: {
      selected: selected.length,
      matched: matched.length,
      unmatched: unmatched.length,
      errors: errors.length,
      matchRate: selected.length ? Number((matched.length / selected.length * 100).toFixed(1)) : 0,
      byRegion,
      withParking: count(f => f.parking),
      withRoute: count(f => f.route),
      withWheelchair: count(f => f.wheelchair),
      withElevator: count(f => f.elevator),
      withRestroom: count(f => f.restroom),
      withPublicTransport: count(f => f.publictransport),
      withStroller: count(f => f.stroller),
      withFamilyInfo: matched.filter(item => item.completeness.hasFamilyInfo).length,
      withVisualInfo: matched.filter(item => item.completeness.hasVisualInfo).length,
      withHearingInfo: matched.filter(item => item.completeness.hasHearingInfo).length,
    },
    errors,
    unmatched,
    places: matched,
    note: '원문 무장애 정보를 수집한 검증 리포트이며 comfort 좋음/보통/부담 있음 평가는 자동 생성하지 않습니다.',
  };

  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(`무장애 파일럿 완료: 매칭 ${matched.length}/${selected.length}개 · 미매칭 ${unmatched.length}개 · 오류 ${errors.length}개`);
  console.log(`- 주차 ${report.summary.withParking} · 이동경로 ${report.summary.withRoute} · 휠체어 ${report.summary.withWheelchair} · 엘리베이터 ${report.summary.withElevator} · 화장실 ${report.summary.withRestroom}`);
  console.log(`리포트: ${reportPath.replace(root + '/', '')}`);
  if (errors.length > Math.max(3, Math.floor(selected.length * 0.2))) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
