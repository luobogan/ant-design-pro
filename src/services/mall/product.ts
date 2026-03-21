import { request } from '@umijs/max';
import type { Product, ProductFormData, ProductSkuFormData, SkuMatrixGenerateData, ProductRelationFormData } from './typings';
import { API_MALL_BASE_PATH } from '@/constants';

const PRODUCT_BASE_URL = `${API_MALL_BASE_PATH}/products`;
const SKU_BASE_URL = `${API_MALL_BASE_PATH}/skus`;
const PRODUCT_RELATION_BASE_URL = `${API_MALL_BASE_PATH}/product-relations`;

/**
 * 商品 API
 */
export const productApi = {
  /**
   * 获取商品列表
   */
  getList: async (params: any) => {
    return request(PRODUCT_BASE_URL, {
      method: 'GET',
      params,
    });
  },

  /**
   * 获取商品详情
   */
  getById: async (id: number) => {
    return request(`${PRODUCT_BASE_URL}/${id}`, {
      method: 'GET',
    });
  },

  /**
   * 创建商品
   */
  create: async (data: ProductFormData) => {
    return request(PRODUCT_BASE_URL, {
      method: 'POST',
      data,
    });
  },

  /**
   * 更新商品
   */
  update: async (id: number, data: ProductFormData) => {
    return request(`${PRODUCT_BASE_URL}/${id}`, {
      method: 'PUT',
      data,
    });
  },

  /**
   * 更新商品（带确认）
   */
  updateWithConfirm: async (id: number, data: ProductFormData, confirm: boolean) => {
    return request(`${PRODUCT_BASE_URL}/${id}`, {
      method: 'PUT',
      data: { ...data, confirm },
    });
  },

  /**
   * 删除商品
   */
  delete: async (id: number) => {
    return request(`${PRODUCT_BASE_URL}/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * 批量删除商品
   */
  batchDelete: async (ids: number[]) => {
    return request(`${PRODUCT_BASE_URL}/batch-delete`, {
      method: 'POST',
      data: { ids },
    });
  },

  /**
   * 批量更新状态
   */
  batchUpdateStatus: async (ids: number[], status: 'active' | 'inactive') => {
    return request(`${PRODUCT_BASE_URL}/batch-status`, {
      method: 'POST',
      data: { ids, status },
    });
  },

  /**
   * 商品上架
   */
  publish: async (id: number) => {
    return request(`${PRODUCT_BASE_URL}/${id}/publish`, {
      method: 'POST',
    });
  },

  /**
   * 商品下架
   */
  unpublish: async (id: number) => {
    return request(`${PRODUCT_BASE_URL}/${id}/unpublish`, {
      method: 'POST',
    });
  },

  /**
   * 设为推荐
   */
  setRecommend: async (id: number, recommend: boolean) => {
    return request(`${PRODUCT_BASE_URL}/${id}/recommend`, {
      method: 'POST',
      data: { recommend },
    });
  },

  /**
   * 设为新品
   */
  setNew: async (id: number, isNew: boolean) => {
    return request(`${PRODUCT_BASE_URL}/${id}/new`, {
      method: 'POST',
      data: { isNew },
    });
  },

  /**
   * 设为热销
   */
  setHot: async (id: number, isHot: boolean) => {
    return request(`${PRODUCT_BASE_URL}/${id}/hot`, {
      method: 'POST',
      data: { isHot },
    });
  },

  /**
   * 获取商品统计
   */
  getStats: async () => {
    return request(`${PRODUCT_BASE_URL}/stats`, {
      method: 'GET',
    });
  },

  /**
   * 获取回收站列表
   */
  getRecycleList: async () => {
    return request(`${PRODUCT_BASE_URL}/recycle`, {
      method: 'GET',
    });
  },

  /**
   * 恢复商品
   */
  restore: async (id: number) => {
    return request(`${PRODUCT_BASE_URL}/${id}/restore`, {
      method: 'POST',
    });
  },

  /**
   * 获取 SKU 列表
   */
  getSkus: async (productId: number) => {
    return request(`${PRODUCT_BASE_URL}/${productId}/skus`, {
      method: 'GET',
    });
  },

  /**
   * 创建 SKU
   */
  createSku: async (productId: number, data: ProductSkuFormData) => {
    return request(`${PRODUCT_BASE_URL}/${productId}/skus`, {
      method: 'POST',
      data,
    });
  },

  /**
   * 更新 SKU
   */
  updateSku: async (id: number, data: ProductSkuFormData) => {
    return request(`${SKU_BASE_URL}/${id}`, {
      method: 'PUT',
      data,
    });
  },

  /**
   * 删除 SKU
   */
  deleteSku: async (id: number) => {
    return request(`${SKU_BASE_URL}/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * 生成 SKU 矩阵
   */
  generateSkuMatrix: async (data: SkuMatrixGenerateData) => {
    return request(`${PRODUCT_BASE_URL}/skus/matrix`, {
      method: 'POST',
      data,
    });
  },

  /**
   * 获取规格属性
   */
  getSpecAttributes: async (productId: number) => {
    return request(`${PRODUCT_BASE_URL}/${productId}/spec-attributes`, {
      method: 'GET',
    });
  },

  /**
   * 获取 SKU 库存日志
   */
  getSkuStockLogs: async (skuId: number) => {
    return request(`${SKU_BASE_URL}/${skuId}/stock-logs`, {
      method: 'GET',
    });
  },

  /**
   * 调整 SKU 库存
   */
  adjustSkuStock: async (skuId: number, quantity: number, type: number, remark?: string) => {
    return request(`${SKU_BASE_URL}/${skuId}/stock`, {
      method: 'POST',
      data: { quantity, type, remark },
    });
  },

  /**
   * 获取商品统计（带分类和品牌）
   */
  getStatsDetailed: async () => {
    return request(`${PRODUCT_BASE_URL}/stats/detailed`, {
      method: 'GET',
    });
  },

  /**
   * 添加商品关联
   */
  addRelation: async (data: ProductRelationFormData) => {
    return request(PRODUCT_RELATION_BASE_URL, {
      method: 'POST',
      data,
    });
  },

  /**
   * 获取商品关联列表
   */
  getRelations: async (productId: number) => {
    return request(`${PRODUCT_BASE_URL}/${productId}/relations`, {
      method: 'GET',
    });
  },

  /**
   * 删除商品关联
   */
  deleteRelation: async (id: number) => {
    return request(`${PRODUCT_RELATION_BASE_URL}/${id}`, {
      method: 'DELETE',
    });
  },
};

// 兼容旧的导出方式
export async function getProductList(params: any) {
  return productApi.getList(params);
}

export async function getProductById(id: number) {
  return productApi.getById(id);
}

export async function createProduct(data: ProductFormData) {
  return productApi.create(data);
}

export async function updateProduct(id: number, data: ProductFormData) {
  return productApi.update(id, data);
}

export async function updateProductWithConfirm(id: number, data: ProductFormData, confirm: boolean) {
  return productApi.updateWithConfirm(id, data, confirm);
}

export async function deleteProduct(id: number) {
  return productApi.delete(id);
}

export async function batchDeleteProducts(ids: number[]) {
  return productApi.batchDelete(ids);
}

export async function batchUpdateStatus(ids: number[], status: 'active' | 'inactive') {
  return productApi.batchUpdateStatus(ids, status);
}

export async function publishProduct(id: number) {
  return productApi.publish(id);
}

export async function unpublishProduct(id: number) {
  return productApi.unpublish(id);
}

export async function setRecommend(id: number, recommend: boolean) {
  return productApi.setRecommend(id, recommend);
}

export async function setNew(id: number, isNew: boolean) {
  return productApi.setNew(id, isNew);
}

export async function setHot(id: number, isHot: boolean) {
  return productApi.setHot(id, isHot);
}

export async function getProductStats() {
  return productApi.getStats();
}

export async function getRecycleList() {
  return productApi.getRecycleList();
}

export async function restoreProduct(id: number) {
  return productApi.restore(id);
}

export async function getProductSkus(productId: number) {
  return productApi.getSkus(productId);
}

export async function createSku(productId: number, data: ProductSkuFormData) {
  return productApi.createSku(productId, data);
}

export async function updateSku(id: number, data: ProductSkuFormData) {
  return productApi.updateSku(id, data);
}

export async function deleteSku(id: number) {
  return productApi.deleteSku(id);
}

export async function generateSkuMatrix(data: SkuMatrixGenerateData) {
  return productApi.generateSkuMatrix(data);
}

export async function getSpecAttributes(productId: number) {
  return productApi.getSpecAttributes(productId);
}

export async function getSkuStockLogs(skuId: number) {
  return productApi.getSkuStockLogs(skuId);
}

export async function adjustSkuStock(skuId: number, quantity: number, type: number, remark?: string) {
  return productApi.adjustSkuStock(skuId, quantity, type, remark);
}

export async function getProductStatsDetailed() {
  return productApi.getStatsDetailed();
}

export async function addProductRelation(data: ProductRelationFormData) {
  return productApi.addRelation(data);
}

export async function getProductRelations(productId: number) {
  return productApi.getRelations(productId);
}

export async function deleteProductRelation(id: number) {
  return productApi.deleteRelation(id);
}
