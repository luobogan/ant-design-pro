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
  status?: number; // 0草稿 1已发布 3测试（2停用已废除，仅存量数据）
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
  /** 版本组锚点：指向当前激活版本的 defId（后端 ToString 序列化为字符串；NULL=单版本流程） */
  activeVersionId?: string;
}

// ───────────── 用户侧流程列表项（前端复用 WfTaskVO / InstanceVO 结构） ─────────────
/** 待办 / 已办任务项（对齐后端 WfTaskVO：标题/节点/发起人/状态等语义信息） */
export interface WfTaskItem {
  /** 任务ID（wf_task.id，19 位雪花，字符串承载） */
  id?: string;
  /** 流程实例ID */
  instId?: string;
  /** 流程标题 */
  title?: string;
  /** 流程定义名称 */
  defName?: string;
  /** 流程定义ID */
  defId?: string;
  /** 表单ID */
  formId?: string;
  /** 业务数据ID */
  dataId?: string;
  /** 所属实例状态 0运行中 1通过 2不通过 3撤销 4暂停 5草稿 */
  instStatus?: number;
  /** 节点Key */
  nodeKey?: string;
  /** 节点名称 */
  nodeName?: string;
  /** 办理人 */
  assignee?: string;
  /** 任务状态 0待办 2已办 4办结 6自动提交 7协办 8抄送 11传阅 */
  status?: number;
  /** 发起人 */
  starter?: string;
  /** 流程发起时间 */
  startTime?: string;
  /** 任务接收时间 */
  receiveTime?: string;
  /** 任务处理时间 */
  operateTime?: string;
  /** 截止时间 */
  dueTime?: string;
  /** 紧急程度 0/1/2 */
  urgency?: number;
}

/** 我的请求（我发起的流程实例）项 */
export interface MyRequestItem {
  /** 实例ID */
  id?: string;
  /** 流程标题 */
  title?: string;
  /** 流程定义名称 */
  defName?: string;
  /** 表单ID */
  formId?: string;
  /** 实例状态 0运行中 1通过 2不通过 3撤销 4暂停 */
  status?: number;
  /** 当前节点名称 */
  currentNodeName?: string;
  /** 发起时间 */
  startTime?: string;
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
  mergeType?: number; // 0普通 1分叉起点 2分叉中间 3按分支数合并 4指定分支合并 5比例合并
  passNum?: number;
  allowReject?: number;
  allowForward?: number;
  autoApprove?: number;
  sortOrder?: number;
  /** 节点测试状态 0未测试 1通过 2未通过（模拟运行校验结果，设计期使用） */
  testStatus?: number;
  extJson?: string; // 扩展属性（超时/提醒/签章等）
}

export interface WfNodeOperator {
  id?: number;
  nodeId?: number;
  groupNo?: number;
  opType?: number; // 3人员 1部门 2角色 58岗位 ...（对齐 ecology OperatorDBType）
  objId?: string;
  levelMin?: number;
  levelMax?: number;
  bhxj?: number; // 0本部 1含下级 2含上级 3逐级向上
  signOrder?: number;
  batchNo?: number;
  conditionJson?: string;
  // ── 操作组名称与可见性（V2026.09.21_009 新增列，兼容旧数据走 conditionJson.name） ──
  groupName?: string;
  canView?: number; // 1可见 0不可见（表单填写人是否能看到该操作组），缺省 1
  // ── 协办 / 征询意见人（V2026.09.21_009 新增列） ──
  isCoadjutant?: number; // 1=协办/征询意见人 0=否
  signType?: number; // 协办签字类型
  isSysCoadjutant?: number; // 是否系统协办
  isSubmitDesc?: number; // 提交时是否填写协办描述
  isPending?: number; // 协办是否生成待办
  isModify?: number; // 协办是否可修改表单
  coadjutants?: string; // 协办/征询意见人（人员id串，逗号分隔）
}

// 字段权限：0隐藏 1只读 2可编辑 3必填
export type FieldPerm = 0 | 1 | 2 | 3;

/**
 * 字段权限项。
 *
 * **三维度为权威值**（对齐 ecology workflow_nodeform 的 isview / iseditable / ismandatory 三列）；
 * `perm` 是后端下发的**兼容派生列**（0隐藏/1只读/2可编辑/3必填），
 * 由三维度推导（`!visible→0；required→3；editable→2；否则 1`）。
 *
 * 读取时三列均存在则直接用；仅当它们缺省（老数据/老后端）才回退到 `perm`。
 * 提交时可只传三维度，后端会自行派生 `perm` 双写。
 */
export interface FieldPermItem {
  scope: string; // main | dt{idx} | dt{idx}_r{row}（行级，匹配回退：行级 → dt级 → main级）
  fieldName: string;
  /** 字段是否显示 */
  visible?: boolean;
  /** 字段是否可编辑 */
  editable?: boolean;
  /** 字段是否必填 */
  required?: boolean;
  /** 兼容派生列；提交时可省略 */
  perm?: FieldPerm;
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
  /** 是否经由网关折叠而来的逻辑连线 1=是 */
  viaGateway?: number;
  /** 经由的网关节点 key（网关本身不入节点表，凭此字段让网关节点呈现其下游分支） */
  viaGatewayKey?: string;
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
  /** 打印序号 1=打印行号 0=不打印 */
  printSerial?: number;
  /** 打印允许滚动 1=允许 0=不允许 */
  allowScroll?: number;
  /** 打印开启分页 1=分页 0=不分页 */
  openPaging?: number;
}

