import { request } from '@umijs/max';

/**
 * 获取物流列表
 */
export async function getLogisticsList(params: any) {
  return request('/api/mall/logistics', {
    method: 'GET',
    params,
  });
}

/**
 * 获取物流详情
 */
export async function getLogisticsById(id: number) {
  return request(`/api/mall/logistics/${id}`, {
    method: 'GET',
  });
}

/**
 * 创建物流
 */
export async function createLogistics(data: any) {
  return request('/api/mall/logistics', {
    method: 'POST',
    data,
  });
}

/**
 * 更新物流
 */
export async function updateLogistics(id: number, data: any) {
  return request(`/api/mall/logistics/${id}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除物流
 */
export async function deleteLogistics(id: number) {
  return request(`/api/mall/logistics/${id}`, {
    method: 'DELETE',
  });
}

/**
 * 获取物流轨迹
 */
export async function getLogisticsTracking(id: number) {
  return request(`/api/mall/logistics/${id}/tracking`, {
    method: 'GET',
  });
}
