#!/usr/bin/env node
/**
 * 为两个「独立页」补齐菜单驱动所需的数据（幂等）：
 *   /formmode/exceldesign/ExcelPreviewPage  → code=excel_preview_page
 *   /formmode/approval/ApprovalPage         → code=approval_page
 * 依据 doc/sql/migration/V2026.09.16_001__excel_preview_page_menu.sql：
 *   category=2（组件型，不进侧边栏） + is_component=1（生成路由） + is_open=2（独立页，不套 ProLayout）
 * 先打印现状与选中的父菜单，缺失才 POST /menu/submit 创建。
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
const log = (s) => console.log(typeof s === 'string' ? s : JSON.stringify(s));

const TARGETS = [
  {
    code: 'excel_preview_page',
    name: '表单预览',
    path: '/formmode/exceldesign/ExcelPreviewPage',
    parentHints: ['exceldesign'],
    parentPathHint: 'exceldesign',
    remark: 'Excel 表单预览独立页（菜单驱动路由；is_open=2 = 不套 ProLayout）',
  },
  {
    code: 'approval_page',
    name: '流程审批',
    path: '/formmode/approval/ApprovalPage',
    parentHints: ['workflow_todo', 'workflow', 'formmode_approval'],
    parentPathHint: 'workflow',
    remark: '流程审批独立页（菜单驱动路由；is_open=2 = 不套 ProLayout）',
  },
];

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

  // 收集全部菜单（/menu/list 主要是一级菜单，/menu/buttons 含组件型/按钮型）
  const all = [];
  const collect = (res) => {
    const j = J(res);
    const d = j && j.data !== undefined ? j.data : j;
    const push = (arr) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((n) => { all.push(n); push(n.children || n.routes); });
    };
    push(Array.isArray(d) ? d : d && d.records ? d.records : []);
  };
  collect(await call('GET', 'blade-system/menu/list?current=1&size=300', null));
  collect(await call('GET', 'blade-system/menu/buttons', null));
  log(`已收集菜单节点: ${all.length}`);

  const findBy = (pred) => all.find(pred);

  for (const t of TARGETS) {
    log(`\n--- ${t.code} (${t.path}) ---`);
    const exist = findBy((m) => String(m.code) === t.code);
    if (exist) {
      log(`已存在，跳过. id=${exist.id} name=${exist.name} path=${exist.path} category=${exist.category} isOpen=${exist.isOpen} isComponent=${exist.isComponent}`);
      continue;
    }
    // 选父菜单
    let parent = null;
    for (const hint of t.parentHints) {
      parent = findBy((m) => String(m.code) === hint);
      if (parent) break;
    }
    if (!parent) parent = findBy((m) => String(m.path || '').includes(t.parentPathHint));
    if (!parent) { log(`未找到父菜单，跳过（hints=${t.parentHints.join(',')}）`); continue; }
    log(`父菜单: id=${parent.id} code=${parent.code} name=${parent.name} path=${parent.path} tenantId=${parent.tenantId}`);

    const payload = {
      parentId: Number(parent.id),
      code: t.code,
      name: t.name,
      alias: t.code,
      path: t.path,
      source: '',
      sort: 2,
      category: 2,
      action: 1,
      isOpen: 2,
      isComponent: 1,
      remark: t.remark,
      tenantId: parent.tenantId || '000000',
    };
    const r = await call('POST', 'blade-system/menu/submit', payload);
    log(`submit status=${r.status} resp=${r.text.slice(0, 200)}`);
  }

  // 复核：是否在动态路由中
  const rr = await call('GET', 'blade-system/menu/routes', null);
  const jr = J(rr);
  const nodes = [];
  const walk = (arr) => { if (Array.isArray(arr)) arr.forEach((n) => { nodes.push(n); walk(n.children || n.routes); }); };
  walk(jr && jr.data !== undefined ? jr.data : jr);
  log(`\n路由节点数=${nodes.length}`);
  TARGETS.forEach((t) => {
    log(`  ${t.path} 在动态路由中: ${nodes.some((n) => String(n.path) === t.path)}`);
  });

  await browser.close();
})().catch((e) => { console.error('FATAL: ' + e.message); process.exit(1); });
