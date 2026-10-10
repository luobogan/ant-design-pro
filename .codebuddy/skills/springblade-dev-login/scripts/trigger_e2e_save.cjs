#!/usr/bin/env node
/**
 * formmode 触发器全链路 E2E：保存表单 → 自动发起流程
 * 登录 → 待办数(before) → POST /blade-formmode/form-data/save（modeid=触发器测试表单）
 * → 待办数(after)，校验 +1（触发器自动发起 测试-918 实例产生新待办）
 */
const { chromium } = (() => {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE_DIR,
    'D:/project/node-win-x64/node_cache/_npx/0b9ff77863cb6e9f/node_modules',
    'D:/project/node-win-x64/node_cache/_npx',
  ].filter(Boolean);
  for (const d of candidates) {
    try { return { chromium: require(require.resolve('playwright', { paths: [d] })).chromium }; } catch (e) {}
    try { return { chromium: require(d + '/playwright').chromium }; } catch (e) {}
  }
  return require('playwright');
})();

const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH ||
  'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1208\\chrome-headless-shell-win64\\chrome-headless-shell.exe';
const BASIC = Buffer.from('sword:sword_secret').toString('base64');
const BASE = 'http://localhost:8000';
const MODEID = '2106000000000000001'; // 触发器测试表单（billid=5 → formtable_main_5）

const H = (tk) => ({
  'blade-auth': 'bearer ' + tk,
  'authorization': 'Basic ' + BASIC,
  'tenant-id': '000000',
  'Content-Type': 'application/json',
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
  await page.waitForTimeout(3000);

  // 1) 待办数 before
  const before = await page.evaluate(async (h) => {
    const r = await fetch('/api/blade-workflow/task/todo', { headers: h });
    const j = await r.json();
    return (j.data && j.data.length) || 0;
  }, H(token));
  console.log('TODO_BEFORE=' + before);

  // 2) 保存表单（触发器 modeid 命中 triggeropt=0 新建即触发）
  const saveResp = await page.evaluate(async (args) => {
    const body = {
      modeid: args.modeid,   // 字符串传 19 位雪花，避免 JS Number 精度丢失
      billid: 5,
      src: 'save',
      fieldValues: {
        field_1: 'E2E-触发器-自动发起',
        field_2: 'save→auto-start',
        field_3: 'v1',
        field_4: '2026-10-02',
      },
    };
    const r = await fetch('/api/blade-formmode/form-data/save', {
      method: 'POST', headers: args.h, body: JSON.stringify(body),
    });
    return { status: r.status, text: await r.text() };
  }, { modeid: MODEID, h: H(token) });
  console.log('SAVE_STATUS=' + saveResp.status);
  console.log('SAVE_RESP=' + saveResp.text.slice(0, 500));

  await page.waitForTimeout(2000);

  // 3) 待办数 after
  const after = await page.evaluate(async (h) => {
    const r = await fetch('/api/blade-workflow/task/todo', { headers: h });
    const j = await r.json();
    return (j.data && j.data.length) || 0;
  }, H(token));
  console.log('TODO_AFTER=' + after);
  console.log('DELTA=' + (after - before) + (after - before === 1 ? '  (PASS: 触发器自动发起成功)' : '  (FAIL: 未自动发起或发起多个)'));
  console.log('--- tail console ---');
  logs.slice(-12).forEach((l) => console.log('  ' + l.slice(0, 200)));
  await browser.close();
})().catch((e) => { console.error('FATAL: ' + e.message); process.exit(1); });
