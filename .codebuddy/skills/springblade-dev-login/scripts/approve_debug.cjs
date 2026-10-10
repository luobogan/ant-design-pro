#!/usr/bin/env node
/**
 * 调试：办理自动发起实例 → 点提交 → 抓取校验/错误提示
 */
const { chromium } = (() => {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE_DIR,
    'D:/project/node-win-x64/node_cache/_npx/0b9ff77863cb6e9f/node_modules',
    'D:/project/node-win-x64/node_cache/_npx',
  ].filter(Boolean);
  for (const d of candidates) {
    try { return { chromium: require(require.resolve('playwright', { paths: [d] })).chromium }; } catch (e) {}
    try { return { chromium: require(d + '/playwright').chromium }; } catch (e) {}
  }
  return require('playwright');
})();
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH ||
  'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1208\\chrome-headless-shell-win64\\chrome-headless-shell.exe';
const BASE = 'http://localhost:8000';
const fs = require('fs');
const LOGF = 'D:/workproject/springbladeandreact/debug_steps.log';
const log = (m) => { try { fs.appendFileSync(LOGF, m + '\n'); } catch (e) {} };

(async () => {
  const browser = await (async () => {
    try { return await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH, args: ['--no-sandbox'] }); }
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
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !!localStorage.getItem('sword-token'), null, { timeout: 30000 });
  log('CHECKPOINT_LOGGED_IN');
  await page.waitForTimeout(3000);
  await page.goto(BASE + '/workflow/todo', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(4000);
  log('CHECKPOINT_TODO_OPEN');

  let popup;
  try {
    const r = await Promise.all([
      ctx.waitForEvent('page', { timeout: 20000 }),
      page.locator('tr.ant-table-row').first().getByText('办理', { exact: true }).click(),
    ]);
    popup = r[0];
  } catch (e) {
    log('CHECKPOINT_POPUP_FAIL=' + e.message.split('\n')[0]);
    throw e;
  }
  log('CHECKPOINT_POPUP_EVENT');
  await popup.waitForLoadState('domcontentloaded').catch(() => {});
  await popup.waitForTimeout(8000);
  log('POPUP_URL=' + popup.url());

  // 表单里所有控件的概况
  const info = await popup.evaluate(() => {
    const out = { required: [], emptyInputs: [], selects: [], textareas: [] };
    document.querySelectorAll('[required],.ant-form-item-required').forEach((el) => {
      const label = el.closest('.ant-form-item')?.querySelector('.ant-form-item-label,label')?.innerText || el.innerText || '';
      out.required.push(label.replace(/\s+/g, ' ').slice(0, 40));
    });
    document.querySelectorAll('input').forEach((i) => {
      if (!i.value && !i.disabled && i.type !== 'hidden') out.emptyInputs.push(i.placeholder || i.name || i.id || 'input');
    });
    document.querySelectorAll('select').forEach((s) => out.selects.push(s.name || 'select'));
    document.querySelectorAll('textarea').forEach((t) => out.textareas.push((t.value || '(空)').slice(0, 30)));
    return out;
  });
  log('FORM_INFO=' + JSON.stringify(info));

  // 填写签字意见（TinyMCE 禁用时是普通 textarea）后再提交
  await popup.evaluate(() => {
    document.querySelectorAll('textarea').forEach((t) => {
      if (!t.value && !t.disabled) {
        t.value = '同意';
        t.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  });
  const btn = popup.locator('button').filter({ hasText: /提\s*交/ }).first();
  await btn.click();
  await popup.waitForTimeout(3000);

  // 抓取 antd message / 校验错误 / 弹窗文本
  const errs = await popup.evaluate(() => {
    const out = [];
    document.querySelectorAll('.ant-message, .ant-message-notice, .ant-notification-notice').forEach((m) => {
      const t = (m.innerText || '').trim();
      if (t) out.push('MSG: ' + t.slice(0, 120));
    });
    document.querySelectorAll('.ant-form-item-explain-error, .has-error, .ant-form-item-explain').forEach((m) => {
      const t = (m.innerText || '').trim();
      if (t) out.push('VALIDATE: ' + t.slice(0, 120));
    });
    const dlg = document.querySelector('.ant-modal-confirm, .ant-modal-body');
    if (dlg) out.push('DIALOG: ' + (dlg.innerText || '').replace(/\s+/g, ' ').slice(0, 200));
    return out;
  });
  log('AFTER_SUBMIT=' + JSON.stringify(errs, null, 1));
  try { await popup.screenshot({ path: 'C:/Users/Administrator/AppData/Local/Temp/approve_test/debug.png', fullPage: false }); } catch (e) {}
  await browser.close();
})().catch((e) => { console.error('FATAL: ' + e.message); process.exit(1); });
