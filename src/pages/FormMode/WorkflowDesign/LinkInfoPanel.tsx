import React, { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Form,
  InputNumber,
  message,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import {
  createLink,
  updateLink,
  WfNodeLink,
  WfProcessNode,
} from '@/services/workflow';
import { scopeLabel } from './wfDict';
import LinkDetail from './LinkDetail';
import { useLinkActions } from './useLinkActions';

/** 阻止行内控件的点击冒泡到 Table 的 onRow.onClick */
const stop = (e: React.MouseEvent) => e.stopPropagation();

/** 草稿行的临时 rowKey（真实出口 id 都是雪花正数） */
const DRAFT_KEY = '__draft__';

export interface FormFieldBrief {
  scope: string;
  fieldName: string;
  fieldLabel: string;
}

/** 出口变更信号：add=画布补连线，delete=画布删连线，move=画布把连线的目标端改接到新节点 */
export interface LinkChange {
  type: 'add' | 'delete' | 'move';
  from: string;
  to: string;
  /** move 时表示原目标节点 */
  oldTo?: string;
}

export interface LinkInfoPanelProps {
  defId: any;
  nodes: WfProcessNode[];
  links: WfNodeLink[];
  /** 源节点（节点列表选中项，用于兜底高亮） */
  selectedNodeKey?: string;
  /** 画布上选中的那条出口（点连线同步进来），用于展示「当前出口」详情卡 */
  selectedLink?: { from: string; to: string };
  /** 选中的网关节点 key：传入时仅展示「经此网关」的下游分支（网关本身不入节点表，凭 viaGatewayKey 归属） */
  gatewayKey?: string;
  /** 选中的网关节点名称（用于标题展示） */
  gatewayName?: string;
  onSelect: (k?: string) => void;
  formFields: FormFieldBrief[];
  /** 出口变更后回调（用于刷新 links 并同步画布连线） */
  onChanged?: (change?: LinkChange) => void;
  /** 出口属性写库成功后通知父级，就地更新 links */
  onPatch?: (linkId: number, patch: Partial<WfNodeLink>) => void;
  /** 点「定位」→ 切到图形编辑页签并把画布居中高亮到该连线 */
  onLocate?: (from: string, to: string) => void;
}

/**
 * 出口信息（当前出口详情 + 全量出口列表）。
 *
 * 上半部分对齐 ecology：在流程图上点中某条连线后，呈现**该条出口**的信息与操作；
 * 下半部分保留全量出口列表（一行一条，行内可改目标节点 / 退回 / 必经 / 排序），
 * 便于浏览与批量维护。两者共用 WorkflowDesign 的 `links`，不各自持副本。
 */
const LinkInfoPanel: React.FC<LinkInfoPanelProps> = ({
  defId,
  nodes,
  links,
  selectedNodeKey,
  selectedLink,
  gatewayKey,
  gatewayName,
  onSelect,
  formFields,
  onChanged,
  onPatch,
  onLocate,
}) => {
  // 网关模式：仅展示「经此网关」的下游分支（按 viaGatewayKey 归属）
  const visibleLinks = gatewayKey
    ? links.filter((l) => String(l.viaGatewayKey) === String(gatewayKey))
    : links;
  const [addOpen, setAddOpen] = useState(false);
  const [addFrom, setAddFrom] = useState<string | undefined>();
  /** 有值表示表尾存在一条待填写目标节点的草稿行 */
  const [draftFrom, setDraftFrom] = useState<string | undefined>();

  const nodeName = (key?: string) =>
    nodes.find((n) => n.nodeKey === key)?.nodeName || key || '-';

  const nodeOptions = useMemo(
    () => nodes.map((n) => ({ value: n.nodeKey, label: n.nodeName || n.nodeKey })),
    [nodes],
  );

  /**
   * 闸门：仅当所有节点均测试通过（testStatus=1）后，才允许新增 / 编辑出口属性
   * （目标节点 / 退回 / 必经 / 流转条件 / 排序）。模拟运行未通过前出口信息只读，避免
   * 在不完整的流程上生成不可靠的流转规则。
   */
  const allTested = nodes.length > 0 && nodes.every((n) => n.testStatus === 1);
  const locked = !allTested;

  // 出口的「流转条件编辑弹窗 / 删除确认」：表格行内操作与右侧栏（LinkDetail）共用
  const { openCond, confirmDelete, modal } = useLinkActions(defId, nodes, formFields, {
    onPatch,
    onChanged,
    locked,
  });

  /** 出口名称：E9 也是自动生成「源节点 至 目标节点」，本地不落库派生展示 */
  const linkName = (l: WfNodeLink) =>
    l.toNodeKey ? `${nodeName(l.fromNodeKey)} 至 ${nodeName(l.toNodeKey)}` : '待选择目标节点';

  /** 画布上当前选中的那条出口 */
  const currentLink = useMemo(
    () =>
      selectedLink
        ? links.find(
            (l) =>
              String(l.fromNodeKey) === selectedLink.from && String(l.toNodeKey) === selectedLink.to,
          )
        : undefined,
    [links, selectedLink],
  );

  const draftRow: WfNodeLink | undefined = draftFrom
    ? ({ id: -1, fromNodeKey: draftFrom, toNodeKey: undefined } as WfNodeLink)
    : undefined;

  const dataSource = draftRow ? [...visibleLinks, draftRow] : visibleLinks;

  const patchLink = async (link: WfNodeLink, patch: Partial<WfNodeLink>, tip: string) => {
    if (link.id == null || link.id < 0) return false;
    try {
      const r: any = await updateLink(defId, link.id, patch);
      if (r?.success === false) {
        message.error('保存失败');
        return false;
      }
      onPatch?.(link.id, patch);
      message.success(`${tip}已保存`);
      return true;
    } catch {
      message.error('保存失败');
      return false;
    }
  };

  /** 草稿行选定目标节点 → 立即建库 */
  const commitDraft = async (to: string) => {
    if (!draftFrom) return;
    try {
      const r: any = await createLink(defId, { fromNodeKey: draftFrom, toNodeKey: to });
      if (r?.success === false) {
        message.error('新增出口失败');
        return;
      }
      message.success('出口已新增');
      onChanged?.({ type: 'add', from: draftFrom, to });
      setDraftFrom(undefined);
    } catch {
      message.error('新增出口失败');
    }
  };

  // 列宽用百分比，让表格撑满「出口信息」页签容器（maxWidth 960）并按比例收缩，
  // 不再写死 px 宽度 + scroll.x:max-content（那样会恒宽横向滚动、不自适应）。
  const columns = [
    {
      title: '源节点',
      dataIndex: 'fromNodeKey',
      width: '12%',
      ellipsis: true,
      render: (v: string) => nodeName(v),
    },
    {
      title: '目标节点',
      dataIndex: 'toNodeKey',
      width: '16%',
      render: (v: string, r: WfNodeLink) => {
        const isDraft = r.id === -1;
        return (
          <div onClick={stop} onMouseDown={stop}>
            <Select
              size="small"
              style={{ width: '100%' }}
              disabled={locked}
              placeholder="选择目标节点"
              value={v}
              options={nodeOptions.filter((o) => o.value !== r.fromNodeKey)}
              onChange={(nv) => {
                if (isDraft) {
                  commitDraft(nv);
                  return;
                }
                const oldTo = v;
                patchLink(r, { toNodeKey: nv }, '目标节点').then((ok) => {
                  // 画布上把这条连线的目标端改接到新节点
                  if (ok) {
                    onChanged?.({
                      type: 'move',
                      from: String(r.fromNodeKey),
                      to: String(nv),
                      oldTo: oldTo ? String(oldTo) : undefined,
                    });
                  }
                });
              }}
            />
          </div>
        );
      },
    },
    {
      title: '出口名称',
      dataIndex: 'linkName',
      width: '16%',
      ellipsis: true,
      render: (_: any, r: WfNodeLink) =>
        r.id === -1 ? <span style={{ color: '#999' }}>待保存</span> : linkName(r),
    },
    {
      title: '是否退回',
      dataIndex: 'isReject',
      width: '8%',
      align: 'center' as const,
      render: (v: number, r: WfNodeLink) =>
        r.id === -1 ? (
          '-'
        ) : (
          <div onClick={stop} onMouseDown={stop}>
            <Switch
              size="small"
              disabled={locked}
              checked={v === 1}
              onChange={(ck) => patchLink(r, { isReject: ck ? 1 : 0 }, '是否退回')}
            />
          </div>
        ),
    },
    {
      title: '必经分支',
      dataIndex: 'isMustPass',
      width: '8%',
      align: 'center' as const,
      render: (v: number, r: WfNodeLink) =>
        r.id === -1 ? (
          '-'
        ) : (
          <div onClick={stop} onMouseDown={stop}>
            <Switch
              size="small"
              disabled={locked}
              checked={v === 1}
              onChange={(ck) => patchLink(r, { isMustPass: ck ? 1 : 0 }, '必经分支')}
            />
          </div>
        ),
    },
    {
      title: '流转条件',
      dataIndex: 'conditionCn',
      width: '18%',
      ellipsis: true,
      render: (_: any, r: WfNodeLink) => {
        if (r.id === -1) return '-';
        const text = r.conditionCn || r.conditionExpr;
        return (
          <Space size={4} style={{ width: '100%' }}>
            <Button type="link" size="small" style={{ padding: 0 }} disabled={locked} onClick={() => openCond(r)}>
              {text ? '编辑' : '设置'}
            </Button>
            {text ? (
              <Tooltip title={r.conditionExpr || text}>
                <Tag
                  color="blue"
                  style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {text}
                </Tag>
              </Tooltip>
            ) : (
              <span style={{ color: '#bbb', fontSize: 12 }}>未设置</span>
            )}
          </Space>
        );
      },
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      width: '9%',
      render: (v: number, r: WfNodeLink) =>
        r.id === -1 ? (
          '-'
        ) : (
          <div onClick={stop} onMouseDown={stop}>
            <InputNumber
              size="small"
              style={{ width: '100%', maxWidth: 70 }}
              min={0}
              value={v ?? 0}
              onChange={(nv) => patchLink(r, { sortOrder: nv ?? 0 }, '排序')}
            />
          </div>
        ),
    },
    {
      title: '操作',
      dataIndex: 'op',
      width: '13%',
      align: 'center' as const,
      render: (_: any, r: WfNodeLink) => {
        if (r.id === -1) {
          return (
            <Button type="link" size="small" onClick={() => setDraftFrom(undefined)}>
              取消
            </Button>
          );
        }
        return (
          <Space size={0}>
            <Button
              type="link"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onLocate?.(String(r.fromNodeKey), String(r.toNodeKey));
              }}
            >
              定位
            </Button>
            <Button type="link" size="small" danger onClick={() => confirmDelete(r)}>
              删除
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      {locked && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 8 }}
          message="出口信息已锁定"
          description="请先在「节点信息」中运行流程模拟，且所有节点测试通过后，才能新增 / 编辑出口的目标节点、退回、必经、流转条件与排序。"
        />
      )}
      {/* 当前出口详情卡（选中连线时显示，可编辑条件 / 定位 / 删除）—— 与「图形编辑」页签右侧栏复用同一组件 */}
      {!gatewayKey && (
        <LinkDetail
          defId={defId}
          nodes={nodes}
          links={links}
          selectedLink={selectedLink}
          formFields={formFields}
          onPatch={onPatch}
          onChanged={onChanged}
          onLocate={onLocate}
        />
      )}

      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
        {!gatewayKey && (
          <Button
            type="primary"
            size="small"
            disabled={locked}
            onClick={() => {
              setAddFrom(undefined);
              setAddOpen(true);
            }}
          >
            + 新增出口
          </Button>
        )}
        <span style={{ color: '#888', fontSize: 12 }}>
          {gatewayKey
            ? `共 ${visibleLinks.length} 条「经此网关（${gatewayName || '网关'}）」的下游分支。分支条件 / 退回 / 必经可直接在此维护。`
            : `共 ${visibleLinks.length} 条出口。行内可直接改目标节点 / 退回 / 必经 / 排序；画布上连好线保存后会自动出现在此处。`}
        </span>
      </div>

      <Table<WfNodeLink>
        rowKey={(r) => (r.id === -1 ? DRAFT_KEY : String(r.id))}
        size="small"
        dataSource={dataSource}
        pagination={false}
        locale={{
          emptyText: gatewayKey
            ? '该网关暂无下游分支。可在「图形编辑」页签从网关拉出连线后保存。'
            : '暂无出口。可在「图形编辑」页签连好线后保存，或点「+ 新增出口」',
        }}
        rowClassName={(r) => {
          if (r.id === -1) return 'wf-row-draft';
          if (currentLink && r.id === currentLink.id) return 'wf-row-active';
          return r.fromNodeKey === selectedNodeKey ? 'wf-row-active' : '';
        }}
        onRow={(r) => ({
          onClick: () => r.id !== -1 && onSelect(r.fromNodeKey),
          style: { cursor: 'pointer' },
        })}
        columns={columns}
      />

      {/* 新增出口：先选源节点，再在表尾草稿行里选目标节点 */}
      <Modal
        title="新增出口"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        okButtonProps={{ disabled: !addFrom }}
        onOk={() => {
          setDraftFrom(addFrom);
          setAddOpen(false);
        }}
        destroyOnClose
        width={420}
      >
        <Form layout="vertical">
          <Form.Item label="源节点" required>
            <Select
              placeholder="请选择源节点"
              value={addFrom}
              options={nodeOptions}
              onChange={setAddFrom}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
        </Form>
      </Modal>
      {/* 流转条件编辑弹窗（与右侧栏共用） */}
      {modal}
    </div>
  );
};

export default LinkInfoPanel;