/**
 * 明细表字段筛选项（对齐 ecology「明细表数据根据操作者筛选显示」）。
 * 多条规则按「且」关系过滤明细行；modeType 区分显示(1)/打印(2)。
 */
export interface DetailFilterItem {
  dtIndex: number;
  /** 比较字段（明细列 fieldName） */
  fieldName: string;
  /** 比较方式 1等于 2不等于 3包含 4不包含 */
  compareType: number;
  /** 比较值（多值逗号分隔） */
  compareValue?: string;
  /** 过滤后要求至少一条 1=是 0=否 */
  isRequired?: number;
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
// 注意：bpmnXml 含大量 <bpmn:*> 标签，会被后端 SpringBlade XSS 过滤器当作非法 HTML 整段删掉，
// 导致只剩文本而无法解析。故发送前做 UTF-8 安全的 base64 编码，后端 WfDefinitionServiceImpl 再解码还原。
export async function saveBpmn(id: number, bpmnXml: string) {
  const encoded = utf8ToBase64(bpmnXml);
  return request<ApiResponse<number>>(`${WORKFLOW}/definition/${id}/bpmn`, {
    method: 'PUT',
    data: { bpmnXml: encoded },
  });
}

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function getBpmn(id: number | string) {
  return request<ApiResponse<string>>(`${WORKFLOW}/definition/${id}/bpmn`, { method: 'GET' });
}

export async function saveAsNewVersion(id: string | number) {
  return request<ApiResponse<string>>(`${WORKFLOW}/definition/${id}/version`, { method: 'POST' });
}

/** 切换当前（激活）版本：版本组内锚点统一指向该版本（不部署、不改发布状态） */
export async function activateVersion(id: string | number) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/definition/${id}/version/activate`, {
    method: 'POST',
  });
}

/** 版本列表（同 procKey 版本组全部版本，按版本号升序） */
export async function listVersions(id: string | number) {
  return request<ApiResponse<WfProcessDefinition[]>>(`${WORKFLOW}/definition/${id}/versions`, {
    method: 'GET',
  });
}

/** 版本差异行：节点（nodeKey 维度） */
export interface VersionNodeDiff {
  nodeKey?: string;
  sourceName?: string;
  targetName?: string;
  sourceType?: number;
  targetType?: number;
  sourceSignOrder?: number;
  targetSignOrder?: number;
}

/** 版本差异行：出口（fromNodeKey→toNodeKey 维度） */
export interface VersionLinkDiff {
  fromNodeKey?: string;
  toNodeKey?: string;
  sourceConditionCn?: string;
  targetConditionCn?: string;
  sourceIsReject?: number;
  targetIsReject?: number;
}

/** 版本差异对比结果（source=当前版本，target=被对比版本） */
export interface VersionDiff {
  sourceDefId?: string;
  sourceVersion?: number;
  targetDefId?: string;
  targetVersion?: number;
  addedNodes?: VersionNodeDiff[];
  removedNodes?: VersionNodeDiff[];
  changedNodes?: VersionNodeDiff[];
  addedLinks?: VersionLinkDiff[];
  removedLinks?: VersionLinkDiff[];
  changedLinks?: VersionLinkDiff[];
}

/** 版本差异对比：当前版本 vs 目标版本 */
export async function diffVersion(id: number, targetId: string | number) {
  return request<ApiResponse<VersionDiff>>(`${WORKFLOW}/definition/${id}/version/diff`, {
    method: 'GET',
    params: { targetId },
  });
}

export async function testDefinition(id: number) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/definition/${id}/deploy-test`, { method: 'POST' });
}

export async function withdrawDefinition(id: number) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/definition/${id}/withdraw`, { method: 'POST' });
}

export async function getDefinition(id: number | string) {
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

export async function removeDefinition(id: number) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/definition/${id}`, {
    method: 'DELETE',
  });
}

export async function listNodes(id: number | string) {
  return request<ApiResponse<WfProcessNode[]>>(`${WORKFLOW}/definition/${id}/nodes`, { method: 'GET' });
}

