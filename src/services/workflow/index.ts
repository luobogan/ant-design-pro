import { request } from 'umi';
import type { ApiResponse } from '@/services/formmode/typings';

/**
 * 审批流程服务（对应后端 blade-workflow，前缀 /api/blade-workflow）。
 *
 * 统一封装文档第 6 章接口：流程定义/节点/权限、实例/任务、审批态渲染包、表单校验。
 * 所有接口经网关路由（/blade-workflow/** + StripPrefix=1）命中资源路径。
 */

const WORKFLOW = '/api/blade-workflow';

// ───────────── 流程定义 ─────────────
export interface WfProcessDefinition {
  id?: number;
  procKey?: string;
  /** 关联表单ID：用字符串承载，避免雪花 ID 超出 JS 安全整数 */
  formId?: number | string;
  name?: string;
  version?: number;
  status?: number; // 0草稿 1已发布 2停用
  isFree?: number;
  /** 路径类型（对齐 ecology path_type 字典 code） */
  type?: string;
  /** 对应表单类型：0自定义表单 1系统表单 */
  formType?: number;
  /** 路径描述 */
  description?: string;
  /** 显示顺序 */
  sortOrder?: number;
  /** 自由流程类型：1简易 2高级（对齐 ecology newFreeWfType） */
  freeWfType?: number;
}

// ───────────── Condition 驱动表单描述（后端 /definition/form-condition） ─────────────
export interface FormFieldOption {
  value: any;
  label: string;
  /** 选项描述（浏览框表格列） */
  description?: string;
  /**
   * 选项归属类型（formSelect 使用）。
   * 对应表单下拉用它区分「自定义表单(0) / 系统表单(1)」，
   * 以便选中某类型时只展示同类型的表单。
   */
  type?: any;
}

/** 条件可见规则：依赖字段值 equals / in 命中时可见 */
export interface FormFieldVisibleWhen {
  key: string;
  equals?: any;
  in?: any[];
}

/** 值拆分映射：如 formSelect 拆成 formType / formId */
export interface FormFieldEmits {
  typeKey: string;
  idKey: string;
}

export interface FormField {
  key: string;
  label?: string;
  /** input / textarea / number / select / switch / formSelect / hidden */
  control: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: any;
  /** 静态选项（select / formSelect 的表单类型选项） */
  options?: FormFieldOption[];
  /** 动态数据源键：formList 等 */
  dataSource?: string;
  searchable?: boolean;
  allowAdd?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  rows?: number;
  tip?: string;
  visibleWhen?: FormFieldVisibleWhen;
  /** 互斥校验：当 key 字段值 equals / in 命中时，本字段校验不通过 */
  conflict?: FormFieldVisibleWhen;
  /** 互斥校验不通过时的提示文案 */
  conflictMessage?: string;
  /** 只读（对齐 ecology viewAttr<3）：控件禁用 */
  readOnly?: boolean;
  /** 校验规则串，对齐 ecology rules，如 required|stringLength:200 */
  rules?: string;
  /** select 渲染形态：1普通下拉 2多选 3单选（对齐 ecology detailtype） */
  detailtype?: number;
  /** 浏览框参数（control=browser 时使用） */
  browser?: {
    type?: string;
    icon?: string;
    iconBgcolor?: string;
    hasAdd?: boolean;
    multiple?: boolean;
  };
  emits?: FormFieldEmits;
}

export interface FormCondition {
  method?: string;
  title?: string;
  fields: FormField[];
}

export interface WfProcessNode {
  id?: number;
  defId?: number;
  nodeKey?: string;
  nodeName?: string;
  nodeType?: number; // 0创建 1审批 2提交 3归档 5等待 6自动处理
  signOrder?: number; // 0或签 1会签 2依次 3抄送不需提交 4抄送需提交
  mergeType?: number;
  passNum?: number;
  allowReject?: number;
  allowForward?: number;
  sortOrder?: number;
}

export interface WfNodeOperator {
  id?: number;
  nodeId?: number;
  groupNo?: number;
  opType?: number; // 3人员 1部门 2角色 58岗位 ...（对齐 ecology OperatorDBType）
  objId?: string;
  levelMin?: number;
  levelMax?: number;
  signOrder?: number;
  batchNo?: number;
}

// 字段权限：0隐藏 1只读 2可编辑 3必填
export type FieldPerm = 0 | 1 | 2 | 3;

export interface FieldPermItem {
  scope: string; // main | dt{idx} | dt{idx}_r{row}（行级，匹配回退：行级 → dt级 → main级）
  fieldName: string;
  perm: FieldPerm;
}

// 出口（连线）
export interface WfNodeLink {
  id?: number;
  defId?: number;
  fromNodeKey?: string;
  toNodeKey?: string;
  isReject?: number;
  isMustPass?: number;
  conditionExpr?: string;
  conditionCn?: string;
  sortOrder?: number;
}

