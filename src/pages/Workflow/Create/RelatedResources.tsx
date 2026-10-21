import React, { useEffect, useState } from 'react';
import { Empty, Table, Tabs, Tag } from 'antd';
import { instanceResources } from '@/services/workflow';
import type { WfInstanceResource } from '@/services/workflow';

/**
 * 实例「相关资源」页签（对齐 ecology 请求页「相关资源」）
 *
 * <p>与 ecology 同思路：**不建关联表**，由后端按「资源类表单字段」
 * （相关流程 30/31/32、相关文档 24/26、附件上传 5）从业务数据抽取汇总，本组件只负责展示。</p>
 *
 * <p>显示条件：实例存在即显示（由调用方保证 instanceId 有效）。</p>
 */

const RES_TYPE_META: Record<number, { label: string; color: string }> = {
  1: { label: '相关流程', color: 'blue' },
  2: { label: '相关文档', color: 'green' },
  3: { label: '相关附件', color: 'orange' },
};

/** 打开相关流程：复用发起页的实例视图（mode=instance） */
const openInstance = (id: string) => {
  window.open(`/workflow/create/start?mode=instance&instanceId=${id}`, '_blank');
};

export interface RelatedResourcesProps {
  /** 流程实例ID（存在才渲染本组件） */
  instanceId?: string;
}

const RelatedResources: React.FC<RelatedResourcesProps> = ({ instanceId }) => {
  const [type, setType] = useState<string>('0');
  const [rows, setRows] = useState<WfInstanceResource[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!instanceId) {
      setRows([]);
      return;
    }
    setLoading(true);
    instanceResources(instanceId, Number(type))
      .then((res: any) => {
        if (!alive) return;
        const list = (res?.data ?? res ?? []) as WfInstanceResource[];
        setRows(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (alive) setRows([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [instanceId, type]);

  return (
    <div style={{ padding: '4px 0' }}>
      <Tabs
        size="small"
        activeKey={type}
        onChange={setType}
        items={[
          { key: '0', label: '全部' },
          { key: '1', label: '相关流程' },
          { key: '2', label: '相关文档' },
          { key: '3', label: '相关附件' },
        ]}
      />
      <Table
        size="small"
        loading={loading}
        rowKey={(r) => `${r.resType}-${r.resId}`}
        pagination={false}
        dataSource={rows}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无相关资源（在表单中填写「相关流程 / 相关文档 / 附件」字段后可见）"
            />
          ),
        }}
        columns={[
          {
            title: '类型',
            dataIndex: 'resType',
            width: 100,
            render: (v: number) => {
              const m = RES_TYPE_META[v];
              return m ? <Tag color={m.color}>{m.label}</Tag> : v ?? '-';
            },
          },
          {
            title: '名称',
            dataIndex: 'resName',
            render: (v: string, r: any) =>
              // 相关流程可点开；文档/附件暂仅展示名称
              r.resType === 1 ? (
                <a onClick={() => openInstance(String(r.resId))}>{v || r.resId}</a>
              ) : (
                v || r.resId
              ),
          },
          { title: '创建人', dataIndex: 'creator', width: 140 },
          { title: '创建时间', dataIndex: 'createTime', width: 180 },
        ]}
      />
    </div>
  );
};

export default RelatedResources;
