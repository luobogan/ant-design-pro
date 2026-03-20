/**
 * Token 和权限管理工具
 * 适配 Umi 4 + ant-design-pro 6.x
 * 集成 Sword 项目的完整权限管理功能
 */

const TOKEN_KEY = 'sword-token';
const ACCESS_TOKEN_KEY = 'sword-access-token';
const AUTHORITY_KEY = 'sword-authority';
const USER_INFO_KEY = 'sword-user-info';
const CLIENT_TOKEN_KEY = 'sword-client-token';
const ROUTES_KEY = 'sword-routes';
const BUTTONS_KEY = 'sword-buttons';
const CAPTCHA_KEY_KEY = 'sword-captcha-key';

/**
 * 获取登录 Token
 */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * 设置登录 Token
 */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * 获取 Access Token
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * 设置 Access Token
 */
export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

/**
 * 获取客户端 Token
 */
export function getClientToken(): string | null {
  return localStorage.getItem(CLIENT_TOKEN_KEY);
}

/**
 * 设置客户端 Token
 */
export function setClientToken(token: string): void {
  localStorage.setItem(CLIENT_TOKEN_KEY, token);
}

/**
 * 获取权限列表
 */
export function getAuthority(): string[] {
  const authorityStr = localStorage.getItem(AUTHORITY_KEY);
  if (!authorityStr) return [];
  try {
    return JSON.parse(authorityStr);
  } catch {
    return [];
  }
}

/**
 * 设置权限列表
 */
export function setAuthority(authority: string[]): void {
  localStorage.setItem(AUTHORITY_KEY, JSON.stringify(authority));
}

/**
 * 获取用户信息
 */
export function getUserInfo<T = Record<string, any>>(): T | null {
  const userInfoStr = localStorage.getItem(USER_INFO_KEY);
  if (!userInfoStr) return null;
  try {
    return JSON.parse(userInfoStr);
  } catch {
    return null;
  }
}

/**
 * 设置用户信息
 */
export function setUserInfo<T = Record<string, any>>(userInfo: T): void {
  localStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo));
}

/**
 * 获取路由权限
 */
export function getRoutes(): any[] {
  const routesStr = localStorage.getItem(ROUTES_KEY);
  if (!routesStr) return [];
  try {
    return JSON.parse(routesStr);
  } catch {
    return [];
  }
}

/**
 * 设置路由权限
 */
export function setRoutes(routes: any[]): void {
  localStorage.removeItem(ROUTES_KEY);
  localStorage.setItem(ROUTES_KEY, JSON.stringify(routes));
}

/**
 * 获取按钮权限
 */
export function getButtons(): any[] {
  const buttonsStr = localStorage.getItem(BUTTONS_KEY);
  if (!buttonsStr) return [];
  try {
    return JSON.parse(buttonsStr);
  } catch {
    return [];
  }
}

/**
 * 获取指定代码的按钮权限
 */
export function getButton(code: string): any[] {
  const buttons = getButtons();
  const data = buttons.filter((d: any) => {
    return d.code === code;
  });
  // 菜单项的按钮存储在 children 字段中
  return data.length === 0 ? [] : (data[0].children || []);
}

/**
 * 检查是否有指定按钮权限
 */
export function hasButton(buttons: any[], code: string): boolean {
  return buttons.filter((button: any) => button.code === code).length > 0;
}

/**
 * 设置按钮权限
 */
export function setButtons(buttons: any[]): void {
  localStorage.removeItem(BUTTONS_KEY);
  localStorage.setItem(BUTTONS_KEY, JSON.stringify(buttons));
}

/**
 * 获取验证码 Key
 */
export function getCaptchaKey(): string | null {
  return localStorage.getItem(CAPTCHA_KEY_KEY);
}

/**
 * 设置验证码 Key
 */
export function setCaptchaKey(key: string): void {
  localStorage.removeItem(CAPTCHA_KEY_KEY);
  localStorage.setItem(CAPTCHA_KEY_KEY, key);
}

/**
 * 清除所有登录信息
 */
export function clearAuthority(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(AUTHORITY_KEY);
  localStorage.removeItem(USER_INFO_KEY);
  localStorage.removeItem(CLIENT_TOKEN_KEY);
  localStorage.removeItem(ROUTES_KEY);
  localStorage.removeItem(BUTTONS_KEY);
  localStorage.removeItem(CAPTCHA_KEY_KEY);
}

/**
 * 清除所有登录信息（别名）
 */
export function removeAll(): void {
  clearAuthority();
}

/**
 * 检查是否已登录（根据 Token）
 */
export function isLogin(): boolean {
  return !!getToken();
}

/**
 * 检查是否有指定权限
 */
export function hasAuthority(authorityCode: string): boolean {
  const authorities = getAuthority();
  return authorities.includes(authorityCode) || authorities.includes('*');
}

/**
 * 检查是否有任一权限
 */
export function hasAnyAuthority(authorityCodes: string[]): boolean {
  return authorityCodes.some((code) => hasAuthority(code));
}
