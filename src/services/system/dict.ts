import { request } from '@umijs/max';
import { stringify } from 'qs';

// =====================字典===========================

// 获取字典数据
export async function dict(params: any) {
  return request(`/api/blade-system/dict/dictionary?${stringify(params)}`);
}

// 获取字典列表
export async function list(params: any) {
  return request(`/api/blade-system/dict/list?${stringify(params)}`);
}

// 获取字典树
export async function tree(params: any) {
  return request(`/api/blade-system/dict/tree?${stringify(params)}`);
}

// 删除字典
export async function remove(params: any) {
  return request('/api/blade-system/dict/remove', {
    method: 'POST',
    data: params,
  });
}

// 提交字典信息
export async function submit(params: any) {
  return request('/api/blade-system/dict/submit', {
    method: 'POST',
    data: params,
  });
}

// 获取字典详情
export async function detail(params: any) {
  return request(`/api/blade-system/dict/detail?${stringify(params)}`);
}