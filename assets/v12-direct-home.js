/* NAGACHI v12: one category, one result list.
 * Legacy mood/step selections remain in source for compatibility but are not operated or shown here.
 * No geolocation, paid APIs, ratings, or external UI dependencies.
 */
import { recommendRhythms } from '../rhythm.js';
import { escapeHtml, safeUrl, placeUrl, icon } from '../ui.js';
import { savedIds } from '../storage.js';
import { analyticsEnabled } from '../analytics.js';
import { BROWSE_CATEGORIES, toggleBrowseCategory, createBrowseFilters, browseHeading } from './v12-browse-state.js';
import { PROGRAMS } from './v15-programs.js';

const $ = selector => document.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const svg = name => ({
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 11 9-8 9 8v9H4z"/><path d="M9 20v-6h6v6"/></svg>',
  compass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
})[name];

const state = {
  activity: null,
  region: '',
  query: '',
  broadCategory: new URLSearchParams(location.search).get('category') || '',
  visible: 8,
  requestId: 0,
  catalogPromise: null,
};
const options = [
  {value:'', label:'전체 지역'},
  ...['서울','경기','강릉','경주','부산','제주'].map(label => ({value:label,label})),
];
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const scrollToResults = () => $('#n12-results')?.scrollIntoView({
  behavior: reduceMotion() ? 'auto' : 'smooth',block:'start',
});

function categoryButtons() {
  return BROWSE_CATEGORIES.map(item =>
    '<button type="button" class="n12-category" data-n12-category="' + item.id +
    '" data-tone="' + item.tone + '" aria-pressed="false">' +
    '<span class="n12-emoji" aria-hidden="true">' + item.emoji + '</span>' +
    '<span class="n12-category-name">' + item.label + '</span></button>'
  ).join('');
}

function card(place, saved) {
  const href = placeUrl(place);
  const name = escapeHtml(place.name);
  const region = escapeHtml(place.region);
  const category = escapeHtml(place.category);
  const photo = safeUrl(place.image) || '/assets/garden.svg';
  const facts = place.verifiedFacts?.general || {};
  const reliableInfo = [facts.operatingHoursText,facts.parkingText,facts.firstMenuText].filter(Boolean).length;
  const verification = reliableInfo
    ? '이용정보 ' + reliableInfo + '가지 확인'
    : '방문 전 이용정보 확인';
  const description = String(place.shortDescription || '').trim();
  const safeDescription = description.length > 115 ? description.slice(0,112) + '…' : description;
  return '<article class="n12-card">' +
    '<div class="n12-photo">' +
    '<a href="' + href + '" aria-label="' + name + ' 자세히 보기">' +
    '<img src="' + photo + '" alt="' + name + ' 장소 사진" loading="lazy" width="600" height="480">' +
    '</a>' +
    '<span class="n13-interest-tag">동행 수요 조사</span>' +
    '<button type="button" class="save-icon n12-save ' + (saved ? 'is-saved' : '') +
    '" data-save="' + escapeHtml(place.id) + '" aria-label="' + name + ' 저장하기" aria-pressed="' + Boolean(saved) + '">' +
    icon('heart') + '</button></div>' +
    '<div class="n12-card-body"><p class="n12-card-region">' + region + ' · ' + category + '</p>' +
    '<h3><a href="' + href + '">' + name + '</a></h3>' +
    (safeDescription ? '<p class="n12-card-description">' + escapeHtml(safeDescription) + '</p>' : '') +
    '<p class="n12-card-verified">' + escapeHtml(verification) + '</p>' +
    '<a href="' + href + '" class="n12-detail-link">장소 정보 ' + svg('chevron') + '</a>' +
    '<button type="button" class="n13-card-companion" data-companion-interest="' + escapeHtml(place.id) +
    '" aria-label="' + name + ' 동행 관심 남기기">' + icon('people') + ' 동행 희망 남기기</button>' +
    '<p class="n13-survey-note">실제 동행 연결은 아직 제공하지 않아요</p></div></article>';
}

function syncControls() {
  $$('[data-n12-category]').forEach(button =>
    button.setAttribute('aria-pressed',String(button.dataset.n12Category === state.activity)));
  const select = $('#n12-region');
  if (select) select.value = state.region;
  const input = $('#n12-query');
  if (input && document.activeElement !== input) input.value = state.query;
  $('#n12-clear').hidden = !Boolean(state.activity || state.region || state.query || state.broadCategory);
}

