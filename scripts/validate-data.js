const required = ['id', 'slug', 'name', 'category', 'region', 'address', 'latitude', 'longitude', 'shortDescription', 'image', 'priceRange', 'sourceName', 'sourceUrl', 'lastVerifiedAt', 'comfort', 'isDemo'];
const keys = ['parking', 'stairs', 'accessibility', 'restroom', 'seating', 'walking', 'noise', 'waiting'];
export function validatePlaces(places) {
  if (!Array.isArray(places)) throw new Error('places.json은 배열이어야 합니다.');
  const ids = new Set(), slugs = new Set();
  for (const p of places) {
    for (const field of required) if (!Object.hasOwn(p, field)) throw new Error(`${p.id}: ${field} 필드 누락`);
    if (typeof p.id !== 'string' || !/^[a-z0-9-]{1,100}$/.test(p.id) || typeof p.slug !== 'string' || !/^[a-z0-9-]+$/.test(p.slug)) throw new Error('id 또는 slug 형식 오류');
    if (ids.has(p.id) || slugs.has(p.slug)) throw new Error(`중복 id/slug: ${p.id}`);
    ids.add(p.id); slugs.add(p.slug);
    if (!['맛집', '나들이', '여행'].includes(p.category)) throw new Error(`${p.id}: 카테고리 오류`);
    if (!['서울', '경기', '강릉', '경주', '부산', '제주'].includes(p.region)) throw new Error(`${p.id}: 지역 오류`);
    for (const field of ['name','address','shortDescription','image','priceRange','sourceName']) if (typeof p[field] !== 'string' || !p[field].trim()) throw new Error(`${p.id}: ${field}에 텍스트가 필요합니다.`);
    if (p.companions && (!Array.isArray(p.companions) || p.companions.some(v => !['혼자','배우자/연인','친구','가족','새로운 사람'].includes(v)))) throw new Error(`${p.id}: 동행 태그 오류`);
    if (typeof p.isDemo !== 'boolean') throw new Error(`${p.id}: isDemo는 boolean이어야 합니다.`);
    if (!p.isDemo && (!/^https:\/\//.test(p.sourceUrl || '') || !/^\d{4}-\d{2}-\d{2}$/.test(p.lastVerifiedAt || ''))) throw new Error(`${p.id}: 실제 장소에는 출처 URL과 확인 날짜가 필요합니다.`);
    for (const [key, min, max] of [['latitude', -90, 90], ['longitude', -180, 180]]) if (p[key] !== null && (!Number.isFinite(p[key]) || p[key] < min || p[key] > max)) throw new Error(`${p.id}: 좌표 오류`);
    for (const key of keys) {
      const f = p.comfort[key];
      if (!f || !['good', 'moderate', 'poor', 'unknown'].includes(f.value)) throw new Error(`${p.id}: ${key} 값 오류`);
      if (f.value !== 'unknown' && (!/^https:\/\//.test(f.sourceUrl || '') || !/^\d{4}-\d{2}-\d{2}$/.test(f.verifiedAt || '') || !f.note)) throw new Error(`${p.id}: ${key}의 근거/확인일/설명이 필요합니다.`);
    }
  }
  return true;
}
