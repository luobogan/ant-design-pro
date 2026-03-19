import { request } from '@umijs/max';

/**
 * 获取订单列表
 */
export async function getOrderList(params: any) {
  return request('/api/mall/orders', {
    method: 'GET',
    params,
  });
}

/**
 * 获取订单详情
 */
export async function getOrderById(id: number) {
  return request(`/api/mall/orders/${id}`, {
    method: 'GET',
  });
}

/**
 * 更新订单状态
 */
export async function updateOrderStatus(id: number, status: string) {
  return request(`/api/mall/orders/${id}/status`, {
    method: 'PUT',
    data: { status },
  });
}

/**
 * 订单发货
 */
export async function shipOrder(id: number, data: any) {
  return request(`/api/mall/orders/${id}/ship`, {
    method: 'POST',
    data,
  });
}

/**
 * 订单完成
 */
export async function completeOrder(id: number) {
  return request(`/api/mall/orders/${id}/complete`, {
    method: 'POST',
  });
}

/**
 * 订单取消
 */
export async function cancelOrder(id: number) {
  return request(`/api/mall/orders/${id}/cancel`, {
    method: 'POST',
  });
}

/**
 * 获取订单统计
 */
export async function getOrderStats() {
  return request('/api/mall/orders/stats', {
    method: 'GET',
  });
}
