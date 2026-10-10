#!/usr/bin/env node
/** 撤销（作废）一个流程实例：node cancel_instance.cjs <instanceId> */
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
const instId = process.argv[2];
if (!instId) { console.error('usage: node cancel_instance.cjs <instanceId>'); process.exit(1); }

(async () => {
  const browser = await (async () => {
    try { return await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] }); }
    catch (e) { return await chromium.launch({ headless: true, args: ['--no-sandbox'] }); }
  })();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + '/user/login', { waitUntil: 'load', timeout: 60000 });
  await page.waitForSelector('input#account', { timeout: 45000 });
  await page.fill('input#tenantId', '000000');
  await page.fill('input#account', 'admin');
  await page.fill('input#password', 'ant.design');
  const cap = await page.$('input[placeholder="请输入验证码"]');
  if (cap) await page.fill('input[placeholder="请输入验证码"]', '1234');
  await page.waitForTimeout(800);
  await page.click('button[type="submit"]');
  try {
    await page.waitForFunction(() => !!localStorage.getItem('sword-token'), null, { timeout: 15000 });
  } catch (e) {
    // 重试一次登录
    await page.goto(BASE + '/user/login', { waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector('input#account', { timeout: 45000 });
    await page.fill('input#tenantId', '000000');
    await page.fill('input#account', 'admin');
    await page.fill('input#password', 'ant.design');
    const cap2 = await page.$('input[placeholder="请输入验证码"]');
    if (cap2) await page.fill('input[placeholder="请输入验证码"]', '1234');
    await page.waitForTimeout(800);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => !!localStorage.getItem('sword-token'), null, { timeout: 30000 });
  }
  const token = await page.evaluate(() => localStorage.getItem('sword-token'));
  await page.waitForTimeout(2000);
  const resp = await page.evaluate(async (a) => {
    const r = await fetch('http://localhost:8000/api/blade-workflow/instance/' + a.id + '/cancel', {
      method: 'POST', headers: {
        'blade-auth': 'bearer ' + a.tk, 'authorization': 'Basic ' + a.basic, 'tenant-id': '000000',
      },
    });
    return { status: r.status, text: await r.text() };
  }, { id: instId, tk: token, basic: BASIC });
  console.log('CANCEL_STATUS=' + resp.status);
  console.log('CANCEL_RESP=' + resp.text.slice(0, 300));
  await browser.close();
})().catch((e) => { console.error('FATAL: ' + e.message); process.exit(1); });
