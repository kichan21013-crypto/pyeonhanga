import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createProgressiveFlow } from '../flow.js';
import { emptyRhythmFilters, toggleSelection, activeActivities, recommendRhythms } from '../rhythm.js';
function harness(reducedMotion = true) {
  const make = (hidden = true) => ({ hidden, open:false, disabled:false, dataset:{}, animations:[], animate(frames,options){this.animations.push({frames,options});} });
  const explore=make(), results=make(), steps=[make(false),make(),make()], final=make(), next=[make(),make()];
  next[0].dataset.nextStep='2';next[1].dataset.nextStep='3';
  const root={querySelector:key=>({'#explore':explore,'#rhythm-results':results,'#recommend-button':final})[key],querySelectorAll:key=>key==='[data-flow-step]'?steps:next};
  return { flow:createProgressiveFlow(root,{reducedMotion:()=>reducedMotion}),explore,results,steps,final,next };
}
test('시작 전 질문/결과는 숨기고 CTA로 시작하면 현재 질문 하나만 보인다',()=>{
  const h=harness(),f=emptyRhythmFilters();h.flow.update(f);assert.equal(h.explore.hidden,true);
  h.flow.start(f);assert.equal(h.explore.hidden,false);assert.deepEqual(h.steps.map(e=>e.hidden),[false,true,true]);
  assert.equal(h.steps[0].open,true);assert.equal(h.results.hidden,true);assert.equal(h.final.disabled,true);
});
test('욕구를 고른 뒤에도 현재 질문만 유지하고 다음 버튼으로 화면을 전환한다',()=>{
  const h=harness(),f=emptyRhythmFilters();h.flow.start(f);
  f.desires=toggleSelection(f.desires,'move');h.flow.update(f);
  assert.deepEqual(h.steps.map(e=>e.hidden),[false,true,true]);assert.equal(h.final.disabled,false);
  f.desires=toggleSelection(f.desires,'eat');f.activities=['walk','noodle'];h.flow.update(f);
  assert.deepEqual(f.desires,['move','eat']);assert.deepEqual(activeActivities(f.desires,f.activities),['walk','noodle']);
  assert.equal(h.flow.activate(2),true);assert.deepEqual(h.steps.map(e=>e.hidden),[true,false,true]);assert.equal(h.steps[1].open,true);
});
test('동행은 선택 사항이며 선택하지 않아도 조건 화면과 추천 결과로 갈 수 있다',()=>{
  const h=harness(),f={...emptyRhythmFilters(),desires:['eat']};h.flow.start(f);
  assert.equal(h.flow.activate(2),true);assert.deepEqual(h.steps.map(e=>e.hidden),[true,false,true]);
  assert.equal(h.flow.activate(3),true);assert.deepEqual(h.steps.map(e=>e.hidden),[true,true,false]);assert.equal(h.final.disabled,false);
  assert.equal(h.flow.submit(f),true);assert.deepEqual(h.steps.map(e=>e.hidden),[true,true,true]);assert.equal(h.results.hidden,false);
});
test('선택 수정과 초기화는 결과를 숨기고 핵심 욕구가 없으면 다음 단계 접근을 막는다',()=>{
  const h=harness(),f={...emptyRhythmFilters(),desires:['move']};h.flow.start(f);h.flow.submit(f);
  f.companions=[];h.flow.update(f);assert.equal(h.results.hidden,true);assert.equal(h.flow.submit(f),true);
  f.desires=[];h.flow.update(f);assert.equal(h.steps[1].hidden,true);assert.equal(h.flow.activate(3),false);assert.equal(h.flow.submit(f),false);
  h.flow.update(emptyRhythmFilters());h.flow.activate(1);assert.equal(h.steps[0].open,true);assert.equal(h.results.hidden,true);
});
test('자연어만 입력해도 추천 준비가 되며 동행·조건은 건너뛸 수 있다',()=>{
  const h=harness(),f={...emptyRhythmFilters(),query:'친구랑 드라이브하고 칼국수 먹고 싶어'};
  h.flow.start(f);assert.equal(h.final.disabled,false);assert.equal(h.flow.submit(f),true);assert.equal(h.results.hidden,false);
});
test('전환은 짧게 나타나며 reduced-motion에서는 애니메이션하지 않는다',()=>{
  const f={...emptyRhythmFilters(),desires:['outdoor']};const h=harness(false);h.flow.start(f);
  assert.equal(h.explore.animations.length,1);h.flow.activate(2);assert.equal(h.steps[1].animations.length,1);
  const reduced=harness(true);reduced.flow.start(f);reduced.flow.activate(2);reduced.flow.submit(f);
  assert.ok([reduced.explore,reduced.results,...reduced.steps].every(e=>e.animations.length===0));assert.equal(reduced.results.hidden,false);
});
test('생성 홈에는 단계 UI·홈 이동·모바일 보정 CSS와 숨긴 결과가 있다',async()=>{
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  assert.match(html,/<section id="explore"[^>]* hidden>/);assert.match(html,/id="flow-step-1"[^>]* open>/);
  assert.match(html,/id="flow-step-2"[^>]* hidden>/);assert.match(html,/id="flow-step-3"[^>]* hidden>/);
  assert.match(html,/id="rhythm-results" hidden/);assert.match(html,/오늘의 리듬 보기/);
  assert.match(html,/class="nav-home" href="\/"/);assert.match(html,/mobile-ux\.css/);
  assert.match(html,/id="day-paths-title">오늘 하루의 여러 갈림길/);
  const places=JSON.parse(await readFile(new URL('../data/places.json',import.meta.url)));
  const results=recommendRhythms(places);
  assert.ok(results.length > 0);assert.ok(results.length <= places.length);
});
