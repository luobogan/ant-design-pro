/**
 * 当前活动画布的 bpmn-js 模型器持有器（模块级单例）。
 *
 * 用途：面板（NodeDetail / 各类 Modal）无需经过 React 属性层层透传，即可按 `nodeKey`
 * 用 `elementRegistry.get(nodeKey)` 取到对应 bpmn-js 元素，从而读写其 `wf:` 扩展。
 *
 * BpmnDesigner 初始化时 `setActiveModeler(modeler)`、销毁时 `setActiveModeler(null)`。
 * 取用前务必判空（画布未就绪时返回 null）。
 */

let activeModeler: any = null;

export const setActiveModeler = (modeler: any): void => {
  activeModeler = modeler;
};

export const getActiveModeler = (): any => activeModeler;
