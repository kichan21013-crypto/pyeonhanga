const KOREA_BOUNDS = {
  minLat: 32.5,
  maxLat: 39.5,
  minLon: 124.0,
  maxLon: 132.5,
};

const REGION_ADDRESS_PATTERNS = {
  서울: /서울특별시/,
  경기: /경기도/,
  강릉: /강원특별자치도\s*강릉시|강원도\s*강릉시/,
  경주: /경상북도\s*경주시/,
  부산: /부산광역시/,
  제주: /제주특별자치도|제주도/,
};

const FACILITY_TITLE_PATTERN = /(화장실|주차장|여객터미널|종합사회복지관|복지관|관광안내소|매표소|휴게소)$/;

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isKoreaCoordinate(latitude, longitude) {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= KOREA_BOUNDS.minLat
    && latitude <= KOREA_BOUNDS.maxLat
    && longitude >= KOREA_BOUNDS.minLon
    && longitude <= KOREA_BOUNDS.maxLon;
}

export function classifyTourApiRole(place) {
  const contentTypeId = String(place?.tourApi?.contentTypeId || '');
  if (contentTypeId === '25' || place?.category === '여행') return 'course';
  if (FACILITY_TITLE_PATTERN.test(String(place?.name || '').trim())) return 'facility';
  return 'place';
}

export function auditTourApiPlace(place) {
  const role = classifyTourApiRole(place);
  const flags = [];
  const validCoordinate = isKoreaCoordinate(place?.latitude, place?.longitude);
  const addressKnown = hasText(place?.address) && place.address !== '주소 확인 필요';
  const hasRealImage = hasText(place?.image) && !place.image.startsWith('/assets/');
  const addressPattern = REGION_ADDRESS_PATTERNS[place?.region];
  const regionAddressMatch = !addressKnown || !addressPattern || addressPattern.test(place.address);
  const comfort = place?.comfort || {};
  const comfortKnownCount = ['parking','stairs','accessibility','restroom','seating','walking','noise','waiting']
    .filter(key => comfort?.[key]?.value && comfort[key].value !== 'unknown').length;

  if (!validCoordinate) flags.push('invalid_korea_coordinate');
  if (!addressKnown) flags.push('missing_address');
  if (!hasRealImage) flags.push('placeholder_image');
  if (!regionAddressMatch) flags.push('region_address_mismatch');
  if (role === 'facility') flags.push('facility_not_recommendation');
  if (role === 'course') flags.push('course_needs_course_model');
  if (comfortKnownCount === 0) flags.push('comfort_unknown');

  let score = 0;
  if (validCoordinate) score += 30;
  if (addressKnown) score += 25;
  if (hasRealImage) score += 20;
  if (/^https:\/\//.test(place?.sourceUrl || '')) score += 10;
  if (/^\d+$/.test(String(place?.tourApi?.contentId || ''))) score += 10;
  if (regionAddressMatch) score += 5;
  if (!regionAddressMatch) score -= 20;

  let status = 'candidate';
  if (role === 'facility' || !validCoordinate || !addressKnown) status = 'source_only';
  else if (role === 'course') status = 'review_course';
  else if (!hasRealImage) status = 'review';

  return {
    id: place?.id,
    name: place?.name,
    region: place?.region,
    category: place?.category,
    contentId: place?.tourApi?.contentId || null,
    contentTypeId: place?.tourApi?.contentTypeId || null,
    role,
    status,
    score: Math.max(0, Math.min(100, score)),
    flags,
    validCoordinate,
    addressKnown,
    hasRealImage,
    regionAddressMatch,
    comfortKnownCount,
  };
}

export function auditTourApiPlaces(places) {
  const audited = places
    .filter(place => !place?.isDemo && place?.tourApi)
    .map(auditTourApiPlace);

  const countBy = key => audited.reduce((acc, item) => {
    const value = item[key];
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});

  const candidates = audited
    .filter(item => item.status === 'candidate' || item.status === 'review')
    .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name), 'ko'));

  return {
    summary: {
      total: audited.length,
      byStatus: countBy('status'),
      byRole: countBy('role'),
      invalidCoordinate: audited.filter(item => item.flags.includes('invalid_korea_coordinate')).length,
      missingAddress: audited.filter(item => item.flags.includes('missing_address')).length,
      placeholderImage: audited.filter(item => item.flags.includes('placeholder_image')).length,
      regionAddressMismatch: audited.filter(item => item.flags.includes('region_address_mismatch')).length,
      comfortUnknown: audited.filter(item => item.flags.includes('comfort_unknown')).length,
    },
    audited,
    candidates,
  };
}
