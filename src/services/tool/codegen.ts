import { request } from '@umijs/max';
import { stringify } from 'qs';

// =====================代码生成===========================

// 获取代码生成列表
export async function list(params: any) {
  return request(`/api/blade-develop/code/list?${stringify(params)}`);
}

// 删除代码生成
export async function remove(params: any) {
  return request('/api/blade-develop/code/remove', {
    method: 'POST',
    data: params,
  });
}

// 提交代码生成
export async function submit(params: any) {
  return request('/api/blade-develop/code/submit', {
    method: 'POST',
    data: params,
  });
}

// 获取代码生成详情
export async function detail(params: any) {
  return request(`/api/blade-develop/code/detail?${stringify(params)}`);
}

// 生成代码
export async function genCodes(params: any) {
  return request('/api/blade-develop/code/gen-code', {
    method: 'POST',
    data: params,
  });
}

// 复制代码
export async function copyCodes(params: any) {
  return request('/api/blade-develop/code/copy', {
    method: 'POST',
    data: params,
  });
}