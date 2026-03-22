import { request } from '@umijs/max';
import { API_MALL_BASE_PATH } from '@/constants';

const ORDER_BASE_URL = `${API_MALL_BASE_PATH}/orders`;

// SpringBlade 响应格式
interface BladeResponse<T> {
  code: number;
  data: T;
  msg: string;
}

/**
 * 获取订单列表
 */
export async function getOrderList(params: any) {
  const response = await request<BladeResponse<any>>(ORDER_BASE_URL, {
    method: 'GET',
    params,
  });
  return response.data;
}

/**
 * 获取订单详情
 */
export async function getOrderById(id: number) {
  const response = await request<BladeResponse<any>>(`${ORDER_BASE_URL}/${id}`, {
    method: 'GET',
  });
  return response.data;
}

/**
 * 更新订单状态
 */
export async function updateOrderStatus(id: number, status: string) {
  const response = await request<BladeResponse<any>>(`${ORDER_BASE_URL}/${id}/status`, {
    method: 'PUT',
    data: { status },
  });
  return response.data;
}

/**
 * 订单发货
 */
export async function shipOrder(id: number, data: any) {
  const response = await request<BladeResponse<any>>(`${ORDER_BASE_URL}/${id}/ship`, {
    method: 'POST',
    data,
  });
  return response.data;
}

/**
 * 订单完成
 */
export async function completeOrder(id: number) {
  const response = await request<BladeResponse<any>>(`${ORDER_BASE_URL}/${id}/complete`, {
    method: 'POST',
  });
  return response.data;
}

/**
 * 订单取消
 */
export async function cancelOrder(id: number) {
  const response = await request<BladeResponse<any>>(`${ORDER_BASE_URL}/${id}/cancel`, {
    method: 'POST',
  });
  return response.data;
}

/**
 * 获取订单统计
 */
export async function getOrderStats() {
  const response = await request<BladeResponse<any>>(`${ORDER_BASE_URL}/stats`, {
    method: 'GET',
  });
  return response.data;
}
