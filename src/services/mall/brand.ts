import { request } from '@umijs/max';
import { API_MALL_BASE_PATH } from '@/constants';
import type { Brand, BrandFormData, PageResponse } from './typings';

const BRAND_BASE_URL = `${API_MALL_BASE_PATH}/brands`;

export const brandApi = {
  getList: async (params?: {
    page?: number;
    pageSize?: number;
  }): Promise<PageResponse<Brand>> => {
    return request(BRAND_BASE_URL, {
      method: 'GET',
      params,
    });
  },

  getById: async (id: number): Promise<Brand> => {
    return request(`${BRAND_BASE_URL}/${id}`, {
      method: 'GET',
    });
  },

  create: async (data: BrandFormData): Promise<Brand> => {
    return request(BRAND_BASE_URL, {
      method: 'POST',
      data,
    });
  },

  update: async (id: number, data: BrandFormData): Promise<Brand> => {
    return request(`${BRAND_BASE_URL}/${id}`, {
      method: 'PUT',
      data,
    });
  },

  delete: async (id: number): Promise<void> => {
    return request(`${BRAND_BASE_URL}/${id}`, {
      method: 'DELETE',
    });
  },

  getStats: async (): Promise<any> => {
    return request(`${BRAND_BASE_URL}/stats`, {
      method: 'GET',
    });
  },
};

export default brandApi;
