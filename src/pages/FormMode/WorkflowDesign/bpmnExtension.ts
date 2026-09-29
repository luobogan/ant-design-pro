/**
 * 路线 B 共享读写层：在 bpmn-js 模型上读写 `wf:` 扩展（定义期语义单一事实源）。
 *
 * 与后端 `BpmnExtensionUtil`（T-3 冻结 schema）共用同一命名空间 `http://www.springblade.org/workflow`、
 * 同一元素/属性命名，保证设计器 ↔ 引擎往返保真（V7/V13）。
 *
 * 用法（面板内）：
 *   const modeler = useBpmnModeler();           // 取自 BpmnDesigner 的 modelerRef
 *   const el = useSelectedElement();            // 当前选中的 bpmn-js 元素
 *   const ext = getWfNodeExt(el);               // 读节点扩展
 *   setWfNodeExt(modeler, el, nextExt);         // 写回（经 modeling.updateModdleProperties，可撤销）
 *
 * 设计要点：
 * - 只动 `extensionElements.values` 中 `$type === 'wf:NodeExtension' / 'wf:LinkExtension' / 'wf:ProcessMeta'`，
 *   不影响 camunda 等其它扩展。
 * - 标量属性一律以字符串落扩展（与后端 String 类型对齐），面板按需 parse。
 * - `extJson` / `extraOperations` 走文本体（`isBody`），可承载任意 JSON / 多行文本。
 */

/** 操作者（对齐 wf_node_operator，保留 groupNo/levelMin/levelMax 等 schema 已含字段） */
export interface WfOperator {
  groupNo?: string;
  opType?: string;
  objId?: string;
  bhxj?: string;
  levelMin?: string;
  levelMax?: string;
}

/** 主表字段权限（wf:fieldPerm） */
export interface WfFieldPerm {
  field: string;
  perm: string; // 0隐藏 1只读 2可编辑 3必填
}

/** 明细表字段权限（wf:detailPerm） */
export interface WfDetailPerm {
  dtKey: string; // dt1/dt2...
  field: string;
  perm: string;
}

/** 明细表字段过滤（wf:detailFilter） */
export interface WfDetailFilter {
  dtKey: string;
  rowFilter?: string; // 原 WfNodeDetailFilter 整行 JSON
}

/** 超时规则（wf:timeout，对齐 wf_node_timeout） */
export interface WfTimeout {
  seq?: string;
  enabled?: string;
  startType?: string;
  startField?: string;
  endType?: string;
  endFixedTime?: string;
  endField?: string;
  durationMin?: string;
  actionWay?: string;
  opinion?: string;
  operatorIds?: string;
  remindBeforeOperator?: string;
  remindTypes?: string;
  remindPersons?: string;
}

/** 自定义动作（wf:customAction） */
export interface WfCustomAction {
  actionKey?: string;
  name?: string;
  type?: string;
  url?: string;
  expression?: string;
}

/** 操作菜单权限项（wf:right） */
export interface WfRight {
  rightType?: string;
  rightValue?: string;
}

/** 操作菜单（wf:operation，对齐 wf_custom_operation + right） */
export interface WfOperation {
  btnName?: string;
  btnOrder?: string;
  actionType?: string;
  enabled?: string;
  rights?: WfRight[];
}

/** 节点扩展（wf:node） */
export interface WfNodeExt {
  nodeType?: string;
  signOrder?: string;
  mergeType?: string;
  passNum?: string;
  allowReject?: string;
  allowForward?: string;
  autoApprove?: string;
  sortOrder?: string;
  testStatus?: string;
  multiInstance?: string;
  formKey?: string;
  operators?: WfOperator[];
  fieldPerms?: WfFieldPerm[];
  detailPerms?: WfDetailPerm[];
  detailFilters?: WfDetailFilter[];
  timeouts?: WfTimeout[];
  customActions?: WfCustomAction[];
  operations?: WfOperation[];
  /** 原 WfProcessNode.extJson 保全（含明细表级权限等 schema 外字段） */
  extJson?: string;
  /** 原始 moddle 元素（高级读写用，勿直接持有过久） */
  raw?: any;
}

