import { request } from '@umijs/max';
import { stringify } from 'qs';

// =====================数据权限===========================

// 获取数据权限列表（根据菜单ID）
export async function list(params: any) {
  return request(`/api/blade-system/data-scope/list?${stringify(params)}`);
}

// 删除数据权限
export async function remove(params: any) {
  // 将 ids 数组转换为逗号分隔的字符串作为查询参数
  const queryParams: any = {};
  if (params.ids && Array.isArray(params.ids)) {
    queryParams.ids = params.ids.join(',');
  }
  if (params.id) {
    queryParams.id = params.id;
  }
  return request(`/api/blade-system/data-scope/remove?${stringify(queryParams)}`, {
    method: 'POST',
  });
}

// 提交数据权限
export async function submit(params: any) {
  return request('/api/blade-system/data-scope/submit', {
    method: 'POST',
    data: params,
  });
}

// 获取数据权限详情
export async function detail(params: any) {
  return request(`/api/blade-system/data-scope/detail?${stringify(params)}`);
}

// =====================可见字段配置（列表动态列）===========================

/** 可见字段展示配置 */
export interface ScopeFieldConfig {
  id?: string;
  scopeId?: string;
  menuId?: string;
  resourceCode?: string;
  fieldId?: string;
  /** 数据库字段名（SQL SELECT 项，也是列表 dataIndex） */
  fieldName: string;
  /** 字段名称（列表表头显示名） */
  fieldLabel?: string;
  /** 数据库字段类型，决定列表渲染（日期/数字/文本） */
  fieldDbType?: string;
  fieldHtmlType?: string;
  /** 字段子类型（人力资源/部门/日期等浏览按钮子类；与 fieldHtmlType 组合确定表单控件类型） */
  fieldType?: string;
  description?: string;
  isVisible?: number;
  isEditable?: number;
  /** 列展示顺序 */
  sort?: number;
  width?: number;
  align?: 'left' | 'center' | 'right';
}

/** 查询某菜单/数据权限的可见字段配置（升序） */
export async function listScopeFields(params: {
  scopeId?: string | number;
  menuId?: string | number;
  resourceCode?: string;
}): Promise<ScopeFieldConfig[]> {
  const res: any = await request(`/api/blade-system/scope-field/list?${stringify(params)}`);
  return Array.isArray(res?.data) ? res.data : [];
}

/** 批量保存可见字段配置（按 scopeId + menuId 差集合并） */
export async function submitScopeFields(params: {
  scopeId?: string | number;
  menuId: string | number;
  resourceCode?: string;
  fields: ScopeFieldConfig[];
}) {
  return request('/api/blade-system/scope-field/submit', { method: 'POST', data: params });
}
