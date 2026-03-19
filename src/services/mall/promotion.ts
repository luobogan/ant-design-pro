import { request } from '@umijs/max';

/**
 * 获取促销列表
 */
export async function getPromotionList(params: any) {
  return request('/api/mall/promotions', {
    method: 'GET',
    params,
  });
}

/**
 * 获取促销详情
 */
export async function getPromotionById(id: number) {
  return request(`/api/mall/promotions/${id}`, {
    method: 'GET',
  });
}

/**
 * 创建促销
 */
export async function createPromotion(data: any) {
  return request('/api/mall/promotions', {
    method: 'POST',
    data,
  });
}

/**
 * 更新促销
 */
export async function updatePromotion(id: number, data: any) {
  return request(`/api/mall/promotions/${id}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除促销
 */
export async function deletePromotion(id: number) {
  return request(`/api/mall/promotions/${id}`, {
    method: 'DELETE',
  });
}

/**
 * 获取促销商品列表
 */
export async function getPromotionProducts(promotionId: number) {
  return request(`/api/mall/promotions/${promotionId}/products`, {
    method: 'GET',
  });
}

/**
 * 添加促销商品
 */
export async function addPromotionProduct(data: any) {
  return request('/api/mall/promotion-products', {
    method: 'POST',
    data,
  });
}

/**
 * 删除促销商品
 */
export async function deletePromotionProduct(id: number) {
  return request(`/api/mall/promotion-products/${id}`, {
    method: 'DELETE',
  });
}