export async function configOperator(id: number, nodeKey: string, operators: WfNodeOperator[]) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/definition/${id}/node/${nodeKey}/operator`, {
    method: 'PUT',
    // ⚠️ 后端刻意用实体类接收（{ operators: [...] }）而非裸数组：
    //    本环境 @RequestBody 的根类型若为泛型容器（数组/Map）会丢失泛型信息导致反序列化失败
    data: { operators },
  });
}

/** 读取节点操作者 */
export async function getNodeOperators(id: number, nodeKey: string) {
  return request<ApiResponse<WfNodeOperator[]>>(`${WORKFLOW}/definition/${id}/node/${nodeKey}/operator`, {
    method: 'GET',
  });
}

/** 同步本节点操作者到其它节点（整体覆盖写入目标节点集合） */
export async function syncOperatorToNodes(id: number, nodeKey: string, targetNodeKeys: string[]) {
  return request<ApiResponse<boolean>>(
    `${WORKFLOW}/definition/${id}/node/${nodeKey}/operator/sync`,
    { method: 'POST', data: targetNodeKeys },
  );
}

/** 出口（连线）列表 */
export async function listLinks(id: number) {
  return request<ApiResponse<WfNodeLink[]>>(`${WORKFLOW}/definition/${id}/links`, { method: 'GET' });
}

/** 更新节点基础属性（按 nodeKey，保留操作者与字段权限） */
export async function updateNode(id: number, nodeKey: string, node: Partial<WfProcessNode>) {
  return request<ApiResponse<WfProcessNode>>(`${WORKFLOW}/definition/${id}/node/${nodeKey}`, {
    method: 'PUT',
    data: node,
  });
}

/** 新增出口（连线） */
export async function createLink(id: number, link: Partial<WfNodeLink>) {
  return request<ApiResponse<WfNodeLink>>(`${WORKFLOW}/definition/${id}/link`, {
    method: 'POST',
    data: link,
  });
}

// ───────────── 自定义接口动作（注册自定义接口，对齐 ecology E9） ─────────────

export interface WfCustomAction {
  id?: number;
  /** 接口动作名称 */
  actionName?: string;
  /** 接口动作标识（唯一，节点附加操作按此引用） */
  actionKey?: string;
  /** 接口动作类文件：类全名，须实现 org.springblade.workflow.action.IWfCustomAction */
  className?: string;
  /** 参数设置（JSON 字符串：[{name,value,isDataSource}]） */
  paramsJson?: string;
  remark?: string;
}

/** 已注册的自定义接口动作列表（节点附加操作「自定义接口动作」下拉来源） */
export async function listCustomActions() {
  return request<ApiResponse<WfCustomAction[]>>(`${WORKFLOW}/custom-action/list`, { method: 'GET' });
}

/** 注册 / 更新自定义接口动作（标识唯一；类文件须为类全名且实现 IWfCustomAction） */
export async function saveCustomAction(data: WfCustomAction) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/custom-action/save`, {
    method: 'POST',
    data,
  });
}

/** 删除自定义接口动作（后端物理删除，避免唯一标识被逻辑删除行占用） */
export async function deleteCustomAction(id: number) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/custom-action/${id}`, { method: 'DELETE' });
}

/** 更新出口（连线） */
export async function updateLink(id: number, linkId: number, link: Partial<WfNodeLink>) {
  return request<ApiResponse<WfNodeLink>>(`${WORKFLOW}/definition/${id}/link/${linkId}`, {
    method: 'PUT',
    data: link,
  });
}

/** 删除出口（连线） */
export async function deleteLink(id: number, linkId: number) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/definition/${id}/link/${linkId}`, {
    method: 'DELETE',
  });
}

/** 移除节点（级联清理操作者/字段权限/明细权限/出口连线/布局） */
export async function deleteNode(id: number, nodeKey: string) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/definition/${id}/node/${nodeKey}`, {
    method: 'DELETE',
  });
}

/** 流程模拟运行结果：路径中的一段 */
export interface SimulatePathStep {
  fromNodeKey?: string;
  toNodeKey?: string;
  conditionCn?: string;
}

/** 流程模拟运行结果：单个节点校验结果 */
export interface SimulateNodeResult {
  nodeKey?: string;
  nodeName?: string;
  nodeType?: number;
  status?: number; // 0未测试 1通过 2未通过
  message?: string;
}

/** 流程模拟运行结果（带模拟表单数据走查节点/网关条件） */
export interface SimulateResult {
  allPassed?: boolean;
  path?: SimulatePathStep[];
  nodes?: SimulateNodeResult[];
  summary?: string;
  /** 可读流转时间线（带时间戳的叙述式走查日志，逐事件一行） */
  logLines?: string[];
}

/** 流程模拟运行：带模拟表单数据走查节点/网关条件，回写节点测试状态 */
export async function simulateDefinition(id: number, formData?: Record<string, any>) {
  return request<ApiResponse<SimulateResult>>(`${WORKFLOW}/definition/${id}/simulate`, {
    method: 'POST',
    data: formData || {},
  });
}

/** 保存节点测试状态 0未测试 1通过 2未通过 */
export async function saveNodeTestStatus(id: number, nodeKey: string, status: number) {
  return request<ApiResponse<boolean>>(
    `${WORKFLOW}/definition/${id}/node/${nodeKey}/test-status?status=${status}`,
    { method: 'POST' },
  );
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

export async function getDetailFilter(id: number, nodeKey: string, modeType?: number) {
  return request<ApiResponse<DetailFilterItem[]>>(
    `${WORKFLOW}/definition/${id}/node/${nodeKey}/detail-filter`,
    { method: 'GET', params: modeType == null ? {} : { modeType } },
  );
}

export async function saveDetailFilter(
  id: number,
  nodeKey: string,
  modeType: number,
  rules: DetailFilterItem[],
) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/definition/${id}/node/${nodeKey}/detail-filter`, {
    method: 'PUT',
    data: { nodeKey, modeType, rules },
  });
}

// ───────────── 实例 / 任务 ─────────────
/**
 * 发起流程。
 * ⚠️ 返回的实例ID是**字符串**：19 位雪花 ID 超出 JS 安全整数，后端已改为 String 返回，
 * 前端务必原样透传，不要 Number()（会丢精度，后续查实例报「流程实例不存在」）。
 */
