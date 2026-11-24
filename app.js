import { card, icon, escapeHtml, placeUrl } from './ui.js';
import { savedIds, anonymousId } from './storage.js';
import { track, trackRhythm, analyticsEnabled, recordConsentedSurvey } from './analytics.js';
import { inferIntent, requestedComforts, COMPANIONS } from './search.js';
import { emptyRhythmFilters, recommendRhythms, DESIRES, ACTIVITIES, DURATION_OPTIONS, TRANSPORT_OPTIONS, companionSummary, toggleSelection, activeActivities } from './rhythm.js';
import { toggleSavedPlace, shareOrCopy, SURVEY_CHOICES } from './actions.js';
import { createProgressiveFlow } from './flow.js';
import { programById, programContext } from './assets/v15-programs.js';

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
function rhythmContext(p = null) {
  const context = {
    desires: [...filters.desires],
    activities: [...filters.activities],
    companions: [...filters.companions],
    duration: filters.duration,
    transport: filters.transport,
    comfort_preferences: requestedComforts(filters),
  };
  if (p) {
    const result = recommendRhythms(places, filters).find(item => item.place.id === p.id);
    if (result?.activityType) context.recommended_activity = result.activityType;
  }
  return context;
}
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
  const results = recommendRhythms(places,filters);
  const matches = results.map(result => result.place);
  trackRhythm(name, {
    region: filters.region,
    category: ['맛집','나들이','여행'].includes(filters.category) ? filters.category : '',
    companion: filters.companions.length === 1 ? COMPANIONS[filters.companions[0]] : '',
    result_count: matches.length,
    is_demo: matches.length ? matches.every(p=>p.isDemo) : places.every(p=>p.isDemo),
    ...rhythmContext(),
  });
}
async function sharePlace(p) {
  const url = new URL(placeUrl(p), location.origin).href;
  const outcome = await shareOrCopy({ title: `${p.name} — 나가치`, text: p.isDemo ? 'DEMO SAMPLE · 가상 장소' : p.shortDescription, url });
  if (outcome === 'cancelled') return;
  if (outcome === 'manual') { showCopyFallback(url,p); return; }
  if (outcome === 'copied') toast('리듬 링크를 복사했어요.');
  trackRhythm('rhythm_share',{ ...metadata(p), ...rhythmContext(p) });
}
function showCopyFallback(url, p) {
  const trigger = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'share-title');
  dialog.innerHTML = `<div class="dialog-content"><div class="dialog-heading"><h2 id="share-title">링크 공유</h2><button class="close-dialog" aria-label="닫기">×</button></div><p>아래 링크를 길게 누르거나 선택해서 복사해 주세요.</p><label for="share-link">장소 링크</label><input id="share-link" class="share-link-input" readonly value="${escapeHtml(url)}"><button class="button primary full" id="copy-done">복사 완료</button></div>`;
  document.body.append(dialog); dialog.showModal(); const input = dialog.querySelector('input'); input.focus(); input.select();
  dialog.querySelector('.close-dialog').onclick = () => dialog.close();
  dialog.querySelector('#copy-done').onclick = () => { trackRhythm('rhythm_share', { ...metadata(p), ...rhythmContext(p) }); dialog.close(); toast('원하는 곳에 링크를 붙여넣어 주세요.'); };
  dialog.onclose = () => { dialog.remove(); if (trigger?.isConnected) trigger.focus(); };
}
const choices = SURVEY_CHOICES;
function companionDialog(p, trigger = null, program = null) {
  if (document.querySelector('dialog.n13-survey-dialog')) return;
  // 동의 전 클릭·방문은 서버에 전송하지 않습니다.
  const activityMap = { walk:'walk', eat:'food', hike:'hike', outing:'outing', travel:'travel' };
  const desireMap = { walk:'outdoor', eat:'eat', hike:'outdoor', outing:'explore', travel:'explore' };
  const chosen = trigger?.dataset?.companionActivity;
  const context = rhythmContext(p);
  if (Object.prototype.hasOwnProperty.call(activityMap,chosen)) {
    context.activities = [activityMap[chosen]];
    context.desires = [desireMap[chosen]];
  }
  trackRhythm('companion_interest',{...metadata(p),...context});
  const dialog = document.createElement('dialog');
  dialog.className = 'n13-survey-dialog n18-preference-dialog';
  dialog.setAttribute('aria-labelledby','survey-title');
  let responseId;
  const safe = value => escapeHtml(value);
  // 각 항목은 native radio를 감싼 선택 카드: 키보드·스크린리더·터치 모두 지원.
  const options = (name,title,cls='') =>
    '<fieldset class="n18-field n18-field-'+name+'"><legend>'+title+'</legend>' +
    '<div class="n18-options '+cls+'">' +
    choices[name].map((v,i)=>
      '<label class="n18-option" for="n18-'+name+'-'+i+'">' +
      '<input type="radio" id="n18-'+name+'-'+i+'" name="'+name+'" value="'+safe(v)+'" required>' +
      '<span>'+safe(v)+'</span></label>'
    ).join('') + '</div></fieldset>';
  dialog.innerHTML =
    '<div class="dialog-content n18-dialog-content">' +
    '<div class="dialog-heading n18-dialog-heading">' +
    '<div><span class="n18-dialog-eyebrow">NA GACHI · 같이갈래?</span>' +
    '<h2 id="survey-title">같이 갈 취향을<br><em>가볍게 골라봐요</em></h2></div>' +
    '<button type="button" class="close-dialog" aria-label="닫기">×</button></div>' +
    '<p class="n18-selected-place"><span class="n18-selected-icon" aria-hidden="true">✦</span> <strong>'+safe(p.name)+'</strong>에서 함께한다면?</p>' +
    '<div class="n13-survey-progress" aria-label="2단계 중 1단계"><span class="is-active"></span><span></span></div>' +
    '<p class="n13-survey-step-title">1 / 2 · 나와 잘 맞는 동행</p>' +
    '<form class="survey n18-preference-form" id="companion-survey">' +
    '<div class="n13-survey-step" data-n13-step="1">' +
    options('age','나의 연령대','n18-age-grid') +
    options('preference','어떤 분들과 함께할까요?','n18-pref-grid') +
    options('purpose','하고 싶은 일','n18-purpose-grid') +
    '<button type="button" class="button primary full n18-next" data-n13-next>함께할 방식 고르기 <span aria-hidden="true">→</span></button>' +
    '</div>' +
    '<div class="n13-survey-step" data-n13-step="2" hidden>' +
    options('group_size','몇 명이 편하신가요?','n18-group-grid') +
    options('willingness','나중에 동행 구성을 도와준다면?','n18-fee-grid') +
    '<p class="n18-fee-note">서비스비에 대한 생각만 알려주세요. 식사·교통·입장료는 별도이며 지금 결제하는 금액은 없어요.</p>' +
    '<label class="n13-consent n18-consent"><input type="checkbox" name="consent" value="yes" required>' +
    '<span>선택한 답변과 익명 식별값을 동행 희망 확인에 사용하는 데 동의합니다. ' +
    '<a href="/privacy.html" target="_blank" rel="noopener">데이터 안내</a></span></label>' +
    '<button type="submit" class="button primary full n18-submit">' +
    (analyticsEnabled ? '동의하고 동행 희망 남기기' : '입력 체험 마치기 (미저장)') +
    ' <span aria-hidden="true">→</span></button>' +
    '<button type="button" class="n13-back" data-n13-back>← 이전으로</button>' +
    '</div>' +
    '<p class="survey-status" role="status"></p></form>' +
    '<p class="n18-privacy-note">아직 실제 동행을 연결하지 않아요. ' +
    (analyticsEnabled ? '동의 후 제출한 응답만 저장됩니다.' : '현재는 저장 서버가 연결되지 않아 선택 내용이 저장되지 않아요.') +
    '</p></div>';
  document.body.append(dialog);
  dialog.showModal();
  const form=dialog.querySelector('form');
  const step1=dialog.querySelector('[data-n13-step="1"]');
  const step2=dialog.querySelector('[data-n13-step="2"]');
  const progress=dialog.querySelector('.n13-survey-progress');
  const stepLabel=dialog.querySelector('.n13-survey-step-title');
  const status=dialog.querySelector('.survey-status');
  // 장소 카드에서 들어온 경우 활동을 자동 선택할 수 있지만 언제든 다른 선택이 가능합니다.
  const defaultPurpose = program?.purpose ||
    ({eat:'식사동행',hike:'취미친구',outing:'나들이동행',travel:'여행동행'}[chosen]);
  if (defaultPurpose) {
    const preset=[...form.querySelectorAll('input[name="purpose"]')].find(x=>x.value===defaultPurpose);
    if (preset) preset.checked=true;
  }
  const moveTo=number=>{
    step1.hidden=number!==1;
    step2.hidden=number!==2;
    progress.children[0].classList.add('is-active');
    progress.children[1].classList.toggle('is-active',number===2);
    progress.setAttribute('aria-label','2단계 중 '+number+'단계');
    stepLabel.textContent=number===1?'1 / 2 · 나와 잘 맞는 동행':'2 / 2 · 함께할 방식';
    status.textContent='';
    dialog.scrollTop=0;
    const heading=number===1 ? step1.querySelector('legend') : step2.querySelector('legend');
    heading?.setAttribute('tabindex','-1');
    heading?.focus({preventScroll:true});
  };
  dialog.querySelector('[data-n13-next]').onclick=()=>{
    const invalid=[...step1.querySelectorAll('input[required]')].find(x=>!x.checkValidity());
    if (invalid) {invalid.reportValidity();return;}
    moveTo(2);
  };
  dialog.querySelector('[data-n13-back]').onclick=()=>moveTo(1);
  dialog.querySelector('.close-dialog').onclick=()=>dialog.close();
  dialog.onclose=()=>{
    dialog.remove();
    if (trigger?.isConnected) trigger.focus();
    else ($('#companion-open') || document.querySelector('[data-companion-interest]'))?.focus();
  };
  form.onsubmit=async event=>{
    event.preventDefault();
    if (!form.reportValidity() || !form.elements.consent.checked) return;
    if (!responseId) responseId=anonymousId();
    const button=form.querySelector('[type=submit]');
    if (button.disabled) return;
    button.disabled=true;
    const values=Object.fromEntries(new FormData(form));
    delete values.consent;
    const success=analyticsEnabled && form.elements.consent.checked &&
      await recordConsentedSurvey({...metadata(p),...context,...values,response_id:responseId});
    if (analyticsEnabled && !success) {
      button.disabled=false;
      status.textContent='저장되지 않았어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.';
      return;
    }
    dialog.querySelector('.dialog-content').innerHTML=
      '<div class="n18-done"><span aria-hidden="true" class="n18-done-icon">'+(success?'✓':'✦')+'</span>' +
      '<h2 id="survey-title">'+(success?'동행 희망을 남겼어요':'취향 설정을 살펴봤어요')+'</h2>' +
      '<p>'+(success ? '선택한 내용이 저장됐어요. 실제 모임 신청이나 예약은 아니에요.' :
        '현재 저장 서버가 연결되지 않아 응답은 저장되지 않았어요.')+'</p>' +
      '<button type="button" class="button primary full" id="survey-done">확인</button></div>';
    dialog.querySelector('#survey-done').onclick=()=>dialog.close();
    dialog.querySelector('#survey-done').focus();
  };
}
document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
const companionStatus = $('#n13-save-status');
if (companionStatus) companionStatus.textContent = analyticsEnabled
  ? '설문 저장 설정이 등록돼 있습니다. 실제 저장 여부는 제출 후 확인할 수 있습니다. 현재 동행 연결·예약·결제는 없습니다.'
  : '현재 분석 서버가 연결되지 않아 설문 응답은 저장되지 않습니다. 실제 동행 연결·예약·결제도 제공하지 않습니다.';