/** 出口扩展（wf:link，挂在 sequenceFlow 上） */
export interface WfLinkExt {
  isReject?: string;
  isMustPass?: string;
  conditionCn?: string;
  sortOrder?: string;
  viaGateway?: string;
  /** 出口附加操作（多行文本，原 wf_node_link.extra_operations） */
  extraOperations?: string;
  raw?: any;
}

/** 流程级元信息（wf:processMeta，挂在 process 上） */
export interface WfProcessMeta {
  defKey?: string;
  workflowType?: string;
  formId?: string;
  layoutId?: string;
  grayEnabled?: string;
  grayRule?: string;
  raw?: any;
}

const WF_NS = 'http://www.springblade.org/workflow';

const isWf = (el: any, local: string) => !!el && el.$type === `wf:${local}`;

/** 取元素 extensionElements 下的首个 wf:<local> 子元素（原始 moddle） */
const firstWfChild = (element: any, local: string): any => {
  const bo = element?.businessObject ?? element;
  const ext = bo?.extensionElements;
  const values: any[] = ext?.get?.('values') ?? ext?.values ?? [];
  return values.find((v) => isWf(v, local)) || null;
};

/** 取 extensionElements 下全部 wf:<local> 子元素 */
const str = (v: any): string | undefined => (v == null ? undefined : String(v));

// ───────────────────────────────── 读 ─────────────────────────────────

export const getWfNodeExt = (element: any): WfNodeExt | null => {
  const node = firstWfChild(element, 'NodeExtension');
  if (!node) return null;
  const arr = (name: string): any[] =>
    (node.get?.(name) ?? (node as any)[name] ?? []).filter(Boolean);
  const ops: WfOperator[] = arr('operators').map((o) => ({
    groupNo: str(o.groupNo),
    opType: str(o.opType),
    objId: str(o.objId),
    bhxj: str(o.bhxj),
    levelMin: str(o.levelMin),
    levelMax: str(o.levelMax),
  }));
  const fieldPerms: WfFieldPerm[] = arr('fieldPerms').map((f) => ({
    field: str(f.field) || '',
    perm: str(f.perm) ?? '2',
  }));
  const detailPerms: WfDetailPerm[] = arr('detailPerms').map((f) => ({
    dtKey: str(f.dtKey) || '',
    field: str(f.field) || '',
    perm: str(f.perm) ?? '2',
  }));
  const detailFilters: WfDetailFilter[] = arr('detailFilters').map((f) => ({
    dtKey: str(f.dtKey) || '',
    rowFilter: str(f.rowFilter),
  }));
  const timeouts: WfTimeout[] = arr('timeouts').map((t) => ({
    seq: str(t.seq),
    enabled: str(t.enabled),
    startType: str(t.startType),
    startField: str(t.startField),
    endType: str(t.endType),
    endFixedTime: str(t.endFixedTime),
    endField: str(t.endField),
    durationMin: str(t.durationMin),
    actionWay: str(t.actionWay),
    opinion: str(t.opinion),
    operatorIds: str(t.operatorIds),
    remindBeforeOperator: str(t.remindBeforeOperator),
    remindTypes: str(t.remindTypes),
    remindPersons: str(t.remindPersons),
  }));
  const customActions: WfCustomAction[] = arr('customActions').map((a) => ({
    actionKey: str(a.actionKey),
    name: str(a.name),
    type: str(a.type),
    url: str(a.url),
    expression: str(a.expression),
  }));
  const operations: WfOperation[] = arr('operations').map((o) => ({
    btnName: str(o.btnName),
    btnOrder: str(o.btnOrder),
    actionType: str(o.actionType),
    enabled: str(o.enabled),
    rights: (o.get?.('rights') ?? o.rights ?? []).map((r: any) => ({
      rightType: str(r.rightType),
      rightValue: str(r.rightValue),
    })),
  }));
  const extJsonEl = firstWfChild(node, 'ExtJson');
  return {
    nodeType: str(node.nodeType),
    signOrder: str(node.signOrder),
    mergeType: str(node.mergeType),
    passNum: str(node.passNum),
    allowReject: str(node.allowReject),
    allowForward: str(node.allowForward),
    autoApprove: str(node.autoApprove),
    sortOrder: str(node.sortOrder),
    testStatus: str(node.testStatus),
    multiInstance: str(node.multiInstance),
    formKey: str(node.formKey),
    operators: ops,
    fieldPerms,
    detailPerms,
    detailFilters,
    timeouts,
    customActions,
    operations,
    extJson: extJsonEl?.body ?? undefined,
    raw: node,
  };
};

