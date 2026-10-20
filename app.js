import { card, icon, escapeHtml, placeUrl } from './ui.js';
import { savedIds, anonymousId } from './storage.js';
import { track, trackRhythm, analyticsEnabled } from './analytics.js';
import { inferIntent, requestedComforts, COMPANIONS } from './search.js';
import { emptyRhythmFilters, recommendRhythms, DESIRES, ACTIVITIES, DURATION_OPTIONS, TRANSPORT_OPTIONS, companionSummary, toggleSelection, activeActivities } from './rhythm.js';
import { toggleSavedPlace, shareOrCopy, SURVEY_CHOICES } from './actions.js';
import { createProgressiveFlow } from './flow.js';

const $ = selector => document.querySelector(selector);
let places = [], filters = emptyRhythmFilters(), toastTimer, flow;
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
    if (!button.classList.contains('save-icon')) button.innerHTML = `${icon('heart')} ${saved ? '저장됨' : '저장하기'}`;
  });
}
function metadata(p) { return { place_id: p.id, region: p.region, category: p.category, is_demo: p.isDemo }; }
function render() {
  const grid = $('#places-grid'); if (!grid) return;
  const ids = savedIds();
  const rhythms = page === 'home' ? recommendRhythms(places,filters) : [];
  const matches = page === 'saved' ? places.filter(p => ids.includes(p.id)) : rhythms.map(result => result.place);
  grid.innerHTML = matches.length ? matches.map((p,i) => card(p, ids.includes(p.id), page === 'home' ? filters : undefined, rhythms[i])).join('') : `<div class="empty-state">${icon(page === 'saved' ? 'heart' : 'search')}<h3>${page === 'saved' ? '마음에 드는 곳을 담아보세요' : '조건에 맞는 장소가 아직 없어요'}</h3><p>${page === 'saved' ? '장소의 하트 버튼을 누르면 여기에 모아드려요.' : '입력한 내용이나 지역·활동에 맞는 장소가 아직 없어요. 다른 검색으로 찾아보세요.'}</p>${page === 'saved' ? '<a href="/" class="button primary">장소 둘러보기</a>' : '<button data-reset class="button secondary">조건 초기화</button>'}</div>`;
  if ($('#result-count')) $('#result-count').textContent = matches.length;
  if ($('#result-status')) $('#result-status').textContent = `${matches.length}개의 오늘의 리듬을 찾았습니다.`;
  updateSaved();
  return matches;
}
function activityOptions() {
  const container = $('#activity-options'); if (!container) return;
  container.hidden = !filters.desires.length;
  container.innerHTML = filters.desires.map(key => `<section class="activity-subgroup"><h3>${escapeHtml(DESIRES[key].label)}</h3><div class="activity-chips" role="group" aria-label="${escapeHtml(DESIRES[key].label)} 세부 활동">${DESIRES[key].activities.map(value => `<button type="button" class="choice-chip tone-${ACTIVITIES[value][2]}" data-activity="${value}" aria-pressed="${filters.activities.includes(value)}"><span class="choice-icon">${icon(ACTIVITIES[value][1])}</span><span data-choice-label>${escapeHtml(ACTIVITIES[value][0])}</span><span class="selection-indicator" aria-hidden="true">✓</span></button>`).join('')}</div></section>`).join('');
}
function syncControls() {
  for (const key of ['region','category']) if ($(`#${key}`)) $(`#${key}`).value = filters[key];
  const groups = { companion: filters.companions, desire: filters.desires, activity: filters.activities, duration: [filters.duration], transport: [filters.transport] };
  for (const [key, selected] of Object.entries(groups)) document.querySelectorAll(`[data-${key}]`).forEach(button => button.setAttribute('aria-pressed',String(selected.includes(button.dataset[key]))));
  const selectedComforts = requestedComforts(filters);
  document.querySelectorAll('[data-comfort]').forEach(button => button.setAttribute('aria-pressed',String(selectedComforts.includes(button.dataset.comfort))));
  document.querySelectorAll('[data-intent]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.intent === filters.query)));
  if ($('#companion-summary')) $('#companion-summary').textContent = companionSummary(filters.companions) || '여러 상황을 함께 골라도 좋아요.';
  if ($('#companion-help')) $('#companion-help').hidden = !filters.companions.includes('new_people');
  if ($('#desire-summary')) $('#desire-summary').textContent = filters.desires.map(key => DESIRES[key].label).join(' · ');
  if ($('#condition-summary')) $('#condition-summary').textContent = `${DURATION_OPTIONS[filters.duration]} · ${TRANSPORT_OPTIONS[filters.transport]}`;
  const hasSelection = Boolean(filters.desires.length || filters.query || filters.companions.length);
  if ($('#flow-summary')) $('#flow-summary').hidden = !hasSelection;
  if ($('#flow-desire-summary')) $('#flow-desire-summary').textContent = filters.desires.map(key => DESIRES[key].label.replace('고 싶어요','기')).join(' · ') || (filters.query ? '입력한 하루를 함께 반영해요' : '');
  if ($('#flow-companion-summary')) $('#flow-companion-summary').textContent = companionSummary(filters.companions);
  if ($('#intent-summary')) {
    const parsed = inferIntent(filters.query);
    $('#intent-summary').textContent = filters.query ? `문장과 선택한 취향을 함께 반영해요.${parsed.distanceKm ? ' 입력한 거리는 희망 조건이며 실제 코스 거리로 추정하지 않아요.' : ''}` : '';
    $('#intent-summary').hidden = !filters.query;
  }
  flow?.update(filters);
}
function reset() {
  filters = emptyRhythmFilters(); if ($('#search-input')) $('#search-input').value = '';
  activityOptions(); syncControls();
  if (page === 'home') { flow.activate(1); $('#flow-step-1 summary').focus(); }
  else render();
}
function recordRhythmAction(name) {
  const matches = recommendRhythms(places,filters).map(result => result.place);
  trackRhythm(name,{region:filters.region, category: ['맛집','나들이','여행'].includes(filters.category) ? filters.category : '', companion: filters.companions.length === 1 ? COMPANIONS[filters.companions[0]] : '', result_count:matches.length, is_demo:matches.length ? matches.every(p=>p.isDemo) : places.every(p=>p.isDemo)});
}
async function sharePlace(p) {
  const url = new URL(placeUrl(p), location.origin).href;
  const outcome = await shareOrCopy({ title: `${p.name} — 나가치`, text: p.isDemo ? 'DEMO SAMPLE · 가상 장소' : p.shortDescription, url });
  if (outcome === 'cancelled') return;
  if (outcome === 'manual') { showCopyFallback(url,p); return; }
  if (outcome === 'copied') toast('리듬 링크를 복사했어요.');
  trackRhythm('rhythm_share',metadata(p));
}
function showCopyFallback(url, p) {
  const trigger = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'share-title');
  dialog.innerHTML = `<div class="dialog-content"><div class="dialog-heading"><h2 id="share-title">링크 공유</h2><button class="close-dialog" aria-label="닫기">×</button></div><p>아래 링크를 길게 누르거나 선택해서 복사해 주세요.</p><label for="share-link">장소 링크</label><input id="share-link" class="share-link-input" readonly value="${escapeHtml(url)}"><button class="button primary full" id="copy-done">복사 완료</button></div>`;
  document.body.append(dialog); dialog.showModal(); const input = dialog.querySelector('input'); input.focus(); input.select();
  dialog.querySelector('.close-dialog').onclick = () => dialog.close();
  dialog.querySelector('#copy-done').onclick = () => { trackRhythm('rhythm_share', metadata(p)); dialog.close(); toast('원하는 곳에 링크를 붙여넣어 주세요.'); };
  dialog.onclose = () => { dialog.remove(); if (trigger?.isConnected) trigger.focus(); };
}
const choices = SURVEY_CHOICES;
function companionDialog(p) {
  trackRhythm('companion_interest', metadata(p));
  const dialog = document.createElement('dialog');
  const responseId = anonymousId();
  const select = (name, label) => `<label for="survey-${name}">${label}<select id="survey-${name}" name="${name}" required><option value="">선택해 주세요</option>${choices[name].map(v => `<option>${v}</option>`).join('')}</select></label>`;
  dialog.setAttribute('aria-labelledby', 'survey-title');
  dialog.innerHTML = `<div class="dialog-content"><div class="dialog-heading"><h2 id="survey-title">같이 할 사람이 있으면 좋겠어요</h2><button class="close-dialog" aria-label="설문 닫기">×</button></div><form class="survey"><p><strong>${escapeHtml(p.name)}</strong>에서 어떤 동행을 원하시나요?</p><p class="notice">시장 수요를 알아보기 위한 설문입니다. 실제 연결·예약·결제는 없으며 이름과 연락처를 받지 않습니다.</p>${select('age', '연령대')}${select('preference', '희망 동행')}${select('purpose', '목적')}${select('group_size', '선호 인원')}<fieldset><legend>비슷한 연령과 취향의 멤버를 플랫폼이 대신 구성해준다면 어느 정도까지 지불할 의향이 있나요?</legend>${choices.willingness.map((v, i) => `<label class="radio-option" for="willingness-${i}"><input type="radio" id="willingness-${i}" name="willingness" value="${v}" required> ${v}</label>`).join('')}</fieldset><p class="small-text">${analyticsEnabled ? '선택 항목과 익명 브라우저 식별값을 수요 분석에 사용합니다. 개인정보는 입력하지 마세요.' : '지금은 설문 체험 모드입니다. 분석 연결 전에는 응답이 전송되거나 저장되지 않아요.'} ${p.isDemo ? '이 가상 장소의 응답은 실제 시장 KPI에서 제외됩니다.' : ''} <a href="/privacy.html" target="_blank" rel="noopener">데이터 안내 ↗</a></p><button type="submit" class="button primary full">${analyticsEnabled ? '동의하고 의견 남기기' : '응답 체험 완료'}</button><p class="survey-status" role="status"></p></form></div>`;
  document.body.append(dialog); dialog.showModal();
  dialog.querySelector('.close-dialog').onclick = () => dialog.close();
  dialog.onclose = () => { dialog.remove(); ($('#companion-open') || document.querySelector(`[data-companion-interest="${p.id}"]`))?.focus(); };
  dialog.querySelector('form').onsubmit = async event => {
    event.preventDefault(); const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const button = form.querySelector('[type=submit]'); button.disabled = true;
    const values = Object.fromEntries(new FormData(form));
    const success = await trackRhythm('premium_willingness', { ...metadata(p), ...values, response_id: responseId });
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
    const { ok: success, removing } = toggleSavedPlace(p.id);
    if (!success) { toast('브라우저 저장 공간을 사용할 수 없어요. 저장 허용 설정을 확인해 주세요.'); return; }
    if (!removing) trackRhythm('rhythm_save', metadata(p));
    if (page === 'saved') {
      const index = [...document.querySelectorAll('[data-save]')].indexOf(save);
      render();
      const remaining = document.querySelectorAll('[data-save]');
      (remaining[Math.min(index, remaining.length - 1)] || document.querySelector('.empty-state a'))?.focus();
    } else updateSaved();
    toast(removing ? '저장한 곳에서 지웠어요.' : '저장한 곳에 담았어요.');
  }
  const share = event.target.closest('[data-share]'); if (share) { const p = places.find(p=>p.id===share.dataset.share); if(p) sharePlace(p); }
  const interest = event.target.closest('[data-companion-interest]'); if (interest) { const p = places.find(p=>p.id===interest.dataset.companionInterest); if(p) companionDialog(p); }
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
    const category = new URLSearchParams(location.search).get('category');
    if (['맛집','나들이','여행'].includes(category)) filters.category = category;
    flow = createProgressiveFlow(document);
    activityOptions(); syncControls();
    const scrollTo = element => element.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',block:'start'});
    $('#rhythm-start').onclick = event => {
      event.preventDefault(); flow.start(filters);
      $('#rhythm-start').setAttribute('aria-expanded','true');
      $('#flow-step-1 summary').focus({preventScroll:true}); scrollTo($('#explore'));
      trackRhythm('rhythm_start',{is_demo:places.every(p=>p.isDemo)});
    };
    const readQuery = () => { filters.query = $('#search-input').value.trim(); syncControls(); };
    const nextStep = number => {
      if (!flow.activate(number)) return;
      const summary = $(`#flow-step-${number} summary`); summary.focus({preventScroll:true}); scrollTo(summary);
    };
    $('#search-input').oninput = readQuery;
    $('#search-input').onkeydown = event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); readQuery(); nextStep(2); } };
    $('#search-form').onsubmit = event => {
      event.preventDefault(); readQuery();
      // Enter in the natural-language field only advances the questions.
      if (event.submitter?.id !== 'recommend-button') { nextStep(2); return; }
      if (!flow.submit(filters)) return;
      render(); recordRhythmAction('recommendation_view');
      $('#results-title').focus({preventScroll:true}); scrollTo($('#rhythm-results'));
    };
    document.querySelectorAll('[data-intent]').forEach(button => button.onclick = () => { $('#search-input').value = button.dataset.intent; readQuery(); });
    document.querySelectorAll('[data-next-step]').forEach(button => button.onclick = () => nextStep(Number(button.dataset.nextStep)));
    $('#explore').addEventListener('click', event => {
      const step = event.target.closest('[data-flow-step]');
      if (step && !event.target.closest('summary, [data-next-step]')) flow.activate(Number(step.dataset.flowStep));
    });
    document.querySelectorAll('[data-companion]').forEach(button => button.onclick = () => { filters.companions = toggleSelection(filters.companions,button.dataset.companion); syncControls(); recordRhythmAction('companion_selected'); });
    document.querySelectorAll('[data-desire]').forEach(button => button.onclick = () => {
      filters.desires = toggleSelection(filters.desires,button.dataset.desire); filters.activities = activeActivities(filters.desires,filters.activities);
      activityOptions(); syncControls(); recordRhythmAction('desire_selected');
    });
    $('#activity-options').onclick = event => {
      const button = event.target.closest('[data-activity]'); if (!button) return;
      const value = button.dataset.activity; filters.activities = toggleSelection(filters.activities,value);
      activityOptions(); syncControls(); recordRhythmAction('activity_selected');
      document.querySelector(`[data-activity="${value}"]`)?.focus();
    };
    for (const key of ['duration','transport']) document.querySelectorAll(`[data-${key}]`).forEach(button => button.onclick = () => { filters[key] = button.dataset[key]; syncControls(); recordRhythmAction('condition_selected'); });
    document.querySelectorAll('[data-comfort]').forEach(button => button.onclick = () => { const key = button.dataset.comfort; filters.comfortOverrides[key] = !requestedComforts(filters).includes(key); syncControls(); recordRhythmAction('condition_selected'); });
    for (const key of ['region','category']) $(`#${key}`).onchange = event => { filters[key] = event.target.value; syncControls(); recordRhythmAction('condition_selected'); };
  }
  if (page === 'saved') render();
  if (page === 'detail' && current) {
    updateSaved(); track('place_view', metadata(current));
    $('#share-place').onclick = () => sharePlace(current);
    $('#companion-open').onclick = () => companionDialog(current);
  }
}
init();
