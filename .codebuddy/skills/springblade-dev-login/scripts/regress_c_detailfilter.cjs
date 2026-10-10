#!/usr/bin/env node
/**
 * 明细筛选面板端到端：UI「表单内容→设计」添加规则 → 保存 → 发布 → GET detail-filter（BPMN 读源）对照；
 * 之后删除该规则 → 保存 → 发布 → 复核回到基线（1 条 amount/100）。
 */
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
  return { status: r.status, data: Array.isArray(j?.data) ? j.data : [] };
};

const openDesignModal = async (page) => {
  await page.locator('tbody tr td:nth-child(6) button', { hasText: /设\s*计/ }).first().click();
  await page.waitForTimeout(3500);
};
const publish = async (page) => {
  await page.locator('.ant-tabs-tab', { hasText: '流程卡片' }).first().click();
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: /发\s*布/ }).first().click();
  await page.waitForTimeout(8000);
};

(async () => {
  const token = fs.readFileSync(TF, 'utf8').trim();
  const before = await api(token, `/api/blade-workflow/definition/${DEFID}/node/${NODE}/detail-filter`);
  log('DETAIL_FILTER_BEFORE count=' + before.data.length + ' ' + JSON.stringify(before.data));

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

  // 写入：新增一条筛选规则
  await openDesignModal(page);
  log('MODAL_TITLE=' + (await page.locator('.ant-modal-title').first().innerText().catch(() => 'NONE')));
  await page.locator('.ant-modal button', { hasText: '添加筛选规则' }).first().click();
  await page.waitForTimeout(1200);
  await page.locator('.ant-modal input[placeholder="字段名 fieldName"]').last().fill('field_2');
  await page.locator('.ant-modal input[placeholder="比较值（多值逗号分隔）"]').last().fill('9');
  await page.waitForTimeout(600);
  await page.locator('.ant-modal button', { hasText: /保\s*存/ }).first().click();
  await page.waitForTimeout(3500);
  await publish(page);
  const after = await api(token, `/api/blade-workflow/definition/${DEFID}/node/${NODE}/detail-filter`);
  log('DETAIL_FILTER_AFTER_ADD count=' + after.data.length + ' ' + JSON.stringify(after.data));

  // 清理：删回基线
  await page.locator('.ant-tabs-tab', { hasText: '流转设置' }).first().click();
  await page.waitForTimeout(2500);
  await page.locator('.ant-tabs-tab', { hasText: '节点信息' }).first().click();
  await page.waitForTimeout(4000);
  await openDesignModal(page);
  await page.locator('.ant-modal button', { hasText: /^删\s*除$/ }).last().click();
  await page.waitForTimeout(1000);
  await page.locator('.ant-modal button', { hasText: /保\s*存/ }).first().click();
  await page.waitForTimeout(3500);
  await publish(page);
  const restored = await api(token, `/api/blade-workflow/definition/${DEFID}/node/${NODE}/detail-filter`);
  log('DETAIL_FILTER_RESTORED count=' + restored.data.length + ' ' + JSON.stringify(restored.data));
  await browser.close();
  log('DONE');
})().catch((e) => { log('FATAL: ' + e.message); process.exit(1); });
