const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
const icon = name => ({
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m3 11 9-8 9 8v9H4z"/><path d="M9 20v-6h6v6"/></svg>',
  heart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>',
  compass:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>',
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>'
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
  nav.innerHTML = `<a href="/" class="is-active">${icon('home')}<span>홈</span></a><button type="button" data-v5-today>${icon('compass')}<span>오늘</span></button><a href="/saved.html">${icon('heart')}<span>저장</span></a>`;
  document.body.append(nav);

  const openConditions = () => {
    document.body.classList.add('v5-flow-active');
    document.body.classList.remove('v5-results-active');
    qs('#rhythm-start')?.click();
    setTimeout(() => {
      qs('[data-next-step="2"]')?.click();
      qs('#flow-step-2')?.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'});
    }, 0);
  };

  qsa('[data-desire]', desireGrid).forEach(button => button.addEventListener('click', () => {
    setTimeout(openConditions, 0);
  }));

  searchForm.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.isComposing) return;
    setTimeout(openConditions, 0);
  });

  nav.querySelector('[data-v5-today]').addEventListener('click', () => shell.scrollIntoView({behavior:'smooth', block:'start'}));

  document.addEventListener('click', event => {
    if (event.target.closest('.condition-back')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      location.href = '/';
      return;
    }
    if (event.target.closest('#recommend-button')) {
      document.body.classList.remove('v5-flow-active');
      document.body.classList.add('v5-results-active');
      results.dataset.mode = 'results';
    }
    if (event.target.closest('[data-reset], #reset-filters')) {
      document.body.classList.remove('v5-flow-active','v5-results-active');
      results.dataset.mode = 'preview';
    }
  }, true);

  results.dataset.mode = 'preview';
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupHome, { once:true });
else setupHome();
