import { readFile, writeFile, mkdir, rm, cp, access } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { card, detailMarkup, escapeHtml, safeUrl, placeUrl } from '../ui.js';
import { validatePlaces } from './validate-data.js';
import { publicConfig } from './public-config.js';
import { recommendRhythms } from '../rhythm.js';
import { buildPilotPlaces } from './pilot-data.js';
// 내부 검증 기간. 정식 공개 시 이 값 하나로 생성 페이지 색인을 전환합니다.
const INDEXING_ENABLED = false;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'dist');
const sourcePlaces = JSON.parse(await readFile(resolve(root, 'data/places.json'), 'utf8'));
const generalReport = JSON.parse(await readFile(resolve(root, 'data/tourapi-enrichment-report.json'), 'utf8'));
const barrierReport = JSON.parse(await readFile(resolve(root, 'data/barrierfree-enrichment-report.json'), 'utf8'));
validatePlaces(sourcePlaces);
const places = buildPilotPlaces(sourcePlaces, generalReport, barrierReport, 6);
validatePlaces(places);
const siteUrl = (process.env.SITE_URL || process.env.CF_PAGES_URL || 'http://localhost:4173').replace(/\/$/, '');
if (!/^https?:\/\/[^/]+$/.test(siteUrl)) throw new Error('SITE_URL에는 https://서비스주소 형태의 주소를 입력하세요.');
if (siteUrl.startsWith('http://localhost')) console.log('안내: 현재 SEO 주소는 로컬용입니다. 배포 시 SITE_URL을 설정하세요.');
const index = (await readFile(resolve(root, 'index.html'), 'utf8')).replace(/<meta name="robots" content="noindex,nofollow">/g,'');
const header = index.match(/<header class="site-header">[\s\S]*?<\/header>/)[0];
const footer = `<footer class="site-footer"><div class="container footer-inner"><div><a class="footer-brand" href="/">나가치</a><p>오늘, 내 리듬대로.</p><p>© ${new Date().getUTCFullYear()} 나가치 · 시장 검증용 MVP</p></div><div class="footer-links"><a href="/about.html">편안함 점수 안내</a><a href="/privacy.html">데이터 안내</a></div></div></footer>`;
function seo(path, title, description, image = '/assets/garden.svg', noindex = false) {
  const url = escapeHtml(siteUrl + path);
  const imageUrl = image.startsWith('/') ? siteUrl + image : image;
  return `<link rel="canonical" href="${url}"><meta property="og:type" content="website"><meta property="og:locale" content="ko_KR"><meta property="og:site_name" content="나가치"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${safeUrl(imageUrl)}">${!INDEXING_ENABLED || noindex ? '<meta name="robots" content="noindex,nofollow">' : ''}`;
}
function page({ title, description, path, content, page = 'info', id = '', image, noindex = false }) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}">${seo(path, title, description, image, noindex)}<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/styles.css"><script type="module" src="/app.js"></script></head><body data-page="${page}" data-place-id="${escapeHtml(id)}"><a class="skip-link" href="#main">본문 바로가기</a>${header}<main id="main" class="container ${page === 'detail' ? 'detail-main' : 'prose'}">${content}</main>${footer}<div id="toast" class="toast" role="status" hidden></div></body></html>`;
}
await rm(out, { recursive: true, force: true }); await mkdir(out, { recursive: true });
for (const file of ['styles.css', 'app.js', 'ui.js', 'analytics.js', 'storage.js', 'comfort-score.js', 'search.js', 'rhythm.js', 'actions.js', 'flow.js', 'assets', 'data']) await cp(resolve(root, file), resolve(out, file), { recursive: true });
// 원천 257개는 저장소에 유지하고, 공개 검증판에는 지역별 6개씩 선별한 파일럿만 제공합니다.
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
await writeFile(resolve(out, 'index.html'), index.replace('<!-- SEO -->', seo('/', '나가치 — 오늘, 내 리듬대로.', '막연히 뭔가 하고 싶은 날, 내 상황과 취향에 맞는 하루를 찾아보세요.', '/assets/garden.svg', places.every(p => p.isDemo))).replace('<!-- CARDS -->', recommendRhythms(places).map(r => card(r.place,false,undefined,r)).join('')).replace('<!-- FOOTER -->', footer).replace(/<p class="demo-notice">[\s\S]*?<\/p>/, places.some(p => p.isDemo) ? '<p class="demo-notice">DEMO SAMPLE 배지가 붙은 장소는 기능 체험용 가상 데이터입니다. 실제 방문 정보가 아닙니다.</p>' : '<p class="demo-notice">확인한 정보만 표시합니다. 방문 전 출처와 최근 확인 날짜를 살펴보세요.</p>'));
const saved = (await readFile(resolve(root, 'saved.html'), 'utf8')).replace(/<meta name="robots" content="noindex,nofollow">/g,'');
await writeFile(resolve(out, 'saved.html'), saved.replace('<!-- SEO -->', seo('/saved.html', '저장한 곳 — 나가치', '마음에 담은 장소를 다시 살펴보세요.', undefined, true)).replace('<!-- HEADER -->', header).replace('<!-- FOOTER -->', footer));
for (const p of places) {
  const dir = resolve(out, 'places', p.slug); await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, 'index.html'), page({ title: `${p.name} · ${p.region} ${p.category} 편안함 정보 — 나가치`, description: p.isDemo ? `DEMO SAMPLE · ${p.shortDescription}` : p.shortDescription, path: placeUrl(p), content: detailMarkup(p), page: 'detail', id: p.id, image: p.image, noindex: p.isDemo }));
}
await writeFile(resolve(out, 'about.html'), page({ title: '편안함 점수 안내 — 나가치', description: '확인한 정보로 계산하는 편안함 점수와 정보 신뢰도를 안내합니다.', path: '/about.html', content: `<p class="eyebrow">나에게 맞는 편안함</p><h1>별점과 다른, 편안함의 기준</h1><p>나가치는 나에게 맞는 하루를 찾는 서비스입니다. ‘내리듬’은 내 상황과 취향에 맞춘 추천을 뜻해요. 누구와 보내고 싶은지, 어떤 하루가 당기는지 고르고 나에게 필요한 편안함을 더해보세요.</p><h2>확인한 정보만 사용합니다</h2><p>주차 15%, 계단 15%, 접근성 10%, 화장실 10%, 좌석 15%, 보행부담 15%, 소음 10%, 대기 10%를 기본 가중치로 사용합니다. 확인된 항목의 ‘좋음’은 100점, ‘보통’은 50점, ‘부담 있음’은 0점으로 계산해 확인된 가중치 안에서 평균을 냅니다.</p><h2>정보가 부족하면 숫자를 숨깁니다</h2><p>확인 가능한 정보가 전체 가중치의 40% 미만이면 숫자 대신 ‘정보 더 필요’로 표시합니다. 정보 신뢰도는 확인 비중 80% 이상 ‘높음’, 60% 이상 ‘보통’, 나머지는 ‘낮음’입니다. 신뢰도는 정보의 충실도이며 편안함 자체나 현장 상태를 보증하지 않습니다.</p><h2>사실 정보와 평가를 구분합니다</h2><p>TourAPI에서 확인한 주차 가능 여부, 운영시간, 화장실, 출입구·경사로 같은 정보는 사실형 이용 정보로 먼저 보여줍니다. 이 사실을 임의로 ‘좋음/불편’ 점수로 바꾸지 않습니다.</p><h2>이용자 평가와 구분합니다</h2><p>편안함 점수는 출처와 확인 날짜가 있는 정보에 기반한 계산입니다. 실제 이용자의 별점이나 리뷰가 아닙니다. 이번 버전에는 이용자 평가 기능이 없습니다.</p><a class="button primary" href="/">장소 살펴보기</a>` }));
await writeFile(resolve(out, 'privacy.html'), page({ title: '데이터 안내 — 나가치', description: '저장 기능과 익명 행동 분석 안내', path: '/privacy.html', content: `<h1>데이터를 이렇게 사용합니다</h1><h2>로그인과 개인정보 입력이 없습니다</h2><p>이름, 연락처, 주민번호, 건강정보를 받지 않습니다. 장소 저장 목록과 임의로 만든 익명 브라우저 식별값은 브라우저 저장 공간에 보관합니다. 브라우저 데이터를 지우면 초기화됩니다.</p><h2>분석을 연결한 경우</h2><p>방문, 검색 실행, 필터 사용, 상세 조회, 저장, 공유, 동행 관심, 지불의향 응답을 Supabase에 전송합니다. 검색어 원문, 전체 URL, 위치 좌표, 연락처, IP 주소를 이벤트 데이터에 넣지 않습니다. 서비스 제공사의 접속 로그 처리는 해당 제공사의 정책을 따릅니다.</p><h2>동행 설문은 선택입니다</h2><p>연령대, 희망 동행, 목적, 선호 인원, 지불의향만 수요 검증에 사용합니다. 실제 사람 연결이나 결제가 아닙니다. DEMO SAMPLE 응답은 실제 KPI에서 제외합니다.</p><h2>보관 기간</h2><p>분석 이벤트는 운영자가 90일을 기준으로 관리합니다. 브라우저에 저장한 장소와 익명 식별값은 브라우저 데이터 삭제 기능으로 지울 수 있습니다.</p><h2>연결하지 않은 경우</h2><p>분석을 연결하지 않으면 행동과 설문 응답을 서버에 저장하지 않습니다. 탐색, 저장, 공유는 계속 사용할 수 있습니다. 설문 화면에 현재 전송 여부를 표시합니다.</p><a href="/" class="button secondary">홈으로</a>` }));
await writeFile(resolve(out, '404.html'), page({ title: '장소를 찾지 못했어요 — 나가치', description: '다른 장소를 살펴보세요.', path: '/404.html', noindex: true, content: '<h1>이 페이지를 찾지 못했어요</h1><p>주소가 바뀌었거나 없는 페이지입니다.</p><a href="/" class="button primary">장소 다시 찾기</a>' }));
const urls = INDEXING_ENABLED ? [...(places.some(p => !p.isDemo) ? ['/'] : []), '/about.html', ...places.filter(p => !p.isDemo).map(placeUrl)] : [];
await writeFile(resolve(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(path => `<url><loc>${escapeHtml(siteUrl + path)}</loc></url>`).join('')}</urlset>\n`);
const robots = `User-agent: *\nAllow: /\n${INDEXING_ENABLED ? `Sitemap: ${siteUrl}/sitemap.xml\n` : '# Internal validation: all HTML has noindex,nofollow; allow crawling to read it.\n'}`;
await writeFile(resolve(out, 'robots.txt'), robots);
await writeFile(resolve(out, '_headers'), `/*\n${!INDEXING_ENABLED ? '  X-Robots-Tag: noindex, nofollow\n' : ''}  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https:; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Content-Type-Options: nosniff\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n`);
console.log(`빌드 완료: 파일럿 장소 ${places.length}개 / 원천 ${sourcePlaces.length}개 · 실행 npm start`);
