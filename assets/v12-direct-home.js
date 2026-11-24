/* NAGACHI v12: one category, one result list.
 * Legacy mood/step selections remain in source for compatibility but are not operated or shown here.
 * No geolocation, paid APIs, ratings, or external UI dependencies.
 */
import { recommendRhythms } from '../rhythm.js';
import { escapeHtml, safeUrl, placeUrl, icon } from '../ui.js';
import { savedIds } from '../storage.js';
import { analyticsEnabled } from '../analytics.js';
import { BROWSE_CATEGORIES, toggleBrowseCategory, createBrowseFilters, browseHeading } from './v12-browse-state.js';

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
  home.innerHTML =
    '<section class="n14-hero" aria-labelledby="n14-hero-title">' +
    '<div class="n14-hero-copy"><span class="n14-eyebrow">NAGACHI · 나가치 동행</span>' +
    '<h1 id="n14-hero-title">가고 싶은 곳은 있는데,<br><em>함께할 사람이 없나요?</em></h1>' +
    '<p class="n14-hero-description">산책, 맛있는 식사, 작은 여행까지.<br>어떤 하루를 누구와 함께하고 싶은지 알려주세요.</p>' +
    '<div class="n14-actions"><a class="n14-main-button" href="/companion.html">나의 동행 희망 남기기 <span aria-hidden="true">→</span></a>' +
    '<a class="n14-sub-button" href="#n14-place-browse">함께 가볼 장소 보기</a></div>' +
    '<p class="n14-trustline">현재는 동행 수요 조사 단계이며 실제 연결·예약·결제는 없습니다. ' +
    (analyticsEnabled ? '설문 저장 설정은 감지됐으며, 실제 저장 성공 여부는 제출 시 확인됩니다.' : '현재 설문 저장 미연결 상태로 응답은 저장되지 않습니다.') + '</p></div>' +
    '<div class="n14-hero-art" aria-hidden="true"><span class="n14-sun"></span>' +
    '<span class="n14-hill-back"></span><span class="n14-hill-front"></span>' +
    '<span class="n14-person n14-person-one">●</span><span class="n14-person n14-person-two">●</span>' +
    '<span class="n14-road"></span></div></section>' +
    '<section class="n14-moments" aria-labelledby="n14-moments-title">' +
    '<div class="n14-section-heading"><div><p>이런 순간, 함께하고 싶어요</p><h2 id="n14-moments-title">어떤 동행이 끌리세요?</h2></div>' +
    '<span>관심 있는 활동으로 시작하세요</span></div>' +
    '<div class="n14-moments-grid">' +
    '<a href="/companion.html?interest=walk" class="n14-moment" data-tone="sage"><span aria-hidden="true">🌿</span><strong>산책 동행</strong><small>풍경 보며 가볍게 걷기</small></a>' +
    '<a href="/companion.html?interest=eat" class="n14-moment" data-tone="peach"><span aria-hidden="true">🍽️</span><strong>식사 동행</strong><small>맛있는 한 끼 함께하기</small></a>' +
    '<a href="/companion.html?interest=outing" class="n14-moment" data-tone="lilac"><span aria-hidden="true">🎨</span><strong>나들이 동행</strong><small>전시와 새로운 공간 가기</small></a>' +
    '<a href="/companion.html?interest=travel" class="n14-moment" data-tone="blue"><span aria-hidden="true">🚙</span><strong>여행 동행</strong><small>조금 더 멀리 떠나기</small></a>' +
    '</div></section>' +
    '<section id="n14-place-browse" class="n14-places" aria-labelledby="n14-place-title">' +
    '<div class="n14-section-heading"><div><p>동행할 장소도 함께 찾아봐요</p><h2 id="n14-place-title">어디에서 만나고 싶으세요?</h2></div></div>' +
    '<form id="n12-search" role="search" class="n12-search">' + svg('search') +
    '<label for="n12-query" class="sr-only">장소 이름이나 원하는 활동 검색</label>' +
    '<input id="n12-query" type="search" maxlength="160" placeholder="장소 이름이나 하고 싶은 일 검색" autocomplete="off">' +
    '<button type="submit" aria-label="장소 검색">검색</button></form>' +
    '<div class="n12-location"><label for="n12-region">지역을 선택하세요</label>' +
    '<div class="n12-location-select"><select id="n12-region" aria-label="추천 지역">' +
    options.map(opt => '<option value="' + opt.value + '">' + opt.label + '</option>').join('') +
    '</select><span aria-hidden="true">⌄</span></div></div>' +
    '<div class="n12-section-heading"><h2>함께 가볼 장소 유형</h2><span>하나만 골라보세요</span></div>' +
    '<div class="n12-categories" role="group" aria-label="장소 카테고리 하나 선택">' + categoryButtons() + '</div>' +
    '<p class="n14-place-footnote">장소는 실제 공공데이터를 기반으로 안내하며, 동행 참가자가 모집된 장소라는 의미는 아닙니다.</p></section>';

  const results = document.createElement('section');
  results.className = 'n12-results';
  // legacy flow.js는 #rhythm-results를 숨기므로 새 목록에는 별도 ID를 사용합니다.
  results.id = 'n12-results';
  results.innerHTML = '<div class="n12-results-head"><div><p>함께 가볼 장소</p><h2 id="n12-heading">전체 장소</h2>' +
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
    '<button type="button" data-n12-recommend>' + svg('compass') + '<span>추천</span></button>' +
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
    scrollToResults();
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
