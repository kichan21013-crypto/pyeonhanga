import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createProgressiveFlow } from '../flow.js';
import { emptyRhythmFilters, toggleSelection, activeActivities, recommendRhythms } from '../rhythm.js';
// A minimal element adapter exercises the same controller that writes hidden/open/disabled in app.js.
function harness(reducedMotion = true) {
  const make = (hidden = true) => ({ hidden, open:false, disabled:false, dataset:{}, animations:[], animate(frames,options){this.animations.push({frames,options});} });
  const explore=make(), results=make(), steps=[make(false),make(),make()], final=make(), next=[make(),make()];
  next[0].dataset.nextStep='2';next[1].dataset.nextStep='3';
  const root={querySelector:key=>({'#explore':explore,'#rhythm-results':results,'#recommend-button':final})[key],querySelectorAll:key=>key==='[data-flow-step]'?steps:next};
  return { flow:createProgressiveFlow(root,{reducedMotion:()=>reducedMotion}),explore,results,steps,final,next };
}
test('시작 전에는 숨기고 CTA로 시작하면 한 개 선택판만 보인다',()=>{
  const h=harness(),f=emptyRhythmFilters();h.flow.update(f);assert.equal(h.explore.hidden,true);
  h.flow.start(f);assert.equal(h.explore.hidden,false);assert.deepEqual(h.steps.map(e=>e.hidden),[false,true,true]);
  assert.equal(h.steps[0].open,true);assert.equal(h.results.hidden,true);assert.equal(h.final.disabled,true);
});
test('욕구 하나만 골라도 바로 추천 준비가 되고 추가 단계는 강제하지 않는다',()=>{
  const h=harness(),f=emptyRhythmFilters();h.flow.start(f);
  f.desires=toggleSelection(f.desires,'move');h.flow.update(f);
  assert.deepEqual(h.steps.map(e=>e.hidden),[false,true,true]);assert.equal(h.final.disabled,false);
  f.desires=toggleSelection(f.desires,'eat');f.activities=['walk','noodle'];h.flow.update(f);
  assert.deepEqual(f.desires,['move','eat']);assert.deepEqual(activeActivities(f.desires,f.activities),['walk','noodle']);assert.equal(h.results.hidden,true);
  assert.equal(h.flow.submit(f),true);assert.equal(h.results.hidden,false);
});
test('동행·시간·이동은 선택 보정값이며 추천의 필수 조건이 아니다',()=>{
  const h=harness(),f={...emptyRhythmFilters(),desires:['eat']};h.flow.start(f);
  f.companions=toggleSelection(f.companions,'solo');f.duration='short';f.transport='car';h.flow.update(f);
  assert.equal(h.final.disabled,false);assert.equal(h.steps[1].hidden,true);assert.equal(h.steps[2].hidden,true);
  assert.equal(h.flow.submit(f),true);assert.equal(h.results.hidden,false);
});
test('욕구를 모두 지우면 추천 버튼이 다시 비활성화되고 결과도 숨는다',()=>{
  const h=harness(),f={...emptyRhythmFilters(),desires:['move']};h.flow.start(f);h.flow.submit(f);
  f.desires=[];h.flow.update(f);assert.equal(h.results.hidden,true);assert.equal(h.final.disabled,true);assert.equal(h.flow.submit(f),false);
  h.flow.update(emptyRhythmFilters());assert.equal(h.flow.activate(1),true);assert.equal(h.flow.activate(2),false);
});
test('자연어만 입력해도 바로 추천할 수 있다',()=>{
  const h=harness(),f={...emptyRhythmFilters(),query:'친구랑 드라이브하고 칼국수 먹고 싶어'};
  h.flow.start(f);assert.equal(h.final.disabled,false);assert.equal(h.flow.submit(f),true);assert.equal(h.results.hidden,false);
});
test('새 영역은 한 번만 짧게 나타나며 reduced-motion에서는 애니메이션하지 않는다',()=>{
  const f={...emptyRhythmFilters(),desires:['outdoor']};const h=harness(false);h.flow.start(f);
  assert.equal(h.explore.animations.length,1);assert.equal(h.steps[0].animations.length,0);h.flow.update(f);
  const reduced=harness(true);reduced.flow.start(f);reduced.flow.submit(f);
  assert.ok([reduced.explore,reduced.results,...reduced.steps].every(e=>e.animations.length===0));assert.equal(reduced.results.hidden,false);
});
test('생성 홈에는 원본 3단계 마크업·홈 링크·모바일 CSS가 있고 클라이언트가 한 화면으로 압축한다',async()=>{
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  assert.match(html,/<section id="explore"[^>]* hidden>/);assert.match(html,/id="flow-step-1"[^>]* open>/);
  assert.match(html,/id="flow-step-2"[^>]* hidden>/);assert.match(html,/id="flow-step-3"[^>]* hidden>/);
  assert.match(html,/id="rhythm-results" hidden/);assert.match(html,/오늘의 리듬 보기/);assert.match(html,/나에게 중요한 조건 더하기/);
  assert.match(html,/class="nav-home" href="\/"/);assert.match(html,/mobile-ux\.css/);
  assert.match(html,/id="day-paths-title">오늘 하루의 여러 갈림길/);assert.match(html,/role="img" aria-labelledby="day-paths-title day-paths-desc"/);
  const places=JSON.parse(await readFile(new URL('../data/places.json',import.meta.url)));
  const results=recommendRhythms(places);
  assert.ok(results.length > 0);assert.ok(results.length <= places.length);
});
