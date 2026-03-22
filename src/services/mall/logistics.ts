import { request } from '@umijs/max';
import { API_MALL_BASE_PATH } from '@/constants';

const LOGISTICS_BASE_URL = `${API_MALL_BASE_PATH}/logistics`;

// SpringBlade 响应格式
interface BladeResponse<T> {
  code: number;
  data: T;
  msg: string;
}

/**
 * 获取物流列表
 */
export async function getLogisticsList(params: any) {
  const response = await request<BladeResponse<any>>(LOGISTICS_BASE_URL, {
    method: 'GET',
    params,
  });
  return response.data;
}

/**
 * 获取物流详情
 */
export async function getLogisticsById(id: number) {
  const response = await request<BladeResponse<any>>(`${LOGISTICS_BASE_URL}/${id}`, {
    method: 'GET',
  });
  return response.data;
}

/**
 * 创建物流
 */
export async function createLogistics(data: any) {
  const response = await request<BladeResponse<any>>(LOGISTICS_BASE_URL, {
    method: 'POST',
    data,
  });
  return response.data;
}

/**
 * 更新物流
 */
export async function updateLogistics(id: number, data: any) {
  const response = await request<BladeResponse<any>>(`${LOGISTICS_BASE_URL}/${id}`, {
    method: 'PUT',
    data,
  });
  return response.data;
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
  const response = await request<BladeResponse<any>>(`${LOGISTICS_BASE_URL}/${id}/tracking`, {
    method: 'GET',
  });
  return response.data;
}
