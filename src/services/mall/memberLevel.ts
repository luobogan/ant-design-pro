import { request } from '@umijs/max';
import { API_MALL_BASE_PATH } from '@/constants';

const MEMBER_LEVEL_BASE_URL = `${API_MALL_BASE_PATH}/member-levels`;

/**
 * 获取会员等级列表
 */
export async function getMemberLevelList(params?: any) {
  return request(MEMBER_LEVEL_BASE_URL, {
    method: 'GET',
    params,
  });
}

/**
 * 获取会员等级详情
 */
export async function getMemberLevelById(id: number) {
  return request(`${MEMBER_LEVEL_BASE_URL}/${id}`, {
    method: 'GET',
  });
}

/**
 * 创建会员等级
 */
export async function createMemberLevel(data: any) {
  return request(MEMBER_LEVEL_BASE_URL, {
    method: 'POST',
    data,
  });
}

/**
 * 更新会员等级
 */
export async function updateMemberLevel(id: number, data: any) {
  return request(`${MEMBER_LEVEL_BASE_URL}/${id}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除会员等级
 */
export async function deleteMemberLevel(id: number) {
  return request(`${MEMBER_LEVEL_BASE_URL}/${id}`, {
    method: 'DELETE',
  });
}
