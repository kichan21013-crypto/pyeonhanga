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
test('시작 전 추천 영역은 숨기고 CTA로 시작하면 핵심 선택 화면 하나만 보인다',()=>{
  const h=harness(),f=emptyRhythmFilters();h.flow.update(f);assert.equal(h.explore.hidden,true);
  h.flow.start(f);assert.equal(h.explore.hidden,false);assert.deepEqual(h.steps.map(e=>e.hidden),[false,true,true]);
  assert.equal(h.steps[0].open,true);assert.equal(h.results.hidden,true);assert.equal(h.final.hidden,true);
});
test('욕구 하나만 고르면 추가 단계 없이 바로 추천할 준비가 된다',()=>{
  const h=harness(),f=emptyRhythmFilters();h.flow.start(f);
  f.desires=toggleSelection(f.desires,'move');h.flow.update(f);
  assert.deepEqual(h.steps.map(e=>e.hidden),[false,true,true]);assert.equal(h.final.hidden,false);
  f.desires=toggleSelection(f.desires,'eat');f.activities=['walk','noodle'];h.flow.update(f);
  assert.deepEqual(f.desires,['move','eat']);assert.deepEqual(activeActivities(f.desires,f.activities),['walk','noodle']);
  assert.equal(h.flow.activate(2),false);
  assert.equal(h.flow.submit(f),true);assert.equal(h.results.hidden,false);
});
test('동행·시간·이동을 고르지 않아도 바로 추천 결과로 갈 수 있다',()=>{
  const h=harness(),f={...emptyRhythmFilters(),desires:['eat']};h.flow.start(f);
  assert.equal(h.final.hidden,false);
  assert.equal(h.flow.activate(2),false);assert.equal(h.flow.activate(3),false);
  assert.equal(h.flow.submit(f),true);assert.deepEqual(h.steps.map(e=>e.hidden),[true,true,true]);assert.equal(h.results.hidden,false);
});
test('선택 수정과 초기화는 결과를 숨기고 핵심 욕구가 없으면 추천 실행을 막는다',()=>{
  const h=harness(),f={...emptyRhythmFilters(),desires:['move']};h.flow.start(f);h.flow.submit(f);
  f.companions=[];h.flow.update(f);assert.equal(h.results.hidden,true);assert.equal(h.flow.submit(f),true);
  f.desires=[];h.flow.update(f);assert.equal(h.final.hidden,true);assert.equal(h.flow.activate(3),false);assert.equal(h.flow.submit(f),false);
  h.flow.update(emptyRhythmFilters());h.flow.activate(1);assert.equal(h.steps[0].open,true);assert.equal(h.results.hidden,true);
});
test('자연어만 입력해도 추천 준비가 되며 추가 조건은 모두 건너뛸 수 있다',()=>{
  const h=harness(),f={...emptyRhythmFilters(),query:'친구랑 드라이브하고 칼국수 먹고 싶어'};
  h.flow.start(f);assert.equal(h.final.hidden,false);assert.equal(h.flow.submit(f),true);assert.equal(h.results.hidden,false);
});
test('추천 결과 전환은 짧게 나타나며 reduced-motion에서는 애니메이션하지 않는다',()=>{
  const f={...emptyRhythmFilters(),desires:['outdoor']};const h=harness(false);h.flow.start(f);
  assert.equal(h.explore.animations.length,1);h.flow.submit(f);assert.equal(h.results.animations.length,1);
  const reduced=harness(true);reduced.flow.start(f);reduced.flow.submit(f);
  assert.ok([reduced.explore,reduced.results,...reduced.steps].every(e=>e.animations.length===0));assert.equal(reduced.results.hidden,false);
});
test('집중형 UX는 상위 5곳부터 보여주고 맞춤 조건을 보조 필터로 유지한다',async()=>{
  const flowSource=await readFile(new URL('../flow.js',import.meta.url),'utf8');
  const css=await readFile(new URL('../assets/quick-flow.css',import.meta.url),'utf8');
  assert.match(flowSource,/RESULT_BATCH_SIZE = 5/);
  assert.match(flowSource,/다른 추천 더 보기/);
  assert.match(flowSource,/편안함 · 지역까지 더 정하기/);
  assert.match(css,/\.quick-refine \.choice-grid/);
  assert.match(css,/#rhythm-results #result-count\{display:none/);
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
