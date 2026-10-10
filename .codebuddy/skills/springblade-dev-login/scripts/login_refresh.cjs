#!/usr/bin/env node
/** 刷新 dev token：验证码登录（异步等待外部把识别结果写入 captcha_code_refresh.txt） */
const fs = require('fs');
const BASE = 'http://localhost:8000';
const IMG = 'C:\\Users\\Administrator\\captcha_refresh.png';
const CODEF = 'C:\\Users\\Administrator\\captcha_code_refresh.txt';
const TF = 'C:\\Users\\Administrator\\sword_token.txt';
try { fs.unlinkSync(CODEF); } catch (e) {}
try { fs.unlinkSync(IMG); } catch (e) {}
const log = (s) => console.log(typeof s === 'string' ? s : JSON.stringify(s));
(async () => {
  const { chromium } = (() => {
    const c = ['D:/project/node-win-x64/node_cache/_npx/0b9ff77863cb6e9f/node_modules', 'D:/project/node-win-x64/node_cache/_npx'];
    for (const d of c) { try { return { chromium: require(require.resolve('playwright', { paths: [d] })).chromium }; } catch (e) {} }
    return require('playwright');
  })();
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1208\\chrome-headless-shell-win64\\chrome-headless-shell.exe', args: ['--no-sandbox'] });
  const page = await (await browser.newContext()).newPage();
  let cap = null;
  page.on('response', async (r) => { if (r.url().includes('/api/blade-auth/captcha')) { const j = await r.json().catch(() => null); if (j && j.data && j.data.image) cap = j.data; } });
  await page.goto(BASE + '/user/login', { waitUntil: 'load', timeout: 60000 });
  await page.waitForSelector('input#account', { timeout: 45000 });
  await page.waitForTimeout(1500);
  const hasCap = !!(await page.$('input[placeholder="请输入验证码"]'));
  if (cap) fs.writeFileSync(IMG, Buffer.from(cap.image.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
  log('CAPTCHA hasField=' + hasCap + ' img=' + IMG);
  let code = '';
  for (let i = 0; i < 180; i++) { if (fs.existsSync(CODEF)) { const c = fs.readFileSync(CODEF, 'utf8').trim(); if (c) { code = c; break; } } await page.waitForTimeout(1000); }
  log('CODE=' + code);
  if (hasCap && !code) { log('NO_CODE'); await browser.close(); return; }
  await page.fill('input#tenantId', '000000');
  await page.fill('input#account', 'admin');
  await page.fill('input#password', 'ant.design');
  if (hasCap) await page.fill('input[placeholder="请输入验证码"]', code);
  await page.click('button[type="submit"]');
  const ok = await page.waitForFunction(() => !!localStorage.getItem('sword-token'), { timeout: 25000 }).then(() => true).catch(() => false);
  if (!ok) { const err = await page.evaluate(() => (document.querySelector('.ant-alert-error,.ant-form-item-explain-error') || {}).textContent || ''); log('LOGIN_FAILED err=' + err); await browser.close(); return; }
  const token = await page.evaluate(() => localStorage.getItem('sword-token'));
  fs.writeFileSync(TF, token);
  log('LOGIN_OK');
  await browser.close();
})().catch((e) => { log('FATAL: ' + e.message); process.exit(1); });