function currentFilters() {
  return createBrowseFilters({
    activity:state.activity,region:state.region,query:state.query,broadCategory:state.broadCategory,
  });
}

function loadCatalog() {
  if (!state.catalogPromise) {
    state.catalogPromise = fetch('/data/places.json?v=20261119-v13', {cache:'no-store'})
      .then(response => {
        if (!response.ok) throw new Error('places unavailable');
        return response.json();
      })
      .catch(error => {
        state.catalogPromise = null;
        throw error;
      });
  }
  return state.catalogPromise;
}

function showLoading() {
  const grid = $('#n12-grid');
  grid.setAttribute('aria-busy','true');
  grid.classList.remove('is-empty');
  grid.innerHTML = '<div class="n12-skeleton" aria-hidden="true"></div><div class="n12-skeleton" aria-hidden="true"></div>';
}

async function render({more=false,scroll=false}={}) {
  const requestId = ++state.requestId;
  state.visible = more ? state.visible + 8 : 8;
  syncControls();
  if (!more) showLoading();
  const grid = $('#n12-grid');
  const heading = $('#n12-heading');
  const count = $('#n12-count');
  const loadMore = $('#n12-load-more');
  const subtitle = $('#n12-subtitle');
  try {
    const catalog = await loadCatalog();
    if (requestId !== state.requestId) return;
    const filters = currentFilters();
    const matches = recommendRhythms(catalog,filters);
    heading.textContent = state.query ? '검색 결과' : browseHeading(state);
    count.textContent = matches.length + '곳';
    subtitle.textContent = state.activity
      ? '선택한 활동과 실제로 일치하는 장소만 보여드려요.'
      : '관광공사에 등록된 실제 장소를 살펴보세요.';
    grid.innerHTML = matches.length
      ? matches.slice(0,state.visible).map(({place}) => card(place,savedIds().includes(place.id))).join('')
      : '<div class="n12-empty"><span aria-hidden="true">🔎</span><h3>일치하는 장소가 없어요</h3>' +
        '<p>다른 지역이나 활동을 선택해 보세요. 확인되지 않은 장소는 추천하지 않아요.</p>' +
        '<button type="button" data-n12-reset>전체 장소 보기</button></div>';
    grid.classList.toggle('is-empty',matches.length===0);
    loadMore.hidden = matches.length <= state.visible;
    loadMore.textContent = '장소 더 보기 (' + Math.min(state.visible,matches.length) + ' / ' + matches.length + ')';
    grid.removeAttribute('aria-busy');
    $('#n12-status').textContent = matches.length + '곳의 장소를 찾았습니다.';
    if (scroll) {
      const homeButton = $('[data-n12-home]');
      const recButton = $('[data-n12-recommend]');
      homeButton?.classList.remove('is-active');
      recButton?.classList.add('is-active');
      scrollToResults();
    }
  } catch {
    if (requestId !== state.requestId) return;
    grid.removeAttribute('aria-busy');
    grid.classList.add('is-empty');
    grid.innerHTML = '<div class="n12-empty"><span aria-hidden="true">⚠️</span>' +
      '<h3>장소를 불러오지 못했어요</h3><p>네트워크 연결을 확인하고 다시 시도해 주세요.</p>' +
      '<button type="button" data-n12-retry>다시 시도</button></div>';
    count.textContent = '';
    loadMore.hidden = true;
    $('#n12-status').textContent = '장소 정보를 불러오지 못했습니다.';
    if (scroll) scrollToResults();
  }
}

function reset() {
  state.activity = null;
  state.region = '';
  state.query = '';
  state.broadCategory = '';
  $('#n12-query').value = '';
  render({scroll:true});
}

