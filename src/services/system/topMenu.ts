import { request } from '@umijs/max';
import { stringify } from 'qs';

// =====================顶部菜单===========================

// 获取顶部菜单列表
export async function list(params: any) {
  return request(`/api/blade-system/topmenu/list?${stringify(params)}`);
}

// 获取顶部菜单详情
export async function detail(params: any) {
  return request(`/api/blade-system/topmenu/detail?${stringify(params)}`);
}

// 提交顶部菜单信息
export async function submit(params: any) {
  return request('/api/blade-system/topmenu/submit', {
    method: 'POST',
    data: params,
  });
}

// 删除顶部菜单
export async function remove(params: any) {
  const ids = Array.isArray(params.ids) ? params.ids.join(',') : params.ids;
  return request(`/api/blade-system/topmenu/remove?ids=${ids}`, {
    method: 'POST',
  });
}

// 为顶部菜单授权菜单
export async function grant(params: any) {
  return request('/api/blade-system/topmenu/grant', {
    method: 'POST',
    data: params,
  });
}