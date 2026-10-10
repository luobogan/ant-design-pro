#!/usr/bin/env node
/** 尝试免验证码取 token（password 模式 / 多种形态），成功则落盘 */
const fs = require('fs');
const BASE = 'http://localhost:8000';
const BASIC = Buffer.from('sword:sword_secret').toString('base64');
const TF = 'C:\\Users\\Administrator\\sword_token.txt';
const H = { authorization: 'Basic ' + BASIC, 'tenant-id': '000000', 'Content-Type': 'application/x-www-form-urlencoded' };

const tries = [
  { name: 'oauth/token(query)', url: `${BASE}/api/blade-auth/oauth/token?grant_type=password&username=admin&password=ant.design&scope=all`, body: '' },
  { name: 'oauth/token(body)', url: `${BASE}/api/blade-auth/oauth/token`, body: 'grant_type=password&username=admin&password=ant.design&scope=all' },
  { name: 'token(query)', url: `${BASE}/api/blade-auth/token?grant_type=password&username=admin&password=ant.design&scope=all`, body: '' },
  { name: 'token(body)', url: `${BASE}/api/blade-auth/token`, body: 'grant_type=password&username=admin&password=ant.design&scope=all' },
  { name: 'oauth/token(client)', url: `${BASE}/api/blade-auth/oauth/token?grant_type=password&username=admin&password=ant.design&scope=all&client_id=sword&client_secret=sword_secret`, body: '' },
];

(async () => {
  for (const t of tries) {
    try {
      const r = await fetch(t.url, { method: 'POST', headers: H, body: t.body || undefined });
      const txt = await r.text();
      let j = null; try { j = JSON.parse(txt); } catch (e) {}
      const tok = j?.access_token || j?.data?.access_token || j?.data?.token || (typeof j?.data === 'string' ? j.data : null);
      console.log(`${t.name} -> ${r.status} ${txt.slice(0, 200)}`);
      if (tok) { fs.writeFileSync(TF, String(tok).replace(/^bearer\s+/i, '')); console.log('TOKEN_SAVED'); return; }
    } catch (e) {
      console.log(`${t.name} -> ERR ${e.message}`);
    }
  }
  console.log('NO_TOKEN');
})();
