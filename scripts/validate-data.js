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
    if (p.companions && (!Array.isArray(p.companions) || p.companions.some(v => !['solo','couple','friend','family','new_people','혼자','배우자/연인','친구','가족','새로운 사람'].includes(v)))) throw new Error(`${p.id}: 동행 태그 오류`);
    if (p.intentTags && (!Array.isArray(p.intentTags) || p.intentTags.some(v => typeof v !== 'string' || !/^[a-z][a-z0-9_]*$/.test(v)))) throw new Error(`${p.id}: 활동 태그 오류`);
    if (p.activityType !== undefined && (typeof p.activityType !== 'string' || !/^[a-z][a-z0-9_]*$/.test(p.activityType))) throw new Error(`${p.id}: activityType 형식 오류`);
    if (p.route) {
      const route = p.route;
      if (route.distanceKm !== 'unknown' && (!Number.isFinite(route.distanceKm) || route.distanceKm < 0)) throw new Error(`${p.id}: 거리 형식 오류`);
      if (![true,false,'unknown'].includes(route.loop)) throw new Error(`${p.id}: 순환 여부 형식 오류`);
      const states = { difficulty:['easy','moderate','hard','unknown'], flatness:['flat','mixed','hilly','unknown'], restroom:['good','moderate','poor','unknown'], parking:['good','moderate','poor','unknown'], lighting:['good','moderate','poor','unknown'], crowd:['good','moderate','poor','unknown'], scenery:['good','moderate','poor','unknown'] };
      for (const [key,values] of Object.entries(states)) if (!values.includes(route[key])) throw new Error(`${p.id}: ${key} 코스 상태 오류`);
      if (Object.keys(route).some(key => !['sourceUrl','verifiedAt'].includes(key) && route[key] !== 'unknown') && (!/^https:\/\//.test(route.sourceUrl || '') || !/^\d{4}-\d{2}-\d{2}$/.test(route.verifiedAt || ''))) throw new Error(`${p.id}: 코스 정보의 출처와 확인일이 필요합니다.`);
    }
    if (p.visitContext) {
      const visit = p.visitContext;
      if (!['unknown','short','half_day','full_day'].includes(visit.duration) || !Array.isArray(visit.transportModes) || visit.transportModes.some(value=>!['car','transit'].includes(value))) throw new Error(`${p.id}: 시간/이동 정보 형식 오류`);
      if ((visit.duration !== 'unknown' || visit.transportModes.length) && (!/^https:\/\//.test(visit.sourceUrl || '') || !/^\d{4}-\d{2}-\d{2}$/.test(visit.verifiedAt || ''))) throw new Error(`${p.id}: 시간/이동 정보의 출처와 확인일이 필요합니다.`);
    }
    for (const key of ['sourceLicense','imageLicense']) {
      if (p[key] === undefined) continue;
      if (!p[key] || typeof p[key] !== 'object' || Array.isArray(p[key])) throw new Error(`${p.id}: ${key} 형식 오류`);
      for (const field of ['name','url','attribution','copyrightCode','usageNotes']) if (p[key][field] != null && typeof p[key][field] !== 'string') throw new Error(`${p.id}: ${key}.${field}에 문자열 또는 null이 필요합니다.`);
      if (p[key].url && !/^https:\/\//.test(p[key].url)) throw new Error(`${p.id}: 라이선스 URL은 HTTPS를 사용하세요.`);
    }
    if (typeof p.isDemo !== 'boolean') throw new Error(`${p.id}: isDemo는 boolean이어야 합니다.`);
    if (!p.isDemo && (!/^https:\/\//.test(p.sourceUrl || '') || !/^\d{4}-\d{2}-\d{2}$/.test(p.lastVerifiedAt || ''))) throw new Error(`${p.id}: 실제 장소에는 출처 URL과 확인 날짜가 필요합니다.`);
    for (const [key, min, max] of [['latitude', -90, 90], ['longitude', -180, 180]]) if (p[key] !== null && (!Number.isFinite(p[key]) || p[key] < min || p[key] > max)) throw new Error(`${p.id}: 좌표 오류`);
    for (const key of keys) {
      const f = p.comfort[key];
      if (!f || !['good', 'moderate', 'poor', 'unknown'].includes(f.value)) throw new Error(`${p.id}: ${key} 값 오류`);
      if (f.value !== 'unknown' && (!/^https:\/\//.test(f.sourceUrl || '') || !/^\d{4}-\d{2}-\d{2}$/.test(f.verifiedAt || '') || !f.note)) throw new Error(`${p.id}: ${key}의 근거/확인일/설명이 필요합니다.`);
      if (key === 'restroom' && f.proximity !== undefined) {
        if (!['near','far','unknown'].includes(f.proximity)) throw new Error(`${p.id}: 화장실 거리 상태 오류`);
        if (f.proximity !== 'unknown' && (!/^https:\/\//.test(f.sourceUrl || '') || !/^\d{4}-\d{2}-\d{2}$/.test(f.verifiedAt || '') || !f.note)) throw new Error(`${p.id}: 화장실 거리의 근거/확인일/설명이 필요합니다.`);
      }
    }
  }
  return true;
}
