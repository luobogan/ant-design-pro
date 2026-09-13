/**
 * 流程设计器共用字典与常量。
 *
 * 节点信息列表化后，NodeInfoPanel / NodeMoreModal / LinkInfoPanel 都会用到这些枚举，
 * 集中在此避免各面板重复定义、取值漂移（语义对齐 ecology 的 workflow 字典）。
 */

/** 通用字典项（value 允许数字或字符串：节点类型为数字，操作菜单/表单内容为字符串） */
export interface DictItem {
  value: any;
  label: string;
}

/** 节点类型 */
export const NODE_TYPES: DictItem[] = [
  { value: 0, label: '创建' },
  { value: 1, label: '审批' },
  { value: 2, label: '提交' },
  { value: 3, label: '归档' },
  { value: 5, label: '等待' },
  { value: 6, label: '自动处理' },
];

/** 审批方式 */
export const SIGN_ORDERS: DictItem[] = [
  { value: 0, label: '或签' },
  { value: 1, label: '会签' },
  { value: 2, label: '依次' },
  { value: 3, label: '抄送不需提交' },
  { value: 4, label: '抄送需提交' },
];

/** 分叉/合并类型 */
export const MERGE_TYPES: DictItem[] = [
  { value: 0, label: '普通' },
  { value: 1, label: '分叉起点' },
  { value: 2, label: '分叉中间' },
  { value: 3, label: '按分支数合并' },
  { value: 4, label: '指定分支合并' },
  { value: 5, label: '比例合并' },
];

/** 操作者对象类型（对齐 ecology OperatorDBType） */
export const OP_TYPES: DictItem[] = [
  { value: 3, label: '人员' },
  { value: 1, label: '部门' },
  { value: 2, label: '角色' },
  { value: 58, label: '岗位' },
  { value: 4, label: '所有人' },
  { value: 17, label: '创建人本人' },
  { value: 18, label: '创建人上级' },
  { value: 19, label: '本部门' },
];

/** 操作者范围（不含下级 / 含下级 …） */
export const BHXJ: DictItem[] = [
  { value: 0, label: '本部' },
  { value: 1, label: '含下级' },
  { value: 2, label: '含上级' },
  { value: 3, label: '逐级向上' },
];

/** 节点「操作菜单」可选操作（对齐 ecology 节点操作菜单设置） */
export const MENUS_OPTIONS: DictItem[] = [
  { value: 'submit', label: '提交' },
  { value: 'reject', label: '退回' },
  { value: 'forward', label: '转办' },
  { value: 'sign', label: '加签' },
  { value: 'opinion', label: '填写意见' },
  { value: 'attach', label: '附件' },
  { value: 'print', label: '打印' },
  { value: 'urge', label: '催办' },
];

/** 节点「前/后附加操作」类型（对齐 ecology 节点前后附加操作） */
export const EXTRA_OPERATE_TYPES: DictItem[] = [
  { value: 'none', label: '无' },
  { value: 'fieldAssign', label: '字段赋值' },
  { value: 'updateTable', label: '更新业务表' },
  { value: 'callApi', label: '调用接口' },
  { value: 'sendMsg', label: '发送消息' },
  { value: 'script', label: '自定义脚本' },
];

/** 附加操作执行失败时的处理（对齐 ecology 附加操作失败处理） */
export const FAIL_MODES: DictItem[] = [
  { value: 'continue', label: '继续' },
  { value: 'stop', label: '中断' },
];

/** 节点「表单内容」显示模式（对齐 ecology 节点表单内容） */
export const FORM_CONTENT_OPTIONS: DictItem[] = [
  { value: 'normal', label: '普通模式' },
  { value: 'custom', label: '节点布局' },
];

/**
 * 「指定流转」模式位（对齐 ecology `SelectNextFlowMode`）。
 * 1 = 用户指定节点和操作者；2 = 用户指定节点、操作者取节点设置。
 */
export const SELECT_NEXT_FLOW_MODES: DictItem[] = [
  { value: 1, label: '指定节点和操作者' },
  { value: 2, label: '仅指定节点' },
];

/** 字段权限：0隐藏 1只读 2可编辑 3必填（对齐 ecology fieldattr） */
export const PERM_OPTIONS: DictItem[] = [
  { value: 0, label: '隐藏' },
  { value: 1, label: '只读' },
  { value: 2, label: '可编辑' },
  { value: 3, label: '必填' },
];

export const dictLabel = (dict: DictItem[], value: any, fallback = '-') =>
  dict.find((d) => d.value === value)?.label ?? fallback;

/** 字段作用域展示名：main → 主表，dt1 → 明细表1 */
export const scopeLabel = (s: string) =>
  s === 'main' ? '主表' : `明细表${String(s).replace('dt', '')}`;
