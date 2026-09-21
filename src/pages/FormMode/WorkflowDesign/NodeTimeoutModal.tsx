import React, { useEffect, useState } from 'react';
import {
  Button,
  Checkbox,
  Divider,
  Empty,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  message,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { listNodeTimeouts, saveNodeTimeouts, WfNodeTimeout, WfProcessNode } from '@/services/workflow';

const { Option } = Select;

const START_TYPES = [
  { label: '节点到达（收到待办）', value: 1 },
  { label: '表单时间字段', value: 2 },
];
const END_TYPES = [
  { label: '相对时长（起算+时长）', value: 1 },
  { label: '固定时刻（每日 HH:mm）', value: 2 },
  { label: '表单时间字段', value: 3 },
];
const ACTION_WAYS = [
  { label: '自动通过', value: 'autoApprove' },
  { label: '流转（同自动通过语义）', value: 'forward' },
  { label: '指定操作者', value: 'assign' },
  { label: '提醒', value: 'remind' },
];
const REMIND_TYPES = [
  { label: '流程提醒', value: 'sys' },
  { label: '短信', value: 'ml' },
  { label: '邮件', value: 'sm' },
];

export interface NodeTimeoutModalProps {
  open: boolean;
  defId: any;
  node?: WfProcessNode | null;
  onClose: () => void;
}

const emptyRule = (): WfNodeTimeout => ({
  enabled: 1,
  startType: 1,
  endType: 1,
  durationMin: 60,
  actionWay: 'autoApprove',
  remindBeforeOperator: 0,
  seq: 0,
});

/**
 * 节点超时规则编辑器（对齐泛微节点信息「超时设置」）。
 *
 * 多条规则按 seq 升序；每条规则配置：起算方式（节点到达/表单时间字段）、
 * 截止方式（相对时长/固定时刻/表单时间字段）、超时动作（自动通过/流转/指定操作者/提醒）与提醒通道。
 * 保存即覆盖该节点全部规则（后端 wf_node_timeout）。
 */
const NodeTimeoutModal: React.FC<NodeTimeoutModalProps> = ({ open, defId, node, onClose }) => {
  const [rules, setRules] = useState<WfNodeTimeout[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && defId && node?.nodeKey) {
      setLoading(true);
      listNodeTimeouts(Number(defId), node.nodeKey)
        .then((r: any) => setRules(Array.isArray(r?.data) ? r.data : []))
        .catch(() => setRules([]))
        .finally(() => setLoading(false));
    }
  }, [open, defId, node?.nodeKey]);

  const update = (idx: number, patch: Partial<WfNodeTimeout>) =>
    setRules((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const onSave = async () => {
    if (!defId || !node?.nodeKey) return;
    // 清理提交：去掉空字段，seq 重排
    const payload = rules
      .filter((r) => r.actionWay)
      .map((r, i) => ({ ...r, seq: i }));
    setSaving(true);
    try {
      await saveNodeTimeouts(Number(defId), node.nodeKey!, payload);
      message.success('超时规则已保存');
      onClose();
    } catch (e: any) {
      message.error(e?.msg || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`超时设置 · ${node?.nodeName || node?.nodeKey || ''}`}
      open={open}
      width={760}
      onCancel={onClose}
      onOk={onSave}
      confirmLoading={saving}
      okText="保存"
      destroyOnClose
    >
      {loading ? (
        <Empty description="加载中…" />
      ) : (
        <div>
          {rules.length === 0 && <Empty description="暂无超时规则" />}
          {rules.map((r, idx) => (
            <div
              key={idx}
              style={{ border: '1px solid #eee', borderRadius: 6, padding: 12, marginBottom: 12 }}
            >
              <Space wrap size={12}>
                <span>启用</span>
                <Switch
                  checked={r.enabled !== 0}
                  onChange={(v) => update(idx, { enabled: v ? 1 : 0 })}
                />
                <span>起算</span>
                <Select
                  value={r.startType ?? 1}
                  style={{ width: 170 }}
                  onChange={(v) => update(idx, { startType: v })}
                >
                  {START_TYPES.map((o) => (
                    <Option key={o.value} value={o.value}>
                      {o.label}
                    </Option>
                  ))}
                </Select>
                {r.startType === 2 && (
                  <Input
                    placeholder="表单字段名"
                    style={{ width: 140 }}
                    value={r.startField}
                    onChange={(e) => update(idx, { startField: e.target.value })}
                  />
                )}
                <span>截止</span>
                <Select
                  value={r.endType ?? 1}
                  style={{ width: 180 }}
                  onChange={(v) => update(idx, { endType: v })}
                >
                  {END_TYPES.map((o) => (
                    <Option key={o.value} value={o.value}>
                      {o.label}
                    </Option>
                  ))}
                </Select>
                {r.endType === 1 && (
                  <InputNumber
                    min={1}
                    placeholder="分钟"
                    style={{ width: 100 }}
                    value={r.durationMin}
                    onChange={(v) => update(idx, { durationMin: v ?? undefined })}
                  />
                )}
                {r.endType === 2 && (
                  <Input
                    placeholder="HH:mm"
                    style={{ width: 100 }}
                    value={r.endFixedTime}
                    onChange={(e) => update(idx, { endFixedTime: e.target.value })}
                  />
                )}
                {r.endType === 3 && (
                  <Input
                    placeholder="表单字段名"
                    style={{ width: 140 }}
                    value={r.endField}
                    onChange={(e) => update(idx, { endField: e.target.value })}
                  />
                )}
              </Space>
              <Divider style={{ margin: '10px 0' }} />
              <Space wrap size={12}>
                <span>动作</span>
                <Select
                  value={r.actionWay || 'autoApprove'}
                  style={{ width: 180 }}
                  onChange={(v) => update(idx, { actionWay: v })}
                >
                  {ACTION_WAYS.map((o) => (
                    <Option key={o.value} value={o.value}>
                      {o.label}
                    </Option>
                  ))}
                </Select>
                {r.actionWay === 'assign' && (
                  <Input
                    placeholder="指定操作者（人力资源ID，逗号分隔）"
                    style={{ width: 240 }}
                    value={r.operatorIds}
                    onChange={(e) => update(idx, { operatorIds: e.target.value })}
                  />
                )}
                <Input
                  placeholder="动作意见"
                  style={{ width: 200 }}
                  value={r.opinion}
                  onChange={(e) => update(idx, { opinion: e.target.value })}
                />
              </Space>
              <Divider style={{ margin: '10px 0' }} />
              <Space wrap size={12}>
                <span>提醒方式</span>
                <Checkbox.Group
                  options={REMIND_TYPES}
                  value={(r.remindTypes || '').split(',').filter(Boolean)}
                  onChange={(vals) => update(idx, { remindTypes: vals.join(',') })}
                />
                <span>提醒对象·处理人本人</span>
                <Switch
                  checked={r.remindBeforeOperator === 1}
                  onChange={(v) => update(idx, { remindBeforeOperator: v ? 1 : 0 })}
                />
                <Input
                  placeholder="指定提醒人（人力资源ID，逗号分隔）"
                  style={{ width: 220 }}
                  value={r.remindPersons}
                  onChange={(e) => update(idx, { remindPersons: e.target.value })}
                />
              </Space>
              <div style={{ textAlign: 'right', marginTop: 8 }}>
                <Button
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => setRules((prev) => prev.filter((_, i) => i !== idx))}
                >
                  删除规则
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            block
            onClick={() => setRules((prev) => [...prev, emptyRule()])}
          >
            添加超时规则
          </Button>
        </div>
      )}
    </Modal>
  );
};

export default NodeTimeoutModal;