// 流程定义保存请求（后端 DefinitionSaveDTO）
export interface DefinitionSaveDTO {
  definition?: WfProcessDefinition;
  nodes?: WfProcessNode[];
  links?: WfNodeLink[];
  operators?: WfNodeOperator[];
}

export interface DetailPermItem {
  dtIndex: number;
  canAdd?: number;
  canEdit?: number;
  canDelete?: number;
  hideEmpty?: number;
  defaultRows?: number;
  required?: number;
}

/**
 * 后端 create / update 接收的是 DefinitionSaveDTO：
 *   { definition: {...}, nodes: [], links: [], operators: [] }
 * 而列表页表单拿到的是扁平的 { name, procKey, formId }。
 * 若不做包装，后端 dto.getDefinition() 为 null，save() 直接抛
 * 「流程定义不能为空」→ 创建/编辑必然失败。
 * 这里统一包装，调用方传扁平对象或完整 DTO 都可以。
 */
function wrapDefinitionPayload(dto: any): DefinitionSaveDTO {
  if (!dto) return { definition: undefined } as any;
  // 已是完整 DTO（含 definition 字段）则原样返回
  if (Object.prototype.hasOwnProperty.call(dto, 'definition')) return dto as DefinitionSaveDTO;
  return { definition: dto } as DefinitionSaveDTO;
}

export async function createDefinition(dto: any) {
  return request<ApiResponse<number>>(`${WORKFLOW}/definition`, {
    method: 'POST',
    data: wrapDefinitionPayload(dto),
  });
}

export async function updateDefinition(id: number, dto: any) {
  return request<ApiResponse<number>>(`${WORKFLOW}/definition/${id}`, {
    method: 'PUT',
    data: wrapDefinitionPayload(dto),
  });
}

export async function deployDefinition(id: number) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/definition/${id}/deploy`, { method: 'POST' });
}

// BPMN 画布（bpmn-js）保存 / 获取
export async function saveBpmn(id: number, bpmnXml: string) {
  return request<ApiResponse<number>>(`${WORKFLOW}/definition/${id}/bpmn`, {
    method: 'PUT',
    data: { bpmnXml },
  });
}

export async function getBpmn(id: number) {
  return request<ApiResponse<string>>(`${WORKFLOW}/definition/${id}/bpmn`, { method: 'GET' });
}

export async function saveAsNewVersion(id: number) {
  return request<ApiResponse<number>>(`${WORKFLOW}/definition/${id}/version`, { method: 'POST' });
}

export async function enableDefinition(id: number) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/definition/${id}/enable`, { method: 'POST' });
}

export async function disableDefinition(id: number) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/definition/${id}/disable`, { method: 'POST' });
}

export async function getDefinition(id: number) {
  return request<ApiResponse<WfProcessDefinition>>(`${WORKFLOW}/definition/${id}`, { method: 'GET' });
}

/**
 * 获取流程定义表单字段描述（condition 驱动）。
 * 前端据此动态渲染新增/编辑表单，字段增减只需改后端。
 */
export async function getDefinitionFormCondition(method: 'add' | 'edit' = 'add', id?: number) {
  return request<ApiResponse<FormCondition>>(`${WORKFLOW}/definition/form-condition`, {
    method: 'GET',
    params: { method, id },
  });
}

export async function listDefinitions(formId?: number) {
  return request<ApiResponse<WfProcessDefinition[]>>(`${WORKFLOW}/definition/list`, {
    method: 'GET',
    params: { formId },
  });
}

export async function listNodes(id: number) {
  return request<ApiResponse<WfProcessNode[]>>(`${WORKFLOW}/definition/${id}/nodes`, { method: 'GET' });
}

export async function configOperator(id: number, nodeKey: string, operators: WfNodeOperator[]) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/definition/${id}/node/${nodeKey}/operator`, {
    method: 'PUT',
    data: operators,
  });
}

export async function getFieldPerm(id: number, nodeKey: string) {
  return request<ApiResponse<FieldPermItem[]>>(`${WORKFLOW}/definition/${id}/node/${nodeKey}/field-perm`, {
    method: 'GET',
  });
}

export async function saveFieldPerm(id: number, nodeKey: string, perms: FieldPermItem[]) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/definition/${id}/node/${nodeKey}/field-perm`, {
    method: 'PUT',
    data: { nodeKey, perms },
  });
}

export async function getDetailPerm(id: number, nodeKey: string) {
  return request<ApiResponse<DetailPermItem[]>>(`${WORKFLOW}/definition/${id}/node/${nodeKey}/detail-perm`, {
    method: 'GET',
  });
}

export async function saveDetailPerm(id: number, nodeKey: string, perms: DetailPermItem[]) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/definition/${id}/node/${nodeKey}/detail-perm`, {
    method: 'PUT',
    data: { nodeKey, perms },
  });
}