export const getWfLinkExt = (element: any): WfLinkExt | null => {
  const link = firstWfChild(element, 'LinkExtension');
  if (!link) return null;
  const extraEl = firstWfChild(link, 'ExtraOperations');
  return {
    isReject: str(link.isReject),
    isMustPass: str(link.isMustPass),
    conditionCn: str(link.conditionCn),
    sortOrder: str(link.sortOrder),
    viaGateway: str(link.viaGateway),
    extraOperations: extraEl?.body ?? undefined,
    raw: link,
  };
};

export const getWfProcessMeta = (processElement: any): WfProcessMeta | null => {
  const meta = firstWfChild(processElement, 'ProcessMeta');
  if (!meta) return null;
  return {
    defKey: str(meta.defKey),
    workflowType: str(meta.workflowType),
    formId: str(meta.formId),
    layoutId: str(meta.layoutId),
    grayEnabled: str(meta.grayEnabled),
    grayRule: str(meta.grayRule),
    raw: meta,
  };
};

// ───────────────────────────────── 写 ─────────────────────────────────

const ensureExtensionElements = (modeler: any, element: any) => {
  const moddle = modeler.get('moddle');
  const bo = element.businessObject ?? element;
  let ext = bo.extensionElements;
  if (!ext) {
    ext = moddle.create('bpmn:ExtensionElements', { values: [] });
  }
  return { moddle, bo, ext };
};

const replaceWfChild = (modeler: any, element: any, local: string, newChild: any | null) => {
  const { moddle, bo, ext } = ensureExtensionElements(modeler, element);
  const values: any[] = ext.get?.('values') ?? ext.values ?? [];
  const kept = values.filter((v) => !isWf(v, local));
  const next = newChild ? [...kept, newChild] : kept;
  const modeling = modeler.get('modeling');
  if (bo.extensionElements) {
    modeling.updateModdleProperties(element, bo.extensionElements, { values: next });
  } else {
    modeling.updateProperties(element, { extensionElements: moddle.create('bpmn:ExtensionElements', { values: next }) });
  }
};

const buildOperators = (moddle: any, ops?: WfOperator[]) =>
  (ops || []).map((o) =>
    moddle.create('wf:Operator', {
      groupNo: o.groupNo,
      opType: o.opType,
      objId: o.objId,
      bhxj: o.bhxj,
      levelMin: o.levelMin,
      levelMax: o.levelMax,
    }),
  );

const buildFieldPerms = (moddle: any, list?: WfFieldPerm[]) =>
  (list || []).map((f) => moddle.create('wf:FieldPerm', { field: f.field, perm: f.perm }));

const buildDetailPerms = (moddle: any, list?: WfDetailPerm[]) =>
  (list || []).map((f) => moddle.create('wf:DetailPerm', { dtKey: f.dtKey, field: f.field, perm: f.perm }));

const buildDetailFilters = (moddle: any, list?: WfDetailFilter[]) =>
  (list || []).map((f) => moddle.create('wf:DetailFilter', { dtKey: f.dtKey, rowFilter: f.rowFilter }));

const buildTimeouts = (moddle: any, list?: WfTimeout[]) =>
  (list || []).map((t) =>
    moddle.create('wf:Timeout', {
      seq: t.seq,
      enabled: t.enabled,
      startType: t.startType,
      startField: t.startField,
      endType: t.endType,
      endFixedTime: t.endFixedTime,
      endField: t.endField,
      durationMin: t.durationMin,
      actionWay: t.actionWay,
      opinion: t.opinion,
      operatorIds: t.operatorIds,
      remindBeforeOperator: t.remindBeforeOperator,
      remindTypes: t.remindTypes,
      remindPersons: t.remindPersons,
    }),
  );

