import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const source=new URL('./browser-smoke.mjs',import.meta.url);
test('선택형 모바일 브라우저 스모크 스크립트는 Node 문법 검사에 통과한다',()=>{
  const parsed=spawnSync(process.execPath,['--check',fileURLToPath(source)],{encoding:'utf8'});
  assert.equal(parsed.status,0,parsed.stderr);
});
test('스모크는 v16 동행 흐름과 동의 전 네트워크 기록 0건을 점검한다',async()=>{
  const s=await readFile(source,'utf8');
  assert.match(s,/#n16-invites/);
  assert.match(s,/\[data-v16-invite=eat\]/);
  assert.match(s,/#n16-venues \.n16-venue-card/);
  assert.match(s,/\[data-v16-meal=seafood\]/);
  assert.match(s,/dialog\.n13-survey-dialog/);
  assert.match(s,/rows.length===0/);
  assert.match(s,/rows.length===3/);
  assert.match(s,/premium_willingness/);
  assert.match(s,/성공/);
});
test('서버 분석 전송은 설문 동의를 받은 내부 API에서만 허용한다',async()=>{
  const a=await readFile(new URL('../analytics.js',import.meta.url),'utf8');
  const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
  const privacy=await readFile(new URL('../scripts/build-core.js',import.meta.url),'utf8');
  assert.match(a,/export async function track\(event, values = \{\}\) \{\s*return false;/);
  assert.match(a,/export async function recordConsentedSurvey/);
  assert.match(a,/await sendConsentedEvent\('premium_willingness'/);
  assert.match(app,/form\.elements\.consent\.checked/);
  assert.match(app,/if \(!responseId\) responseId=anonymousId\(\)/);
  assert.match(app,/await recordConsentedSurvey/);
  assert.match(privacy,/동의 전 서버로 전송하지 않습니다/);
});
