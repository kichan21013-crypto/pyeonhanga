import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('v49 dialog content scrolls separately from both actions; explicit consent still gates writes',async()=>{
 const app=await read('app.js'),css=await read('assets/v49-final.css');
 assert.equal((app.match(/class="n49-step-scroll"/g)||[]).length,2);
 assert.match(app,/class="n49-step-actions".*n20-first-status/);
 assert.match(css,/\.n49-step-scroll\{flex:1;min-height:0;overflow-y:auto/);
 assert.match(css,/\.n20-action-dock\{\s*flex:none;position:static!important/);
 assert.match(css,/\.survey \.button\.primary:is\(\.n18-next,\.n20-submit-interest\)/);
 assert.match(app,/연령대를 선택해 주세요/);
 assert.match(app,/희망하는 모임 인원을 선택해 주세요/);
 assert.match(app,/if\(!form\.elements\.consent\.checked\)\{/);
 assert.match(app,/analyticsEnabled&&form\.elements\.consent\.checked&&/);
 assert.match(app,/if\(!success\)\{/);
});
test('v49 actual public programmes first, no false programme link for empty/error results',async()=>{
 const home=await read('assets/v12-direct-home.js'),pub=await read('assets/v22-public-programs.js');
 assert.match(home,/class="n49-program-link" href="#n22-public-programs" hidden/);
 assert.match(home,/querySelector\('#n21-popular'\)\.before\(home\.querySelector\('#n22-public-programs'\)\)/);
 assert.match(pub,/programLink\.hidden=!shownCourses\.length&&!shownEvents\.length/);
 assert.match(pub,/load\(\)\.catch\(\(\)=>\{section\.hidden=true;if\(programLink\)programLink\.hidden=true/);
});
test('v49 consistent customer navigation and fresh assets for all customer pages',async()=>{
 const detail=(await readdir(new URL('../dist/places/',import.meta.url)))[0];
 for(const page of ['index.html','saved.html','community.html','account.html','companion.html','places/'+detail+'/index.html']){
  const html=await read('dist/'+page);
  assert.equal((html.match(/v49-final\.css\?v=20261127-v49/g)||[]).length,1,page);
  assert.match(html,/app\.js\?v=20261127-v49/,page);
  assert.match(html,/noindex,nofollow/,page);
  if(page!=='index.html'){
   assert.match(html,/동행 찾기<\/span>/,page);
   assert.match(html,/동행 안내<\/span>/,page);
  }
 }
 const css=await read('assets/v49-final.css');
 assert.match(css,/body:has\(#n45-community,#n40-account\) \.n-mobile-nav\{/);
 assert.equal(await read('dist/assets/v49-final.css'),css);
});
