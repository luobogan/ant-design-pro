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
  /** 下拉中置灰不可选（用于「暂时屏蔽」某选项，同时保留存量值的正确回显） */
  disabled?: boolean;
}

/** 节点类型 */
export const NODE_TYPES: DictItem[] = [
  { value: 0, label: '创建' },
  { value: 1, label: '审批' },
  { value: 2, label: '提交' },
  { value: 3, label: '归档' },
  { value: 5, label: '等待' },
  { value: 6, label: '自动处理' },
  // 网关：saveBpmn 会把画布网关也建成节点，使「节点→网关」「网关→节点」每条物理连线
  // 各存一条出口（不再折叠成「节点→节点」），每条线都能独立查看 / 配置出口信息。
  { value: 7, label: '网关' },
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

/**
 * 节点「操作菜单」可选操作（对齐 ecology 节点操作菜单设置）。
 *
 * ⚠️ 后端只认 code（字符串），新增操作只需在此登记 + 对应页面实现按钮；
 * 「保存」= 只把表单存下来、不提交不推进（ecology 新建流程的「保存」语义）。
 */
export const MENUS_OPTIONS: DictItem[] = [
  { value: 'submit', label: '提交' },
  { value: 'save', label: '保存' },
  { value: 'reject', label: '退回' },
  { value: 'forward', label: '转发' },
  { value: 'forwardRetract', label: '转发收回' },
  { value: 'transfer', label: '转办' },
  { value: 'deliver', label: '转交' },
  { value: 'sign', label: '加签' },
  { value: 'circulate', label: '传阅' },
  { value: 'circulateFb', label: '传阅（需反馈）' },
  { value: 'circulateNoFb', label: '传阅（不需反馈）' },
  { value: 'consult', label: '意见征询' },
  { value: 'consultFb', label: '意见征询（需反馈）' },
  { value: 'consultNoFb', label: '意见征询（不需反馈）' },
  { value: 'consultReply', label: '征询回复' },
  { value: 'consultRetract', label: '征询收回' },
  { value: 'consultTransfer', label: '征询转办' },
  { value: 'opinion', label: '填写意见' },
  { value: 'attach', label: '附件' },
  { value: 'print', label: '打印' },
  { value: 'printLog', label: '打印日志' },
  { value: 'urge', label: '催办' },
  { value: 'timeoutSet', label: '超时设置' },
  { value: 'flowSet', label: '流转设定' },
  { value: 'submitToReject', label: '提交至退回节点' },
  { value: 'read', label: '查看' },
  { value: 'withdraw', label: '撤回' },
  { value: 'stop', label: '终止' },
  { value: 'custom', label: '自定义操作' },
];

/**
 * 节点「操作菜单」的**默认启用项**（新建节点 / 未配置时的预勾选，以及弹窗「恢复默认」）。
 *
 * <p>取值 = 提交 + 保存 + 退回 + 转发：对齐 ecology 新建流程的常规动作集
 * （可先保存草稿、可转交他人、可退回、最终提交）。其余操作默认不启用，按需在弹窗里勾选。</p>
 *
 * ⚠️ 顺序即显示顺序（菜单弹窗里可再拖动调整；置顶按钮把选中项移到最前）。
 */
export const DEFAULT_MENUS: string[] = ['submit', 'save', 'reject', 'forward'];

/** 节点「前/后附加操作」类型（对齐 ecology 节点前后附加操作） */
export const EXTRA_OPERATE_TYPES: DictItem[] = [
  { value: 'none', label: '无' },
  { value: 'fieldAssign', label: '字段赋值' },
  // 对齐 E9「外部接口 → 自定义接口动作」：选用「注册自定义接口」里登记的 Java 动作类
  { value: 'customAction', label: '自定义接口动作' },
  { value: 'updateTable', label: '更新业务表' },
  { value: 'callApi', label: '调用接口(HTTP)' },
  { value: 'sendMsg', label: '发送消息' },
  { value: 'script', label: '自定义脚本' },
];

/** 附加操作执行失败时的处理（对齐 ecology 附加操作失败处理） */
export const FAIL_MODES: DictItem[] = [
  { value: 'continue', label: '继续' },
  { value: 'stop', label: '中断' },
];

/**
 * 「流程异常处理」的流转兜底方式（对齐 ecology `exceptionHandleWay`）。
 *
 * <p>语义 = <b>下一节点解析不到操作者时怎么办</b>，与「附加操作失败策略」（{@link FAIL_MODES}）
 * 是不同的两件事，二者共存于 `settings.exceptionHandle` 对象内：`way/enabled/targetNodeKey` 管流转兜底，
 * `mode` 管附加操作失败策略。</p>
 */
export const EXCEPTION_FALLBACK_WAYS: DictItem[] = [
  { value: 1, label: '自动流转至下一节点' },
  { value: 2, label: '提交至指定节点' },
  { value: 3, label: '由用户指定操作者' },
];

/**
 * 意见类型选项（对齐 ecology `viewtype_*` 系列）。
 *
 * <p>两处复用：① 节点「意见显示类型」开关（`settings.formContent.vt`，见第十三章）；
 * ② 打印「显示类型」（`settings.printSet.viewType`，额外支持 {@link PRINT_VIEW_TYPE_OLD}）。</p>
 *
 * <p>`value` 即 ecology 的键名（去掉 `viewtype_` 前缀前的语义），保持与后端一致。</p>
 */
export const OPINION_TYPE_OPTIONS: DictItem[] = [
  { value: 'approve', label: '提交' },
  { value: 'realize', label: '批准' },
  { value: 'forward', label: '转发' },
  { value: 'postil', label: '转发批注' },
  { value: 'handleForward', label: '转办' },
  { value: 'takingOpinions', label: '意见征询' },
  { value: 'tpostil', label: '意见征询回复' },
  { value: 'takForward', label: '征询转办' },
  { value: 'endTak', label: '结束征询' },
  { value: 'recipient', label: '抄送' },
  { value: 'rpostil', label: '抄送批注' },
  { value: 'reject', label: '退回' },
  { value: 'superintend', label: '督办' },
  { value: 'over', label: '强制归档' },
  { value: 'intervenor', label: '流程干预' },
  { value: 'chuanyue', label: '传阅' },
  { value: 'chuanyueRec', label: '传阅批注' },
  { value: 'withdraw', label: '撤回' },
];

/** 打印显示类型的特殊值（对齐 ecology `printviewtype=oldvalue`：沿用显示模板的显示类型） */
export const PRINT_VIEW_TYPE_OLD = 'oldvalue';

/**
 * 打印流转意见（对齐 ecology `printflowcomment`）。
 *
 * <p>0 = 始终不打印；1 = 流转意见放入模板时不打印（默认）；2 = 始终打印。</p>
 */
export const PRINT_FLOW_COMMENTS: DictItem[] = [
  { value: 0, label: '始终不打印' },
  { value: 1, label: '流转意见放入模板时不打印' },
  { value: 2, label: '始终打印' },
];

/** 打印意见显示方式（对齐 ecology `printshowtype`）：0 只显示最后一次 / 1 显示全部 */
export const PRINT_SHOW_TYPES: DictItem[] = [
  { value: 0, label: '只显示最后一次签字意见' },
  { value: 1, label: '显示全部签字意见' },
];

/** 打印意见分栏列数（对齐 ecology `PRINTREMARKCOLUMN`）：1 / 2 / 3 */
export const PRINT_REMARK_COLUMNS: DictItem[] = [
  { value: 1, label: '1 列' },
  { value: 2, label: '2 列' },
  { value: 3, label: '3 列' },
];

/**
 * 节点「表单内容」显示模式（对齐 ecology 节点表单内容）。
 *
 * ⚠️ 本系统**暂时屏蔽「普通模式」**：仍保留下拉项（否则存量节点存的 `normal` 会回显成
 * 英文原文），但置灰不可选。需要恢复时：把该项 `disabled` 去掉、label 改回「普通模式」即可。
 */
export const FORM_CONTENT_OPTIONS: DictItem[] = [
  { value: 'normal', label: '普通模式（已屏蔽）', disabled: true },
  { value: 'custom', label: '节点布局' },
];

/**
 * 「指定流转」模式位（对齐 ecology `SelectNextFlowMode`）。
 * 1 = 用户指定节点和操作者；2 = 用户指定节点、操作者取节点设置。
 */
export const SELECT_NEXT_FLOW_MODES: DictItem[] = [
  { value: 1, label: '指定节点和操作者' },
  { value: 2, label: '仅指定节点' },
  { value: 3, label: '多目标（并行扇出）' },
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
