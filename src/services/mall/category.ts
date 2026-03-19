import { request } from '@umijs/max';

/**
 * 获取分类树
 */
export async function getCategoryTree() {
  return request('/api/mall/categories/tree', {
    method: 'GET',
  });
}

/**
 * 获取分类列表
 */
export async function getCategoryList(params: any) {
  return request('/api/mall/categories', {
    method: 'GET',
    params,
  });
}

/**
 * 获取分类详情
 */
export async function getCategoryById(id: number) {
  return request(`/api/mall/categories/${id}`, {
    method: 'GET',
  });
}

/**
 * 创建分类
 */
export async function createCategory(data: any) {
  return request('/api/mall/categories', {
    method: 'POST',
    data,
  });
}

/**
 * 更新分类
 */
export async function updateCategory(id: number, data: any) {
  return request(`/api/mall/categories/${id}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除分类
 */
export async function deleteCategory(id: number) {
  return request(`/api/mall/categories/${id}`, {
    method: 'DELETE',
  });
}

/**
 * 获取分类属性
 */
export async function getCategoryAttributes(categoryId: number) {
  return request(`/api/mall/categories/${categoryId}/attributes`, {
    method: 'GET',
  });
}

/**
 * 创建分类属性
 */
export async function createCategoryAttribute(categoryId: number, data: any) {
  return request(`/api/mall/categories/${categoryId}/attributes`, {
    method: 'POST',
    data,
  });
}

/**
 * 更新分类属性
 */
export async function updateCategoryAttribute(id: number, data: any) {
  return request(`/api/mall/category-attributes/${id}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除分类属性
 */
export async function deleteCategoryAttribute(id: number) {
  return request(`/api/mall/category-attributes/${id}`, {
    method: 'DELETE',
  });
}