export async function startInstance(dto: any) {
  return request<ApiResponse<string>>(`${WORKFLOW}/instance/start`, { method: 'POST', data: dto });
}

export async function getInstance(id: string | number) {
  return request<ApiResponse<any>>(`${WORKFLOW}/instance/${id}`, { method: 'GET' });
}

/** 「界面新鲜度」复检结果：判定已打开的页面是否已过期（流程已回退/流转/结束） */
export interface InstanceFreshResult {
  instanceId?: string;
  /** 实例是否存在（false=已被删除） */
  exists?: boolean;
  instanceStatus?: number;
  /** 实例当前节点Key */
  currentNodeKey?: string;
  currentNodeName?: string;
  /** 界面所在节点Key（本次比对的对象） */
  nodeKey?: string;
  nodeName?: string;
  /** 界面所在节点是否仍是活动节点（并行分支安全口径） */
  nodeActive?: boolean;
  /** true=界面已过期，必须拦截保存/提交等写操作 */
  stale?: boolean;
  /** 过期原因（后端已成人话，可直接展示） */
  staleReason?: string;
}

/**
 * 界面新鲜度复检：解决「流程已回退 / 节点被他人流转 / 实例已归档撤回，
 * 而浏览器里的页面仍显示原节点」造成的状态不一致。
 *
 * 调用时机：页面打开后、每次保存/提交等写操作前、以及定时与切回标签页时。
 * stale=true 时必须拦截写操作并按 staleReason 提示用户刷新页面。
 *
 * 注意：实例已被删除时后端抛「流程实例不存在」，故 skipErrorHandler 由调用方兜底处理。
 */
export async function freshInstance(
  id: string | number,
  nodeKey?: string,
  taskId?: string | number,
) {
  return request<ApiResponse<InstanceFreshResult>>(`${WORKFLOW}/instance/${id}/fresh`, {
    method: 'GET',
    params: { nodeKey, taskId },
    skipErrorHandler: true,
  });
}

export async function getInstanceByBiz(formId: number, dataId: number) {
  return request<ApiResponse<any>>(`${WORKFLOW}/instance/by-biz`, { method: 'GET', params: { formId, dataId } });
}

export async function getLogs(id: string | number) {
  return request<ApiResponse<any[]>>(`${WORKFLOW}/instance/${id}/logs`, { method: 'GET' });
}

/**
 * 节点操作者情况（流程图节点悬浮「操作者」面板 + 节点下方「谁批的」）。
 *
 * 返回 nodeKey → { handled 已操作 / viewed 已查看 / todo 未操作 }，元素为人员ID，
 * 姓名由前端人员字典解析。
 *
 * 注意：与「定义态」的 getNodeOperators(defId, nodeKey)
 * （GET /definition/{id}/node/{nodeKey}/operator）区分——本函数是实例态，
 * 故命名 getInstanceNodeOperators，避免同名导出导致构建失败。
 */
export async function getInstanceNodeOperators(id: string | number) {
  return request<ApiResponse<Record<string, { handled?: any[]; viewed?: any[]; todo?: any[] }>>>(
    `${WORKFLOW}/instance/${id}/node-operators`,
    { method: 'GET' },
  );
}

/** 标记待办已查看（办理人打开办理页时调用，只记首次；流程图「已查看」判定） */
export async function markTaskViewed(taskId: string | number) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/task/${taskId}/view`, { method: 'POST' });
}

export async function getSnapshot(id: string | number, nodeKey: string) {
  return request<ApiResponse<string>>(`${WORKFLOW}/instance/${id}/snapshot/${nodeKey}`, { method: 'GET' });
}

export async function listTodo(assignee?: number | string) {
  return request<ApiResponse<WfTaskItem[]>>(`${WORKFLOW}/task/todo`, { method: 'GET', params: { assignee } });
}

export async function listDone(assignee?: number | string) {
  return request<ApiResponse<WfTaskItem[]>>(`${WORKFLOW}/task/done`, { method: 'GET', params: { assignee } });
}

/**
 * 我的请求：我发起的流程实例分页（发起人在服务端收口为当前登录人）。
 *
 * <p>后端返回 MyBatis-Plus 分页对象（records + total），页面按分页消费；
 * 仍保留异常降级：服务未启动 / 无权限时为空态 + Alert，不重复弹全局错误。</p>
 */
export async function listMyRequests(params?: { current?: number; pageSize?: number; title?: string }) {
  return request<ApiResponse<{ records?: MyRequestItem[]; total?: number }>>(`${WORKFLOW}/instance/mine`, {
    method: 'GET',
    params,
    skipErrorHandler: true,
  });
}

export async function approveTask(id: string | number, dto?: any) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/task/${id}/approve`, { method: 'POST', data: dto });
}

export async function rejectTask(id: string | number, dto?: any) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/task/${id}/reject`, { method: 'POST', data: dto });
}

export async function rejectNodes(id: string | number) {
  return request<ApiResponse<any>>(`${WORKFLOW}/task/${id}/reject-nodes`, { method: 'GET' });
}

export async function forwardTask(id: string | number, dto: any) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/task/${id}/forward`, { method: 'POST', data: dto });
}

