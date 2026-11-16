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

/**
 * 按「当前数据权限配置」分页查询业务数据（**真实数据，非 mock**）。
 *
 * <p>后端 `POST /api/blade-formmode/form-data/page-scope/{formId}`：
 * current/size 走查询参数、过滤条件走请求体；resourceCode（= 菜单 code）用于定位
 * `blade_scope_data` 的行级规则（scope_column / scope_type / scope_value），
 * 返回体为 Spring IPage 原生形态 `{ records, total, size, current, pages }`。</p>
 *
 * <p>与表单预览（ExcelPreviewPage）口径一致：值一律为**原始值**
 * （浏览按钮 = id 逗号串），显示名称由前端按需反查（与 FieldControl 同一套解析）。</p>
 */
export async function fetchScopeFormData(params: {
  formId: string | number;
  /** 资源编号（菜单 code），用于套用数据权限行级规则 */
  resourceCode?: string;
  current?: number;
  size?: number;
  /** 过滤条件（字段名 → 值，LIKE 模糊） */
  filters?: Record<string, any>;
}): Promise<{ records: any[]; total: number; size: number; current: number }> {
  const { formId, resourceCode, current = 1, size = 20, filters } = params;
  const query = [`current=${current}`, `size=${size}`];
  if (resourceCode) {
    query.push(`resourceCode=${encodeURIComponent(resourceCode)}`);
  }
  const res: any = await request(
    `/api/blade-formmode/form-data/page-scope/${formId}?${query.join('&')}`,
    { method: 'POST', data: filters ?? {} },
  );
  const page = res?.data ?? {};
  return {
    records: Array.isArray(page.records) ? page.records : [],
    total: Number(page.total ?? 0),
    size: Number(page.size ?? size),
    current: Number(page.current ?? current),
  };
}

/**
 * 按「单元格」更新业务数据（通用列表行内编辑）。
 *
 * <p>后端 `PUT /api/blade-formmode/form-data/{formId}/{dataId}/cell`，
 * body = `{ fieldName, value }`。与整体覆盖接口（`PUT /{formId}/{dataId}`）的差异：
 * **只改这一格**，其余字段一律保留库中原值 —— 列表页只提交「这一格改了什么」，
 * 整体覆盖会把未加载/未渲染的字段清空。</p>
 */
export async function updateScopeCell(params: {
  formId: string | number;
  dataId: string | number;
  /** 数据库列名 */
  fieldName: string;
  value: any;
}): Promise<boolean> {
  const { formId, dataId, fieldName, value } = params;
  const res: any = await request(`/api/blade-formmode/form-data/${formId}/${dataId}/cell`, {
    method: 'PUT',
    data: { fieldName, value },
  });
  return res?.data === true;
}

/**
 * 新增业务数据行（通用列表「新增行」）。
 *
 * <p>后端 `POST /api/blade-formmode/form-data/{formId}`，body = 字段名→值的 Map，
 * 返回新行主键 id。只传主表真实存在的列（后端会按列元数据过滤），
 * 审计列由后端写入。</p>
 */
export async function createScopeRow(params: {
  formId: string | number;
  /** 初始字段值（可为空对象 = 先建空行，再逐格填写） */
  fields?: Record<string, any>;
}): Promise<string | number | null> {
  const { formId, fields } = params;
  const res: any = await request(`/api/blade-formmode/form-data/${formId}`, {
    method: 'POST',
    data: fields ?? {},
  });
  const id = res?.data;
  return id === undefined || id === null ? null : id;
}

/**
 * 删除业务数据行（通用列表「删除」）。
 *
 * <p>后端 `POST /api/blade-formmode/form-data/{formId}/batch-delete`，body = id 数组。</p>
 */
export async function deleteScopeRows(params: {
  formId: string | number;
  dataIds: (string | number)[];
}): Promise<boolean> {
  const { formId, dataIds } = params;
  if (!dataIds?.length) return true;
  const res: any = await request(`/api/blade-formmode/form-data/${formId}/batch-delete`, {
    method: 'POST',
    data: dataIds,
  });
  return res?.success !== false;
}
