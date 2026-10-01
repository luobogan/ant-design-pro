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
 * - 只动 `extensionElements.values` 中 `$type === 'wf:node' / 'wf:link' / 'wf:processMeta'`，
 *   不影响 camunda 等其它扩展。
 * - 标量属性一律以字符串落扩展（与后端 String 类型对齐），面板按需 parse。
 * - `extJson` / `extraOperations` 走文本体（`isBody`），可承载任意 JSON / 多行文本。
 */

/** 操作者（对齐 wf_node_operator，含操作组名/可见性/生效条件/协办等全部字段） */
export interface WfOperator {
  groupNo?: string;
  opType?: string;
  objId?: string;
  bhxj?: string;
  levelMin?: string;
  levelMax?: string;
  signOrder?: string;
  batchNo?: string;
  groupName?: string;
  canView?: string;
  conditionJson?: string;
  isCoadjutant?: string;
  coadjutants?: string;
  isPending?: string;
  isModify?: string;
  signType?: string;
}

/** 字段权限（wf:fieldPerm，主表 scope=main / 明细表 scope=dt{idx}；含 P3-5 三维度细粒度） */
export interface WfFieldPerm {
  scope?: string;
  field: string;
  perm: string; // 0隐藏 1只读 2可编辑 3必填
  /** 三维度：1=是 0=否（后端 WfFieldPermExt 对齐；perm 为聚合口径，三维度为细粒度口径） */
  visible?: string;
  editable?: string;
  required?: string;
}

/** 明细表字段权限（wf:detailPerm，含 P3-5 三维度细粒度） */
export interface WfDetailPerm {
  dtKey: string; // dt1/dt2...
  field: string;
  perm: string;
  visible?: string;
  editable?: string;
  required?: string;
}

/** 明细表字段过滤（wf:detailFilter，对齐后端 WfDetailFilterExt：逐字段比较规则） */
export interface WfDetailFilter {
  dtIndex?: string; // 明细表序号（1 起）
  modeType?: string;
  fieldName?: string;
  compareType?: string;
  compareValue?: string;
  isRequired?: string;
}

/** 节点级明细表整表权限（wf:detailTablePerm，对齐后端 WfDetailTablePermExt） */
export interface WfDetailTablePerm {
  dtIndex?: string;
  canAdd?: string;
  canEdit?: string;
  canDelete?: string;
  hideEmpty?: string;
  defaultRows?: string;
  required?: string;
  printSerial?: string;
  allowScroll?: string;
  openPaging?: string;
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
  /** 动作明细：按 actionType 使用（1=URL，2=流程操作，3=接口） */
  url?: string;
  httpMethod?: string;
  paramExpr?: string;
  flowOperation?: string;
  interfaceName?: string;
  opinion?: string;
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
  operator?: WfOperator[];
  fieldPerm?: WfFieldPerm[];
  detailPerm?: WfDetailPerm[];
  detailTablePerm?: WfDetailTablePerm[];
  detailFilter?: WfDetailFilter[];
  timeout?: WfTimeout[];
  customAction?: WfCustomAction[];
  operation?: WfOperation[];
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
  /** 折叠连线经过的网关 key（A→网关→B 折叠为 A→B 时记录） */
  viaGatewayKey?: string;
  /** 出口附加操作（多行文本，原 wf_node_link.extra_operations） */
  extraOperations?: string;
  raw?: any;
}

/** 流程级折叠连线（wf:foldedLink，挂在 process 上；A→网关→B 合成出口的唯一载体） */
export interface WfFoldedLink {
  from?: string;
  to?: string;
  viaGatewayKey?: string;
  isReject?: string;
  isMustPass?: string;
  conditionCn?: string;
  sortOrder?: string;
  extraOperations?: string;
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

const isWf = (el: any, local: string) => !!el && String(el.$type).toLowerCase() === `wf:${local.toLowerCase()}`;

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
  const node = firstWfChild(element, 'node');
  if (!node) return null;
  const arr = (name: string): any[] =>
    (node.get?.(name) ?? (node as any)[name] ?? []).filter(Boolean);
  // 契约（doc/md/wf_BPMN扩展schema定稿.md §4）统一为单数元素名：operator/fieldPerm/...，
  // 旧技能模板的复数容器（operators/fieldPerms/customOperations）与顶层容器（Operators/...）已作废。
  const operatorEls: any[] = arr('operator');
  const fieldPermEls: any[] = arr('fieldPerm');
  const detailPermEls: any[] = arr('detailPerm');
  const detailTablePermEls: any[] = arr('detailTablePerm');
  const detailFilterEls: any[] = arr('detailFilter');
  const timeoutEls: any[] = arr('timeout');
  const customActionEls: any[] = arr('customAction');
  const operationEls: any[] = arr('operation');

