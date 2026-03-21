import { request } from '@umijs/max';
import { API_MALL_BASE_PATH } from '@/constants';

const LOGISTICS_BASE_URL = `${API_MALL_BASE_PATH}/logistics`;

/**
 * 获取物流列表
 */
export async function getLogisticsList(params: any) {
  return request(LOGISTICS_BASE_URL, {
    method: 'GET',
    params,
  });
}

/**
 * 获取物流详情
 */
export async function getLogisticsById(id: number) {
  return request(`${LOGISTICS_BASE_URL}/${id}`, {
    method: 'GET',
  });
}

/**
 * 创建物流
 */
export async function createLogistics(data: any) {
  return request(LOGISTICS_BASE_URL, {
    method: 'POST',
    data,
  });
}

/**
 * 更新物流
 */
export async function updateLogistics(id: number, data: any) {
  return request(`${LOGISTICS_BASE_URL}/${id}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除物流
 */
export async function deleteLogistics(id: number) {
  return request(`${LOGISTICS_BASE_URL}/${id}`, {
    method: 'DELETE',
  });
}

/**
 * 获取物流轨迹
 */
export async function getLogisticsTracking(id: number) {
  return request(`${LOGISTICS_BASE_URL}/${id}/tracking`, {
    method: 'GET',
  });
}
