#!/usr/bin/env node
/**
 * SpringBlade 开发环境登录 + 调接口工具（Playwright）
 *
 * 作用：
 *   1. 用真实前端(ant-design-pro)登录流程拿到有效的 sword-token（自动处理 SM2 密码加密、验证码占位）。
 *   2. 捕获页面登录后自动发起的真实 API 请求头（blade-auth / authorization / tenant-id）。
 *   3. 可选：用这些真实请求头直接调用任意需要鉴权的后端接口并打印结果。
 *
 * 用法：
 *   node pw_login.cjs [--account admin] [--password ant.design] [--tenant 000000]
 *                    [--base http://localhost:8000] [--endpoint <path-after-/api/>]
 *                    [--method GET] [--headless true]
 *
 * 示例：
 *   # 仅登录，输出 token 与请求头（供手动 curl 用）
 *   node pw_login.cjs --account admin --password ant.design --tenant 000000
 *   # 登录并直接调用对账接口
 *   node pw_login.cjs --endpoint blade-workflow/migration/reconcile
 *
 * 前置：
 *   - ant-design-pro dev server 运行在 :8000，代理 /api -> 网关(:81)
 *   - blade-auth 运行（验证码如需临时关闭，见 references/setup.md）
 *   - Playwright 浏览器可用（默认找 chrome-headless-shell，可用 PLAYWRIGHT_CHROMIUM_PATH 覆盖；
 *     模块解析目录可用 PLAYWRIGHT_MODULE_DIR 覆盖）
 */

// ---- 解析 playwright 模块（多候选目录，避免硬依赖 NODE_PATH）----
function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE_DIR,
    // playwright@1.63.0 随前端依赖安装（2026-10-07 实测可用）
    'D:/project/springbladeandreact/ant-design-pro/node_modules',
    'D:/project/node-win-x64/node_cache/_npx/0b9ff77863cb6e9f/node_modules',
    'D:/project/node-win-x64/node_cache/_npx',
  ].filter(Boolean);
  for (const d of candidates) {
    try {
      const p = require.resolve('playwright', { paths: [d] });
      return require(p);
    } catch (e) {}
    try {
      return require(d + '/playwright');
    } catch (e) {}
  }
  return require('playwright');
}

// ---- 命令行参数 ----
function parseArgs(argv) {
  const o = {
    account: 'admin',
    password: 'ant.design',
    tenant: '000000',
    base: 'http://localhost:8000',
    endpoint: null,
    method: 'GET',
    headless: 'true',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--account') o.account = argv[++i];
    else if (a === '--password') o.password = argv[++i];
    else if (a === '--tenant') o.tenant = argv[++i];
    else if (a === '--base') o.base = argv[++i];
    else if (a === '--endpoint') o.endpoint = argv[++i];
    else if (a === '--method') o.method = argv[++i];
    else if (a === '--headless') o.headless = argv[++i];
  }
  return o;
}

const { chromium } = loadPlaywright();
const ARGS = parseArgs(process.argv.slice(2));

const CHROMIUM_PATH =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ||
  'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1243\\chrome-headless-shell-win64\\chrome-headless-shell.exe';

// Basic Auth 固定值：sword:sword_secret（来自 utils/auth.ts 的 clientId/clientSecret）
const BASIC = Buffer.from('sword:sword_secret').toString('base64');

(async () => {
  const browser = await (async () => {
    try {
      return await chromium.launch({
        headless: ARGS.headless === 'true',
        executablePath: CHROMIUM_PATH,
        args: ['--no-sandbox'],
      });
    } catch (e) {
      return await chromium.launch({ headless: ARGS.headless === 'true', args: ['--no-sandbox'] });
    }
  })();

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(m.text()));
  page.on('pageerror', (e) => logs.push('PAGEERR: ' + e.message));

  // 捕获页面登录后自动发起的真实 API 请求头
  let captured = null;
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('/api/') && !u.includes('/blade-auth/token') && !u.includes('/captcha')) {
      const h = req.headers();
      captured = {
        'blade-auth': h['blade-auth'],
        authorization: h['authorization'],
        'tenant-id': h['tenant-id'],
      };
    }
  });

  await page.goto(ARGS.base + '/user/login', { waitUntil: 'load', timeout: 60000 });
  await page.waitForSelector('input#account', { timeout: 45000 });
  await page.waitForTimeout(1500);

  await page.fill('input#tenantId', ARGS.tenant);
  await page.fill('input#account', ARGS.account);
  await page.fill('input#password', ARGS.password);
  // 验证码输入框（占位即可，后端若已临时关闭则忽略；否则登录会失败，见 setup.md）
  const captchaEl = await page.$('input[placeholder="请输入验证码"]');
  if (captchaEl) await page.fill('input[placeholder="请输入验证码"]', '1234');

  await page.click('button[type="submit"]');

  let token = null;
  try {
    await page.waitForFunction(() => !!localStorage.getItem('sword-token'), { timeout: 12000 });
    token = await page.evaluate(() => localStorage.getItem('sword-token'));
  } catch (e) {
    token = null;
  }

  if (!token) {
    const err = await page.evaluate(() => {
      const el = document.querySelector('.ant-alert');
      return el ? el.innerText.replace(/\s+/g, ' ').trim() : '(no alert)';
    });
    console.log('LOGIN_FAIL err=' + err);
    console.log('--- tail console ---');
    logs.slice(-25).forEach((l) => console.log('  ' + l));
    await browser.close();
    process.exit(1);
  }

  console.log('LOGIN_OK');
  console.log('TOKEN=' + token);

  // 等页面跳转并自动发 API，以捕获真实请求头
  await page.waitForTimeout(4000);

  if (!captured || !captured['blade-auth']) {
    console.log('WARN: 未捕获到 API 请求头，回退使用默认头');
    captured = { 'blade-auth': 'bearer ' + token, authorization: 'Basic ' + BASIC, 'tenant-id': ARGS.tenant };
  }
  console.log('HEADERS_JSON=' + JSON.stringify(captured));

  if (ARGS.endpoint) {
    const headers = { 'blade-auth': captured['blade-auth'] || 'bearer ' + token };
    if (captured['authorization']) headers['Authorization'] = captured['authorization'];
    if (captured['tenant-id']) headers['Tenant-Id'] = captured['tenant-id'];
    const url = ARGS.base.replace(/\/$/, '') + '/api/' + ARGS.endpoint.replace(/^\//, '');
    try {
      const resp = await fetch(url, { headers, method: ARGS.method });
      const text = await resp.text();
      console.log('ENDPOINT_STATUS=' + resp.status);
      console.log('ENDPOINT_BODY=' + text);
    } catch (e) {
      console.log('ENDPOINT_FETCH_ERROR=' + e.message);
    }
  }

  await browser.close();
})().catch((e) => {
  console.error('SCRIPT_ERROR', e);
  process.exit(1);
});
