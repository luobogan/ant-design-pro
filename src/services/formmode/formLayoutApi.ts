import { request } from '@umijs/max';

/**
 * 表单布局API服务
 * 用于Excel设计器前后端对接
 */

/**
 * 获取表单布局
 * @param formId 表单ID（字符串类型，避免大整数精度丢失）
 * @returns 表单布局
 */
export async function getFormLayout(formId: string) {
  return request(`/api/blade-formmode/form-layout/${formId}`, {
    method: 'GET',
  });
}

/**
 * 保存表单布局
 * @param data 表单布局数据
 * @returns 是否成功
 */
export async function saveFormLayout(data: any) {
  return request('/api/blade-formmode/form-layout/save', {
    method: 'POST',
    data,
  });
}

/**
 * 解析布局JSON
 * @param layoutJson 布局JSON
 * @returns 解析结果
 */
export async function parseLayoutJson(layoutJson: string) {
  return request('/api/blade-formmode/form-layout/parse-json', {
    method: 'POST',
    data: layoutJson,
  });
}

/**
 * 删除表单布局
 * @param id 布局ID
 * @returns 是否成功
 */
export async function deleteFormLayout(id: number) {
  return request(`/api/blade-formmode/form-layout/${id}`, {
    method: 'DELETE',
  });
}

/**
 * 获取布局列表
 * @param params 查询参数
 * @returns 布局列表
 */
export async function getFormLayoutList(params: {
  current?: number;
  pageSize?: number;
  layoutName?: string;
  formId?: number;
}) {
  return request('/api/blade-formmode/form-layout/list', {
    method: 'GET',
    params,
  });
}
