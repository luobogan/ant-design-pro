import { request } from '@umijs/max';
import { stringify } from 'qs';

// =====================报表===========================

// 获取报表列表
export async function list(params: any) {
  return request(`/api/blade-report/report/rest/list?${stringify(params)}`);
}

// 删除报表
export async function remove(params: any) {
  return request('/api/blade-report/report/rest/remove', {
    method: 'POST',
    data: params,
  });
}