import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Popconfirm, Select, Space, Table, Tag, message } from 'antd';
import { CheckCircleFilled, HolderOutlined, PlusOutlined } from '@ant-design/icons';
import { getNodeOperators, updateNode, WfNodeOperator, WfProcessNode } from '@/services/workflow';
import NodeOperatorModal from './NodeOperatorModal';
import NodeSettingModal from './NodeSettingModal';
import NodeOperateMenuModal from './NodeOperateMenuModal';
import NodeExtraOperateModal from './NodeExtraOperateModal';
import {
  buildExtJson,
  extraOperateSummary,
  isSettingConfigured,
  nodeSettings,
  operateMenuLabels,
  settingSummary,
  SETTING_DEFS,
} from './nodeSettings';
import { FORM_CONTENT_OPTIONS, NODE_TYPES } from './wfDict';
import type { FormFieldBrief } from './LinkInfoPanel';

export interface NodeInfoTableProps {
  defId: any;
  nodes: WfProcessNode[];
  /** 当前选中节点（与画布/出口信息联动） */
  selectedNodeKey?: string;
  /** 点行选中该节点 */
  onSelect?: (nodeKey: string) => void;
  /** 节点属性写库成功后通知父级，就地更新 nodes */
  onPatch?: (nodeKey: string, patch: Partial<WfProcessNode>) => void;
  /** 节点名称变更回写画布节点标签 */
  onRename?: (nodeKey: string, name: string) => void;
  /** 「定位到画布」 */
  onLocate?: (nodeKey: string) => void;
  /** 当前流程绑定的表单ID（节点布局入口依赖） */
  formId?: string;
  /** 表单字段（「附加操作」弹窗的字段下拉来源） */
  formFields?: FormFieldBrief[];
  /** 打开该节点的 Excel 布局设计器 */
  onEditLayout?: (nodeKey: string) => void;
  /** 鼠标拖拽调整节点顺序：回传按新顺序排列的 nodeKey 列表（仅已保存节点，草稿行不参与） */
  onReorder?: (orderedNodeKeys: string[]) => void;
  /** 移除（删除）已存在节点：调用方负责请求后端并刷新列表，组件侧只清本地临时态 */
  onDeleteNode?: (nodeKey: string) => void;
  /** 一次性创建多个新节点（含草稿期间填好的操作者/设置），由父级在画布创建并保存 */
  onCreateNodes?: (nodes: {
    nodeName: string;
    nodeType: number;
    operators: WfNodeOperator[];
    extJson: string;
  }[]) => void;
}

/**
 * 草稿节点：尚未落库，但已在表格内填好的全部信息。
 * 列表「+ 新增节点」先建草稿行，用户把名称/操作者/表单内容/各项设置全部填好，
 * 点「保存新增」时连同这些信息一次性创建节点并落库（operators → configOperator、extJson → updateNode）。
 */
interface DraftNode {
  nodeName: string;
  nodeType: number;
  operators: WfNodeOperator[];
  extJson: string; // {"settings":{...}}
}

/** 以「设置弹窗」承载的列表列（其余如操作菜单/前后附加操作直接格子内编辑） */
const SETTING_COLUMN_KEYS = [
  'subflow',
  'titleDisplay',
  'signOpinion',
  'exceptionHandle',
  'formLogScope',
  'appointFlow',
  'timeout',
];

const emptyExtJson = () => JSON.stringify({ settings: {} });

/**
 * 节点信息列表（可编辑）。
 *
 * 对齐 ecology「流转设置 → 节点信息」的字段：节点名称 / 节点类型 / 操作者 / 表单内容 /
 * 操作菜单 / 节点前附加操作 / 节点后附加操作 / 子流程设置 / 标题显示设置 / 签字意见设置 /
 * 流程异常处理 / 表单日志查看范围 / 指定流转。
 * 一行一个节点，即改即存（updateNode 局部 merge）：
 * · 名称/类型 → wf_process_node 字段；
 * · 操作菜单 / 前后附加操作 / 表单内容 / 其余设置项 → ext_json.settings；
 * · 操作者 → 单独弹窗整体覆盖（wf_node_operator）。
 *
 * 新增节点：先建**草稿行**（黄底），草稿行所有列都可编辑并暂存在本地，
 * 点「保存新增」再统一落库，避免每填一项打一次接口、且能一次建多个节点。
 */
