// 서버를 먼저 실행: npm start
// 기존 Playwright를 사용합니다. 프로젝트 의존성에 추가하지 않습니다.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), headless: true });
const base = process.env.TEST_URL || 'http://localhost:4173';
let assertions = 0;
const check = (condition, message) => { assert.ok(condition, message); assertions++; };
try {
  await mkdir('test-results', { recursive: true });
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const page = await context.newPage(); const errors = [], analyticsRequests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => { if (r.url().includes('supabase.co')) analyticsRequests.push(r); });
  await page.goto(base); await page.waitForFunction(() => document.querySelector('#result-count')?.textContent === '6');
  check(await page.locator('.place-card').count() === 6, 'home cards');
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px horizontal overflow`);
  }
  await page.setViewportSize({ width: 360, height: 800 });
  await page.evaluate(() => document.documentElement.style.fontSize = '36px');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '200% text overflow');
  await page.evaluate(() => document.documentElement.style.removeProperty('font-size'));
  await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: true });
  await page.locator('[data-category="맛집"]').click(); check(await page.locator('.place-card').count() === 2, 'category filter');
  await page.locator('#region').selectOption('서울'); check(await page.locator('.place-card').count() === 0, 'region intersection');
  await page.locator('#reset-filters').click();
  await page.locator('#search-input').fill('한정식'); await page.locator('#search-form button').click(); check(await page.locator('.place-card').count() === 1, 'text search');
  await page.locator('#reset-filters').click(); await page.locator('#more-filter').click(); await page.locator('#parking').check();
  check(await page.locator('.place-card').count() === 0, 'unknown excluded from parking');
  await page.locator('#reset-filters').click(); await page.locator('[data-companion="새로운 사람"]').click();
  check(await page.locator('#companion-help').isVisible(), 'companion explanation');
  await page.locator('[data-save="demo-table"]').click();
  check(await page.locator('#saved-count').innerText() === '1', 'save counter');
  await page.goto(base + '/saved.html'); await page.waitForSelector('.place-card');
  check(await page.locator('.place-card').count() === 1, 'saved page persistence');
  await page.locator('h3 a').click(); await page.waitForSelector('#companion-open');
  check(await page.locator('.score-panel h2').innerText() === '정보 더 필요', 'no invented score');
  check(await page.locator('[data-save]').getAttribute('aria-pressed') === 'true', 'detail saved state');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });
  await page.locator('#share-place').click(); await page.waitForSelector('#share-link');
  check((await page.locator('#share-link').inputValue()).endsWith('/places/demo-table/'), 'manual link fallback');
  await page.locator('#copy-done').click();
  await page.locator('#companion-open').click(); await page.keyboard.press('Escape');
  check(await page.locator('#companion-open').evaluate(el => document.activeElement === el), 'dialog returns keyboard focus');
  async function answerSurvey(target) {
    await target.locator('#companion-open').click();
    await target.locator('[name=age]').selectOption('60~64');
    await target.locator('[name=preference]').selectOption('성별 상관없음');
    await target.locator('[name=purpose]').selectOption('식사동행');
    await target.locator('[name=group_size]').selectOption('3~4명');
    await target.locator('[name=willingness][value="약 2만원"]').check();
  }
  await answerSurvey(page); await page.locator('.survey [type=submit]').click();
  check(await page.getByText('현재 분석 연결이 없어 응답은 저장되지 않았습니다.', { exact: false }).isVisible(), 'unconfigured survey honest state');
  await page.locator('#survey-done').click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: 'test-results/detail-desktop.png', fullPage: true });
  await page.goto(base); await page.waitForSelector('#result-count');
  await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true });
  check(analyticsRequests.length === 0, 'unconfigured analytics sends nothing');
  const missing = await page.goto(base + '/does-not-exist/'); check(missing.status() === 404, 'real 404');
  // 404의 브라우저 네트워크 오류는 예상한 것이므로 그 이전 오류만 검사합니다.
  check(errors.filter(e => !e.includes('404')).length === 0, `console errors: ${errors.join('; ')}`);
  await context.close();

  const blocked = await browser.newContext();
  await blocked.addInitScript(() => { Storage.prototype.getItem = () => { throw new Error('blocked'); }; Storage.prototype.setItem = () => { throw new Error('blocked'); }; });
  const blockedPage = await blocked.newPage(); const blockedErrors = [];
  blockedPage.on('pageerror', e => blockedErrors.push(e.message));
  await blockedPage.goto(base); await blockedPage.waitForSelector('.place-card'); await blockedPage.locator('[data-save]').first().click();
  check(await blockedPage.locator('#toast').innerText().then(s => s.includes('저장 공간')), 'storage denied feedback');
  check(blockedErrors.length === 0, 'storage denied no crash'); await blocked.close();

  // 실제 외부 서비스에 연결하지 않는 브라우저 수준 모의 서버입니다.
  const connected = await browser.newContext(); const rows = [], connectedErrors = [];
  await connected.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "export default {supabaseUrl:'https://fixture.supabase.co',supabaseAnonKey:'fixture-public-key'}" }));
  await connected.route('https://fixture.supabase.co/**', async r => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    rows.push(r.request().postDataJSON().payload);
    await r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
  });
  await connected.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: async data => { window.nativeShareData = data; }, configurable: true });
  });
  const c = await connected.newPage(); c.on('pageerror', e => connectedErrors.push(e.message));
  await c.goto(base); await c.waitForSelector('#result-count');
  await c.locator('#search-input').fill('한정식'); await c.locator('#search-form button').click();
  await c.locator('#reset-filters').click();
  await c.goto(base + '/places/demo-table/'); await c.waitForSelector('#companion-open');
  await c.locator('[data-save]').click(); await c.locator('#share-place').click();
  check((await c.evaluate(() => window.nativeShareData.url)).endsWith('/places/demo-table/'), 'native share invoked');
  await answerSurvey(c); await c.locator('.survey [type=submit]').click(); await c.waitForSelector('#survey-done');
  for (const event of ['page_view','search','filter_used','place_view','save_place','share_place','companion_interest','premium_willingness']) check(rows.some(row => row.event_name === event), `analytics ${event}`);
  const premium = rows.find(row => row.event_name === 'premium_willingness');
  check(premium.details.willingness === '약 2만원' && premium.is_demo, 'survey and demo metadata');
  check(rows.every(row => !JSON.stringify(row).includes('query') && !JSON.stringify(row).includes('fixture-public-key')), 'no raw search or credentials in payload');
  check(connectedErrors.length === 0, 'configured analytics no browser crash');
  await c.locator('#survey-done').click();
  await connected.route('https://fixture.supabase.co/**', async r => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    return r.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' } });
  });
  await answerSurvey(c); await c.locator('.survey [type=submit]').click();
  await c.waitForFunction(() => document.querySelector('.survey-status')?.textContent.includes('전송하지 못했어요'));
  check(await c.locator('.survey [type=submit]').isEnabled(), 'failed survey supports retry without false success');
  await connected.close();
  console.log(`브라우저 smoke test 통과: ${assertions}개 검사. 모바일/PC·큰 글씨·검색·저장·공유·설문·분석 모의 연결·실패 처리를 확인했습니다.`);
} finally { await browser.close(); }
