import { request } from '@umijs/max';
import { stringify } from 'qs';

// =====================角色===========================

// 获取角色列表
export async function list(params: any) {
  return request(`/api/blade-system/role/list?${stringify(params)}`);
}

// 获取角色树
export async function tree(params: any) {
  return request(`/api/blade-system/role/tree?${stringify(params)}`);
}

// 根据ID获取角色树
export async function treeById(params: any) {
  return request(`/api/blade-system/role/tree-by-id?${stringify(params)}`);
}

// 授权角色
export async function grant(params: any) {
  return request('/api/blade-system/role/grant', {
    method: 'POST',
    data: params,
  });
}

// 删除角色
export async function remove(params: any) {
  return request('/api/blade-system/role/remove', {
    method: 'POST',
    data: params,
  });
}

// 提交角色信息
export async function submit(params: any) {
  return request('/api/blade-system/role/submit', {
    method: 'POST',
    data: params,
  });
}

// 获取角色详情
export async function detail(params: any) {
  return request(`/api/blade-system/role/detail?${stringify(params)}`);
}