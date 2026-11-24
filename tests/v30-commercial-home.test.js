import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {POPULAR_ACTIVITIES,normalizePopularPlaces} from '../assets/v21-popular-model.js';
import {togetherPlaceMatches} from '../assets/v16-together-model.js';
import {escapeHtml,safeUrl,placeUrl,icon} from '../ui.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('v38 가로 배너 사진의 원본 및 빌드 사본 일치',async()=>{
 const a=await readFile(new URL('../assets/v38-hero.webp',import.meta.url));
 assert.equal(createHash('sha1').update('blob '+a.length+'\0').update(a).digest('hex'),'3641b8b0bea884a67a2fa2df3a18700521af3b28');
 assert.deepEqual(a,await readFile(new URL('../dist/assets/v38-hero.webp',import.meta.url)));
 const home=await read('assets/v12-direct-home.js');
 assert.match(home,/src="\/assets\/v38-hero\.webp"/);
 assert.match(home,/AI 제작 이미지/);
 assert.doesNotMatch(home,/연출 이미지/);
 assert.equal((home.match(/id="n16-invites"/g)||[]).length,1);
 assert.match(home,/href="#n21-popular"/);
 assert.match(home,/data-n30-updates/);
});
test('v30 실측 순위만 표시하고 추천 카드에 인원 수 조작 없음',async()=>{
 const src=(await read('assets/v21-popular-first.js')).replace(/^import .*?;\s*$/gm,'').replace(/^export /gm,'');
 const {placeCard,discovery}=new Function('POPULAR_ACTIVITIES','togetherPlaceMatches','escapeHtml','safeUrl','placeUrl','icon','savedIds',src+'\nreturn {placeCard,discovery};')(POPULAR_ACTIVITIES,togetherPlaceMatches,escapeHtml,safeUrl,placeUrl,icon,()=>['food']);
 const p={id:'food',name:'테스트 맛집',category:'맛집',region:'서울',image:'https://example.test/a.jpg',slug:'test',intentTags:[]};
 const ranked=normalizePopularPlaces([{place_id:'food',activity:'food',interested_count:8}],[p]);
 const html=ranked.map(placeCard).join('');
 assert.match(html,/인기 1위/);
 assert.match(html,/8건 관심/);
 assert.match(html,/data-save="food"/);
 assert.match(html,/aria-pressed="true"/);
 assert.match(html,/data-companion-interest="food"/);
 const fallback=discovery([p]);
 assert.match(fallback,/동행 추천/);
 assert.doesNotMatch(fallback,/인기 [0-9]+위|[0-9]+건 관심/);
 assert.match(fallback,/서울 · 맛집/);
 assert.doesNotMatch(fallback,/하루 나들이/);
});
test('v30 두 카드 표시, 버튼 대비, 전체보기와 기존 기능 연결',async()=>{
 const css=await read('assets/v21-popular-first.css'),ui=await read('assets/v21-popular-first.js');
 assert.match(css,/flex:0 0 calc\(\(100% - 8px\)\/2\)!important/);
 assert.match(css,/\.n21-popular-action,\.n21-popular-action span\{color:#fff!important\}/);
 assert.match(css,/\.n21-popular\.n30-expanded/);
 assert.match(ui,/all\.addEventListener|all\?\.addEventListener/);
 assert.match(ui,/aria-expanded/);
 assert.match(ui,/추천 동행 보기/);
 assert.match(await read('dist/index.html'),/v12-direct-home\.js\?v=20261124-v39/);
});

test('v33 홈은 탐색 중심이며 개인 소식은 별도 대화상자로 표시',async()=>{
 const home=await read('assets/v12-direct-home.js'),group=await read('assets/v19-group-ui.js'),css=await read('assets/v21-popular-first.css');
 assert.doesNotMatch(home,/class="n16-respect"/);
 assert.match(home,/class="n33-utility-links"/);
 assert.match(home,/aria-controls="n33-updates-dialog"/);
 assert.match(home,/dialog\.showModal\(\)/);
 assert.match(group,/document\.createElement\('dialog'\)/);
 assert.match(group,/dialog\.append\(close,inbox\)/);
 assert.match(group,/dialog\.close\(\)/);
 assert.match(group,/focus\(\{preventScroll:true\}\)/);
 assert.match(css,/\.n33-updates-dialog:not\(\[open\]\)\{display:none!important\}/);
 assert.match(css,/\.n29-service-guide\>summary\{display:flex!important/);
});

test('v34 배너 전체 사진과 하단 카피, 최신 모듈 캐시 연결',async()=>{
 const home=await read('assets/v12-direct-home.js'),css=await read('assets/v21-popular-first.css'),build=await read('scripts/build.js');
 assert.match(home,/n21-hero n34-full-photo/);
 const latest=css.slice(css.indexOf('/* v34:'));
 assert.match(latest,/inset:0!important;width:100%!important;height:100%!important;opacity:1!important;z-index:0!important/);
 assert.match(latest,/mask-image:none!important/);
 assert.match(latest,/transparent 42%/);
 assert.match(latest,/padding:158px 15px 14px!important/);
 assert.match(home,/v19-group-ui\.js\?v=20261124-v39/);
 assert.match(home,/v21-popular-first\.js\?v=20261124-v39/);
 assert.match(build,/Cache-Control: no-cache, must-revalidate/);
});

test('v35 소개 문구 한 줄과 독립 추천 버튼',async()=>{
 const home=await read('assets/v12-direct-home.js'),css=await read('assets/v21-popular-first.css');
 const banner=home.slice(home.indexOf('<section class="n16-hero n18-hero n19-hero n21-hero n34-full-photo n35-photo-banner"'),home.indexOf('class="n16-hero-cta n35-recommend-link"'));
 assert.match(banner,/<h1 id="n16-home-title">가고 싶은 곳, 함께할 사람\.<\/h1><\/section>/);
 assert.doesNotMatch(banner,/<p>|<br>|data-n30-hero-label/);
 assert.match(home,/class="n16-hero-cta n35-recommend-link" href="#n21-popular"/);
 const latest=css.slice(css.indexOf('/* v35:'));
 assert.match(latest,/aspect-ratio:1\.65!important/);
 assert.match(latest,/inset:0!important;width:100%!important;height:100%!important/);
 assert.match(latest,/white-space:nowrap!important/);
 assert.match(latest,/margin:9px 0 0!important/);
});


test('v38 가로 원본 사진이 배너 전체에 잘림 없이 표시되고 추천 버튼은 별도 유지',async()=>{
 const home=await read('assets/v12-direct-home.js'),css=await read('assets/v21-popular-first.css');
 const latest=css.slice(css.indexOf('/* v38:'));
 assert.match(home,/width="720" height="480"/);
 assert.match(home,/class="n34-version">v39/);
 assert.match(home,/class="n16-hero-cta n35-recommend-link" href="#n21-popular"/);
 assert.match(latest,/aspect-ratio:3 \/ 2!important/);
 assert.match(latest,/object-fit:contain!important;object-position:center!important/);
 assert.match(latest,/\.n19-photo-mosaic::before\{content:none!important;display:none!important/);
 assert.match(latest,/mask-image:none!important/);
 assert.match(latest,/transparent 70%/);
});
