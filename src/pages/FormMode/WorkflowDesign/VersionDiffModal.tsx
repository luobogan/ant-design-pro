import { Descriptions, message, Modal, Select, Space, Table, Tabs, Tag } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { diffVersion, VersionDiff, VersionLinkDiff, VersionNodeDiff } from '@/services/workflow';
import { NODE_TYPES, SIGN_ORDERS } from './wfDict';

/**
 * 版本差异对比弹窗。
 *
 * 展示「当前版本(source)」与「被对比版本(target)」之间节点与出口的
 * 新增 / 删除 / 变更三类差异（nodeKey、fromNodeKey→toNodeKey 维度对照）。
 */
interface VersionDiffModalProps {
  open: boolean;
  onCancel: () => void;
  sourceDefId?: string;
  sourceVersion?: number;
  /** 同组版本列表（用于选择对比目标，排除当前版本自身） */
  versions: { id: string; version?: number; status?: number }[];
}

const dictLabel = (dict: { value: any; label: string }[], v: any) =>
  dict.find((d) => String(d.value) === String(v))?.label ?? (v ?? '-');

const DIFF_TAG: Record<string, { color: string; text: string }> = {
  added: { color: 'green', text: '新增' },
  removed: { color: 'red', text: '删除' },
  changed: { color: 'orange', text: '修改' },
};

/** 节点差异统一行：kind=added/removed/changed */
interface NodeRow extends VersionNodeDiff {
  kind: keyof typeof DIFF_TAG;
}

/** 出口差异统一行 */
interface LinkRow extends VersionLinkDiff {
  kind: keyof typeof DIFF_TAG;
}

