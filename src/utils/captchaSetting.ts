import Settings from '../../config/defaultSettings';
import {
  getParamDetail,
  getParamPublicValue,
  saveParam,
} from '@/services/system/param';
import { getTenantId } from '@/utils/authority';

/** 数据库参数键：是否开启登录验证码 */
export const CAPTCHA_PARAM_KEY = 'captcha_mode';

/** 默认租户（登录页未选择租户时使用的兜底租户） */
export const DEFAULT_TENANT_ID = '000000';

/**
 * 按租户从数据库加载「是否开启登录验证码」，并覆盖 defaultSettings 中的兜底默认值。
 * 登录页在用户选择/填写租户后调用，实现各租户独立控制。
 * 语义：默认不显示验证码；只有该租户显式配置 captcha_mode=true 才显示（未配置/接口异常均按关闭处理）。
 * @param tenantId 目标租户（默认 000000）
 */
export async function loadCaptchaMode(
  tenantId: string = DEFAULT_TENANT_ID,
): Promise<boolean> {
  try {
    const value = await getParamPublicValue(CAPTCHA_PARAM_KEY, tenantId);
    // 后端无值时 data 为 null / {}（空对象），一律当作「未配置」→ 默认不显示验证码。
    // 只有对应租户显式配置 param_value='true' 才开启，与登录页「默认不显示」及后端 fail-open 语义一致。
    const isEmpty =
      value == null ||
      value === '' ||
      (typeof value === 'object' && Object.keys(value).length === 0);
    const enabled = !isEmpty && String(value).toLowerCase() === 'true';
    Settings.captchaMode = enabled;
  } catch (e) {
    // 公开接口不可用时（如后端尚未部署）回落到默认关闭，不影响登录
    console.warn('[captcha] 从数据库加载验证码开关失败，默认不显示验证码', e);
    Settings.captchaMode = false;
  }
  return Settings.captchaMode === true;
}

/**
 * 保存「是否开启登录验证码」到数据库，并立即在本地生效。
 * 按当前管理员所在租户隔离：有效参数键 = captcha_mode:<tenantId>。
 * 写操作需管理员权限（后端 /param/submit 已限定 HAS_ROLE_ADMIN）。
 */
export async function saveCaptchaMode(enabled: boolean): Promise<void> {
  const tenantId = getTenantId() || DEFAULT_TENANT_ID;
  const paramKey = `${CAPTCHA_PARAM_KEY}:${tenantId}`;
  const existing = await getParamDetail(paramKey).catch(() => undefined);
  // 本地即时生效，无需等待下次刷新
  Settings.captchaMode = enabled;
  await saveParam({
    id: existing?.id,
    paramKey,
    paramName: '登录验证码开关',
    paramValue: enabled ? 'true' : 'false',
    remark: `是否开启登录验证码（租户 ${tenantId}，true/false）`,
  });
}
