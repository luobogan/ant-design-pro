import { request } from '@umijs/max';
import { stringify } from 'qs';

/**
 * 字典接口（页面自包含，见 CLAUDE.md 的 Page Co-location 约定）
 * 后端：blade-system DictController，前缀 /dict
 */
const BASE_URL = '/api/blade-system/dict';

// 字典列表（返回已合并成树的结构，后端不支持分页）
export async function list(params: any) {
  return request(`${BASE_URL}/list?${stringify(params)}`);
}

// 字典树
export async function tree(params: any) {
  return request(`${BASE_URL}/tree?${stringify(params)}`);
}

// 字典详情
export async function detail(params: any) {
  return request(`${BASE_URL}/detail?${stringify(params)}`);
}

// 按字典编号取字典项（下拉选项用）
export async function dict(params: any) {
  return request(`${BASE_URL}/dictionary?${stringify(params)}`);
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