const VersionDiffModal: React.FC<VersionDiffModalProps> = ({
  open,
  onCancel,
  sourceDefId,
  sourceVersion,
  versions,
}) => {
  const [targetId, setTargetId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [diff, setDiff] = useState<VersionDiff>();

  const others = useMemo(() => versions.filter((v) => v.id !== sourceDefId), [versions, sourceDefId]);

  useEffect(() => {
    // 打开时默认选「激活版本」（或第一个其它版本），并自动拉取差异
    if (!open || !sourceDefId) return;
    const preferred = others.find((v) => v.status === 1) || others[0];
    const tid = preferred?.id;
    setTargetId(tid);
    if (!tid) {
      setDiff(undefined);
      return;
    }
    setLoading(true);
    diffVersion(sourceDefId as unknown as number, tid)
      .then((r: any) => {
        const data = r?.data ?? r;
        if (data) setDiff(data);
        else message.error('版本对比失败');
      })
      .catch(() => message.error('版本对比失败'))
      .finally(() => setLoading(false));
  }, [open, sourceDefId, others]);

  const handleChangeTarget = (tid: string) => {
    setTargetId(tid);
    if (!sourceDefId || !tid) return;
    setLoading(true);
    diffVersion(sourceDefId as unknown as number, tid)
      .then((r: any) => {
        const data = r?.data ?? r;
        if (data) setDiff(data);
        else message.error('版本对比失败');
      })
      .catch(() => message.error('版本对比失败'))
      .finally(() => setLoading(false));
  };

  const nodeRows: NodeRow[] = useMemo(
    () => [
      ...(diff?.addedNodes || []).map((n) => ({ ...n, kind: 'added' as const })),
      ...(diff?.removedNodes || []).map((n) => ({ ...n, kind: 'removed' as const })),
      ...(diff?.changedNodes || []).map((n) => ({ ...n, kind: 'changed' as const })),
    ],
    [diff],
  );

  const linkRows: LinkRow[] = useMemo(
    () => [
      ...(diff?.addedLinks || []).map((l) => ({ ...l, kind: 'added' as const })),
      ...(diff?.removedLinks || []).map((l) => ({ ...l, kind: 'removed' as const })),
      ...(diff?.changedLinks || []).map((l) => ({ ...l, kind: 'changed' as const })),
    ],
    [diff],
  );

  const nodeColumns = [
    {
      title: '差异',
      dataIndex: 'kind',
      width: 72,
      render: (k: keyof typeof DIFF_TAG) => <Tag color={DIFF_TAG[k].color}>{DIFF_TAG[k].text}</Tag>,
    },
    { title: '节点标识', dataIndex: 'nodeKey', width: 200, ellipsis: true },
    {
      title: `当前版本 v${sourceVersion ?? '-'}`,
      render: (_: any, r: NodeRow) =>
        r.kind === 'added' ? (
          <span style={{ color: '#999' }}>—</span>
        ) : (
          <span>
            {r.sourceName || '-'}（{dictLabel(NODE_TYPES, r.sourceType)} · {dictLabel(SIGN_ORDERS, r.sourceSignOrder)}）
          </span>
        ),
    },
    {
      title: `对比版本 v${others.find((v) => v.id === targetId)?.version ?? '-'}`,
      render: (_: any, r: NodeRow) =>
        r.kind === 'removed' ? (
          <span style={{ color: '#999' }}>—</span>
        ) : (
          <span>
            {r.targetName || '-'}（{dictLabel(NODE_TYPES, r.targetType)} · {dictLabel(SIGN_ORDERS, r.targetSignOrder)}）
          </span>
        ),
    },
  ];

  const linkColumns = [
    {
      title: '差异',
      dataIndex: 'kind',
      width: 72,
      render: (k: keyof typeof DIFF_TAG) => <Tag color={DIFF_TAG[k].color}>{DIFF_TAG[k].text}</Tag>,
    },
    {
      title: '流向',
      render: (_: any, r: LinkRow) => `${r.fromNodeKey || '-'} → ${r.toNodeKey || '-'}`,
      ellipsis: true,
    },
    {
      title: '当前版本条件',
      render: (_: any, r: LinkRow) =>
        r.kind === 'added' ? (
          <span style={{ color: '#999' }}>—</span>
        ) : (
          <span>
            {r.sourceConditionCn || '无条件'}
            {r.sourceIsReject === 1 ? '（退回线）' : ''}
          </span>
        ),
    },
    {
      title: '对比版本条件',
      render: (_: any, r: LinkRow) =>
        r.kind === 'removed' ? (
          <span style={{ color: '#999' }}>—</span>
        ) : (
          <span>
            {r.targetConditionCn || '无条件'}
            {r.targetIsReject === 1 ? '（退回线）' : ''}
          </span>
        ),
    },
  ];

  return (
    <Modal
      title="版本差异对比"
      open={open}
      onCancel={onCancel}
      footer={null}
      width={860}
      destroyOnClose
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Descriptions size="small" column={2} bordered>
          <Descriptions.Item label="当前版本">
            v{sourceVersion ?? '-'}（defId={sourceDefId || '-'}）
          </Descriptions.Item>
          <Descriptions.Item label="对比版本">
            <Select
              style={{ width: 220 }}
              placeholder="选择要对比的版本"
              value={targetId}
              onChange={handleChangeTarget}
              loading={loading}
              options={others.map((v) => ({
                value: v.id,
                label: `v${v.version ?? '-'}${v.status === 1 ? '（已发布）' : v.status === 2 ? '（停用）' : '（草稿）'}`,
              }))}
            />
          </Descriptions.Item>
        </Descriptions>
        {others.length === 0 ? (
          <div style={{ color: '#999', textAlign: 'center', padding: 24 }}>
            当前流程还没有其它版本，可先「另存为新版本」后再对比。
          </div>
        ) : (
          <Tabs
            size="small"
            items={[
              {
                key: 'nodes',
                label: `节点差异（${nodeRows.length}）`,
                children: (
                  <Table<NodeRow>
                    size="small"
                    rowKey={(r) => `${r.kind}-${r.nodeKey}`}
                    loading={loading}
                    columns={nodeColumns as any}
                    dataSource={nodeRows}
                    pagination={false}
                    locale={{ emptyText: '两版本节点完全一致' }}
                  />
                ),
              },
              {
                key: 'links',
                label: `出口差异（${linkRows.length}）`,
                children: (
                  <Table<LinkRow>
                    size="small"
                    rowKey={(r) => `${r.kind}-${r.fromNodeKey}-${r.toNodeKey}`}
                    loading={loading}
                    columns={linkColumns as any}
                    dataSource={linkRows}
                    pagination={false}
                    locale={{ emptyText: '两版本出口完全一致' }}
                  />
                ),
              },
            ]}
          />
        )}
      </Space>
    </Modal>
  );
};

export default VersionDiffModal;
