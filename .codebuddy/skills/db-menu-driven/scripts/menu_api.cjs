#!/usr/bin/env node
/**
 * blade_menu 查询 / 更新工具（复用 springblade-dev-login 的登录能力拿真实 token）
 *
 * 用法：
 *   node menu_api.cjs list [关键词]              # 列出菜单树（可按 path/code/name 过滤）
 *   node menu_api.cjs buttons [关键词]           # 列出按钮树（组件页注册表来源）
 *   node menu_api.cjs detail <id>                # 查单条菜单
 *   node menu_api.cjs set-path <id> <新path>     # 修改 path（走 /menu/submit）
 *   node menu_api.cjs set <id> <字段> <值>       # 修改任意字段（如 isComponent 0）
 *
 * 环境变量（Playwright，必需）：
 *   PLAYWRIGHT_MODULE_DIR     = <项目>/node_modules
 *   PLAYWRIGHT_CHROMIUM_PATH  = <ms-playwright>/chromium_headless_shell-1243/.../chrome-headless-shell.exe
 */
const path = require('path');
const { execFileSync } = require('child_process');

const LOGIN_SCRIPT = path.join(
  __dirname, '..', '..', 'springblade-dev-login', 'scripts', 'pw_login.cjs'
);
const BASE = 'http://localhost:8000/api/blade-system/menu';

function getToken() {
  const out = execFileSync(process.execPath, [LOGIN_SCRIPT, '--account', 'admin',
    '--password', 'ant.design', '--tenant', '000000'], { encoding: 'utf8' });
  const line = out.split('\n').find((l) => l.startsWith('TOKEN='));
  if (line) return line.slice('TOKEN='.length).trim();
  // pw_login 偶发 LOGIN_FAIL(no alert)，此时从控制台日志兜底提取
  const m = out.match(/当前token:\s*([A-Za-z0-9\-\._]+)/);
  if (m) return m[1];
  throw new Error('登录失败，未拿到 token');
}

async function req(token, url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'blade-auth': `bearer ${token}`,
      'Authorization': 'Basic c3dvcmQ6c3dvcmRfc2VjcmV0',
      'Tenant-Id': '000000',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  return res.json();
}

const flatten = (nodes) => {
  const out = [];
  for (const n of nodes || []) { out.push(n); if (n.children) out.push(...flatten(n.children)); }
  return out;
};

const show = (rows) => rows.forEach((r) => console.log(
  `${String(r.id).padEnd(20)} ${String(r.code).padEnd(24)} cat=${r.category} comp=${r.isComponent} open=${r.isOpen}  ${r.path || ''}   [${r.name || ''}]`
));

(async () => {
  const [cmd, a1, a2, a3] = process.argv.slice(2);
  const token = getToken();

  if (cmd === 'list' || cmd === 'buttons') {
    const url = `${BASE}/${cmd === 'list' ? 'routes' : 'buttons'}`;
    const r = await req(token, url);
    let rows = flatten(r.data);
    if (a1) rows = rows.filter((x) => JSON.stringify(x).toLowerCase().includes(a1.toLowerCase()));
    show(rows);
  } else if (cmd === 'detail') {
    const r = await req(token, `${BASE}/detail?id=${a1}`);
    console.log(JSON.stringify(r.data, null, 2));
  } else if (cmd === 'set-path' || cmd === 'set') {
    const r1 = await req(token, `${BASE}/detail?id=${a1}`);
    const menu = r1.data;
    if (!menu) throw new Error(`未找到菜单 ${a1}`);
    const field = cmd === 'set-path' ? 'path' : a2;
    const value = cmd === 'set-path' ? a2 : a3;
    console.log(`修改前: ${field}=${menu[field]}`);
    menu[field] = /^\d+$/.test(value) ? Number(value) : value;
    const r2 = await req(token, `${BASE}/submit`, {
      method: 'POST', body: JSON.stringify(menu),
    });
    console.log(`提交: code=${r2.code} success=${r2.success} msg=${r2.msg}`);
    const r3 = await req(token, `${BASE}/detail?id=${a1}`);
    console.log(`修改后: ${field}=${r3.data[field]}`);
  } else {
    console.log(__doc__);
  }
})().catch((e) => { console.error('错误:', e.message); process.exit(1); });
