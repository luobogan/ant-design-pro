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

// SpringBlade 响应格式
interface BladeResponse<T> {
  code: number;
  data: T;
  msg: string;
}

export const categoryApi = {
  getTree: async (params?: { tenantId?: string }): Promise<Category[]> => {
    // 始终使用 /tree/by-tenant 接口，支持 tenantId 参数
    const url = `${CATEGORY_BASE_URL}/tree/by-tenant`;

    const response = await request<BladeResponse<Category[]>>(url, {
      method: 'GET',
      params: params?.tenantId ? { tenantId: params.tenantId } : undefined,
    });
    return response.data;
  },

  getList: async (params?: { page?: number; pageSize?: number }) => {
    return request(CATEGORY_BASE_URL, {
      method: 'GET',
      params,
    });
  },

  getById: async (id: number): Promise<Category> => {
    const response = await request<BladeResponse<Category>>(`${CATEGORY_BASE_URL}/${id}`, {
      method: 'GET',
    });
    return response.data;
  },

  create: async (data: CategoryFormData): Promise<Category> => {
    const response = await request<BladeResponse<Category>>(CATEGORY_BASE_URL, {
      method: 'POST',
      data,
    });
    return response.data;
  },

  update: async (id: number, data: CategoryFormData): Promise<Category> => {
    const response = await request<BladeResponse<Category>>(`${CATEGORY_BASE_URL}/${id}`, {
      method: 'PUT',
      data,
    });
    return response.data;
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
    const response = await request<BladeResponse<CategoryAttribute>>(CATEGORY_ATTRIBUTE_BASE_URL, {
      method: 'POST',
      data,
    });
    return response.data;
  },

  update: async (
    id: number,
    data: Partial<CategoryAttributeFormData>,
  ): Promise<CategoryAttribute> => {
    const response = await request<BladeResponse<CategoryAttribute>>(`${CATEGORY_ATTRIBUTE_BASE_URL}/${id}`, {
      method: 'PUT',
      data,
    });
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    return request(`${CATEGORY_ATTRIBUTE_BASE_URL}/${id}`, {
      method: 'DELETE',
    });
  },

  getByCategoryId: async (categoryId: number): Promise<CategoryAttribute[]> => {
    const response = await request<BladeResponse<CategoryAttribute[]>>(`${CATEGORY_ATTRIBUTE_BASE_URL}/category/${categoryId}`, {
      method: 'GET',
    });
    return response.data;
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

  batchAddValues: async (
    attributeId: number,
    values: CategoryAttributeValueFormData[],
  ): Promise<void> => {
    return request(`${CATEGORY_ATTRIBUTE_BASE_URL}/${attributeId}/values/batch`, {
      method: 'POST',
      data: {
        values: values
      },
    });
  },

  getAttributeValues: async (attributeId: number): Promise<any[]> => {
    const response = await request<BladeResponse<any[]>>(`${CATEGORY_ATTRIBUTE_BASE_URL}/${attributeId}/values`, {
      method: 'GET',
    });
    return response.data;
  },

  deleteAttributeValue: async (id: number): Promise<void> => {
    return request(`${CATEGORY_ATTRIBUTE_BASE_URL}/values/${id}`, {
      method: 'DELETE',
    });
  },
};
