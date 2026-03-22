import { request } from '@umijs/max';
import { API_MALL_BASE_PATH } from '@/constants';

const COUPON_BASE_URL = `${API_MALL_BASE_PATH}/coupons`;

// SpringBlade 响应格式
interface BladeResponse<T> {
  code: number;
  data: T;
  msg: string;
}

/**
 * 获取优惠券列表
 */
export async function getCouponList(params: any) {
  const response = await request<BladeResponse<any>>(COUPON_BASE_URL, {
    method: 'GET',
    params,
  });
  return response.data;
}

/**
 * 获取优惠券详情
 */
export async function getCouponById(id: number) {
  const response = await request<BladeResponse<any>>(`${COUPON_BASE_URL}/${id}`, {
    method: 'GET',
  });
  return response.data;
}

/**
 * 创建优惠券
 */
export async function createCoupon(data: any) {
  const response = await request<BladeResponse<any>>(COUPON_BASE_URL, {
    method: 'POST',
    data,
  });
  return response.data;
}

/**
 * 更新优惠券
 */
export async function updateCoupon(id: number, data: any) {
  const response = await request<BladeResponse<any>>(`${COUPON_BASE_URL}/${id}`, {
    method: 'PUT',
    data,
  });
  return response.data;
}

/**
 * 删除优惠券
 */
export async function deleteCoupon(id: number) {
  return request(`${COUPON_BASE_URL}/${id}`, {
    method: 'DELETE',
  });
}

/**
 * 发布优惠券
 */
export async function publishCoupon(id: number) {
  const response = await request<BladeResponse<any>>(`${COUPON_BASE_URL}/${id}/publish`, {
    method: 'POST',
  });
  return response.data;
}

/**
 * 获取优惠券统计
 */
export async function getCouponStats() {
  const response = await request<BladeResponse<any>>(`${COUPON_BASE_URL}/stats`, {
    method: 'GET',
  });
  return response.data;
}
