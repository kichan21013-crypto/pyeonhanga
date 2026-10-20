import test from 'node:test';
import assert from 'node:assert/strict';
import { toggleSavedPlace, shareOrCopy, SURVEY_CHOICES } from '../actions.js';
import { savedIds } from '../storage.js';
test('기존 저장 키·장소 ID를 유지하고 저장/해제·공간 차단을 처리한다', () => {
  const previous=globalThis.localStorage;const values=new Map();
  try {
    globalThis.localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
    assert.deepEqual(toggleSavedPlace('demo-table'),{ok:true,removing:false});assert.deepEqual(savedIds(),['demo-table']);
    assert.ok(values.has('pyeonhanga.saved'));assert.deepEqual(toggleSavedPlace('demo-table'),{ok:true,removing:true});assert.deepEqual(savedIds(),[]);
    globalThis.localStorage.setItem=()=>{throw new Error('blocked')};assert.equal(toggleSavedPlace('demo-table').ok,false);
  } finally {globalThis.localStorage=previous;}
});
test('공유는 native→클립보드→수동 복사를 지원하고 취소는 공유로 세지 않는다', async () => {
  const data={title:'DEMO SAMPLE · 내리듬',url:'https://example.org/places/demo-table/'};let received;
  assert.equal(await shareOrCopy(data,{share:async value=>{received=value}}),'shared');assert.equal(received.url,data.url);
  assert.equal(await shareOrCopy(data,{clipboard:{writeText:async value=>{received=value}}}),'copied');assert.equal(received,data.url);
  assert.equal(await shareOrCopy(data,{share:async()=>{throw new Error('unavailable')},clipboard:{writeText:async()=>{}}}),'copied');
  assert.equal(await shareOrCopy(data,{clipboard:{writeText:async()=>{throw new Error('denied')}}}),'manual');
  assert.equal(await shareOrCopy(data,{}),'manual');
  assert.equal(await shareOrCopy(data,{share:async()=>{throw Object.assign(new Error('cancel'),{name:'AbortError'})}}),'cancelled');
});
test('동행 설문의 연령·동행 형태·목적·인원·서비스비 응답을 유지한다', () => {
  assert.deepEqual(SURVEY_CHOICES.willingness,['무료면 참여','약 1만원','약 2만원','약 3만원 이상','아직 모르겠음']);
  assert.equal(SURVEY_CHOICES.age.length,5);assert.equal(SURVEY_CHOICES.preference.length,4);assert.equal(SURVEY_CHOICES.purpose.length,5);assert.equal(SURVEY_CHOICES.group_size.length,4);
  assert.deepEqual(Object.keys(SURVEY_CHOICES),['age','preference','purpose','group_size','willingness']);
});
