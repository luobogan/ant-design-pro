import { request } from '@umijs/max';
import { API_MALL_BASE_PATH } from '@/constants';
import type { CategoryParamTemplate, CategoryParamTemplateFormData } from './typings';

const CATEGORY_PARAM_BASE_URL = `${API_MALL_BASE_PATH}/category-param-templates`;

// SpringBlade 响应格式
interface BladeResponse<T> {
  code: number;
  data: T;
  msg: string;
}

export const categoryParamApi = {
  getParamsByCategoryId: async (
    categoryId: number,
  ): Promise<CategoryParamTemplate[]> => {
    const response = await request<BladeResponse<CategoryParamTemplate[]>>(`${CATEGORY_PARAM_BASE_URL}/category/${categoryId}`, {
      method: 'GET',
    });
    return response.data;
  },

  createParam: async (
    data: CategoryParamTemplateFormData,
  ): Promise<CategoryParamTemplate> => {
    const response = await request<BladeResponse<CategoryParamTemplate>>(CATEGORY_PARAM_BASE_URL, {
      method: 'POST',
      data,
    });
    return response.data;
  },

  updateParam: async (
    id: number,
    data: Partial<CategoryParamTemplateFormData>,
  ): Promise<CategoryParamTemplate> => {
    const response = await request<BladeResponse<CategoryParamTemplate>>(`${CATEGORY_PARAM_BASE_URL}/${id}`, {
      method: 'PUT',
      data,
    });
    return response.data;
  },

  deleteParam: async (id: number): Promise<void> => {
    return request(`${CATEGORY_PARAM_BASE_URL}/${id}`, {
      method: 'DELETE',
    });
  },

  copyParamsToCategory: async (
    sourceCategoryId: number,
    targetCategoryId: number,
  ): Promise<void> => {
    return request(`${CATEGORY_PARAM_BASE_URL}/copy`, {
      method: 'POST',
      data: { sourceCategoryId, targetCategoryId },
    });
  },
};
