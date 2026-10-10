#!/usr/bin/env node
const { chromium } = (() => {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE_DIR,
    'D:/project/node-win-x64/node_cache/_npx/0b9ff77863cb6e9f/node_modules',
    'D:/project/node-win-x64/node_cache/_npx',
  ].filter(Boolean);
  for (const d of candidates) {
    try { return { chromium: require(require.resolve('playwright', { paths: [d] })).chromium }; } catch (e) {}
    try { return { chromium: require(d + '/playwright').chromium }; } catch (e) {}
  }
  return require('playwright');
})();

const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH ||
  'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1208\\chrome-headless-shell-win64\\chrome-headless-shell.exe';
const BASIC = Buffer.from('sword:sword_secret').toString('base64');
const BASE = 'http://localhost:8000';
const DEFID = '2100918142244032513';
const NODE = 'Activity_16wyet2';
const H = (tk) => ({ 'blade-auth': 'bearer ' + tk, 'authorization': 'Basic ' + BASIC, 'tenant-id': '000000', 'Content-Type': 'application/json' });

(async () => {
  const browser = await (async () => {
    try { return await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] }); }
    catch (e) { return await chromium.launch({ headless: true, args: ['--no-sandbox'] }); }
  })();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('response', async (r) => {
    const u = r.url();
    if (u.includes('/api/') || u.includes('/user/login')) {
      console.log('HTTP ' + r.status() + ' ' + u.replace(BASE, ''));
    }
  });

  await page.goto(BASE + '/user/login', { waitUntil: 'load', timeout: 60000 });
  await page.waitForSelector('input#account', { timeout: 45000 });
  const hasCaptcha = await page.$('input[placeholder="请输入验证码"]');
  console.log('HAS_CAPTCHA=' + !!hasCaptcha);
  await page.fill('input#tenantId', '000000');
  await page.fill('input#account', 'admin');
  await page.fill('input#password', 'ant.design');
  if (hasCaptcha) await page.fill('input[placeholder="请输入验证码"]', '1234');

  // 拦截登录 POST 响应
  const loginResp = await page.waitForResponse((r) => r.url().includes('/user/login') || r.url().includes('/oauth') || r.url().includes('/token'), { timeout: 20000 }).catch(() => null);
  await page.click('button[type="submit"]');
  const resp = loginResp || await page.waitForResponse((r) => r.url().includes('/user/login'), { timeout: 20000 }).catch(() => null);
  if (resp) {
    const txt = await resp.text().catch(() => '');
    console.log('LOGIN_RESP ' + resp.status() + ' body=' + txt.slice(0, 400));
  } else {
    console.log('LOGIN_RESP none');
  }
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => ({ url: location.href, keys: Object.keys(localStorage), token: localStorage.getItem('sword-token') }));
  console.log('AFTER=' + JSON.stringify(after));
  const errText = await page.evaluate(() => (document.querySelector('.ant-alert-error, .ant-form-item-explain-error') || {}).textContent || '').catch(() => '');
  console.log('ERR_TEXT=' + errText);

  if (!after.token) { console.log('LOGIN_FAILED'); await browser.close(); return; }

  const token = after.token;
  const g = (url) => page.evaluate(async (u, h) => {
    const r = await fetch(u, { headers: h });
    const t = await r.text();
    try { return { status: r.status, body: JSON.parse(t) }; } catch (e) { return { status: r.status, body: t.slice(0, 500) }; }
  }, url, H(token));

  const dfBefore = await g(`${BASE}/api/blade-workflow/definition/${DEFID}/node/${NODE}/detail-filter`);
  const toBefore = await g(`${BASE}/api/blade-workflow/node-timeout/list?defId=${DEFID}&nodeKey=${NODE}`);
  console.log('DETAIL_FILTER_BEFORE=' + JSON.stringify(dfBefore));
  console.log('TIMEOUT_BEFORE=' + JSON.stringify(toBefore));

  const bf = await g(`${BASE}/api/blade-workflow/migration/backfill?defId=${DEFID}&force=true`);
  console.log('BACKFILL=' + JSON.stringify(bf));
  await page.waitForTimeout(2500);

  const dfAfter = await g(`${BASE}/api/blade-workflow/definition/${DEFID}/node/${NODE}/detail-filter`);
  const toAfter = await g(`${BASE}/api/blade-workflow/node-timeout/list?defId=${DEFID}&nodeKey=${NODE}`);
  console.log('DETAIL_FILTER_AFTER=' + JSON.stringify(dfAfter));
  console.log('TIMEOUT_AFTER=' + JSON.stringify(toAfter));

  await browser.close();
})().catch((e) => { console.error('FATAL: ' + e.message); process.exit(1); });
