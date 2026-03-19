import { request } from '@umijs/max';

/**
 * 获取品牌列表
 */
export async function getBrandList(params: any) {
  return request('/api/mall/brands', {
    method: 'GET',
    params,
  });
}

/**
 * 获取品牌详情
 */
export async function getBrandById(id: number) {
  return request(`/api/mall/brands/${id}`, {
    method: 'GET',
  });
}

/**
 * 创建品牌
 */
export async function createBrand(data: any) {
  return request('/api/mall/brands', {
    method: 'POST',
    data,
  });
}

/**
 * 更新品牌
 */
export async function updateBrand(id: number, data: any) {
  return request(`/api/mall/brands/${id}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除品牌
 */
export async function deleteBrand(id: number) {
  return request(`/api/mall/brands/${id}`, {
    method: 'DELETE',
  });
}

/**
 * 获取品牌统计
 */
export async function getBrandStats() {
  return request('/api/mall/brands/stats', {
    method: 'GET',
  });
}
