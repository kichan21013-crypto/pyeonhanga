import { calculateComfort, comfortText, COMFORT_LABELS } from './comfort-score.js';
import { recommendationReasons } from './search.js';
import { ACTIVITIES } from './rhythm.js';
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const safeUrl = value => /^(https?:\/\/|\/(?!\/))/.test(value || '') ? escapeHtml(value) : '';
export const placeUrl = p => `/places/${encodeURIComponent(p.slug)}/`;
export const ICONS = {
  leaf: '<path d="M20 4C8 2 2 8 5 15c3 7 14 5 15-11Z"/><path d="m5 20 10-11"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  food: '<path d="M5 3v6c0 4 6 4 6 0V3M8 3v19M20 22V3c-5 1-6 10 0 10"/>',
  garden: '<path d="M12 22V11m0 5C2 17 1 7 3 3c7 0 11 6 9 13Zm1-2c0-7 4-11 9-11 1 7-3 12-9 11Z"/>',
  travel: '<path d="m3 12 18-9-7 18-3-7-8-2Zm8 2L21 3"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  people: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-17a3 3 0 0 1 0 6m2 11v-4a5 5 0 0 0-2-4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  solo: '<circle cx="12" cy="7" r="4"/><path d="M5 22v-3a7 7 0 0 1 14 0v3"/>',
  cafe: '<path d="M4 8h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Zm13 1h2a3 3 0 1 1 0 6h-2M8 3v2m5-2v2M2 22h19"/>',
  sea: '<path d="M2 12q3-4 6 0t6 0 6 0M2 18q3-4 6 0t6 0 6 0"/><circle cx="17" cy="5" r="3"/>',
  parking: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 17V7h4a3 3 0 1 1 0 6H9"/>',
  walking: '<circle cx="14" cy="4" r="2"/><path d="m8 22 3-7-1-5-4 4m5 1 5 3 1 4m-7-12 4-3 3 5 4 1"/>',
  stairs: '<path d="M2 20h6v-6h6V8h6V2M3 4h7M3 4v7m0-7 7 7"/>',
  restroom: '<path d="M5 22V3h14v19M10 8h4m-2-2v4m3 5v2"/>',
  noise: '<path d="m11 5-5 5H2v4h4l5 5V5Zm5 3q4 4 0 8M3 3l18 18"/>',
  seating: '<path d="M5 12V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7M4 12h16v5H4zM6 17v5m12-5v5"/>',
  waiting: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  filters: '<path d="M3 6h18M3 12h18M3 18h18M8 3v6m8 0v6m-6 0v6"/>',
  running: '<circle cx="16" cy="4" r="2"/><path d="m4 12 5-4 5 2 3 4h4M9 8l-2 7-4 6m8-8 3 5-2 4M6 5l4 1"/>',
  mountain: '<path d="m2 21 8-17 5 10 3-6 5 13H2Zm5-11 3 3 3-3"/>',
  bike: '<circle cx="5" cy="17" r="4"/><circle cx="19" cy="17" r="4"/><path d="m5 17 5-10 6 10H5m10-10h4l1 5M8 4h5"/>',
  rest: '<path d="M4 10v10m16-10v10M4 16h16M7 7v6h10V7M6 22v-2m12 2v-2"/>',
  culture: '<path d="m2 8 10-6 10 6H2Zm2 3v8m5-8v8m6-8v8m5-8v8M2 22h20"/>',
};
export function icon(name) { return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.leaf}</svg>`; }
export function scoreMarkup(p) {
  const score = calculateComfort(p.comfort);
  return score.score === null ? '<span class="score-pending">편안함 정보 수집 중</span>' : `<span class="score">편안함 <strong>${score.score}</strong><small>정보 신뢰도 ${score.confidence}</small></span>`;
}
export function card(p, saved = false, filters, rhythm) {
  const badges = Object.entries(p.comfort).filter(([, f]) => f.value === 'good' && f.sourceUrl && f.verifiedAt).slice(0, 3);
  const reasons = rhythm?.reasons || recommendationReasons(p, filters);
  const activity = rhythm ? ACTIVITIES[rhythm.activityType] : null;
  return `<article class="place-card"><div class="card-image"><a href="${placeUrl(p)}" tabindex="-1" aria-hidden="true"><img src="${safeUrl(p.image) || '/assets/garden.svg'}" alt="" loading="lazy" width="800" height="520"></a>${p.isDemo ? '<span class="demo-badge">DEMO SAMPLE</span>' : ''}<button class="save-icon ${saved ? 'is-saved' : ''}" data-save="${escapeHtml(p.id)}" aria-label="${escapeHtml(p.name)} 저장" aria-pressed="${saved}">${icon('heart')}</button></div><div class="card-body"><p class="eyebrow">${escapeHtml(p.region)} <span>·</span> ${escapeHtml(p.category)}</p>${activity ? `<p class="rhythm-activity tone-${activity[2]}"><span class="choice-icon">${icon(activity[1])}</span>오늘의 리듬 · ${escapeHtml(activity[0])}</p>` : ''}<h3><a href="${placeUrl(p)}">${escapeHtml(rhythm?.title || p.name)}</a></h3>${scoreMarkup(p)}${reasons.length ? `<p class="recommendation-reason">${icon('check')}<span>${reasons.map(escapeHtml).join(' · ')}</span></p>` : ''}<p class="card-description">${escapeHtml(p.shortDescription)}</p><div class="comfort-tags">${badges.length ? badges.map(([k, f]) => `<span>${icon('check')}${comfortText(k, f.value)}</span>`).join('') : '<span>주차 · 계단 · 보행 정보 확인 전</span>'}</div><div class="card-bottom"><span>가격 ${escapeHtml(p.priceRange)}</span><a href="${placeUrl(p)}" aria-label="${escapeHtml(p.name)} 자세히 보기">자세히 보기 ${icon('arrow')}</a></div>${rhythm ? `<div class="rhythm-card-actions"><button type="button" class="button secondary" data-save="${escapeHtml(p.id)}" aria-pressed="${saved}">${icon('heart')} ${saved ? '저장됨' : '저장하기'}</button><button type="button" class="button secondary" data-share="${escapeHtml(p.id)}">↗ 같이 갈 사람에게 공유하기</button><button type="button" class="button primary full" data-companion-interest="${escapeHtml(p.id)}">${icon('people')} 같이 할 사람이 있으면 좋겠어요</button></div>` : ''}</div></article>`;
}
export function detailMarkup(p) {
  const s = calculateComfort(p.comfort);
  return `<nav class="breadcrumbs" aria-label="현재 위치"><a href="/">홈</a><span>/</span><a href="/?category=${encodeURIComponent(p.category)}">${escapeHtml(p.category)}</a><span>/</span><span>${escapeHtml(p.name)}</span></nav><div class="detail-layout"><div><div class="detail-image"><img src="${safeUrl(p.image) || '/assets/garden.svg'}" alt="${escapeHtml(p.imageAlt || p.name)}" width="800" height="520">${p.isDemo ? '<span class="demo-badge">DEMO SAMPLE · 가상 장소</span>' : ''}</div><section class="detail-intro"><p class="eyebrow">${escapeHtml(p.region)} · ${escapeHtml(p.category)}</p><h1>${escapeHtml(p.name)}</h1><p>${escapeHtml(p.shortDescription)}</p>${p.isDemo ? '<p class="notice">개발 테스트용 가상 장소입니다. 실제 방문 정보로 사용하지 마세요.</p>' : ''}</section><section class="info-panel"><h2>어떤 점이 편안한가요?</h2><p>확인하지 못한 정보는 그대로 알려드려요.</p><dl class="comfort-list">${Object.entries(COMFORT_LABELS).map(([key, label]) => { const f = p.comfort[key]; const known = f && f.value !== 'unknown' && f.sourceUrl && f.verifiedAt; return `<div><dt>${label}</dt><dd>${known ? comfortText(key, f.value) : '아직 확인하지 못했어요'}${known ? `<small>${escapeHtml(f.note || '')} · 확인 ${escapeHtml(f.verifiedAt)} <a href="${safeUrl(f.sourceUrl)}" target="_blank" rel="noopener noreferrer">근거 보기 ↗</a></small>` : ''}</dd></div>`; }).join('')}</dl><p class="notice">방문 전 장소에 최신 이용 조건을 확인해 주세요.</p></section><section class="info-panel"><h2>방문 정보</h2><dl class="comfort-list"><div><dt>주소</dt><dd>${escapeHtml(p.address)}</dd></div><div><dt>가격대</dt><dd>${escapeHtml(p.priceRange)}</dd></div><div><dt>최근 정보 확인</dt><dd>${escapeHtml(p.lastVerifiedAt || '아직 확인 전')}</dd></div><div><dt>출처</dt><dd>${p.sourceUrl ? `<a href="${safeUrl(p.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.sourceName)} ↗</a>` : escapeHtml(p.sourceName)}</dd></div></dl>${!p.isDemo ? `<a class="button secondary" target="_blank" rel="noopener noreferrer" href="https://map.naver.com/p/search/${encodeURIComponent(p.address + ' ' + p.name)}">${icon('pin')} 외부 지도에서 주소 찾기 ↗</a>` : ''}</section></div><aside class="detail-aside"><div class="info-panel score-panel"><span class="eyebrow">정보 기반 편안함</span>${s.score === null ? '<h2>정보 더 필요</h2><p>정보가 아직 부족해요.<br>편안함 정보 수집 중입니다.</p>' : `<h2 class="big-score">${s.score}<small> / 100</small></h2>`}<p class="confidence">정보 신뢰도 <strong>${s.confidence}</strong> · 확인 비중 ${Math.round(s.coverage * 100)}%</p><p class="small-text">확인 비중이 40% 미만이면 점수를 표시하지 않습니다. 이용자 평점과 별개로 계산합니다.</p><div class="action-row"><button class="button secondary" data-save="${escapeHtml(p.id)}" aria-pressed="false">${icon('heart')} 저장</button><button class="button secondary" id="share-place">↗ 같이 갈 사람에게 공유하기</button></div><button class="button primary full" id="companion-open">${icon('people')} 같이 할 사람이 있으면 좋겠어요</button><p class="small-text">동행에 대한 의견만 받습니다.<br>실제 연결이나 결제는 없어요.</p></div><div class="aside-note">${icon('leaf')}<p>나의 상황과 취향에,<br><strong>오늘, 내 리듬대로.</strong></p></div></aside></div>`;
}
