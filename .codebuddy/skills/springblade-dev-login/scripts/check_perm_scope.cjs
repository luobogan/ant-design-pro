#!/usr/bin/env node
/** 核对：field-perm 读端点的 scope（修复后应为 BPMN 写入的 main/dt{n}，而非全 main） */
const fs = require('fs');
const TF = 'C:\\Users\\Administrator\\sword_token.txt';
const BASE = 'http://localhost:8000';
const DEFID = '2100918142244032513';
const NODE = 'Activity_16wyet2';
const BASIC = Buffer.from('sword:sword_secret').toString('base64');
const H = (tk) => ({ 'blade-auth': 'bearer ' + tk, authorization: 'Basic ' + BASIC, 'tenant-id': '000000' });
(async () => {
  const token = fs.readFileSync(TF, 'utf8').trim();
  for (const p of [
    `/api/blade-workflow/definition/${DEFID}/node/${NODE}/field-perm`,
    `/api/blade-workflow/node-timeout/list?defId=${DEFID}&nodeKey=${NODE}`,
    `/api/blade-workflow/definition/${DEFID}/node/${NODE}/detail-filter`,
  ]) {
    const r = await fetch(BASE + p, { headers: H(token) });
    const j = await r.json().catch(() => null);
    const d = Array.isArray(j?.data) ? j.data : [];
    console.log(p.replace('/api/blade-workflow', '') + ' -> ' + r.status + ' count=' + d.length);
    if (d.length && p.includes('field-perm')) {
      console.log('   ' + JSON.stringify(d.map((x) => x.scope + '|' + x.fieldName + '|' + x.perm)));
    }
  }
})();
