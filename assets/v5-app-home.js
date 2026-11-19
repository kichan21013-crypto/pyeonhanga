import { recommendRhythms, emptyRhythmFilters, ACTIVITIES } from '/rhythm.js?v=20261119-v11';
import { card, escapeHtml } from '/ui.js?v=20261119-v11';
import { savedIds } from '/storage.js?v=20261119-v11';

const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
const icon = name => ({
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="m3 11 9-8 9 8v9H4z"/><path d="M9 20v-6h6v6"/></svg>',
  heart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>',
  compass:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>',
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>',
  sliders:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 6h10m4 0h2M4 12h3m4 0h9M4 18h8m4 0h4"/><circle cx="16" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="14" cy="18" r="2"/></svg>'
})[name];

const selectedValues = (selector, key) => qsa(`${selector}[aria-pressed="true"]`).map(node => node.dataset[key]).filter(Boolean);

function filtersFromUi() {
  const filters = emptyRhythmFilters();
  filters.query = qs('#search-input')?.value?.trim() || '';
  filters.desires = selectedValues('[data-desire]', 'desire');
  filters.activities = selectedValues('[data-activity]', 'activity');
  filters.companions = selectedValues('[data-companion]', 'companion');
  filters.comforts = selectedValues('[data-comfort]', 'comfort');
  filters.duration = selectedValues('[data-duration]', 'duration')[0] || 'any';
  filters.transport = selectedValues('[data-transport]', 'transport')[0] || 'any';
  filters.region = qs('#region')?.value || '';
  filters.category = qs('#category')?.value || 'auto';
  filters.allowActivityFallback = allowSimilarOnEmpty;
  return filters;
}

let livePlacesPromise = null;
let liveVisibleCount = 6;
let allowSimilarOnEmpty = false;
let renderSequence = 0;
function loadLivePlaces() {
  if (!livePlacesPromise) {
    livePlacesPromise = fetch('/data/places.json?v=20261119-v11', { cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw new Error('live places load failed');
        return response.json();
      })
      .catch(error => {
        livePlacesPromise = null;
        throw error;
      });
  }
  return livePlacesPromise;
}

async function renderLiveResults({ more = false } = {}) {
  if (more) liveVisibleCount += 6;
  else liveVisibleCount = 6;
  const grid = qs('#places-grid');
  if (!grid) return false;
  const sequence = ++renderSequence;
  grid.setAttribute('aria-busy','true');
  if (!more) grid.innerHTML = '<div class="app-loading-skeleton" aria-hidden="true"></div><div class="app-loading-skeleton" aria-hidden="true"></div>';
  try {
    const places = await loadLivePlaces();
    if (sequence !== renderSequence) return false;
    const filters = filtersFromUi();
    const rhythms = recommendRhythms(places, filters);
    const ids = savedIds();
    // 명시적 세부활동 선택이 0건일 때는 일반 장소를 맞는 장소처럼 섞지 않는다.
    const strictEmpty = filters.activities.length > 0 && !allowSimilarOnEmpty && rhythms.length === 0;
    const anotherMeal = filters.activities.some(value => ['seafood','meat','noodle','korean_food'].includes(value));
    const fallbackLabel = anotherMeal ? '다른 식사 장소' : '비슷한 장소';
    const chosenLabel = filters.activities.map(value => ACTIVITIES[value]?.[0]).filter(Boolean).join(' · ');
    const areaLabel = filters.region || '선택한 지역';
    const similarBanner = allowSimilarOnEmpty && filters.activities.length > 0 && rhythms.some(result => result.fallbackActivity)
      ? `<div class="app-similar-notice"><strong>${fallbackLabel}를 보여드려요</strong><span>선택한 세부활동과 일치하는 장소는 아닙니다.</span><button type="button" data-hide-similar>정확한 조건만 보기</button></div>`
      : '';
    grid.innerHTML = rhythms.length
      ? similarBanner + rhythms.slice(0, liveVisibleCount).map(result => card(result.place, ids.includes(result.place.id), filters, result)).join('')
      : strictEmpty
        ? `<div class="empty-state"><h3>${escapeHtml(areaLabel)} · ${escapeHtml(chosenLabel)} 0곳</h3><p>현재 확인된 정확한 추천이 없어요. 다른 활동이나 지역을 선택할 수 있어요.</p><button type="button" class="button secondary" data-show-similar>${fallbackLabel} 보기</button></div>`
        : '<div class="empty-state"><h3>조건에 맞는 장소가 아직 없어요</h3><p>다른 지역 또는 활동을 골라보세요.</p></div>';
    grid.classList.toggle('is-empty',rhythms.length===0);
    const moreButton = qs('#app-load-more');
    if (moreButton) {
      moreButton.hidden = rhythms.length <= liveVisibleCount;
      moreButton.textContent = `장소 더 보기 (${Math.min(liveVisibleCount, rhythms.length)} / ${rhythms.length})  ＋`;
    }
    if (qs('#result-count')) qs('#result-count').textContent = rhythms.length;
    if (qs('#result-status')) qs('#result-status').textContent = `${rhythms.length}개의 오늘의 리듬을 찾았습니다.`;
    const previewCount = qs('.app-preview-count');
    if (previewCount) previewCount.textContent = `${rhythms.length}곳`;
    const previewTitle = qs('.app-home-preview-head h2');
    if (previewTitle) previewTitle.textContent = filters.activities.length
      ? `${filters.activities.map(value => ACTIVITIES[value]?.[0]).filter(Boolean).join(' · ')} 추천`
      : (filters.region ? `${filters.region}에서 찾은 장소` : '오늘의 추천 장소');
    qsa('[data-quick-activity]').forEach(button => button.setAttribute('aria-pressed',
      String(filters.activities.includes(button.dataset.quickActivity))));
    document.dispatchEvent(new CustomEvent('nagachi:v5-results-rendered', {
      detail: { count: rhythms.length, activities: [...filters.activities] }
    }));
    grid.removeAttribute('aria-busy');
    return true;
  } catch {
    if (sequence !== renderSequence) return false;
    grid.removeAttribute('aria-busy');
    grid.innerHTML = '<div class="empty-state"><h3>장소를 불러오지 못했어요</h3><p>연결을 확인한 뒤 다시 시도해주세요.</p><button type="button" class="button secondary" data-retry-recommend>다시 시도</button></div>';
    grid.classList.add('is-empty');
    return false;
  }
}