const NodeInfoTable: React.FC<NodeInfoTableProps> = ({
  defId,
  nodes,
  selectedNodeKey,
  onSelect,
  onPatch,
  onRename,
  onLocate,
  formId,
  formFields,
  onEditLayout,
  onCreateNodes,
  onDeleteNode,
  onReorder,
}) => {
  /** 文本类单元格的输入草稿（key = `${nodeKey}|${field}`），失焦/回车才提交，避免每键一次请求 */
  const [draft, setDraft] = useState<Record<string, string>>({});
  /** 各节点操作者：nodeKey → 操作者列表 */
  const [operatorsMap, setOperatorsMap] = useState<Record<string, WfNodeOperator[]>>({});
  /** 正在编辑操作者的真实节点 key */
  const [opNodeKey, setOpNodeKey] = useState<string | undefined>();
  /** 正在编辑操作者的草稿行下标（draftMode） */
  const [opDraftIndex, setOpDraftIndex] = useState<number | undefined>();
  /** 正在编辑设置项的真实节点 {nodeKey, key} */
  const [settingCell, setSettingCell] = useState<{ nodeKey: string; key: string } | undefined>();
  /** 正在编辑设置项的草稿行下标（draftMode） */
  const [settingDraftIndex, setSettingDraftIndex] = useState<number | undefined>();
  /** 正在编辑「操作菜单」的真实节点 key / 草稿行下标（E9 形态：独立弹窗承载） */
  const [menuNodeKey, setMenuNodeKey] = useState<string | undefined>();
  const [menuDraftIndex, setMenuDraftIndex] = useState<number | undefined>();
  /** 正在编辑「前/后附加操作」的目标（E9 形态：独立弹窗承载） */
  const [extraCell, setExtraCell] = useState<
    { nodeKey?: string; draftIndex?: number; field: 'preOperate' | 'postOperate' } | undefined
  >();
  /** 拖拽排序：正在拖动的节点 key（按住左侧拖柄时设置） */
  const [dragKey, setDragKey] = useState<string | undefined>();
  /** 拖拽排序：当前悬停的目标节点 key（仅用于高亮落点行） */
  const [dragOverKey, setDragOverKey] = useState<string | undefined>();
  /** 正在编辑的设置项 key */
  const [settingDefKey, setSettingDefKey] = useState<string | undefined>();
  /**
   * 表尾新增草稿行（**支持多行**：连续点「+ 新增节点」可一次加多行，再统一保存）。
   * 用数组而不是单个对象，避免「一次只能加一行」。
   */
  const [draftRows, setDraftRows] = useState<DraftNode[]>([]);
  /** 草稿行「节点名称」输入框引用：新增一行后自动聚焦，省得用户以为不能输入 */
  const draftNameRefs = useRef<Record<number, any>>({});
  /**
   * 表格体的可视高度：跟随窗口自适应。
   * 刻意不测量父容器——父容器是 maxHeight 而非固定高度，测量会随表格内容变化
   * 形成 ResizeObserver 自反馈（表越长→可用高越大→表更长）。用窗口高度则稳定，
   * 且 `scroll.y` 是 max-height，内容少时会自动收缩，同样自适应内容。
   */
  const [bodyH, setBodyH] = useState<number>(() =>
    Math.max(220, Math.round(window.innerHeight * 0.52)),
  );
  useEffect(() => {
    const onResize = () => setBodyH(Math.max(220, Math.round(window.innerHeight * 0.52)));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 新增草稿行后自动聚焦名称输入框（连续新增时聚焦最后一行，可直接打字）
  useEffect(() => {
    if (!draftRows.length) return;
    draftNameRefs.current[draftRows.length - 1]?.focus?.();
  }, [draftRows.length]);

  const keysKey = useMemo(() => (nodes || []).map((n) => n.nodeKey).join(','), [nodes]);

  // 加载所有节点的操作者（节点数很少，一次并发取回即可）
  useEffect(() => {
    if (!defId) {
      setOperatorsMap({});
      return;
    }
    const keys = keysKey ? keysKey.split(',') : [];
    if (!keys.length) {
      setOperatorsMap({});
      return;
    }
    Promise.all(
      keys.map((k) =>
        getNodeOperators(defId, k)
          .then((r: any) => [k, r?.data || []] as [string, WfNodeOperator[]])
          .catch(() => [k, []] as [string, WfNodeOperator[]]),
      ),
    ).then((list) => {
      const m: Record<string, WfNodeOperator[]> = {};
      list.forEach(([k, v]) => {
        m[k] = v;
      });
      setOperatorsMap(m);
    });
    // 只在节点集合变化时加载，编辑单元格导致的 nodes 刷新不重复请求
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defId, keysKey]);

  const draftKey = (nodeKey: string, field: string) => `${nodeKey}|${field}`;

  /** 提交节点字段（名称/类型）——真实节点 */
  const saveField = async (nodeKey: string, patch: Partial<WfProcessNode>) => {
    try {
      const r: any = await updateNode(defId, nodeKey, patch);
      if (r?.success === false) {
        message.error('保存失败');
        return;
      }
      onPatch?.(nodeKey, patch);
    } catch {
      message.error('保存失败');
    }
  };

  /** 提交 settings 类改动——真实节点 */
  const saveSettings = async (
    node: WfProcessNode,
    mutate: (settings: Record<string, any>) => void,
  ) => {
    const nodeKey = node.nodeKey!;
    const extJson = buildExtJson(node, mutate);
    try {
      const r: any = await updateNode(defId, nodeKey, { extJson });
      if (r?.success === false) {
        message.error('保存失败');
        return;
      }
      onPatch?.(nodeKey, { extJson });
    } catch {
      message.error('保存失败');
    }
  };

  /** 草稿行本地写入 settings：解析现有 extJson → mutate → 回写 extJson */
  const setDraftSetting = (index: number, mutate: (settings: Record<string, any>) => void) => {
    setDraftRows((prev) =>
      prev.map((d, i) => {
        if (i !== index) return d;
        let settings: Record<string, any> = {};
        try {
          const o = JSON.parse(d.extJson || '{}');
          settings = o.settings || {};
        } catch {
          settings = {};
        }
        mutate(settings);
        return { ...d, extJson: JSON.stringify({ settings }) };
      }),
    );
  };

  const commitText = (node: WfProcessNode, field: 'nodeName' | 'preOperate' | 'postOperate') => {
    const nodeKey = node.nodeKey!;
    const k = draftKey(nodeKey, field);
    const v = draft[k];
    if (v == null) return;
    setDraft((d) => {
      const next = { ...d };
      delete next[k];
      return next;
    });
    if (field === 'nodeName') {
      if (v === (node.nodeName ?? '')) return;
      saveField(nodeKey, { nodeName: v });
      onRename?.(nodeKey, v);
    } else if (field === 'preOperate') {
      saveSettings(node, (s) => {
        s.preOperate = { ...(s.preOperate || {}), script: v };
      });
    } else {
      saveSettings(node, (s) => {
        s.postOperate = { ...(s.postOperate || {}), script: v };
      });
    }
  };

  /** 提交所有草稿行（一次建多个节点） */
  const commitDrafts = () => {
    const list = draftRows
      .map((d) => ({
        nodeName: d.nodeName.trim(),
        nodeType: d.nodeType,
        operators: d.operators,
        extJson: d.extJson,
      }))
      .filter((d) => d.nodeName);
    if (!list.length) {
      message.warning('请填写节点名称');
      return;
    }
    // ⚠️ 先清空草稿再通知父级：即便后续创建失败，草稿也不会残留顶住按钮
    setDraftRows([]);
    onCreateNodes?.(list);
  };

  const isDraft = (r: any) => !!r._draft;

  /**
   * 移除/删除某节点时清理**本地临时态**，避免残留无用数据：
   * · 文本草稿（draft：`${nodeKey}|字段` 局部输入缓存）
   * · 操作者缓存（operatorsMap[nodeKey]）
   * · 正在编辑该节点的各类弹窗（操作者 / 设置项 / 操作菜单 / 前/后附加操作）
   * 真实节点删除走后端，本地只清缓存；草稿行删除只清本地。
   */
  const cleanupTempForRemoved = (target: { nodeKey?: string; draftIndex?: number }) => {
    const key = target.nodeKey ?? (target.draftIndex != null ? `__draft_${target.draftIndex}__` : undefined);
    if (key) {
      setDraft((d) => {
        const next: Record<string, string> = {};
        Object.keys(d).forEach((k) => {
          if (!k.startsWith(`${key}|`)) next[k] = d[k];
        });
        return next;
      });
      setOperatorsMap((m) => {
        if (!(key in m)) return m;
        const next = { ...m };
        delete next[key];
        return next;
      });
    }
    if (target.nodeKey != null) {
      if (opNodeKey === target.nodeKey) setOpNodeKey(undefined);
      if (settingCell?.nodeKey === target.nodeKey) setSettingCell(undefined);
      if (menuNodeKey === target.nodeKey) setMenuNodeKey(undefined);
      if (extraCell?.nodeKey === target.nodeKey) setExtraCell(undefined);
    }
    if (target.draftIndex != null) {
      if (opDraftIndex === target.draftIndex) setOpNodeKey(undefined);
      if (settingDraftIndex === target.draftIndex) setSettingCell(undefined);
      if (menuDraftIndex === target.draftIndex) setMenuNodeKey(undefined);
      if (extraCell?.draftIndex === target.draftIndex) setExtraCell(undefined);
    }
  };

  // 当前正在编辑「操作者」的节点（真实 or 草稿）
  const opNode = opNodeKey
    ? nodes.find((n) => n.nodeKey === opNodeKey)
    : opDraftIndex != null
      ? draftRows[opDraftIndex]
      : undefined;
  // 当前正在编辑「设置项」的节点（真实 or 草稿）
  const settingNode =
    settingCell != null
      ? nodes.find((n) => n.nodeKey === settingCell.nodeKey)
      : settingDraftIndex != null
        ? ({
            nodeKey: `__draft_${settingDraftIndex}__`,
            nodeName: draftRows[settingDraftIndex]?.nodeName,
            extJson: draftRows[settingDraftIndex]?.extJson,
          } as any)
        : undefined;
  // 当前正在编辑「操作菜单」的节点（真实 or 草稿）
  const menuNode =
    menuNodeKey != null
      ? nodes.find((n) => n.nodeKey === menuNodeKey)
      : menuDraftIndex != null
        ? ({
            nodeKey: `__draft_${menuDraftIndex}__`,
            nodeName: draftRows[menuDraftIndex]?.nodeName,
            extJson: draftRows[menuDraftIndex]?.extJson,
          } as any)
        : undefined;
  // 当前正在编辑「前/后附加操作」的节点（真实 or 草稿）
  const extraNode =
    extraCell?.nodeKey != null
      ? nodes.find((n) => n.nodeKey === extraCell.nodeKey)
      : extraCell?.draftIndex != null
        ? ({
            nodeKey: `__draft_${extraCell.draftIndex}__`,
            nodeName: draftRows[extraCell.draftIndex]?.nodeName,
            extJson: draftRows[extraCell.draftIndex]?.extJson,
          } as any)
        : undefined;

  /**
   * 前/后附加操作单元格：摘要 + 「设置」。
   * 对齐 E9——附加操作是独立弹窗（选类型 / 填目标内容 / 写脚本 / 失败处理），
   * 行内单行输入框既装不下也无法表达类型与失败策略。
   */
  const renderExtraCell = (r: any, field: 'preOperate' | 'postOperate') => {
    const summary = extraOperateSummary(nodeSettings(r)[field]);
    const onEdit = () =>
      isDraft(r)
        ? setExtraCell({ draftIndex: r._draftIndex as number, field })
        : setExtraCell({ nodeKey: r.nodeKey!, field });
    return (
      <Space size={2}>
        <span
          style={{ color: summary ? undefined : '#bbb', fontSize: 12 }}
          title={summary || undefined}
        >
          {summary || '未设置'}
        </span>
        <Button type="link" size="small" onClick={onEdit}>
          设置
        </Button>
      </Space>
    );
  };

  /**
   * 拖拽排序：把 fromKey 拖到 toKey 的位置，回传重排后的 nodeKey 顺序给父级
   * （父级负责本地重排 + 逐个持久化 sortOrder）。草稿行无真实 nodeKey，不参与。
   */
  const moveNode = (fromKey: string, toKey: string) => {
    if (!fromKey || !toKey || fromKey === toKey) return;
    const keys = nodes.map((n) => n.nodeKey!).filter(Boolean);
    const from = keys.indexOf(fromKey);
    const to = keys.indexOf(toKey);
    if (from < 0 || to < 0) return;
    const next = keys.slice();
    next.splice(from, 1);
    next.splice(to, 0, fromKey);
    onReorder?.(next);
  };

  const columns: any[] = [
    {
      key: 'dragSort',
      title: '',
      width: 36,
      align: 'center',
      render: (_: any, r: WfProcessNode) => {
        const draft = isDraft(r);
        return (
          <span
            draggable={!draft}
            title={draft ? '保存后可拖动排序' : '按住拖动调整节点顺序'}
            style={{
              cursor: draft ? 'not-allowed' : 'grab',
              color: draft ? '#d9d9d9' : '#8c8c8c',
              display: 'inline-flex',
              alignItems: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
            onDragStart={(e) => {
              if (draft) {
                e.preventDefault();
                return;
              }
              setDragKey(r.nodeKey!);
              e.dataTransfer.effectAllowed = 'move';
              // Firefox 需 setData 才会真正启动拖拽
              e.dataTransfer.setData('text/plain', String(r.nodeKey));
            }}
            onDragEnd={() => {
              setDragKey(undefined);
              setDragOverKey(undefined);
            }}
          >
            <HolderOutlined />
          </span>
        );
      },
    },
    {
      title: '节点名称',
      dataIndex: 'nodeName',
      width: 150,
      __draftAware: true,
      render: (_: any, r: WfProcessNode) => {
        // 表尾草稿行：直接编辑新增节点的名称
        if (isDraft(r)) {
          const i = r._draftIndex as number;
          return (
            <Input
              size="small"
              ref={(el) => {
                draftNameRefs.current[i] = el;
              }}
              placeholder="新节点名称（必填）"
              value={draftRows[i]?.nodeName ?? ''}
              onChange={(e) =>
                setDraftRows((prev) =>
                  prev.map((d, idx) => (idx === i ? { ...d, nodeName: e.target.value } : d)),
                )
              }
              onPressEnter={commitDrafts}
            />
          );
        }
        const nodeKey = r.nodeKey!;
        const k = draftKey(nodeKey, 'nodeName');
        return (
          <Input
            size="small"
            value={draft[k] ?? r.nodeName ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
            onBlur={() => commitText(r, 'nodeName')}
            onPressEnter={() => commitText(r, 'nodeName')}
          />
        );
      },
    },
    {
      title: '节点类型',
      dataIndex: 'nodeType',
      width: 100,
      __draftAware: true,
      render: (_: any, r: WfProcessNode) =>
        isDraft(r) ? (
          <Select
            size="small"
            style={{ width: 88 }}
            value={draftRows[r._draftIndex as number]?.nodeType ?? 1}
            options={NODE_TYPES}
            onChange={(v) => {
              const i = r._draftIndex as number;
              setDraftRows((prev) => prev.map((d, idx) => (idx === i ? { ...d, nodeType: v } : d)));
            }}
          />
        ) : (
          <Select
            size="small"
            style={{ width: 88 }}
            value={r.nodeType ?? 1}
            options={NODE_TYPES}
            onChange={(v) => saveField(r.nodeKey!, { nodeType: v })}
          />
        ),
    },
    {
      title: '操作者',
      width: 120,
      render: (_: any, r: WfProcessNode) => {
        const ops = isDraft(r) ? r.operators || [] : operatorsMap[r.nodeKey!] || [];
        const onEdit = () =>
          isDraft(r) ? setOpDraftIndex(r._draftIndex as number) : setOpNodeKey(r.nodeKey!);
        return (
          <Space size={2}>
            <span style={{ color: ops.length ? undefined : '#bbb', fontSize: 12 }}>
              {ops.length ? `${ops.length} 项` : '未设置'}
            </span>
            <Button type="link" size="small" onClick={onEdit}>
              编辑
            </Button>
          </Space>
        );
      },
    },
    {
      title: '表单内容',
      width: 160,
      render: (_: any, r: WfProcessNode) => {
        const mode = nodeSettings(r).formContent?.mode || 'normal';
        const onMode = (v: any) =>
          isDraft(r)
            ? setDraftSetting(r._draftIndex as number, (s) => {
                s.formContent = { mode: v };
              })
            : saveSettings(r, (s) => {
                s.formContent = { mode: v };
              });
        const draft = isDraft(r);
        return (
          <Space size={2}>
            <Select
              size="small"
              style={{ width: 100 }}
              value={mode}
              options={FORM_CONTENT_OPTIONS}
              onChange={onMode}
            />
            {draft ? (
              // ⚠️ 节点未保存（草稿行）禁止进入布局设计：草稿没有真实 nodeKey，
              // 进入设计器保存会以无效的草稿 key 落库，造成孤立布局。
              <span style={{ color: '#bbb', fontSize: 12 }} title="请先保存节点后再进行布局设计">
                保存节点后可设计
              </span>
            ) : formId ? (
              // 布局设计按 nodeKey 独立保存（后端 getByFormId 支持节点级优先、回退表单级），
              // 故「设计」入口对「所有已保存且已绑定表单」的节点开放，与表单内容模式解耦，
              // 满足「每个节点都能独立重新设计其布局、互不影响」。
              <Button
                type="link"
                size="small"
                title="进入节点布局设计器（按节点独立保存，互不影响）"
                onClick={() => onEditLayout?.(r.nodeKey!)}
              >
                设计
              </Button>
            ) : (
              <span style={{ color: '#bbb', fontSize: 12 }} title="该流程尚未绑定表单">
                未绑定表单
              </span>
            )}
          </Space>
        );
      },
    },
    {
      title: '操作菜单',
      width: 170,
      // 对齐 E9：点「设置」打开独立弹窗配置（改显示名 / 启停 / 顺序 / 默认），
      // 格子内只显示摘要，避免行内多选塞不下且无法配名称与顺序。
      render: (_: any, r: WfProcessNode) => {
        const labels = operateMenuLabels(nodeSettings(r).operateMenu);
        const onEdit = () =>
          isDraft(r) ? setMenuDraftIndex(r._draftIndex as number) : setMenuNodeKey(r.nodeKey!);
        return (
          <Space size={2}>
            <span
              style={{ color: labels.length ? undefined : '#bbb', fontSize: 12 }}
              title={labels.join('/')}
            >
              {labels.length ? labels.join('/') : '默认'}
            </span>
            <Button type="link" size="small" onClick={onEdit}>
              设置
            </Button>
          </Space>
        );
      },
    },
    {
      title: '节点前附加操作',
      width: 150,
      render: (_: any, r: WfProcessNode) => renderExtraCell(r, 'preOperate'),
    },
    {
      title: '节点后附加操作',
      width: 150,
      render: (_: any, r: WfProcessNode) => renderExtraCell(r, 'postOperate'),
    },
    // 其余设置项：schema 驱动，单元格显示摘要 + 打勾，点「设置」弹窗编辑
    ...SETTING_DEFS.filter((d) => SETTING_COLUMN_KEYS.indexOf(d.key) >= 0).map((def) => ({
      title: def.label,
      width: 140,
      render: (_: any, r: WfProcessNode) => {
        const val = nodeSettings(r)[def.key];
        const done = isSettingConfigured(def, val);
        const onSet = () =>
          isDraft(r)
            ? (setSettingDraftIndex(r._draftIndex as number), setSettingDefKey(def.key))
            : setSettingCell({ nodeKey: r.nodeKey!, key: def.key });
        return (
          <Space size={2}>
            <span style={{ color: done ? undefined : '#bbb', fontSize: 12 }}>
              {done ? settingSummary(def, val) : '未设置'}
            </span>
            {done && <CheckCircleFilled style={{ color: '#52c41a', fontSize: 12 }} />}
            <Button type="link" size="small" onClick={onSet}>
              设置
            </Button>
          </Space>
        );
      },
    })),
    {
      title: '操作',
      width: 130,
      __draftAware: true,
      render: (_: any, r: WfProcessNode) =>
        isDraft(r) ? (
          <Button
            type="link"
            size="small"
            danger
            onClick={() => {
              const i = r._draftIndex as number;
              setDraftRows((prev) => prev.filter((_, idx) => idx !== i));
              // 草稿删除：清掉该草稿行在本地残留的临时态（缓存/弹窗）
              cleanupTempForRemoved({ draftIndex: i });
            }}
          >
            移除
          </Button>
        ) : (
          <Space size={2}>
            <Button type="link" size="small" onClick={() => onLocate?.(r.nodeKey!)}>
              定位
            </Button>
            <Popconfirm
              title="移除节点"
              description="将同时删除该节点的操作者、字段权限、明细权限、出口连线与布局，是否继续？"
              okText="删除"
              okButtonProps={{ danger: true }}
              cancelText="取消"
              onConfirm={() => {
                cleanupTempForRemoved({ nodeKey: r.nodeKey! });
                onDeleteNode?.(r.nodeKey!);
              }}
            >
              <Button type="link" size="small" danger>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
    },
  ];

  // 草稿行所有列均已可编辑，无需再屏蔽任何列
  const finalColumns = columns;

  const opModalOpen = !!opNodeKey || opDraftIndex != null;
  const settingModalOpen = !!settingCell || settingDraftIndex != null;

  return (
    <>
      <Table
        rowKey={(r: WfProcessNode) => String(r.nodeKey)}
        size="small"
        dataSource={[
          ...nodes,
          ...draftRows.map((d, i) => ({
            nodeKey: `__draft_${i}__`,
            nodeName: d.nodeName,
            nodeType: d.nodeType,
            operators: d.operators,
            extJson: d.extJson,
            _draft: true,
            _draftIndex: i,
          } as any)),
        ]}
        columns={finalColumns}
        pagination={false}
        scroll={{ x: 'max-content', y: bodyH }}
        locale={{ emptyText: '暂无节点，点下方「新增节点」添加' }}
        rowClassName={(r: WfProcessNode) => {
          if ((r as any)._draft) return 'wf-row-draft';
          if (dragKey && dragOverKey && r.nodeKey === dragOverKey && r.nodeKey !== dragKey) {
            return 'wf-row-dragover';
          }
          return r.nodeKey === selectedNodeKey ? 'wf-row-active' : '';
        }}
        onRow={(r: WfProcessNode) => ({
          onClick: () => {
            if (!isDraft(r)) onSelect?.(r.nodeKey!);
          },
          style: { cursor: isDraft(r) ? 'default' : 'pointer' },
          // 拖拽排序：仅「已保存节点」之间可互换位置
          onDragOver: (e: React.DragEvent) => {
            if (!dragKey || isDraft(r) || r.nodeKey === dragKey) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (dragOverKey !== r.nodeKey) setDragOverKey(r.nodeKey!);
          },
          onDrop: (e: React.DragEvent) => {
            if (!dragKey || isDraft(r) || r.nodeKey === dragKey) return;
            e.preventDefault();
            moveNode(dragKey, r.nodeKey!);
            setDragKey(undefined);
            setDragOverKey(undefined);
          },
        })}
      />
      {/* 新增区常驻在表格下方（不放 Table.footer：草稿存在时 footer 会被整体移除）。
          可连续「+ 新增节点」加多行，再「保存新增」一次性建多个节点并将填好的配置落库。 */}
      <Space direction="vertical" style={{ width: '100%', marginTop: 8 }} size={6}>
        <Button
          type="dashed"
          block
          size="small"
          icon={<PlusOutlined />}
          onClick={() =>
            setDraftRows((prev) => [
              ...prev,
              { nodeName: '', nodeType: 1, operators: [], extJson: emptyExtJson() },
            ])
          }
        >
          新增节点
        </Button>
        {draftRows.length > 0 && (
          <>
            <div style={{ color: '#d46b08', fontSize: 12, lineHeight: '18px' }}>
              草稿行（黄底）尚未落库：填好名称、操作者、表单内容、各项设置后，点「保存新增」一次性创建节点并保存。
            </div>
            <Button
              type="primary"
              block
              size="small"
              disabled={!draftRows.some((d) => d.nodeName.trim())}
              onClick={commitDrafts}
            >
              保存新增（{draftRows.filter((d) => d.nodeName.trim()).length}）
            </Button>
          </>
        )}
      </Space>

      <NodeOperatorModal
        open={opModalOpen}
        draftMode={opDraftIndex != null}
        defId={defId}
        nodeKey={opNodeKey ?? (opDraftIndex != null ? `__draft_${opDraftIndex}` : undefined)}
        nodeName={opNode?.nodeName}
        operators={opNode ? opNode.operators || [] : []}
        onSaved={(nodeKey, ops) => {
          if (opDraftIndex != null) {
            setDraftRows((prev) => prev.map((d, i) => (i === opDraftIndex ? { ...d, operators: ops } : d)));
          } else if (nodeKey) {
            setOperatorsMap((m) => ({ ...m, [nodeKey]: ops }));
          }
          setOpNodeKey(undefined);
          setOpDraftIndex(undefined);
        }}
        onClose={() => {
          setOpNodeKey(undefined);
          setOpDraftIndex(undefined);
        }}
      />

      <NodeSettingModal
        open={settingModalOpen}
        draftMode={settingDraftIndex != null}
        defId={defId}
        node={settingNode}
        nodes={nodes}
        defKey={settingDefKey ?? settingCell?.key}
        onSaved={(nodeKey, extJson) => {
          if (settingDraftIndex != null) {
            setDraftRows((prev) => prev.map((d, i) => (i === settingDraftIndex ? { ...d, extJson } : d)));
          } else if (nodeKey) {
            onPatch?.(nodeKey, { extJson });
          }
          setSettingCell(undefined);
          setSettingDraftIndex(undefined);
          setSettingDefKey(undefined);
        }}
        onClose={() => {
          setSettingCell(undefined);
          setSettingDraftIndex(undefined);
          setSettingDefKey(undefined);
        }}
      />

      {/* 操作菜单：独立弹窗（E9 形态），格子内点「设置」打开 */}
      <NodeOperateMenuModal
        open={menuNodeKey != null || menuDraftIndex != null}
        draftMode={menuDraftIndex != null}
        defId={defId}
        node={menuNode}
        onSaved={(nodeKey, extJson) => {
          if (menuDraftIndex != null) {
            setDraftRows((prev) =>
              prev.map((d, i) => (i === menuDraftIndex ? { ...d, extJson } : d)),
            );
          } else if (nodeKey) {
            onPatch?.(nodeKey, { extJson });
          }
          setMenuNodeKey(undefined);
          setMenuDraftIndex(undefined);
        }}
        onClose={() => {
          setMenuNodeKey(undefined);
          setMenuDraftIndex(undefined);
        }}
      />

      {/* 节点前/后附加操作：独立弹窗（E9 形态），格子内点「设置」打开 */}
      <NodeExtraOperateModal
        open={!!extraCell}
        field={extraCell?.field ?? 'preOperate'}
        draftMode={extraCell?.draftIndex != null}
        defId={defId}
        node={extraNode}
        formFields={formFields}
        onSaved={(nodeKey, extJson) => {
          if (extraCell?.draftIndex != null) {
            setDraftRows((prev) =>
              prev.map((d, i) => (i === extraCell.draftIndex ? { ...d, extJson } : d)),
            );
          } else if (nodeKey) {
            onPatch?.(nodeKey, { extJson });
          }
          setExtraCell(undefined);
        }}
        onClose={() => setExtraCell(undefined)}
      />
    </>
  );
};

export default NodeInfoTable;
