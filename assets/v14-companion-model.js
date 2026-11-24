// Browser-independent rules for companion intent browsing.
// This filters existing tourism venues only. It does not imply any real matchmaking activity.
export const COMPANION_INTERESTS = Object.freeze({
  walk:'산책 동행',eat:'식사 동행',outing:'나들이 동행',travel:'여행 동행',
});
export const COMPANION_REGIONS = Object.freeze(['서울','경기','강릉','경주','부산','제주']);
export function normalizeCompanionInterest(value) {
  return Object.prototype.hasOwnProperty.call(COMPANION_INTERESTS,value) ? value : null;
}
export function normalizeCompanionRegion(value) {
  return COMPANION_REGIONS.includes(value) ? value : '';
}
export function companionPlaceMatches(place,{interest,region=''}) {
  if (!place || place.isDemo || typeof place.image!=='string' || !/^https:\/\//.test(place.image)) return false;
  if(region && place.region!==region) return false;
  const tags=Array.isArray(place.intentTags)?place.intentTags:[];
  if(interest==='walk') return tags.some(t=>['walk','hike','scenery'].includes(t));
  if(interest==='eat') return place.category==='맛집';
  if(interest==='outing') return place.category==='나들이' || tags.some(t=>['outing','culture','scenery'].includes(t));
  if(interest==='travel') return place.category==='여행' || tags.some(t=>['travel','drive','sea'].includes(t));
  return false;
}
