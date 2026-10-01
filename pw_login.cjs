const { chromium } = require('playwright');

const BASE = 'http://localhost:8000';
const PASSWORDS = ['ant.design', '123456', 'admin'];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1208\\chrome-headless-shell-win64\\chrome-headless-shell.exe',
    args: ['--no-sandbox'],
  });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const logs = [];
  page.on('console', (m) => logs.push(m.text()));
  page.on('pageerror', (e) => logs.push('PAGEERR: ' + e.message));

  // 捕获页面真实发出的 API 请求头（含 blade-auth / authorization / tenant-id）
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

  let token = null;
  let usedPw = null;

  for (const pw of PASSWORDS) {
    logs.length = 0;
    await page.goto(BASE + '/user/login', { waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector('input#account', { timeout: 45000 });
    await page.waitForTimeout(2000);

    await page.fill('input#tenantId', '000000');
    await page.fill('input#account', 'admin');
    await page.fill('input#password', pw);
    await page.fill('input[placeholder="请输入验证码"]', '1234');

    await page.click('button[type="submit"]');

    let ok = false;
    try {
      await page.waitForFunction(() => !!localStorage.getItem('sword-token'), { timeout: 12000 });
      ok = true;
    } catch (e) {
      ok = false;
    }

    if (ok) {
      token = await page.evaluate(() => localStorage.getItem('sword-token'));
      usedPw = pw;
      console.log('LOGIN_OK password=' + pw);
      break;
    } else {
      const err = await page.evaluate(() => {
        const el = document.querySelector('.ant-alert');
        return el ? el.innerText.replace(/\s+/g, ' ').trim() : '(no alert)';
      });
      console.log('LOGIN_FAIL password=' + pw + ' err=' + err);
      console.log('--- tail console ---');
      logs.slice(-25).forEach((l) => console.log('  ' + l));
    }
  }

  if (!token) {
    console.log('RESULT: NO_TOKEN');
    await browser.close();
    return;
  }

  console.log('TOKEN=' + token);

  // 登录后页面跳转到仪表盘，会自动发起带真实请求头的 API 调用
  await page.waitForTimeout(4000);

  if (!captured || !captured['blade-auth']) {
    console.log('WARN: 未捕获到 API 请求头，回退使用 bearer 头');
    captured = { 'blade-auth': 'bearer ' + token, authorization: '', 'tenant-id': '000000' };
  }
  console.log('CAPTURED_HEADERS=' + JSON.stringify(captured));

  // 用 Node 直接打 dev server 代理（避开页面跳转导致的中断），复刻真实请求头
  const headers = {
    'blade-auth': captured['blade-auth'] || 'bearer ' + token,
  };
  if (captured['authorization']) headers['Authorization'] = captured['authorization'];
  if (captured['tenant-id']) headers['Tenant-Id'] = captured['tenant-id'];

  const url = BASE + '/api/blade-workflow/migration/reconcile';
  try {
    const resp = await fetch(url, { headers, method: 'GET' });
    const text = await resp.text();
    console.log('RECONCILE_STATUS=' + resp.status);
    console.log('RECONCILE=' + text);
  } catch (e) {
    console.log('RECONCILE_FETCH_ERROR=' + e.message);
  }

  await browser.close();
})().catch((e) => {
  console.error('SCRIPT_ERROR', e);
  process.exit(1);
});
