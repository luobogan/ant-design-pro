#!/usr/bin/env node
/* 抓取当前登录会话的验证码图片 + key 落盘，供人工读码后回填。 */
const { chromium } = (() => {
  const candidates = ['D:/project/node-win-x64/node_cache/_npx/0b9ff77863cb6e9f/node_modules','D:/project/node-win-x64/node_cache/_npx'];
  for (const d of candidates) {
    try { return { chromium: require(require.resolve('playwright', { paths: [d] })).chromium }; } catch (e) {}
  }
  return require('playwright');
})();
const CHROMIUM_PATH = 'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1208\\chrome-headless-shell-win64\\chrome-headless-shell.exe';
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] });
  const page = await (await browser.newContext()).newPage();
  let cap = null;
  page.on('response', async (r) => {
    if (r.url().includes('/api/blade-auth/captcha')) {
      const j = await r.json().catch(() => null);
      if (j && j.data && j.data.image) cap = j.data;
    }
  });
  await page.goto('http://localhost:8000/user/login', { waitUntil: 'load', timeout: 60000 });
  await page.waitForSelector('input#account', { timeout: 45000 });
  await page.waitForTimeout(1500);
  if (!cap) { console.log('NO_CAPTCHA_CAPTURED'); await browser.close(); return; }
  const b64 = cap.image.replace(/^data:image\/\w+;base64,/, '');
  fs.writeFileSync('C:\\Users\\Administrator\\captcha.png', Buffer.from(b64, 'base64'));
  console.log('KEY=' + cap.key);
  await browser.close();
})().catch((e) => { console.error('FATAL: ' + e.message); process.exit(1); });
