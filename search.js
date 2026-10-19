export const emptyFilters = () => ({ query: '', region: '', category: '', companion: '', walking: '', parking: false, stairs: false });
function verified(p, key, acceptable) {
  const f = p.comfort?.[key];
  return Boolean(f?.sourceUrl && f?.verifiedAt && acceptable.includes(f.value));
}
export function filterPlaces(places, f) {
  const query = (f.query || '').trim().toLowerCase();
  const needsParking = /주차\s*(편|필요|가능)/.test(query);
  const needsWalking = /(많이\s*걷지|걷기\s*(적|편)|보행\s*부담\s*적)/.test(query);
  const needsStairs = /(계단\s*(없|적|최소))/.test(query);
  const tokens = query.replace(/주차\s*(편한|필요한|가능한)/g, '').replace(/많이\s*걷지\s*않는|걷기\s*(적은|편한)|보행\s*부담\s*적은|계단\s*(없는|적은|최소)/g, '').split(/\s+/).filter(Boolean);
  return places.filter(p => {
    if (f.region && p.region !== f.region) return false;
    if (f.category && p.category !== f.category) return false;
    if (f.companion && !p.companions?.includes(f.companion)) return false;
    if ((f.parking || needsParking) && !verified(p, 'parking', ['good'])) return false;
    if ((f.stairs || needsStairs) && !verified(p, 'stairs', ['good'])) return false;
    if ((f.walking || needsWalking) && !verified(p, 'walking', f.walking === 'moderate' ? ['good', 'moderate'] : ['good'])) return false;
    const haystack = `${p.name} ${p.category} ${p.region} ${p.address} ${p.shortDescription}`.toLowerCase();
    return tokens.every(token => haystack.includes(token));
  });
}
