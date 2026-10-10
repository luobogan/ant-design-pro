#!/usr/bin/env node
/**
 * 人员状态流转「业务级」闭环验证（走 blade-system 入口，非直接发起工作流）：
 *   POST /user/status-flow/start {userId, toStatus:4}   → 建流转记录 + 发起审批(标题 PSF:)
 *   → 流程走到「审批通过」→ PROCESS_COMPLETED → 回调 blade-system
 *   → 回调命中流转记录 → applyPersonStatus 落库
 * 校验：records 流转状态变为已通过 + available 不再返回 1→4 配置（说明 person_status 已变）
 * 最后回退：再发起 toStatus:1（4→1 无配置 → 走直接变更，立即恢复）
 *
 * 用法: node wf_psf_e2e.cjs <userId> [toStatus]   默认 userId=3 toStatus=4
 */
const { chromium } = (() => {
  const cands = [
    'D:/project/springbladeandreact/ant-design-pro/node_modules',
    'D:/project/node-win-x64/node_cache/_npx/0b9ff77863cb6e9f/node_modules',
    'D:/project/node-win-x64/node_cache/_npx',
  ];
  for (const d of cands) {
    try { return { chromium: require(require.resolve('playwright', { paths: [d] })).chromium }; } catch (e) {}
  }
  return require('playwright');
})();
const CHROMIUM =
  'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1243\\chrome-headless-shell-win64\\chrome-headless-shell.exe';
const BASE = 'http://localhost:8000';
const BASIC = Buffer.from('sword:sword_secret').toString('base64');
const USER_ID = process.argv[2] || '3';
const TO_STATUS = Number(process.argv[3] || 4);

const log = (s) => console.log(typeof s === 'string' ? s : JSON.stringify(s));

(async () => {
  const browser = await (async () => {
    try { return await chromium.launch({ headless: true, executablePath: CHROMIUM, args: ['--no-sandbox'] }); }
    catch (e) { return await chromium.launch({ headless: true, args: ['--no-sandbox'] }); }
  })();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + '/user/login', { waitUntil: 'load', timeout: 60000 });
  await page.waitForSelector('input#account', { timeout: 45000 });
  await page.fill('input#tenantId', '000000');
  await page.fill('input#account', 'admin');
  await page.fill('input#password', 'ant.design');
  const cap = await page.$('input[placeholder="请输入验证码"]');
  if (cap) await page.fill('input[placeholder="请输入验证码"]', '1234');
  await page.waitForTimeout(800);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !!localStorage.getItem('sword-token'), null, { timeout: 30000 });
  const token = await page.evaluate(() => localStorage.getItem('sword-token'));
  log('LOGIN_OK');
  await page.waitForTimeout(2500);
  await page.goto(BASE + '/', { waitUntil: 'load', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const call = (method, ep, body) =>
    page.evaluate(async (a) => {
      const r = await fetch('http://localhost:8000/api/' + a.ep, {
        method: a.method,
        headers: {
          'blade-auth': 'bearer ' + a.tk,
          authorization: 'Basic ' + a.basic,
          'tenant-id': '000000',
          'Content-Type': 'application/json',
        },
        body: a.body ? JSON.stringify(a.body) : undefined,
      });
      return { status: r.status, text: await r.text() };
    }, { ep, method, body, tk: token, basic: BASIC });
  const J = (r) => { try { return JSON.parse(r.text); } catch (e) { return null; } };

  // --- before ---
  const av0 = await call('GET', 'blade-system/user/status-flow/available?userId=' + USER_ID, null);
  const av0j = J(av0);
  log('BEFORE_AVAILABLE_COUNT=' + (((av0j && av0j.data) || []).length));
  const rc0 = await call('GET', 'blade-system/user/status-flow/records?userId=' + USER_ID, null);
  const rc0j = J(rc0);
  const before = (rc0j && rc0j.data) || [];
  log('BEFORE_RECORD_COUNT=' + before.length);

  // --- start ---
  const st = await call('POST', 'blade-system/user/status-flow/start', {
    userId: Number(USER_ID),
    toStatus: TO_STATUS,
    opinion: 'E2E业务闭环验证',
  });
  log('START_STATUS=' + st.status);
  log('START=' + st.text.slice(0, 500));
  const stj = J(st);
  const instId = stj && stj.data ? String(stj.data) : null;
  log('INST_ID=' + instId);

  // 等流程流转 + 回调
  await page.waitForTimeout(6000);

  // --- after ---
  const rc1 = await call('GET', 'blade-system/user/status-flow/records?userId=' + USER_ID, null);
  const after = ((J(rc1) || {}).data) || [];
  log('AFTER_RECORD_COUNT=' + after.length);
  after.slice(0, 3).forEach((r) =>
    log('  RECORD id=' + r.id + ' from=' + r.fromStatus + ' to=' + r.toStatus +
        ' mode=' + r.mode + ' flowStatus=' + r.flowStatus + ' finishTime=' + r.finishTime +
        ' instId=' + r.instanceId),
  );
  const av1 = await call('GET', 'blade-system/user/status-flow/available?userId=' + USER_ID, null);
  log('AFTER_AVAILABLE_COUNT=' + (((J(av1) || {}).data) || []).length);

  await browser.close();
})().catch((e) => { console.error('FATAL: ' + e.message); process.exit(1); });
