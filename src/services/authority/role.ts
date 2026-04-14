import { request } from '@umijs/max';
import { stringify } from 'qs';

// =====================角色===========================

// 获取角色列表
export async function list(params: any) {
  return request(`/api/blade-system/role/list?${stringify(params)}`);
}

// 获取角色树
export async function tree(params: any) {
  return request(`/api/blade-system/role/tree?${stringify(params)}`);
}

// 根据ID获取角色树
export async function treeById(params: any) {
  return request(`/api/blade-system/role/tree-by-id?${stringify(params)}`);
}

// 授权角色
export async function grant(params: any) {
  return request('/api/blade-system/role/grant', {
    method: 'POST',
    data: params,
  });
}

// 删除角色
export async function remove(params: any) {
  const ids = Array.isArray(params.ids) ? params.ids.join(',') : params.ids;
  return request(`/api/blade-system/role/remove?ids=${ids}`, {
    method: 'POST',
  });
}

// 提交角色信息
export async function submit(params: any) {
  return request('/api/blade-system/role/submit', {
    method: 'POST',
    data: params,
  });
}

// 获取角色详情
export async function detail(params: any) {
  return request(`/api/blade-system/role/detail?${stringify(params)}`);
}

// 获取角色下的用户列表
export async function getUsersByRoleId(roleId: string | number) {
  return request(`/api/blade-system/role/users?roleId=${roleId}`);
}

// 授权用户到角色
export async function grantUser(params: { roleId: string | number; userIds: (string | number)[] }) {
  return request('/api/blade-system/role/grant-user', {
    method: 'POST',
    data: params,
  });
}

// 取消用户的角色授权
export async function revokeUser(params: { roleId: string | number; userIds: (string | number)[] }) {
  return request('/api/blade-system/role/revoke-user', {
    method: 'POST',
    data: params,
  });
}
