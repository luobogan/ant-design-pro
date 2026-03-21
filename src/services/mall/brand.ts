import { request } from '@umijs/max';
import { API_MALL_BASE_PATH } from '@/constants';

const BRAND_BASE_URL = `${API_MALL_BASE_PATH}/brands`;

/**
 * 获取品牌列表
 */
export async function getBrandList(params: any) {
  return request(BRAND_BASE_URL, {
    method: 'GET',
    params,
  });
}

/**
 * 获取品牌详情
 */
export async function getBrandById(id: number) {
  return request(`${BRAND_BASE_URL}/${id}`, {
    method: 'GET',
  });
}

/**
 * 创建品牌
 */
export async function createBrand(data: any) {
  return request(BRAND_BASE_URL, {
    method: 'POST',
    data,
  });
}

/**
 * 更新品牌
 */
export async function updateBrand(id: number, data: any) {
  return request(`${BRAND_BASE_URL}/${id}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除品牌
 */
export async function deleteBrand(id: number) {
  return request(`${BRAND_BASE_URL}/${id}`, {
    method: 'DELETE',
  });
}

/**
 * 获取品牌统计
 */
export async function getBrandStats() {
  return request(`${BRAND_BASE_URL}/stats`, {
    method: 'GET',
  });
}