  const ops: WfOperator[] = operatorEls.map((o) => ({
    groupNo: str(o.groupNo),
    opType: str(o.opType),
    objId: str(o.objId),
    bhxj: str(o.bhxj),
    levelMin: str(o.levelMin),
    levelMax: str(o.levelMax),
    signOrder: str(o.signOrder),
    batchNo: str(o.batchNo),
    groupName: str(o.groupName),
    canView: str(o.canView),
    conditionJson: str(o.conditionJson),
    isCoadjutant: str(o.isCoadjutant),
    coadjutants: str(o.coadjutants),
    isPending: str(o.isPending),
    isModify: str(o.isModify),
    signType: str(o.signType),
  }));
  const fieldPerms: WfFieldPerm[] = fieldPermEls.map((f) => ({
    scope: str(f.scope) ?? 'main',
    field: str(f.field) || '',
    perm: str(f.perm) ?? '2',
    visible: str(f.visible),
    editable: str(f.editable),
    required: str(f.required),
  }));
  const detailPerms: WfDetailPerm[] = detailPermEls.map((f) => ({
    dtKey: str(f.dtKey) || '',
    field: str(f.field) || '',
    perm: str(f.perm) ?? '2',
    visible: str(f.visible),
    editable: str(f.editable),
    required: str(f.required),
  }));
  const detailTablePerms: WfDetailTablePerm[] = detailTablePermEls.map((d) => ({
    dtIndex: str(d.dtIndex),
    canAdd: str(d.canAdd),
    canEdit: str(d.canEdit),
    canDelete: str(d.canDelete),
    hideEmpty: str(d.hideEmpty),
    defaultRows: str(d.defaultRows),
    required: str(d.required),
    printSerial: str(d.printSerial),
    allowScroll: str(d.allowScroll),
    openPaging: str(d.openPaging),
  }));
  const detailFilters: WfDetailFilter[] = detailFilterEls.map((f) => ({
    dtIndex: str(f.dtIndex),
    modeType: str(f.modeType),
    fieldName: str(f.fieldName),
    compareType: str(f.compareType),
    compareValue: str(f.compareValue),
    isRequired: str(f.isRequired),
  }));
  const timeouts: WfTimeout[] = timeoutEls.map((t) => ({
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
  const customActions: WfCustomAction[] = customActionEls.map((a) => ({
    actionKey: str(a.actionKey),
    name: str(a.name),
    type: str(a.type),
    url: str(a.url),
    expression: str(a.expression),
  }));
  const operations: WfOperation[] = operationEls.map((o) => ({
    btnName: str(o.btnName),
    btnOrder: str(o.btnOrder),
    actionType: str(o.actionType),
    enabled: str(o.enabled),
    url: str(o.url),
    httpMethod: str(o.httpMethod),
    paramExpr: str(o.paramExpr),
    flowOperation: str(o.flowOperation),
    interfaceName: str(o.interfaceName),
    opinion: str(o.opinion),
    rights: (o.get?.('rights') ?? o.rights ?? []).map((r: any) => ({
      rightType: str(r.rightType),
      rightValue: str(r.rightValue),
    })),
  }));
  // extJson 是 wf:node 的【子元素属性】（moddle child），不在 extensionElements 下；
  // 旧实现误用 firstWfChild（查 extensionElements）导致恒取不到 → 静默丢数据，已修正。
  const extJsonEl = (node.get?.('extJson') ?? node.extJson) as any;
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
    operator: ops,
    fieldPerm: fieldPerms,
    detailPerm: detailPerms,
    detailTablePerm: detailTablePerms,
    detailFilter: detailFilters,
    timeout: timeouts,
    customAction: customActions,
    operation: operations,
    extJson: extJsonEl?.body ?? undefined,
    raw: node,
  };
};

export const getWfLinkExt = (element: any): WfLinkExt | null => {
  const link = firstWfChild(element, 'link');
  if (!link) return null;
  // extraOperations 同为 wf:link 的子元素属性（非 extensionElements 子级）
  const extraEl = (link.get?.('extraOperations') ?? link.extraOperations) as any;
  return {
    isReject: str(link.isReject),
    isMustPass: str(link.isMustPass),
    conditionCn: str(link.conditionCn),
    sortOrder: str(link.sortOrder),
    viaGateway: str(link.viaGateway),
    viaGatewayKey: str(link.viaGatewayKey),
    extraOperations: extraEl?.body ?? undefined,
    raw: link,
  };
};

export const getWfProcessMeta = (processElement: any): WfProcessMeta | null => {
  const meta = firstWfChild(processElement, 'processMeta');
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

/**
 * 按源/目标节点 Key 定位画布上的真实连线（SequenceFlow 元素）。
 *
 * 出口可能是「穿透网关折叠」的逻辑出口（A→网关→B，viaGateway=1），画布上并不存在 A→B 直连，
 * 故先试直连，失败再 BFS 穿透网关/事件等**中转元素**还原 A→…→B（与后端折叠规则一致：不越过业务节点）。
 */
export const findSequenceFlow = (
  modeler: any,
  fromKey?: string,
  toKey?: string,
): any | undefined => {
  if (!modeler || !fromKey || !toKey) return undefined;
  const registry = modeler.get('elementRegistry');
  const from = registry?.get(fromKey);
  if (!from) return undefined;

  const match = (c: any) => c.target?.id === toKey || c.businessObject?.targetRef?.id === toKey;
  const direct = (from.outgoing || []).find(match);
  if (direct) return direct;

  const queue: string[] = [fromKey];
  const seen = new Set<string>([fromKey]);
  while (queue.length) {
    const cur = queue.shift() as string;
    for (const conn of registry.get(cur)?.outgoing || []) {
      const target = conn.target;
      if (!target) continue;
      if (match(conn)) return conn;
      const type = target.businessObject?.$type;
      // 只穿透网关 / 事件等中转元素，不越过中间业务节点
      if (
        typeof type === 'string' &&
        (type.includes('Gateway') || type.includes('Event')) &&
        !seen.has(target.id)
      ) {
        seen.add(target.id);
        queue.push(target.id);
      }
    }
  }
  return undefined;
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
      signOrder: o.signOrder,
      batchNo: o.batchNo,
      groupName: o.groupName,
      canView: o.canView,
      conditionJson: o.conditionJson,
      isCoadjutant: o.isCoadjutant,
      coadjutants: o.coadjutants,
      isPending: o.isPending,
      isModify: o.isModify,
      signType: o.signType,
    }),
  );

const buildFieldPerms = (moddle: any, list?: WfFieldPerm[]) =>
  (list || []).map((f) =>
    moddle.create('wf:FieldPerm', {
      scope: f.scope ?? 'main',
      field: f.field,
      perm: f.perm,
      visible: f.visible,
      editable: f.editable,
      required: f.required,
    }),
  );

const buildDetailPerms = (moddle: any, list?: WfDetailPerm[]) =>
  (list || []).map((f) =>
    moddle.create('wf:DetailPerm', {
      dtKey: f.dtKey,
      field: f.field,
      perm: f.perm,
      visible: f.visible,
      editable: f.editable,
      required: f.required,
    }),
  );

const buildDetailTablePerms = (moddle: any, list?: WfDetailTablePerm[]) =>
  (list || []).map((d) =>
    moddle.create('wf:DetailTablePerm', {
      dtIndex: d.dtIndex,
      canAdd: d.canAdd,
      canEdit: d.canEdit,
      canDelete: d.canDelete,
      hideEmpty: d.hideEmpty,
      defaultRows: d.defaultRows,
      required: d.required,
      printSerial: d.printSerial,
      allowScroll: d.allowScroll,
      openPaging: d.openPaging,
    }),
  );

const buildDetailFilters = (moddle: any, list?: WfDetailFilter[]) =>
  (list || []).map((f) =>
    moddle.create('wf:DetailFilter', {
      dtIndex: f.dtIndex,
      modeType: f.modeType,
      fieldName: f.fieldName,
      compareType: f.compareType,
      compareValue: f.compareValue,
      isRequired: f.isRequired,
    }),
  );

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
      url: o.url,
      httpMethod: o.httpMethod,
      paramExpr: o.paramExpr,
      flowOperation: o.flowOperation,
      interfaceName: o.interfaceName,
      opinion: o.opinion,
      rights: (o.rights || []).map((r) =>
        moddle.create('wf:Right', { rightType: r.rightType, rightValue: r.rightValue }),
      ),
    }),
  );