export async function addSignTask(id: string | number, dto: any) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/task/${id}/add-sign`, { method: 'POST', data: dto });
}

export async function circulateTask(id: string | number, dto: any) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/task/${id}/circulate`, { method: 'POST', data: dto });
}

export async function urgeTask(id: string | number, dto?: any) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/task/${id}/urge`, { method: 'POST', data: dto });
}

/**
 * 实例级动作。
 * ⚠️ id 一律按「字符串」传入：19 位雪花 ID 超出 JS 安全整数（2^53），
 * 经 Number() 会丢精度（如 ...538 → ...500），后端查不到实例（报「流程实例不存在」）。
 */
export async function withdrawInstance(id: string | number, opinion?: string) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/instance/${id}/withdraw`, { method: 'POST', params: { opinion } });
}

export async function stopInstance(id: string | number) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/instance/${id}/stop`, { method: 'POST' });
}

export async function resumeInstance(id: string | number) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/instance/${id}/resume`, { method: 'POST' });
}

export async function cancelInstance(id: string | number, opinion?: string) {
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
  /** 节点明细表「显示时」字段筛选规则（渲染态据此隐藏不匹配的明细行） */
  detailFilters?: DetailFilterItem[];
  readonly?: boolean;
  /** 当前节点「操作菜单」允许的操作码（submit/reject/forward/sign/opinion/attach/print/urge），驱动审批界面按钮栏 */
  allowMenus?: string[];
  /** 当前节点是否要求填写审批意见 */
  opinionRequired?: boolean;
  /** 节点「打印内容设置」（来自节点信息 → 表单内容 → 打印模板 → 打印内容设置） */
  printSet?: {
    /** 打印流转意见：0 始终不打印 / 1 放入模板时不打印 / 2 始终打印 */
    flowComment?: number;
    /** 打印意见显示方式：0 只显示最后一次 / 1 显示全部 */
    showType?: number;
    /** 打印意见分栏列数：1 / 2 / 3 */
    remarkColumn?: number;
    /** 打印时不显示空意见 */
    stNull?: boolean;
    /** 打印显示类型：['oldvalue']=沿用显示模板；否则为意见类型键列表 */
    viewTypes?: string[];
  };
  /** 节点「签字意见显示设置」（屏显口径）：显示全部/仅末次、分栏、不显空意见、类型白名单 */
  opinionDisplay?: {
    /** 显示全部意见 1=显示全部 0=仅最后一次 */
    viewTypeAll?: number;
    /** 显示方式 0=倒序 1=正序 */
    showType?: number;
    /** 意见分栏列数 1/2/3 */
    remarkColumn?: number;
    /** 不显示空意见 1=开启 */
    stNull?: number;
    /** 意见类型显示白名单（approve/reject/submit/forward/circulate/sign）；空=全部 */
    viewTypes?: string[];
  };
}

/** 注意：instanceId 是 19 位雪花 ID，后端以字符串下发；前端务必保持字符串，
 *  转成 number 会丢精度（如 ...92291 → ...92300）导致「流程实例不存在」。 */
export async function renderForm(
  instanceId: string | number,
  taskId?: number,
  nodeKey?: string,
  /**
   * 是否来自测试入口（方案 §6.4 C8 + C12）。
   * 测试面板 / 真人模式必须传 true —— 否则后端对 is_test=1 的实例拒绝渲染；
   * 生产办理页**不传**（否则测试单会回到生产办理链路里）。
   */
  testMode?: boolean,
) {
  return request<ApiResponse<FormRenderPackage>>(`${WORKFLOW}/form/render`, {
    method: 'GET',
    params: { instanceId, taskId, nodeKey, testMode },
  });
}

/**
 * 表单预览（无需实例）：按流程定义/表单/节点返回布局+字段权限+操作菜单，
 * 用于测试页选好流程与发起人后直接打开流程表单查看，不创建测试实例。
 */
export async function renderFormPreview(
  defId: number | string,
  formId: number | string,
  nodeKey?: string,
) {
  return request<ApiResponse<FormRenderPackage>>(`${WORKFLOW}/form/preview`, {
    method: 'GET',
    params: { defId, formId, nodeKey },
  });
}

export async function validateForm(dto: any) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/form/validate`, { method: 'POST', data: dto });
}

/**
 * 保存表单（只存不流转）：对齐 ecology「操作菜单 → 保存」。
 *
 * - 发起态（不带 instanceId）：写/更新业务行，返回业务数据ID（**字符串**，19 位雪花ID）；
 *   之后发起时把该 dataId 回传，流程复用这条业务行，不会新建。
 * - 办理态（带 instanceId + nodeKey）：写业务行 + 同步节点快照，不改任务状态、不推进。
 *
 * 与 validateForm 的区别：保存**不做必填校验**（允许表单不完整，先存后提交）。
 */
export async function saveFormData(dto: any) {
  return request<ApiResponse<string>>(`${WORKFLOW}/form/save`, { method: 'POST', data: dto });
}

/**
 * 保存草稿（只存不流转）：创建/更新草稿实例 + 发起人待办，返回草稿实例ID（字符串）。
 * 再次保存同一草稿时回传 instanceId 复用实例与业务行。
 */
export async function saveDraft(dto: any) {
  return request<ApiResponse<string>>(`${WORKFLOW}/instance/save-draft`, { method: 'POST', data: dto });
}

/**
 * 删除草稿（只删草稿态实例）：删除草稿实例、合成待办、快照与其独占业务数据行。
 * 仅发起人本人或流程管理员可操作；ID 按字符串传，避免 19 位雪花 ID 经 Number() 丢精度。
 */
export async function deleteDraft(id: string) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/instance/${id}/draft`, { method: 'DELETE' });
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

