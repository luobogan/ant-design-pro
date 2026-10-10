#!/usr/bin/env node
/**
 * 真实 UI 实测：登录 → 进入 formmode 表单页 → 填字段 → 点真实「提交」按钮 → 校验触发器自动发起。
 * 若表单页路由/端点异常，会如实打印页面状态与网络请求，便于定位真实 UI 路径。
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
const FORMID = '2106000000000000001';
// 候选真实表单页路由（DataAdd 可能未挂路由，逐一尝试）
const ROUTES = [
  '/formmode/form-view/data-add?formId=' + FORMID,
  '/formmode/data-add?formId=' + FORMID,
  '/formmode/FormView/DataAdd?formId=' + FORMID,
];

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
  const apiCalls = [];
  page.on('request', (r) => {
    const u = r.url();
    if (u.includes('/form-data') || u.includes('/form/data')) apiCalls.push(r.method() + ' ' + u.replace(BASE, '') + ' -> ' + (r.postData() || '').slice(0, 80));
  });
  page.on('console', (m) => { if (m.type() === 'error') apiCalls.push('CONSOLE_ERR: ' + m.text().slice(0, 160)); });

  await page.goto(BASE + '/user/login', { waitUntil: 'load', timeout: 60000 });
  await page.waitForSelector('input#account', { timeout: 45000 });
  await page.fill('input#tenantId', '000000');
  await page.fill('input#account', 'admin');
  await page.fill('input#password', 'ant.design');
  const cap = await page.$('input[placeholder="请输入验证码"]');
  if (cap) await page.fill('input[placeholder="请输入验证码"]', '1234');
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !!localStorage.getItem('sword-token'), { timeout: 15000 });
  const token = await page.evaluate(() => localStorage.getItem('sword-token'));
  console.log('LOGIN_OK');
  await page.waitForTimeout(2000);

  const before = await page.evaluate(async (h) => {
    const r = await fetch('/api/blade-workflow/task/todo', { headers: h });
    const j = await r.json();
    return (j.data && j.data.length) || 0;
  }, H(token));
  console.log('TODO_BEFORE=' + before);

  // 尝试每个候选路由，找到能渲染表单字段的页面
  let landed = null;
  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const url = page.url();
    const fieldCount = await page.evaluate(() => document.querySelectorAll('form input, form textarea').length);
    const title = await page.evaluate(() => document.title);
    console.log('ROUTE ' + route + ' => url=' + url.replace(BASE, '') + ' fields=' + fieldCount + ' title=' + title);
    if (fieldCount > 0) { landed = route; break; }
  }

  if (!landed) {
    console.log('NO_FORM_PAGE_LANDED — DataAdd 可能未挂路由或非此路由');
    console.log('API_CALLS_SO_FAR:\n' + apiCalls.slice(-20).join('\n'));
    await browser.close();
    return;
  }
  console.log('LANDED=' + landed);

  // 填字段（所有 input/textarea 填值）
  await page.evaluate(() => {
    document.querySelectorAll('form input, form textarea').forEach((el, i) => {
      try {
        const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set;
        setter.call(el, 'UI-真实提交-' + i);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) {}
    });
  });
  await page.waitForTimeout(300);

  // 点真实「提交/保存」按钮
  const clicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((x) => /提交|保存/.test(x.textContent || ''));
    if (b) { b.click(); return (b.textContent || '').trim(); }
    return null;
  });
  console.log('CLICKED_BTN=' + clicked);
  await page.waitForTimeout(3000);

  const after = await page.evaluate(async (h) => {
    const r = await fetch('/api/blade-workflow/task/todo', { headers: h });
    const j = await r.json();
    return (j.data && j.data.length) || 0;
  }, H(token));
  console.log('TODO_AFTER=' + after);
  console.log('DELTA=' + (after - before));
  console.log('--- api/console captured ---');
  console.log(apiCalls.slice(-25).join('\n'));
  await browser.close();
})().catch((e) => { console.error('FATAL: ' + e.message); process.exit(1); });
