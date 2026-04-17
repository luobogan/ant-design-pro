import { request } from '@umijs/max';
import type { Product, ProductFormData, ProductSkuFormData, SkuMatrixGenerateData, ProductRelationFormData } from './typings';
import { API_MALL_BASE_PATH } from '@/constants';

const PRODUCT_BASE_URL = `${API_MALL_BASE_PATH}/products`;
const SKU_BASE_URL = `${PRODUCT_BASE_URL}/skus`;
const PRODUCT_RELATION_BASE_URL = `${API_MALL_BASE_PATH}/product-relations`;

// SpringBlade 响应格式
interface BladeResponse<T> {
  code: number;
  data: T;
  msg: string;
}

/**
 * 商品 API
 */
export const productApi = {
  /**
   * 获取商品列表
   */
  getList: async (params: any) => {
    const response = await request<BladeResponse<any>>(PRODUCT_BASE_URL, {
      method: 'GET',
      params,
    });
    return response.data;
  },

  /**
   * 获取商品详情
   */
  getById: async (id: string) => {
    const response = await request<BladeResponse<Product>>(`${PRODUCT_BASE_URL}/${id}`, {
      method: 'GET',
    });
    return response.data;
  },

  /**
   * 创建商品
   */
  create: async (data: ProductFormData) => {
    const response = await request<BladeResponse<Product>>(PRODUCT_BASE_URL, {
      method: 'POST',
      data,
    });
    return response.data;
  },

  /**
   * 更新商品
   */
  update: async (id: string, data: ProductFormData) => {
    const response = await request<BladeResponse<Product>>(`${PRODUCT_BASE_URL}/${id}`, {
      method: 'PUT',
      data,
    });
    return response.data;
  },

  /**
   * 更新商品（带确认）
   */
  updateWithConfirm: async (id: string, data: ProductFormData, confirm: boolean) => {
    const response = await request<BladeResponse<Product>>(`${PRODUCT_BASE_URL}/${id}`, {
      method: 'PUT',
      params: { confirmEdit: confirm },
      data,
    });
    return response.data;
  },

  /**
   * 删除商品
   */
  delete: async (id: string) => {
    return request(`${PRODUCT_BASE_URL}/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * 批量删除商品
   */
  batchDelete: async (ids: string[]) => {
    return request(`${PRODUCT_BASE_URL}/batch-delete`, {
      method: 'POST',
      data: { ids },
    });
  },

  /**
   * 批量更新状态
   */
  batchUpdateStatus: async (ids: string[], status: 'active' | 'inactive') => {
    return request(`${PRODUCT_BASE_URL}/batch-status`, {
      method: 'POST',
      data: { ids, status },
    });
  },

  /**
   * 商品上架
   */
  publish: async (id: string) => {
    const response = await request<BladeResponse<any>>(`${PRODUCT_BASE_URL}/${id}/publish`, {
      method: 'PUT',
    });
    return response.data;
  },

  /**
   * 商品下架
   */
  unpublish: async (id: string) => {
    const response = await request<BladeResponse<any>>(`${PRODUCT_BASE_URL}/${id}/unpublish`, {
      method: 'PUT',
    });
    return response.data;
  },

  /**
   * 设为推荐
   */
  setRecommend: async (id: string, recommend: boolean) => {
    const response = await request<BladeResponse<any>>(`${PRODUCT_BASE_URL}/${id}/recommend`, {
      method: 'PUT',
      data: { recommend },
    });
    return response.data;
  },

  /**
   * 设为新品
   */
  setNew: async (id: string, isNew: boolean) => {
    const response = await request<BladeResponse<any>>(`${PRODUCT_BASE_URL}/${id}/new`, {
      method: 'PUT',
      data: { isNew },
    });
    return response.data;
  },

  /**
   * 设为热销
   */
  setHot: async (id: string, isHot: boolean) => {
    const response = await request<BladeResponse<any>>(`${PRODUCT_BASE_URL}/${id}/hot`, {
      method: 'PUT',
      data: { isHot },
    });
    return response.data;
  },

  /**
   * 获取商品统计
   */
  getStats: async () => {
    const response = await request<BladeResponse<any>>(`${PRODUCT_BASE_URL}/stats`, {
      method: 'GET',
    });
    return response.data;
  },

  /**
   * 获取回收站列表
   */
  getRecycleList: async () => {
    const response = await request<BladeResponse<any>>(`${PRODUCT_BASE_URL}/recycle`, {
      method: 'GET',
    });
    return response.data;
  },

  /**
   * 恢复商品
   */
  restore: async (id: string) => {
    const response = await request<BladeResponse<any>>(`${PRODUCT_BASE_URL}/${id}/restore`, {
      method: 'POST',
    });
    return response.data;
  },

  /**
   * 获取 SKU 列表
   */
  getSkus: async (productId: string) => {
    const response = await request<BladeResponse<any> | { success: boolean; message: string; data: any }>(`${PRODUCT_BASE_URL}/${productId}/skus`, {
      method: 'GET',
    });

    const data = response.data;

    // 处理 success 格式的响应
    if (data?.success !== undefined) {
      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.message || '获取 SKU 列表失败');
      }
    }

    // 处理传统 code 格式的响应
    return data;
  },

  /**
   * 创建 SKU
   */
  createSku: async (productId: string, data: ProductSkuFormData) => {
    const response = await request<BladeResponse<any>>(`${PRODUCT_BASE_URL}/${productId}/skus`, {
      method: 'POST',
      data,
    });
    return response.data;
  },

  /**
   * 更新 SKU
   */
  updateSku: async (id: string, data: ProductSkuFormData) => {
    const response = await request<BladeResponse<any>>(`${SKU_BASE_URL}/${id}`, {
      method: 'PUT',
      data,
    });
    return response.data;
  },

  /**
   * 删除 SKU
   */
  deleteSku: async (id: string) => {
    return request(`${SKU_BASE_URL}/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * 生成 SKU 矩阵
   */
  generateSkuMatrix: async (data: SkuMatrixGenerateData) => {
    const response = await request<BladeResponse<any>>(`${PRODUCT_BASE_URL}/skus/matrix`, {
      method: 'POST',
      data,
    });
    return response.data;
  },

  /**
   * 获取规格属性
   */
  getSpecAttributes: async (productId: string) => {
    const response = await request<BladeResponse<any>>(`${PRODUCT_BASE_URL}/${productId}/spec-attributes`, {
      method: 'GET',
    });
    return response.data;
  },

  /**
   * 获取 SKU 库存日志
   */
  getSkuStockLogs: async (skuId: string) => {
    const response = await request<BladeResponse<any> | { success: boolean; message: string; data: any }>(`${SKU_BASE_URL}/${skuId}/stock-logs`, {
      method: 'GET',
    });

    const data = response.data;

    // 处理 success 格式的响应
    if (data?.success !== undefined) {
      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.message || '获取 SKU 库存日志失败');
      }
    }

    // 处理传统 code 格式的响应
    return data;
  },

  /**
   * 调整 SKU 库存
   */
  adjustSkuStock: async (skuId: string, quantity: number, type: number, remark?: string) => {
    const response = await request<BladeResponse<any> | { success: boolean; message: string; data: any }>(`${SKU_BASE_URL}/${skuId}/stock`, {
      method: 'POST',
      data: { quantity, type, remark },
    });

    const data = response.data;

    // 处理 success 格式的响应
    if (data?.success !== undefined) {
      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.message || '调整 SKU 库存失败');
      }
    }

    // 处理传统 code 格式的响应
    return data;
  },

  /**
   * 获取商品统计（带分类和品牌）
   */
  getStatsDetailed: async () => {
    const response = await request<BladeResponse<any>>(`${PRODUCT_BASE_URL}/stats/detailed`, {
      method: 'GET',
    });
    return response.data;
  },

  /**
   * 添加商品关联
   */
  addRelation: async (data: ProductRelationFormData) => {
    const response = await request<BladeResponse<any>>(PRODUCT_RELATION_BASE_URL, {
      method: 'POST',
      data,
    });
    return response.data;
  },

  /**
   * 获取商品关联列表
   */
  getRelations: async (productId: string) => {
    const response = await request<BladeResponse<any>>(`${PRODUCT_BASE_URL}/${productId}/relations`, {
      method: 'GET',
    });
    return response.data;
  },

  /**
   * 删除商品关联
   */
  deleteRelation: async (id: string) => {
    return request(`${PRODUCT_RELATION_BASE_URL}/${id}`, {
      method: 'DELETE',
    });
  },
};

