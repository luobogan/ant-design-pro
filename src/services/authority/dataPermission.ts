import { request } from '@umijs/max';
import { stringify } from 'qs';

// =====================数据权限===========================

// 获取数据权限列表（根据菜单ID）
export async function list(params: any) {
  return request(`/api/blade-system/data-scope/list?${stringify(params)}`);
}

// 删除数据权限
export async function remove(params: any) {
  // 将 ids 数组转换为逗号分隔的字符串作为查询参数
  const queryParams: any = {};
  if (params.ids && Array.isArray(params.ids)) {
    queryParams.ids = params.ids.join(',');
  }
  if (params.id) {
    queryParams.id = params.id;
  }
  return request(`/api/blade-system/data-scope/remove?${stringify(queryParams)}`, {
    method: 'POST',
  });
}

// 提交数据权限
export async function submit(params: any) {
  return request('/api/blade-system/data-scope/submit', {
    method: 'POST',
    data: params,
  });
}

// 获取数据权限详情
export async function detail(params: any) {
  return request(`/api/blade-system/data-scope/detail?${stringify(params)}`);
}