updateSaved();
document.addEventListener('click', event => {
  const save = event.target.closest('[data-save]');
  if (save) {
    const p = places.find(item => item.id === save.dataset.save); if (!p) return;
    const { ok: success, removing } = toggleSavedPlace(p.id);
    if (!success) { toast('브라우저 저장 공간을 사용할 수 없어요. 저장 허용 설정을 확인해 주세요.'); return; }
    if (!removing) trackRhythm('rhythm_save', { ...metadata(p), ...rhythmContext(p) });
    if (page === 'saved') {
      const index = [...document.querySelectorAll('[data-save]')].indexOf(save);
      render();
      const remaining = document.querySelectorAll('[data-save]');
      (remaining[Math.min(index, remaining.length - 1)] || document.querySelector('.empty-state a'))?.focus();
    } else updateSaved();
    toast(removing ? '저장한 곳에서 지웠어요.' : '저장한 곳에 담았어요.');
  }
  const share = event.target.closest('[data-share]'); if (share) { const p = places.find(p=>p.id===share.dataset.share); if(p) sharePlace(p); }
  const planButton = event.target.closest('[data-program-interest]'); 
  if (planButton) {
    const program = programById(planButton.dataset.programInterest);
    if (program) companionDialog(programContext(program),planButton,program);
    return;
  }
  const interest = event.target.closest('[data-companion-interest]'); if (interest) { const p = places.find(p=>p.id===interest.dataset.companionInterest); if(p) companionDialog(p,interest); }
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
      trackRhythm('rhythm_start',{ is_demo:places.every(p=>p.isDemo), ...rhythmContext() });
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
    $('#companion-open').onclick = () => companionDialog(current,$('#companion-open'));
  }
}
init();
