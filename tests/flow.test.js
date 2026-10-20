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
test('시작 전 질문/결과는 숨기고 CTA로 시작하면 1단계만 열린다',()=>{
  const h=harness(),f=emptyRhythmFilters();h.flow.update(f);assert.equal(h.explore.hidden,true);
  h.flow.start(f);assert.equal(h.explore.hidden,false);assert.deepEqual(h.steps.map(e=>e.hidden),[false,true,true]);
  assert.equal(h.steps[0].open,true);assert.equal(h.results.hidden,true);assert.equal(h.final.disabled,true);
});
test('욕구 하나 이상 선택하면 2단계가 나타나며 세부활동·다중욕구를 계속 고를 수 있다',()=>{
  const h=harness(),f=emptyRhythmFilters();h.flow.start(f);
  f.desires=toggleSelection(f.desires,'move');h.flow.update(f);assert.equal(h.steps[1].hidden,false);assert.equal(h.steps[1].open,true);assert.equal(h.steps[2].hidden,true);
  f.desires=toggleSelection(f.desires,'eat');f.activities=['walk','noodle'];h.flow.update(f);
  assert.deepEqual(f.desires,['move','eat']);assert.deepEqual(activeActivities(f.desires,f.activities),['walk','noodle']);assert.equal(h.results.hidden,true);
});
test('동행 선택 후 3단계가 열리고 마지막 CTA 전에는 결과를 표시하지 않는다',()=>{
  const h=harness(),f={...emptyRhythmFilters(),desires:['eat']};h.flow.start(f);
  f.companions=toggleSelection(f.companions,'solo');h.flow.update(f);assert.equal(h.steps[2].hidden,false);assert.equal(h.final.disabled,false);
  h.flow.activate(2);assert.equal(h.steps[0].open,false);assert.equal(h.steps[1].open,true);
  f.companions=toggleSelection(f.companions,'friend');h.flow.update(f);assert.deepEqual(f.companions,['solo','friend']);
  f.duration='short';f.transport='car';h.flow.update(f);assert.equal(h.results.hidden,true);
  assert.equal(h.flow.submit(f),true);assert.equal(h.results.hidden,false);
});
test('선택 수정과 초기화는 결과를 다시 숨기고 단계 전제조건을 재검사한다',()=>{
  const h=harness(),f={...emptyRhythmFilters(),desires:['move'],companions:['family']};h.flow.start(f);h.flow.submit(f);
  f.companions=[];h.flow.update(f);assert.equal(h.results.hidden,true);assert.equal(h.steps[2].hidden,true);assert.equal(h.flow.submit(f),false);
  f.desires=[];h.flow.update(f);assert.equal(h.steps[1].hidden,true);assert.equal(h.flow.activate(3),false);
  h.flow.update(emptyRhythmFilters());h.flow.activate(1);assert.equal(h.steps[0].open,true);assert.equal(h.results.hidden,true);
});
test('자연어도 1단계 입력으로 사용할 수 있지만 동행과 최종 CTA를 건너뛰지는 못한다',()=>{
  const h=harness(),f={...emptyRhythmFilters(),query:'친구랑 드라이브하고 칼국수 먹고 싶어'};
  h.flow.start(f);assert.equal(h.steps[1].hidden,false);assert.equal(h.flow.submit(f),false);
  f.companions=['friend'];h.flow.update(f);assert.equal(h.results.hidden,true);
  assert.equal(h.flow.submit(f),true);assert.equal(h.results.hidden,false);
});
test('새 영역은 한 번만 짧게 나타나며 reduced-motion에서는 애니메이션하지 않는다',()=>{
  const f={...emptyRhythmFilters(),desires:['outdoor']};const h=harness(false);h.flow.start(f);
  assert.equal(h.explore.animations.length,1);assert.equal(h.steps[1].animations.length,1);h.flow.update(f);assert.equal(h.steps[1].animations.length,1);
  const reduced=harness(true);reduced.flow.start(f);f.companions=['solo'];reduced.flow.update(f);reduced.flow.submit(f);
  assert.ok([reduced.explore,reduced.results,...reduced.steps].every(e=>e.animations.length===0));assert.equal(reduced.results.hidden,false);
});
test('생성 홈에는 단계·진행 표시·숨긴 결과와 자체 Hero SVG가 있고 추천 정렬은 유지한다',async()=>{
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  assert.match(html,/<section id="explore"[^>]* hidden>/);assert.match(html,/id="flow-step-1"[^>]* open>/);
  assert.match(html,/id="flow-step-2"[^>]* hidden>/);assert.match(html,/id="flow-step-3"[^>]* hidden>/);
  assert.match(html,/id="rhythm-results" hidden/);assert.match(html,/오늘의 리듬 보기/);assert.match(html,/나에게 중요한 조건 더하기/);
  for(const n of [1,2,3])assert.ok(html.includes(`${n} / 3`));
  assert.match(html,/id="day-paths-title">오늘 하루의 여러 갈림길/);assert.match(html,/role="img" aria-labelledby="day-paths-title day-paths-desc"/);
  const places=JSON.parse(await readFile(new URL('../data/places.json',import.meta.url)));assert.equal(recommendRhythms(places).length,6);
});
