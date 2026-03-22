import { request } from '@umijs/max';
import { API_MALL_BASE_PATH } from '@/constants';

const MEMBER_BASE_URL = `${API_MALL_BASE_PATH}/members`;

// SpringBlade 响应格式
interface BladeResponse<T> {
  code: number;
  data: T;
  msg: string;
}

/**
 * 获取会员列表
 */
export async function getMemberList(params: any) {
  const response = await request<BladeResponse<any>>(MEMBER_BASE_URL, {
    method: 'GET',
    params,
  });
  return response.data;
}

/**
 * 获取会员详情
 */
export async function getMemberById(userId: number) {
  const response = await request<BladeResponse<any>>(`${MEMBER_BASE_URL}/${userId}`, {
    method: 'GET',
  });
  return response.data;
}

/**
 * 更新会员等级
 */
export async function updateMemberLevel(userId: number, data: { levelId: number }) {
  const response = await request<BladeResponse<any>>(`${MEMBER_BASE_URL}/${userId}/level`, {
    method: 'PUT',
    data,
  });
  return response.data;
}

/**
 * 调整积分
 */
export async function adjustPoints(userId: number, points: number, type: number, remark?: string) {
  const response = await request<BladeResponse<any>>(`${MEMBER_BASE_URL}/${userId}/points`, {
    method: 'POST',
    data: { points, type, remark },
  });
  return response.data;
}

/**
 * 调整成长值
 */
export async function adjustGrowth(userId: number, growth: number, type: number, remark?: string) {
  const response = await request<BladeResponse<any>>(`${MEMBER_BASE_URL}/${userId}/growth`, {
    method: 'POST',
    data: { growth, type, remark },
  });
  return response.data;
}

/**
 * 更新会员状态
 */
export async function updateMemberStatus(userId: number, status: number) {
  const response = await request<BladeResponse<any>>(`${MEMBER_BASE_URL}/${userId}/status`, {
    method: 'PUT',
    data: { status },
  });
  return response.data;
}

/**
 * 获取积分日志
 */
export async function getPointsLog(userId: number, params: any) {
  const response = await request<BladeResponse<any>>(`${MEMBER_BASE_URL}/${userId}/points-log`, {
    method: 'GET',
    params,
  });
  return response.data;
}

/**
 * 获取成长值日志
 */
export async function getGrowthLog(userId: number, params: any) {
  const response = await request<BladeResponse<any>>(`${MEMBER_BASE_URL}/${userId}/growth-log`, {
    method: 'GET',
    params,
  });
  return response.data;
}

/**
 * 获取会员统计
 */
export async function getMemberStats() {
  const response = await request<BladeResponse<any>>(`${MEMBER_BASE_URL}/stats`, {
    method: 'GET',
  });
  return response.data;
}
