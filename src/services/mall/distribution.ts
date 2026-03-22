import { request } from '@umijs/max';
import { API_MALL_BASE_PATH } from '@/constants';

const DISTRIBUTION_BASE_URL = `${API_MALL_BASE_PATH}/distributions`;

// SpringBlade 响应格式
interface BladeResponse<T> {
  code: number;
  data: T;
  msg: string;
}

/**
 * 获取铺货列表
 */
export async function getDistributionList(params: any) {
  const response = await request<BladeResponse<any>>(DISTRIBUTION_BASE_URL, {
    method: 'GET',
    params,
  });
  return response.data;
}

/**
 * 获取铺货详情
 */
export async function getDistributionById(id: number) {
  const response = await request<BladeResponse<any>>(`${DISTRIBUTION_BASE_URL}/${id}`, {
    method: 'GET',
  });
  return response.data;
}

/**
 * 创建铺货
 */
export async function createDistribution(data: any) {
  const response = await request<BladeResponse<any>>(DISTRIBUTION_BASE_URL, {
    method: 'POST',
    data,
  });
  return response.data;
}

/**
 * 更新铺货
 */
export async function updateDistribution(id: number, data: any) {
  const response = await request<BladeResponse<any>>(`${DISTRIBUTION_BASE_URL}/${id}`, {
    method: 'PUT',
    data,
  });
  return response.data;
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
  const response = await request<BladeResponse<any>>(`${DISTRIBUTION_BASE_URL}/${id}/sync`, {
    method: 'POST',
  });
  return response.data;
}
