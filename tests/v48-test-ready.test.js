import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p, import.meta.url),'utf8');
const contrast=(a,b)=>{
  const luminance=hex=>hex.match(/[\da-f]{2}/gi).map(x=>parseInt(x,16)/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4).reduce((a,x,i)=>a+x*[0.2126,0.7152,0.0722][i],0);
  const [x,y]=[luminance(a),luminance(b)].sort((a,b)=>b-a);
  return (x+0.05)/(y+0.05);
};
test('v48 관심 코랄과 탐색 네이비, 활동 4색의 색상 대비',async()=>{
  const css=await read('assets/v48-test-ready.css');
  for (const pair of [
    ['ae492f','ffffff'],['334b68','edf2f9'],['525b65','f8f6f2'],
    ['984228','fff1e8'],['58467f','f0edf8'],['315480','eaf2fc'],['3d603b','eaf3e8']
  ]) {
    assert.ok(pair.every(c=>css.includes('#'+c)),pair.join('/'));
    assert.ok(contrast(...pair)>=4.5,pair.join('/')+' 텍스트 대비');
  }
  assert.match(css,/\.n29-discover \.n28-quick-category\[aria-pressed=true\]::after/);
  assert.match(css,/\.n30-save\.save-icon\{width:44px!important;height:44px!important/);
  assert.match(css,/\.n21-popular-action\{background:var\(--n48-interest\)!important;min-height:46px!important;font-size:14px!important/);
});
test('v48 홈 및 고객 상세/저장/게시판/계정 공통 디자인 로드와 배포 캐시',async()=>{
  const detail=(await readdir(new URL('../dist/places/',import.meta.url)))[0];
  for (const page of ['index.html','saved.html','community.html','account.html','companion.html','places/'+detail+'/index.html']){
    const html=await read('dist/'+page);
    assert.equal((html.match(/v48-test-ready\.css\?v=20261126-v48/g)||[]).length,1,page);
    assert.match(html,/noindex,nofollow/,page);
  }
  assert.equal(await read('dist/assets/v48-test-ready.css'),await read('assets/v48-test-ready.css'));
  assert.match(await read('dist/index.html'),/v12-direct-home\.js\?v=20261126-v48/);
});
test('v48 처음 방문 목적 안내, 직접 검색과 인접 결과, 관심 표현 라벨',async()=>{
  const home=await read('assets/v12-direct-home.js'),popular=await read('assets/v21-popular-first.js');
  assert.match(home,/나가치가 함께할 모임을 기획해요/);
  assert.match(home,/가고 싶은 곳 검색/);
  assert.match(home,/home\.querySelector\('#n16-journey'\)\.after\(home\.querySelector\('#n14-place-browse'\)\)/);
  assert.match(home,/home\.querySelector\('#n14-place-browse'\)\.after\(results\)/);
  assert.match(popular,/data-companion-interest=.*class="n21-popular-action">관심 남기기/);
  assert.match(popular,/참가 신청은 아니에요/);
});