// 兼容旧的导出方式
export async function getProductList(params: any) {
  return productApi.getList(params);
}

export async function getProductById(id: string) {
  return productApi.getById(id);
}

export async function createProduct(data: ProductFormData) {
  return productApi.create(data);
}

export async function updateProduct(id: string, data: ProductFormData) {
  return productApi.update(id, data);
}

export async function updateProductWithConfirm(id: string, data: ProductFormData, confirm: boolean) {
  return productApi.updateWithConfirm(id, data, confirm);
}

export async function deleteProduct(id: string) {
  return productApi.delete(id);
}

export async function batchDeleteProducts(ids: string[]) {
  return productApi.batchDelete(ids);
}

export async function batchUpdateStatus(ids: string[], status: 'active' | 'inactive') {
  return productApi.batchUpdateStatus(ids, status);
}

export async function publishProduct(id: string) {
  return productApi.publish(id);
}

export async function unpublishProduct(id: string) {
  return productApi.unpublish(id);
}

export async function setRecommend(id: string, recommend: boolean) {
  return productApi.setRecommend(id, recommend);
}

export async function setNew(id: string, isNew: boolean) {
  return productApi.setNew(id, isNew);
}

export async function setHot(id: string, isHot: boolean) {
  return productApi.setHot(id, isHot);
}

export async function getProductStats() {
  return productApi.getStats();
}

export async function getRecycleList() {
  return productApi.getRecycleList();
}

export async function restoreProduct(id: string) {
  return productApi.restore(id);
}

export async function getProductSkus(productId: string) {
  return productApi.getSkus(productId);
}

export async function deleteSku(id: string) {
  return productApi.deleteSku(id);
}

export async function getSkuStockLogs(skuId: string) {
  return productApi.getSkuStockLogs(skuId);
}

export async function adjustSkuStock(skuId: string, quantity: number, type: number, remark?: string) {
  return productApi.adjustSkuStock(skuId, quantity, type, remark);
}
