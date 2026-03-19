import { request } from '@umijs/max';

/**
 * 获取铺货列表
 */
export async function getDistributionList(params: any) {
  return request('/api/mall/distributions', {
    method: 'GET',
    params,
  });
}

/**
 * 获取铺货详情
 */
export async function getDistributionById(id: number) {
  return request(`/api/mall/distributions/${id}`, {
    method: 'GET',
  });
}

/**
 * 创建铺货
 */
export async function createDistribution(data: any) {
  return request('/api/mall/distributions', {
    method: 'POST',
    data,
  });
}

/**
 * 更新铺货
 */
export async function updateDistribution(id: number, data: any) {
  return request(`/api/mall/distributions/${id}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除铺货
 */
export async function deleteDistribution(id: number) {
  return request(`/api/mall/distributions/${id}`, {
    method: 'DELETE',
  });
}

/**
 * 铺货同步
 */
export async function syncDistribution(id: number) {
  return request(`/api/mall/distributions/${id}/sync`, {
    method: 'POST',
  });
}
