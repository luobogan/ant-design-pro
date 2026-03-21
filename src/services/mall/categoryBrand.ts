import { request } from '@umijs/max';
import { API_MALL_BASE_PATH } from '@/constants';
import type { Brand } from './typings';

const CATEGORY_BRAND_BASE_URL = `${API_MALL_BASE_PATH}/category-brands`;

export const categoryBrandApi = {
  getBrandsByCategoryId: async (categoryId: number): Promise<Brand[]> => {
    return request(`${CATEGORY_BRAND_BASE_URL}/category/${categoryId}`, {
      method: 'GET',
    });
  },

  saveCategoryBrands: async (
    categoryId: number,
    brandIds: number[],
  ): Promise<void> => {
    return request(`${CATEGORY_BRAND_BASE_URL}/category/${categoryId}`, {
      method: 'POST',
      data: brandIds,
    });
  },

  removeBrandFromCategory: async (
    categoryId: number,
    brandId: number,
  ): Promise<void> => {
    return request(`${CATEGORY_BRAND_BASE_URL}/category/${categoryId}/brand/${brandId}`, {
      method: 'DELETE',
    });
  },
};

export default categoryBrandApi;
