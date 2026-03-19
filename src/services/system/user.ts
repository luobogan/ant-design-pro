import { request } from '@umijs/max';
import { stringify } from 'qs';
import { API_BASE_PATH, APPLICATION_SYSTEM_NAME } from '@/constants';

// =====================用户===========================

const USER_BASE_URL = `${API_BASE_PATH}/${APPLICATION_SYSTEM_NAME}/user`;

// 获取用户列表
export async function list(params: any) {
  return request(`${USER_BASE_URL}/list?${stringify(params)}`);
}

// 获取用户详情
export async function detail(params: any) {
  return request(`${USER_BASE_URL}/detail?${stringify(params)}`);
}

// 提交用户信息
export async function submit(params: any) {
  return request(`${USER_BASE_URL}/submit`, {
    method: 'POST',
    data: params,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

// 更新用户信息
export async function update(params: any) {
  return request(`${USER_BASE_URL}/update`, {
    method: 'POST',
    data: params,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

// 删除用户
export async function remove(params: any) {
  return request(`${USER_BASE_URL}/remove`, {
    method: 'POST',
    data: params,
  });
}

// 获取用户选择列表
export async function select(params: any) {
  return request(`${USER_BASE_URL}/select?${stringify(params)}`);
}

// 获取用户角色
export async function roles(params: any) {
  return request(`/api/blade-system/user/roles?${stringify(params)}`);
}

// 分配用户角色
export async function grantRole(params: any) {
  return request('/api/blade-system/user/grant-role', {
    method: 'POST',
    data: params,
  });
}

// 获取用户权限
export async function permissions(params: any) {
  return request(`/api/blade-system/user/permissions?${stringify(params)}`);
}

// 重置用户密码
export async function resetPassword(params: any) {
  return request('/api/blade-system/user/reset-password', {
    method: 'POST',
    data: params,
  });
}

// 修改用户密码
export async function updatePassword(params: any) {
  return request('/api/blade-system/user/update-password', {
    method: 'POST',
    data: params,
  });
}

// 冻结用户
export async function freeze(params: any) {
  return request('/api/blade-system/user/freeze', {
    method: 'POST',
    data: params,
  });
}

// 解冻用户
export async function unfreeze(params: any) {
  return request('/api/blade-system/user/unfreeze', {
    method: 'POST',
    data: params,
  });
}

// 导入用户
export async function importUser(params: any) {
  return request('/api/blade-system/user/import', {
    method: 'POST',
    data: params,
  });
}

// 导出用户
export async function exportUser(params: any) {
  return request(`/api/blade-system/user/export?${stringify(params)}`);
}

// 获取用户导入模板
export async function importTemplate() {
  return request('/api/blade-system/user/import-template');
}
