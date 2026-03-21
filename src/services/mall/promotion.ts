import { request } from '@umijs/max';
import { API_MALL_BASE_PATH } from '@/constants';

const PROMOTION_BASE_URL = `${API_MALL_BASE_PATH}/promotions`;
const PROMOTION_PRODUCT_BASE_URL = `${API_MALL_BASE_PATH}/promotion-products`;

export const promotionApi = {
  getList: async (params?: any) => {
    return request(PROMOTION_BASE_URL, {
      method: 'GET',
      params,
    });
  },

  getById: async (id: number) => {
    return request(`${PROMOTION_BASE_URL}/${id}`, {
      method: 'GET',
    });
  },

  create: async (data: any) => {
    return request(PROMOTION_BASE_URL, {
      method: 'POST',
      data,
    });
  },

  update: async (id: number, data: any) => {
    return request(`${PROMOTION_BASE_URL}/${id}`, {
      method: 'PUT',
      data,
    });
  },

  delete: async (id: number) => {
    return request(`${PROMOTION_BASE_URL}/${id}`, {
      method: 'DELETE',
    });
  },

  getProducts: async (promotionId: number) => {
    return request(`${PROMOTION_BASE_URL}/${promotionId}/products`, {
      method: 'GET',
    });
  },

  addProduct: async (data: any) => {
    return request(PROMOTION_PRODUCT_BASE_URL, {
      method: 'POST',
      data,
    });
  },

  deleteProduct: async (id: number) => {
    return request(`${PROMOTION_PRODUCT_BASE_URL}/${id}`, {
      method: 'DELETE',
    });
  },
};

export default promotionApi;
