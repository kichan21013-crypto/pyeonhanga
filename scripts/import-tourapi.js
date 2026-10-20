import { readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePlaces } from './validate-data.js';
import { isKoreaCoordinate } from './tourapi-quality.js';
import { unknownRoute } from '../rhythm.js';
export const REGIONS = [
  { name: '서울', areaCode: '1' }, { name: '경기', areaCode: '31' },
  { name: '강릉', areaCode: '32', sigunguCode: '1' }, { name: '경주', areaCode: '35', sigunguCode: '2' },
  { name: '부산', areaCode: '6' }, { name: '제주', areaCode: '39' },
];
export const CONTENT_TYPES = { '39': '맛집', '12': '나들이', '25': '여행' };
function clean(value) { return String(value || '').replace(/<[^>]*>/g, '').trim(); }
function apiMessage(text) {
  if (!text) return '';
  try {
    const parsed = JSON.parse(text);
    const header = parsed?.response?.header || parsed?.header || parsed;
    return clean(header?.resultMsg || header?.errMsg || header?.cmmMsg || header?.returnAuthMsg || '');
  } catch {}
  for (const tag of ['resultMsg', 'returnAuthMsg', 'errMsg', 'cmmMsg']) {
    const match = String(text).match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([^<\\]]+)(?:\\]\\]>)?</${tag}>`, 'i'));
    if (match?.[1]) return clean(match[1]);
  }
  return '';
}
async function fetchTourJson(url) {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  } catch (error) {
    const reason = error?.name === 'TimeoutError' ? '시간 초과' : '네트워크 요청 실패';
    throw new Error(`TourAPI ${reason}. 잠시 후 다시 시도하세요. 기존 파일은 변경하지 않았습니다.`);
  }
  const text = await response.text();
  const message = apiMessage(text);
  if (!response.ok) {
    throw new Error(`TourAPI HTTP ${response.status}${message ? ` · ${message}` : ''}. 인증키 승인 상태와 호출 URL을 확인하세요. 기존 파일은 변경하지 않았습니다.`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`TourAPI 응답 형식 오류${message ? ` · ${message}` : ''}. 인증키가 막 승인된 경우 잠시 뒤 다시 시도하세요. 기존 파일은 변경하지 않았습니다.`);
  }
}
export function convertItem(item, region, category, today = new Date().toISOString().slice(0, 10)) {
  const contentId = String(item.contentid || '');
  if (!/^\d+$/.test(contentId) || !item.title) return null;
  const lat = Number(item.mapy);
  const lon = Number(item.mapx);
  const coordinateValid = isKoreaCoordinate(lat, lon);
  const image = /^https?:\/\//.test(item.firstimage || '') ? item.firstimage.replace(/^http:/, 'https:') : '/assets/garden.svg';
  return {
    id: `tour-${contentId}`, slug: `tour-${contentId}`, name: clean(item.title), category, region,
    address: [clean(item.addr1), clean(item.addr2)].filter(Boolean).join(' ') || '주소 확인 필요',
    latitude: coordinateValid ? lat : null, longitude: coordinateValid ? lon : null,
    shortDescription: `${region}의 ${category} 장소입니다. 편안함 관련 정보는 추가 확인이 필요합니다.`,
    image, imageAlt: image.startsWith('/assets/') ? '장소 사진이 없어 표시한 대체 일러스트' : clean(item.title),
    priceRange: '확인 전', sourceName: '한국관광공사 TourAPI', sourceUrl: 'https://api.visitkorea.or.kr/',
    lastVerifiedAt: today, isDemo: false, companions: [], intentTags: [], userRating: null,
    activityType: 'unknown', route: unknownRoute(), visitContext: { duration: 'unknown', transportModes: [], sourceUrl: null, verifiedAt: null },
    sourceLicense: { name: null, url: null, attribution: '한국관광공사 TourAPI', copyrightCode: item.cpyrhtDivCd ? String(item.cpyrhtDivCd) : null, usageNotes: null },
    imageLicense: { name: null, url: null, attribution: null, copyrightCode: null, usageNotes: null },
    tourApi: { contentId, contentTypeId: String(item.contenttypeid || ''), operation: 'KorService2/areaBasedList2', modifiedTime: item.modifiedtime || null, importedAt: today, imageSourceUrl: item.firstimage || null },
    comfort: Object.fromEntries(['parking','stairs','accessibility','restroom','seating','walking','noise','waiting'].map(key => [key, { value: 'unknown', note: 'TourAPI 목록에는 해당 편안함 정보가 없어 별도 확인이 필요합니다.', sourceUrl: null, verifiedAt: null, ...(key === 'restroom' ? { proximity: 'unknown' } : {}) }])),
  };
}
export function mergeImportedPlace(old, incoming) {
  if (!old) return incoming;
  const sameImage = (old.tourApi?.imageSourceUrl || old.image) === (incoming.tourApi?.imageSourceUrl || incoming.image);
  const sameRights = old.sourceUrl === incoming.sourceUrl && (old.sourceLicense?.copyrightCode ?? null) === (incoming.sourceLicense?.copyrightCode ?? null);
  // 사진이나 원본 저작권 코드가 바뀌면 과거의 이용 권한을 새 자료에 적용하지 않습니다.
  return { ...incoming, comfort: old.comfort, priceRange: old.priceRange, companions: old.companions || [], intentTags: old.intentTags || [], activityType: old.activityType || incoming.activityType, route: old.route || incoming.route, visitContext: old.visitContext || incoming.visitContext, userRating: old.userRating ?? null, sourceLicense: sameRights ? old.sourceLicense || incoming.sourceLicense : incoming.sourceLicense, imageLicense: sameImage ? old.imageLicense || incoming.imageLicense : incoming.imageLicense };
}
export async function importTourApi() {
  const key = process.env.TOUR_API_KEY;
  if (!key) { console.log('TOUR_API_KEY가 없어 가져오기를 건너뜁니다. 기존 데이터와 사이트는 그대로 사용할 수 있습니다.'); return; }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const target = resolve(root, 'data/places.json');
  const existing = JSON.parse(await readFile(target, 'utf8'));
  const imported = new Map();
  const maxPages = Math.min(100, Math.max(1, Number(process.env.TOUR_API_MAX_PAGES) || 2));
  const rowsPerPage = Math.min(50, Math.max(1, Number(process.env.TOUR_API_ROWS_PER_PAGE) || 50));
  const requestedArrange = String(process.env.TOUR_API_ARRANGE || 'C').toUpperCase();
  const arrange = ['A', 'C', 'D'].includes(requestedArrange) ? requestedArrange : 'C';
  for (const region of REGIONS) {
    for (const [contentTypeId, category] of Object.entries(CONTENT_TYPES)) {
      for (let page = 1; page <= maxPages; page++) {
        const url = new URL('https://apis.data.go.kr/B551011/KorService2/areaBasedList2');
        let decodedKey = key.trim(); try { decodedKey = decodeURIComponent(decodedKey); } catch {}
        url.search = new URLSearchParams({ serviceKey: decodedKey, MobileOS: 'ETC', MobileApp: 'Nagachi', _type: 'json', numOfRows: String(rowsPerPage), pageNo: String(page), arrange, areaCode: region.areaCode, contentTypeId, ...(region.sigunguCode ? { sigunguCode: region.sigunguCode } : {}) });
        const json = await fetchTourJson(url);
        const code = json.response?.header?.resultCode;
        const message = clean(json.response?.header?.resultMsg || '');
        if (code !== '0000') throw new Error(`TourAPI 응답 오류 ${code || 'UNKNOWN'}${message ? ` · ${message}` : ''}. 승인된 키와 API 버전을 확인하세요. 기존 파일은 변경하지 않았습니다.`);
        const body = json.response.body;
        const raw = body.items?.item || [];
        const items = Array.isArray(raw) ? raw : [raw];
        for (const item of items) {
          const p = convertItem(item, region.name, category); if (p) imported.set(p.id, p);
        }
        if (page * rowsPerPage >= Number(body.totalCount || 0) || items.length === 0) break;
        if (page === maxPages) console.log(`${region.name} ${category}: 설정된 ${maxPages}페이지까지 가져왔습니다. 전체 수집에는 TOUR_API_MAX_PAGES를 늘리세요.`);
      }
    }
  }
  if (!imported.size) { console.log('가져온 장소가 없어 기존 파일을 유지합니다.'); return; }
  const merged = new Map(existing.filter(p => !p.isDemo).map(p => [p.id, p]));
  for (const p of imported.values()) {
    const old = merged.get(p.id);
    // 수동으로 확인한 편안함, 가격, 동행 태그는 재수집해도 보존합니다.
    merged.set(p.id, mergeImportedPlace(old, p));
  }
  const result = [...merged.values()]; validatePlaces(result);
  await writeFile(target + '.tmp', JSON.stringify(result, null, 2) + '\n'); await rename(target + '.tmp', target);
  console.log(`${imported.size}개 가져오기 완료. 정렬 ${arrange}. 한국 범위를 벗어난 좌표는 null 처리했습니다. 실제 장소 ${result.length}개를 보관했습니다.`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  importTourApi().catch(error => { console.error(error.message); process.exitCode = 1; });
}
