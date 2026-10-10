#!/usr/bin/env node
/**
 * (d) 收口回归：优先复用已落盘 token；否则走验证码登录（异步读图取码）后落盘 token。
 * 然后调用 backfill + node-timeout/list + detail-filter，验证 BPMN 读源在「带数据定义」上返回数据。
 */
const fs = require('fs');
const RUN = process.argv[2] || '1';
const OUT = 'C:\\Users\\Administrator\\regress_out_' + RUN + '.log';
const IMG = 'C:\\Users\\Administrator\\captcha_' + RUN + '.png';
const CODEF = 'C:\\Users\\Administrator\\captcha_code_' + RUN + '.txt';
const TF = 'C:\\Users\\Administrator\\sword_token.txt';
try { fs.writeFileSync(OUT, ''); } catch (e) {}
const log = (s) => { const l = typeof s === 'string' ? s : JSON.stringify(s); console.log(l); try { fs.appendFileSync(OUT, l + '\n'); } catch (e) {} };

const BASIC = Buffer.from('sword:sword_secret').toString('base64');
const BASE = 'http://localhost:8000';
const DEFID = '2100918142244032513';
const NODE = 'Activity_16wyet2';
const H = (tk) => ({ 'blade-auth': 'bearer ' + tk, authorization: 'Basic ' + BASIC, 'tenant-id': '000000', 'Content-Type': 'application/json' });
const api = async (tk, path) => { const r = await fetch(BASE + path, { headers: H(tk) }); const t = await r.text(); let b; try { b = JSON.parse(t); } catch (e) { b = t.slice(0, 400); } return { status: r.status, body: b }; };

(async () => {
  let token = '';
  if (fs.existsSync(TF)) token = fs.readFileSync(TF, 'utf8').trim();
  let valid = false;
  if (token) {
    const r = await api(token, `/api/blade-workflow/node-timeout/list?defId=${DEFID}&nodeKey=${NODE}`);
    valid = r.status === 200;
    log('TOKEN_REUSE status=' + r.status);
  }
  if (!valid) {
    const { chromium } = (() => {
      const c = ['D:/project/node-win-x64/node_cache/_npx/0b9ff77863cb6e9f/node_modules', 'D:/project/node-win-x64/node_cache/_npx'];
      for (const d of c) { try { return { chromium: require(require.resolve('playwright', { paths: [d] })).chromium }; } catch (e) {} }
      return require('playwright');
    })();
    const CHROMIUM_PATH = 'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1208\\chrome-headless-shell-win64\\chrome-headless-shell.exe';
    try { fs.unlinkSync(CODEF); } catch (e) {}
    try { fs.unlinkSync(IMG); } catch (e) {}
    const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] });
    const page = await (await browser.newContext()).newPage();
    let cap = null;
    page.on('response', async (r) => { if (r.url().includes('/api/blade-auth/captcha')) { const j = await r.json().catch(() => null); if (j && j.data && j.data.image) cap = j.data; } });
    await page.goto(BASE + '/user/login', { waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector('input#account', { timeout: 45000 });
    await page.waitForTimeout(1500);
    const hasCap = await page.$('input[placeholder="请输入验证码"]');
    if (cap) fs.writeFileSync(IMG, Buffer.from(cap.image.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
    log('CAPTCHA_CAPTURED key=' + (cap ? cap.key : 'NONE') + ' hasField=' + !!hasCap);
    let code = '';
    for (let i = 0; i < 150; i++) { if (fs.existsSync(CODEF)) { const c = fs.readFileSync(CODEF, 'utf8').trim(); if (c) { code = c; break; } } await page.waitForTimeout(2000); }
    log('CODE_RECEIVED=' + code);
    if (hasCap && !code) { log('NO_CODE_TIMEOUT'); await browser.close(); return; }
    await page.fill('input#tenantId', '000000');
    await page.fill('input#account', 'admin');
    await page.fill('input#password', 'ant.design');
    if (hasCap) await page.fill('input[placeholder="请输入验证码"]', code);
    await page.click('button[type="submit"]');
    const ok = await page.waitForFunction(() => !!localStorage.getItem('sword-token'), { timeout: 20000 }).then(() => true).catch(() => false);
    if (!ok) { const err = await page.evaluate(() => (document.querySelector('.ant-alert-error,.ant-form-item-explain-error') || {}).textContent || ''); log('LOGIN_FAILED err=' + err); await browser.close(); return; }
    token = await page.evaluate(() => localStorage.getItem('sword-token'));
    fs.writeFileSync(TF, token);
    log('LOGIN_OK token_saved');
    await browser.close();
  }

  log('DETAIL_FILTER_BEFORE=' + JSON.stringify(await api(token, `/api/blade-workflow/definition/${DEFID}/node/${NODE}/detail-filter`)));
  log('TIMEOUT_BEFORE=' + JSON.stringify(await api(token, `/api/blade-workflow/node-timeout/list?defId=${DEFID}&nodeKey=${NODE}`)));
  log('BACKFILL=' + JSON.stringify(await api(token, `/api/blade-workflow/migration/backfill?defId=${DEFID}&force=true`)));
  await new Promise((r) => setTimeout(r, 2500));
  log('DETAIL_FILTER_AFTER=' + JSON.stringify(await api(token, `/api/blade-workflow/definition/${DEFID}/node/${NODE}/detail-filter`)));
  log('TIMEOUT_AFTER=' + JSON.stringify(await api(token, `/api/blade-workflow/node-timeout/list?defId=${DEFID}&nodeKey=${NODE}`)));
  log('DONE');
})().catch((e) => { log('FATAL: ' + e.message); process.exit(1); });
