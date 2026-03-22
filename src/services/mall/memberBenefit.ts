import { request } from '@umijs/max';
import { API_MALL_BASE_PATH } from '@/constants';

const MEMBER_BENEFIT_BASE_URL = `${API_MALL_BASE_PATH}/member-benefits`;

// SpringBlade 响应格式
interface BladeResponse<T> {
  code: number;
  data: T;
  msg: string;
}

/**
 * 获取会员权益列表
 */
export async function getMemberBenefitList(params?: any) {
  const response = await request<BladeResponse<any>>(MEMBER_BENEFIT_BASE_URL, {
    method: 'GET',
    params,
  });
  return response.data;
}

/**
 * 获取会员权益详情
 */
export async function getMemberBenefitById(id: number) {
  const response = await request<BladeResponse<any>>(`${MEMBER_BENEFIT_BASE_URL}/${id}`, {
    method: 'GET',
  });
  return response.data;
}

/**
 * 创建会员权益
 */
export async function createMemberBenefit(data: any) {
  const response = await request<BladeResponse<any>>(MEMBER_BENEFIT_BASE_URL, {
    method: 'POST',
    data,
  });
  return response.data;
}

/**
 * 更新会员权益
 */
export async function updateMemberBenefit(id: number, data: any) {
  const response = await request<BladeResponse<any>>(`${MEMBER_BENEFIT_BASE_URL}/${id}`, {
    method: 'PUT',
    data,
  });
  return response.data;
}

/**
 * 删除会员权益
 */
export async function deleteMemberBenefit(id: number) {
  return request(`${MEMBER_BENEFIT_BASE_URL}/${id}`, {
    method: 'DELETE',
  });
}
