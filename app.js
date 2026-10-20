import { card, icon, escapeHtml, placeUrl } from './ui.js';
import { savedIds, writeLocal, anonymousId } from './storage.js';
import { track, analyticsEnabled } from './analytics.js';
import { emptyFilters, filterPlaces, inferIntent, requestedComforts, COMPANIONS } from './search.js';

const $ = selector => document.querySelector(selector);
let places = [], filters = emptyFilters(), toastTimer;
const page = document.body.dataset.page;
function toast(message) {
  const el = $('#toast'); if (!el) return;
  clearTimeout(toastTimer); el.textContent = message; el.hidden = false;
  toastTimer = setTimeout(() => el.hidden = true, 5000);
}
function updateSaved() {
  const ids = savedIds();
  if ($('#saved-count')) $('#saved-count').textContent = ids.length;
  document.querySelectorAll('[data-save]').forEach(button => {
    const saved = ids.includes(button.dataset.save);
    button.classList.toggle('is-saved', saved); button.setAttribute('aria-pressed', String(saved));
    if (!button.classList.contains('save-icon')) button.innerHTML = `${icon('heart')} ${saved ? '저장됨' : '저장'}`;
  });
}
function metadata(p) { return { place_id: p.id, region: p.region, category: p.category, is_demo: p.isDemo }; }
function render() {
  const grid = $('#places-grid'); if (!grid) return;
  const ids = savedIds();
  const matches = page === 'saved' ? places.filter(p => ids.includes(p.id)) : filterPlaces(places, filters);
  grid.innerHTML = matches.length ? matches.map(p => card(p, ids.includes(p.id), page === 'home' ? filters : undefined)).join('') : `<div class="empty-state">${icon(page === 'saved' ? 'heart' : 'search')}<h3>${page === 'saved' ? '마음에 드는 곳을 담아보세요' : '조건에 맞는 장소가 아직 없어요'}</h3><p>${page === 'saved' ? '장소의 하트 버튼을 누르면 여기에 모아드려요.' : '입력한 내용이나 지역·활동에 맞는 장소가 아직 없어요. 다른 검색으로 찾아보세요.'}</p>${page === 'saved' ? '<a href="/" class="button primary">장소 둘러보기</a>' : '<button data-reset class="button secondary">조건 초기화</button>'}</div>`;
  if ($('#result-count')) $('#result-count').textContent = matches.length;
  if ($('#result-status')) $('#result-status').textContent = `${matches.length}개의 장소를 찾았습니다.`;
  updateSaved();
  return matches;
}
function filterEvent(name) {
  const matches = render();
  // 기존 Supabase 입력 규칙은 유지합니다. 새 조건은 filter_used 이벤트로만 집계합니다.
  const legacyName = ['region','category','companion','walking','parking','stairs','reset'].includes(name) ? name : undefined;
  track('filter_used', { ...filters, query: undefined, category: filters.category === 'auto' ? inferIntent(filters.query).category : filters.category, filter: legacyName, result_count: matches.length, is_demo: matches.length ? matches.every(p => p.isDemo) : places.every(p => p.isDemo) });
}
function syncControls() {
  ['region', 'category', 'walking'].forEach(key => { if ($(`#${key}`)) $(`#${key}`).value = filters[key]; });
  ['parking', 'stairs'].forEach(key => { if ($(`#${key}`)) $(`#${key}`).checked = filters[key]; });
  document.querySelectorAll('[data-category]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.category === filters.category)));
  document.querySelectorAll('[data-companion]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.companion === filters.companion)));
  const intent = inferIntent(filters.query), selected = requestedComforts(filters, intent);
  document.querySelectorAll('[data-comfort]').forEach(b => {
    b.setAttribute('aria-pressed', String(selected.includes(b.dataset.comfort)));
    if (b.dataset.comfort === 'walking') b.querySelector('[data-choice-label]').textContent = filters.walking === 'moderate' && selected.includes('walking') ? '걷기 보통 이하' : '걷기 적게';
  });
  document.querySelectorAll('[data-intent]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.intent === filters.query)));
  if ($('#more-filter')) {
    const expanded = $('#more-filter').getAttribute('aria-expanded') === 'true';
    const extraCount = selected.filter(key => ['noise','seating','waiting'].includes(key)).length;
    $('#more-filter [data-more-label]').textContent = expanded ? '조건 접기' : `조건 더보기${extraCount ? ` · ${extraCount}개 선택` : ''}`;
  }
  if ($('#intent-summary')) {
    const text = [];
    if (filters.query) text.push(filters.category === 'auto' ? `활동 자동 분류: ${intent.category || '모든 활동'}` : `활동: ${filters.category || '모든 활동'}`);
    if (!filters.companion && intent.companion) text.push(`함께: ${COMPANIONS[intent.companion]}`);
    if (intent.comforts.length) text.push('입력한 편안함 조건도 함께 살펴봐요');
    $('#intent-summary').textContent = text.join(' · '); $('#intent-summary').hidden = !text.length;
  }
  if ($('#companion-help')) $('#companion-help').hidden = filters.companion !== '새로운 사람';
}
function reset() { filters = emptyFilters(); if ($('#search-input')) $('#search-input').value = ''; syncControls(); filterEvent('reset'); }
async function sharePlace(p) {
  const url = new URL(placeUrl(p), location.origin).href;
  try {
    if (navigator.share) {
      try { await navigator.share({ title: `${p.name} — 편한가?`, text: p.isDemo ? 'DEMO SAMPLE · 가상 장소' : p.shortDescription, url }); }
      catch (error) { if (error.name === 'AbortError') return; await copyLink(url); }
    } else await copyLink(url);
    track('share_place', metadata(p));
  } catch { showCopyFallback(url, p); }
}
async function copyLink(url) {
  if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
  await navigator.clipboard.writeText(url); toast('장소 링크를 복사했어요.');
}
function showCopyFallback(url, p) {
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'share-title');
  dialog.innerHTML = `<div class="dialog-content"><div class="dialog-heading"><h2 id="share-title">링크 공유</h2><button class="close-dialog" aria-label="닫기">×</button></div><p>아래 링크를 길게 누르거나 선택해서 복사해 주세요.</p><label for="share-link">장소 링크</label><input id="share-link" class="share-link-input" readonly value="${escapeHtml(url)}"><button class="button primary full" id="copy-done">복사 완료</button></div>`;
  document.body.append(dialog); dialog.showModal(); const input = dialog.querySelector('input'); input.focus(); input.select();
  dialog.querySelector('.close-dialog').onclick = () => dialog.close();
  dialog.querySelector('#copy-done').onclick = () => { track('share_place', metadata(p)); dialog.close(); toast('원하는 곳에 링크를 붙여넣어 주세요.'); };
  dialog.onclose = () => { dialog.remove(); $('#share-place')?.focus(); };
}
const choices = {
  age: ['50~54', '55~59', '60~64', '65~69', '70+'],
  preference: ['동성 선호', '혼성 선호', '성별 상관없음', '새로운 이성도 괜찮음'],
  purpose: ['식사동행', '나들이동행', '여행동행', '취미친구', '데이트도 괜찮음'],
  group_size: ['2명', '3~4명', '5~8명', '상관없음'],
  willingness: ['무료면 참여', '약 1만원', '약 2만원', '약 3만원 이상', '아직 모르겠음'],
};
function companionDialog(p) {
  track('companion_interest', metadata(p));
  const dialog = document.createElement('dialog');
  const responseId = anonymousId();
  const select = (name, label) => `<label for="survey-${name}">${label}<select id="survey-${name}" name="${name}" required><option value="">선택해 주세요</option>${choices[name].map(v => `<option>${v}</option>`).join('')}</select></label>`;
  dialog.setAttribute('aria-labelledby', 'survey-title');
  dialog.innerHTML = `<div class="dialog-content"><div class="dialog-heading"><h2 id="survey-title">같이 가보고 싶어요</h2><button class="close-dialog" aria-label="설문 닫기">×</button></div><form class="survey"><p><strong>${escapeHtml(p.name)}</strong>에서 어떤 동행을 원하시나요?</p><p class="notice">시장 수요를 알아보기 위한 설문입니다. 실제 연결·예약·결제는 없으며 이름과 연락처를 받지 않습니다.</p>${select('age', '연령대')}${select('preference', '희망 동행')}${select('purpose', '목적')}${select('group_size', '선호 인원')}<fieldset><legend>비슷한 연령과 취향의 멤버를 플랫폼이 대신 구성해준다면 어느 정도까지 지불할 의향이 있나요?</legend>${choices.willingness.map((v, i) => `<label class="radio-option" for="willingness-${i}"><input type="radio" id="willingness-${i}" name="willingness" value="${v}" required> ${v}</label>`).join('')}</fieldset><p class="small-text">${analyticsEnabled ? '선택 항목과 익명 브라우저 식별값을 수요 분석에 사용합니다. 개인정보는 입력하지 마세요.' : '지금은 설문 체험 모드입니다. 분석 연결 전에는 응답이 전송되거나 저장되지 않아요.'} ${p.isDemo ? '이 가상 장소의 응답은 실제 시장 KPI에서 제외됩니다.' : ''} <a href="/privacy.html" target="_blank" rel="noopener">데이터 안내 ↗</a></p><button type="submit" class="button primary full">${analyticsEnabled ? '동의하고 의견 남기기' : '응답 체험 완료'}</button><p class="survey-status" role="status"></p></form></div>`;
  document.body.append(dialog); dialog.showModal();
  dialog.querySelector('.close-dialog').onclick = () => dialog.close();
  dialog.onclose = () => { dialog.remove(); $('#companion-open')?.focus(); };
  dialog.querySelector('form').onsubmit = async event => {
    event.preventDefault(); const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const button = form.querySelector('[type=submit]'); button.disabled = true;
    const values = Object.fromEntries(new FormData(form));
    const success = await track('premium_willingness', { ...metadata(p), ...values, response_id: responseId });
    if (analyticsEnabled && !success) {
      button.disabled = false; form.querySelector('[role=status]').textContent = '응답을 전송하지 못했어요. 잠시 후 다시 눌러 주세요.'; return;
    }
    dialog.querySelector('.dialog-content').innerHTML = `<div class="dialog-heading"><h2 id="survey-title">의견을 선택했어요</h2><button class="close-dialog" aria-label="닫기">×</button></div><p>${analyticsEnabled ? '응답을 저장했습니다. 더 편안한 동행을 준비하는 데 참고하겠습니다.' : '설문 체험을 완료했어요. 현재 분석 연결이 없어 응답은 저장되지 않았습니다.'}</p><p class="notice">실제 연결이나 결제는 진행되지 않습니다.</p><button class="button primary full" id="survey-done">장소 다시 보기</button>`;
    dialog.querySelector('.close-dialog').onclick = dialog.querySelector('#survey-done').onclick = () => dialog.close();
    dialog.querySelector('#survey-done').focus();
  };
}
document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
updateSaved();
document.addEventListener('click', event => {
  const save = event.target.closest('[data-save]');
  if (save) {
    const p = places.find(item => item.id === save.dataset.save); if (!p) return;
    const ids = savedIds(), removing = ids.includes(p.id);
    const success = writeLocal('pyeonhanga.saved', removing ? ids.filter(id => id !== p.id) : [...ids, p.id]);
    if (!success) { toast('브라우저 저장 공간을 사용할 수 없어요. 저장 허용 설정을 확인해 주세요.'); return; }
    if (!removing) track('save_place', metadata(p));
    if (page === 'saved') {
      const index = [...document.querySelectorAll('[data-save]')].indexOf(save);
      render();
      const remaining = document.querySelectorAll('[data-save]');
      (remaining[Math.min(index, remaining.length - 1)] || document.querySelector('.empty-state a'))?.focus();
    } else updateSaved();
    toast(removing ? '저장한 곳에서 지웠어요.' : '저장한 곳에 담았어요.');
  }
  if (event.target.closest('[data-reset], #reset-filters')) reset();
});
window.addEventListener('storage', () => { updateSaved(); if (page === 'saved') render(); });
async function init() {
  try {
    const response = await fetch('/data/places.json'); if (!response.ok) throw new Error('Data load failed');
    places = await response.json();
  } catch {
    toast('장소 정보를 불러오지 못했어요. 잠시 후 새로고침해 주세요.'); return;
  }
  const current = places.find(p => p.id === document.body.dataset.placeId);
  track('page_view', current ? metadata(current) : { is_demo: places.length > 0 && places.every(p => p.isDemo) });
  if (page === 'home') {
    const initial = new URLSearchParams(location.search).get('category');
    if (['맛집', '나들이', '여행'].includes(initial)) filters.category = initial;
    syncControls(); render();
    const search = () => {
      filters.query = $('#search-input').value.trim(); $('#search-input').value = filters.query; syncControls();
      const matches = render(); track('search', { region: filters.region, category: filters.category === 'auto' ? inferIntent(filters.query).category : filters.category, result_count: matches.length, is_demo: matches.length ? matches.every(p => p.isDemo) : places.every(p => p.isDemo) });
    };
    $('#search-form').onsubmit = event => { event.preventDefault(); search(); };
    document.querySelectorAll('[data-intent]').forEach(button => button.onclick = () => {
      $('#search-input').value = button.dataset.intent === filters.query ? '' : button.dataset.intent; search();
    });
    for (const key of ['region', 'category', 'walking', 'parking', 'stairs']) {
      if ($(`#${key}`)) $(`#${key}`).onchange = event => {
        filters[key] = ['parking', 'stairs'].includes(key) ? event.target.checked : event.target.value;
        if (key === 'walking') filters.comfortOverrides.walking = Boolean(filters.walking);
        syncControls(); filterEvent(key);
      };
    }
    document.querySelectorAll('[data-category]').forEach(button => button.onclick = () => { filters.category = filters.category === button.dataset.category ? '' : button.dataset.category; syncControls(); filterEvent('category'); });
    document.querySelectorAll('[data-companion]').forEach(button => button.onclick = () => { filters.companion = filters.companion === button.dataset.companion ? '' : button.dataset.companion; syncControls(); filterEvent('companion'); });
    document.querySelectorAll('[data-comfort]').forEach(button => button.onclick = () => {
      const key = button.dataset.comfort, next = !requestedComforts(filters).includes(key);
      filters.comfortOverrides[key] = next;
      if (key === 'parking' || key === 'stairs') filters[key] = next;
      if (key === 'walking') filters.walking = next ? 'good' : '';
      syncControls(); filterEvent(key);
    });
    $('#more-filter').onclick = event => {
      const button = event.currentTarget, opened = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!opened)); $('#extra-filters').hidden = opened;
      button.querySelector('[data-more-sign]').textContent = opened ? '＋' : '−';
      syncControls();
    };
  }
  if (page === 'saved') render();
  if (page === 'detail' && current) {
    updateSaved(); track('place_view', metadata(current));
    $('#share-place').onclick = () => sharePlace(current);
    $('#companion-open').onclick = () => companionDialog(current);
  }
}
init();