function setupHome() {
  if (document.body.dataset.page !== 'home' || document.body.dataset.n12Home) return;
  const main = $('#main');
  if (!main) return;
  document.body.dataset.n12Home = 'ready';
  document.body.classList.add('n12-ready');
  // 기존 설문/선택 UI는 DOM에 남겨 두지만, 새 홈에서 연결하거나 표시하지 않습니다.

  const home = document.createElement('section');
  home.className = 'n12-home';
  // 동행이 첫 번째 경험입니다. 장소 탐색은 동행 의향을 구체화하는 보조 수단입니다.
  const partyProgramCards = PROGRAMS.map(p=>
    '<article class="n15-program-card" data-tone="'+p.tone+'">' +
    '<div class="n15-program-heading"><span class="n15-program-icon" aria-hidden="true">'+p.icon+'</span>' +
    '<span class="n15-program-status">기획안 · 참여 희망 조사</span></div>' +
    '<p class="n15-program-kind">'+p.category+'</p><h3>'+p.title+'</h3>' +
    '<p class="n15-program-description">'+p.summary+'</p>' +
    '<ol class="n15-program-route">'+p.outline.map(step=>'<li>'+step+'</li>').join('')+'</ol>' +
    '<p class="n15-program-transport">이동 안내: '+p.transport+'</p>' +
    '<button type="button" data-program-interest="'+p.id+'" data-companion-activity="'+p.interest+'">이 프로그램 관심 남기기 →</button>' +
    '</article>'
  ).join('');
  home.innerHTML =
    '<section class="n15-hero" aria-labelledby="n15-hero-title">' +
    '<div class="n15-hero-copy"><span class="n15-hero-kicker">NAGACHI · 50+ 취향 동행 프로그램</span>' +
    '<h1 id="n15-hero-title">아직, 함께 놀<br><em>좋은 날이 많으니까.</em></h1>' +
    '<p>50대 이후에도 미식·산행·나들이·여행을 즐기는 방법.<br>' +
    '나가치가 취향에 맞는 하루를 제안하고, 함께할 파티원 구성을 돕습니다.</p>' +
    '<div class="n15-hero-actions"><a class="n15-primary-cta" href="#n15-programs">동행 프로그램 살펴보기 →</a>' +
    '<a class="n15-secondary-cta" href="/companion.html">나의 동행 취향 남기기</a></div>' +
    '<small>현재는 프로그램 기획·수요 조사 단계입니다. 확정된 일정이나 실제 모집 중인 파티가 아닙니다.</small></div>' +
    '<div class="n15-hero-people" aria-hidden="true"><span class="n15-sun"></span><span class="n15-hill"></span>' +
    '<span class="n15-person n15-one"></span><span class="n15-person n15-two"></span><span class="n15-person n15-three"></span></div></section>' +
    '<section class="n15-value" aria-label="나가치가 하는 일">' +
    '<div><strong>취향 맞는 사람</strong><small>대화·활동 분위기를 고려한 파티원 구성</small></div>' +
    '<div><strong>하루 프로그램</strong><small>코스와 집합 방법, 진행 흐름 기획</small></div>' +
    '<div><strong>자유로운 참여</strong><small>결혼 여부를 묻지 않고 서로의 사생활 존중</small></div></section>' +
    '<section class="n15-programs" id="n15-programs" aria-labelledby="n15-programs-title">' +
    '<div class="n15-section-head"><div><span>PARTY PROGRAM</span><h2 id="n15-programs-title">어떤 하루를 함께할까요?</h2>' +
    '<p>소개팅이 아닌 취미 중심 모임. 먼저 해보고 싶은 프로그램을 골라주세요.</p></div></div>' +
    '<div class="n15-program-grid">'+partyProgramCards+'</div>' +
    '<div class="n15-fee-info"><strong>나가치가 판매하려는 것</strong><p>' +
    '프로그램 기획·코스 제안·파티원 구성·운영 조율에 대한 <b>서비스비</b>입니다. ' +
    '식비·카페비·교통비·입장료 등은 참가자가 이용처에 직접 결제하는 구조를 검토합니다. ' +
    '실제 요금·일정은 아직 확정되지 않았습니다.</p></div></section>' +
    '<section class="n15-privacy" aria-label="참여 원칙">' +
    '<div><strong>편안하게 만나고, 서로를 존중하는 모임</strong>' +
    '<p>연애나 결혼을 목적으로 연결하지 않습니다. 결혼 여부는 가입 조건이 아닙니다. ' +
    '서로의 사생활과 동의를 존중하며, 안전 수칙을 갖춘 취미 모임을 준비합니다.</p></div>' +
    '<a href="/companion.html">동행 희망 남기기 →</a></section>' +
    '<details class="n15-place-drawer" id="n14-place-browse"><summary>코스 참고 장소 직접 찾아보기 <span>맛집·산책·나들이</span></summary>' +
    '<div class="n15-place-content"><form id="n12-search" role="search" class="n12-search">' + svg('search') +
    '<label for="n12-query" class="sr-only">장소 이름이나 원하는 활동 검색</label>' +
    '<input id="n12-query" type="search" maxlength="160" placeholder="장소 이름이나 하고 싶은 일 검색" autocomplete="off">' +
    '<button type="submit" aria-label="장소 검색">검색</button></form>' +
    '<div class="n12-location"><label for="n12-region">지역을 선택하세요</label>' +
    '<div class="n12-location-select"><select id="n12-region" aria-label="추천 지역">' +
    options.map(opt=>'<option value="'+opt.value+'">'+opt.label+'</option>').join('') +
    '</select><span aria-hidden="true">⌄</span></div></div>' +
    '<div class="n12-section-heading"><h2>장소 종류</h2><span>하나만 선택</span></div>' +
    '<div class="n12-categories" role="group" aria-label="장소 카테고리 하나 선택">' + categoryButtons() + '</div>' +
    '<p class="n14-place-footnote">장소 사진과 정보는 관광공사 데이터를 기반으로 합니다. 동행 모집 중인 장소라는 뜻은 아닙니다.</p></div></details>';

  const results = document.createElement('section');
  results.className = 'n12-results';
  // legacy flow.js는 #rhythm-results를 숨기므로 새 목록에는 별도 ID를 사용합니다.
  results.id = 'n12-results';
  results.innerHTML = '<div class="n12-results-head"><div><p>코스 참고 자료</p><h2 id="n12-heading">전체 장소</h2>' +
    '<small id="n12-subtitle">관광공사에 등록된 실제 장소를 살펴보세요.</small></div>' +
    '<div class="n12-results-aside"><span id="n12-count"></span><button type="button" id="n12-clear" hidden>초기화</button></div></div>' +
    '<p id="n12-status" role="status" class="sr-only"></p>' +
    '<div id="n12-grid" class="n12-grid"></div>' +
    '<button type="button" id="n12-load-more" class="n12-load-more" hidden>장소 더 보기</button>';

  main.prepend(home,results);
  const nav = document.createElement('nav');
  nav.className = 'n12-nav';
  nav.setAttribute('aria-label','하단 메뉴');
  nav.innerHTML = '<button type="button" data-n12-home class="is-active">' + svg('home') + '<span>홈</span></button>' +
    '<button type="button" data-n12-recommend>' + svg('compass') + '<span>프로그램</span></button>' +
    '<a class="n13-nav-companion" href="/companion.html">' + icon('people') + '<span>동행</span></a>' +
    '<a href="/saved.html">' + icon('heart') + '<span>저장</span></a>';
  document.body.append(nav);

  home.addEventListener('click',event => {
    const category = event.target.closest('[data-n12-category]');
    if (category) {
      state.activity = toggleBrowseCategory(state.activity,category.dataset.n12Category);
      state.broadCategory = '';
      // 과거 검색어가 보이지 않는 추가 필터로 남지 않도록 정리합니다.
      state.query = '';
      $('#n12-query').value = '';
      render({scroll:true});
      return;
    }
    if (event.target.closest('[data-n12-reset]')) reset();
  });
  $('#n12-region').addEventListener('change',event => {
    state.region = event.target.value;
    render({scroll:true});
  });
  $('#n12-search').addEventListener('submit',event => {
    event.preventDefault();
    state.query = $('#n12-query').value.trim();
    render({scroll:true});
  });
  results.addEventListener('click',event => {
    if (event.target.closest('[data-n12-reset]') || event.target.closest('#n12-clear')) reset();
    else if (event.target.closest('[data-n12-retry]')) render();
    else if (event.target.closest('#n12-load-more')) render({more:true});
  });
  nav.querySelector('[data-n12-home]').addEventListener('click', () => {
    nav.querySelector('[data-n12-home]').classList.add('is-active');
    nav.querySelector('[data-n12-recommend]').classList.remove('is-active');
    window.scrollTo({top:0,behavior:reduceMotion()?'auto':'smooth'});
  });
  nav.querySelector('[data-n12-recommend]').addEventListener('click', () => {
    nav.querySelector('[data-n12-home]').classList.remove('is-active');
    nav.querySelector('[data-n12-recommend]').classList.add('is-active');
    document.querySelector('#n15-programs')?.scrollIntoView({behavior:reduceMotion()?'auto':'smooth',block:'start'});
  });
  window.addEventListener('storage', () => {
    $$('.n12-save').forEach(button => {
      const saved = savedIds().includes(button.dataset.save);
      button.classList.toggle('is-saved',saved);
      button.setAttribute('aria-pressed',String(saved));
    });
  });
  render({scroll:location.hash==='#n12-results' || location.hash==='#rhythm-results'});
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',setupHome,{once:true});
else setupHome();
