#!/usr/bin/env node
/** 仅发布（部署）指定定义：让部署工件与 bpmn_xml 同步 */
const fs = require('fs');
const BASE = 'http://localhost:8000';
const DEFID = process.argv[2] || '2100918142244032513';
const TF = 'C:\\Users\\Administrator\\sword_token.txt';
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
  await page.goto(`${BASE}/formmode/workflowdesign?defId=${DEFID}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(12000);
  await page.waitForSelector('.bjs-container, .djs-container', { timeout: 120000 });
  await page.waitForTimeout(4000);
  await page.locator('.ant-tabs-tab', { hasText: '流程卡片' }).first().click();
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: /发\s*布/ }).first().click();
  await page.waitForTimeout(9000);
  log('PUBLISHED');
  await browser.close();
})().catch((e) => { log('FATAL: ' + e.message); process.exit(1); });