// ───────────── 流程测试（设计期校验） ─────────────
// 对齐 ecology「流程测试」：指定发起人走查路径 → 逐节点解析操作者 → 产出测试日志。
// ⚠️ 与 ecology 差异：ecology 走真实引擎 + 测试态标记；本项目草稿未部署 Flowable，
//    故走「配置走查测试」（基于节点/出口/操作者配置），不落真实实例。

/** 流程测试：节点操作者 */
export interface WfTestOperator {
  userId?: number;
  userName?: string;
  source?: string;
}

/** 流程测试：单个节点结果 */
export interface WfTestNodeResult {
  nodeKey?: string;
  nodeName?: string;
  nodeType?: number; // 0创建 1审批 2提交 3归档 5等待 6自动处理
  passTimes?: number;
  status?: number; // 0未走到 1走通 2走不通
  message?: string;
  operators?: WfTestOperator[];
}

/** 流程测试：路径中的一段 */
export interface WfTestStep {
  fromNodeKey?: string;
  toNodeKey?: string;
  conditionCn?: string;
}

/** 流程测试：单条出口（连线）的覆盖情况 */
export interface WfTestLinkResult {
  fromNodeKey?: string;
  toNodeKey?: string;
  fromNodeName?: string;
  toNodeName?: string;
  conditionExpr?: string;
  conditionCn?: string;
  passTimes?: number;
  status?: number; // 1走过 0未走过
}

/** 流程测试：单个场景的执行概要 */
export interface WfTestScenario {
  index?: number;
  label?: string;
  formData?: Record<string, any>;
  testStatus?: number;
  reachedEnd?: boolean;
  path?: string[];
  summary?: string;
}

/** 流程测试结果 */
export interface WfTestResult {
  logId?: string;
  testStatus?: number; // 0未通过 1通过 2异常中断 3进行中（交互式测试）
  reachedEnd?: boolean;
  nodeTotal?: number;
  nodePassed?: number;
  costMs?: number;
  summary?: string;
  /** 节点经过次数：nodeKey -> 次数 */
  nodeTimes?: Record<string, number>;
  nodes?: WfTestNodeResult[];
  path?: WfTestStep[];
  /** 测试日志（逐行） */
  log?: string[];
  /** 本次发起的测试态实例ID（wf_instance.id，is_test=1），供渲染真实流程表单界面 */
  instId?: string;
  /** 实例状态 0运行中 1通过 2不通过 3撤销 4暂停（交互式测试） */
  instanceStatus?: number;
  /** 当前停留节点Key（交互式测试） */
  currentNodeKey?: string;
  /** 当前停留节点名称（交互式测试） */
  currentNodeName?: string;
  /** 当前是否存在待办（交互式测试：有待办即可「提交」推进一步） */
  hasPending?: boolean;
  /** 当前节点待办任务ID（交互式测试手动办理/退回用） */
  currentTaskId?: string;
  /** 出口总数 */
  linkTotal?: number;
  /** 被真实走过的出口数 */
  linkPassed?: number;
  /** 逐条出口覆盖情况 */
  links?: WfTestLinkResult[];
  /** 实际执行的场景数（开启分支覆盖时 >1） */
  scenarioCount?: number;
  scenarios?: WfTestScenario[];
}

/** 流程测试历史记录（wf_test_log） */
export interface WfTestLogItem {
  id?: string;
  defId?: string;
  defVersion?: number;
  procKey?: string;
  defName?: string;
  testUserId?: string;
  testUserName?: string;
  testTime?: string;
  costMs?: number;
  testStatus?: number;
  nodeTotal?: number;
  nodePassed?: number;
  reachedEnd?: number;
  summary?: string;
  logContent?: string;
  resultJson?: string;
}

/** 运行一次流程测试 */
export async function runWorkflowTest(dto: {
  defId: any;
  testUserId: any;
  testUserName?: string;
  formData?: Record<string, any>;
  /** 按网关分支反推变量取值、为每个分支额外真跑一次，覆盖到每条出口 */
  coverBranches?: boolean;
}) {
  // skipErrorHandler：错误由测试页自身 try-catch 提示（否则请求层与页面会各弹一条，出现重复提示）
  return request<ApiResponse<WfTestResult>>(`${WORKFLOW}/test/run`, {
    method: 'POST',
    data: dto,
    skipErrorHandler: true,
  });
}

/**
 * 发起一次「交互式测试」：临时部署草稿流程并真实发起测试态实例，但**不自动推进**。
 *
 * 对齐 ecology 流程测试页的「开始测试」：发起后停留创建节点等待办理，
 * 前端可「开始自动测试」逐节点推进（可暂停），或手动填写表单后「提交」单步办理。
 */
export async function startWorkflowTest(dto: {
  defId: any;
  testUserId: any;
  testUserName?: string;
  formData?: Record<string, any>;
}) {
  // skipErrorHandler：错误由测试页自身 try-catch 提示（避免请求层与页面各弹一条）
  return request<ApiResponse<WfTestResult>>(`${WORKFLOW}/test/start`, {
    method: 'POST',
    data: dto,
    skipErrorHandler: true,
  });
}

