import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Select, Space, Table, message } from 'antd';
import { CheckCircleFilled, PlusOutlined } from '@ant-design/icons';
import { getNodeOperators, updateNode, WfNodeOperator, WfProcessNode } from '@/services/workflow';
import NodeOperatorModal from './NodeOperatorModal';
import NodeSettingModal from './NodeSettingModal';
import {
  buildExtJson,
  isSettingConfigured,
  nodeSettings,
  settingSummary,
  SETTING_DEFS,
} from './nodeSettings';
import { FORM_CONTENT_OPTIONS, MENUS_OPTIONS, NODE_TYPES } from './wfDict';

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
  /** 打开该节点的 Excel 布局设计器 */
  onEditLayout?: (nodeKey: string) => void;
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
  onEditLayout,
  onCreateNodes,
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

  const columns: any[] = [
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
        return (
          <Space size={2}>
            <Select
              size="small"
              style={{ width: 100 }}
              value={mode}
              options={FORM_CONTENT_OPTIONS}
              onChange={onMode}
            />
            {mode === 'custom' && formId && (
              <Button type="link" size="small" onClick={() => onEditLayout?.(r.nodeKey!)}>
                设计
              </Button>
            )}
          </Space>
        );
      },
    },
    {
      title: '操作菜单',
      width: 170,
      render: (_: any, r: WfProcessNode) => (
        <Select
          mode="multiple"
          size="small"
          style={{ width: 156 }}
          maxTagCount="responsive"
          value={nodeSettings(r).operateMenu?.menus || []}
          options={MENUS_OPTIONS}
          placeholder="默认"
          onChange={(v) =>
            isDraft(r)
              ? setDraftSetting(r._draftIndex as number, (s) => {
                  s.operateMenu = { menus: v };
                })
              : saveSettings(r, (s) => {
                  s.operateMenu = { menus: v };
                })
          }
        />
      ),
    },
    {
      title: '节点前附加操作',
      width: 150,
      render: (_: any, r: WfProcessNode) => {
        if (isDraft(r)) {
          const i = r._draftIndex as number;
          return (
            <Input
              size="small"
              placeholder="操作说明"
              value={nodeSettings(r).preOperate?.script ?? ''}
              onChange={(e) =>
                setDraftSetting(i, (s) => {
                  s.preOperate = { ...(s.preOperate || {}), script: e.target.value };
                })
              }
            />
          );
        }
        const k = draftKey(r.nodeKey!, 'preOperate');
        return (
          <Input
            size="small"
            placeholder="操作说明"
            value={draft[k] ?? nodeSettings(r).preOperate?.script ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
            onBlur={() => commitText(r, 'preOperate')}
            onPressEnter={() => commitText(r, 'preOperate')}
          />
        );
      },
    },
    {
      title: '节点后附加操作',
      width: 150,
      render: (_: any, r: WfProcessNode) => {
        if (isDraft(r)) {
          const i = r._draftIndex as number;
          return (
            <Input
              size="small"
              placeholder="操作说明"
              value={nodeSettings(r).postOperate?.script ?? ''}
              onChange={(e) =>
                setDraftSetting(i, (s) => {
                  s.postOperate = { ...(s.postOperate || {}), script: e.target.value };
                })
              }
            />
          );
        }
        const k = draftKey(r.nodeKey!, 'postOperate');
        return (
          <Input
            size="small"
            placeholder="操作说明"
            value={draft[k] ?? nodeSettings(r).postOperate?.script ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
            onBlur={() => commitText(r, 'postOperate')}
            onPressEnter={() => commitText(r, 'postOperate')}
          />
        );
      },
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
      width: 90,
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
            }}
          >
            移除
          </Button>
        ) : (
          <Button type="link" size="small" onClick={() => onLocate?.(r.nodeKey!)}>
            定位
          </Button>
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
          return r.nodeKey === selectedNodeKey ? 'wf-row-active' : '';
        }}
        onRow={(r: WfProcessNode) => ({
          onClick: () => {
            if (!isDraft(r)) onSelect?.(r.nodeKey!);
          },
          style: { cursor: isDraft(r) ? 'default' : 'pointer' },
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
    </>
  );
};

export default NodeInfoTable;
