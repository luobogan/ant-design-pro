import { request } from '@umijs/max';
import { stringify } from 'qs';

// =====================菜单===========================

// 获取动态路由
export async function dynamicRoutes() {
  return request('/api/blade-system/menu/routes');
}

// 获取动态按钮
export async function dynamicButtons() {
  return request('/api/blade-system/menu/buttons');
}

// 获取菜单列表
export async function list(params: any) {
  return request(`/api/blade-system/menu/list?${stringify(params)}`);
}

// 获取父菜单列表
export async function parentList(params: any) {
  return request(`/api/blade-system/menu/menu-list?${stringify(params)}`);
}

// 获取菜单树
export async function tree(params: any) {
  return request(`/api/blade-system/menu/tree?${stringify(params)}`);
}

// 获取授权菜单树
export async function grantTree(params: any) {
  try {
    console.log('Calling grant-tree API with params:', params);
    const url = params ? `/api/blade-system/menu/grant-tree?${stringify(params)}` : '/api/blade-system/menu/grant-tree';
    console.log('Constructed URL:', url);
    const response = await request(url);
    console.log('grant-tree API response:', response);
    return response;
  } catch (error) {
    console.error('Error calling grant-tree API:', error);
    throw error;
  }
}

// 获取角色菜单树节点
export async function roleTreeKeys(params: any) {
  try {
    console.log('Calling role-tree-keys API with params:', params);
    const url = params ? `/api/blade-system/menu/role-tree-keys?${stringify(params)}` : '/api/blade-system/menu/role-tree-keys';
    console.log('Constructed URL:', url);
    const response = await request(url);
    console.log('role-tree-keys API response:', response);
    return response;
  } catch (error) {
    console.error('Error calling role-tree-keys API:', error);
    throw error;
  }
}

// 删除菜单
export async function remove(params: any) {
  return request('/api/blade-system/menu/remove', {
    method: 'POST',
    data: params,
  });
}

// 提交菜单信息
export async function submit(params: any) {
  return request('/api/blade-system/menu/submit', {
    method: 'POST',
    data: params,
  });
}

// 获取菜单详情
export async function detail(params: any) {
  return request(`/api/blade-system/menu/detail?${stringify(params)}`);
}

// 获取路由权限
export async function routesAuthority() {
  return request('/api/blade-system/menu/auth-routes');
}

// 获取数据权限列表
export async function dataScopeList(params: any) {
  return request(`/api/blade-system/data-scope/list?${stringify(params)}`);
}

// 删除数据权限
export async function removeDataScope(params: any) {
  return request('/api/blade-system/data-scope/remove', {
    method: 'POST',
    data: params,
  });
}

// 提交数据权限
export async function submitDataScope(params: any) {
  return request('/api/blade-system/data-scope/submit', {
    method: 'POST',
    data: params,
  });
}

// 获取数据权限详情
export async function scopeDataDetail(params: any) {
  return request(`/api/blade-system/data-scope/detail?${stringify(params)}`);
}

// 获取API权限列表
export async function apiScopeList(params: any) {
  return request(`/api/blade-system/api-scope/list?${stringify(params)}`);
}