/** 写（覆盖）节点扩展。ext 为 null 时删除该扩展。 */
export const setWfNodeExt = (modeler: any, element: any, ext: WfNodeExt | null) => {
  const { moddle } = ensureExtensionElements(modeler, element);
  if (!ext) {
    replaceWfChild(modeler, element, 'node', null);
    return;
  }
  const node = moddle.create('wf:Node', {
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
    operator: buildOperators(moddle, ext.operator),
    fieldPerm: buildFieldPerms(moddle, ext.fieldPerm),
    detailPerm: buildDetailPerms(moddle, ext.detailPerm),
    detailTablePerm: buildDetailTablePerms(moddle, ext.detailTablePerm),
    detailFilter: buildDetailFilters(moddle, ext.detailFilter),
    timeout: buildTimeouts(moddle, ext.timeout),
    customAction: buildCustomActions(moddle, ext.customAction),
    operation: buildOperations(moddle, ext.operation),
    extJson: ext.extJson && ext.extJson.trim() ? moddle.create('wf:ExtJson', { body: ext.extJson }) : undefined,
  });
  replaceWfChild(modeler, element, 'node', node);
};

/** 写（覆盖）出口扩展。ext 为 null 时删除。 */
export const setWfLinkExt = (modeler: any, element: any, ext: WfLinkExt | null) => {
  const { moddle } = ensureExtensionElements(modeler, element);
  if (!ext) {
    replaceWfChild(modeler, element, 'link', null);
    return;
  }
  const link = moddle.create('wf:Link', {
    isReject: ext.isReject,
    isMustPass: ext.isMustPass,
    conditionCn: ext.conditionCn,
    sortOrder: ext.sortOrder,
    viaGateway: ext.viaGateway,
    viaGatewayKey: ext.viaGatewayKey,
    extraOperations:
      ext.extraOperations && ext.extraOperations.trim()
        ? moddle.create('wf:ExtraOperations', { body: ext.extraOperations })
        : undefined,
  });
  replaceWfChild(modeler, element, 'link', link);
};

