/**
 * bpmn-js 画布中文国际化。
 *
 * bpmn-js / diagram-js / properties-panel 的文案统一由注入的 `translate` 服务产出，
 * 这里用自定义模块覆盖该服务，把英文文案替换为中文。
 * 用法：把 default 导出的模块放进 BpmnJS 的 additionalModules（放在最后以覆盖内置实现）。
 *
 * 注意：词条键**区分大小写**，必须与 bpmn-js 源码中的原文完全一致
 * （例如是 'Create start event' 而不是 'Create Start Event'）。
 * 为避免大小写差异导致漏翻，customTranslate 额外做了不区分大小写的兜底匹配。
 */

const translations: Record<string, string> = {
  // ───────── 工具栏 Palette（键名取自 bpmn-js/lib/features/palette/PaletteProvider.js）─────────
  'Activate hand tool': '激活抓手工具',
  'Activate lasso tool': '激活套索工具',
  'Activate create/remove space tool': '激活创建/删除空间工具',
  'Activate global connect tool': '激活全局连接工具',
  'Create start event': '创建开始事件',
  'Create intermediate/boundary event': '创建中间/边界事件',
  'Create end event': '创建结束事件',
  'Create gateway': '创建网关',
  'Create task': '创建任务',
  'Create user task': '创建用户任务',
  'Create data object reference': '创建数据对象',
  'Create data store reference': '创建数据存储',
  'Create expanded sub-process': '创建展开的子流程',
  'Create pool/participant': '创建池/参与者',
  'Create group': '创建分组',
  'Create text annotation': '创建文本注解',

  // ───────── 右键菜单 Context Pad（取自 ContextPadProvider.js）─────────
  'Append end event': '追加结束事件',
  'Append gateway': '追加网关',
  'Append task': '追加任务',
  'Append user task': '追加用户任务',
  'Append receive task': '追加接收任务',
  'Append message intermediate catch event': '追加消息中间捕获事件',
  'Append timer intermediate catch event': '追加定时中间捕获事件',
  'Append conditional intermediate catch event': '追加条件中间捕获事件',
  'Append signal intermediate catch event': '追加信号中间捕获事件',
  'Append intermediate/boundary event': '追加中间/边界事件',
  'Append compensation activity': '追加补偿活动',
  'Add text annotation': '添加文本注解',
  'Connect to other element': '连接到其他元素',
  'Connect using association': '用关联连接',
  'Connect using data input association': '用数据输入关联连接',
  'Change element': '更改元素',
  'Add lane above': '在上方添加泳道',
  'Add lane below': '在下方添加泳道',
  'Divide into two lanes': '拆分为两条泳道',
  'Divide into three lanes': '拆分为三条泳道',
  Delete: '删除',
  Remove: '移除',

  // ───────── 替换菜单 Replace / 元素类型 ─────────
  'Replace with': '替换为',
  'Start Event': '开始事件',
  'Intermediate Throw Event': '中间抛出事件',
  'Intermediate Catch Event': '中间捕获事件',
  'End Event': '结束事件',
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
  'Sub-process (collapsed)': '子流程（折叠）',
  'Sub-process (expanded)': '子流程（展开）',
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
  'Sequence Flow': '顺序流',
  'Message Flow': '消息流',
  Association: '关联',

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
  'Copy element': '复制元素',
  'Paste element': '粘贴元素',

  // ───────── 属性面板常用项 ─────────
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
  Assignee: '办理人',
  'Candidate Users': '候选用户',
  'Candidate Groups': '候选组',
  'Due Date': '到期日',
  'Follow Up Date': '跟进日期',
  'User Assignment': '用户分配',
  Scripts: '脚本',
  Script: '脚本',
  'Script Format': '脚本格式',
  'Script Type': '脚本类型',
  'Inline Script': '内联脚本',
  'External Resource': '外部资源',
  Resource: '资源',
  'Field Injections': '字段注入',
  'Add Property': '添加属性',
  'Add Entry': '添加条目',
  'Remove Entry': '删除条目',
  'No properties to display': '没有可显示的属性',
  'Specify a name': '请输入名称',
  'Specify an id': '请输入编号',
};

/** 小写索引，用于大小写不敏感的兜底匹配 */
const lowerIndex: Record<string, string> = {};
Object.keys(translations).forEach((key) => {
  const lower = key.toLowerCase();
  if (!(lower in lowerIndex)) {
    lowerIndex[lower] = translations[key];
  }
});

/**
 * 自定义翻译函数：
 * 1) 先精确匹配，再按小写兜底匹配，都没命中则原样返回英文；
 * 2) 替换 {xxx} 占位符为实际值（占位符的取值若也在词条表中则一并翻译）。
 */
export function customTranslate(
  template: string,
  replacements?: Record<string, any>,
): string {
  let result: string =
    translations[template] || lowerIndex[template.toLowerCase()] || template;

  if (replacements) {
    result = result.replace(/{([^}]+)}/g, (_match: string, key: string) => {
      const value = replacements[key];
      if (value === undefined || value === null) return `{${key}}`;
      const strValue = String(value);
      return translations[strValue] || lowerIndex[strValue.toLowerCase()] || strValue;
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
