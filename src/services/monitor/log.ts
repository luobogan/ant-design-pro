import { request } from '@umijs/max';
import { stringify } from 'qs';

// =====================日志===========================

// 获取常规日志列表
export async function usualList(params: any) {
  return request(`/api/blade-log/usual/list?${stringify(params)}`);
}

// 获取常规日志详情
export async function usualDetail(params: any) {
  return request(`/api/blade-log/usual/detail?${stringify(params)}`);
}

// 获取API日志列表
export async function apiList(params: any) {
  return request(`/api/blade-log/api/list?${stringify(params)}`);
}

// 获取API日志详情
export async function apiDetail(params: any) {
  return request(`/api/blade-log/api/detail?${stringify(params)}`);
}

// 获取错误日志列表
export async function errorList(params: any) {
  return request(`/api/blade-log/error/list?${stringify(params)}`);
}

// 获取错误日志详情
export async function errorDetail(params: any) {
  return request(`/api/blade-log/error/detail?${stringify(params)}`);
}