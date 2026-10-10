#!/usr/bin/env node
/**
 * Playwright 浏览器审批回归测试
 * 登录 → 待办页 → 点「办理」打开办理页(popup) → 在办理页审批提交 → 校验待办数下降
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE_DIR,
    'D:/project/node-win-x64/node_cache/_npx/0b9ff77863cb6e9f/node_modules',
    'D:/project/node-win-x64/node_cache/_npx',
  ].filter(Boolean);
  for (const d of candidates) {
    try { return require(require.resolve('playwright', { paths: [d] })); } catch (e) {}
    try { return require(d + '/playwright'); } catch (e) {}
  }
  return require('playwright');
}

const { chromium } = loadPlaywright();
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH ||
  'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1208\\chrome-headless-shell-win64\\chrome-headless-shell.exe';
const BASIC = Buffer.from('sword:sword_secret').toString('base64');
const BASE = 'http://localhost:8000';
const OUT = path.join(os.tmpdir(), 'approve_test');
fs.mkdirSync(OUT, { recursive: true });
const shot = async (p, n) => { try { await p.screenshot({ path: path.join(OUT, n), fullPage: false }); } catch (e) {} };

function findTodoPath(menus) {
  let result = null;
  const walk = (nodes) => {
    for (const n of nodes || []) {
      const name = (n.name || '') + (n.title || '');
      if (!result && /待办/.test(name) && n.path) result = n.path;
      if (n.children && n.children.length) walk(n.children);
    }
  };
  walk(menus);
  return result;
}
const textsOf = async (p) => p.evaluate(() => {
  const out = [];
  document.querySelectorAll('button, .ant-btn, .ant-tabs-tab, a').forEach((b) => {
    const t = (b.innerText || '').replace(/\s+/g, ' ').trim();
    if (t && t.length <= 16) out.push(t);
  });
  return Array.from(new Set(out)).slice(0, 80);
});

(async () => {
  const browser = await (async () => {
    try { return await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] }); }
    catch (e) { return await chromium.launch({ headless: true, args: ['--no-sandbox'] }); }
  })();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(m.text()));
  page.on('pageerror', (e) => logs.push('PAGEERR: ' + e.message));

  await page.goto(BASE + '/user/login', { waitUntil: 'load', timeout: 60000 });
  await page.waitForSelector('input#account', { timeout: 45000 });
  await page.fill('input#tenantId', '000000');
  await page.fill('input#account', 'admin');
  await page.fill('input#password', 'ant.design');
  const cap = await page.$('input[placeholder="请输入验证码"]');
  if (cap) await page.fill('input[placeholder="请输入验证码"]', '1234');
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !!localStorage.getItem('sword-token'), { timeout: 12000 });
  const token = await page.evaluate(() => localStorage.getItem('sword-token'));
  console.log('LOGIN_OK');
  await page.waitForTimeout(4000);

  const menuJson = await page.evaluate(async (a) => {
    const r = await fetch('/api/blade-system/menu/routes', { headers: { 'blade-auth': a.tk, authorization: a.basic, 'tenant-id': a.tid } });
    return await r.text();
  }, { tk: 'bearer ' + token, basic: 'Basic ' + BASIC, tid: '000000' });
  let route = null;
  try { const m = JSON.parse(menuJson); route = findTodoPath(m.data || m); } catch (e) {}
  route = route || '/workflow/todo';
  console.log('TODO_ROUTE=' + route);

  const todoBefore = await page.evaluate(async (a) => {
    const r = await fetch('/api/blade-workflow/task/todo', { headers: { 'blade-auth': a.tk, authorization: a.basic, 'tenant-id': a.tid } });
    return await r.text();
  }, { tk: 'bearer ' + token, basic: 'Basic ' + BASIC, tid: '000000' });
  let beforeIds = [];
  try { beforeIds = (JSON.parse(todoBefore).data || []).map((t) => t.id); } catch (e) {}
  console.log('TODO_COUNT_BEFORE=' + beforeIds.length);

  await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3500);
  await shot(page, 'todo_page.png');

  // 点「办理」→ 新标签办理页
  const handleBtn = page.locator('tr.ant-table-row').first().getByText('办理', { exact: true });
  let work = page;
  if (await handleBtn.count()) {
    const [popup] = await Promise.all([
      ctx.waitForEvent('page', { timeout: 15000 }).catch(() => null),
      handleBtn.first().click(),
    ]);
    if (popup) work = popup;
    console.log('POPUP=' + (popup ? popup.url() : 'none'));
  } else { console.log('HANDLE_BTN_NOT_FOUND'); }
  await work.waitForLoadState('networkidle').catch(() => {});
  await work.waitForTimeout(6000);
  console.log('WORK_URL=' + work.url());
  await shot(work, 'handle_page.png');
  console.log('WORK_TEXTS=' + JSON.stringify(await textsOf(work)));

  // 填写办理页上所有空的、可编辑的文本输入（必填字段「字段4」为空会拦截提交）
  let filledCount = 0;
  const inputs = work.locator('input[type="text"], textarea');
  const cnt = await inputs.count();
  for (let i = 0; i < cnt; i++) {
    const el = inputs.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    if (!(await el.isEditable().catch(() => false))) continue;
    const v = await el.inputValue().catch(() => '');
    if (!v) { await el.fill('自动化审批测试-同意'); filledCount++; }
  }
  console.log('REQUIRED_FILLED=' + filledCount);
  await work.waitForTimeout(800).catch(() => {});
  await shot(work, 'before_submit.png').catch(() => {});

  // 点击「提交」
  const submitBtn = work.getByRole('button', { name: /提\s*交/ });
  if (await submitBtn.count()) { await submitBtn.first().click(); console.log('APPROVE_CLICKED=提交'); }
  else console.log('APPROVE_CLICKED=none');
  await work.waitForTimeout(2500).catch(() => {});
  await shot(work, 'after_submit_click.png').catch(() => {});
  try { console.log('WORK_TEXTS_AFTER=' + JSON.stringify(await textsOf(work))); } catch (e) { console.log('WORK_TEXTS_AFTER=n/a'); }

  // 可能的二次确认弹窗——点确定
  for (const label of ['确 定', '确定', '提交', '发送']) {
    try {
      const el = work.locator('.ant-modal button, .ant-popover button').getByText(new RegExp(label));
      if (await el.count()) { await el.first().click(); console.log('CONFIRM_CLICKED=' + label); break; }
    } catch (e) {}
  }
  await work.waitForTimeout(4000).catch(() => {});
  await shot(work, 'final.png').catch(() => {});

  // 校验：在主页面重新查待办数（办理页可能已关闭/跳转）
  const afterJson = await page.evaluate(async (a) => {
    const r = await fetch('/api/blade-workflow/task/todo', { headers: { 'blade-auth': a.tk, authorization: a.basic, 'tenant-id': a.tid } });
    return await r.text();
  }, { tk: 'bearer ' + token, basic: 'Basic ' + BASIC, tid: '000000' });
  let afterIds = [];
  try { afterIds = (JSON.parse(afterJson).data || []).map((t) => t.id); } catch (e) {}
  console.log('TODO_COUNT_AFTER=' + afterIds.length);
  const removed = beforeIds.filter((id) => !afterIds.includes(id));
  console.log('TASKS_REMOVED=' + removed.length + ' sample=' + JSON.stringify(removed.slice(0, 3)));

  console.log('OUT_DIR=' + OUT);
  console.log('--- tail console ---');
  logs.slice(-12).forEach((l) => console.log('  ' + l));
  await browser.close();
})().catch((e) => { console.error('SCRIPT_ERROR', e); process.exit(1); });
