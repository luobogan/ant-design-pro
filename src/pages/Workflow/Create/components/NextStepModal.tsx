import { Alert, Modal, Radio, Select, Space, Typography, message } from 'antd';
import React, { useEffect, useState } from 'react';
import { PersonOrgField } from '@/components/FormMode/PersonOrgPicker';
import { approveTask, getNextNodes } from '@/services/workflow';
import type { NextNodeCandidate, NextNodesResult } from '@/services/workflow';

const { Text } = Typography;

const SIGN_TYPES = [
  { label: '非会签（任一人通过即推进）', value: 0 },
  { label: '会签（全部通过才推进）', value: 1 },
  { label: '依次逐个处理', value: 2 },
];

export interface NextStepModalProps {
  open: boolean;
  taskId?: string;
  opinion?: string;
  onClose: () => void;
  onDone?: () => void;
}

/** 办理页「下一步设置」：选节点 / 选多人 / 选会签方式后提交。 */
const NextStepModal: React.FC<NextStepModalProps> = ({ open, taskId, opinion, onClose, onDone }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<NextNodesResult | null>(null);
  const [nodeKey, setNodeKey] = useState<string | undefined>();
  const [users, setUsers] = useState<string>('');
  const [signType, setSignType] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !taskId) return;
    setLoading(true);
    getNextNodes(taskId)
      .then((r: any) => {
        const d: NextNodesResult | undefined = r?.data;
        setData(d ?? null);
        const first = d?.nodes?.find((n: NextNodeCandidate) => n.selectable);
        setNodeKey(first?.nodeKey);
        setSignType(first?.signTypeDefault ?? 0);
      })
      .catch((e: unknown) => {
        console.error(e);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [open, taskId]);

  const submit = () => {
    if (!taskId) return;
    const ids = users.split(',').map((s) => s.trim()).filter(Boolean);
    if (!nodeKey) {
      message.warning('请选择下一步节点');
      return;
    }
    if (ids.length === 0) {
      message.warning('请选择办理人');
      return;
    }
    setSubmitting(true);
    approveTask(taskId, { opinion, nextNodeKey: nodeKey, nextAssigneeIds: ids, signType })
      .then((r: any) => {
        if (r?.code !== undefined && r.code !== 200) {
          message.error(r?.msg || '提交失败');
          return;
        }
        // 与 InstanceFlow 同口径：后端非阻断「配置提示」随 msg 返回，办理人需看见
        if (typeof r?.msg === 'string' && r.msg.includes('配置提示')) {
          message.warning(r.msg, 8);
        } else {
          message.success('已提交并流转到下一步');
        }
        onClose();
        onDone?.();
      })
      .catch((e: any) => {
        console.error(e);
        message.error(e?.msg || e?.message || '提交失败');
      })
      .finally(() => setSubmitting(false));
  };

  const nodes = data?.nodes ?? [];

  return (
    <Modal
      title="下一步设置"
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="确认提交"
      confirmLoading={submitting}
      destroyOnHidden
      width={560}
    >
      {data?.freeFlow === false ? (
        <Alert type="info" showIcon message="当前流程不是自由流程，请使用原有「提交 / 指定流转」按钮。" />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text type="secondary">下一步节点</Text>
            <Select
              style={{ width: '100%', marginTop: 6 }}
              loading={loading}
              value={nodeKey}
              onChange={(v) => setNodeKey(v)}
              placeholder="选择下一步节点"
              options={nodes.map((n) => ({
                value: n.nodeKey,
                label: `${n.nodeName}${n.selectable ? '' : `（${n.disabledReason || '不可选'}）`}`,
                disabled: !n.selectable,
              }))}
            />
          </div>
          <div>
            <Text type="secondary">办理人（可多选）</Text>
            <div style={{ marginTop: 6 }}>
              <PersonOrgField
                browserType={1}
                multiple
                value={users}
                onChange={(v: any) => setUsers(v || '')}
                placeholder="选择办理人"
              />
            </div>
          </div>
          <div>
            <Text type="secondary">会签方式</Text>
            <Radio.Group
              style={{ marginTop: 6 }}
              value={signType}
              onChange={(e) => setSignType(e.target.value)}
              options={SIGN_TYPES}
            />
          </div>
          {data && (
            <Alert
              type="warning"
              showIcon
              message={`可编排步骤上限：${data.poolSize}（由流程设计器「通用节点数量」决定，调整后需重新发布）`}
            />
          )}
        </Space>
      )}
    </Modal>
  );
};

export default NextStepModal;
