#!/usr/bin/env node
/**
 * 审批指定实例的在途待办，并校验业务落库结果。
 * 用法: node wf_psf_approve.cjs <instId> <userId> [approverId]   默认 approverId=3
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
const INST_ID = process.argv[2];
const USER_ID = process.argv[3] || '3';
const APPROVER_ID = process.argv[4] || '3';
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

  const findTask = async (who) => {
    const r = await call('GET', 'blade-workflow/task/todo?assignee=' + who, null);
    const arr = ((J(r) || {}).data) || [];
    return arr.filter((t) => String(t.instId) === String(INST_ID) || String(t.instanceId) === String(INST_ID));
  };

  let tasks = await findTask(APPROVER_ID);
  if (!tasks.length) tasks = await findTask(USER_ID);
  log('PENDING_TASKS=' + tasks.length);
  tasks.forEach((t) => log('  TASK id=' + t.id + ' nodeKey=' + t.nodeKey));

  let guard = 0;
  while (tasks.length && guard++ < 4) {
    const t = tasks[0];
    const ap = await call('POST', 'blade-workflow/task/' + t.id + '/approve', {
      opinion: 'E2E同意',
      variables: { wfOutcome: 'approve' },
    });
    log('APPROVE(' + t.nodeKey + ') status=' + ap.status + ' resp=' + ap.text.slice(0, 220));
    if (ap.status !== 200) break;
    tasks = await findTask(APPROVER_ID);
    if (!tasks.length) tasks = await findTask(USER_ID);
  }

  await page.waitForTimeout(3000);
  const rc = await call('GET', 'blade-system/user/status-flow/records?userId=' + USER_ID, null);
  const list = ((J(rc) || {}).data) || [];
  log('RECORDS=' + list.length);
  list.slice(0, 3).forEach((r) =>
    log('  RECORD id=' + r.id + ' from=' + r.fromStatus + ' to=' + r.toStatus +
        ' mode=' + r.mode + ' flowStatus=' + r.flowStatus + ' finishTime=' + r.finishTime),
  );
  const av = await call('GET', 'blade-system/user/status-flow/available?userId=' + USER_ID, null);
  log('AVAILABLE_COUNT=' + (((J(av) || {}).data) || []).length);
  await browser.close();
})().catch((e) => { console.error('FATAL: ' + e.message); process.exit(1); });
