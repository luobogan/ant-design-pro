import { request } from '@umijs/max';
import { stringify } from 'qs';

// =====================数据源===========================

// 获取数据源列表
export async function list(params: any) {
  return request(`/api/blade-develop/datasource/list?${stringify(params)}`);
}

// 获取数据源选择列表
export async function select(params: any) {
  return request(`/api/blade-develop/datasource/select?${stringify(params)}`);
}

// 提交数据源
export async function submit(params: any) {
  return request('/api/blade-develop/datasource/submit', {
    method: 'POST',
    data: params,
  });
}

// 获取数据源详情
export async function detail(params: any) {
  return request(`/api/blade-develop/datasource/detail?${stringify(params)}`);
}

// 删除数据源
export async function remove(params: any) {
  return request('/api/blade-develop/datasource/remove', {
    method: 'POST',
    data: params,
  });
}