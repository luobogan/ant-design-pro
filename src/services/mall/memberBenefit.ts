import { request } from '@umijs/max';

/**
 * 获取会员权益列表
 */
export async function getMemberBenefitList(params?: any) {
  return request('/api/mall/member-benefits', {
    method: 'GET',
    params,
  });
}

/**
 * 获取会员权益详情
 */
export async function getMemberBenefitById(id: number) {
  return request(`/api/mall/member-benefits/${id}`, {
    method: 'GET',
  });
}

/**
 * 创建会员权益
 */
export async function createMemberBenefit(data: any) {
  return request('/api/mall/member-benefits', {
    method: 'POST',
    data,
  });
}

/**
 * 更新会员权益
 */
export async function updateMemberBenefit(id: number, data: any) {
  return request(`/api/mall/member-benefits/${id}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除会员权益
 */
export async function deleteMemberBenefit(id: number) {
  return request(`/api/mall/member-benefits/${id}`, {
    method: 'DELETE',
  });
}
