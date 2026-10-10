#!/usr/bin/env node
/** 诊断：流程列表页与设计器页当前是否可用 */
const fs = require('fs');
const TF = 'C:\\Users\\Administrator\\sword_token.txt';
const BASE = 'http://localhost:8000';
const DEFID = '2100918142244032513';
const log = (s) => console.log(typeof s === 'string' ? s : JSON.stringify(s));
(async () => {
  const token = fs.readFileSync(TF, 'utf8').trim();
  const { chromium } = (() => {
    const c = ['D:/project/node-win-x64/node_cache/_npx/0b9ff77863cb6e9f/node_modules', 'D:/project/node-win-x64/node_cache/_npx'];
    for (const d of c) { try { return { chromium: require(require.resolve('playwright', { paths: [d] })).chromium }; } catch (e) {} }
    return require('playwright');
  })();
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1208\\chrome-headless-shell-win64\\chrome-headless-shell.exe', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1680, height: 1000 } });
  await ctx.addInitScript((tk) => { try { localStorage.setItem('sword-token', tk); } catch (e) {} }, token);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message.slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)); });

  await page.goto(BASE + '/system/workflow', { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(15000);
  const list = await page.evaluate(() => ({
    url: location.href,
    is404: (document.body.innerText || '').includes('页面不存在'),
    rows: document.querySelectorAll('tbody tr').length,
    head: (document.body.innerText || '').slice(0, 200),
  }));
  log('LIST=' + JSON.stringify(list));

  await page.goto(`${BASE}/formmode/workflowdesign?defId=${DEFID}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(15000);
  const designer = await page.evaluate(() => ({
    url: location.href,
    is404: (document.body.innerText || '').includes('页面不存在'),
    canvas: !!document.querySelector('.bjs-container, .djs-container'),
    body: (document.body.innerText || '').slice(0, 250),
  }));
  log('DESIGNER=' + JSON.stringify(designer));
  log('ERRS=' + JSON.stringify(errs.slice(0, 8)));
  await browser.close();
  log('DONE');
})().catch((e) => { log('FATAL: ' + e.message); process.exit(1); });
