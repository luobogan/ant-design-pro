import { chromium } from 'playwright';

const BASE = 'http://localhost:8000';
const GW = 'http://localhost:81/blade-system/param/public-value';
const CHROME = 'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium-1243\\chrome-win64\\chrome.exe';

const log = (...a) => console.log('[e2e]', ...a);
const captchaInputCount = (page) => page.locator('input[placeholder="请输入验证码"]').count();

async function dbValue(tenantId) {
  const r = await fetch(`${GW}?paramKey=captcha_mode&tenantId=${tenantId}`);
  const j = await r.json();
  return j.data ?? null;
}

const browser = await chromium.launch({ headless: true, executablePath: CHROME });
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') log('PAGE-ERR', m.text()); });

const result = { testA: {}, testB: {} };

try {
  // ---------- Test A: 切换租户 → 验证码显隐 ----------
  log('Test A: 打开登录页');
  await page.goto(`${BASE}/user/login`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('租户ID: 000000').waitFor({ timeout: 20000 });

  const tenant = page.getByPlaceholder('租户ID: 000000');
  const vis = async () => (await captchaInputCount(page)) > 0;

  // 初始租户 000000（captcha_mode=false）→ 不显示
  await page.waitForTimeout(1500);
  result.testA.tenant000000_initial = await vis();

  // 切到 888888（captcha_mode=true）→ 显示
  await tenant.fill('888888');
  await page.waitForTimeout(2000);
  result.testA.tenant888888 = await vis();

  // 切到 999999（无配置 → 默认 true）→ 显示
  await tenant.fill('999999');
  await page.waitForTimeout(2000);
  result.testA.tenant999999 = await vis();

  // 切回 000000 → 不显示
  await tenant.fill('000000');
  await page.waitForTimeout(2000);
  result.testA.tenant000000_back = await vis();

  const aPass =
    result.testA.tenant000000_initial === false &&
    result.testA.tenant888888 === true &&
    result.testA.tenant999999 === true &&
    result.testA.tenant000000_back === false;
  result.testA.pass = aPass;
  log('Test A 结果', result.testA);

  // ---------- Test B: 管理员登录 → 系统设置切换 → DB 落库 ----------
  log('Test B: 管理员登录(租户000000, 验证码已关闭)');
  await page.getByPlaceholder('用户名: admin').fill('admin');
  await page.getByPlaceholder('密码: admin').fill('ant.design');
  await tenant.fill('000000');
  await page.locator('form button[type="submit"]').click();
  // 等待跳离登录页（带错误捕获）
  try {
    await page.waitForURL((u) => !u.pathname.includes('/user/login'), { timeout: 15000 });
    log('登录成功，跳转到', page.url());
  } catch (le) {
    const errText = await page
      .locator('.ant-message-error, .ant-alert-error, [role="alert"]')
      .first()
      .textContent()
      .catch(() => '');
    log('登录失败，页面错误:「' + (errText || '无可见错误') + '」');
    throw le;
  }

  await page.goto(`${BASE}/account/settings`, { waitUntil: 'networkidle' });
  await page.locator('.ant-menu-item:has-text("系统设置")').click();
  await page.locator('.ant-card:has-text("登录安全配置")').waitFor({ timeout: 15000 });

  const sw = page.locator('.ant-card:has-text("登录安全配置") .ant-switch').first();
  const beforeAria = await sw.getAttribute('aria-checked');
  const beforeDb = await dbValue('000000');
  log('切换前: switch=', beforeAria, ' db=', beforeDb);

  await sw.click();
  await page.getByText('已保存登录验证码配置').waitFor({ timeout: 10000 });
  await page.waitForTimeout(800);
  const afterAria = await sw.getAttribute('aria-checked');
  const afterDb = await dbValue('000000');
  log('切换后: switch=', afterAria, ' db=', afterDb);

  result.testB.switchBefore = beforeAria;
  result.testB.switchAfter = afterAria;
  result.testB.dbBefore = beforeDb;
  result.testB.dbAfter = afterDb;
  result.testB.pass =
    beforeAria !== afterAria && String(afterDb) === String(afterAria === 'true' ? 'true' : 'false');
  log('Test B 结果', result.testB);

  result.overall = aPass && result.testB.pass;
} catch (e) {
  log('ERROR', e.message);
  result.error = e.message;
  result.overall = false;
} finally {
  await browser.close();
  console.log('E2E_SUMMARY=' + JSON.stringify(result, null, 2));
  process.exit(result.overall ? 0 : 1);
}
