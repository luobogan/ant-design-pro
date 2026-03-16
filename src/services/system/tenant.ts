import { request } from '@umijs/max';
import { stringify } from 'qs';

// =====================租户===========================

// 获取租户列表
export async function list(params: any) {
  return request(`/api/blade-system/tenant/list?${stringify(params)}`);
}

// 获取租户选择列表
export async function select(params: any) {
  return request(`/api/blade-system/tenant/select?${stringify(params)}`);
}

// 提交租户信息
export async function submit(params: any) {
  return request('/api/blade-system/tenant/submit', {
    method: 'POST',
    data: params,
  });
}

// 获取租户详情
export async function detail(params: any) {
  return request(`/api/blade-system/tenant/detail?${stringify(params)}`);
}

// 删除租户
export async function remove(params: any) {
  return request('/api/blade-system/tenant/remove', {
    method: 'POST',
    data: params,
  });
}

// 获取租户信息
export async function info(params: any) {
  return request(`/api/blade-system/tenant/info?${stringify(params)}`);
}