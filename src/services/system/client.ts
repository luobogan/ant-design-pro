import { request } from '@umijs/max';
import { stringify } from 'qs';

// =====================客户端===========================

// 获取客户端列表
export async function list(params: any) {
  return request(`/api/blade-system/client/list?${stringify(params)}`);
}

// 提交客户端信息
export async function submit(params: any) {
  return request('/api/blade-system/client/submit', {
    method: 'POST',
    data: params,
  });
}

// 获取客户端详情
export async function detail(params: any) {
  return request(`/api/blade-system/client/detail?${stringify(params)}`);
}

// 删除客户端
export async function remove(params: any) {
  return request('/api/blade-system/client/remove', {
    method: 'POST',
    data: params,
  });
}