import { request } from 'umi';

/**
 * 分类属性 API
 */
export const categoryAttributeApi = {
  /**
   * 根据分类ID获取属性
   */
  getByCategoryId: async (categoryId: number) => {
    const response = await request(`/api/blade-mall/category-attribute/get-by-category-id/${categoryId}`, {
      method: 'GET',
    });
    return response.data;
  },
};

export default categoryAttributeApi;