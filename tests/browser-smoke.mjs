// npm start 후 실행. 기존 설치된 Playwright를 사용하며 배포 의존성이 아닙니다.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath:process.env.CHROMIUM_PATH } : {}), headless:true });
const base=process.env.TEST_URL || 'http://localhost:4173';
let count=0;
const check=(value,message)=>{assert.ok(value,message);count++;};
async function answer(page) {
  await page.locator('[name=age]').selectOption('60~64');await page.locator('[name=preference]').selectOption('성별 상관없음');
  await page.locator('[name=purpose]').selectOption('식사동행');await page.locator('[name=group_size]').selectOption('3~4명');
  await page.locator('[name=willingness][value="약 2만원"]').check();await page.locator('.survey [type=submit]').click();
}
try {
  await mkdir('test-results',{recursive:true});
  const context=await browser.newContext({viewport:{width:390,height:844}}), page=await context.newPage(), errors=[],network=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(r.url().includes('supabase.co'))network.push(r.url());});
  await page.goto(base);await page.waitForFunction(()=>document.querySelector('#result-count')?.textContent==='6');
  check(await page.title().then(s=>s.includes('나가치')),'brand');
  check(await page.locator('[data-transport]').count()===3,'three transport options');
  check(await page.locator('[data-transport=nearby]').count()===0,'nearby removed');
  check(await page.locator('header a[href="/saved.html"]').innerText().then(s=>s.includes('저장한 곳')),'place save label');
  for(const width of [360,390,402,800,1280]){
    await page.setViewportSize({width,height:900});
    for(const size of ['18px','36px']){
      await page.evaluate(size=>document.documentElement.style.fontSize=size,size);
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px ${size} overflow`);
    }
  }
  await page.evaluate(()=>document.documentElement.style.removeProperty('font-size'));await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'test-results/naerhythm-mobile.png',fullPage:true});
  check(await page.locator('#activity-options').isHidden(),'details initially hidden');
  await page.locator('#rhythm-start').click();
  await page.locator('[data-companion=solo]').click();await page.locator('[data-companion=friend]').click();
  check(await page.locator('[data-companion][aria-pressed=true]').count()===2,'multi companion');
  check(await page.locator('#companion-summary').innerText().then(s=>s.includes('혼자')&&s.includes('친구')),'companion summary');
  await page.locator('[data-desire=move]').click();check(await page.locator('[data-activity=run]').isVisible(),'running disclosed under movement');
  await page.locator('[data-desire=eat]').click();await page.locator('[data-activity=walk]').click();
  check(await page.locator('[data-desire][aria-pressed=true]').count()===2,'multi desire');
  check(await page.locator('.place-card').count()>0,'OR recommendations');
  await page.locator('[data-duration=short]').click();await page.locator('[data-transport=car]').click();
  check(await page.locator('.place-card').count()>0,'unknown time/transport remains');
  await page.locator('#reset-filters').click();
  await page.locator('#search-input').fill('혼자 10km 정도 뛰고 맛있는 거 먹고 싶어');await page.locator('[data-companion=solo]').click();
  check(await page.locator('#search-input').inputValue().then(s=>s.includes('10km')),'draft kept');
  await page.locator('#recommend-button').click();check(await page.locator('.place-card').count()>0,'compound natural language');
  check(!(await page.locator('#places-grid').innerText()).includes('10km'),'no fabricated distance');
  await page.locator('#reset-filters').click();await page.locator('#comfort-options summary').click();await page.locator('[data-comfort=parking]').click();
  check(await page.locator('.place-card').count()===6,'unknown comfort retained');
  await page.locator('.save-icon[data-save="demo-table"]').click();check(await page.locator('#saved-count').innerText()==='1','save counter');
  await page.goto(base+'/saved.html');await page.waitForSelector('.place-card');check(await page.locator('.place-card').count()===1,'saved persistence');
  await page.locator('h3 a').click();await page.waitForSelector('#companion-open');check(await page.locator('.score-panel h2').innerText()==='정보 더 필요','unknown score');
  await page.evaluate(()=>{Object.defineProperty(navigator,'share',{value:undefined,configurable:true});Object.defineProperty(navigator,'clipboard',{value:undefined,configurable:true});});
  await page.locator('#share-place').click();check(await page.locator('#share-link').inputValue().then(s=>s.endsWith('/places/demo-table/')),'share fallback');await page.locator('#copy-done').click();
  await page.locator('#companion-open').click();await page.keyboard.press('Escape');check(await page.locator('#companion-open').evaluate(el=>el===document.activeElement),'dialog focus');
  await page.locator('#companion-open').click();await answer(page);await page.waitForSelector('#survey-done');
  check(await page.getByText('현재 분석 연결이 없어 응답은 저장되지 않았습니다.',{exact:false}).isVisible(),'unconfigured honest survey');await page.locator('#survey-done').click();
  check(network.length===0,'no analytics without config');check(errors.length===0,errors.join(';'));
  await context.close();
  const connected=await browser.newContext(),rows=[];
  await connected.route('**/config.js',r=>r.fulfill({contentType:'text/javascript',body:"export default {supabaseUrl:'https://fixture.supabase.co',supabaseAnonKey:'sb_publishable_fixture'}"}));
  await connected.route('https://fixture.supabase.co/**',async r=>{
    if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}});
    rows.push(r.request().postDataJSON().payload);await r.fulfill({status:204,headers:{'access-control-allow-origin':'*'}});
  });
  await connected.addInitScript(()=>{window.logicalEvents=[];document.addEventListener('naerhythm:analytics',e=>window.logicalEvents.push(e.detail.name));Object.defineProperty(navigator,'share',{value:async data=>{window.sharedData=data;},configurable:true});});
  const c=await connected.newPage();await c.goto(base);await c.waitForFunction(()=>document.querySelector('#result-count')?.textContent==='6');
  await c.locator('#rhythm-start').click();await c.locator('[data-companion=solo]').click();await c.locator('[data-desire=move]').click();await c.locator('[data-activity=walk]').click();await c.locator('[data-duration=short]').click();await c.locator('#recommend-button').click();
  await c.locator('.save-icon').first().click();await c.locator('[data-share]').first().click();check(await c.evaluate(()=>Boolean(window.sharedData.url)&&window.sharedData.title.endsWith('— 나가치')),'native share');
  await c.locator('[data-companion-interest]').first().click();await answer(c);await c.waitForSelector('#survey-done');
  const logical=await c.evaluate(()=>window.logicalEvents);
  for(const event of ['rhythm_start','companion_selected','desire_selected','activity_selected','condition_selected','recommendation_view','rhythm_save','rhythm_share','companion_interest','premium_willingness'])check(logical.includes(event),event);
  const premium=rows.find(row=>row.event_name==='premium_willingness');check(premium?.details.willingness==='약 2만원'&&premium.is_demo,'survey recorded as demo');
  await c.locator('#survey-done').click();
  await connected.route('https://fixture.supabase.co/**',r=>r.fulfill({status:503,headers:{'access-control-allow-origin':'*'}}));
  await c.locator('[data-companion-interest]').first().click();await answer(c);await c.waitForFunction(()=>document.querySelector('.survey-status')?.textContent.includes('전송하지 못했어요'));check(await c.locator('.survey [type=submit]').isEnabled(),'survey retry');
  await connected.close();console.log(`브라우저 smoke test ${count}개 검사 통과`);
} finally {await browser.close();}