/**
 * 交互式测试-单步推进：提交当前节点的待办，推进到下一节点。
 *
 * 「自动测试」由前端循环调用（每次提交一个节点，可随时暂停）；
 * 「手动测试」由用户填写表单后点「提交」调用一次。
 * formData 非空时会作为流程变量下发引擎，驱动后续排他网关按真实条件选分支。
 */
export async function stepWorkflowTest(dto: {
  instId: any;
  opinion?: string;
  formData?: Record<string, any>;
  /**
   * 本次提交表单值所属的节点 Key（＝右侧表单当前所在节点）。
   * 后端按该节点的布局校验必填，避免「用开始节点表单的值去校验其它节点的必填」造成提交死锁。
   */
  formNodeKey?: string;
}) {
  // skipErrorHandler：错误由测试页自身 try-catch 提示（避免请求层与页面各弹一条，出现「同一提示弹两次」）
  return request<ApiResponse<WfTestResult>>(`${WORKFLOW}/test/step`, {
    method: 'POST',
    data: dto,
    skipErrorHandler: true,
  });
}

/** 交互式测试-查询状态（当前节点 / 待办 / 节点经过次数 / 出口覆盖 / 逐行日志） */
export async function getWorkflowTestState(instId: any) {
  return request<ApiResponse<WfTestResult>>(`${WORKFLOW}/test/state`, {
    method: 'GET',
    params: { instId },
  });
}

/** 交互式测试-待办列表（测试态实例的待办，供手动办理定位 taskId） */
export async function getWorkflowTestTodo(instId: any) {
  return request<ApiResponse<any[]>>(`${WORKFLOW}/test/todo`, {
    method: 'GET',
    params: { instId },
  });
}

/**
 * 「我的测试待办」（真人模式，方案 §6.4 C12）：当前登录人在测试实例上的待办。
 *
 * <p>与 {@link getWorkflowTestTodo} 的区别：那个是「某测试实例的全部待办」（管理面代跑用），
 * 这个按当前登录人过滤 —— 供节点操作者本人从测试入口看到属于自己的测试单。
 */
export async function getMyWorkflowTestTodo() {
  return request<ApiResponse<any[]>>(`${WORKFLOW}/test/my-todo`, {
    method: 'GET',
    // 真人模式是可选路径：失败（如无权限/无待办）不应弹全局错误
    skipErrorHandler: true,
  });
}

/**
 * 真人办理测试待办（方案 §6.4 C12）：与 {@link stepWorkflowTest} 同语义，
 * 额外要求「当前用户是该待办的执行人」（非管理员时），失败由调用方提示。
 */
export async function approveWorkflowTest(dto: {
  instId: any;
  opinion?: string;
  formData?: Record<string, any>;
  formNodeKey?: string;
}) {
  return request<ApiResponse<WfTestResult>>(`${WORKFLOW}/test/approve`, {
    method: 'POST',
    data: dto,
    skipErrorHandler: true,
  });
}

/** 测试历史列表（不传 defId 查全部） */
export async function listWorkflowTest(defId?: any) {
  return request<ApiResponse<WfTestLogItem[]>>(`${WORKFLOW}/test/list`, {
    method: 'GET',
    params: { defId },
  });
}

/** 测试详情（含日志正文与结构化结果） */
export async function getWorkflowTest(id: any) {
  return request<ApiResponse<WfTestLogItem>>(`${WORKFLOW}/test/${id}`, { method: 'GET' });
}

