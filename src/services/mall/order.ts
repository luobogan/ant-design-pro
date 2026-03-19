import { request } from '@umijs/max';
import { API_MALL_BASE_PATH } from '@/constants';

const ORDER_BASE_URL = `${API_MALL_BASE_PATH}/orders`;

/**
 * 获取订单列表
 */
export async function getOrderList(params: any) {
  return request(ORDER_BASE_URL, {
    method: 'GET',
    params,
  });
}

/**
 * 获取订单详情
 */
export async function getOrderById(id: number) {
  return request(`${ORDER_BASE_URL}/${id}`, {
    method: 'GET',
  });
}

/**
 * 更新订单状态
 */
export async function updateOrderStatus(id: number, status: string) {
  return request(`${ORDER_BASE_URL}/${id}/status`, {
    method: 'PUT',
    data: { status },
  });
}

/**
 * 订单发货
 */
export async function shipOrder(id: number, data: any) {
  return request(`${ORDER_BASE_URL}/${id}/ship`, {
    method: 'POST',
    data,
  });
}

/**
 * 订单完成
 */
export async function completeOrder(id: number) {
  return request(`${ORDER_BASE_URL}/${id}/complete`, {
    method: 'POST',
  });
}

/**
 * 订单取消
 */
export async function cancelOrder(id: number) {
  return request(`${ORDER_BASE_URL}/${id}/cancel`, {
    method: 'POST',
  });
}

/**
 * 获取订单统计
 */
export async function getOrderStats() {
  return request(`${ORDER_BASE_URL}/stats`, {
    method: 'GET',
  });
}
