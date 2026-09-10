import { request } from '@umijs/max';

/**
 * 表单布局API服务
 * 用于Excel设计器前后端对接
 */

/**
 * 获取表单布局
 * @param formId 表单ID（字符串类型，避免大整数精度丢失）
 * @param layouttype 布局类型：0编辑(默认) 1显示 3监控 4打印（可空）
 * @param nodeKey 流程节点Key（空=表单级通用）
 * @returns 表单布局
 */
export async function getFormLayout(formId: string, layouttype?: number, nodeKey?: string) {
  return request(`/api/blade-formmode/form-layout/${formId}`, {
    method: 'GET',
    params: { layouttype, nodeKey },
  });
}

/**
 * 保存表单布局
 * @param data 表单布局数据（含 layoutType 布局类型、nodeKey 绑定节点，均可空；空则后端按默认0/通用处理）
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
  /** 布局类型：0编辑 1显示 3监控 4打印 */
  layouttype?: number;
  /** 流程节点Key（空=通用） */
  nodeKey?: string;
}) {
  return request('/api/blade-formmode/form-layout/list', {
    method: 'GET',
    params,
  });
}
