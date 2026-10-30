const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
const icon = name => ({
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="m3 11 9-8 9 8v9H4z"/><path d="M9 20v-6h6v6"/></svg>',
  heart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>',
  compass:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>',
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>',
  sliders:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 6h10m4 0h2M4 12h3m4 0h9M4 18h8m4 0h4"/><circle cx="16" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="14" cy="18" r="2"/></svg>'
})[name];

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
  shell.innerHTML = '<div class="app-home-title"><h1>오늘 뭐 할까요?</h1><small>하나만 골라도 돼요</small></div>';

  const searchWrap = document.createElement('div');
  searchWrap.className = 'app-home-search';
  searchWrap.innerHTML = icon('search');
  const input = qs('#search-input', searchForm);
  if (input) input.placeholder = '먹고, 걷고, 쉬고… 오늘 뭐 할까요?';
  searchWrap.append(searchForm);

  desireGrid.classList.add('app-category-grid');
  shell.prepend(searchWrap);
  shell.append(desireGrid);

  const promo = document.createElement('section');
  promo.className = 'app-promo';
  promo.innerHTML = '<small>오늘, 내 리듬대로</small><strong>내 기분에 맞는 곳을<br>가볍게 골라보세요.</strong><span>장소보다 먼저, 오늘 하고 싶은 것부터.</span>';
  shell.append(promo);

  const hero = qs('.rhythm-hero');
  main.insertBefore(shell, hero || main.firstChild);

  const preview = document.createElement('div');
  preview.className = 'app-home-preview';
  preview.innerHTML = '<div class="app-home-preview-head"><h2>오늘 이런 곳 어때요?</h2><span>확인된 장소부터</span></div>';
  results.parentElement?.insertBefore(preview, results);

  const nav = document.createElement('nav');
  nav.className = 'app-bottom-nav';
  nav.setAttribute('aria-label','하단 메뉴');
  nav.innerHTML = `<button type="button" class="is-active" data-v5-home>${icon('home')}<span>홈</span></button><button type="button" data-v5-today>${icon('compass')}<span>오늘</span></button><a href="/saved.html">${icon('heart')}<span>저장</span></a>`;
  document.body.append(nav);

  let refinement = null;
  let started = false;

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
    const button = qs('#recommend-button');
    if (!button) return;
    button.disabled = false;
    button.click();
    document.body.classList.add('v5-live-active','v5-results-active');
    document.body.classList.remove('v5-flow-active');
    results.dataset.mode = 'results';
    buildRefinement();
    if (scroll) setTimeout(() => refinement?.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'}), 0);
  };

  qsa('[data-desire]', desireGrid).forEach(button => button.addEventListener('click', () => {
    setTimeout(() => submitLive({ scroll:true }), 0);
  }));

  searchForm.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.isComposing) return;
    setTimeout(() => submitLive({ scroll:true }), 0);
  });

  nav.querySelector('[data-v5-home]').addEventListener('click', () => shell.scrollIntoView({behavior:'smooth', block:'start'}));
  nav.querySelector('[data-v5-today]').addEventListener('click', () => {
    (refinement || shell).scrollIntoView({behavior:'smooth', block:'start'});
  });

  document.addEventListener('click', event => {
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
      document.body.classList.remove('v5-flow-active','v5-results-active','v5-live-active');
      results.dataset.mode = 'preview';
      refinement?.remove();
      refinement = null;
      return;
    }

    const liveFilter = event.target.closest('[data-activity],[data-companion],[data-duration],[data-transport],[data-comfort]');
    if (liveFilter && refinement?.contains(liveFilter)) setTimeout(() => submitLive(), 0);
  });

  document.addEventListener('change', event => {
    if (event.target.matches('#region,#category') && refinement?.contains(event.target)) setTimeout(() => submitLive(), 0);
  });

  results.dataset.mode = 'preview';
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupHome, { once:true });
else setupHome();
