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
  export const BpmnPropertiesProviderModule: any;
}

declare module 'bpmn-js/dist/assets/diagram-js.css';
declare module 'bpmn-js/dist/assets/bpmn-js.css';
declare module 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
declare module '@bpmn-io/properties-panel/dist/assets/properties-panel.css';
