import { request } from '@umijs/max';
import { API_MALL_BASE_PATH } from '@/constants';

const PROMOTION_BASE_URL = `${API_MALL_BASE_PATH}/promotions`;
const PROMOTION_PRODUCT_BASE_URL = `${API_MALL_BASE_PATH}/promotion-products`;

// SpringBlade 响应格式
interface BladeResponse<T> {
  code: number;
  data: T;
  msg: string;
}

export const promotionApi = {
  getList: async (params?: any) => {
    const response = await request<BladeResponse<any>>(PROMOTION_BASE_URL, {
      method: 'GET',
      params,
    });
    return response.data;
  },

  getById: async (id: number) => {
    const response = await request<BladeResponse<any>>(`${PROMOTION_BASE_URL}/${id}`, {
      method: 'GET',
    });
    return response.data;
  },

  create: async (data: any) => {
    const response = await request<BladeResponse<any>>(PROMOTION_BASE_URL, {
      method: 'POST',
      data,
    });
    return response.data;
  },

  update: async (id: number, data: any) => {
    const response = await request<BladeResponse<any>>(`${PROMOTION_BASE_URL}/${id}`, {
      method: 'PUT',
      data,
    });
    return response.data;
  },

  delete: async (id: number) => {
    return request(`${PROMOTION_BASE_URL}/${id}`, {
      method: 'DELETE',
    });
  },

  getProducts: async (promotionId: number) => {
    const response = await request<BladeResponse<any>>(`${PROMOTION_BASE_URL}/${promotionId}/products`, {
      method: 'GET',
    });
    return response.data;
  },

  addProduct: async (data: any) => {
    const response = await request<BladeResponse<any>>(PROMOTION_PRODUCT_BASE_URL, {
      method: 'POST',
      data,
    });
    return response.data;
  },

  deleteProduct: async (id: number) => {
    return request(`${PROMOTION_PRODUCT_BASE_URL}/${id}`, {
      method: 'DELETE',
    });
  },
};

export default promotionApi;
