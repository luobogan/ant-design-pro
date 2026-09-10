/**
 * bpmn-js 画布中文国际化。
 *
 * bpmn-js / diagram-js 的文案统一由注入的 `translate` 服务产出，
 * 这里用自定义模块覆盖该服务，把英文文案替换为中文。
 * 用法：把 default 导出的模块放进 BpmnJS 的 additionalModules 即可。
 *
 * 说明：键为 bpmn-js 内部的原始英文串；未命中的键会原样返回英文，
 * 因此词条表不必穷举，缺哪个补哪个即可。
 */

const translations: Record<string, string> = {
  // ───────── 工具栏（Palette）─────────
  'Activate the hand tool': '激活抓手工具',
  'Activate the lasso tool': '激活套索工具',
  'Activate the global connect tool': '激活全局连接工具',
  'Activate the create/remove space tool': '激活创建/删除空间工具',
  'Activate the direct editing': '激活直接编辑',
  'Create Start Event': '创建开始事件',
  'Create Intermediate/Boundary Event': '创建中间/边界事件',
  'Create End Event': '创建结束事件',
  'Create Gateway': '创建网关',
  'Create User Task': '创建用户任务',
  'Create Service Task': '创建服务任务',
  'Create Task': '创建任务',
  'Create Sub-process (collapsed)': '创建子流程（折叠）',
  'Create Sub-process (expanded)': '创建子流程（展开）',
  'Create expanded Sub-process': '创建展开的子流程',
  'Create Event Sub-process': '创建事件子流程',
  'Create Pool/Participant': '创建池/参与者',
  'Create Group': '创建分组',
  'Create Data Object': '创建数据对象',
  'Create Data Store': '创建数据存储',
  'Create Text Annotation': '创建文本注解',

  // ───────── 元素上下文菜单（Context Pad）─────────
  'Append end event': '追加结束事件',
  'Append gateway': '追加网关',
  'Append activity': '追加活动',
  'Append Task': '追加任务',
  'Append User Task': '追加用户任务',
  'Append intermediate/boundary event': '追加中间/边界事件',
  'Append text annotation': '追加文本注解',
  'Append compensation activity': '追加补偿活动',
  'Connect element': '连接元素',
  'Change type': '更改类型',
  'Change element': '更改元素',
  'Add marker': '添加标记',
  Remove: '删除',
  Delete: '删除',

  // ───────── 替换菜单（Replace / Popup Menu）─────────
  'Replace with': '替换为',
  'Start Event': '开始事件',
  'End Event': '结束事件',
  'Intermediate Throw Event': '中间抛出事件',
  'Intermediate Catch Event': '中间捕获事件',
  'Boundary Event': '边界事件',
  Task: '任务',
  'User Task': '用户任务',
  'Service Task': '服务任务',
  'Send Task': '发送任务',
  'Receive Task': '接收任务',
  'Script Task': '脚本任务',
  'Business Rule Task': '业务规则任务',
  'Manual Task': '手工任务',
  'Call Activity': '调用活动',
  'Sub-process': '子流程',
  'Event Sub-process': '事件子流程',
  Transaction: '事务',
  'Exclusive Gateway': '排他网关',
  'Parallel Gateway': '并行网关',
  'Inclusive Gateway': '包容网关',
  'Complex Gateway': '复杂网关',
  'Event Based Gateway': '事件网关',
  Participant: '参与者',
  Pool: '池',
  Group: '分组',
  'Text Annotation': '文本注解',
  'Data Object': '数据对象',
  'Data Store Reference': '数据存储引用',

  // 连接线
  'Sequence Flow': '顺序流',
  'Message Flow': '消息流',
  Association: '关联',
  'Data Association': '数据关联',

  // ───────── 通用操作 ─────────
  Undo: '撤销',
  Redo: '重做',
  'Zoom in': '放大',
  'Zoom out': '缩小',
  'Zoom to fit': '自适应缩放',
  'Zoom to actual size': '实际大小',
  'Reset zoom': '重置缩放',
  'Align elements': '对齐元素',
  'Align elements left': '左对齐',
  'Align elements right': '右对齐',
  'Align elements top': '顶部对齐',
  'Align elements bottom': '底部对齐',
  'Align elements center': '垂直居中对齐',
  'Align elements middle': '水平居中对齐',
  'Distribute elements horizontally': '水平等距分布',
  'Distribute elements vertically': '垂直等距分布',
  'Move element': '移动元素',
  'Resize element': '调整元素大小',
  'Show mini-map': '显示缩略图',
  'Hide mini-map': '隐藏缩略图',
  'Select element': '选择元素',
  'Direct editing': '直接编辑',

  // ───────── 属性面板（Properties Panel）常用项 ─────────
  General: '常规',
  Documentation: '文档',
  Id: '编号',
  Name: '名称',
  Process: '流程',
  'Process Id': '流程编号',
  'Process Name': '流程名称',
  'Version Tag': '版本标签',
  Executable: '可执行',
  'Extension Properties': '扩展属性',
  'Extension Elements': '扩展元素',
  'Execution Listeners': '执行监听器',
  'Asynchronous Continuations': '异步延续',
  'Asynchronous Before': '前置异步',
  'Asynchronous After': '后置异步',
  Exclusive: '独占',
  'Job Configuration': '作业配置',
  'Job Priority': '作业优先级',
  'Retry Time Cycle': '重试周期',
  'Candidate Starter Configuration': '候选启动者配置',
  'Candidate Starter Groups': '候选启动组',
  'Candidate Starter Users': '候选启动用户',
  Forms: '表单',
  'Form Key': '表单标识',
  'Form Fields': '表单字段',
  'Form Reference': '表单引用',
  Input: '输入',
  Output: '输出',
  'Input Data': '输入数据',
  'Output Data': '输出数据',
  Conditions: '条件',
  'Condition Expression': '条件表达式',
  Timer: '定时器',
  'Timer Definition': '定时器定义',
  'Timer Definition Type': '定时器定义类型',
  Message: '消息',
  'Message Reference': '消息引用',
  Signal: '信号',
  'Signal Reference': '信号引用',
  Error: '错误',
  'Error Reference': '错误引用',
  Escalation: '升级',
  'Escalation Reference': '升级引用',
  Compensation: '补偿',
  'Start Initiator': '启动发起人',
  'History Time To Live': '历史数据保留时长',
  'External Task Configuration': '外部任务配置',
  'External Task Topic': '外部任务主题',
  'External Task Priority': '外部任务优先级',
  Connectors: '连接器',
  Connector: '连接器',
  'Multi Instance': '多实例',
  'Element Documentation': '元素文档',
  'Business Key': '业务键',
  'Task Listener': '任务监听器',
  'Task Priority': '任务优先级',
  'Assignee': '办理人',
  'Candidate Users': '候选用户',
  'Candidate Groups': '候选组',
  'Due Date': '到期日',
  'Follow Up Date': '跟进日期',
  'User Assignment': '用户分配',
  'Scripts': '脚本',
  'Script': '脚本',
  'Script Format': '脚本格式',
  'Script Type': '脚本类型',
  'Inline Script': '内联脚本',
  'External Resource': '外部资源',
  'Resource': '资源',
  'Field Injections': '字段注入',
  'Add Property': '添加属性',
  'Add Entry': '添加条目',
  'Remove Entry': '删除条目',
  'No properties to display': '没有可显示的属性',
  'Specify a name': '请输入名称',
  'Specify an id': '请输入编号',
};

/**
 * 自定义翻译函数：命中词条表则替换，并把 {xxx} 占位符替换为实际值。
 */
export function customTranslate(
  template: string,
  replacements?: Record<string, any>,
): string {
  let result: string = translations[template] || template;

  if (replacements) {
    result = result.replace(/{([^}]+)}/g, (_match: string, key: string) => {
      const value = replacements[key];
      return value === undefined || value === null ? `{${key}}` : String(value);
    });
  }

  return result;
}

/**
 * 覆盖 bpmn-js 的 translate 服务（didi 注入：以 value 形式提供函数）。
 */
const customTranslateModule: any = {
  translate: ['value', customTranslate],
};

export default customTranslateModule;