/** 删除测试记录 */
export async function removeWorkflowTest(ids: any[]) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/test?ids=${ids.join(',')}`, { method: 'DELETE' });
}

/** 清理测试数据：删除所有测试态（is_test=1）的实例/待办/日志/快照，并级联卸载测试部署。
 *  defId 为空时清理全部测试数据。 */
export async function cleanupWorkflowTest(defId?: any) {
  return request<ApiResponse<number>>(`${WORKFLOW}/test/cleanup`, {
    method: 'POST',
    params: { defId },
  });
}

export interface ShadowSummary {
  testStatus?: number;
  reachedEnd?: boolean;
  nodeTotal?: number;
  nodePassed?: number;
  /** 流转路径的节点Key序列（首段源节点 + 每段目标节点） */
  path?: string[];
  summary?: string;
}

export interface ShadowDiff {
  /** 基准版本（旧）流程定义ID */
  baseDefId?: string | number;
  baseVersion?: number;
  /** 目标版本（新）流程定义ID */
  targetDefId?: string | number;
  targetVersion?: number;
  /** 基准版本走查摘要 */
  base?: ShadowSummary;
  /** 目标版本走查摘要 */
  target?: ShadowSummary;
  /** 逐项差异文案（为空即等价） */
  diffs?: string[];
  /** 两版本是否等价 */
  identical?: boolean;
}

export async function shadowWorkflowTest(dto: {
  defId: any;
  baseDefId?: any;
  testUserId?: any;
}) {
  return request<ApiResponse<ShadowDiff>>(`${WORKFLOW}/test/shadow`, {
    method: 'POST',
    params: { defId: dto.defId, baseDefId: dto.baseDefId, testUserId: dto.testUserId },
    skipErrorHandler: true,
  });
}

// ───────────── 节点超时规则（多条，对齐泛微节点信息「超时设置」） ─────────────
export interface WfNodeTimeout {
  id?: number;
  defId?: number;
  nodeKey?: string;
  /** 排序（升序执行） */
  seq?: number;
  /** 是否启用 1=是 0=否 */
  enabled?: number;
  /** 起算方式 1=节点到达(收到待办) 2=表单时间字段 */
  startType?: number;
  /** 起算=表单时间字段时的字段名 */
  startField?: string;
  /** 截止=相对时长时的分钟数 */
  durationMin?: number;
  /** 截止方式 1=相对 2=固定时刻(HH:mm) 3=表单时间字段 */
  endType?: number;
  /** 截止=固定时刻时的 HH:mm */
  endFixedTime?: string;
  /** 截止=表单时间字段时的字段名 */
  endField?: string;
  /** 超时动作 autoApprove/forward/assign/remind */
  actionWay?: string;
  /** 动作=forward 时的目标节点（扩展位） */
  targetNodeKey?: string;
  /** 动作=assign 时的指定操作者（人力资源 ID 逗号分隔） */
  operatorIds?: string;
  /** 动作意见 */
  opinion?: string;
  /** 提醒方式 sys=流程提醒 ml=短信 sm=邮件（逗号分隔） */
  remindTypes?: string;
  /** 提醒对象：节点当前处理人 1=是 0=否 */
  remindBeforeOperator?: number;
  /** 提醒对象：指定人员（人力资源 ID 逗号分隔） */
  remindPersons?: string;
}

/** 节点超时规则列表（按 defId + nodeKey） */
export async function listNodeTimeouts(defId: number, nodeKey: string) {
  return request<ApiResponse<WfNodeTimeout[]>>(`${WORKFLOW}/node-timeout/list`, {
    method: 'GET',
    params: { defId, nodeKey },
  });
}

/** 保存节点超时规则（覆盖保存该节点的全部规则，空数组即清空） */
export async function saveNodeTimeouts(defId: number, nodeKey: string, rules: WfNodeTimeout[]) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/node-timeout/save`, {
    method: 'POST',
    params: { defId, nodeKey },
    data: rules,
  });
}

// ───────────── 节点自定义操作（按钮 + 动作明细 + 权限矩阵） ─────────────
export interface WfCustomOperationAction {
  id?: number;
  opId?: number;
  url?: string;
  httpMethod?: string;
  flowOperation?: string;
  interfaceName?: string;
  paramExpr?: string;
  opinion?: string;
}
export interface WfCustomOperationRight {
  id?: number;
  opId?: number;
  rightType?: string;
  rightValue?: string;
}
export interface WfCustomOperationFull {
  op?: {
    id?: number;
    defId?: number;
    nodeKey?: string;
    btnName?: string;
    btnOrder?: number;
    enabled?: number;
    actionType?: number;
  };
  action?: WfCustomOperationAction;
  rights?: WfCustomOperationRight[];
}

/** 运行时可见按钮（启用） */
// defId 为 19 位雪花 ID：按字符串下发（Number() 会丢精度）；后端 @RequestParam Long 可绑定数字字符串
export async function listCustomOperations(defId: string | number, nodeKey: string) {
  return request<ApiResponse<any[]>>(`${WORKFLOW}/custom-operation/list`, {
    method: 'GET',
    params: { defId, nodeKey },
  });
}
/** 配置用：节点全部按钮（含动作与权限） */
export async function fullCustomOperations(defId: number, nodeKey: string) {
  return request<ApiResponse<WfCustomOperationFull[]>>(`${WORKFLOW}/custom-operation/full`, {
    method: 'GET',
    params: { defId, nodeKey },
  });
}
/** 保存节点自定义操作（覆盖式） */
export async function saveCustomOperations(defId: number, nodeKey: string, payload: WfCustomOperationFull[]) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/custom-operation/save`, {
    method: 'POST',
    params: { defId, nodeKey },
    data: payload,
  });
}
/** 运行时执行自定义操作 */
// 同 listCustomOperations：opId / instId 均按字符串下发，避免雪花 ID 精度丢失
export async function executeCustomOperation(
  opId: string | number,
  instId: string | number,
  operator?: string | number,
) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/custom-operation/execute`, {
    method: 'POST',
    params: { opId, instId, operator },
  });
}

// ───────────── 按操作类型默认签字意见 ─────────────
export interface WfNodeDefaultSign {
  id?: number;
  defId?: number;
  nodeKey?: string;
  menuType?: string;
  defaultOpinion?: string;
}
/** 取默认签字意见 */
export async function getDefaultSign(defId: number, nodeKey: string, menuType: string) {
  return request<ApiResponse<string>>(`${WORKFLOW}/custom-operation/default-sign`, {
    method: 'GET',
    params: { defId, nodeKey, menuType },
  });
}
/** 保存默认签字意见（覆盖式） */
export async function saveDefaultSigns(defId: number, nodeKey: string, signs: WfNodeDefaultSign[]) {
  return request<ApiResponse<boolean>>(`${WORKFLOW}/custom-operation/default-sign/save`, {
    method: 'POST',
    params: { defId, nodeKey },
    data: signs,
  });
}
