import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {POPULAR_ACTIVITIES,normalizePopularPlaces} from '../assets/v21-popular-model.js';
import {togetherPlaceMatches} from '../assets/v16-together-model.js';
import {escapeHtml,safeUrl,placeUrl,icon} from '../ui.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('v30 승인 시안에서 분리한 인물 사진의 빌드 사본 일치',async()=>{
 const a=await readFile(new URL('../assets/v31-hero.webp',import.meta.url));
 assert.equal(createHash('sha1').update('blob '+a.length+'\0').update(a).digest('hex'),'ca27908d4a2c1c348bfd930477629edfeb5e0c29');
 assert.deepEqual(a,await readFile(new URL('../dist/assets/v31-hero.webp',import.meta.url)));
 const home=await read('assets/v12-direct-home.js');
 assert.match(home,/src="\/assets\/v31-hero\.webp"/);
 assert.match(home,/연출 이미지/);
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
 assert.match(await read('dist/index.html'),/v12-direct-home\.js\?v=20261124-v31/);
});

test('v31 원본 사진 비율 및 얼굴 그라데이션 제거',async()=>{
 const home=await read('assets/v12-direct-home.js'),css=await read('assets/v21-popular-first.css');
 assert.match(home,/width="451" height="469"/);
 assert.match(css,/\.n21-hero:before\{background:none!important\}/);
 assert.match(css,/object-fit:contain!important;object-position:right center!important;filter:none!important/);
 assert.match(css,/mask-image:linear-gradient\(90deg,transparent 0%,#000 4%,#000 100%\)/);
});
