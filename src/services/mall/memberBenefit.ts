import { request } from '@umijs/max';
import { API_MALL_BASE_PATH } from '@/constants';

const MEMBER_BENEFIT_BASE_URL = `${API_MALL_BASE_PATH}/member-benefits`;

/**
 * 获取会员权益列表
 */
export async function getMemberBenefitList(params?: any) {
  return request(MEMBER_BENEFIT_BASE_URL, {
    method: 'GET',
    params,
  });
}

/**
 * 获取会员权益详情
 */
export async function getMemberBenefitById(id: number) {
  return request(`${MEMBER_BENEFIT_BASE_URL}/${id}`, {
    method: 'GET',
  });
}

/**
 * 创建会员权益
 */
export async function createMemberBenefit(data: any) {
  return request(MEMBER_BENEFIT_BASE_URL, {
    method: 'POST',
    data,
  });
}

/**
 * 更新会员权益
 */
export async function updateMemberBenefit(id: number, data: any) {
  return request(`${MEMBER_BENEFIT_BASE_URL}/${id}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除会员权益
 */
export async function deleteMemberBenefit(id: number) {
  return request(`${MEMBER_BENEFIT_BASE_URL}/${id}`, {
    method: 'DELETE',
  });
}
