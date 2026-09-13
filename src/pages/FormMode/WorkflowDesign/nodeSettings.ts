import { WfProcessNode } from '@/services/workflow';
import { EXTRA_OPERATE_TYPES, MENUS_OPTIONS, SELECT_NEXT_FLOW_MODES } from './wfDict';

/**
 * 节点「设置项」的 schema 定义（单一来源）。
 *
 * 对齐 ecology「流转设置 → 节点信息」的每一项（NodeInfo.js:239-253）：
 * 节点名称 / 操作者 / 表单内容 / 操作菜单 / 节点前附加操作 / 节点后附加操作 /
 * 签字意见设置 / 标题显示设置 / 子流程设置 / 流程异常处理 / 表单日志查看范围 /
 * 指定流转 / 超时设置。
 *
 * 统一存到 `wf_process_node.ext_json.settings`。这里只描述 schema，
 * 渲染由 `NodeDetail`（纵向面板）与 `NodeInfoTable`（可编辑列表）+ `NodeSettingModal`（弹窗）共用。
 */
/**
 * 控件类型。
 * `nodeMultiSelect`：多选，但**选项来自当前流程的节点列表**（运行时由 NodeSettingModal 注入），
 * 用于「表单日志查看范围 → 可见节点集合」这类需要引用其它节点的场景。
 */
export type SettingFieldType =
  | 'switch'
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'radio'
  | 'multiSelect'
  | 'nodeMultiSelect';

export interface SettingField {
  name: string;
  label: string;
  type: SettingFieldType;
  options?: { label: string; value: any }[];
  placeholder?: string;
}

export interface SettingDef {
  key: string;
  label: string;
  fields: SettingField[];
}

export const SETTING_DEFS: SettingDef[] = [
  {
    key: 'operateMenu',
    label: '操作菜单',
    fields: [{ name: 'menus', label: '可用操作', type: 'multiSelect', options: MENUS_OPTIONS }],
  },
  {
    key: 'preOperate',
    label: '节点前附加操作',
    // 对齐 E9：附加操作是**多条列表**（新增/编辑/删除/拖动排序/启用），由 NodeExtraOperateModal 专用弹窗承载。
    // 这里只声明「是否已配置」判定所需字段：settings.preOperate.items 为非空数组即为已配置。
    fields: [{ name: 'items', label: '附加操作', type: 'text' }],
  },
  {
    key: 'postOperate',
    label: '节点后附加操作',
    fields: [{ name: 'items', label: '附加操作', type: 'text' }],
  },
  {
    key: 'signOpinion',
    label: '签字意见设置',
    fields: [
      { name: 'required', label: '意见必填', type: 'switch' },
      { name: 'template', label: '默认意见模板', type: 'textarea', placeholder: '如：同意' },
    ],
  },
  {
    key: 'titleDisplay',
    label: '标题显示设置',
    fields: [
      { name: 'template', label: '标题模板', type: 'text', placeholder: '如：{创建人}的{表单名称}' },
    ],
  },
  {
    key: 'subflow',
    label: '子流程设置',
    fields: [
      { name: 'flowKey', label: '子流程Key', type: 'text' },
      {
        name: 'trigger',
        label: '触发时机',
        type: 'select',
        options: [
          { label: '提交后', value: 'afterSubmit' },
          { label: '归档后', value: 'afterArchive' },
        ],
      },
    ],
  },
  {
    // 对齐 ecology：可见节点 ID 集合（workflow_flownode.viewnodeids）。
    // 旧值形如 { scope: 'all'|'node'|'self' } 由后端 WfNodeSettingsUtil 降级兼容，前端不再写入。
    key: 'formLogScope',
    label: '表单日志查看范围',
    fields: [
      {
        name: 'nodeKeys',
        label: '可见节点',
        type: 'nodeMultiSelect',
        placeholder: '不选则按旧规则（全部可见）',
      },
    ],
  },
  {
    key: 'exceptionHandle',
    label: '流程异常处理',
    fields: [
      {
        name: 'mode',
        label: '异常处理',
        type: 'radio',
        options: [
          { label: '继续', value: 'continue' },
          { label: '中断', value: 'stop' },
        ],
      },
    ],
  },
  {
    // 对齐 ecology SelectNextFlowMode：1=指定节点和操作者，2=仅指定节点（操作者取节点设置）
    key: 'appointFlow',
    label: '指定流转',
    fields: [
      { name: 'mode', label: '模式', type: 'select', options: SELECT_NEXT_FLOW_MODES },
      { name: 'target', label: '目标节点Key', type: 'text' },
    ],
  },
  {
    key: 'timeout',
    label: '超时设置',
    fields: [
      { name: 'hours', label: '超时(小时)', type: 'number' },
      { name: 'remind', label: '到期提醒', type: 'switch' },
      { name: 'autoApprove', label: '超时自动通过', type: 'switch' },
    ],
  },
  {
    // 对齐 ecology hasSecondAuth：处理该节点前要求重新校验密码
    key: 'secondAuth',
    label: '二次认证设置',
    fields: [{ name: 'required', label: '需要二次认证', type: 'switch' }],
  },
  {
    // 对齐 ecology hasNodePro / NodeFieldCheckBiz：节点级表单字段校验
    key: 'fieldCheck',
    label: '节点字段校验',
    fields: [
      {
        name: 'script',
        label: '校验规则',
        type: 'textarea',
        placeholder: '每行一条：字段:required / 字段:regex=^\\d+$ / 字段:min=1 / 字段:max=10',
      },
    ],
  },
];

