/**
 * Test B 后端等价验证（无需浏览器，与 UI 走完全相同的接口路径）：
 *  1) 租户000000（验证码关闭）：SM2 加密密码登录 → 应成功并签发 token
 *     （同时证明：SM2 前后端密钥匹配、按租户跳过验证码、凭证正确）
 *  2) 租户888888（验证码开启）不带验证码登录 → 应被拒（验证码错误）
 *  3) 携带 token 调 /param/submit 切换 captcha_mode:000000 → DB 值应翻转，再切回
 * 加密方式与前端 Login.tsx + crypto.ts 完全一致（sm2.doEncrypt(pw, publicKey, 0)）。
 */
import { sm2 } from 'sm-crypto';

// 与 config/defaultSettings.ts 完全一致的公钥（前端 Crypto.publicKey 同源）
const PUBLIC_KEY =
  '04ac02fe94f4cac62a57a2335cc96a075a1ee41cea3b211bd7acbb9cf579b7e601b9ece2b0cfab64dca268b6942bf556af67cfe226a5cf28d936039c43e4bb12c1';
const BASIC = 'Basic ' + Buffer.from('sword:sword_secret').toString('base64');
const PASSWORD = 'ant.design';
const GW = 'http://localhost:81';
const KEY = 'captcha_mode';

const log = (...a) => console.log('[verify]', ...a);
const result = { login000000: false, captchaRequired888888: false, toggle: false, restored: true };

function enc(p) {
  return sm2.doEncrypt(p, PUBLIC_KEY, 0);
}

async function login(tenantId) {
  const body = new URLSearchParams({
    grantType: 'captcha',
    tenantId,
    account: 'admin',
    password: enc(PASSWORD),
    scope: 'all',
  }).toString();
  const res = await fetch(`${GW}/blade-auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: BASIC },
    body,
  });
  const j = await res.json().catch(() => ({}));
  return { status: res.status, j };
}

function authHeaders(token) {
  return {
    'blade-auth': `bearer ${token}`,
    'Tenant-Id': '000000',
    'Content-Type': 'application/json',
  };
}

async function publicValue(tenantId) {
  const res = await fetch(`${GW}/blade-system/param/public-value?paramKey=${KEY}&tenantId=${tenantId}`);
  const j = await res.json().catch(() => ({}));
  return j.data ?? null;
}

async function paramDetail(token) {
  const res = await fetch(`${GW}/blade-system/param/detail?paramKey=${KEY}:000000`, {
    headers: authHeaders(token),
  });
  const j = await res.json().catch(() => ({}));
  return j.data ?? null;
}

async function submitParam(token, id, paramValue) {
  const res = await fetch(`${GW}/blade-system/param/submit`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      id,
      paramKey: `${KEY}:000000`,
      paramName: '登录验证码开关',
      paramValue,
      remark: `是否开启登录验证码（租户 000000，true/false）`,
    }),
  });
  const j = await res.json().catch(() => ({}));
  return { status: res.status, j };
}

try {
  // ---- 1) 租户000000：验证码关闭 → 登录成功 ----
  log('Step1: 登录 tenant=000000（captcha_mode=false，不带验证码）');
  const s1 = await login('000000');
  result.login000000 = s1.j?.code === 200 && !!s1.j?.data?.accessToken;
  log('Step1 结果:', result.login000000 ? '成功(签发token)' : `失败 code=${s1.j?.code} msg=${s1.j?.msg}`);

  if (result.login000000) {
    const token = s1.j.data.accessToken;

    // ---- 2) 租户888888：验证码开启 → 不带验证码应被拒 ----
    log('Step2: 登录 tenant=888888（captcha_mode=true，不带验证码）');
    const s2 = await login('888888');
    result.captchaRequired888888 = !(s2.j?.code === 200 && s2.j?.data?.accessToken);
    log('Step2 结果:', result.captchaRequired888888 ? '被拒(符合预期)' : '意外成功(不符合预期)', 'msg=', s2.j?.msg);

    // ---- 3) 切换开关 → DB 落库 → 切回 ----
    const before = await publicValue('000000');
    const detail = await paramDetail(token);
    const id = detail?.id;
    log('Step3: 切换前 db=', before, ' detail.id=', id);
    const flipped = String(before).toLowerCase() === 'true' ? 'false' : 'true';
    const sub = await submitParam(token, id, flipped);
    log('Step3: submit status=', sub.status, ' code=', sub.j?.code, ' msg=', sub.j?.msg);
    const after = await publicValue('000000');
    result.toggle = sub.status === 200 && String(after) === flipped;
    log('Step3: 切换后 db=', after, ' toggle=', result.toggle);

    // 切回原值，保持 Test A 前置条件
    const back = await submitParam(token, id, String(before));
    const restoredVal = await publicValue('000000');
    result.restored = back.status === 200 && String(restoredVal) === String(before);
    log('Step3: 已切回 db=', restoredVal, ' restored=', result.restored);
  }
} catch (e) {
  log('ERROR', e.message);
  result.error = e.message;
} finally {
  result.overall = result.login000000 && result.captchaRequired888888 && result.toggle && result.restored;
  console.log('VERIFY_SUMMARY=' + JSON.stringify(result, null, 2));
  process.exit(result.overall ? 0 : 1);
}
