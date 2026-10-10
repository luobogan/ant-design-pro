#!/usr/bin/env node
/** 直接调 workflow start 接口，观察指定 procKey 的真实返回：node probe_start.cjs <procKey> */
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
const procKey = process.argv[2] || 'nonexistent_key_xyz';
const billInitiated = process.argv[3] !== 'false';

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
    const r = await fetch('http://localhost:8000/api/blade-workflow/instance/start', {
      method: 'POST',
      headers: {
        'blade-auth': 'bearer ' + a.tk, 'authorization': 'Basic ' + a.basic,
        'tenant-id': '000000', 'Content-Type': 'application/json',
      },
      body: JSON.stringify({ procKey: a.key, tenantId: '000000', formId: 2064530495200337922, billInitiated: a.bill }),
    });
    return { status: r.status, text: await r.text() };
  }, { key: procKey, bill: billInitiated, tk: token, basic: BASIC });
  console.log('STATUS=' + resp.status);
  console.log('RESP=' + resp.text.slice(0, 400));
  await browser.close();
})().catch((e) => { console.error('FATAL: ' + e.message); process.exit(1); });
