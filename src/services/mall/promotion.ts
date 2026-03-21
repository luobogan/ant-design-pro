import { request } from '@umijs/max';
import { API_MALL_BASE_PATH } from '@/constants';

const PROMOTION_BASE_URL = `${API_MALL_BASE_PATH}/promotions`;
const PROMOTION_PRODUCT_BASE_URL = `${API_MALL_BASE_PATH}/promotion-products`;

/**
 * 获取促销列表
 */
export async function getPromotionList(params: any) {
  return request(PROMOTION_BASE_URL, {
    method: 'GET',
    params,
  });
}

/**
 * 获取促销详情
 */
export async function getPromotionById(id: number) {
  return request(`${PROMOTION_BASE_URL}/${id}`, {
    method: 'GET',
  });
}

/**
 * 创建促销
 */
export async function createPromotion(data: any) {
  return request(PROMOTION_BASE_URL, {
    method: 'POST',
    data,
  });
}

/**
 * 更新促销
 */
export async function updatePromotion(id: number, data: any) {
  return request(`${PROMOTION_BASE_URL}/${id}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除促销
 */
export async function deletePromotion(id: number) {
  return request(`${PROMOTION_BASE_URL}/${id}`, {
    method: 'DELETE',
  });
}

/**
 * 获取促销商品列表
 */
export async function getPromotionProducts(promotionId: number) {
  return request(`${PROMOTION_BASE_URL}/${promotionId}/products`, {
    method: 'GET',
  });
}

/**
 * 添加促销商品
 */
export async function addPromotionProduct(data: any) {
  return request(PROMOTION_PRODUCT_BASE_URL, {
    method: 'POST',
    data,
  });
}

/**
 * 删除促销商品
 */
export async function deletePromotionProduct(id: number) {
  return request(`${PROMOTION_PRODUCT_BASE_URL}/${id}`, {
    method: 'DELETE',
  });
}
