import { request } from '@umijs/max';
import { stringify } from 'qs';

// =====================租户===========================

// 获取租户列表
export async function list(params: any) {
  return request(`/api/blade-system/tenant/list?${stringify(params)}`);
}

// 获取租户选择列表
export async function select(params: any) {
  return request(`/api/blade-system/tenant/select?${stringify(params)}`);
}

// 提交租户信息
export async function submit(params: any) {
  return request('/api/blade-system/tenant/submit', {
    method: 'POST',
    data: params,
  });
}

// 获取租户详情
export async function detail(params: any) {
  return request(`/api/blade-system/tenant/detail?${stringify(params)}`);
}

// 删除租户
export async function remove(params: any) {
  const ids = Array.isArray(params.ids) ? params.ids.join(',') : params.ids;
  return request(`/api/blade-system/tenant/remove?ids=${ids}`, {
    method: 'POST',
  });
}

// 获取租户信息
export async function info(params: any) {
  return request(`/api/blade-system/tenant/info?${stringify(params)}`);
}

// 检查是否为超级管理员
export async function isSuperAdmin() {
  return request('/api/blade-system/tenant/is-super-admin');
}

// 获取产品包列表
export async function packageSelect() {
  return request('/api/blade-system/tenant/package-select');
}

// 为租户分配产品包
export async function assignPackage(tenantId: string, packageId: number) {
  return request(`/api/blade-system/tenant/assign-package?tenantId=${tenantId}&packageId=${packageId}`, {
    method: 'POST',
  });
}

// =====================产品包管理===========================

export const tenantPackageApi = {
  // 获取产品包列表
  list: (params: any) => request(`/api/blade-system/tenant-package/list?${stringify(params)}`),
  
  // 获取产品包详情
  detail: (id: number) => request(`/api/blade-system/tenant-package/detail?id=${id}`),
  
 
 // 新增产品包
  submit: (params: any) => request('/api/blade-system/tenant-package/submit', {
    method: 'POST',
    data: params,
  }),
  
  // 更新产品包
  update: (params: any) => request('/api/blade-system/tenant-package/update', {
    method: 'POST',
    data: params,
  }),
  
  // 删除产品包
  remove: (id: number) => request(`/api/blade-system/tenant-package/remove?id=${id}`),
  
  // 获取菜单权限分配树
  menuGrantTree: () => request('/api/blade-system/tenant-package/menu-grant-tree'),
  
  // 获取产品包已分配的菜单权限
  packageMenuKeys: (packageId: number) => request(`/api/blade-system/tenant-package/package-menu-keys?packageId=${packageId}`),
  
  // 为产品包分配菜单权限
  grantMenu: (packageId: number, menuIds: number[]) => request(`/api/blade-system/tenant-package/grant-menu?packageId=${packageId}`, {
    method: 'POST',
    data: { menuIds },
  }),
};