import { WfProcessNode } from '@/services/workflow';
import { MENUS_OPTIONS, SELECT_NEXT_FLOW_MODES } from './wfDict';

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
    fields: [
      { name: 'script', label: '操作说明', type: 'textarea', placeholder: '如：业务校验 / 字段赋值 / 调用接口' },
    ],
  },
  {
    key: 'postOperate',
    label: '节点后附加操作',
    fields: [
      { name: 'script', label: '操作说明', type: 'textarea', placeholder: '如：更新业务表 / 发送通知' },
    ],
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
  if (s.preOperate?.script) out.push('前附加操作');
  if (s.postOperate?.script) out.push('后附加操作');
  if (s.timeout?.hours > 0) out.push('超时设置');
  if (s.subflow?.flowKey) out.push('子流程');
  if (s.appointFlow?.mode) out.push('指定流转');
  if (Array.isArray(s.operateMenu?.menus) && s.operateMenu.menus.length) out.push('操作菜单');
  if (s.secondAuth?.required) out.push('二次认证');
  if (s.fieldCheck?.script) out.push('字段校验');
  return out;
};
