import { request } from 'umi';
import { API_MALL_BASE_PATH } from '@/constants';

const CATEGORY_ATTRIBUTE_BASE_URL = `${API_MALL_BASE_PATH}/category-attribute`;

/**
 * 分类属性 API
 */
export const categoryAttributeApi = {
  /**
   * 根据分类ID获取属性
   */
  getByCategoryId: async (categoryId: number) => {
    const response = await request(`${CATEGORY_ATTRIBUTE_BASE_URL}/get-by-category-id/${categoryId}`, {
      method: 'GET',
    });
    return response.data;
  },
};

export default categoryAttributeApi;
