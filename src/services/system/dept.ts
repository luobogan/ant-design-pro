import { request } from '@umijs/max';
import { stringify } from 'qs';

// =====================部门===========================

// 获取部门列表
export async function list(params: any) {
  return request(`/api/blade-system/dept/list?${stringify(params)}`);
}

// 获取部门树
export async function tree(params: any) {
  return request(`/api/blade-system/dept/tree?${stringify(params)}`);
}

// 带数据权限的部门树（非超管仅返回当前用户可见部门子树，供用户表单部门选择器裁剪）
export async function treeScope(params: any) {
  return request(`/api/blade-system/dept/tree-scope?${stringify(params)}`);
}

// 删除部门
export async function remove(params: any) {
  const ids = Array.isArray(params.ids) ? params.ids.join(',') : params.ids;
  return request(`/api/blade-system/dept/remove?ids=${ids}`, {
    method: 'POST',
  });
}

// 提交部门信息
export async function submit(params: any) {
  return request('/api/blade-system/dept/submit', {
    method: 'POST',
    data: params,
  });
}

// 获取部门详情
export async function detail(params: any) {
  return request(`/api/blade-system/dept/detail?${stringify(params)}`);
}

// 根据ID获取部门
export async function getById(id: string) {
  return request(`/api/blade-system/dept/detail?id=${id}`);
}

// 封存组织（前置校验：无在职人员、无未封存子组织；可解封）
export async function cancel(params: any) {
  const ids = Array.isArray(params.ids) ? params.ids.join(',') : params.ids;
  return request(`/api/blade-system/dept/cancel?ids=${ids}`, {
    method: 'POST',
  });
}

// 解封组织
export async function isCanceled(params: any) {
  const ids = Array.isArray(params.ids) ? params.ids.join(',') : params.ids;
  return request(`/api/blade-system/dept/is-canceled?ids=${ids}`, {
    method: 'POST',
  });
}