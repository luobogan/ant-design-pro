import { request } from 'umi';

/**
 * 分类参数 API
 */
export const categoryParamApi = {
  /**
   * 根据分类ID获取参数
   */
  getParamsByCategoryId: async (categoryId: number) => {
    const response = await request(`/api/blade-mall/category-param/get-by-category-id/${categoryId}`, {
      method: 'GET',
    });
    return response.data;
  },
};

export default categoryParamApi;