const buildCustomActions = (moddle: any, list?: WfCustomAction[]) =>
  (list || []).map((a) =>
    moddle.create('wf:CustomAction', {
      actionKey: a.actionKey,
      name: a.name,
      type: a.type,
      url: a.url,
      expression: a.expression,
    }),
  );

const buildOperations = (moddle: any, list?: WfOperation[]) =>
  (list || []).map((o) =>
    moddle.create('wf:Operation', {
      btnName: o.btnName,
      btnOrder: o.btnOrder,
      actionType: o.actionType,
      enabled: o.enabled,
      rights: (o.rights || []).map((r) =>
        moddle.create('wf:Right', { rightType: r.rightType, rightValue: r.rightValue }),
      ),
    }),
  );

/** 写（覆盖）节点扩展。ext 为 null 时删除该扩展。 */
export const setWfNodeExt = (modeler: any, element: any, ext: WfNodeExt | null) => {
  const { moddle } = ensureExtensionElements(modeler, element);
  if (!ext) {
    replaceWfChild(modeler, element, 'NodeExtension', null);
    return;
  }
  const node = moddle.create('wf:NodeExtension', {
    nodeType: ext.nodeType,
    signOrder: ext.signOrder,
    mergeType: ext.mergeType,
    passNum: ext.passNum,
    allowReject: ext.allowReject,
    allowForward: ext.allowForward,
    autoApprove: ext.autoApprove,
    sortOrder: ext.sortOrder,
    testStatus: ext.testStatus,
    multiInstance: ext.multiInstance,
    formKey: ext.formKey,
    operators: buildOperators(moddle, ext.operators),
    fieldPerms: buildFieldPerms(moddle, ext.fieldPerms),
    detailPerms: buildDetailPerms(moddle, ext.detailPerms),
    detailFilters: buildDetailFilters(moddle, ext.detailFilters),
    timeouts: buildTimeouts(moddle, ext.timeouts),
    customActions: buildCustomActions(moddle, ext.customActions),
    operations: buildOperations(moddle, ext.operations),
    extJson: ext.extJson && ext.extJson.trim() ? moddle.create('wf:ExtJson', { body: ext.extJson }) : undefined,
  });
  replaceWfChild(modeler, element, 'NodeExtension', node);
};

/** 写（覆盖）出口扩展。ext 为 null 时删除。 */
export const setWfLinkExt = (modeler: any, element: any, ext: WfLinkExt | null) => {
  const { moddle } = ensureExtensionElements(modeler, element);
  if (!ext) {
    replaceWfChild(modeler, element, 'LinkExtension', null);
    return;
  }
  const link = moddle.create('wf:LinkExtension', {
    isReject: ext.isReject,
    isMustPass: ext.isMustPass,
    conditionCn: ext.conditionCn,
    sortOrder: ext.sortOrder,
    viaGateway: ext.viaGateway,
    extraOperations:
      ext.extraOperations && ext.extraOperations.trim()
        ? moddle.create('wf:ExtraOperations', { body: ext.extraOperations })
        : undefined,
  });
  replaceWfChild(modeler, element, 'LinkExtension', link);
};

/** 写（覆盖）流程级元信息。ext 为 null 时删除。 */
export const setWfProcessMeta = (modeler: any, processElement: any, ext: WfProcessMeta | null) => {
  const { moddle } = ensureExtensionElements(modeler, processElement);
  if (!ext) {
    replaceWfChild(modeler, processElement, 'ProcessMeta', null);
    return;
  }
  const meta = moddle.create('wf:ProcessMeta', {
    defKey: ext.defKey,
    workflowType: ext.workflowType,
    formId: ext.formId,
    layoutId: ext.layoutId,
    grayEnabled: ext.grayEnabled,
    grayRule: ext.grayRule,
  });
  replaceWfChild(modeler, processElement, 'ProcessMeta', meta);
};

export { WF_NS };