/** 写（覆盖）流程级元信息。ext 为 null 时删除。 */
export const setWfProcessMeta = (modeler: any, processElement: any, ext: WfProcessMeta | null) => {
  const { moddle } = ensureExtensionElements(modeler, processElement);
  if (!ext) {
    replaceWfChild(modeler, processElement, 'processMeta', null);
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
  replaceWfChild(modeler, processElement, 'processMeta', meta);
};

// ───────────────────────── 流程级折叠连线（wf:foldedLink） ─────────────────────────

/** 读流程级全部折叠连线（processElement 取 rootElement 的 process，或画布任一元素的根） */
export const getWfFoldedLinks = (processElement: any): WfFoldedLink[] => {
  const bo = processElement?.businessObject ?? processElement;
  const ext = bo?.extensionElements;
  const list: any[] = ext?.get?.('values') ?? ext?.values ?? [];
  return list
    .filter((v) => isWf(v, 'foldedLink'))
    .map((f) => {
      const extraEl = (f.get?.('extraOperations') ?? f.extraOperations) as any;
      return {
        from: str(f.from),
        to: str(f.to),
        viaGatewayKey: str(f.viaGatewayKey),
        isReject: str(f.isReject),
        isMustPass: str(f.isMustPass),
        conditionCn: str(f.conditionCn),
        sortOrder: str(f.sortOrder),
        extraOperations: extraEl?.body ?? undefined,
      };
    });
};

/** 写（覆盖）流程级全部折叠连线。list 为 null/[] 时清空，其余 wf:* 元素不受影响。 */
export const setWfFoldedLinks = (modeler: any, processElement: any, list: WfFoldedLink[] | null) => {
  const { moddle, bo, ext } = ensureExtensionElements(modeler, processElement);
  const values: any[] = ext.get?.('values') ?? ext.values ?? [];
  const kept = values.filter((v) => !isWf(v, 'foldedLink'));
  const next = [
    ...kept,
    ...(list || []).map((f) =>
      moddle.create('wf:FoldedLink', {
        from: f.from,
        to: f.to,
        viaGatewayKey: f.viaGatewayKey,
        isReject: f.isReject,
        isMustPass: f.isMustPass,
        conditionCn: f.conditionCn,
        sortOrder: f.sortOrder,
        extraOperations:
          f.extraOperations && f.extraOperations.trim()
            ? moddle.create('wf:ExtraOperations', { body: f.extraOperations })
            : undefined,
      }),
    ),
  ];
  const modeling = modeler.get('modeling');
  if (bo.extensionElements) {
    modeling.updateModdleProperties(processElement, bo.extensionElements, { values: next });
  } else {
    modeling.updateProperties(
      processElement,
      { extensionElements: moddle.create('bpmn:ExtensionElements', { values: next }) },
    );
  }
};

export { WF_NS };
