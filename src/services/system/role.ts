import { request } from '@umijs/max';
import { stringify } from 'qs';

// =====================角色===========================

// 获取角色列表（无权限注解，任意登录用户可查；供门户授权"角色可见"选择器使用）
export async function list(params: any) {
  return request(`/api/blade-system/role/list?${stringify(params)}`);
}
