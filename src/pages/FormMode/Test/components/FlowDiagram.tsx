import React, { useEffect, useRef, useState } from 'react';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import './flowDiagram.css';

/**
 * 只读流程图画布（流程测试右侧「流程图」页签 / 流程预览）。
 *
 * 用 bpmn-js 的 NavigatedViewer（无建模能力、无工具栏）渲染流程定义的 BPMN，
 * 并按测试结果 / 实例轨迹在节点上叠加信息：
 *   - wf-test-pass    走通（绿）
 *   - wf-test-fail    走不通（红）
 *   - wf-test-current 当前查看节点（蓝虚线）
 *   - 节点下方叠加「已操作」办理人姓名（谁批的）
 *   - 悬浮节点弹出「操作者」分组面板：未操作 / 已查看 / 已操作
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

const escapeHtml = (s: string): string =>
  String(s).replace(/[&<>"']/g, (c) =>
    (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]),
  );

/** 单个节点的操作者分组（对齐 ecology 流程图节点悬浮「操作者」面板） */
export interface WfNodeOperators {
  /** 已操作（已办/办结/协办/有审批记录，开始节点为发起人） */
  handled?: Array<string | number>;
  /** 已查看（待办已打开、尚未处理） */
  viewed?: Array<string | number>;
  /** 未操作（待办尚未打开） */
  todo?: Array<string | number>;
}

export interface FlowDiagramProps {
  bpmnXml?: string;
  /** nodeKey -> 节点状态：1走通 2走不通 */
  nodeStatus?: Record<string, number>;
  /** 当前查看节点（高亮为蓝虚线） */
  currentNodeKey?: string;
  /** nodeKey -> 操作者分组：节点下方显示已操作人姓名；悬浮显示分组面板 */
  nodeOperators?: Record<string, WfNodeOperators>;
  /** 用户ID -> 姓名（复用页面人员字典，与「操作人」姓名同源） */
  resolveUserName?: (id: string | number) => string;
  /** 点节点回调（传出 nodeKey） */
  onSelectNode?: (nodeKey?: string) => void;
  height?: number;
}

const FlowDiagram: React.FC<FlowDiagramProps> = ({
  bpmnXml,
  nodeStatus,
  currentNodeKey,
  nodeOperators,
  resolveUserName,
  onSelectNode,
  height = 420,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const markedRef = useRef<{ id: string; cls: string }[]>([]);
  const overlaysRef = useRef<any[]>([]);
  /** 悬浮「操作者」面板（绝对定位在画布容器内，避免 antd Modal 的 transform 影响 fixed 定位） */
  const [tip, setTip] = useState<{ key: string; x: number; y: number } | null>(null);

  // 回调放 ref，避免事件闭包捕获过期引用
  const cbRef = useRef(onSelectNode);
  cbRef.current = onSelectNode;

  const propsRef = useRef({ nodeStatus, currentNodeKey, nodeOperators, resolveUserName });
  propsRef.current = { nodeStatus, currentNodeKey, nodeOperators, resolveUserName };

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

  /**
   * 节点下方叠加「已操作」办理人姓名（对齐 ecology：节点名下面一行办理人）。
   *
   * 只有「已操作」才显示——未操作/已查看的人不进节点标签（与 ecology 一致，
   * 悬浮面板里才看得到）。用签名对比避免每次渲染重建 overlay 造成闪烁。
   */
  const overlaySigRef = useRef('');
  const applyOverlays = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    let overlays: any;
    try {
      overlays = viewer.get('overlays');
    } catch {
      return;
    }
    const { nodeOperators: ops, resolveUserName: name } = propsRef.current;
    const entries: { key: string; text: string }[] = [];
    Object.entries(ops || {}).forEach(([key, v]) => {
      const handled = (v?.handled || [])
        .map((id) => (name ? name(id) : String(id)))
        .filter((n) => !!n);
      if (!handled.length) return;
      entries.push({ key, text: handled.join('、') });
    });
    const sig = JSON.stringify(entries);
    if (sig === overlaySigRef.current) return;
    overlaySigRef.current = sig;

    overlaysRef.current.forEach((o) => {
      try {
        overlays.remove(o);
      } catch {
        /* ignore */
      }
    });
    overlaysRef.current = [];
    entries.forEach(({ key, text }) => {
      try {
        overlaysRef.current.push(
          overlays.add(key, {
            // left+right 同时给：overlay 撑满元素宽度，内部 text-align:center 居中对齐在节点正下方
            position: { bottom: -6, left: 0, right: 0 },
            html: `<div class="wf-op-names" data-key="${escapeHtml(key)}">${escapeHtml(text)}</div>`,
          }),
        );
      } catch {
        /* 元素不存在则忽略 */
      }
    });
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
      overlaysRef.current = [];
      overlaySigRef.current = '';
    };
  }, []);

  // 悬浮节点 → 弹出「操作者」分组面板（未操作 / 已查看 / 已操作）
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return () => {};
    const eventBus = viewer.get('eventBus');
    const onHover = (e: any) => {
      const el = e?.element;
      if (!isNodeElement(el) || !el.id) return;
      // 没有办理记录的节点不弹面板
      if (!(propsRef.current.nodeOperators || {})[el.id]) return;
      const ev = e?.originalEvent || {};
      const rect = containerRef.current?.getBoundingClientRect();
      const x = (ev.clientX || 0) - (rect?.left || 0);
      const y = (ev.clientY || 0) - (rect?.top || 0);
      // 同一节点内移动不再重设 state（避免鼠标移动频繁重渲染）
      setTip((prev) => (prev && prev.key === el.id ? prev : { key: el.id, x, y }));
    };
    const onOut = () => setTip(null);
    eventBus.on('element.hover', onHover);
    eventBus.on('element.out', onOut);
    return () => {
      try {
        eventBus.off('element.hover', onHover);
        eventBus.off('element.out', onOut);
      } catch {
        /* ignore */
      }
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
        // 重新导入后 overlay 会随元素一起清空，需重挂
        overlaySigRef.current = '';
        overlaysRef.current = [];
        applyMarkers();
        applyOverlays();
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

  // 操作者 / 人员字典变化时重刷节点下方姓名
  useEffect(() => {
    applyOverlays();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeOperators, resolveUserName]);

  const tipData = tip ? (nodeOperators || {})[tip.key] : undefined;
  const groups = tipData
    ? [
        { cls: 'todo', label: '未操作', ids: tipData.todo || [] },
        { cls: 'viewed', label: '已查看', ids: tipData.viewed || [] },
        { cls: 'handled', label: '已操作', ids: tipData.handled || [] },
      ].filter((g) => g.ids.length > 0)
    : [];

  return (
    <div
      className="wf-test-diagram"
      style={{ height, border: '1px solid #f0f0f0', borderRadius: 6, background: '#fff' }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {tip && groups.length > 0 ? (
        <div className="wf-op-panel" style={{ left: tip.x + 14, top: tip.y + 14 }}>
          <div className="wf-op-panel-title">操作者</div>
          {groups.map((g) => (
            <div key={g.cls} className="wf-op-group">
              <div className={`wf-op-group-label wf-op-label-${g.cls}`}>{g.label}</div>
              <div className="wf-op-group-names">
                {g.ids.map((id) => (
                  <span key={String(id)}>{resolveUserName ? resolveUserName(id) : String(id)}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default FlowDiagram;
