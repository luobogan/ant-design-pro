/**
 * bpmn-js 族库未随包提供 TS 类型，这里做最小模块声明，供 TS 编译通过。
 * 运行时由 Umi/Webpack 解析真实 JS 模块。
 */

declare module 'bpmn-js/lib/Modeler' {
  const BpmnJS: any;
  export default BpmnJS;
}

declare module 'bpmn-js-properties-panel' {
  export const BpmnPropertiesPanelModule: any;
  /** 平铺 BPMN 属性提供者（只有 常规/文档 等基础分组） */
  export const BpmnPropertiesProviderModule: any;
  /** Camunda 平台属性提供者：常规 / 表单 / 分配 / 任务 / 多实例 / 执行监听器 / 任务监听器 / 扩展属性 … */
  export const CamundaPlatformPropertiesProviderModule: any;
  export const ZeebePropertiesProviderModule: any;
  export const useService: any;
}

/** Camunda BPMN moddle 描述符（JSON），配合 CamundaPlatformPropertiesProviderModule 使用 */
declare module 'camunda-bpmn-moddle/resources/camunda.json' {
  const descriptor: any;
  export default descriptor;
}

declare module 'bpmn-js/dist/assets/diagram-js.css';
declare module 'bpmn-js/dist/assets/bpmn-js.css';
declare module 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
declare module '@bpmn-io/properties-panel/dist/assets/properties-panel.css';
