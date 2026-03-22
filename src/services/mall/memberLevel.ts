import { request } from '@umijs/max';
import { API_MALL_BASE_PATH } from '@/constants';

const MEMBER_LEVEL_BASE_URL = `${API_MALL_BASE_PATH}/member-levels`;

// SpringBlade 响应格式
interface BladeResponse<T> {
  code: number;
  data: T;
  msg: string;
}

/**
 * 获取会员等级列表
 */
export async function getMemberLevelList(params?: any) {
  const response = await request<BladeResponse<any>>(MEMBER_LEVEL_BASE_URL, {
    method: 'GET',
    params,
  });
  return response.data;
}

/**
 * 获取会员等级详情
 */
export async function getMemberLevelById(id: number) {
  const response = await request<BladeResponse<any>>(`${MEMBER_LEVEL_BASE_URL}/${id}`, {
    method: 'GET',
  });
  return response.data;
}

/**
 * 创建会员等级
 */
export async function createMemberLevel(data: any) {
  const response = await request<BladeResponse<any>>(MEMBER_LEVEL_BASE_URL, {
    method: 'POST',
    data,
  });
  return response.data;
}

/**
 * 更新会员等级
 */
export async function updateMemberLevel(id: number, data: any) {
  const response = await request<BladeResponse<any>>(`${MEMBER_LEVEL_BASE_URL}/${id}`, {
    method: 'PUT',
    data,
  });
  return response.data;
}

/**
 * 删除会员等级
 */
export async function deleteMemberLevel(id: number) {
  return request(`${MEMBER_LEVEL_BASE_URL}/${id}`, {
    method: 'DELETE',
  });
}
