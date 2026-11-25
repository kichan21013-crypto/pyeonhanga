/* NAGACHI v12: one category, one result list.
 * Legacy mood/step selections remain in source for compatibility but are not operated or shown here.
 * No geolocation, paid APIs, ratings, or external UI dependencies.
 */
import { recommendRhythms } from '../rhythm.js';
import { escapeHtml, safeUrl, placeUrl, icon } from '../ui.js';
import { savedIds } from '../storage.js';
import { analyticsEnabled } from '../analytics.js';
import { BROWSE_CATEGORIES, toggleBrowseCategory, createBrowseFilters, browseHeading } from './v12-browse-state.js';
import { TOGETHER_REGIONS, MEAL_TAGS } from './v16-together-model.js';
import { setupTogetherJourney } from './v16-together.js';
import { setupGroupExperience } from './v19-group-ui.js?v=20261125-v44';
import { setupPopularFirst } from './v21-popular-first.js?v=20261125-v44';
import { setupPublicPrograms } from './v22-public-programs.js?v=20261125-v44';

// Ordinary home entry starts at the top; preserve explicit detail/companion deep links.
const deepLink=()=>new URLSearchParams(location.search).has('together')||['#n16-invites-title','#n16-invites','#n21-popular','#n12-results','#rhythm-results','#n14-place-browse'].includes(location.hash);
if(document.body?.dataset.page==='home'&&!deepLink()&&'scrollRestoration' in history)history.scrollRestoration='manual';
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
    state.catalogPromise = fetch('/data/places.json?v=20261124-v16', {cache:'no-store'})
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
  if (scroll) {
    const drawer = $('#n14-place-browse');
    if (drawer) drawer.open = true;
    document.body.classList.add('n15-browse-open');
  }
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
  const quickCategories=[['eat','맛집'],['outing','나들이'],['travel','여행'],['hike','산행']].map(([id,label])=>
    '<button type="button" class="n28-quick-category" data-v16-invite="'+id+'" aria-pressed="false"><img src="/assets/v28-'+id+'.webp" width="112" height="112" alt="" decoding="async"><span>'+label+'</span></button>'
  ).join('');
  home.innerHTML =
    '<section class="n16-hero n18-hero n19-hero n21-hero n34-full-photo n35-photo-banner" aria-labelledby="n16-home-title">' +
    '<div class="n19-photo-mosaic" aria-hidden="true"><div class="n19-photo-slot n19-photo-main"><img src="/assets/v38-hero.webp" alt="" width="720" height="480" fetchpriority="high" decoding="async"></div></div>' +
    '<h1 id="n16-home-title">가고 싶은 곳, 함께할 사람.</h1></section>' +
    '<div class="n39-photo-credit">AI 제작 이미지</div>' +
    '<a class="n16-hero-cta n35-recommend-link" href="#n21-popular">' + icon('people') + ' <b data-n30-hero-label>추천 동행 보기</b> <span aria-hidden="true">→</span></a>' +
    '<section class="n16-invites-section n29-discover" aria-labelledby="n16-invites-title">'+
    '<div class="n29-section-head"><h2 id="n16-invites-title">어떤 동행을 찾으세요?</h2><label class="n29-region">지역 <select id="n29-region" aria-label="희망 지역"><option value="">전체 지역</option>'+TOGETHER_REGIONS.map(region=>'<option value="'+region+'">'+region+'</option>').join('')+'</select></label></div>'+
    '<div class="n28-quick-categories" id="n16-invites" role="group" aria-label="원하는 동행 찾기">'+quickCategories+'</div></section>'+
    '<section class="n21-popular" id="n21-popular" aria-labelledby="n21-popular-heading">' +
    '<div class="n21-popular-top"><div>' +
    '<h2 id="n21-popular-heading">지금 인기 있는 동행</h2>' +
    '<p id="n21-popular-sub">저장된 관심을 확인하고 있어요.</p></div><button type="button" class="n30-all" data-n30-all aria-controls="n21-popular-content" aria-expanded="false" hidden>전체보기 →</button></div>' +
    '<div id="n21-popular-content" role="status" aria-live="polite">' +
    '<div class="n21-popular-loading" aria-label="인기 동행 확인 중"><span></span><span></span></div></div>' +
    '<button type="button" class="n21-find-btn" data-n21-find>다른 동행도 찾아보기 →</button></section>' +
    '<section class="n22-public-programs" id="n22-public-programs" aria-labelledby="n22-public-heading" hidden>' +
    '<div class="n22-public-heading"><div><span>나가치 주최</span>' +
    '<h2 id="n22-public-heading">나가치 추천 모임</h2>' +
    '<p>나가치가 직접 기획한 코스와 모임을 만나보세요.</p>' +
    '</div></div><div id="n22-public-course-list" class="n22-public-course-list"></div>' +
    '<div id="n22-public-meetups"></div></section>' +
    '<section class="n16-journey n18-journey" id="n16-journey" aria-labelledby="n16-journey-heading" hidden>' +
    '<div class="n16-journey-top"><span>WITH YOU · 함께할 곳</span><h2 id="n16-journey-heading">어디로 함께 갈까요?</h2>' +
    '<p id="n16-journey-subtitle">실제 등록된 장소 중 취향에 맞는 곳을 보여드릴게요.</p></div>' +
    '<div class="n16-filter-row"><label for="n16-region">어느 지역이 좋으세요?</label>' +
    '<select id="n16-region" aria-label="희망 지역"><option value="">전체 지역</option>' +
    TOGETHER_REGIONS.map(region=>'<option value="'+region+'">'+region+'</option>').join('') + '</select></div>' +
    '<div class="n16-meal-filters" id="n16-meals" role="group" aria-label="먹고 싶은 음식 종류" hidden>' +
    MEAL_TAGS.map(item=>'<button type="button" data-v16-meal="'+item.id+'" aria-pressed="'+String(!item.id)+'">'+item.label+'</button>').join('') + '</div>' +
    '<div class="n16-results-bar"><strong>취향에 맞는 장소</strong><span id="n16-count">장소를 찾는 중</span></div>' +
    '<p id="n16-journey-status" class="sr-only" role="status"></p>' +
    '<div id="n16-venues" class="n16-venue-grid"></div>' +
    '<button type="button" id="n16-more" class="n16-more" hidden>다른 장소 더 보기</button>' +
    '<p class="n16-journey-note">마음에 드는 곳을 골랐다면 “여기, 같이 가보고 싶어요”를 눌러보세요. ' +
    '운영자가 수요를 확인해 동행 모임을 제안해요.</p></section>' +
    '<details class="n16-value n29-service-guide"><summary id="n16-value-title">나가치 이용 안내 <span aria-hidden="true">+</span></summary>' +
    '<div class="n16-value-grid"><div><span aria-hidden="true">📍</span><strong>좋은 곳 고르기</strong><p>실제 장소 정보를 바탕으로 코스를 제안해요.</p></div>' +
    '<div><span aria-hidden="true">🤝</span><strong>취향 맞는 사람</strong><p>비슷한 관심사의 동행 구성을 준비해요.</p></div>' +
    '<div><span aria-hidden="true">🗓️</span><strong>함께할 하루</strong><p>만남의 방식과 일정 조율을 도와줄 계획이에요.</p></div></div>' +
    '<p>향후 수익모델은 <strong>코스 제안과 동행 구성·일정 조율 서비스비</strong>입니다. ' +
    '식비·교통비·입장료 등은 각자 현장에서 직접 결제하는 방향을 검토하고 있어요. ' +
    '현재는 무료 수요 검증을 진행하며 유료 모집·차량 연결은 제공하지 않습니다.</p></details>' +
    '<div class="n33-utility-links"><a href="/companion.html">동행 이용 방법</a><a href="/privacy.html">개인정보 안내</a><span class="n34-version">v44</span></div>' +
    '<details class="n15-place-drawer" id="n14-place-browse"><summary>직접 장소 검색하기 <span>맛집·산책·나들이</span></summary>' +
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

  home.querySelector('.n29-discover').after(home.querySelector('#n16-journey'));
  main.prepend(home,results);
  // 원래 앵커는 카드 그리드 맨 위를 sticky 헤더 뒤로 보내 제목을 가렸습니다.
  // 제목부터 보이도록 헤더 높이만큼 보정해 네 카드의 시작 지점을 확실하게 보여줍니다.
  const scrollToInvites=()=>{
    const target=home.querySelector('#n16-invites-title');
    if(!target)return;
    const header=document.querySelector('.site-header');
    const offset=(header?.getBoundingClientRect().height||0)+18;
    const top=Math.max(0,window.scrollY+target.getBoundingClientRect().top-offset);
    window.scrollTo({top,behavior:reduceMotion()?'auto':'smooth'});
  };
  const scrollToPopular=()=>{
    const target=home.querySelector('#n21-popular');
    if(!target)return;
    const header=document.querySelector('.site-header');
    const offset=(header?.getBoundingClientRect().height||0)+14;
    const top=Math.max(0,window.scrollY+target.getBoundingClientRect().top-offset);
    window.scrollTo({top,behavior:reduceMotion()?'auto':'smooth'});
  };
  const cta=home.querySelector('.n16-hero-cta');
  cta?.addEventListener('click',event=>{event.preventDefault();scrollToPopular();});
  // 이전 즐겨찾기/상세의 동행 링크(#n16-invites)는 계속 호환합니다.
  if(['#n16-invites-title','#n16-invites','#n21-popular'].includes(location.hash)) {
    requestAnimationFrame(location.hash==='#n21-popular'?scrollToPopular:scrollToInvites);
  }
  setupTogetherJourney({home,loadPlaces:loadCatalog});
  const topRegion=home.querySelector('#n29-region'),journeyRegion=home.querySelector('#n16-region');
  topRegion.addEventListener('change',()=>{
    journeyRegion.value=topRegion.value;
    journeyRegion.dispatchEvent(new Event('change',{bubbles:true}));
  });
  journeyRegion.addEventListener('change',()=>{topRegion.value=journeyRegion.value;});
  setupGroupExperience(home);
  const headerInner=document.querySelector('.site-header .header-inner');
  if(headerInner&&!headerInner.querySelector('.n30-header-actions')){
    const actions=document.createElement('div');actions.className='n30-header-actions';
    actions.innerHTML='<button type="button" data-n30-updates aria-label="내 동행 소식" aria-haspopup="dialog" aria-controls="n33-updates-dialog"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg></button><a href="/account.html" aria-label="내 계정">'+icon('solo')+'</a>';
    headerInner.append(actions);
    actions.querySelector('[data-n30-updates]').addEventListener('click',()=>{
      const dialog=home.querySelector('#n33-updates-dialog');
      if(dialog&&!dialog.open)dialog.showModal();
    });
  }
  setupPopularFirst({home,loadPlaces:loadCatalog,scrollToInvites});
  setupPublicPrograms({home,loadPlaces:loadCatalog});
  const placeDrawer = $('#n14-place-browse');
  placeDrawer?.addEventListener('toggle', () => {
    document.body.classList.toggle('n15-browse-open',placeDrawer.open);
    if(placeDrawer.open) render();
  });
  const nav = document.createElement('nav');
  nav.className = 'n12-nav';
  nav.setAttribute('aria-label','하단 메뉴');
  nav.innerHTML = '<button type="button" data-n12-home class="is-active">' + svg('home') + '<span>홈</span></button>' +
    '<button type="button" data-n12-recommend>' + svg('compass') + '<span>동행 찾기</span></button>' +
    '<a class="n13-nav-companion" href="/companion.html">' + icon('people') + '<span>동행 안내</span></a>' +
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
    const url=new URL(location.href);url.hash='';url.searchParams.delete('together');history.replaceState(history.state,'',url);
    window.scrollTo({top:0,behavior:reduceMotion()?'auto':'smooth'});
  });
  nav.querySelector('[data-n12-recommend]').addEventListener('click', () => {
    nav.querySelector('[data-n12-home]').classList.remove('is-active');
    nav.querySelector('[data-n12-recommend]').classList.add('is-active');
    scrollToInvites();
  });
  window.addEventListener('storage', () => {
    $$('.n12-save').forEach(button => {
      const saved = savedIds().includes(button.dataset.save);
      button.classList.toggle('is-saved',saved);
      button.setAttribute('aria-pressed',String(saved));
    });
  });
  if(!deepLink()){
    if('scrollRestoration' in history)history.scrollRestoration='manual';
    window.scrollTo({top:0,behavior:'instant'});
    requestAnimationFrame(()=>{if(!deepLink())window.scrollTo({top:0,behavior:'instant'});});
    window.addEventListener('pageshow',event=>{if(event.persisted&&!deepLink())window.scrollTo({top:0,behavior:'instant'});});
  }
  // 장소 검색은 접힌 보조 기능입니다. 기본 화면에서 데이터 전체를 매번 요청하지 않습니다.
  if (['#n12-results','#rhythm-results','#n14-place-browse'].includes(location.hash)) {
    placeDrawer.open=true;
    document.body.classList.add('n15-browse-open');
    render({scroll:location.hash==='#n12-results'||location.hash==='#rhythm-results'});
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',setupHome,{once:true});
else setupHome();
