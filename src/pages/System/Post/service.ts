import { request } from '@umijs/max';
import { stringify } from 'qs';

/**
 * 岗位接口（页面自包含，见 CLAUDE.md 的 Page Co-location 约定）
 * 后端：blade-system PostController，前缀 /post
 */
const BASE_URL = '/api/blade-system/post';

// 岗位列表（后端 Query 分页，入参 current / size，返回 records / total）
export async function list(params: any) {
  return request(`${BASE_URL}/list?${stringify(params)}`);
}

// 岗位下拉（列表页之外的选择场景）
export async function select(params: any) {
  return request(`${BASE_URL}/select?${stringify(params)}`);
}

// 岗位详情
export async function detail(params: any) {
  return request(`${BASE_URL}/detail?${stringify(params)}`);
}

// 新增 / 修改（有 id 即修改）
export async function submit(params: any) {
  return request(`${BASE_URL}/submit`, {
    method: 'POST',
    data: params,
  });
}

// 删除（后端为 @RequestParam ids，走 query 传参而非 JSON body）
export async function remove(params: any) {
  const ids = Array.isArray(params?.ids) ? params.ids.join(',') : params?.ids;
  return request(`${BASE_URL}/remove?ids=${ids}`, {
    method: 'POST',
  });
}
