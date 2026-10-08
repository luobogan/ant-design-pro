import { SwapOutlined } from '@ant-design/icons';
import { useRequest } from '@umijs/max';
import {
  Alert,
  Button,
  Divider,
  Empty,
  Input,
  Modal,
  Radio,
  Space,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd';
import React, { useState } from 'react';
import * as userApi from '@/services/system/user';

export interface StatusFlowUser {
  id: string;
  realName?: string;
  name?: string;
  workCode?: string;
  personStatus?: number;
}

interface UserStatusFlowModalProps {
  open: boolean;
  user: StatusFlowUser | null;
  onCancel: () => void;
  onOk: () => void;
}

/** 流转状态 -> Tag 配色/文案 */
const FLOW_STATUS_TAG: Record<number, { color: string; text: string }> = {
  0: { color: 'processing', text: '审批中' },
  1: { color: 'success', text: '已通过' },
  2: { color: 'error', text: '已驳回' },
};

/** 人员状态 Tag 配色：在职态绿、解聘(4) 灰红 */
const personStatusColor = (status?: number) => {
  if (status === undefined || status === null) return 'default';
  if (status === 4) return 'red';
  if (status === 5) return 'gold';
  return status === 0 || status === 1 ? 'green' : 'blue';
};

/**
 * 办理状态变更弹窗（P3-2，对齐 ecology HrmResourceTryAction/FireAction）
 * 命中配置则发起审批流程，未配置流程时后端降级为直接变更。
 */
const UserStatusFlowModal: React.FC<UserStatusFlowModalProps> = ({
  open,
  user,
  onCancel,
  onOk,
}) => {
  const [toStatus, setToStatus] = useState<number | undefined>(undefined);
  const [opinion, setOpinion] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const userId = user?.id;

  // 可用流转（按用户当前状态）
  const { data: availableRes, refresh: refreshAvailable } = useRequest(
    () => (userId ? userApi.statusFlowAvailable({ userId }) : Promise.resolve(null)),
    { refreshDeps: [userId, open] },
  );
  const available: userApi.PersonStatusFlow[] = normalizeFlows(availableRes);

  // 历史流转记录（流转进度）
  const { data: recordsRes, refresh: refreshRecords } = useRequest(
    () => (userId ? userApi.statusFlowRecords({ userId }) : Promise.resolve(null)),
    { refreshDeps: [userId, open] },
  );
  const records: userApi.PersonStatusFlowRecord[] = Array.isArray(recordsRes?.data)
    ? recordsRes.data
    : Array.isArray(recordsRes)
      ? recordsRes
      : [];

  const handleSubmit = async () => {
    if (!userId) return;
    if (toStatus === undefined) {
      message.warning('请选择要变更为的状态');
      return;
    }
    if (!opinion.trim()) {
      message.warning('请填写办理说明');
      return;
    }
    setSubmitting(true);
    try {
      const res: any = await userApi.startStatusFlow({
        userId,
        toStatus,
        opinion: opinion.trim(),
      });
      if (res?.code !== undefined && res.code !== 200) {
        message.error(res?.msg || '办理失败');
        return;
      }
      message.success(res?.msg || '已提交办理');
      setToStatus(undefined);
      setOpinion('');
      refreshRecords();
      refreshAvailable();
      onOk();
    } catch (_error) {
      message.error('办理失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <SwapOutlined />
          <span>办理状态变更</span>
        </Space>
      }
      open={open}
      onCancel={onCancel}
      width={720}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={submitting}
          disabled={available.length === 0}
          onClick={handleSubmit}
        >
          提交办理
        </Button>,
      ]}
    >
      {/* 区块一：当前状态（只读，避免误操作） */}
      <div style={{ marginBottom: 8 }}>
        <Typography.Text type="secondary">当前状态</Typography.Text>
        <div style={{ marginTop: 8 }}>
          <Space size={8} wrap>
            <Tag color="blue">
              {user?.realName || user?.name || '-'}
              {user?.workCode ? `（${user.workCode}）` : ''}
            </Tag>
            <Tag color={personStatusColor(user?.personStatus)}>
              {userApi.PERSON_STATUS_TEXT[user?.personStatus as number] || '-'}
            </Tag>
          </Space>
        </div>
      </div>

      <Divider />

      {/* 区块二：变更为（单选卡片组，来自配置表） */}
      <div style={{ marginBottom: 8 }}>
        <Typography.Text type="secondary">变更为</Typography.Text>
        <div style={{ marginTop: 8 }}>
          {available.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="当前状态没有可办理的流转配置"
            />
          ) : (
            <Radio.Group
              value={toStatus}
              onChange={(e) => setToStatus(e.target.value)}
              style={{ width: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {available.map((flow) => (
                  <Radio key={flow.id} value={flow.toStatus}>
                    <Space size={6}>
                      <span>{flow.flowName || userApi.PERSON_STATUS_TEXT[flow.toStatus]}</span>
                      <Tag color={personStatusColor(flow.toStatus)}>
                        {userApi.PERSON_STATUS_TEXT[flow.toStatus]}
                      </Tag>
                      <Tag color={flow.flowKey ? 'processing' : 'default'}>
                        {flow.flowKey ? '需审批' : '直接变更'}
                      </Tag>
                    </Space>
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
          )}
        </div>
      </div>

      <Divider />

      {/* 区块三：办理说明 */}
      <div style={{ marginBottom: 8 }}>
        <Typography.Text type="secondary">办理说明</Typography.Text>
        <Input.TextArea
          rows={3}
          value={opinion}
          onChange={(e) => setOpinion(e.target.value)}
          placeholder="请填写办理/审批意见"
          style={{ marginTop: 8 }}
        />
      </div>

      <Divider />

      {/* 区块四：流转进度 */}
      <div>
        <Typography.Text type="secondary">流转进度</Typography.Text>
        <div style={{ marginTop: 12 }}>
          {records.length === 0 ? (
            <Alert type="info" showIcon message="暂无流转记录" />
          ) : (
            <Timeline
              items={records.map((rec) => {
                const tag = FLOW_STATUS_TAG[rec.flowStatus] || {
                  color: 'default',
                  text: '未知',
                };
                return {
                  color: rec.flowStatus === 1 ? 'green' : rec.flowStatus === 2 ? 'red' : 'blue',
                  children: (
                    <Space size={6} wrap>
                      <span>
                        {userApi.PERSON_STATUS_TEXT[rec.fromStatus as number] || '-'}
                        {' → '}
                        <Tag color={personStatusColor(rec.toStatus)}>
                          {userApi.PERSON_STATUS_TEXT[rec.toStatus]}
                        </Tag>
                      </span>
                      <Tag color={tag.color}>{tag.text}</Tag>
                      <Tag>{rec.mode === 1 ? '流程审批' : '直接变更'}</Tag>
                      <Typography.Text type="secondary">
                        {rec.finishTime || rec.createTime || ''}
                      </Typography.Text>
                      {rec.opinion ? (
                        <Typography.Text type="secondary">说明：{rec.opinion}</Typography.Text>
                      ) : null}
                    </Space>
                  ),
                };
              })}
            />
          )}
        </div>
      </div>
    </Modal>
  );
};

/** 归一化可用流转（兼容 R 包装与裸数组） */
function normalizeFlows(res: any): userApi.PersonStatusFlow[] {
  const raw = Array.isArray(res) ? res : res?.data || [];
  return Array.isArray(raw) ? raw : [];
}

export default UserStatusFlowModal;
