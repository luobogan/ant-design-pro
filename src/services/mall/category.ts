import { request } from '@umijs/max';
import { API_MALL_BASE_PATH } from '@/constants';
import type {
  Category,
  CategoryFormData,
  CategoryAttribute,
  CategoryAttributeFormData,
  CategoryAttributeValueFormData,
} from './typings';

const CATEGORY_BASE_URL = `${API_MALL_BASE_PATH}/categories`;
const CATEGORY_ATTRIBUTE_BASE_URL = `${API_MALL_BASE_PATH}/category-attributes`;

export const categoryApi = {
  getTree: async (): Promise<Category[]> => {
    return request(`${CATEGORY_BASE_URL}/tree`, {
      method: 'GET',
    });
  },

  getList: async (params?: { page?: number; pageSize?: number }) => {
    return request(CATEGORY_BASE_URL, {
      method: 'GET',
      params,
    });
  },

  getById: async (id: number): Promise<Category> => {
    return request(`${CATEGORY_BASE_URL}/${id}`, {
      method: 'GET',
    });
  },

  create: async (data: CategoryFormData): Promise<Category> => {
    return request(CATEGORY_BASE_URL, {
      method: 'POST',
      data,
    });
  },

  update: async (id: number, data: CategoryFormData): Promise<Category> => {
    return request(`${CATEGORY_BASE_URL}/${id}`, {
      method: 'PUT',
      data,
    });
  },

  delete: async (id: number): Promise<void> => {
    return request(`${CATEGORY_BASE_URL}/${id}`, {
      method: 'DELETE',
    });
  },

  updateSort: async (data: { id: number; sort: number }[]): Promise<void> => {
    return request(`${CATEGORY_BASE_URL}/sort`, {
      method: 'PUT',
      data,
    });
  },
};

export const categoryAttributeApi = {
  create: async (data: CategoryAttributeFormData): Promise<CategoryAttribute> => {
    return request(CATEGORY_ATTRIBUTE_BASE_URL, {
      method: 'POST',
      data,
    });
  },

  update: async (
    id: number,
    data: Partial<CategoryAttributeFormData>,
  ): Promise<CategoryAttribute> => {
    return request(`${CATEGORY_ATTRIBUTE_BASE_URL}/${id}`, {
      method: 'PUT',
      data,
    });
  },

  delete: async (id: number): Promise<void> => {
    return request(`${CATEGORY_ATTRIBUTE_BASE_URL}/${id}`, {
      method: 'DELETE',
    });
  },

  getByCategoryId: async (categoryId: number): Promise<CategoryAttribute[]> => {
    return request(`${CATEGORY_ATTRIBUTE_BASE_URL}/category/${categoryId}`, {
      method: 'GET',
    });
  },

  getPage: async (params?: {
    page?: number;
    size?: number;
    categoryId?: number;
  }): Promise<{ list: CategoryAttribute[]; total: number }> => {
    return request(CATEGORY_ATTRIBUTE_BASE_URL, {
      method: 'GET',
      params,
    });
  },

  addValue: async (data: CategoryAttributeValueFormData): Promise<void> => {
    return request(`${CATEGORY_ATTRIBUTE_BASE_URL}/values`, {
      method: 'POST',
      data,
    });
  },

  batchAddValues: async (
    attributeId: number,
    values: CategoryAttributeValueFormData[],
  ): Promise<void> => {
    return request(`${CATEGORY_ATTRIBUTE_BASE_URL}/${attributeId}/values/batch`, {
      method: 'POST',
      data: values,
    });
  },

  deleteValue: async (id: number): Promise<void> => {
    return request(`${CATEGORY_ATTRIBUTE_BASE_URL}/values/${id}`, {
      method: 'DELETE',
    });
  },

  copy: async (data: {
    sourceCategoryId: number;
    targetCategoryIds: number[];
  }): Promise<void> => {
    return request(`${CATEGORY_ATTRIBUTE_BASE_URL}/copy`, {
      method: 'POST',
      data,
    });
  },
};

export default categoryApi;
