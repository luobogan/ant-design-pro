import React, { useEffect, useRef } from 'react';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import './flowDiagram.css';

/**
 * 只读流程图画布（流程测试右侧「流程图」页签）
 *
 * 用 bpmn-js 的 NavigatedViewer（无建模能力、无工具栏）渲染流程定义的 BPMN，
 * 并按测试结果在节点上叠加标记：
 *   - wf-test-pass    走通（绿）
 *   - wf-test-fail    走不通（红）
 *   - wf-test-current 当前查看节点（蓝虚线）
 * 点击节点回调 onSelectNode，与左侧节点列表 / 表单页签联动。
 */

const NODE_TYPES = [
  'bpmn:StartEvent',
  'bpmn:UserTask',
  'bpmn:EndEvent',
  'bpmn:IntermediateCatchEvent',
  'bpmn:IntermediateThrowEvent',
  'bpmn:BoundaryEvent',
  'bpmn:ServiceTask',
  'bpmn:Task',
  'bpmn:ManualTask',
  'bpmn:ReceiveTask',
  'bpmn:SendTask',
  'bpmn:ScriptTask',
  'bpmn:BusinessRuleTask',
  'bpmn:CallActivity',
  'bpmn:SubProcess',
  'bpmn:Transaction',
  'bpmn:ExclusiveGateway',
  'bpmn:ParallelGateway',
  'bpmn:InclusiveGateway',
  'bpmn:EventBasedGateway',
  'bpmn:ComplexGateway',
];

const isNodeElement = (el: any): boolean =>
  !!el && !el.labelTarget && NODE_TYPES.indexOf(el?.businessObject?.$type) >= 0;

export interface FlowDiagramProps {
  bpmnXml?: string;
  /** nodeKey -> 节点状态：1走通 2走不通 */
  nodeStatus?: Record<string, number>;
  /** 当前查看节点（高亮为蓝虚线） */
  currentNodeKey?: string;
  /** 点节点回调（传出 nodeKey） */
  onSelectNode?: (nodeKey?: string) => void;
  height?: number;
}

const FlowDiagram: React.FC<FlowDiagramProps> = ({
  bpmnXml,
  nodeStatus,
  currentNodeKey,
  onSelectNode,
  height = 420,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const markedRef = useRef<{ id: string; cls: string }[]>([]);

  // 回调放 ref，避免事件闭包捕获过期引用
  const cbRef = useRef(onSelectNode);
  cbRef.current = onSelectNode;

  const propsRef = useRef({ nodeStatus, currentNodeKey });
  propsRef.current = { nodeStatus, currentNodeKey };

  /** 清掉旧标记再按最新结果叠加 */
  const applyMarkers = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    let canvas: any;
    try {
      canvas = viewer.get('canvas');
    } catch {
      return;
    }
    markedRef.current.forEach(({ id, cls }) => {
      try {
        canvas.removeMarker(id, cls);
      } catch {
        /* 元素可能已被替换 */
      }
    });
    markedRef.current = [];
    const add = (id: string, cls: string) => {
      try {
        canvas.addMarker(id, cls);
        markedRef.current.push({ id, cls });
      } catch {
        /* 元素不存在则忽略 */
      }
    };
    const { nodeStatus: ns, currentNodeKey: cur } = propsRef.current;
    Object.entries(ns || {}).forEach(([key, v]) => {
      if (v === 1) add(key, 'wf-test-pass');
      else if (v === 2) add(key, 'wf-test-fail');
    });
    if (cur) add(cur, 'wf-test-current');
  };

  // 创建只读查看器（仅一次）
  useEffect(() => {
    if (!containerRef.current) return () => {};
    const viewer = new NavigatedViewer({ container: containerRef.current });
    viewerRef.current = viewer;
    const eventBus = viewer.get('eventBus');
    eventBus.on('selection.changed', (e: any) => {
      const list: any[] = e?.newSelection || [];
      const shape = list.find((x: any) => isNodeElement(x));
      cbRef.current?.(shape ? shape.id : undefined);
    });
    return () => {
      try {
        viewer.destroy();
      } catch {
        /* ignore */
      }
      viewerRef.current = null;
      markedRef.current = [];
    };
  }, []);

  // 导入 BPMN
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !bpmnXml) return;
    viewer
      .importXML(bpmnXml)
      .then(() => {
        try {
          viewer.get('canvas').zoom('fit-viewport');
        } catch {
          /* ignore */
        }
        applyMarkers();
      })
      .catch(() => {
        /* 解析失败时保持空白，不打断页面 */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpmnXml]);

  // 结果 / 当前节点变化时重刷标记
  useEffect(() => {
    applyMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeStatus, currentNodeKey]);

  return (
    <div
      className="wf-test-diagram"
      style={{ height, border: '1px solid #f0f0f0', borderRadius: 6, background: '#fff' }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default FlowDiagram;
