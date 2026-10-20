import { readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePlaces } from './validate-data.js';
export const REGIONS = [
  { name: '서울', areaCode: '1' }, { name: '경기', areaCode: '31' },
  { name: '강릉', areaCode: '32', sigunguCode: '1' }, { name: '경주', areaCode: '35', sigunguCode: '2' },
  { name: '부산', areaCode: '6' }, { name: '제주', areaCode: '39' },
];
export const CONTENT_TYPES = { '39': '맛집', '12': '나들이', '25': '여행' };
function clean(value) { return String(value || '').replace(/<[^>]*>/g, '').trim(); }
export function convertItem(item, region, category, today = new Date().toISOString().slice(0, 10)) {
  const contentId = String(item.contentid || '');
  if (!/^\d+$/.test(contentId) || !item.title) return null;
  const coord = (value, max) => { const n = Number(value); return value && Number.isFinite(n) && n >= -max && n <= max ? n : null; };
  const image = /^https?:\/\//.test(item.firstimage || '') ? item.firstimage.replace(/^http:/, 'https:') : '/assets/garden.svg';
  return {
    id: `tour-${contentId}`, slug: `tour-${contentId}`, name: clean(item.title), category, region,
    address: [clean(item.addr1), clean(item.addr2)].filter(Boolean).join(' ') || '주소 확인 필요',
    latitude: coord(item.mapy, 90), longitude: coord(item.mapx, 180),
    shortDescription: `${region}의 ${category} 장소입니다. 편안함 관련 정보는 추가 확인이 필요합니다.`,
    image, imageAlt: image.startsWith('/assets/') ? '장소 사진이 없어 표시한 대체 일러스트' : clean(item.title),
    priceRange: '확인 전', sourceName: '한국관광공사 TourAPI', sourceUrl: 'https://api.visitkorea.or.kr/',
    lastVerifiedAt: today, isDemo: false, companions: [], intentTags: [], userRating: null,
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
  return { ...incoming, comfort: old.comfort, priceRange: old.priceRange, companions: old.companions || [], intentTags: old.intentTags || [], userRating: old.userRating ?? null, sourceLicense: sameRights ? old.sourceLicense || incoming.sourceLicense : incoming.sourceLicense, imageLicense: sameImage ? old.imageLicense || incoming.imageLicense : incoming.imageLicense };
}
export async function importTourApi() {
  const key = process.env.TOUR_API_KEY;
  if (!key) { console.log('TOUR_API_KEY가 없어 가져오기를 건너뜁니다. 기존 데이터와 사이트는 그대로 사용할 수 있습니다.'); return; }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const target = resolve(root, 'data/places.json');
  const existing = JSON.parse(await readFile(target, 'utf8'));
  const imported = new Map();
  const maxPages = Math.min(100, Math.max(1, Number(process.env.TOUR_API_MAX_PAGES) || 2));
  for (const region of REGIONS) {
    for (const [contentTypeId, category] of Object.entries(CONTENT_TYPES)) {
      for (let page = 1; page <= maxPages; page++) {
        const url = new URL('https://apis.data.go.kr/B551011/KorService2/areaBasedList2');
        let decodedKey = key; try { decodedKey = decodeURIComponent(key); } catch {}
        url.search = new URLSearchParams({ serviceKey: decodedKey, MobileOS: 'ETC', MobileApp: 'Pyeonhanga', _type: 'json', numOfRows: '50', pageNo: String(page), arrange: 'A', areaCode: region.areaCode, contentTypeId, ...(region.sigunguCode ? { sigunguCode: region.sigunguCode } : {}) });
        let json;
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
          if (!response.ok) throw new Error(); json = await response.json();
        } catch { throw new Error('TourAPI 연결 실패. 키의 활성화 상태, 무료 호출 한도, 네트워크를 확인하세요. 기존 파일은 변경하지 않았습니다.'); }
        if (json.response?.header?.resultCode !== '0000') throw new Error('TourAPI 응답 오류. 승인된 키와 API 버전을 확인하세요. 기존 파일은 변경하지 않았습니다.');
        const body = json.response.body;
        const raw = body.items?.item || [];
        const items = Array.isArray(raw) ? raw : [raw];
        for (const item of items) {
          const p = convertItem(item, region.name, category); if (p) imported.set(p.id, p);
        }
        if (page * 50 >= Number(body.totalCount || 0) || items.length === 0) break;
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
  console.log(`${imported.size}개 가져오기 완료. DEMO SAMPLE을 제거하고 실제 장소 ${result.length}개를 보관했습니다. npm run build로 반영하세요.`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  importTourApi().catch(error => { console.error(error.message); process.exitCode = 1; });
}
