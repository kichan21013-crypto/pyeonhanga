import { readFile, writeFile, mkdir, rm, cp, access } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { card, detailMarkup, escapeHtml, safeUrl, placeUrl, icon } from '../ui.js';
import { validatePlaces } from './validate-data.js';
import { publicConfig } from './public-config.js';
import { recommendRhythms } from '../rhythm.js';
import { buildPilotPlaces } from './pilot-data.js';
import { TOGETHER_INVITES } from '../assets/v16-together-model.js';
import { operatorMarkup } from '../assets/v22-admin-markup.js';
// 내부 검증 기간. 정식 공개 시 이 값 하나로 생성 페이지 색인을 전환합니다.
const INDEXING_ENABLED = false;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'dist');
const sourcePlaces = JSON.parse(await readFile(resolve(root, 'data/places.json'), 'utf8'));
const generalReport = JSON.parse(await readFile(resolve(root, 'data/tourapi-enrichment-report.json'), 'utf8'));
const barrierReport = JSON.parse(await readFile(resolve(root, 'data/barrierfree-enrichment-report.json'), 'utf8'));
validatePlaces(sourcePlaces);
const places = buildPilotPlaces(sourcePlaces, generalReport, barrierReport, 120);
validatePlaces(places);
const siteUrl = (process.env.SITE_URL || process.env.CF_PAGES_URL || 'http://localhost:4173').replace(/\/$/, '');
if (!/^https?:\/\/[^/]+$/.test(siteUrl)) throw new Error('SITE_URL에는 https://서비스주소 형태의 주소를 입력하세요.');
if (siteUrl.startsWith('http://localhost')) console.log('안내: 현재 SEO 주소는 로컬용입니다. 배포 시 SITE_URL을 설정하세요.');
let index = (await readFile(resolve(root, 'index.html'), 'utf8')).replace(/<meta name="robots" content="noindex,nofollow">/g,'');
index = index.replace('<link rel="stylesheet" href="/styles.css">','<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/mobile-ux.css?v=20261124-v40">');
index = index.replace('<nav aria-label="주 메뉴">','<nav aria-label="주 메뉴"><a class="nav-home" href="/" aria-label="홈으로">홈</a>');
const header = index.match(/<header class="site-header">[\s\S]*?<\/header>/)[0];
const footer = `<footer class="site-footer"><div class="container footer-inner"><div><a class="footer-brand" href="/">나가치</a><p>함께하면 더 좋은 하루.</p><p>© ${new Date().getUTCFullYear()} 나가치 · 시장 검증용 MVP</p></div><div class="footer-links"><a href="/about.html">편안함 점수 안내</a><a href="/privacy.html">데이터 안내</a></div></div></footer>`;
const bottomNavHome = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 11 9-8 9 8v9H4z"/><path d="M9 20v-6h6v6"/></svg>';
function mobileNav(active = '') {
  return `<nav class="n-mobile-nav" aria-label="하단 메뉴">
    <a href="/" class="${active === 'home' ? 'is-active' : ''}">${bottomNavHome}<span>홈</span></a>
    <a href="/#n21-popular" class="${active === 'recommend' ? 'is-active' : ''}">${icon('search')}<span>같이갈래?</span></a>
    <a href="/companion.html" class="n13-nav-companion ${active === 'companion' ? 'is-active' : ''}">${icon('people')}<span>동행</span></a>
    <a href="/saved.html" class="${active === 'saved' ? 'is-active' : ''}">${icon('heart')}<span>저장</span></a>
  </nav>`;
}

