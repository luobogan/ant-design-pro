import { request } from '@umijs/max';
import { stringify } from 'qs';
import RequestForm from '@/utils/RequestForm';
import { API_BASE_PATH, APPLICATION_SYSTEM_NAME } from '@/constants';

// =====================菜单===========================

const MENU_BASE_URL = `${API_BASE_PATH}/${APPLICATION_SYSTEM_NAME}/menu`;

// 获取动态路由
export async function dynamicRoutes() {
  return request(`${MENU_BASE_URL}/routes`);
}

// 获取动态按钮
export async function dynamicButtons() {
  return request(`${MENU_BASE_URL}/buttons`);
}

// 获取菜单列表
export async function list(params: any) {
  return request(`${MENU_BASE_URL}/list?${stringify(params)}`);
}

// 获取父菜单列表
export async function parentList(params: any) {
  return request(`${MENU_BASE_URL}/menu-list?${stringify(params)}`);
}

// 获取菜单树
export async function tree(params: any) {
  return request(`${MENU_BASE_URL}/tree?${stringify(params)}`);
}

// 获取授权菜单树
export async function grantTree(params: any) {
  try {
    console.log('Calling grant-tree API with params:', params);
    const url = params ? `${MENU_BASE_URL}/grant-tree?${stringify(params)}` : `${MENU_BASE_URL}/grant-tree`;
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
    const url = params ? `${MENU_BASE_URL}/role-tree-keys?${stringify(params)}` : `${MENU_BASE_URL}/role-tree-keys`;
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
  return request(`${MENU_BASE_URL}/remove`, {
    method: 'POST',
    data: RequestForm.buildFormDataWithArray(params),
  });
}

// 提交菜单信息
export async function submit(params: any) {
  // 清理数据，确保所有字段都是可序列化的
  const cleanedParams = {
    ...params,
    source: typeof params.source === 'string' ? params.source : '',
  };

  console.log('提交菜单参数:', JSON.stringify(cleanedParams));

  return request(`${MENU_BASE_URL}/submit`, {
    method: 'POST',
    data: cleanedParams,
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
    data: RequestForm.buildFormDataWithArray(params),
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

// =====================菜单组件===========================

// 获取组件映射配置
export async function getComponentMap() {
  return request('/api/blade-system/menu-component/component-map');
}

// 获取远程组件列表
export async function getRemoteComponentList() {
  return request('/api/blade-system/menu-component/remote-list');
}

// 注册远程组件
export async function registerRemoteComponent(params: any) {
  return request('/api/blade-system/menu-component/register', {
    method: 'POST',
    data: params,
  });
}

// 获取组件详情
export async function getComponentDetail(params: any) {
  return request(`/api/blade-system/menu-component/detail?${stringify(params)}`);
}

// 删除组件
export async function removeComponent(params: any) {
  return request('/api/blade-system/menu-component/remove', {
    method: 'POST',
    data: RequestForm.buildFormDataWithArray(params),
  });
}