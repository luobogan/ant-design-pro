#!/usr/bin/env node
/**
 * 验证会话列表按需加载：对比 hasMessage=true / false / 不传 三种请求的返回。
 * 用法: node msg_probe.cjs
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

  const probe = async (label, query) => {
    const t0 = Date.now();
    const r = await call('blade-message/message/session/page?' + query);
    const ms = Date.now() - t0;
    let j = null;
    try { j = JSON.parse(r.text); } catch (e) {}
    const data = j && j.data ? j.data : {};
    const records = data.records || [];
    log(`--- ${label} ---`);
    log(`  status=${r.status} 耗时=${ms}ms  total=${data.total}  本页条数=${records.length}`);
    records.slice(0, 3).forEach((s) => {
      log(`    id=${s.id} name=${s.name || '(私聊)'} lastMessage=${s.lastMessage === null || s.lastMessage === undefined ? '(空)' : String(s.lastMessage).slice(0, 20)} memberCount=${s.memberCount}`);
    });
    // 校验：过滤是否严格成立
    const expectNull = query.includes('hasMessage=false');
    const expectNotNull = query.includes('hasMessage=true');
    if (expectNull || expectNotNull) {
      const bad = records.filter((s) => {
        const empty = s.lastMessage === null || s.lastMessage === undefined || s.lastMessage === '';
        return expectNull ? !empty : empty;
      });
      log(`  过滤校验: ${bad.length === 0 ? '通过' : '不通过(异常 ' + bad.length + ' 条)'}`);
    }
  };

  await probe('首屏-仅有消息(hasMessage=true)', 'current=1&size=20&hasMessage=true');
  await probe('按需-仅无消息(hasMessage=false)', 'current=1&size=20&hasMessage=false');
  await probe('兼容-不过滤(不传)', 'current=1&size=20');

  await browser.close();
})().catch((e) => { console.error('FATAL: ' + e.message); process.exit(1); });
