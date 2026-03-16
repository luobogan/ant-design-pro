import { Base64 } from 'js-base64';
import Settings from '../../config/defaultSettings';

/**
 * 生成客户端认证的Basic Auth头
 * @returns Basic Auth字符串
 */
export const getBasicAuth = (): string => {
  const clientId = Settings.clientId || 'sword';
  const clientSecret = Settings.clientSecret || 'sword_secret';
  return `Basic ${Base64.encode(`${clientId}:${clientSecret}`)}`;
};

/**
 * 检查是否启用了验证码
 * @returns 是否启用验证码
 */
export const isCaptchaEnabled = (): boolean => {
  return Settings.captchaMode === true;
};

/**
 * 检查是否启用了租户模式
 * @returns 是否启用租户模式
 */
export const isTenantEnabled = (): boolean => {
  return Settings.tenantMode === true;
};
