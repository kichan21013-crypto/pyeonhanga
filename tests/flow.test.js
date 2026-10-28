import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createProgressiveFlow } from '../flow.js';
import { emptyRhythmFilters, toggleSelection, activeActivities, recommendRhythms } from '../rhythm.js';

function harness(reducedMotion = true) {
  const make = (hidden = true) => ({ hidden, open:false, disabled:false, dataset:{}, animations:[], animate(frames,options){this.animations.push({frames,options});} });
  const explore=make(), results=make(), steps=[make(false),make(),make()], final=make(), next=[make(),make()];
  next[0].dataset.nextStep='2'; next[1].dataset.nextStep='3';
  const root={querySelector:key=>({'#explore':explore,'#rhythm-results':results,'#recommend-button':final})[key],querySelectorAll:key=>key==='[data-flow-step]'?steps:next};
  return { flow:createProgressiveFlow(root,{reducedMotion:()=>reducedMotion}),explore,results,steps,final,next };
}

test('시작하면 첫 선택 화면만 보이고 조건 화면은 숨긴다',()=>{
  const h=harness(), f=emptyRhythmFilters(); h.flow.update(f); assert.equal(h.explore.hidden,true);
  h.flow.start(f); assert.equal(h.explore.hidden,false); assert.equal(h.steps[0].hidden,false); assert.equal(h.steps[1].hidden,true);
  assert.equal(h.results.hidden,true); assert.equal(h.next[0].hidden,true);
});

test('욕구 하나를 고르면 다음 버튼이 열리고 조건 화면으로 이동한다',()=>{
  const h=harness(), f=emptyRhythmFilters(); h.flow.start(f);
  f.desires=toggleSelection(f.desires,'move'); h.flow.update(f);
  assert.equal(h.next[0].hidden,false); assert.equal(h.flow.activate(2),true);
  assert.equal(h.steps[0].hidden,true); assert.equal(h.steps[1].hidden,false);
});

test('조건은 모두 선택 사항이며 2단계에서 바로 추천할 수 있다',()=>{
  const h=harness(), f={...emptyRhythmFilters(),desires:['eat']}; h.flow.start(f); h.flow.activate(2);
  assert.equal(h.final.hidden,false); assert.equal(h.flow.submit(f),true); assert.equal(h.results.hidden,false);
});

test('2단계에서 조건을 바꿔도 첫 화면으로 튕기지 않는다',()=>{
  const h=harness(), f={...emptyRhythmFilters(),desires:['eat']}; h.flow.start(f); h.flow.activate(2);
  f.companions=['solo']; h.flow.update(f);
  assert.equal(h.steps[0].hidden,true); assert.equal(h.steps[1].hidden,false); assert.equal(h.results.hidden,true);
});

test('핵심 욕구를 지우면 자동으로 1단계로 돌아간다',()=>{
  const h=harness(), f={...emptyRhythmFilters(),desires:['move']}; h.flow.start(f); h.flow.activate(2);
  f.desires=[]; h.flow.update(f);
  assert.equal(h.steps[0].hidden,false); assert.equal(h.steps[1].hidden,true); assert.equal(h.flow.submit(f),false);
});

test('자연어만 입력해도 2단계로 이동할 수 있다',()=>{
  const h=harness(), f={...emptyRhythmFilters(),query:'친구랑 드라이브하고 칼국수 먹고 싶어'};
  h.flow.start(f); h.flow.update(f); assert.equal(h.next[0].hidden,false); assert.equal(h.flow.activate(2),true);
});

test('세부 활동은 욕구 선택을 유지하며 추천 로직과 함께 동작한다',()=>{
  const f=emptyRhythmFilters(); f.desires=toggleSelection(f.desires,'move'); f.desires=toggleSelection(f.desires,'eat'); f.activities=['walk','noodle'];
  assert.deepEqual(activeActivities(f.desires,f.activities),['walk','noodle']);
});

test('reduced-motion에서는 단계 전환 애니메이션을 사용하지 않는다',()=>{
  const f={...emptyRhythmFilters(),desires:['outdoor']}; const h=harness(true); h.flow.start(f); h.flow.activate(2); h.flow.submit(f);
  assert.ok([h.explore,h.results,...h.steps].every(e=>e.animations.length===0));
});

test('생성 홈에는 기존 단계 DOM과 결과 영역이 있고 추천 데이터도 유효하다',async()=>{
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  assert.match(html,/<section id="explore"[^>]* hidden>/); assert.match(html,/id="flow-step-1"[^>]* open>/);
  assert.match(html,/id="flow-step-2"[^>]* hidden>/); assert.match(html,/id="rhythm-results" hidden/);
  assert.match(html,/class="nav-home" href="\/"/); assert.match(html,/mobile-ux\.css/);
  const places=JSON.parse(await readFile(new URL('../data/places.json',import.meta.url)));
  const results=recommendRhythms(places); assert.ok(results.length>0); assert.ok(results.length<=places.length);
});
