import { request } from '@umijs/max';
import { stringify } from 'qs';

// =====================配置===========================

// 获取配置列表
export async function list(params: any) {
  return request(`/api/blade-system/param/list?${stringify(params)}`);
}

// 删除配置
export async function remove(params: any) {
  return request('/api/blade-system/param/remove', {
    method: 'POST',
    data: params,
  });
}

// 提交配置信息
export async function submit(params: any) {
  return request('/api/blade-system/param/submit', {
    method: 'POST',
    data: params,
  });
}

// 获取配置详情
export async function detail(params: any) {
  return request(`/api/blade-system/param/detail?${stringify(params)}`);
}