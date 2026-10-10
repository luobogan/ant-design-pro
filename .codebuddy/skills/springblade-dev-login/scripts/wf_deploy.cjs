#!/usr/bin/env node
/**
 * 部署 person_status_change.bpmn20.xml（人员状态变更审批）。
 *   node wf_deploy.cjs list    —— 查看现有流程定义（含 procKey / 状态）
 *   node wf_deploy.cjs deploy  —— /definition/import 导入 -> /definition/{id}/deploy 发布
 */
const fs = require('fs');
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
const BPMN = 'D:\\project\\springbladeandreact\\SpringBlade\\doc\\bpmn\\person_status_change.bpmn20.xml';
const MODE = process.argv[2] || 'list';

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
  console.log('LOGIN_OK');
  // 登录成功后前端会重定向，等跳转稳定再 evaluate，避免 execution context destroyed
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

  if (MODE === 'list') {
    const list = await call('GET', 'blade-workflow/definition/list', null);
    console.log('LIST_STATUS=' + list.status);
    try {
      const j = JSON.parse(list.text);
      const arr = (j && j.data) || [];
      console.log('COUNT=' + arr.length);
      arr.forEach((d) =>
        console.log(
          'DEF id=' + d.id + ' | procKey=' + d.procKey + ' | name=' + d.name +
          ' | status=' + d.status + ' | tenant=' + d.tenantId + ' | formId=' + d.formId,
        ),
      );
    } catch (e) {
      console.log('LIST_RAW=' + list.text.slice(0, 2000));
    }
    await browser.close();
    return;
  }

  // redeploy: 把最新 BPMN 推给已有定义并重新发布
  if (MODE === 'redeploy') {
    const defId = process.argv[3];
    if (!defId) { console.log('NEED_DEF_ID'); await browser.close(); return; }
    const xml2 = fs.readFileSync(BPMN, 'utf8');
    const imp2 = await call('POST', 'blade-workflow/definition/' + defId + '/import-bpmn', { bpmnXml: xml2 });
    console.log('IMPORT_BPMN_STATUS=' + imp2.status);
    console.log('IMPORT_BPMN=' + imp2.text.slice(0, 400));
    const dep2 = await call('POST', 'blade-workflow/definition/' + defId + '/deploy', null);
    console.log('REDEPLOY_STATUS=' + dep2.status);
    console.log('REDEPLOY=' + dep2.text.slice(0, 400));
    await browser.close();
    return;
  }

  // deploy: import -> deploy
  const xml = fs.readFileSync(BPMN, 'utf8');
  const imp = await call('POST', 'blade-workflow/definition/import', {
    name: '人员状态变更审批',
    bpmnXml: xml,
  });
  console.log('IMPORT_STATUS=' + imp.status);
  console.log('IMPORT=' + imp.text.slice(0, 800));
  let defId = null;
  try { const j = JSON.parse(imp.text); defId = j && j.data ? String(j.data) : null; } catch (e) {}
  if (!defId) { console.log('NO_DEF_ID_ABORT'); await browser.close(); return; }
  console.log('DEFID=' + defId);

  const dep = await call('POST', 'blade-workflow/definition/' + defId + '/deploy', null);
  console.log('DEPLOY_STATUS=' + dep.status);
  console.log('DEPLOY=' + dep.text.slice(0, 800));

  await browser.close();
})().catch((e) => { console.error('FATAL: ' + e.message); process.exit(1); });
