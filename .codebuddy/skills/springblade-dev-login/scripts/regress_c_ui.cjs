#!/usr/bin/env node
/**
 * (c) UI 实证（含 REST 对照组）：
 * 后端 REST `GET /definition/{id}/node/{nodeKey}/operator` 纯读 wf_node_operator 表（无 BPMN 开关），
 * 故可作对照：若 UI 列表显示值与 REST 不同、而与 BPMN wf:operator 一致 ⇒ 前端读源确为 BPMN。
 * 基线 def 2100918142244032513：Activity_16wyet2 的 DB=5 条 / BPMN=1 条。
 */
const fs = require('fs');
const TF = 'C:\\Users\\Administrator\\sword_token.txt';
const BASE = 'http://localhost:8000';
const DEFID = '2100918142244032513';
const BASIC = Buffer.from('sword:sword_secret').toString('base64');
const H = (tk) => ({ 'blade-auth': 'bearer ' + tk, authorization: 'Basic ' + BASIC, 'tenant-id': '000000' });
const log = (s) => console.log(typeof s === 'string' ? s : JSON.stringify(s));

(async () => {
  const token = fs.readFileSync(TF, 'utf8').trim();
  // ── 对照组：REST（wf_node_operator 表口径）
  const nodes = ['Activity_16wyet2', 'Event_1wh3dpi', 'Event_13rmetl'];
  for (const nk of nodes) {
    const r = await fetch(`${BASE}/api/blade-workflow/definition/${DEFID}/node/${nk}/operator`, { headers: H(token) });
    const j = await r.json().catch(() => null);
    log(`REST_DB ${nk} -> ${r.status} count=${Array.isArray(j?.data) ? j.data.length : 'n/a'}`);
  }

  // ── UI：设计器「节点信息」列表
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
  await page.waitForTimeout(6000);
  await page.locator('.ant-tabs-tab', { hasText: '节点信息' }).first().click();
  await page.waitForTimeout(6000);

  const rows = await page.evaluate(() => {
    const tables = Array.from(document.querySelectorAll('table'));
    const headTable = tables.find((x) => (x.innerText || '').includes('操作者'));
    const head = headTable ? Array.from(headTable.querySelectorAll('thead th')).map((th) => th.innerText.trim()) : [];
    const bodyTable = tables
      .filter((t) => t.querySelectorAll('tbody tr').length)
      .sort((a, b) => b.querySelectorAll('tbody tr').length - a.querySelectorAll('tbody tr').length)[0];
    const body = bodyTable
      ? Array.from(bodyTable.querySelectorAll('tbody tr'))
          .map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.innerText.trim().split('\n')[0]))
      : [];
    return { head, body };
  });
  const opIdx = rows.head.findIndex((h) => h.includes('操作者'));
  log('HEAD=' + JSON.stringify(rows.head.slice(0, 6)) + ' opIdx=' + opIdx);
  rows.body.forEach((c, i) => log(`UI_ROW[${i}] first5=${JSON.stringify(c.slice(0, 5))} operators=${opIdx >= 0 ? c[opIdx] : 'n/a'}`));
  await browser.close();
  log('DONE');
})().catch((e) => { log('FATAL: ' + e.message); process.exit(1); });