function seo(path, title, description, image = '/assets/garden.svg', noindex = false) {
  const url = escapeHtml(siteUrl + path);
  const imageUrl = image.startsWith('/') ? siteUrl + image : image;
  return `<link rel="canonical" href="${url}"><meta property="og:type" content="website"><meta property="og:locale" content="ko_KR"><meta property="og:site_name" content="나가치"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${safeUrl(imageUrl)}">${!INDEXING_ENABLED || noindex ? '<meta name="robots" content="noindex,nofollow">' : ''}`;
}
function page({ title, description, path, content, page = 'info', id = '', image, noindex = false }) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}">${seo(path, title, description, image, noindex)}<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/mobile-ux.css?v=20261124-v40"><link rel="stylesheet" href="/assets/v13-companion.css?v=20261124-v40"><link rel="stylesheet" href="/assets/v14-companion-first.css?v=20261124-v40"><link rel="stylesheet" href="/assets/v15-party-program.css?v=20261124-v40"><link rel="stylesheet" href="/assets/v16-together.css?v=20261124-v40"><link rel="stylesheet" href="/assets/v18-premium.css?v=20261124-v40"><link rel="stylesheet" href="/assets/v19-cohorts.css?v=20261124-v40"><link rel="stylesheet" href="/assets/v20-interest-priority.css?v=20261124-v40"><link rel="stylesheet" href="/assets/v21-popular-first.css?v=20261124-v40"><link rel="stylesheet" href="/assets/v22-admin-studio.css?v=20261124-v40"><link rel="stylesheet" href="/assets/v22-public-programs.css?v=20261124-v40"><script type="module" src="/app.js?v=20261124-v40"></script></head><body data-page="${page}" data-place-id="${escapeHtml(id)}" data-companion="${path === '/companion.html' ? 'true' : 'false'}"><a class="skip-link" href="#main">본문 바로가기</a>${header}<main id="main" class="container ${page === 'detail' ? 'detail-main' : 'prose'}">${content}</main>${footer}${mobileNav(path === '/companion.html' ? 'companion' : 'recommend')}<div id="toast" class="toast" role="status" hidden></div></body></html>`;
}
await rm(out, { recursive: true, force: true }); await mkdir(out, { recursive: true });
for (const file of ['styles.css', 'mobile-ux.css', 'app.js', 'ui.js', 'verified-facts.js', 'analytics.js', 'storage.js', 'comfort-score.js', 'search.js', 'rhythm.js', 'actions.js', 'flow.js', 'assets', 'data']) await cp(resolve(root, file), resolve(out, file), { recursive: true });
// 검증된 주소·좌표와 실사진 비중을 유지하며 지역별 최대 120곳을 선정합니다. 미확인 편안함 점수는 생성하지 않습니다.
await writeFile(resolve(out, 'data', 'places.json'), JSON.stringify(places, null, 2) + '\n');
let configInput;
if (process.env.SUPABASE_URL || process.env.SUPABASE_ANON_KEY) {
  configInput = { supabaseUrl: process.env.SUPABASE_URL, supabaseAnonKey: process.env.SUPABASE_ANON_KEY };
} else {
  let configPath = resolve(root, 'config.example.js');
  try { await access(resolve(root, 'config.js')); configPath = resolve(root, 'config.js'); } catch {}
  configInput = (await import(pathToFileURL(configPath).href)).default;
}
await writeFile(resolve(out, 'config.js'), `export default ${JSON.stringify(publicConfig(configInput))};\n`);
await writeFile(resolve(out, 'index.html'), index.replace('<!-- SEO -->', seo('/', '나가치 — 함께하면 더 좋은 하루.', '막연히 뭔가 하고 싶은 날, 내 상황과 취향에 맞는 하루를 찾아보세요.', '/assets/garden.svg', places.every(p => p.isDemo))).replace('<!-- CARDS -->', recommendRhythms(places).map(r => card(r.place,false,undefined,r)).join('')).replace('<!-- FOOTER -->', footer).replace(/<p class="demo-notice">[\s\S]*?<\/p>/, places.some(p => p.isDemo) ? '<p class="demo-notice">DEMO SAMPLE 배지가 붙은 장소는 기능 체험용 가상 데이터입니다. 실제 방문 정보가 아닙니다.</p>' : '<p class="demo-notice">확인한 정보만 표시합니다. 방문 전 출처와 최근 확인 날짜를 살펴보세요.</p>'));
const saved = (await readFile(resolve(root, 'saved.html'), 'utf8')).replace(/<meta name="robots" content="noindex,nofollow">/g,'');
await writeFile(resolve(out, 'saved.html'), saved.replace('<!-- SEO -->', seo('/saved.html', '저장한 곳 — 나가치', '마음에 담은 장소를 다시 살펴보세요.', undefined, true)).replace('<!-- HEADER -->', header).replace('<link rel="stylesheet" href="/styles.css">','<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/mobile-ux.css?v=20261124-v40"><link rel="stylesheet" href="/assets/v13-companion.css?v=20261124-v40"><link rel="stylesheet" href="/assets/v14-companion-first.css?v=20261124-v40"><link rel="stylesheet" href="/assets/v15-party-program.css?v=20261124-v40"><link rel="stylesheet" href="/assets/v16-together.css?v=20261124-v40"><link rel="stylesheet" href="/assets/v18-premium.css?v=20261124-v40"><link rel="stylesheet" href="/assets/v19-cohorts.css?v=20261124-v40"><link rel="stylesheet" href="/assets/v20-interest-priority.css?v=20261124-v40"><link rel="stylesheet" href="/assets/v21-popular-first.css?v=20261124-v40"><link rel="stylesheet" href="/assets/v22-admin-studio.css?v=20261124-v40"><link rel="stylesheet" href="/assets/v22-public-programs.css?v=20261124-v40">').replace('src="/app.js"', 'src="/app.js?v=20261124-v40"').replace('<!-- FOOTER -->', footer + mobileNav('saved')));
for (const p of places) {
  const dir = resolve(out, 'places', p.slug); await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, 'index.html'), page({ title: `${p.name} · ${p.region} ${p.category} 편안함 정보 — 나가치`, description: p.isDemo ? `DEMO SAMPLE · ${p.shortDescription}` : p.shortDescription, path: placeUrl(p), content: detailMarkup(p), page: 'detail', id: p.id, image: p.image, noindex: p.isDemo }));
}
// Companion page sells the value proposition of a hosted party programme, not an inventory of venues.
// 동행 메뉴는 '모임 상품'이 아니라 한 문장으로 시작하여 실제 장소를 고르게 합니다.
// 현재는 모임 인원/운송수단/요금이 확정되지 않아 모집글과 예약을 생성하지 않습니다.
const invitationLinks = TOGETHER_INVITES.map(invite =>
  '<a class="n15-intent-choice n16-hub-choice" href="/?together='+invite.id+'">' +
  '<span class="n15-intent-icon" aria-hidden="true"><img src="/assets/v28-'+invite.id+'.webp" alt="" loading="lazy"></span>' +
  '<span><strong>'+invite.label+'</strong><small>'+invite.help+' · 실제 장소 먼저 고르기</small></span>' +
  '<span class="n15-intent-arrow" aria-hidden="true">→</span></a>'
).join('');
await writeFile(resolve(out,'companion.html'), page({
 title:'취향 동행 — 같이 갈 사람을 찾는 첫걸음 | 나가치',
 description:'같이 맛있는 거 먹으러 갈 사람? 산책·산행·나들이를 함께하고 싶은 취향과 동행 의향을 가볍게 나눌 수 있어요.',
 path:'/companion.html',page:'info',
 content:'<div class="n13-landing n15-program-hub n16-companion-hub">' +
  '<section class="n15-hero"><div class="n15-hero-copy">' +
  '<span class="n15-hero-kicker">나가치 · 취향 동행</span>' +
  '<h1>오늘, 누구랑<br><em>어디 가볼까요?</em></h1>' +
  '<p>취향이 맞는 사람과 맛있는 걸 먹고, 산을 걷고, 새로운 곳을 둘러보고 싶은 마음부터 시작해요.</p>' +
  '<small>아직 실제 동행 모집·예약·결제는 제공하지 않아요. 마음 맞는 하루를 함께 고민하는 단계예요.</small>' +
  '</div><div class="n15-hero-people" aria-hidden="true"><span class="n15-sun"></span><span class="n15-hill"></span>' +
  '<span class="n15-person n15-one"></span><span class="n15-person n15-two"></span><span class="n15-person n15-three"></span></div></section>' +
  '<section class="n15-program-signup" id="n15-programs"><div class="n15-section-head"><span>같이 갈래?</span>' +
  '<h2>어떤 하루가 끌리세요?</h2>' +
  '<p>하나만 누르면 취향에 맞는 실제 장소를 보여드려요. 마음에 드는 장소에서 동행 희망을 남길 수 있습니다.</p></div>' +
  '<div class="n15-intent-grid">'+invitationLinks+'</div></section>' +
  '<div class="n15-fee-info"><strong>나가치가 앞으로 하고 싶은 일</strong>' +
  '<p>실제 장소·코스를 제안하고 관심사가 비슷한 사람들끼리 하루를 즐길 수 있게 돕는 서비스입니다. ' +
  '현재는 무료 의향 조사만 진행하며 일정·모임·서비스비는 확정되지 않았습니다. ' +
  '향후 서비스비는 코스·모임 구성과 운영 조율에 한정하는 모델을 검토합니다. ' +
  '식사·카페·교통·입장료는 각자 직접 결제하는 방향입니다.</p></div>' +
  '<section class="n15-privacy"><div><strong>취향으로 연결되되, 사생활은 존중합니다.</strong>' +
  '<p>참여자의 취향과 선택을 존중하고 안전한 만남을 준비합니다. 이름·연락처는 받지 않습니다. ' +
  '유료 여행상품·차량 배차·유상 자가용 운송 알선은 제공하지 않습니다. ' +
  '정식 운영 전에 관련 법령에 따른 등록·안전·운영 의무를 확인하겠습니다.</p></div>' +
  '<a href="/privacy.html">데이터 안내 →</a></section>' +
  '<p id="n13-save-status" role="status" class="n13-landing-notice">응답 저장 가능 여부를 확인하는 중입니다. 현재 실제 동행 매칭·예약·결제는 제공하지 않습니다.</p>' +
  '<a href="/#n14-place-browse" class="n13-landing-more">직접 장소 검색하기 →</a></div>'
}));
// 비공개 작업 데이터는 Supabase Auth + DB allowlist로만 접근할 수 있습니다.
await writeFile(resolve(out,'account.html'),page({title:'내 계정 — 나가치',description:'카카오 로그인 및 동행 일정 소식',path:'/account.html',noindex:true,content:'<link rel="stylesheet" href="/assets/v40-account.css"><h1>내 나가치</h1><p id="n40-status" role="status"></p><section id="n40-account"></section><script type="module" src="/assets/v40-account-page.js"></script>'}));
await writeFile(resolve(out,'admin.html'),page({
 title:'나가치 운영실 · 코스·모임·수익 관리',
 description:'운영자 인증 전용 동행 코스와 모임 관리 화면',
 path:'/admin.html',page:'info',noindex:true,
 content:operatorMarkup()+
  '<script type="module" src="/assets/v19-admin.js?v=20261124-v40"></script>'
}));
await writeFile(resolve(out, 'about.html'), page({ title: '편안함 점수 안내 — 나가치', description: '확인한 정보로 계산하는 편안함 점수와 정보 신뢰도를 안내합니다.', path: '/about.html', content: `<p class="eyebrow">나에게 맞는 편안함</p><h1>별점과 다른, 편안함의 기준</h1><p>나가치는 나에게 맞는 하루를 찾는 서비스입니다. ‘내리듬’은 내 상황과 취향에 맞춘 추천을 뜻해요. 누구와 보내고 싶은지, 어떤 하루가 당기는지 고르고 나에게 필요한 편안함을 더해보세요.</p><h2>확인한 정보만 사용합니다</h2><p>주차 15%, 계단 15%, 접근성 10%, 화장실 10%, 좌석 15%, 보행부담 15%, 소음 10%, 대기 10%를 기본 가중치로 사용합니다. 확인된 항목의 ‘좋음’은 100점, ‘보통’은 50점, ‘부담 있음’은 0점으로 계산해 확인된 가중치 안에서 평균을 냅니다.</p><h2>정보가 부족하면 숫자를 숨깁니다</h2><p>확인 가능한 정보가 전체 가중치의 40% 미만이면 숫자 대신 ‘정보 더 필요’로 표시합니다. 정보 신뢰도는 확인 비중 80% 이상 ‘높음’, 60% 이상 ‘보통’, 나머지는 ‘낮음’입니다. 신뢰도는 정보의 충실도이며 편안함 자체나 현장 상태를 보증하지 않습니다.</p><h2>사실 정보와 평가를 구분합니다</h2><p>TourAPI에서 확인한 주차 가능 여부, 운영시간, 화장실, 출입구·경사로 같은 정보는 사실형 이용 정보로 먼저 보여줍니다. 이 사실을 임의로 ‘좋음/불편’ 점수로 바꾸지 않습니다.</p><h2>이용자 평가와 구분합니다</h2><p>편안함 점수는 출처와 확인 날짜가 있는 정보에 기반한 계산입니다. 실제 이용자의 별점이나 리뷰가 아닙니다. 이번 버전에는 이용자 평가 기능이 없습니다.</p><a class="button primary" href="/">장소 살펴보기</a>` }));
await writeFile(resolve(out, 'privacy.html'), page({ title: '데이터 안내 — 나가치', description: '저장 기능과 익명 행동 분석 안내', path: '/privacy.html', content: `<h1>데이터를 이렇게 사용합니다</h1><h2>카카오 로그인 및 계정별 일정 소식</h2><p>탐색은 로그인 없이 가능합니다. 새 일정 소식은 카카오 OAuth와 Supabase Auth로 로그인하고 활동별 수신 동의를 저장해야 합니다. 인증 제공사가 전달한 계정 정보는 Supabase Auth에서 관리하며 나가치 소식 기능은 계정 ID와 활동, 만료 시점만 사용합니다. 다른 기기에서 같은 계정으로 로그인하면 소식을 확인할 수 있습니다. 수신 해지 시 계정의 구독 기록을 삭제하며 90일 후 만료됩니다. 기존 기기 구독은 아래 안내대로 확인·해지할 수 있습니다. 회원 탈퇴 및 인증 정보 삭제는 운영자 처리 절차 마련 후 제공할 예정입니다. 실제 신규 회원 모집 전 개인정보 처리방침과 탈퇴 절차를 완성해야 합니다.</p><h2>일반 이용자는 계정 없이 둘러볼 수 있어요</h2><p>익명 탐색에서는 이름, 연락처, 주민번호, 건강정보를 받지 않습니다. 장소 저장 목록과 임의로 만든 익명 브라우저 식별값은 브라우저 저장 공간에 보관합니다. 브라우저 데이터를 지우면 초기화됩니다.</p><h2>분석 서버가 연결된 경우</h2><p>방문·검색·장소 저장·동행 관심 클릭은 동의 전 서버로 전송하지 않습니다. 동행 설문에서 명시적으로 저장에 동의하고 제출한 경우에만 응답 내용, 해당 장소에 대한 관심 및 선택 활동을 기록합니다. 동의하지 않거나 설문을 닫으면 서버에 보관하지 않습니다. 검색어 원문, 전체 URL, 위치 좌표, 연락처 및 IP 주소는 분석 이벤트 데이터에 넣지 않습니다. 서비스 제공사의 접속 로그는 해당 제공사의 정책이 적용됩니다.</p><h2>관심 인원 집계와 선택형 동행 소식</h2><p>공개 화면의 관심 인원은 최근 90일 내 동의하고 저장한 익명 설문을 브라우저별로 중복 제거해 계산합니다. 5명 미만은 공개하지 않으며 실제 참가 인원으로 표시하지 않습니다. 기존 기기 방식으로 등록한 소식 신청은 무작위 비밀값을 이 기기에만 저장하고, 서버에는 그 해시값과 선택한 활동을 저장하며 소식 조회 권한은 90일간 유효합니다. 만료된 구독 기록은 운영자가 별도 정리합니다. 같은 활동의 운영자 공지만 이 기기에서 앱 재방문 시 조회할 수 있고, 해지하면 서버 구독이 삭제됩니다. 기기를 바꾸거나 브라우저 정보를 지우면 소식을 다시 찾기 어렵고, 90일이 지나면 다시 동의해 신청해야 합니다. 이메일·문자·푸시 발송을 제공하지 않습니다. 관리자 화면에는 Supabase Auth와 서버에서 등록한 관리자 권한이 필요합니다.</p><h2>동행 취향 선택은 자유롭게</h2><p>선택한 실제 장소와 활동, 연령대, 희망 동행, 목적, 선호 인원, 지불의향만 동의받아 검증에 사용합니다. 저장 완료 메시지는 서버에 설문이 실제 기록된 경우에만 표시합니다. 실제 사람 연결이나 결제가 아닙니다. DEMO SAMPLE 응답은 실제 KPI에서 제외합니다.</p><h2>모임별 관심 등록·취소</h2><p>공개된 모임에 관심을 등록할 때 별도로 동의를 받습니다. 무작위 기기 비밀값은 이 브라우저에 저장하고, 서버에는 해시와 모임 ID, 동의 시점, 만료 시점만 보관합니다. 90일이 지나면 집계에서 제외되며 운영자가 만료 데이터를 정리합니다. 모임 카드에서 개별 취소하거나 홈에서 이 기기의 모든 모임 관심을 취소할 수 있습니다. 기기 변경 또는 브라우저 데이터 삭제 시 기존 기록을 찾기 어려우며, 관심 등록은 실제 신청·예약·결제가 아닙니다. 운영자는 모임별 기기 수만 확인하고 공개 화면에는 수를 표시하지 않습니다.</p><h2>무료 시범 동행 참가 신청</h2><p>만 19세 이상 이용자의 별도 동의를 받아 모임 ID, 무작위 기기 비밀값의 해시, 신청 및 변경 시각, 신청 상태를 저장합니다. 원본 비밀값은 이 기기에만 보관합니다. 관리자는 신청 번호와 상태를 확인하고, 승인된 기기만 집결지를 조회할 수 있습니다. 신청은 신원 확인이나 실제 참석의 증명이 아닙니다. 신청 취소 시 해당 신청 기록을 삭제합니다. 일정 30일 경과 기록은 운영자가 정기 삭제합니다. 기기를 바꾸거나 브라우저 저장 데이터를 지우면 신청 내역 접근 및 취소가 어려워집니다. 실명·연락처·결제 정보는 수집하지 않습니다. 현장 비용은 각자 부담하고, 안전한 공개 장소에서 운영자 안내에 따라 참여하세요. 신청 승인 여부와 취소 여부는 앱에서 직접 확인해야 합니다.</p><h2>보관 기간</h2><p>분석 이벤트는 운영자가 90일을 기준으로 관리합니다. 브라우저에 저장한 장소와 익명 식별값은 브라우저 데이터 삭제 기능으로 지울 수 있습니다.</p><h2>연결하지 않은 경우</h2><p>분석을 연결하지 않으면 행동과 설문 응답을 서버에 저장하지 않습니다. 탐색, 저장, 공유는 계속 사용할 수 있습니다. 취향 입력 화면에 저장 여부를 표시합니다.</p><a href="/" class="button secondary">홈으로</a>` }));
await writeFile(resolve(out, '404.html'), page({ title: '장소를 찾지 못했어요 — 나가치', description: '다른 장소를 살펴보세요.', path: '/404.html', noindex: true, content: '<h1>이 페이지를 찾지 못했어요</h1><p>주소가 바뀌었거나 없는 페이지입니다.</p><a href="/" class="button primary">장소 다시 찾기</a>' }));
const urls = INDEXING_ENABLED ? [...(places.some(p => !p.isDemo) ? ['/'] : []), '/about.html', ...places.filter(p => !p.isDemo).map(placeUrl)] : [];
await writeFile(resolve(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(path => `<url><loc>${escapeHtml(siteUrl + path)}</loc></url>`).join('')}</urlset>\n`);
const robots = `User-agent: *\nAllow: /\n${INDEXING_ENABLED ? `Sitemap: ${siteUrl}/sitemap.xml\n` : '# Internal validation: all HTML has noindex,nofollow; allow crawling to read it.\n'}`;
await writeFile(resolve(out, 'robots.txt'), robots);
await writeFile(resolve(out, '_headers'), `/*\n${!INDEXING_ENABLED ? '  X-Robots-Tag: noindex, nofollow\n' : ''}  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https:; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Content-Type-Options: nosniff\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n`);
const regionCounts = places.reduce((acc,p) => (acc[p.region] = (acc[p.region] || 0) + 1, acc), {});
const activityCounts = ['korean_food','noodle','meat','seafood','cafe','walk','run','drive'].map(t => [t, places.filter(p => p.intentTags.includes(t)).length]);
console.log(`빌드 완료: 공개 장소 ${places.length}개 / 원천 ${sourcePlaces.length}개 · 지역별 ${JSON.stringify(regionCounts)} · 활동별 ${JSON.stringify(Object.fromEntries(activityCounts))}`);
const activityCoverage = Object.fromEntries(['서울','경기','강릉','경주','부산','제주'].map(region => [
  region,
  Object.fromEntries(['korean_food','noodle','meat','seafood','cafe','walk','run','drive'].map(tag =>
    [tag, places.filter(p => p.region === region && p.intentTags.includes(tag)).length]))
]));
console.log(`세부활동 지역별 확인 후보(카테고리 태그 기준): ${JSON.stringify(activityCoverage)}`);
console.log('경기 회·해산물 후보 검수: '+JSON.stringify(places.filter(p=>p.region==='경기'&&p.intentTags.includes('seafood')).map(p=>({name:p.name,representativeMenu:p.verifiedFacts?.general?.firstMenuText||null}))));


