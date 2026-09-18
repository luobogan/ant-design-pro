import React, { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Modal,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import {
  simulateDefinition,
  SimulateResult,
  WfProcessNode,
} from '@/services/workflow';

export interface SimulateModalProps {
  open: boolean;
  defId: any;
  /** 节点列表（用于把 nodeKey 映射成名称，并展示逐节点校验结果） */
  nodes: WfProcessNode[];
  /** 表单字段（预留：模拟表单数据录入暂未开放，先按全量走查验证连通性） */
  formFields?: { scope: string; fieldName: string; fieldLabel: string }[];
  onClose: () => void;
  /** 模拟成功（已回写各节点测试状态）后刷新父级 nodes */
  onSaved?: () => void;
  /** 点击「在画布上演示路径」：把模拟结果交父级，由画布动画走查 */
  onPlayPath?: (result: SimulateResult) => void;
}

/** 节点类型标签（含网关 7；4 未使用） */
const NODE_TYPE: Record<number, string> = {
  0: '创建',
  1: '审批',
  2: '提交',
  3: '归档',
  5: '等待',
  6: '自动处理',
  7: '网关',
};

const testStatusTag = (s?: number) => {
  switch (s) {
    case 1:
      return <Tag color="green">通过</Tag>;
    case 2:
      return <Tag color="red">未通过</Tag>;
    default:
      return <Tag color="default">未测试</Tag>;
  }
};

/**
 * 流程模拟运行弹窗（设计期校验）。
 *
 * 用户按表单字段填一份「模拟表单数据」，点「运行模拟」后后端从开始节点出发，
 * 按各出口条件（结合模拟数据）选择分支，逐节点校验配置是否足以正常流转，
 * 并回写每个节点的测试状态。全部通过后方可生成出口属性（条件/退回/必经）。
 */
const SimulateModal: React.FC<SimulateModalProps> = ({
  open,
  defId,
  nodes,
  formFields,
  onClose,
  onSaved,
  onPlayPath,
}) => {
  /** 模拟表单数据（暂未开放录入，按全量走查） */
  const [formData] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SimulateResult | null>(null);
  const [loading, setLoading] = useState(false);

  const nodeName = (key?: string) =>
    nodes.find((n) => n.nodeKey === key)?.nodeName || key || '-';

  const run = async () => {
    setLoading(true);
    try {
      const r: any = await simulateDefinition(defId, formData);
      if (r?.success === false) {
        message.error('模拟运行失败');
        return;
      }
      setResult(r?.data || null);
      onSaved?.();
    } catch {
      message.error('模拟运行失败');
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    setResult(null);
    onClose();
  };

  const pathText = (result?.path || [])
    .map((s) => {
      const seg = `${nodeName(s.fromNodeKey)} → ${nodeName(s.toNodeKey)}`;
      return s.conditionCn ? `${seg}（${s.conditionCn}）` : seg;
    })
    .join('  ｜  ');

  return (
    <Modal
      title="流程模拟运行"
      open={open}
      onCancel={close}
      width={760}
      footer={
        <Space>
          {result && onPlayPath && (
            <Button
              onClick={() => {
                onPlayPath(result);
                onClose();
              }}
            >
              在画布上演示路径
            </Button>
          )}
          <Button onClick={close}>关闭</Button>
          <Button type="primary" loading={loading} onClick={run}>
            运行模拟
          </Button>
        </Space>
      }
      destroyOnClose
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="模拟运行用于设计期校验：本次按「全量走查」从起点出发遍历所有分支，校验流程图是否连通、有无死路（线画错/漏连）；全部走通后方可生成出口属性。"
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="模拟表单数据录入已暂时关闭：本次按「全量走查」验证流程图是否能从起点连通到各终点；未连通或终点前断线的节点会标红提醒。"
      />

      {result ? (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            type={result.allPassed ? 'success' : 'error'}
            showIcon
            message={result.summary}
          />
          <Card size="small" title="流转路径">
            <div style={{ lineHeight: '22px', fontSize: 13 }}>{pathText || '（无路径）'}</div>
          </Card>
          <Card size="small" title="逐节点校验结果">
            <Table<SimulateResult['nodes'][number]>
              size="small"
              rowKey={(r) => String(r.nodeKey)}
              dataSource={result.nodes || []}
              pagination={false}
              columns={[
                {
                  title: '节点',
                  dataIndex: 'nodeName',
                  render: (v: string, r) => (
                    <Space size={6}>
                      {v || r.nodeKey}
                      <Tag>{NODE_TYPE[r.nodeType ?? 0]}</Tag>
                    </Space>
                  ),
                },
                {
                  title: '测试状态',
                  dataIndex: 'status',
                  width: 100,
                  render: (s: number) => testStatusTag(s),
                },
                {
                  title: '说明',
                  dataIndex: 'message',
                  render: (v: string) => <span style={{ color: v?.includes('未') ? '#cf1322' : '#666' }}>{v}</span>,
                },
              ]}
            />
          </Card>
        </Space>
      ) : (
        <div style={{ color: '#999', fontSize: 12 }}>
          填写模拟数据后点「运行模拟」，将展示流转路径与逐节点校验结果。
        </div>
      )}
    </Modal>
  );
};

export default SimulateModal;
