#!/usr/bin/env node
/* 复用落盘 token：重跑回填（此时种子行已删）+ 取两端点，反向确认删数据后读空。 */
const fs = require('fs');
const OUT = 'C:\\Users\\Administrator\\cleanup_out.log';
try { fs.writeFileSync(OUT, ''); } catch (e) {}
const log = (s) => { const l = typeof s === 'string' ? s : JSON.stringify(s); console.log(l); try { fs.appendFileSync(OUT, l + '\n'); } catch (e) {} };
const BASIC = Buffer.from('sword:sword_secret').toString('base64');
const BASE = 'http://localhost:8000';
const DEFID = '2100918142244032513';
const NODE = 'Activity_16wyet2';
const H = (tk) => ({ 'blade-auth': 'bearer ' + tk, authorization: 'Basic ' + BASIC, 'tenant-id': '000000', 'Content-Type': 'application/json' });
const api = async (tk, p) => { const r = await fetch(BASE + p, { headers: H(tk) }); const t = await r.text(); let b; try { b = JSON.parse(t); } catch (e) { b = t.slice(0, 300); } return { status: r.status, body: b }; };
(async () => {
  const token = fs.readFileSync('C:\\Users\\Administrator\\sword_token.txt', 'utf8').trim();
  log('BACKFILL=' + JSON.stringify(await api(token, `/api/blade-workflow/migration/backfill?defId=${DEFID}&force=true`)));
  await new Promise((r) => setTimeout(r, 2500));
  log('TIMEOUT_AFTER_CLEANUP=' + JSON.stringify(await api(token, `/api/blade-workflow/node-timeout/list?defId=${DEFID}&nodeKey=${NODE}`)));
  log('DETAIL_FILTER_AFTER_CLEANUP=' + JSON.stringify(await api(token, `/api/blade-workflow/definition/${DEFID}/node/${NODE}/detail-filter`)));
  log('DONE');
})().catch((e) => log('FATAL: ' + e.message));
