import { request } from '@umijs/max';
import { API_MALL_BASE_PATH } from '@/constants';

const COUPON_BASE_URL = `${API_MALL_BASE_PATH}/coupons`;

/**
 * 获取优惠券列表
 */
export async function getCouponList(params: any) {
  return request(COUPON_BASE_URL, {
    method: 'GET',
    params,
  });
}

/**
 * 获取优惠券详情
 */
export async function getCouponById(id: number) {
  return request(`${COUPON_BASE_URL}/${id}`, {
    method: 'GET',
  });
}

/**
 * 创建优惠券
 */
export async function createCoupon(data: any) {
  return request(COUPON_BASE_URL, {
    method: 'POST',
    data,
  });
}

/**
 * 更新优惠券
 */
export async function updateCoupon(id: number, data: any) {
  return request(`${COUPON_BASE_URL}/${id}`, {
    method: 'PUT',
    data,
  });
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
  return request(`${COUPON_BASE_URL}/${id}/publish`, {
    method: 'POST',
  });
}

/**
 * 获取优惠券统计
 */
export async function getCouponStats() {
  return request('/api/mall/coupons/stats', {
    method: 'GET',
  });
}
