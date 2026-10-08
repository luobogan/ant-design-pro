import { request } from '@umijs/max';
import { stringify } from 'qs';
import { API_BASE_PATH, APPLICATION_SYSTEM_NAME } from '@/constants';

// =====================用户===========================

const USER_BASE_URL = `${API_BASE_PATH}/${APPLICATION_SYSTEM_NAME}/user`;

// 获取用户列表
export async function list(params: any) {
  return request(`${USER_BASE_URL}/list?${stringify(params)}`);
}

// 获取用户详情
export async function detail(params: any) {
  return request(`${USER_BASE_URL}/detail?${stringify(params)}`);
}

// 提交用户信息
export async function submit(params: any) {
  return request(`${USER_BASE_URL}/submit`, {
    method: 'POST',
    data: params,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

// 更新用户信息
export async function update(params: any) {
  return request(`${USER_BASE_URL}/update`, {
    method: 'POST',
    data: params,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

// 删除用户
export async function remove(params: any) {
  return request(`${USER_BASE_URL}/remove`, {
    method: 'POST',
    data: params,
  });
}

// 获取用户选择列表
export async function select(params: any) {
  return request(`${USER_BASE_URL}/select?${stringify(params)}`);
}

// 获取用户角色
export async function roles(params: any) {
  return request(`/api/blade-system/user/roles?${stringify(params)}`);
}

// 分配用户角色
export async function grantRole(params: any) {
  return request('/api/blade-system/user/grant-role', {
    method: 'POST',
    data: params,
  });
}

// 获取用户权限
export async function permissions(params: any) {
  return request(`/api/blade-system/user/permissions?${stringify(params)}`);
}

// 重置用户密码
export async function resetPassword(params: any) {
  return request('/api/blade-system/user/reset-password', {
    method: 'POST',
    data: params,
  });
}

// 修改用户密码
export async function updatePassword(params: any) {
  return request('/api/blade-system/user/update-password', {
    method: 'POST',
    data: params,
  });
}

// 冻结用户
export async function freeze(params: any) {
  return request('/api/blade-system/user/freeze', {
    method: 'POST',
    data: params,
  });
}

// 解冻用户
export async function unfreeze(params: any) {
  return request('/api/blade-system/user/unfreeze', {
    method: 'POST',
    data: params,
  });
}

// 导入用户
export async function importUser(params: any) {
  return request('/api/blade-system/user/import', {
    method: 'POST',
    data: params,
  });
}

// 导出用户
export async function exportUser(params: any) {
  return request(`/api/blade-system/user/export?${stringify(params)}`);
}

// 获取用户导入模板
export async function importTemplate() {
  return request('/api/blade-system/user/import-template');
}

// =====================P0：工号/人员状态/字段预检=====================

/** 人员状态选项（对齐 ecology hrmresource.status 经典枚举，新建默认"正式"） */
export const PERSON_STATUS_OPTIONS = [
  { label: '试用', value: 0 },
  { label: '正式', value: 1 },
  { label: '临时', value: 2 },
  { label: '延期', value: 3 },
  { label: '解聘', value: 4 },
  { label: '退休', value: 5 },
];

/** 人员状态文案映射 */
export const PERSON_STATUS_TEXT: Record<number, string> = {
  0: '试用',
  1: '正式',
  2: '临时',
  3: '延期',
  4: '解聘',
  5: '退休',
};

/**
 * 字段唯一性预检（对齐 ecology HrmResourceCheck.jsp 提交前校验）
 * @returns true=可用（未被占用）
 */
export async function checkFieldUnique(params: {
  field: 'account' | 'workCode' | 'certificateNum';
  value: string;
  tenantId?: string;
  excludeId?: string;
}) {
  return request(`${USER_BASE_URL}/check?${stringify(params)}`, {
    method: 'POST',
  });
}

/**
 * 按编码规则生成下一个工号（prefix+日期+序列，对齐 ecology CodeRuleManager）
 * @returns 工号；该租户未配置编码规则时返回 null
 */
export async function nextWorkCode(params: { tenantId?: string; deptId?: string } = {}) {
  return request(`${USER_BASE_URL}/work-code/next?${stringify(params)}`);
}

// =====================P2：字段配置驱动 + 自定义字段=====================

/** 用户新增表单 schema 字段（对齐 ecology HrmFieldManager：isUse/isMand/eleclazzname） */
export interface FormSchemaField {
  fieldId: string;
  propName: string;
  label: string;
  eleType: string;
  required: number;
  sort: number;
  extJson?: string;
}

/** 用户新增表单 schema 分组（对齐 ecology hrm_fieldgroup） */
export interface FormSchemaGroup {
  groupId: string;
  groupCode: string;
  groupName: string;
  groupType: number;
  sort: number;
  fields: FormSchemaField[];
}

/**
 * 获取用户新增表单 schema（对齐 ecology getHrmResourceAddForm）
 * 修改字段配置（增/停/必填）后表单即时变化，无需改前端代码
 */
export async function addFormSchema(params: { tenantId?: string } = {}) {
  return request(`${USER_BASE_URL}/add-form-schema?${stringify(params)}`);
}

/**
 * 读取用户自定义字段值（对齐 ecology cus_fielddata 回显）
 * @returns fieldId -> value
 */
export async function extData(params: { userId: string }) {
  return request(`${USER_BASE_URL}/ext-data?${stringify(params)}`);
}

/** 归一化 schema 响应（兼容 R 包装与裸数组） */
export function normalizeFormSchema(res: any): FormSchemaGroup[] {
  const raw = Array.isArray(res) ? res : res?.data || [];
  return Array.isArray(raw) ? raw : [];
}

// =====================P3：状态流转工作流化 + 伴生初始化=====================

/** 状态流转配置（对齐 ecology hrm_state_proc_set） */
export interface PersonStatusFlow {
  id: string;
  fromStatus: number;
  toStatus: number;
  flowName?: string;
  /** 绑定的 Flowable procKey；为空表示直改不走审批 */
  flowKey?: string;
  callbackBean?: string;
  remark?: string;
}

/** 状态流转记录 */
export interface PersonStatusFlowRecord {
  id: string;
  userId: string;
  fromStatus?: number;
  toStatus: number;
  flowKey?: string;
  instanceId?: string;
  /** 1 流程审批 2 直接变更 */
  mode: number;
  /** 0 审批中 1 通过 2 驳回 */
  flowStatus: number;
  opinion?: string;
  createTime?: string;
  finishTime?: string;
}

/** 发起人员状态变更 */
export async function startStatusFlow(data: {
  userId: string;
  toStatus: number;
  opinion?: string;
}) {
  return request(`${USER_BASE_URL}/status-flow/start`, { method: 'POST', data });
}

/** 某用户可用的状态流转（供「办理状态变更」渲染） */
export async function statusFlowAvailable(params: { userId: string }) {
  return request(`${USER_BASE_URL}/status-flow/available?${stringify(params)}`);
}

/** 某用户的状态流转记录（流转进度） */
export async function statusFlowRecords(params: { userId: string }) {
  return request(`${USER_BASE_URL}/status-flow/records?${stringify(params)}`);
}

/** 用户信息完善度（对齐 ecology HrmInfoStatus） */
export async function completeStatus(params: { userId: string }) {
  return request(`${USER_BASE_URL}/complete-status?${stringify(params)}`);
}

/** 完善度项：item -> 显示名 */
export const COMPLETE_STATUS_TEXT: Record<string, string> = {
  BASE: '基本信息',
  PERSON: '个人信息',
  WORK: '工作信息',
  SYSTEM: '系统信息',
};
