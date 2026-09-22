/* 临时脚本：登录 SpringBlade 后端并保存 BPMN 到 defId=2102344953721012225 */
const fs = require('fs');
const path = require('path');
const { sm2 } = require('sm-crypto');

const GATEWAY = 'http://127.0.0.1:81';
const DEF_ID = 2102344953721012225;
const PUBLIC_KEY =
  '04ac02fe94f4cac62a57a2335cc96a075a1ee41cea3b211bd7acbb9cf579b7e601b9ece2b0cfab64dca268b6942bf556af67cfe226a5cf28d936039c43e4bb12c1';
const ACCOUNT = 'admin';
const PASSWORD = 'blade';

(async () => {
  // 1) SM2 加密密码（对齐前端 sm-crypto doEncrypt(..., 0)）
  const encPassword = sm2.doEncrypt(PASSWORD, PUBLIC_KEY, 0);
  console.log('[SM2] encPassword len =', encPassword.length);

  // 2) 登录获取 token
  const loginResp = await fetch(`${GATEWAY}/blade-auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from('saber:saber_secret').toString('base64'),
    },
    body: new URLSearchParams({
      grantType: 'password',
      tenantId: '000000',
      account: ACCOUNT,
      password: encPassword,
    }).toString(),
  });
  const loginJson = await loginResp.json();
  console.log('[LOGIN] status =', loginResp.status, 'code =', loginJson.code, 'msg =', loginJson.msg);
  if (loginJson.code !== 200) {
    console.error('[LOGIN] 失败:', JSON.stringify(loginJson));
    process.exit(1);
  }
  const token =
    (loginJson.data && (loginJson.data.accessToken || loginJson.data.token)) || null;
  if (!token) {
    console.error('[LOGIN] 未取到 token:', JSON.stringify(loginJson.data));
    process.exit(1);
  }
  console.log('[LOGIN] token 前缀 =', token.substring(0, 20) + '...');

  // 3) 读取 BPMN 并 base64 编码（对齐前端 utf8ToBase64）
  const bpmnPath = path.resolve(
    __dirname,
    'src/pages/FormMode/WorkflowDesign/FullTestProcess_2102344953721012225.bpmn',
  );
  const xml = fs.readFileSync(bpmnPath, 'utf8');
  const bpmnXml = Buffer.from(xml, 'utf8').toString('base64');

  // 4) 保存 BPMN
  const saveResp = await fetch(
    `${GATEWAY}/blade-workflow/definition/${DEF_ID}/bpmn`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Blade-Auth': `bearer ${token}`,
        'Tenant-Id': '000000',
      },
      body: JSON.stringify({ bpmnXml }),
    },
  );
  const saveJson = await saveResp.json();
  console.log('[SAVE] status =', saveResp.status, 'code =', saveJson.code, 'msg =', saveJson.msg);
  console.log('[SAVE] result =', JSON.stringify(saveJson.data));
  if (saveJson.code !== 200) {
    console.error('[SAVE] 失败:', JSON.stringify(saveJson));
    process.exit(1);
  }
  console.log('[OK] 保存成功');
})().catch((e) => {
  console.error('异常:', e);
  process.exit(1);
});
