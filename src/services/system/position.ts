import { request } from '@umijs/max';
import { stringify } from 'qs';

// =====================职位===========================

// 获取职位列表
export async function list(params: any) {
  return request(`/api/blade-system/post/list?${stringify(params)}`);
}

// 获取职位选择列表
export async function select(params: any) {
  return request(`/api/blade-system/post/select?${stringify(params)}`);
}

// 提交职位信息
export async function submit(params: any) {
  return request('/api/blade-system/post/submit', {
    method: 'POST',
    data: params,
  });
}

// 获取职位详情
export async function detail(params: any) {
  return request(`/api/blade-system/post/detail?${stringify(params)}`);
}

// 删除职位
export async function remove(params: any) {
  return request('/api/blade-system/post/remove', {
    method: 'POST',
    data: params,
  });
}