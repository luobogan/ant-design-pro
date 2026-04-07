import { request } from '@umijs/max';
import { API_MALL_BASE_PATH } from '@/constants';
import type { Brand, BrandFormData, PageResponse } from './typings';

const BRAND_BASE_URL = `${API_MALL_BASE_PATH}/brands`;

// SpringBlade 响应格式
interface BladeResponse<T> {
  code: number;
  data: T;
  msg: string;
}

export const brandApi = {
  getList: async (params?: {
    page?: number;
    pageSize?: number;
  }): Promise<PageResponse<Brand>> => {
    const response = await request<BladeResponse<PageResponse<Brand>>>(BRAND_BASE_URL, {
      method: 'GET',
      params,
    });
    return response.data;
  },

  getById: async (id: number): Promise<Brand> => {
    const response = await request<BladeResponse<Brand>>(`${BRAND_BASE_URL}/${id}`, {
      method: 'GET',
    });
    return response.data;
  },

  create: async (data: BrandFormData): Promise<Brand> => {
    console.log('Brand create data:', data);
    const formData = new FormData();
    formData.append('name', data.name);
    if (data.description) {
      formData.append('description', data.description);
    }
    if (data.logo) {
      formData.append('logo', data.logo);
    }
    formData.append('sort', data.sort.toString());
    if (data.status !== undefined) {
      formData.append('status', data.status.toString());
    }

    const response = await request<BladeResponse<Brand>>(BRAND_BASE_URL, {
      method: 'POST',
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  update: async (id: number, data: BrandFormData): Promise<Brand> => {
    console.log('Brand update data:', data);
    const formData = new FormData();
    formData.append('name', data.name);
    if (data.description) {
      formData.append('description', data.description);
    }
    if (data.logo) {
      formData.append('logo', data.logo);
    }
    formData.append('sort', data.sort.toString());
    if (data.status !== undefined) {
      formData.append('status', data.status.toString());
    }

    const response = await request<BladeResponse<Brand>>(`${BRAND_BASE_URL}/${id}`, {
      method: 'PUT',
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    return request(`${BRAND_BASE_URL}/${id}`, {
      method: 'DELETE',
    });
  },

  getStats: async (): Promise<any> => {
    const response = await request<BladeResponse<any>>(`${BRAND_BASE_URL}/stats`, {
      method: 'GET',
    });
    return response.data;
  },
};

export default brandApi;
