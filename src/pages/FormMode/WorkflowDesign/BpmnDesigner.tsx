import React, { useEffect, useRef, useState } from 'react';
import BpmnJS from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
  CamundaPlatformPropertiesProviderModule,
} from 'bpmn-js-properties-panel';
import camundaModdleDescriptor from 'camunda-bpmn-moddle/resources/camunda.json';
import '@bpmn-io/properties-panel/dist/assets/properties-panel.css';
import { Button, Dropdown, Input, Modal, Space, Tooltip, message } from 'antd';
import {
  AlignCenterOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
  ColumnHeightOutlined,
  ColumnWidthOutlined,
  DownloadOutlined,
  FolderOpenOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  RedoOutlined,
  UndoOutlined,
  VerticalAlignBottomOutlined,
  VerticalAlignMiddleOutlined,
  VerticalAlignTopOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import { deployDefinition, saveBpmn } from '@/services/workflow';
import { usePageButtons } from '@/hooks/usePageButtons';
import customTranslateModule from './bpmnZh';
import './bpmnDesigner.css';

/**
 * 流程画布（bpmn-js）。
 *
 * 按 E9 图形编辑器交互，把 bpmn-js 的建模能力全部放开：
 *  - 顶部工具栏：打开文件 / 下载文件 / 粘贴XML / 撤销重做 / 对齐 / 等距分布 / 缩放 / 保存 / 部署；
 *  - 左侧图形库（Palette）、元素右键上下文菜单、多选对齐浮动条由 bpmn-js 原生提供；
 *  - 右侧内置属性面板（BpmnPropertiesPanelModule），按选中元素展示 常规 / 文档 / 扩展 等属性；
 *  - 选中元素时对外抛出 nodeKey（onSelectNode）；支持外部改名回写（renameNode）与增删连线（linkCommand）。
 *  - 节点/连线上不再叠加任何图形：直接点节点或连线即由 bpmn-js 原生选中，
 *    驱动右侧「节点信息 / 出口信息」；展示态下的编辑动作（移动/连线/删除）由只读规则拦截。
 *
 * 展示态（默认）为只读预览：隐藏工具栏编辑项与属性面板，画布背景屏蔽指针事件（阻止平移/缩放），
 * 但放开节点与连线本体（.djs-element）的 pointer-events，使其可被原生选中；
 * 编辑态放开上述全部建模能力。
 */
/** XML 属性值转义（流程名可能含 & < > " 等字符） */
const escAttr = (v: any): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * BPMN/XML 的 id 必须是合法 NCName：不能以数字开头，不能含空格/中文等。
 * 流程标识(procKey)由用户填写，常见 `111` 这类数字开头值；直接写进 XML 会让 moddle 报
 * `illegal ID <111>` 并**丢弃整个 <bpmn:process>**，最终 bpmn-js 抛
 * `no process or collaboration to display`（页面正常但画布一片空白）。
 */
const safeBpmnId = (raw?: any): string => {
  const s = String(raw ?? '').trim();
  if (/^[A-Za-z_][\w.-]*$/.test(s)) return s;
  const cleaned = s.replace(/[^\w.-]/g, '_');
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `Process_${cleaned || '1'}`;
};

/**
 * 空白流程模板：仅含一个空的 <bpmn:process>，不预置任何节点 / 连线。
 * 新建流程（尚无已保存 BPMN）时画布应是一片空白，由用户在编辑态从图形库手动添加节点，
 * 而不是塞一套「开始/审批/结束」默认节点。
 */
const BLANK_XML = (procKey: string, name: string): string => {
  const pid = safeBpmnId(procKey);
  const pname = escAttr(name || '流程');
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="${pid}" name="${pname}" isExecutable="true">
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${pid}">
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
};

const hasDisplayableContent = (xml: any): boolean =>
  typeof xml === 'string' &&
  xml.trim().length > 0 &&
  (/<(\w+:)?process[\s/>]/.test(xml) || /<(\w+:)?collaboration[\s/>]/.test(xml));

const NODE_TYPES = ['bpmn:StartEvent', 'bpmn:UserTask', 'bpmn:EndEvent'];

const isNodeElement = (el: any): boolean =>
  !!el && NODE_TYPES.indexOf(el?.businessObject?.$type) >= 0;

/** 展示态（只读）需拦截的编辑类命令：命中只读态即返回 false 阻止执行，但保留原生选中
 *  （selection 不在此列）。直接在 eventBus 上注册 commandStack.<action>.canExecute 监听，
 *  无需引入 diagram-js 的 RuleProvider（其为 bpmn-js 的传递依赖，pnpm 下不可由应用代码直接引用）。 */
const READONLY_BLOCK_ACTIONS = [
  'elements.move',
  'shape.resize',
  'connection.create',
  'connection.reconnect',
  'shape.create',
  'label.create',
  'shape.delete',
  'elements.delete',
];

/** 缩放比例下拉项（key 为比例值，'fit' 表示适应视口） */
const ZOOM_ITEMS = [
  { key: '0.25', label: '25%' },
  { key: '0.5', label: '50%' },
  { key: '0.75', label: '75%' },
  { key: '1', label: '100%' },
  { key: '1.25', label: '125%' },
  { key: '1.5', label: '150%' },
  { key: '2', label: '200%' },
  { key: 'fit', label: '适应视口' },
];

/** 外部「定位并高亮」指令（seq 递增，以支持对同一目标重复触发） */
export interface FocusEvt {
  seq: number;
  /** 聚焦并高亮该节点（nodeKey = BPMN 元素 id） */
  nodeKey?: string;
  /** 聚焦并高亮该连线（按源/目标节点匹配 SequenceFlow） */
  link?: { from: string; to: string };
}

export interface BpmnDesignerProps {
  defId?: number;
  procKey?: string;
  name?: string;
  bpmnXml?: string;
  onSaved?: () => void;
  onDeployed?: () => void;
  /** 选中节点（元素）时回调，传出 nodeKey；未选中节点时传 undefined */
  onSelectNode?: (nodeKey?: string) => void;
  /** 选中连线（SequenceFlow）时回调，传出源/目标节点 Key（只同步，不切页签） */
  onSelectLink?: (fromNodeKey: string, toNodeKey: string) => void;
  /** 外部改名回写画布（seq 变化触发） */
  renameNode?: { seq: number; nodeKey: string; name: string };
  /**
   * 外部增删/改接连线（seq 变化触发）：
   * add=补一条 from→to；delete=删 from→to；move=把 from→oldTo 改接到 from→to。
   */
  linkCommand?: {
    seq: number;
    type: 'add' | 'delete' | 'move';
    from: string;
    to: string;
    /** move 时的原目标节点 */
    oldTo?: string;
  };
  /** 外部「定位并高亮」节点/连线（seq 变化触发），用于列表 ↔ 画布联动 */
  focusEvt?: FocusEvt;
  /** 批量新增节点（节点信息「编辑」弹窗）：在画布尾部追加节点形状并连线，随后自动保存 */
  createNodesEvt?: {
    seq: number;
    nodes: { nodeName: string; nodeType: number; operators?: any[]; extJson?: string }[];
  };
  /** 批量新增完成（已自动保存画布）回调，传出新建节点的 {nodeKey, nodeType, operators, extJson} 供父级回写特殊类型与草稿期间填好的配置 */
  onNodesCreated?: (
    created: { nodeKey: string; nodeType: number; operators?: any[]; extJson?: string }[],
  ) => void;
  /** 节点「设置项角标」：nodeKey → 已配置设置项短标签（画布在节点右上角标注） */
  nodeBadges?: Record<string, string[]>;
}

const BpmnDesigner: React.FC<BpmnDesignerProps> = ({
  defId,
  procKey,
  name,
  bpmnXml,
  onSaved,
  onDeployed,
  onSelectNode,
  onSelectLink,
  renameNode,
  linkCommand,
  focusEvt,
  createNodesEvt,
  onNodesCreated,
  nodeBadges,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<any>(null);
  const renderOverlaysRef = useRef<() => void>(() => {});
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [exportText, setExportText] = useState('');
  // 画布模式：false = 展示（只读预览，默认打开即展示流程图），true = 编辑
  const [editMode, setEditMode] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  // 供初始化闭包读取最新状态（init effect 仅执行一次，避免捕获过期值）
  const editModeRef = useRef(false);
  editModeRef.current = editMode;
  const handleSaveRef = useRef<() => void>(() => {});
  /** 「定位并高亮」的闪烁定时器（卸载时需清理，避免内存泄漏） */
  const flashTimerRef = useRef<any>(null);
  /** 已处理过的「批量新增节点」seq（保证同一 seq 只执行一次） */
  const lastCreateSeqRef = useRef(0);
  /** 节点设置项角标数据（nodeKey → 短标签数组），随 props 变化重绘画布叠加层 */
  const badgesRef = useRef<Record<string, string[]>>({});
  useEffect(() => {
    badgesRef.current = nodeBadges || {};
    renderOverlaysRef.current?.();
  }, [nodeBadges]);

  // 回调放入 ref，避免初始化时闭包捕获过期引用
  const cbRef = useRef({ onSelectNode, onSelectLink });
  cbRef.current = { onSelectNode, onSelectLink };

  // 内置属性面板容器：必须始终渲染（模型器创建时就会挂载面板），展示态由 CSS 隐藏
  const propsPanelRef = useRef<HTMLDivElement>(null);
  // 「打开文件」对应的隐藏 input
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 工具栏实时状态：当前缩放比例、撤销/重做可用性
  const [zoom, setZoom] = useState(1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const { buttons: designButtons } = usePageButtons('workflow_design');
  const hasPerm = (code: string) => designButtons.some((b: any) => b.code === code);

  // 初始化 modeler
  useEffect(() => {
    if (!containerRef.current) return;
    const modeler = new BpmnJS({
      container: containerRef.current,
      // 右侧内置属性面板（parent 支持 DOM 元素 / 选择器；null 时面板自动不挂载，不会报错）
      propertiesPanel: { parent: propsPanelRef.current },
      // Camunda 平台属性（表单/分配/多实例/监听器/扩展属性 等）依赖 camunda moddle 描述符，
      // 否则这些分组里的控件一渲染就会因「未知类型」报错。
      moddleExtensions: { camunda: camundaModdleDescriptor },
      // customTranslateModule 需放在最后，覆盖内置 translate 文案
      additionalModules: [
        BpmnPropertiesPanelModule,
        BpmnPropertiesProviderModule,
        CamundaPlatformPropertiesProviderModule,
        customTranslateModule,
      ],
    });
    modelerRef.current = modeler;

    const overlays = modeler.get('overlays');
    const eventBus = modeler.get('eventBus');

    // 展示态拦截编辑动作：直接在 eventBus 挂 commandStack.<action>.canExecute 监听，
    // 命中只读态即返回 false 阻止命令执行（选中不受影响）。编辑态返回 undefined 交由默认规则。
    // 高优先级（2000）先于 bpmn-js 内置规则执行，返回 false 即 stopPropagation 阻断。
    READONLY_BLOCK_ACTIONS.forEach((action) => {
      eventBus.on(`commandStack.${action}.canExecute`, 2000, () =>
        editModeRef.current ? undefined : false,
      );
    });

    // 节点 / 连线上的「≡」「➤」图标与透明点击热区已移除：改为直接点节点 / 连线
    // （bpmn-js 原生 selection）→ 右侧栏展示当前节点 / 出口信息，无需在画布上叠加任何图形
    // （见 bpmnDesigner.css：展示态仅放开 .djs-element 的 pointer-events）。
    // 这里仅保留清理，避免旧版本残留的叠加层在热更新后仍存在。
    const renderOverlays = () => {
      overlays.remove({ type: 'wf-node' });
      overlays.remove({ type: 'wf-node-hit' });
      overlays.remove({ type: 'wf-link' });
      // 节点「设置项角标」：把已配置的设置项标注在节点右上角（对齐 E9 checkIsChangCellIcon）
      overlays.remove({ type: 'wf-badge' });
      const registry = modeler.get('elementRegistry');
      Object.keys(badgesRef.current || {}).forEach((key) => {
        const labels = badgesRef.current[key];
        if (!registry.get(key) || !labels || !labels.length) return;
        overlays.add(key, {
          type: 'wf-badge',
          position: { top: -10, right: -6 },
          html: `<div class="wf-badge" title="${labels.join(' / ')}">${labels.length}</div>`,
        });
      });
    };
    renderOverlaysRef.current = renderOverlays;

    eventBus.on('selection.changed', (e: any) => {
      const list: any[] = e.newSelection || [];
      // ⚠️ 选中一个形状时，bpmn-js 会把它的**标签元素**一并放进选中集，
      //    而标签元素的 id 是 `${id}_label`，与 wf_process_node.node_key 对不上，
      //    会导致右侧节点信息永远匹配不到。这里统一解析回「形状本身」
      //    （排除 labelTarget 即标签，且限定为我们认的节点类型）。
      const shape = list.find((x: any) => !x.labelTarget && isNodeElement(x));
      cbRef.current.onSelectNode?.(shape ? shape.id : undefined);
      // 选中连线时额外抛出源/目标节点 Key，供「出口信息」呈现当前出口（同样不切页签）
      const conn = list.find((x: any) => x.businessObject?.$type === 'bpmn:SequenceFlow');
      if (conn) {
        const from = conn.businessObject.sourceRef?.id;
        const to = conn.businessObject.targetRef?.id;
        if (from && to) cbRef.current.onSelectLink?.(from, to);
      }
    });

    // 快捷键（仅编辑态生效）。
    // ⚠️ diagram-js 14 的 `Keyboard.bind(node)` 只用于把键盘事件挂到某个 DOM 节点上，
    //    注册按键行为必须用 `keyboard.addListener(fn)`；listener 返回 true 才会 preventDefault。
    //    （早期误用 `keyboard.bind('delete', fn)` 会把字符串当 DOM 节点处理，
    //      抛 `el[bind$1] is not a function`，直接让整个设计页进入错误边界。）
    //    另外 Delete/Backspace(删除选中)、Ctrl+Z/Y(撤销重做)、Ctrl±/0(缩放) 都已是
    //    bpmn-js 内置绑定（BpmnKeyboardBindings / KeyboardBindings），这里只需补 Esc 与 Ctrl+S。
    const keyboard = modeler.get('keyboard');
    if (keyboard) {
      const selection = modeler.get('selection');
      keyboard.addListener((context: any) => {
        if (!editModeRef.current) return;
        const event = context?.keyEvent;
        if (!event) return;
        // Esc：取消选中
        if (keyboard.isKey(['Escape', 'Esc'], event)) {
          selection.select([]);
          return true;
        }
        // Ctrl/⌘+S：保存画布；返回 true 触发 preventDefault，避免浏览器「保存网页」弹窗
        if (keyboard.isCmd(event) && keyboard.isKey(['s', 'S'], event)) {
          handleSaveRef.current?.();
          return true;
        }
      });
    }

    // 工具栏状态同步：缩放比例（viewbox 变化）+ 撤销/重做可用性（commandStack 变化）
    const canvas = modeler.get('canvas');
    const commandStack = modeler.get('commandStack');
    const syncZoom = () => {
      try {
        setZoom(canvas.zoom());
      } catch {
        /* ignore */
      }
    };
    const syncStack = () => {
      try {
        setCanUndo(commandStack.canUndo());
        setCanRedo(commandStack.canRedo());
      } catch {
        /* ignore */
      }
    };
    eventBus.on('canvas.viewbox.changed', syncZoom);
    eventBus.on('commandStack.changed', syncStack);

    const xml = hasDisplayableContent(bpmnXml)
      ? (bpmnXml as string)
      : BLANK_XML(procKey || 'Process_1', name || '流程');
    // 画布入参留痕：出现空图时便于在控制台直接核对 XML（procKey 非法是常见原因）
    (window as any).__wfDebug = { defId, procKey, name, xml };
    modeler
      .importXML(xml)
      .then(() => {
        renderOverlays();
        // 首次适配视口（须在导入完成后执行，否则画布为空）
        try {
          canvas.zoom('fit-viewport');
        } catch {
          /* ignore */
        }
        syncZoom();
        syncStack();
      })
      .catch((e: any) => {
        console.error('[BpmnDesigner] 画布加载失败：', e);
        message.error('画布加载失败：' + (e?.message || e));
      });

    // 容器尺寸变化（如外层页签切换后重新显示）时修正画布，避免错位
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(() => {
        try {
          modeler.get('canvas').resized();
        } catch {
          /* ignore */
        }
      });
      ro.observe(containerRef.current);
    }

    return () => {
      if (ro) ro.disconnect();
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      modeler.destroy();
      modelerRef.current = null;
      renderOverlaysRef.current = () => {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切换定义：重载画布（无 BPMN 也重载为空白流程，避免从有图流程切回空流程时残留旧图）
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const m = modelerRef.current;
    if (!m) return;
    const xml = hasDisplayableContent(bpmnXml)
      ? (bpmnXml as string)
      : BLANK_XML(procKey || 'Process_1', name || '流程');
    m.importXML(xml)
      .then(() => renderOverlaysRef.current())
      .catch((e: any) => message.error('画布重载失败：' + (e?.message || e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpmnXml]);

  // 外部改名回写画布
  useEffect(() => {
    const m = modelerRef.current;
    if (!m || !renameNode) return;
    const el = m.get('elementRegistry').get(renameNode.nodeKey);
    if (el?.businessObject && el.businessObject.name !== renameNode.name) {
      try {
        m.get('modeling').updateProperties(el, { name: renameNode.name });
        renderOverlaysRef.current();
      } catch (e) {
        console.warn('[BpmnDesigner] 改名回写失败', e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renameNode?.seq]);

  // 外部增删 / 改接连线
  useEffect(() => {
    const m = modelerRef.current;
    if (!m || !linkCommand) return;
    const registry = m.get('elementRegistry');
    const modeling = m.get('modeling');
    const from = registry.get(linkCommand.from);
    const to = registry.get(linkCommand.to);
    if (!from || !to) return;
    /** from 指向某目标节点的现有连线 */
    const outgoingTo = (targetKey?: string) =>
      targetKey
        ? (from.outgoing || []).filter(
            (c: any) => c.businessObject?.targetRef === targetKey || c.target?.id === targetKey,
          )
        : [];
    try {
      if (linkCommand.type === 'add') {
        if (outgoingTo(linkCommand.to).length === 0) modeling.connect(from, to);
      } else if (linkCommand.type === 'move') {
        // 改接目标端：bpmn-js 没有直接"改端点"的 API，等价做法是先撤旧线再补新线
        outgoingTo(linkCommand.oldTo).forEach((c: any) => modeling.removeElements([c]));
        if (outgoingTo(linkCommand.to).length === 0) modeling.connect(from, to);
      } else {
        outgoingTo(linkCommand.to).forEach((c: any) => modeling.removeElements([c]));
      }
      renderOverlaysRef.current();
    } catch (e) {
      console.warn('[BpmnDesigner] 连线同步失败', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkCommand?.seq]);

  // 外部「定位并高亮」：列表点「定位」→ 画布选中 + 居中 + 闪烁提示
  useEffect(() => {
    if (!focusEvt?.seq) return;
    let cancelled = false;
    let tries = 0;
    const run = () => {
      if (cancelled) return;
      const m = modelerRef.current;
      // 画布可能刚从 display:none 切回来，甚至还在懒加载（首次进入该页签）→ 重试而不是直接放弃
      if (!m) {
        if (++tries <= 10) setTimeout(run, 200);
        return;
      }
      try {
        const registry = m.get('elementRegistry');
        const canvas = m.get('canvas');
        // 尺寸可能是旧的（隐藏期间为 0），先修正再滚动，否则 scrollToElement 算不准
        canvas.resized();
        let el: any;
        if (focusEvt.nodeKey) {
          el = registry.get(focusEvt.nodeKey);
        } else if (focusEvt.link) {
          const to = focusEvt.link.to;
          const fromEl = registry.get(focusEvt.link.from);
          el = (fromEl?.outgoing || []).find((c: any) => c.businessObject?.targetRef === to);
        }
        // XML 尚未导入完时 elementRegistry 还是空的，同样重试
        if (!el) {
          if (++tries <= 10) {
            setTimeout(run, 200);
            return;
          }
          message.warning('画布上未找到对应元素');
          return;
        }
        m.get('selection').select(el);
        canvas.scrollToElement(el);
        canvas.addMarker(el, 'wf-flash');
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => {
          try {
            canvas.removeMarker(el, 'wf-flash');
          } catch {
            /* ignore */
          }
        }, 2000);
      } catch (e) {
        console.warn('[BpmnDesigner] 定位失败', e);
      }
    };
    const t = setTimeout(run, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusEvt?.seq]);

  // 批量新增节点（节点信息「编辑」弹窗）：在画布尾部追加形状并连线，随后自动保存。
  // 既有节点（改名/改类型）由父级走 updateNode + renameEvt 处理，这里只负责「新增」的形状落地。
  useEffect(() => {
    if (!createNodesEvt?.seq) return;
    // 同一 seq 只处理一次：避免 StrictMode/重复渲染导致重复建形状，
    // 也避免 effect 重入时把上一次未完成的重试链再跑一遍。
    if (lastCreateSeqRef.current === createNodesEvt.seq) return;
    lastCreateSeqRef.current = createNodesEvt.seq;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      const m = modelerRef.current;
      // 画布懒加载 / 尚未导入完：重试
      if (!m) {
        setTimeout(run, 200);
        return;
      }
      try {
        // ⚠️ 必须先放开只读拦截，再执行任何建模命令：
        // 展示态下 eventBus 上的 commandStack.<action>.canExecute 监听返回 false，
        // shape.create / connection.create / elements.delete 会被**静默阻断**
        // （不报错，但形状就是建不出来）。原先这段放在建模之后，等于命令全被只读吃掉。
        editModeRef.current = true;
        setEditMode(true);
        const registry = m.get('elementRegistry');
        const modeling = m.get('modeling');
        const canvas = m.get('canvas');
        const elementFactory = m.get('elementFactory');
        const moddle = m.get('moddle');
        const all = registry.getAll();
        const isT = (el: any, t: string) => el?.businessObject?.$type === t;
        const startEls = all.filter((e: any) => isT(e, 'bpmn:StartEvent'));
        const endEls = all.filter((e: any) => isT(e, 'bpmn:EndEvent'));
        const userEls = all.filter((e: any) => isT(e, 'bpmn:UserTask'));
        const hasStart = startEls.length > 0;
        const hasEnd = endEls.length > 0;

        const genId = (type: string): string => {
          let id = '';
          let n = 0;
          const prefix =
            type === 'bpmn:StartEvent' ? 'StartEvent_' : type === 'bpmn:EndEvent' ? 'EndEvent_' : 'UserTask_';
          do {
            id = `${prefix}${Date.now().toString(36)}${n++}`;
          } while (registry.get(id));
          return id;
        };

        // 期望节点类型 → 画布形状类型（仅 Start/UserTask/End 能被 saveBpmn 解析；其余落到 UserTask，再回写真实类型）
        const shapeTypeFor = (nt: number): string => {
          if (nt === 0 && !hasStart) return 'bpmn:StartEvent';
          if (nt === 3 && !hasEnd) return 'bpmn:EndEvent';
          return 'bpmn:UserTask';
        };

        const parent = canvas.getRootElement();

        // 追加锚点：优先挂在「没有出线的用户任务」后；否则挂在 Start；都没有则先造一个 Start
        let insertAfter: any = null;
        let prevOutgoingToEnd: any = null;
        if (userEls.length) {
          const noOut = userEls.find((e: any) => (e.outgoing || []).length === 0);
          insertAfter = noOut || userEls[userEls.length - 1];
        } else if (hasStart) {
          insertAfter = startEls[0];
        } else {
          const sid = genId('bpmn:StartEvent');
          const bo: any = moddle.create('bpmn:StartEvent', { id: sid, name: '开始' });
          const sp: any = elementFactory.createShape({ type: 'bpmn:StartEvent', businessObject: bo });
          modeling.createShape(sp, { x: 160, y: 160 }, parent);
          insertAfter = sp;
        }
        if (hasEnd) {
          const endEl = endEls[0];
          prevOutgoingToEnd = (insertAfter.outgoing || []).find(
            (c: any) => isT(c, 'bpmn:SequenceFlow') && (c.target === endEl || c.businessObject?.targetRef === endEl.id),
          );
        }

        const created: { nodeKey: string; nodeType: number; operators?: any[]; extJson?: string }[] = [];
        let prev: any = insertAfter;
        createNodesEvt.nodes.forEach((nn) => {
          const type = shapeTypeFor(nn.nodeType);
          const id = genId(type);
          const bo: any = moddle.create(
            type === 'bpmn:StartEvent' ? 'bpmn:StartEvent' : type === 'bpmn:EndEvent' ? 'bpmn:EndEvent' : 'bpmn:UserTask',
            { id, name: nn.nodeName || '' },
          );
          const shape: any = elementFactory.createShape({ type, businessObject: bo });
          const px = (prev.x ?? 160) + (prev.width ?? 100) + 120;
          const py = prev.y ?? 160;
          modeling.createShape(shape, { x: px, y: py }, parent);
          modeling.connect(prev, shape);
          created.push({ nodeKey: id, nodeType: nn.nodeType, operators: nn.operators, extJson: nn.extJson });
          prev = shape;
        });

        // 末尾接到 End（若存在）；原本 insertAfter→End 的连线改接到新链尾部
        if (hasEnd) {
          const endEl = endEls[0];
          if (prev !== endEl) {
            if (prevOutgoingToEnd) modeling.removeElements([prevOutgoingToEnd]);
            modeling.connect(prev, endEl);
          }
        } else {
          const eid = genId('bpmn:EndEvent');
          const ebo: any = moddle.create('bpmn:EndEvent', { id: eid, name: '结束' });
          const eshape: any = elementFactory.createShape({ type: 'bpmn:EndEvent', businessObject: ebo });
          modeling.createShape(
            eshape,
            { x: (prev.x ?? 160) + (prev.width ?? 100) + 120, y: prev.y ?? 160 },
            parent,
          );
          modeling.connect(prev, eshape);
          created.push({ nodeKey: eid, nodeType: 3 });
        }

        // 已在建模前切到编辑态，这里直接保存
        handleSave().then((ok) => {
          if (ok) onNodesCreated?.(created);
        });
      } catch (e: any) {
        console.warn('[BpmnDesigner] 批量生成节点失败', e);
        message.error('批量生成节点失败：' + (e?.message || e));
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createNodesEvt?.seq]);

  // 展示 / 编辑切换：属性面板显隐会改变画布宽度，需修正尺寸；回到展示态时自动适配视口
  const firstMode = useRef(true);
  useEffect(() => {
    if (firstMode.current) {
      firstMode.current = false;
      return;
    }
    const m = modelerRef.current;
    if (!m) return;
    const t = setTimeout(() => {
      try {
        m.get('canvas').resized();
        if (!editMode) m.get('canvas').zoom('fit-viewport');
      } catch {
        /* ignore */
      }
      // 双态切换后顺手清理可能残留的旧叠加层（新版已不再创建叠加层，这里仅兜底）
      renderOverlaysRef.current?.();
    }, 80);
    return () => clearTimeout(t);
  }, [editMode]);

  /**
   * 键盘接管开关（快捷键生效的前提）。
   *
   * ⚠️ diagram-js 14 的 `Keyboard` **不会自动绑定 DOM**：只有模型器选项里传了
   * `keyboard.bindTo` 且触发 `attach` 事件时才 `bind`。`new BpmnJS({ container })`
   * 的默认用法下 `keyboard.getBinding()` 为 undefined → `keyboard.addListener`
   * 永远收不到事件 → 所有快捷键（含 bpmn-js 内置的 Delete / Ctrl+Z）全部失效。
   * 这里按「只有编辑态才接管键盘」的语义显式 bind/unbind：
   *  - 编辑态绑到 document（在输入框内按键会被 Keyboard 自身忽略，不影响面板打字）；
   *  - 展示态解绑，避免只读预览时 Ctrl+Z 之类偷偷改图。
   */
  useEffect(() => {
    const kb = modelerRef.current?.get('keyboard', false);
    if (!kb) return;
    try {
      if (editMode) kb.bind(document);
      else kb.unbind();
    } catch (e) {
      console.warn('[BpmnDesigner] 键盘绑定切换失败', e);
    }
  }, [editMode]);

  // 全屏（对应 E9 画布左上角的「全屏」）
  const toggleFullscreen = () => {
    const el = wrapRef.current as any;
    if (!el) return;
    const doc = document as any;
    const inFull = doc.fullscreenElement || doc.webkitFullscreenElement;
    if (!inFull) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) req.call(el);
    } else {
      const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
      if (exit) exit.call(doc);
    }
  };

  // 监听全屏变化：同步按钮文案并让画布重新适配
  useEffect(() => {
    const onChange = () => {
      setFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
      setTimeout(() => {
        try {
          modelerRef.current?.get('canvas').resized();
        } catch {
          /* ignore */
        }
      }, 120);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  const handleSave = async (): Promise<boolean> => {
    if (!modelerRef.current || defId == null) {
      message.warning('请先选择流程定义');
      return false;
    }
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      const r: any = await saveBpmn(defId, xml);
      if (r?.success) {
        message.success('BPMN 已保存并解析节点/出口');
        onSaved?.();
        renderOverlaysRef.current();
        return true;
      }
      message.error('保存失败');
      return false;
    } catch (e: any) {
      message.error('保存失败：' + (e?.message || e));
      return false;
    }
  };
  handleSaveRef.current = handleSave;

  const handleExport = async () => {
    if (!modelerRef.current) return;
    const { xml } = await modelerRef.current.saveXML({ format: true });
    setExportText(xml);
    setExportOpen(true);
  };

  const handleImport = async () => {
    if (!modelerRef.current) return;
    try {
      await modelerRef.current.importXML(importText);
      renderOverlaysRef.current();
      setImportOpen(false);
      message.success('导入成功');
    } catch (e: any) {
      message.error('BPMN 非法：' + (e?.message || e));
    }
  };

  const handleDeploy = () => {
    if (defId == null) return;
    deployDefinition(defId)
      .then((r: any) => {
        if (r?.success) {
          message.success('部署成功');
          onDeployed?.();
        } else {
          message.error('部署失败');
        }
      })
      .catch(() => message.error('部署失败'));
  };

  // ---------------- 工具栏动作（全部基于 modelerRef，缺失服务时静默降级） ----------------

  /** 选中两个及以上元素才能对齐 */
  const triggerAlign = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    const m = modelerRef.current;
    if (!m) return;
    const els = m.get('selection').get();
    if (els.length < 2) {
      message.info('请先框选 2 个及以上元素再对齐');
      return;
    }
    try {
      m.get('alignElements')?.trigger(els, type);
    } catch (e) {
      console.warn('[BpmnDesigner] 对齐失败', e);
    }
  };

  /** 选中三个及以上元素才能等距分布 */
  const triggerDistribute = (orientation: 'horizontal' | 'vertical') => {
    const m = modelerRef.current;
    if (!m) return;
    const els = m.get('selection').get();
    if (els.length < 3) {
      message.info('请先选中 3 个及以上元素再分布');
      return;
    }
    try {
      m.get('distributeElements')?.trigger(els, orientation);
    } catch (e) {
      console.warn('[BpmnDesigner] 分布失败', e);
    }
  };

  const doZoom = (value: number | 'fit-viewport') => {
    try {
      modelerRef.current?.get('canvas').zoom(value);
    } catch (e) {
      console.warn('[BpmnDesigner] 缩放失败', e);
    }
  };

  const doUndo = () => {
    const cs = modelerRef.current?.get('commandStack');
    if (cs?.canUndo()) cs.undo();
  };

  const doRedo = () => {
    const cs = modelerRef.current?.get('commandStack');
    if (cs?.canRedo()) cs.redo();
  };

  /** 下载文件：导出为 .bpmn */
  const handleDownload = async () => {
    const m = modelerRef.current;
    if (!m) return;
    const { xml } = await m.saveXML({ format: true });
    const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${procKey || 'process'}.bpmn`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /** 打开文件：本地 .bpmn / .xml 载入画布 */
  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file || !modelerRef.current) return;
    const reader = new FileReader();
    reader.onload = () => {
      modelerRef.current
        .importXML(String(reader.result))
        .then(() => {
          renderOverlaysRef.current();
          message.success(`已打开文件：${file.name}`);
        })
        .catch((err: any) => message.error('BPMN 非法：' + (err?.message || err)));
    };
    reader.readAsText(file);
  };

  /** 工具栏小图标按钮（带 Tooltip） */
  const iconBtn = (tip: string, icon: React.ReactNode, onClick: () => void, disabled?: boolean) => (
    <Tooltip title={tip}>
      <Button size="small" icon={icon} onClick={onClick} disabled={disabled} />
    </Tooltip>
  );

  return (
    <div
      ref={wrapRef}
      className={`wf-designer ${editMode ? 'wf-designer-edit' : 'wf-designer-view'}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: fullscreen ? '100%' : '72vh',
        background: '#fff',
        padding: fullscreen ? 12 : 0,
      }}
    >
      {/* ===== 顶部工具栏：编辑态放开全部建模能力，展示态仅保留查看类操作 ===== */}
      <Space style={{ marginBottom: 8, rowGap: 6 }} wrap size={[6, 6]}>
        {/* 编辑/完成编辑：切换展示↔编辑双态，始终可见（保存/部署仍按权限门禁） */}
        <Button type={editMode ? 'default' : 'primary'} onClick={() => setEditMode((v) => !v)}>
          {editMode ? '完成编辑' : '编辑'}
        </Button>
        <Button
          icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
          onClick={toggleFullscreen}
        >
          {fullscreen ? '退出全屏' : '全屏'}
        </Button>

        {editMode && (
          <>
            <Button size="small" icon={<FolderOpenOutlined />} onClick={() => fileInputRef.current?.click()}>
              打开文件
            </Button>
            <Button size="small" onClick={() => setImportOpen(true)}>
              粘贴XML
            </Button>
            {iconBtn('撤销 (Ctrl+Z)', <UndoOutlined />, doUndo, !canUndo)}
            {iconBtn('重做 (Ctrl+Y)', <RedoOutlined />, doRedo, !canRedo)}
          </>
        )}

        <Button size="small" icon={<DownloadOutlined />} onClick={handleDownload}>
          下载文件
        </Button>
        <Button size="small" onClick={handleExport}>
          查看XML
        </Button>

        {editMode && (
          <>
            {iconBtn('左对齐', <AlignLeftOutlined />, () => triggerAlign('left'))}
            {iconBtn('水平居中', <AlignCenterOutlined />, () => triggerAlign('center'))}
            {iconBtn('右对齐', <AlignRightOutlined />, () => triggerAlign('right'))}
            {iconBtn('顶对齐', <VerticalAlignTopOutlined />, () => triggerAlign('top'))}
            {iconBtn('垂直居中', <VerticalAlignMiddleOutlined />, () => triggerAlign('middle'))}
            {iconBtn('底对齐', <VerticalAlignBottomOutlined />, () => triggerAlign('bottom'))}
            {iconBtn('横向等距分布', <ColumnWidthOutlined />, () => triggerDistribute('horizontal'))}
            {iconBtn('纵向等距分布', <ColumnHeightOutlined />, () => triggerDistribute('vertical'))}
          </>
        )}

        {iconBtn('缩小', <ZoomOutOutlined />, () =>
          doZoom(Math.max(0.2, Math.round((zoom - 0.1) * 100) / 100)),
        )}
        <Dropdown
          menu={{
            items: ZOOM_ITEMS,
            onClick: ({ key }) => (key === 'fit' ? doZoom('fit-viewport') : doZoom(Number(key))),
          }}
        >
          <Button size="small">{Math.round(zoom * 100)}%</Button>
        </Dropdown>
        {iconBtn('放大', <ZoomInOutlined />, () => doZoom(Math.min(4, Math.round((zoom + 0.1) * 100) / 100)))}
        <Button size="small" onClick={() => doZoom('fit-viewport')}>
          适应视口
        </Button>
        {iconBtn('实际大小 1:1', <span style={{ fontSize: 11 }}>1:1</span>, () => doZoom(1))}

        {editMode && hasPerm('workflow_design_save_canvas') && (
          <Button type="primary" onClick={handleSave}>
            保存
          </Button>
        )}
        {hasPerm('workflow_design_deploy') && <Button onClick={handleDeploy}>部署到引擎</Button>}

        <span style={{ color: '#999', fontSize: 12 }}>
          {editMode
            ? '编辑中：左侧图形库拖入节点、连线后点「保存」；Delete 删除选中元素，Ctrl+Z 撤销，Ctrl/⌘+S 保存'
            : '展示中：点节点或连线即可在右侧查看其信息；点「编辑」可修改流程图'}
        </span>
      </Space>

      {/* 隐藏的本地文件选择器（对应工具栏「打开文件」） */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".bpmn,.xml,application/xml,text/xml"
        style={{ display: 'none' }}
        onChange={handlePickFile}
      />

      <div style={{ flex: 1, minHeight: 0, border: '1px solid #d9d9d9', overflow: 'hidden', display: 'flex' }}>
        <div ref={containerRef} style={{ flex: 1, minWidth: 0, height: '100%', background: '#fff' }} />
        {/* bpmn-js 内置属性面板（展示态由 .wf-designer-view .wf-props 隐藏） */}
        <div ref={propsPanelRef} className="wf-props" />
      </div>

      <Modal
        title="导入 BPMN"
        open={importOpen}
        onOk={handleImport}
        onCancel={() => setImportOpen(false)}
        width={800}
        destroyOnClose
      >
        <Input.TextArea
          rows={16}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="粘贴 BPMN 2.0 XML"
        />
      </Modal>
      <Modal
        title="导出 BPMN"
        open={exportOpen}
        onCancel={() => setExportOpen(false)}
        footer={null}
        width={800}
      >
        <Input.TextArea readOnly rows={16} value={exportText} />
      </Modal>
    </div>
  );
};

export default BpmnDesigner;
