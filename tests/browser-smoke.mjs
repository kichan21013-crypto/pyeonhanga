/* 나가치 v16 무료 브라우저 실사 테스트.
   npm run build && npm start 후, 기존 Playwright/Chromium 설치 환경에서만 실행.
   GitHub CI의 Node 단위 테스트와 달리 운영 URL 접근을 별도 지정할 수 있습니다.
   운영 실제 분석 DB에는 테스트 데이터를 넣지 마세요. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const lib=process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright';
const {chromium}=await import(lib);
const browser=await chromium.launch({
  headless:true,
  ...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),
});
const base=(process.env.TEST_URL || 'http://localhost:4173').replace(/\/$/,'');
let passed=0;
const ok=(value,label)=>{assert.ok(value,label);passed++;};
async function chooseSurvey(page) {
  const dialog=page.locator('dialog.n13-survey-dialog');
  await dialog.locator('[name=age][value="45~49"]').check();
  await dialog.locator('[name=activity-interest][value="food"]').check();
  
  await dialog.locator('[data-n13-next]').click();
  await dialog.locator('[name=preference][value="성별 상관없음"]').check();
  await dialog.locator('[name=group_size][value="3~4명"]').check();
  await dialog.locator('.n20-optional-fee summary').click();
  await dialog.locator('[name=willingness][value="약 2만원"]').check();
  await dialog.locator('[name=consent]').check();
  await dialog.locator('[type=submit]').click();
  return dialog;
}
try {
  await mkdir('test-results',{recursive:true});
  const ctx=await browser.newContext({viewport:{width:390,height:844}});
  const page=await ctx.newPage();
  const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',request=>{
    if(request.url().includes('/rpc/record_event'))requests.push(request.url());
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('#n16-invites').waitFor();
  ok(await page.getByText('같이 맛있는 거 먹으러 갈 사람?',{exact:false}).count()>0,
    '사용자 중심 동행 질문 노출');
  for(const width of [360,390,402,760]){
    await page.setViewportSize({width,height:850});
    ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),
      width+'px 가로 넘침 없음');
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-v16-invite=eat]').click();
  await page.locator('#n16-venues .n16-venue-card').first().waitFor();
  ok(await page.locator('[data-v16-meal=seafood]').isVisible(),'식사 동행의 메뉴 필터 표시');
  await page.locator('[data-v16-meal=seafood]').click();
  await page.locator('#n16-venues .n16-venue-card').first().waitFor();
  ok(await page.locator('#n16-count').innerText().then(t=>!t.includes('불러오기 실패')),
    '실제 메뉴 선택 결과 조회');
  ok(await page.locator('.n16-venue-together').count()>0,
    '실제 장소에서 동행 희망 남기기 버튼');
  await page.screenshot({path:'test-results/nagachi-v16-invite-venues-390.png',fullPage:true});
  await page.locator('.n16-venue-together').first().click();
  await page.locator('dialog.n13-survey-dialog').waitFor();
  ok(await page.locator('[name=consent]').count()===1,'설문 필수 동의');
  ok(requests.length===0,'미연결 환경 동의 전 외부 분석 요청 없음');
  const dialog=await chooseSurvey(page);
  await dialog.locator('.n20-save-status[data-state=error]').waitFor();
  ok(await dialog.innerText().then(t=>t.includes('저장되지 않았습니다')),
    '서버 미연결 시 핵심 CTA 아래 정확한 미저장 상태 표시');
  ok(requests.length===0,'미연결 환경 동의 후에도 외부 요청 없음');
  await page.goto(base+'/companion.html',{waitUntil:'domcontentloaded'});
  await page.locator('a[href="/?together=eat"]').click();
  await page.locator('#n16-venues .n16-venue-card').first().waitFor();
  ok(await page.locator('[data-v16-invite=eat]').getAttribute('aria-pressed')==='true',
    '동행 메뉴에서 홈 활동과 실제 장소 연결');
  ok(errors.length===0,'브라우저 JavaScript 오류: '+errors.join('; '));
  await ctx.close();

  // 반드시 가짜 fixture Supabase만 사용: 실제 외부 운영 DB에 테스트 응답 금지.
  const connected=await browser.newContext({viewport:{width:390,height:844}});
  const rows=[];
  await connected.route('**/config.js',route=>route.fulfill({
    contentType:'text/javascript',
    body:"export default {supabaseUrl:'https://fixture.supabase.co',supabaseAnonKey:'sb_publishable_fixture_only'}",
  }));
  await connected.route('https://fixture.supabase.co/**',route=>{
    const req=route.request();
    if(req.method()==='OPTIONS')return route.fulfill({
      status:204,headers:{
        'access-control-allow-origin':'*',
        'access-control-allow-headers':'*',
        'access-control-allow-methods':'POST,OPTIONS',
      },
    });
    rows.push(JSON.parse(req.postData()).payload);
    return route.fulfill({
      status:204,headers:{'access-control-allow-origin':'*'},
    });
  });
  const cp=await connected.newPage();
  await cp.goto(base+'/?together=eat',{waitUntil:'domcontentloaded'});
  await cp.locator('#n16-venues .n16-venue-together').first().waitFor();
  ok(rows.length===0,'Supabase 설정 존재해도 동의 전 서버 전송 0회');
  await cp.locator('#n16-venues .n16-venue-together').first().click();
  await cp.locator('dialog.n13-survey-dialog').waitFor();
  ok(rows.length===0,'설문을 열어도 동의 전 서버 전송 0회');
  const saved=await chooseSurvey(cp);
  await saved.locator('#survey-done').waitFor();
  await cp.waitForFunction(()=>window.__nagachiSmokeDone===true,{},{timeout:300}).catch(()=>{});
  ok(rows.length===3,'동의 후에만 설문/관심/선택 3개 기록, 실제 '+rows.length);
  ok(rows[0].event_name==='premium_willingness','설문을 먼저 저장');
  ok(rows[1].event_name==='companion_interest','설문 작성자의 장소 관심만 기록');
  ok(rows[2].event_name==='activity_selected','설문 작성자의 활동만 기록');
  ok(rows.every(row=>!('query' in row.details)&&!('name' in row.details)),
    '자유입력/이름 원문 미전송');
  await connected.close();
  console.log('나가치 v16 브라우저 검증 성공: '+passed+' checks');
}finally{
  await browser.close();
}
