#!/usr/bin/env node
/**
 * (c) 字段权限面板端到端：UI 勾选「必填」→ 保存 → 发布 → REST field-perm（BPMN 读源）应返回该字段；
 * 随后恢复（取消勾选 → 保存 → 发布 → 复核为空），保证 dev 数据回到基线。
 * 顺带做明细筛选「读回显」验证：表单内容弹窗应显示基线里的 amount / 100。
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
  return { status: r.status, data: j?.data };
};

const publish = async (page) => {
  await page.locator('.ant-tabs-tab', { hasText: '流程卡片' }).first().click();
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: /发\s*布/ }).first().click();
  await page.waitForTimeout(8000);
};

(async () => {
  const token = fs.readFileSync(TF, 'utf8').trim();
  log('FIELD_PERM_BEFORE=' + JSON.stringify(await api(token, `/api/blade-workflow/definition/${DEFID}/node/${NODE}/field-perm`)));

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

  // 选中节点：点画布上的 UserTask 形状（右侧面板随之出现）
  await page.locator('.djs-element[data-element-id="Activity_16wyet2"], .bjs-element[data-element-id="Activity_16wyet2"]').first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(2500);
  const side = await page.locator('.wf-side-title').first().innerText().catch(() => 'NONE');
  log('SIDE_PANEL=' + side);

  // 字段权限页签
  await page.locator('.wf-side-panel .ant-tabs-tab', { hasText: '字段权限' }).first().click().catch(() => {});
  await page.waitForTimeout(3000);
  const permRows = await page.evaluate(() => {
    const tables = Array.from(document.querySelectorAll('.wf-side-panel table'));
    const t = tables.find((x) => x.querySelectorAll('tbody tr').length);
    if (!t) return { rows: 0 };
    return {
      rows: t.querySelectorAll('tbody tr').length,
      first: Array.from(t.querySelectorAll('tbody tr')[0].querySelectorAll('td')).map((td) => td.innerText.trim()),
    };
  });
  log('PERM_TABLE=' + JSON.stringify(permRows));

  // 第 0 行是表头（作用域/字段名/字段标签/显示/可编辑/必填），数据行从 1 起；「必填」= 第 6 列
  await page.locator('.wf-side-panel table tbody tr').nth(1).locator('td').nth(5).locator('.ant-checkbox-input').first().click({ force: true });
  await page.waitForTimeout(800);
  await page.locator('.wf-side-panel button', { hasText: /保存字段权限/ }).first().click();
  await page.waitForTimeout(3500);
  log('PERM_SAVED');

  // 明细筛选「读回显」：节点信息列表「表单内容」列 → 设计
  await page.locator('.ant-tabs-tab', { hasText: '节点信息' }).first().click();
  await page.waitForTimeout(4000);
  await page.locator('tbody tr td:nth-child(7) button', { hasText: /设\s*计/ }).first().click().catch((e) => log('DESIGN_BTN_MISS'));
  await page.waitForTimeout(4000);
  const df = await page.evaluate(() => {
    const m = Array.from(document.querySelectorAll('.ant-modal')).find((x) => (x.innerText || '').includes('明细'));
    return m ? (m.innerText || '').slice(0, 500) : 'NO_MODAL';
  });
  log('FORM_CONTENT_MODAL=' + JSON.stringify(df));
  await page.locator('.ant-modal-footer button', { hasText: /取\s*消|关\s*闭/ }).first().click().catch(() => {});
  await page.waitForTimeout(1500);

  await publish(page);
  log('FIELD_PERM_AFTER=' + JSON.stringify(await api(token, `/api/blade-workflow/definition/${DEFID}/node/${NODE}/field-perm`)));

  // 恢复：取消勾选 → 保存 → 发布 → 复核为空
  await page.locator('.ant-tabs-tab', { hasText: '流转设置' }).first().click();
  await page.waitForTimeout(2500);
  await page.locator('.wf-side-panel .ant-tabs-tab', { hasText: '字段权限' }).first().click().catch(() => {});
  await page.waitForTimeout(2500);
  await page.locator('.wf-side-panel table tbody tr').nth(1).locator('td').nth(5).locator('.ant-checkbox-input').first().click({ force: true });
  await page.waitForTimeout(800);
  await page.locator('.wf-side-panel button', { hasText: /保存字段权限/ }).first().click();
  await page.waitForTimeout(3500);
  await publish(page);
  log('FIELD_PERM_RESTORED=' + JSON.stringify(await api(token, `/api/blade-workflow/definition/${DEFID}/node/${NODE}/field-perm`)));
  await browser.close();
  log('DONE');
})().catch((e) => { log('FATAL: ' + e.message); process.exit(1); });
