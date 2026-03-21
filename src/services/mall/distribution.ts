import { request } from '@umijs/max';
import { API_MALL_BASE_PATH } from '@/constants';

const DISTRIBUTION_BASE_URL = `${API_MALL_BASE_PATH}/distributions`;

/**
 * 获取铺货列表
 */
export async function getDistributionList(params: any) {
  return request(DISTRIBUTION_BASE_URL, {
    method: 'GET',
    params,
  });
}

/**
 * 获取铺货详情
 */
export async function getDistributionById(id: number) {
  return request(`${DISTRIBUTION_BASE_URL}/${id}`, {
    method: 'GET',
  });
}

/**
 * 创建铺货
 */
export async function createDistribution(data: any) {
  return request(DISTRIBUTION_BASE_URL, {
    method: 'POST',
    data,
  });
}

/**
 * 更新铺货
 */
export async function updateDistribution(id: number, data: any) {
  return request(`${DISTRIBUTION_BASE_URL}/${id}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除铺货
 */
export async function deleteDistribution(id: number) {
  return request(`${DISTRIBUTION_BASE_URL}/${id}`, {
    method: 'DELETE',
  });
}

/**
 * 铺货同步
 */
export async function syncDistribution(id: number) {
  return request(`${DISTRIBUTION_BASE_URL}/${id}/sync`, {
    method: 'POST',
  });
}
