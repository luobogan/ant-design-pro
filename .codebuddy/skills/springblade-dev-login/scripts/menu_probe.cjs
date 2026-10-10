#!/usr/bin/env node
/**
 * 检查后端菜单是否注册了 /message 路由（前端 /message 由后端菜单驱动注册）。
 * 用法: node menu_probe.cjs [关键字]   默认关键字 message
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
const KW = (process.argv[2] || 'message').toLowerCase();
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

  const call = (ep) =>
    page.evaluate(async (a) => {
      const r = await fetch('http://localhost:8000/api/' + a.ep, {
        method: 'GET',
        headers: {
          'blade-auth': 'bearer ' + a.tk,
          authorization: 'Basic ' + a.basic,
          'tenant-id': '000000',
        },
      });
      return { status: r.status, text: await r.text() };
    }, { ep, tk: token, basic: BASIC });

  // 1) 菜单分页：找 path 含关键字的
  const r = await call('blade-system/menu/list?current=1&size=300');
  let j = null;
  try { j = JSON.parse(r.text); } catch (e) {}
  const data = (j && j.data) || {};
  const records = data.records || data || [];
  log(`MENU_LIST status=${r.status} total=${data.total ?? records.length}`);
  const hits = records.filter((m) =>
    String(m.path || '').toLowerCase().includes(KW) ||
    String(m.component || '').toLowerCase().includes(KW) ||
    String(m.name || '').toLowerCase().includes(KW) ||
    String(m.code || '').toLowerCase().includes(KW),
  );
  log(`命中「${KW}」的菜单: ${hits.length} 条`);
  hits.forEach((m) =>
    log(`  id=${m.id} name=${m.name} code=${m.code} path=${m.path} component=${m.component} parentId=${m.parentId} category=${m.category}`),
  );

  // 2) 动态路由：看 /message 是否被注册
  const rr = await call('blade-system/menu/routes');
  let rj = null;
  try { rj = JSON.parse(rr.text); } catch (e) {}
  const payload = rj && rj.data !== undefined ? rj.data : rj;
  const flat = [];
  const walk = (arr) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((n) => {
      flat.push(n);
      walk(n.children || n.routes);
    });
  };
  walk(payload);
  log(`ROUTES status=${rr.status} 节点数=${flat.length}`);
  log(`/message 是否在动态路由中: ${flat.some((n) => String(n.path) === '/message')}`);
  flat
    .filter((n) => String(n.path || '').toLowerCase().includes(KW) || String(n.component || '').toLowerCase().includes(KW))
    .forEach((n) => log(`  路由 path=${n.path} component=${n.component} name=${n.name}`));

  await browser.close();
})().catch((e) => { console.error('FATAL: ' + e.message); process.exit(1); });