/**
 * 「操作菜单」明细项（对齐 ecology 节点操作菜单：可改显示名、启停、调顺序、指定默认操作）。
 * 存储形态：settings.operateMenu = { items: [...], default?: key, menus: string[] }
 * 其中 `menus` 由 items 派生（启用项按显示顺序），保留旧语义供引擎 / 角标 / 摘要复用。
 */
export interface OperateMenuItem {
  key: string;
  name: string;
  enabled: boolean;
}

/**
 * 归一化操作菜单：兼容旧形态 { menus: string[] } 与明细形态 { items: [...] }。
 * 有 items 时以 items 的顺序/名称/启用为准，字典里新增的项补在后面（默认不启用）；
 * 只有旧 menus 时，启用项按 menus 顺序排前，其余按字典顺序。
 */
export const normalizeOperateMenu = (val: any): OperateMenuItem[] => {
  const base: OperateMenuItem[] = MENUS_OPTIONS.map((o) => ({
    key: String(o.value),
    name: o.label,
    enabled: false,
  }));
  const stored: any[] = Array.isArray(val?.items) ? val.items : [];
  const legacy: string[] = Array.isArray(val?.menus) ? val.menus.map(String) : [];

  if (stored.length) {
    const byKey = new Map(base.map((b) => [b.key, b]));
    const out: OperateMenuItem[] = [];
    stored.forEach((it) => {
      const k = String(it?.key ?? '');
      const b = byKey.get(k);
      if (!b) return;
      out.push({
        key: k,
        name: String(it?.name ?? b.name ?? k),
        enabled: it?.enabled !== false,
      });
      byKey.delete(k);
    });
    byKey.forEach((b) => out.push(b));
    return out;
  }

  base.forEach((b) => {
    b.enabled = legacy.includes(b.key);
  });
  const enabled = legacy
    .map((k) => base.find((b) => b.key === k))
    .filter((b): b is OperateMenuItem => !!b);
  const rest = base.filter((b) => !legacy.includes(b.key));
  return [...enabled, ...rest];
};

/** 由明细派生旧字段 menus（启用项按显示顺序） */
export const menusFromItems = (items: OperateMenuItem[]): string[] =>
  (items || []).filter((i) => i.enabled).map((i) => i.key);

/** 已启用操作的显示名（列表摘要 / 表格单元格用） */
export const operateMenuLabels = (val: any): string[] =>
  normalizeOperateMenu(val)
    .filter((m) => m.enabled)
    .map((m) => m.name || m.key);

/**
 * 「节点前/后附加操作」的单条明细（对齐 ecology E9 附加操作列表的一行：
 * 名称 + 操作类型 + 目标 + 内容 + 自定义脚本 + 执行失败时 + 备注）。
 */
export interface ExtraOperateItem {
  /** 稳定标识（列表 rowKey / 排序用） */
  key: string;
  /** 操作名称（E9 列表首列「节点前附加操作」显示的名称；留空则按类型/字段派生） */
  name?: string;
  type: string;
  target?: string;
  payload?: string;
  script?: string;
  failMode?: string;
  remark?: string;
  /** 未启用则不参与执行（缺省视为启用） */
  enabled?: boolean;
  /** 对齐 E9「退回时触发」列：勾选后，退回场景也会执行该条（缺省 false = 仅正常提交时执行） */
  triggerOnReject?: boolean;
}

/**
 * 节点前/后附加操作配置（对齐 ecology E9：**一个节点可挂多条附加操作，按顺序执行**）。
 *
 * 存储形态：settings[preOperate|postOperate] = { items, script, scriptOnReject }
 * 其中 script / scriptOnReject 是 items 的**派生字段**（启用项按序映射为多行命令），
 * 保留旧语义，使后端 WfNodeSettingsUtil / NodeActionExecutor 的读取路径保持简单。
 */
export interface ExtraOperateConfig {
  items: ExtraOperateItem[];
  /** 派生：正常提交时执行的多行命令（全部启用项，含勾选「退回时触发」的） */
  script?: string;
  /** 派生：退回时执行的多行命令（**仅**勾选「退回时触发」的启用项） */
  scriptOnReject?: string;
}

