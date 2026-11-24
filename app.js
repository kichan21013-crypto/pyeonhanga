import { card, icon, escapeHtml, placeUrl } from './ui.js';
import { savedIds, anonymousId } from './storage.js';
import { track, trackRhythm, analyticsEnabled, recordConsentedSurvey } from './analytics.js';
import { inferIntent, requestedComforts, COMPANIONS } from './search.js';
import { emptyRhythmFilters, recommendRhythms, DESIRES, ACTIVITIES, DURATION_OPTIONS, TRANSPORT_OPTIONS, companionSummary, toggleSelection, activeActivities } from './rhythm.js';
import { toggleSavedPlace, shareOrCopy, SURVEY_CHOICES } from './actions.js';
import { createProgressiveFlow } from './flow.js';
import { programById, programContext } from './assets/v15-programs.js';
import { GROUP_ACTIVITIES, cleanGroupActivities, optInCompanionUpdates } from './assets/v19-companion-service.js';

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
  if(document.querySelector('dialog.n13-survey-dialog'))return;
  const initialActivity={walk:'outing',eat:'food',hike:'hike',outing:'outing',travel:'travel'}[trigger?.dataset?.companionActivity] ||
    program?.activity || (p.category==='맛집'?'food':p.category==='여행'?'travel':'outing');
  const dialog=document.createElement('dialog');
  dialog.className='n13-survey-dialog n18-preference-dialog n19-preference-dialog';
  dialog.setAttribute('aria-labelledby','survey-title');
  let responseId;
  const safe=value=>escapeHtml(value);
  const activityCards=GROUP_ACTIVITIES.map((item,i)=>
    '<label class="n19-activity-choice" for="n19-activity-'+i+'">' +
    '<input type="checkbox" id="n19-activity-'+i+'" name="activity-interest" value="'+item.id+'" '+
      (item.id===initialActivity?'checked ':'')+'>' +
    '<span><img src="/assets/v18-'+({food:'eat',hike:'hike',outing:'outing',travel:'travel'}[item.id])+
       '.svg" alt="" aria-hidden="true"><strong>'+safe(item.label)+'</strong><small>선택</small></span></label>'
  ).join('');
  const radio=(name,title,cls='')=>'<fieldset class="n18-field n18-field-'+name+'"><legend>'+title+'</legend>' +
    '<div class="n18-options '+cls+'">'+choices[name].map((v,i)=>
      '<label class="n18-option" for="n19-'+name+'-'+i+'">' +
      '<input type="radio" id="n19-'+name+'-'+i+'" name="'+name+'" value="'+safe(v)+'" '+(name==='preference'&&i===2?'checked ':'')+'required>' +
      '<span>'+safe(v)+'</span></label>'
    ).join('')+'</div></fieldset>';
  dialog.innerHTML=
    '<div class="dialog-content n18-dialog-content n19-dialog-content">' +
      '<div class="dialog-heading n18-dialog-heading"><div>' +
        '<span class="n18-dialog-eyebrow">NAGACHI · 취향으로 모여요</span>' +
        '<h2 id="survey-title">나랑 맞는 하루,<br><em>같이 만들어볼까요?</em></h2></div>' +
        '<button type="button" class="close-dialog" aria-label="닫기">×</button></div>' +
      '<p class="n18-selected-place"><span class="n18-selected-icon" aria-hidden="true">✦</span>' +
        '<strong>'+safe(p.name)+'</strong>에서 시작해볼까요?</p>' +
      '<div class="n13-survey-progress" aria-label="2단계 중 1단계"><span class="is-active"></span><span></span></div>' +
      '<p class="n13-survey-step-title">1 / 2 · 관심 있는 하루</p>' +
      '<form class="survey n18-preference-form n19-preference-form" id="companion-survey">' +
        '<div class="n13-survey-step" data-n13-step="1">' +
          radio('age','어느 연령대이세요?','n18-age-grid') +
          '<fieldset class="n19-multi-field"><legend>함께 해보고 싶은 건?</legend>' +
          '<p>끌리는 건 여러 개 골라도 괜찮아요.</p>' +
          '<div class="n19-activity-options">'+activityCards+'</div>' +
          '<div class="n19-chosen-status" role="status">선택한 취향 <strong id="n19-choice-total">1개</strong></div></fieldset>' +
          '<button type="button" class="button primary full n18-next" data-n13-next>' +
            '다음 · 모임 방식 고르기 <span aria-hidden="true">→</span></button></div>' +
        '<div class="n13-survey-step" data-n13-step="2" hidden>' +
          radio('preference','어떤 분들과 편할까요?','n18-pref-grid') +
          radio('group_size','몇 명이 좋으세요?','n18-group-grid') +
          radio('willingness','나중에 모임 준비를 돕는다면?','n18-fee-grid') +
          '<p class="n18-fee-note">서비스비에 대한 생각만 골라주세요. 식비·교통·입장료는 별도이며 지금 결제되는 금액은 없어요.</p>' +
          '<label class="n19-updates-optin"><input type="checkbox" name="updates" value="yes" '+
            (!analyticsEnabled?'disabled ':'')+'><span><strong>내가 고른 동행 소식도 보고 싶어요</strong>' +
            '<small>선택한 활동의 새 모임 준비·일정 공지를 이 기기에서 앱에 재방문할 때 볼 수 있어요. ' +
              '문자·이메일·푸시는 보내지 않으며 언제든 해지할 수 있어요.</small></span></label>' +
          '<label class="n13-consent n18-consent"><input type="checkbox" name="consent" value="yes" required>' +
            '<span>선택한 취향과 익명 식별값을 관심 인원 확인에 사용하는 데 동의합니다. ' +
            '<a href="/privacy.html" target="_blank" rel="noopener">데이터 안내</a></span></label>' +
          '<button type="submit" class="button primary full n18-submit">' +
            (analyticsEnabled?'동의하고 관심 남기기':'입력 체험 마치기 (미저장)') +
            ' <span aria-hidden="true">→</span></button>' +
          '<button type="button" class="n13-back" data-n13-back>← 이전으로</button></div>' +
        '<p class="survey-status" role="status"></p></form>' +
      '<p class="n18-privacy-note">지금은 관심을 모으는 준비 단계이며 실제 동행 참가·예약·결제가 아닙니다.'+
        (!analyticsEnabled?' 저장 서버가 연결되지 않아 응답은 누적되지 않아요.':'')+'</p></div>';
  document.body.append(dialog);
  dialog.showModal();
  const form=dialog.querySelector('form');
  const step1=dialog.querySelector('[data-n13-step="1"]');
  const step2=dialog.querySelector('[data-n13-step="2"]');
  const progress=dialog.querySelector('.n13-survey-progress');
  const stepLabel=dialog.querySelector('.n13-survey-step-title');
  const status=dialog.querySelector('.survey-status');
  const chosenActivities=()=>cleanGroupActivities(
    [...form.querySelectorAll('[name="activity-interest"]:checked')].map(x=>x.value)
  );
  function syncChoiceCount(){
    const selected=chosenActivities().length;
    const count=dialog.querySelector('#n19-choice-total');
    if(count)count.textContent=selected+'개';
  }
  form.addEventListener('change',event=>{
    if(event.target.matches('[name="activity-interest"]'))syncChoiceCount();
  });
  const showStep=number=>{
    step1.hidden=number!==1;step2.hidden=number!==2;
    progress.children[0].classList.add('is-active');
    progress.children[1].classList.toggle('is-active',number===2);
    progress.setAttribute('aria-label','2단계 중 '+number+'단계');
    stepLabel.textContent=number===1?'1 / 2 · 관심 있는 하루':'2 / 2 · 함께할 방식';
    status.textContent='';
    dialog.scrollTop=0;
  };
  dialog.querySelector('[data-n13-next]').onclick=()=>{
    const age=form.querySelector('[name="age"]:checked');
    if(!age){form.querySelector('[name="age"]')?.reportValidity();return;}
    if(!chosenActivities().length){status.textContent='같이 해보고 싶은 일을 하나 이상 골라주세요.';return;}
    showStep(2);
  };
  dialog.querySelector('[data-n13-back]').onclick=()=>showStep(1);
  dialog.querySelector('.close-dialog').onclick=()=>dialog.close();
  dialog.onclose=()=>{
    dialog.remove();
    if(trigger?.isConnected)trigger.focus();
    else ($('#companion-open')||document.querySelector('[data-companion-interest]'))?.focus();
  };
  form.onsubmit=async event=>{
    event.preventDefault();
    // 모든 단계에서 고른 값이 존재해야 하며 비동의 요청은 절대 서버에 보내지 않습니다.
    const activities=chosenActivities();
    if(!activities.length||!form.querySelector('[name="age"]:checked')){
      showStep(1);status.textContent='연령대와 해보고 싶은 일을 골라주세요.';return;
    }
    if(!form.reportValidity()||!form.elements.consent.checked)return;
    if(!responseId)responseId=anonymousId();
    const button=form.querySelector('[type="submit"]');
    if(button.disabled)return;
    button.disabled=true;
    const values=Object.fromEntries(new FormData(form));
    const subscribe=values.updates==='yes';
    delete values.consent;delete values.updates;delete values['activity-interest'];
    const mainPurpose={food:'식사동행',hike:'취미친구',outing:'나들이동행',travel:'여행동행'};
    values.purpose=mainPurpose[activities[0]]||'취미친구';
    values.activities=activities;
    const desire={food:'eat',hike:'outdoor',outing:'explore',travel:'explore'};
    values.desires=[...new Set(activities.map(x=>desire[x]))];
    const success=analyticsEnabled&&form.elements.consent.checked&&
      await recordConsentedSurvey({...metadata(p),...rhythmContext(p),...values,response_id:responseId});
    if(analyticsEnabled&&!success){
      button.disabled=false;status.textContent='저장되지 않았어요. 연결 상태를 확인하고 다시 시도해 주세요.';return;
    }
    let subscriptionMessage='';
    if(success&&subscribe){
      const subscribed=await optInCompanionUpdates(responseId,activities);
      subscriptionMessage=subscribed.ok
        ? '선택한 동행 소식은 이 기기에서 나가치를 다시 열면 볼 수 있어요.'
        : '관심은 저장됐지만 소식 수신 등록은 실패했어요. 현재 안내 기능 설정을 확인해야 합니다.';
    }
    document.dispatchEvent(new CustomEvent('nagachi:interest-saved'));
    dialog.querySelector('.dialog-content').innerHTML=
      '<div class="n18-done"><span aria-hidden="true" class="n18-done-icon">'+(success?'✓':'✦')+'</span>' +
      '<h2 id="survey-title">'+(success?'함께하고 싶은 마음을 남겼어요':'취향을 골라봤어요')+'</h2>' +
      '<p>'+(success?'관심이 저장됐어요. 아직 실제 참가나 예약은 아니에요.':
        '저장 서버가 연결되지 않아 응답은 저장되지 않았어요.')+'</p>' +
      (subscriptionMessage?'<p>'+escapeHtml(subscriptionMessage)+'</p>':'') +
      '<button type="button" class="button primary full" id="survey-done">확인</button></div>';
    dialog.querySelector('#survey-done').onclick=()=>dialog.close();
    dialog.querySelector('#survey-done').focus();
  };
}

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
