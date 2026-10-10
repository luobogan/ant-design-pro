#!/usr/bin/env node
/** 清理：删除超时面板回归产生的规则，恢复到基线（空） */
const fs = require('fs');
const TF = 'C:\\Users\\Administrator\\sword_token.txt';
const BASE = 'http://localhost:8000';
const DEFID = '2100918142244032513';
const NODE = 'Activity_16wyet2';
const BASIC = Buffer.from('sword:sword_secret').toString('base64');
const H = (tk) => ({ 'blade-auth': 'bearer ' + tk, authorization: 'Basic ' + BASIC, 'tenant-id': '000000' });
const log = (s) => console.log(typeof s === 'string' ? s : JSON.stringify(s));
const api = async (tk, p) => {
  const r = await fetch(BASE + p, { headers: H(tk) });
  const j = await r.json().catch(() => null);
  return { status: r.status, count: Array.isArray(j?.data) ? j.data.length : -1 };
};
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
  await page.waitForTimeout(5000);
  await page.locator('.ant-tabs-tab', { hasText: '节点信息' }).first().click();
  await page.waitForTimeout(4000);
  await page.locator('tbody tr td:nth-child(17) button').first().click();
  await page.waitForTimeout(3000);
  for (let i = 0; i < 8; i++) {
    const del = page.locator('.ant-modal button', { hasText: /删\s*除\s*规\s*则/ }).first();
    if (!(await del.count())) break;
    await del.click();
    await page.waitForTimeout(800);
  }
  await page.locator('.ant-modal-footer button', { hasText: /保\s*存/ }).first().click();
  await page.waitForTimeout(3500);
  await page.locator('.ant-tabs-tab', { hasText: '流程卡片' }).first().click();
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: /发\s*布/ }).first().click();
  await page.waitForTimeout(8000);
  log('TIMEOUT_AFTER_CLEANUP=' + JSON.stringify(await api(token, `/api/blade-workflow/node-timeout/list?defId=${DEFID}&nodeKey=${NODE}`)));
  await browser.close();
  log('DONE');
})().catch((e) => { log('FATAL: ' + e.message); process.exit(1); });