/** 归一化单条明细（兼容旧形态缺字段） */
const normalizeExtraItem = (v: any, idx: number): ExtraOperateItem => {
  const src = v || {};
  const script = typeof src.script === 'string' ? src.script : '';
  const type = typeof src.type === 'string' && src.type ? src.type : script ? 'script' : 'none';
  return {
    key: typeof src.key === 'string' && src.key ? src.key : `op_${idx}`,
    name: src.name ?? '',
    type,
    target: src.target ?? '',
    payload: src.payload ?? '',
    script,
    failMode: src.failMode ?? 'continue',
    remark: src.remark ?? '',
    enabled: src.enabled !== false,
    triggerOnReject: src.triggerOnReject === true,
  };
};

/** 单条是否已配置（决定是否保留 / 是否显示摘要） */
export const isExtraItemConfigured = (it: ExtraOperateItem): boolean => {
  if (it.type && it.type !== 'none') return true;
  return !!(it.target || it.payload || it.script);
};

/**
 * 归一化附加操作，兼容三种历史形态：
 * ① { items: [...] }（新，多条）② 单条对象 { type, target, ... } ③ 旧版 { script }。
 */
export const normalizeExtraOperate = (val: any): ExtraOperateConfig => {
  const v = val || {};
  const single = normalizeExtraItem(v, 0);
  const raw: any[] = Array.isArray(v.items) ? v.items : isExtraItemConfigured(single) ? [v] : [];
  const items = raw.map((it, i) => normalizeExtraItem(it, i)).filter(isExtraItemConfigured);
  return { items };
};

/**
 * 单条明细 → 可被后端 {@code WfActionExecutor} 执行的一条命令
 * （按前缀分派：http(s):// / sql: / dml: / field: / set:）。
 */
export const extraOperateCommand = (it: ExtraOperateItem): string => {
  const t = String(it.type || '');
  if (t === 'fieldAssign') return it.target ? `field:${it.target}=${it.payload ?? ''}` : '';
  if (t === 'updateTable') return it.payload ? `dml:${it.payload}` : '';
  // 自定义接口动作：target 存「接口动作标识」，执行时由后端反射调用注册的 Java 动作类
  if (t === 'customAction') return it.target ? `action:${it.target}` : '';
  if (t === 'callApi') return (it.target || '').trim();
  return (it.script || '').trim();
};

/** 操作类型字典名 */
const extraTypeLabel = (t: string): string =>
  EXTRA_OPERATE_TYPES.find((o) => String(o.value) === t)?.label ?? (t && t !== 'none' ? t : '');

/** E9 列表「节点前/后附加操作」列显示的名称：优先自定义名称，其次按类型派生（字段赋值显示「字段 = 值」） */
export const extraOperateLabel = (it: ExtraOperateItem): string => {
  const name = (it.name || '').trim();
  if (name) return name;
  if (it.type === 'fieldAssign') return `${it.target || '字段'} = ${it.payload || ''}`.trim();
  if (it.type === 'callApi') return it.target || extraTypeLabel(it.type);
  // 自定义接口动作：target 为接口动作标识
  if (it.type === 'customAction') return it.target || '自定义接口动作';
  return extraTypeLabel(it.type) || (it.script ? '自定义脚本' : '');
};

/** 由明细派生多行命令；onlyReject=true 时只取勾选「退回时触发」的启用项 */
const pickCommands = (items: ExtraOperateItem[], onlyReject: boolean): string =>
  (items || [])
    .filter((i) => i.enabled !== false && (!onlyReject || i.triggerOnReject === true))
    .map(extraOperateCommand)
    .filter((s) => !!s)
    .join('\n');

/** 正常提交时执行的多行 script（全部启用项，含勾选「退回时触发」的） */
export const extraOperateScript = (items: ExtraOperateItem[]): string => pickCommands(items, false);

/** 退回时执行的多行 script（仅勾选「退回时触发」的启用项） */
export const extraOperateRejectScript = (items: ExtraOperateItem[]): string => pickCommands(items, true);

/** 组装最终落库结构：items + 派生 script / scriptOnReject */
export const buildExtraOperateConfig = (items: ExtraOperateItem[]): ExtraOperateConfig => {
  const cleaned = (items || []).map((i) => ({
    ...i,
    enabled: i.enabled !== false,
    triggerOnReject: i.triggerOnReject === true,
  }));
  return {
    items: cleaned,
    script: extraOperateScript(cleaned),
    scriptOnReject: extraOperateRejectScript(cleaned),
  };
};

/** 附加操作是否已配置（用于画布角标 / 列表绿勾） */
export const isExtraOperateConfigured = (val: any): boolean =>
  normalizeExtraOperate(val).items.length > 0;

