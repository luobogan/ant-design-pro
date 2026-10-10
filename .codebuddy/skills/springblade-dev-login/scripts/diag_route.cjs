#!/usr/bin/env node
/** 诊断设计器 404 根因：抓全部 console（组件注册路径 / 导入错误 / 按钮数据） */
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
  const logs = [];
  page.on('console', (m) => {
    const t = m.text();
    if (/组件|按钮|workflowdesign|WorkflowDesign|导入|404|route/i.test(t)) logs.push(m.type() + ': ' + t.slice(0, 300));
  });
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message.slice(0, 300)));

  await page.goto(BASE + '/system/workflow', { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(8000);
  const row = page.locator('tbody tr', { hasText: DEFID }).first();
  await row.locator('button, a').filter({ hasText: /^进入设计$/ }).first().click();
  await page.waitForTimeout(12000);

  const dom = await page.evaluate(() => ({
    url: location.href,
    is404: (document.body.innerText || '').includes('页面不存在'),
    msgError: Array.from(document.querySelectorAll('.ant-message-error, .ant-message-notice')).map((e) => e.innerText.trim()).slice(0, 5),
  }));
  log('DOM=' + JSON.stringify(dom));
  log('MATCHED_LOGS=' + JSON.stringify(logs.slice(-25)));
  await browser.close();
  log('DONE');
})().catch((e) => { log('FATAL: ' + e.message); process.exit(1); });
