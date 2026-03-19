import { request } from '@umijs/max';

/**
 * 获取会员列表
 */
export async function getMemberList(params: any) {
  return request('/api/mall/members', {
    method: 'GET',
    params,
  });
}

/**
 * 获取会员详情
 */
export async function getMemberById(userId: number) {
  return request(`/api/mall/members/${userId}`, {
    method: 'GET',
  });
}

/**
 * 更新会员等级
 */
export async function updateMemberLevel(userId: number, data: { levelId: number }) {
  return request(`/api/mall/members/${userId}/level`, {
    method: 'PUT',
    data,
  });
}

/**
 * 调整积分
 */
export async function adjustPoints(userId: number, points: number, type: number, remark?: string) {
  return request(`/api/mall/members/${userId}/points`, {
    method: 'POST',
    data: { points, type, remark },
  });
}

/**
 * 调整成长值
 */
export async function adjustGrowth(userId: number, growth: number, type: number, remark?: string) {
  return request(`/api/mall/members/${userId}/growth`, {
    method: 'POST',
    data: { growth, type, remark },
  });
}

/**
 * 更新会员状态
 */
export async function updateMemberStatus(userId: number, status: number) {
  return request(`/api/mall/members/${userId}/status`, {
    method: 'PUT',
    data: { status },
  });
}

/**
 * 获取积分日志
 */
export async function getPointsLog(userId: number, params: any) {
  return request(`/api/mall/members/${userId}/points-log`, {
    method: 'GET',
    params,
  });
}

/**
 * 获取成长值日志
 */
export async function getGrowthLog(userId: number, params: any) {
  return request(`/api/mall/members/${userId}/growth-log`, {
    method: 'GET',
    params,
  });
}

/**
 * 获取会员统计
 */
export async function getMemberStats() {
  return request('/api/mall/members/stats', {
    method: 'GET',
  });
}