/** 附加操作条数 */
export const extraOperateCount = (val: any): number => normalizeExtraOperate(val).items.length;

/** 附加操作一句话摘要（表格单元格展示）：字段赋值显示「字段 = 值」，其余按类型；多条显示「XXX 等 N 项」 */
export const extraOperateSummary = (val: any): string => {
  const { items } = normalizeExtraOperate(val);
  if (!items.length) return '';
  const brief = (it: ExtraOperateItem): string => {
    const name = (it.name || '').trim();
    const desc = (it.payload || it.script || it.target || '').trim().replace(/\s+/g, ' ');
    if (name) return name;
    if (it.type === 'fieldAssign') return `${it.target || '字段'} = ${it.payload || ''}`.trim();
    const typeLabel = extraTypeLabel(it.type) || (it.script ? '脚本' : '');
    if (!typeLabel) return desc.slice(0, 12);
    if (!desc) return typeLabel;
    return `${typeLabel}：${desc.length > 12 ? `${desc.slice(0, 12)}…` : desc}`;
  };
  if (items.length === 1) return brief(items[0]);
  return `${brief(items[0])} 等 ${items.length} 项`;
};

/** 解析节点 extJson（坏数据兜底为空对象） */
export const parseExt = (node?: WfProcessNode | null): Record<string, any> => {
  try {
    return node?.extJson ? JSON.parse(node.extJson) : {};
  } catch {
    return {};
  }
};

/** 读取某节点的 settings 对象 */
export const nodeSettings = (node?: WfProcessNode | null): Record<string, any> =>
  parseExt(node).settings || {};

/**
 * 基于节点 extJson 改 settings 后重建 extJson 字符串。
 * 兼容旧的顶层 timeoutHours / remind / sign 字段（引擎侧仍在读）。
 */
export const buildExtJson = (
  node: WfProcessNode,
  mutate: (settings: Record<string, any>) => void,
): string => {
  const ext = parseExt(node);
  const settings = { ...(ext.settings || {}) };
  mutate(settings);
  return JSON.stringify({
    timeoutHours: settings?.timeout?.hours || 0,
    remind: settings?.timeout?.remind ? 1 : 0,
    sign: ext.sign ? 1 : 0,
    settings: settings || {},
  });
};

/** 该设置项是否已配置（列表里打勾用） */
export const isSettingConfigured = (def: SettingDef, val: any): boolean => {
  if (val == null) return false;
  return def.fields.some((f) => {
    const fv = val[f.name];
    if (f.type === 'switch') return fv === true || fv === 1 || fv === '1';
    if (Array.isArray(fv)) return fv.length > 0;
    return fv !== '' && fv != null && fv !== 0;
  });
};

/** 设置项的一句话摘要（列表单元格展示） */
export const settingSummary = (def: SettingDef, val: any): string => {
  if (val == null) return '';
  const parts: string[] = [];
  def.fields.forEach((f) => {
    const fv = val[f.name];
    if (fv == null || fv === '' || fv === false) return;
    if (Array.isArray(fv) && !fv.length) return;
    if (f.type === 'switch') {
      if (fv === true || fv === 1 || fv === '1') parts.push(f.label);
      return;
    }
    // 数组但无静态选项（如 nodeMultiSelect，选项来自节点列表）：直接拼原始值
    if (Array.isArray(fv) && !f.options) {
      parts.push(fv.join('/'));
      return;
    }
    if (f.options) {
      if (Array.isArray(fv)) {
        parts.push(fv.map((x) => f.options?.find((o) => o.value === x)?.label ?? String(x)).join('/'));
      } else {
        parts.push(f.options.find((o) => o.value === fv)?.label ?? String(fv));
      }
      return;
    }
    const s = String(fv);
    parts.push(s.length > 10 ? `${s.slice(0, 10)}…` : s);
  });
  return parts.join('，');
};

/**
 * 画布节点角标：返回该节点**已配置**、需要在画布上可视提醒的设置项短标签。
 * 对齐 E9 checkIsChangCellIcon（配置项在画布节点上以图标/角标回写）。
 */
export const configuredBadges = (node?: WfProcessNode | null): string[] => {
  const s = nodeSettings(node);
  const out: string[] = [];
  if (isExtraOperateConfigured(s.preOperate)) out.push('前附加操作');
  if (isExtraOperateConfigured(s.postOperate)) out.push('后附加操作');
  if (s.timeout?.hours > 0) out.push('超时设置');
  if (s.subflow?.flowKey) out.push('子流程');
  if (s.appointFlow?.mode) out.push('指定流转');
  if (Array.isArray(s.operateMenu?.menus) && s.operateMenu.menus.length) out.push('操作菜单');
  if (s.secondAuth?.required) out.push('二次认证');
  if (s.fieldCheck?.script) out.push('字段校验');
  return out;
};