// ───────────── 实例 / 任务 ─────────────
export async function startInstance(dto: any) {
  return request<ApiResponse<number>>(`${WORKFLOW}/instance/start`, { method: 'POST', data: dto });
}

export async function getInstance(id: number) {
  return request<ApiResponse<any>>(`${WORKFLOW}/instance/${id}`, { method: 'GET' });
}

export async function getInstanceByBiz(formId: number, dataId: number) {
  return request<ApiResponse<any>>(`${WORKFLOW}/instance/by-biz`, { method: 'GET', params: { formId, dataId } });
}

export async function getLogs(id: number) {
  return request<ApiResponse<any[]>>(`${WORKFLOW}/instance/${id}/logs`, { method: 'GET' });
}

export async function getSnapshot(id: number, nodeKey: string) {
  return request<ApiResponse<string>>(`${WORKFLOW}/instance/${id}/snapshot/${nodeKey}`, { method: 'GET' });
}

export async function listTodo(assignee?: number) {
  return request<ApiResponse<any[]>>(`${WORKFLOW}/task/todo`, { method: 'GET', params: { assignee } });
}

export async function listDone(assignee?: number) {
  return request<ApiResponse<any[]>>(`${WORKFLOW}/task/done`, { method: 'GET', params: { assignee } });
}

export async function approveTask(id: number, dto?: any) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/task/${id}/approve`, { method: 'POST', data: dto });
}

export async function rejectTask(id: number, dto?: any) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/task/${id}/reject`, { method: 'POST', data: dto });
}

export async function forwardTask(id: number, dto: any) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/task/${id}/forward`, { method: 'POST', data: dto });
}

export async function addSignTask(id: number, dto: any) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/task/${id}/add-sign`, { method: 'POST', data: dto });
}

export async function circulateTask(id: number, dto: any) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/task/${id}/circulate`, { method: 'POST', data: dto });
}

export async function urgeTask(id: number, dto?: any) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/task/${id}/urge`, { method: 'POST', data: dto });
}

export async function withdrawInstance(id: number, opinion?: string) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/instance/${id}/withdraw`, { method: 'POST', params: { opinion } });
}

export async function stopInstance(id: number) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/instance/${id}/stop`, { method: 'POST' });
}

export async function resumeInstance(id: number) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/instance/${id}/resume`, { method: 'POST' });
}

export async function cancelInstance(id: number, opinion?: string) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/instance/${id}/cancel`, { method: 'POST', params: { opinion } });
}

// ───────────── 审批态渲染包 / 校验 ─────────────
export interface FormRenderPackage {
  instanceId?: number;
  taskId?: number;
  nodeKey?: string;
  nodeName?: string;
  formId?: number;
  dataId?: number;
  instanceStatus?: number;
  layoutId?: number;
  layoutJson?: string;
  dataJson?: Record<string, any>;
  fieldPerms?: FieldPermItem[];
  detailPerms?: DetailPermItem[];
  readonly?: boolean;
}

export async function renderForm(instanceId: number, taskId?: number) {
  return request<ApiResponse<FormRenderPackage>>(`${WORKFLOW}/form/render`, {
    method: 'GET',
    params: { instanceId, taskId },
  });
}

export async function validateForm(dto: any) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/form/validate`, { method: 'POST', data: dto });
}

export async function monitorCount(assignee?: number) {
  return request<ApiResponse<Record<string, number>>>(`${WORKFLOW}/monitor/count`, {
    method: 'GET',
    params: { assignee },
  });
}

// ───────────── 浏览框服务（对齐 ecology BrowserBean） ─────────────
// 前端「路径类型」等字段以 BROWSER 控件呈现：点击弹出选择弹窗，经此接口取数。
export const workflowBrowserApi = {
  /** 列表（支持关键字搜索）：type=wftype 等 */
  list: (type: string, keyword?: string) =>
    request<ApiResponse<FormFieldOption[]>>(`${WORKFLOW}/definition/browser/${type}`, {
      method: 'GET',
      params: { keyword },
    }),
  /** 详情（编辑回显已选值标签） */
  get: (type: string, id: number | string) =>
    request<ApiResponse<FormFieldOption>>(`${WORKFLOW}/definition/browser/${type}/${id}`, {
      method: 'GET',
    }),
};

/** 浏览框 wftype「+」新增路径类型，回写新选项（含自增主键），前端直接选中 */
export async function createWorkflowType(dto: {
  typeName: string;
  typeDesc?: string;
  sortOrder?: number;
}) {
  return request<ApiResponse<FormFieldOption>>(`${WORKFLOW}/definition/browser/wftype`, {
    method: 'POST',
    data: dto,
  });
}
