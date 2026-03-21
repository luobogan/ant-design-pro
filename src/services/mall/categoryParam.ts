import { request } from 'umi';
import { API_MALL_BASE_PATH } from '@/constants';

const CATEGORY_PARAM_BASE_URL = `${API_MALL_BASE_PATH}/category-param`;

/**
 * 分类参数 API
 */
export const categoryParamApi = {
  /**
   * 根据分类ID获取参数
   */
  getParamsByCategoryId: async (categoryId: number) => {
    const response = await request(`${CATEGORY_PARAM_BASE_URL}/get-by-category-id/${categoryId}`, {
      method: 'GET',
    });
    return response.data;
  },
};

export default categoryParamApi;
