#!/usr/bin/env node
/**
 * person_status_change 审批闭环端到端验证：
 *   发起(initiator=admin, approver=其他用户) -> 「发起办理」自动/手动完成
 *   -> 「主管审批」显式 approve(wfOutcome=approve) -> 走到「审批通过」结束事件
 *   -> 校验实例结束 + 流转日志
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
const PROC_KEY = 'person_status_change';
const APPROVER_ID = process.argv[2] || '3'; // 审批人（故意与发起人不同，制造真实审批节点）

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

  // 发起人 admin
  const u = await call('GET', 'blade-system/user/list?current=1&pageSize=1&account=admin', null);
  const uj = J(u);
  const recs = uj && uj.data && uj.data.records ? uj.data.records : Array.isArray(uj && uj.data) ? uj.data : [];
  if (!recs.length) { log('NO_ADMIN_USER: ' + u.text.slice(0, 300)); await browser.close(); return; }
  const adminId = String(recs[0].id);
  log('INITIATOR(admin)=' + adminId + '  APPROVER=' + APPROVER_ID);

  // 发起（wfOutcome 给安全默认值，避免网关求值时变量未定义）
  const start = await call('POST', 'blade-workflow/instance/start', {
    procKey: PROC_KEY,
    tenantId: '000000',
    // 必须以 PSF: 开头，否则 WfBizCallbackListener 的标题前缀门禁会静默跳过回调
    title: 'PSF:E2E闭环验证-人员状态变更',
    starter: Number(adminId),
    variables: {
      initiator: adminId,
      approver: APPROVER_ID,
      userId: adminId,
      fromStatus: '1',
      toStatus: '2',
      wfOutcome: 'approve',
    },
  });
  log('START_STATUS=' + start.status);
  log('START=' + start.text.slice(0, 400));
  const sj = J(start);
  const instId = sj && sj.data && typeof sj.data === 'string' ? sj.data : null;
  if (!instId) { log('NO_INST_ID_ABORT'); await browser.close(); return; }
  log('INST_ID=' + instId);

  // 查当前节点
  const d0 = await call('GET', 'blade-workflow/instance/' + instId, null);
  log('AFTER_START_DETAIL=' + d0.text.slice(0, 700));

  // 找当前待办（审批人视角 + 发起人视角都查，取本实例的）
  const findTask = async (who) => {
    const r = await call('GET', 'blade-workflow/task/todo?assignee=' + who, null);
    const j = J(r);
    const arr = (j && j.data) || [];
    return arr.filter((t) => String(t.instId) === instId || String(t.instanceId) === instId);
  };
  let tasks = await findTask(APPROVER_ID);
  if (!tasks.length) tasks = await findTask(adminId);
  log('PENDING_TASKS=' + tasks.length);
  tasks.forEach((t) => log('  TASK id=' + t.id + ' nodeKey=' + t.nodeKey + ' name=' + (t.name || t.taskName)));

  // 逐个审批通过（wfOutcome=approve）
  let guard = 0;
  while (tasks.length && guard++ < 4) {
    const t = tasks[0];
    const ap = await call('POST', 'blade-workflow/task/' + t.id + '/approve', {
      opinion: 'E2E同意',
      variables: { wfOutcome: 'approve' },
    });
    log('APPROVE(' + t.nodeKey + ') status=' + ap.status + ' resp=' + ap.text.slice(0, 250));
    if (ap.status !== 200) break;
    tasks = await findTask(APPROVER_ID);
    if (!tasks.length) tasks = await findTask(adminId);
    log('  REMAINING=' + tasks.length);
  }

  // 终态校验
  const det = await call('GET', 'blade-workflow/instance/' + instId, null);
  log('FINAL_DETAIL=' + det.text.slice(0, 900));
  const lg = await call('GET', 'blade-workflow/instance/' + instId + '/logs', null);
  log('LOGS=' + lg.text.slice(0, 900));

  await browser.close();
})().catch((e) => { console.error('FATAL: ' + e.message); process.exit(1); });