function setupHome() {
  if (document.body.dataset.page !== 'home' || document.body.dataset.v5Home === 'ready') return;
  const main = qs('#main');
  const explore = qs('#explore');
  const step1 = qs('#flow-step-1');
  const desireGrid = qs('.desire-grid', step1);
  const searchForm = qs('#search-form', step1);
  const results = qs('#rhythm-results');
  if (!main || !explore || !step1 || !desireGrid || !searchForm || !results) return;

  document.body.dataset.v5Home = 'ready';

  const shell = document.createElement('section');
  shell.className = 'app-home-shell';
  shell.innerHTML = '<div class="app-home-title"><p class="app-home-kicker">NAGACHI · 나가치</p><h1>오늘은 <span>뭐 하고 싶으세요?</span></h1><small>맛있는 곳부터 산책까지, 마음 가는 대로 골라보세요.</small></div>';

  const searchWrap = document.createElement('div');
  searchWrap.className = 'app-home-search';
  searchWrap.innerHTML = icon('search');
  const input = qs('#search-input', searchForm);
  if (input) input.placeholder = '먹고, 걷고, 쉬고… 오늘 뭐 할까요?';
  searchWrap.append(searchForm);

  desireGrid.classList.add('app-category-grid');
  // 시각적으로 짧고 명확한 라벨; 앱 내부 필터값은 그대로 사용합니다.
  const desireLabels = {eat:'맛집',move:'활동',outdoor:'산책',rest:'휴식',explore:'나들이',social:'함께'};
  for (const [key,label] of Object.entries(desireLabels)) {
    const span = desireGrid.querySelector(`[data-desire="${key}"] [data-choice-label]`);
    if (span) span.textContent = label;
  }
  shell.append(searchWrap);
  
  // 지역은 현재 위치를 추정하지 않고 사용자가 누른 값만 사용합니다.
  const regions = ['', '서울', '경기', '강릉', '경주', '부산', '제주'];
  const regionRow = document.createElement('div');
  regionRow.className = 'app-area-nav';
  regionRow.setAttribute('role','group');
  regionRow.setAttribute('aria-label','추천 지역 고르기');
  regionRow.innerHTML = '<span class="app-area-nav-label">지역</span>' + regions.map(region =>
    `<button type="button" data-v6-region="${region}" aria-pressed="${region === ''}">${region || '전체'}</button>`
  ).join('');
  shell.append(regionRow);

  const quickLabel = document.createElement('h2');
  quickLabel.className = 'app-shortcut-title';
  quickLabel.textContent = '바로 찾아보기';
  shell.append(quickLabel);

  // 원터치 세부활동: 기존 추천 상태와 클릭 동작을 재사용합니다.
  const shortcuts = document.createElement('div');
  shortcuts.className = 'app-quick-shortcuts';
  shortcuts.setAttribute('role','group');
  shortcuts.setAttribute('aria-label','자주 찾는 활동을 바로 선택');
  const quickItems = [
    {activity:'seafood',desire:'eat',label:'회·해산물'},
    {activity:'cafe',desire:'rest',label:'카페'},
    {activity:'walk',desire:'outdoor',label:'산책'},
    {activity:'meat',desire:'eat',label:'고기'},
    {activity:'drive',desire:'explore',label:'드라이브'},
    {activity:'run',desire:'move',label:'러닝'},
  ];
  shortcuts.innerHTML = quickItems.map(({activity,desire,label}) =>
    `<button type="button" data-quick-activity="${activity}" data-quick-desire="${desire}" aria-pressed="false">${label}</button>`
  ).join('');
  shell.append(shortcuts);
  const sectionTitle = document.createElement('div');
  sectionTitle.className = 'app-section-title';
  sectionTitle.innerHTML = '<span>기분 따라 고르기</span><small>여러 개 선택할 수 있어요</small>';
  shell.append(sectionTitle,desireGrid);

  const promo = document.createElement('section');
  promo.className = 'app-promo';
  promo.innerHTML = '<div class="app-promo-copy"><small>처음 이용하신다면</small><strong>한 가지만 골라도<br>추천을 볼 수 있어요.</strong><span>가고 싶은 곳은 하트로 저장하세요.</span></div><button type="button" class="app-promo-link" data-browse-all>전체 보기 →</button>';
  shell.append(promo);

  const hero = qs('.rhythm-hero');
  main.insertBefore(shell, hero || main.firstChild);

  const preview = document.createElement('div');
  preview.className = 'app-home-preview';
  preview.innerHTML = '<div class="app-home-preview-head"><h2>이런 곳은 어떠세요?</h2><div class="app-preview-tools"><span class="app-preview-count">실제 등록된 장소</span><button type="button" class="app-results-edit" data-edit-choices>조건 수정</button></div></div>';
  results.parentElement?.insertBefore(preview, results);
  const moreButton = document.createElement('button');
  moreButton.type = 'button';
  moreButton.id = 'app-load-more';
  moreButton.className = 'app-load-more';
  moreButton.hidden = true;
  results.append(moreButton);
  moreButton.addEventListener('click', () => renderLiveResults({more:true}));

  const nav = document.createElement('nav');
  nav.className = 'app-bottom-nav';
  nav.setAttribute('aria-label','하단 메뉴');
  nav.innerHTML = `<button type="button" class="is-active" data-v5-home>${icon('home')}<span>홈</span></button><button type="button" data-v5-today>${icon('compass')}<span>추천</span></button><a href="/saved.html">${icon('heart')}<span>저장</span></a>`;
  document.body.append(nav);

  let refinement = null;
  let started = false;

  regionRow.addEventListener('click', event => {
    const button = event.target.closest('[data-v6-region]');
    if (!button) return;
    const region = button.dataset.v6Region;
    allowSimilarOnEmpty = false;
    const select = qs('#region');
    if (!select) return;
    select.value = region;
    regionRow.querySelectorAll('[data-v6-region]').forEach(el => el.setAttribute('aria-pressed',String(el === button)));
    select.dispatchEvent(new Event('change',{bubbles:true}));
    submitLive({scroll:true});
  });

  shortcuts.addEventListener('click', event => {
    const quick = event.target.closest('[data-quick-activity]');
    if (!quick) return;
    // 선택한 빠른 활동을 정확 일치 조건으로 적용합니다.
    // 다른 욕구/세부활동 선택은 기존 앱 이벤트로 해제해 두 계층의 상태를 일치시킵니다.
    qsa('[data-desire][aria-pressed="true"]',desireGrid).forEach(button => button.click());
    const desireButton = desireGrid.querySelector(`[data-desire="${quick.dataset.quickDesire}"]`);
    desireButton?.click();
    qsa('#activity-options [data-activity][aria-pressed="true"]').forEach(button => {
      const current = qs(`#activity-options [data-activity="${button.dataset.activity}"]`);
      current?.click();
    });
    qs(`#activity-options [data-activity="${quick.dataset.quickActivity}"]`)?.click();
    allowSimilarOnEmpty = false;
    setTimeout(() => submitLive({scroll:true}), 0);
  });

  const ensureStarted = () => {
    if (started) return;
    qs('#rhythm-start')?.click();
    started = true;
  };

  const buildRefinement = () => {
    if (refinement?.isConnected) return refinement;
    const conditionBody = qs('.condition-stage-body');
    if (!conditionBody) return null;

    refinement = document.createElement('section');
    refinement.className = 'live-refinement';
    refinement.innerHTML = '<div class="live-refinement-head"><strong>추천 더 좁히기</strong></div>';

    const activities = qs('.condition-activities', conditionBody);
    if (activities) {
      activities.classList.add('live-activity-group');
      refinement.append(activities);
    }

    const more = document.createElement('details');
    more.className = 'live-more';
    more.innerHTML = `<summary>${icon('sliders')}<span>조건 더보기</span><b aria-hidden="true">＋</b></summary><div class="live-more-backdrop" data-live-more-close></div><div class="live-more-body" role="dialog" aria-label="추천 조건 더보기"><div class="live-more-sheet-head"><strong>조건 더하기</strong><button type="button" data-live-more-close aria-label="조건 닫기">×</button></div><div class="live-more-sheet-content"></div></div>`;
    const body = qs('.live-more-sheet-content', more);
    qsa('.condition-stage-group', conditionBody).filter(group => !group.classList.contains('condition-activities')).forEach(group => body.append(group));
    const optional = qs('.condition-more', conditionBody);
    if (optional) body.append(optional);
    refinement.append(more);

    preview.parentElement?.insertBefore(refinement, preview);
    return refinement;
  };

  const submitLive = ({ scroll = false } = {}) => {
    ensureStarted();
    nav.querySelector('[data-v5-home]')?.classList.remove('is-active');
    nav.querySelector('[data-v5-today]')?.classList.add('is-active');
    document.body.classList.add('v5-live-active','v5-results-active');
    document.body.classList.remove('v5-flow-active');
    results.hidden = false;
    results.dataset.mode = 'results';
    buildRefinement();
    setTimeout(() => {
      results.hidden = false;
      renderLiveResults();
      if (scroll) refinement?.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'});
    }, 0);
  };

  qsa('[data-desire]', desireGrid).forEach(button => button.addEventListener('click', () => {
    allowSimilarOnEmpty = false;
    setTimeout(() => submitLive({ scroll:true }), 0);
  }));

  searchForm.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.isComposing) return;
    setTimeout(() => submitLive({ scroll:true }), 0);
  });

  nav.querySelector('[data-v5-home]').addEventListener('click', () => {
    nav.querySelector('[data-v5-today]')?.classList.remove('is-active');
    nav.querySelector('[data-v5-home]')?.classList.add('is-active');
    shell.scrollIntoView({behavior:'smooth', block:'start'});
  });
  preview.addEventListener('click', event => {
    if (event.target.closest('[data-edit-choices]')) shell.scrollIntoView({behavior:'smooth',block:'start'});
  });
  promo.addEventListener('click', event => {
    if (event.target.closest('[data-browse-all]')) submitLive({scroll:true});
  });
  nav.querySelector('[data-v5-today]').addEventListener('click', () => {
    (refinement || shell).scrollIntoView({behavior:'smooth', block:'start'});
  });

  // app.js가 세부활동 칩 DOM을 다시 그린 뒤, 현재 aria-pressed 상태를 직접 읽어
  // v5 결과 엔진이 권위 있게 다시 렌더합니다. 숨겨진 추천 버튼 클릭에 의존하지 않습니다.
  document.addEventListener('click', event => {
    const activity = event.target.closest?.('[data-activity]');
    if (!activity || !refinement?.contains(activity)) return;
    allowSimilarOnEmpty = false;
    setTimeout(() => submitLive(), 0);
  }, true);

  document.addEventListener('click', event => {
    if (event.target.closest('[data-retry-recommend]')) {
      renderLiveResults();
      return;
    }
    if (event.target.closest('[data-show-similar]')) {
      allowSimilarOnEmpty = true;
      renderLiveResults();
      return;
    }
    if (event.target.closest('[data-hide-similar]')) {
      allowSimilarOnEmpty = false;
      renderLiveResults();
      return;
    }
    const closeMore = event.target.closest('[data-live-more-close]');
    if (closeMore) {
      event.preventDefault();
      const details = closeMore.closest('.live-more');
      if (details) details.open = false;
      return;
    }
    if (event.target.closest('.condition-back')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      shell.scrollIntoView({behavior:'smooth', block:'start'});
      return;
    }
    if (event.target.closest('[data-reset], #reset-filters')) {
      allowSimilarOnEmpty = false;
      document.body.classList.remove('v5-flow-active','v5-results-active','v5-live-active');
      results.dataset.mode = 'preview';
      refinement?.remove();
      refinement = null;
      return;
    }

    const liveFilter = event.target.closest('[data-companion],[data-duration],[data-transport],[data-comfort]');
    if (liveFilter && refinement?.contains(liveFilter)) {
      allowSimilarOnEmpty = false;
      setTimeout(() => submitLive(), 0);
    }
  });

  document.addEventListener('change', event => {
    if (event.target.matches('#region,#category') && refinement?.contains(event.target)) {
      allowSimilarOnEmpty = false;
      setTimeout(() => submitLive(), 0);
    }
  });

  results.dataset.mode = 'preview';
  if (location.hash === '#rhythm-results') setTimeout(() => submitLive({scroll:true}), 0);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupHome, { once:true });
else setupHome();
