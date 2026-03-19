import { request } from '@umijs/max';
import type { Product, ProductFormData, ProductSkuFormData, SkuMatrixGenerateData, ProductRelationFormData } from './typings';
import { API_MALL_BASE_PATH } from '@/constants';

const PRODUCT_BASE_URL = `${API_MALL_BASE_PATH}/products`;

/**
 * 获取商品列表
 */
export async function getProductList(params: any) {
  return request(PRODUCT_BASE_URL, {
    method: 'GET',
    params,
  });
}

/**
 * 获取商品详情
 */
export async function getProductById(id: number) {
  return request(`${PRODUCT_BASE_URL}/${id}`, {
    method: 'GET',
  });
}

/**
 * 创建商品
 */
export async function createProduct(data: ProductFormData) {
  return request(PRODUCT_BASE_URL, {
    method: 'POST',
    data,
  });
}

/**
 * 更新商品
 */
export async function updateProduct(id: number, data: ProductFormData) {
  return request(`${PRODUCT_BASE_URL}/${id}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 更新商品（带确认）
 */
export async function updateProductWithConfirm(id: number, data: ProductFormData, confirm: boolean) {
  return request(`/api/mall/products/${id}`, {
    method: 'PUT',
    data: { ...data, confirm },
  });
}

/**
 * 删除商品
 */
export async function deleteProduct(id: number) {
  return request(`/api/mall/products/${id}`, {
    method: 'DELETE',
  });
}

/**
 * 批量删除商品
 */
export async function batchDeleteProducts(ids: number[]) {
  return request('/api/mall/products/batch-delete', {
    method: 'POST',
    data: { ids },
  });
}

/**
 * 批量更新状态
 */
export async function batchUpdateStatus(ids: number[], status: 'active' | 'inactive') {
  return request('/api/mall/products/batch-status', {
    method: 'POST',
    data: { ids, status },
  });
}

/**
 * 商品上架
 */
export async function publishProduct(id: number) {
  return request(`/api/mall/products/${id}/publish`, {
    method: 'POST',
  });
}

/**
 * 商品下架
 */
export async function unpublishProduct(id: number) {
  return request(`/api/mall/products/${id}/unpublish`, {
    method: 'POST',
  });
}

/**
 * 设为推荐
 */
export async function setRecommend(id: number, recommend: boolean) {
  return request(`/api/mall/products/${id}/recommend`, {
    method: 'POST',
    data: { recommend },
  });
}

/**
 * 设为新品
 */
export async function setNew(id: number, isNew: boolean) {
  return request(`/api/mall/products/${id}/new`, {
    method: 'POST',
    data: { isNew },
  });
}

/**
 * 设为热销
 */
export async function setHot(id: number, isHot: boolean) {
  return request(`/api/mall/products/${id}/hot`, {
    method: 'POST',
    data: { isHot },
  });
}

/**
 * 获取商品统计
 */
export async function getProductStats() {
  return request('/api/mall/products/stats', {
    method: 'GET',
  });
}

/**
 * 获取回收站列表
 */
export async function getRecycleList() {
  return request('/api/mall/products/recycle', {
    method: 'GET',
  });
}

/**
 * 恢复商品
 */
export async function restoreProduct(id: number) {
  return request(`/api/mall/products/${id}/restore`, {
    method: 'POST',
  });
}

/**
 * 获取 SKU 列表
 */
export async function getProductSkus(productId: number) {
  return request(`/api/mall/products/${productId}/skus`, {
    method: 'GET',
  });
}

/**
 * 创建 SKU
 */
export async function createSku(productId: number, data: ProductSkuFormData) {
  return request(`/api/mall/products/${productId}/skus`, {
    method: 'POST',
    data,
  });
}

/**
 * 更新 SKU
 */
export async function updateSku(id: number, data: ProductSkuFormData) {
  return request(`/api/mall/skus/${id}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除 SKU
 */
export async function deleteSku(id: number) {
  return request(`/api/mall/skus/${id}`, {
    method: 'DELETE',
  });
}

/**
 * 生成 SKU 矩阵
 */
export async function generateSkuMatrix(data: SkuMatrixGenerateData) {
  return request('/api/mall/products/skus/matrix', {
    method: 'POST',
    data,
  });
}

/**
 * 获取规格属性
 */
export async function getSpecAttributes(productId: number) {
  return request(`/api/mall/products/${productId}/spec-attributes`, {
    method: 'GET',
  });
}

/**
 * 获取 SKU 库存日志
 */
export async function getSkuStockLogs(skuId: number) {
  return request(`/api/mall/skus/${skuId}/stock-logs`, {
    method: 'GET',
  });
}

/**
 * 调整 SKU 库存
 */
export async function adjustSkuStock(skuId: number, quantity: number, type: number, remark?: string) {
  return request(`/api/mall/skus/${skuId}/stock`, {
    method: 'POST',
    data: { quantity, type, remark },
  });
}

/**
 * 获取商品统计（带分类和品牌）
 */
export async function getProductStatsDetailed() {
  return request('/api/mall/products/stats/detailed', {
    method: 'GET',
  });
}

/**
 * 添加商品关联
 */
export async function addProductRelation(data: ProductRelationFormData) {
  return request('/api/mall/product-relations', {
    method: 'POST',
    data,
  });
}

/**
 * 获取商品关联列表
 */
export async function getProductRelations(productId: number) {
  return request(`/api/mall/products/${productId}/relations`, {
    method: 'GET',
  });
}

/**
 * 删除商品关联
 */
export async function deleteProductRelation(id: number) {
  return request(`/api/mall/product-relations/${id}`, {
    method: 'DELETE',
  });
}
