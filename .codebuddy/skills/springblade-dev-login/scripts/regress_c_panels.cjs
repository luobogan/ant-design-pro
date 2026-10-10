#!/usr/bin/env node
/**
 * (c) 面板端到端回归：UI 写 → 部署 → 后端 BPMN 读端点对照。
 *
 * 超时面板：UI「超时设置」新增 45 分钟/自动通过 → 画布自动保存 → 发布（部署）
 *          → GET /node-timeout/list（wf-table-retirement=true，纯 BPMN 读源，禁 DB 回退）应返回该规则。
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
  const t = await r.text();
  let b; try { b = JSON.parse(t); } catch (e) { b = t.slice(0, 200); }
  return { status: r.status, body: b };
};

(async () => {
  const token = fs.readFileSync(TF, 'utf8').trim();
  log('TIMEOUT_BEFORE=' + JSON.stringify(await api(token, `/api/blade-workflow/node-timeout/list?defId=${DEFID}&nodeKey=${NODE}`)));
  log('DETAIL_FILTER_BEFORE=' + JSON.stringify(await api(token, `/api/blade-workflow/definition/${DEFID}/node/${NODE}/detail-filter`)));
  log('FIELD_PERM_BEFORE=' + JSON.stringify(await api(token, `/api/blade-workflow/definition/${DEFID}/node/${NODE}/field-perm`)).slice(0, 400));

  const { chromium } = (() => {
    const c = ['D:/project/node-win-x64/node_cache/_npx/0b9ff77863cb6e9f/node_modules', 'D:/project/node-win-x64/node_cache/_npx'];
    for (const d of c) { try { return { chromium: require(require.resolve('playwright', { paths: [d] })).chromium }; } catch (e) {} }
    return require('playwright');
  })();
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1208\\chrome-headless-shell-win64\\chrome-headless-shell.exe', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1680, height: 1000 } });
  await ctx.addInitScript((tk) => { try { localStorage.setItem('sword-token', tk); } catch (e) {} }, token);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log('PAGEERROR: ' + e.message.slice(0, 160)));

  await page.goto(`${BASE}/formmode/workflowdesign?defId=${DEFID}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(12000);
  await page.waitForSelector('.bjs-container, .djs-container', { timeout: 120000 });
  await page.waitForTimeout(6000);
  await page.locator('.ant-tabs-tab', { hasText: '节点信息' }).first().click();
  await page.waitForTimeout(5000);
  log('DESIGNER_READY');

  // 数据行：取 tbody tr 最多的表格；超时设置列 index=16
  const dataRows = page.locator('table').filter({ has: page.locator('tbody tr') }).last().locator('tbody tr');
  const n = await dataRows.count();
  log('DATA_ROWS=' + n);
  await page.locator('tbody tr td:nth-child(17) button').first().click();
  await page.waitForTimeout(2500);
  const modalTitle = await page.locator('.ant-modal-title').first().innerText().catch(() => 'NONE');
  log('MODAL=' + modalTitle);

  await page.locator('.ant-modal button', { hasText: '添加超时规则' }).first().click();
  await page.waitForTimeout(1200);
  await page.locator('.ant-modal input[placeholder="分钟"]').first().fill('45');
  await page.waitForTimeout(600);
  // 注意：antd 会在两个中文字间插空格，按钮实际文本是「保 存」
  await page.locator('.ant-modal-footer button', { hasText: /保\s*存/ }).first().click();
  await page.waitForTimeout(3500);
  log('TIMEOUT_SAVED');

  // 发布（部署）：读端点读的是部署工件，必须部署后才生效
  // 发布按钮在「流程卡片」页签（页签切换会卸载内容，需切回去才在 DOM 里）
  await page.locator('.ant-tabs-tab', { hasText: '流程卡片' }).first().click();
  await page.waitForTimeout(2500);
  // 同为 antd 中文字间空格坑：「发 布」
  await page.getByRole('button', { name: /发\s*布/ }).first().click();
  await page.waitForTimeout(8000);
  log('DEPLOY_CLICKED');

  log('TIMEOUT_AFTER=' + JSON.stringify(await api(token, `/api/blade-workflow/node-timeout/list?defId=${DEFID}&nodeKey=${NODE}`)));
  await browser.close();
  log('DONE');
})().catch((e) => { log('FATAL: ' + e.message); process.exit(1); });
