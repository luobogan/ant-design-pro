import { request } from '@umijs/max';

/**
 * 获取会员等级列表
 */
export async function getMemberLevelList(params?: any) {
  return request('/api/mall/member-levels', {
    method: 'GET',
    params,
  });
}

/**
 * 获取会员等级详情
 */
export async function getMemberLevelById(id: number) {
  return request(`/api/mall/member-levels/${id}`, {
    method: 'GET',
  });
}

/**
 * 创建会员等级
 */
export async function createMemberLevel(data: any) {
  return request('/api/mall/member-levels', {
    method: 'POST',
    data,
  });
}

/**
 * 更新会员等级
 */
export async function updateMemberLevel(id: number, data: any) {
  return request(`/api/mall/member-levels/${id}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除会员等级
 */
export async function deleteMemberLevel(id: number) {
  return request(`/api/mall/member-levels/${id}`, {
    method: 'DELETE',
  });
}
