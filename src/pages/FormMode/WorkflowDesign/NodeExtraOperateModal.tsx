import React, { useEffect, useState } from 'react';
import { Alert, Form, Input, Modal, Radio, Select, message } from 'antd';
import { updateNode, WfProcessNode } from '@/services/workflow';
import { EXTRA_OPERATE_TYPES, FAIL_MODES } from './wfDict';
import { buildExtJson, nodeSettings, normalizeExtraOperate } from './nodeSettings';

export type ExtraOperateField = 'preOperate' | 'postOperate';

export interface NodeExtraOperateModalProps {
  open: boolean;
  defId: any;
  /** 目标设置项：节点前 / 节点后附加操作 */
  field: ExtraOperateField;
  /** 所属节点（草稿行由调用方组装成带 extJson 的伪节点） */
  node?: WfProcessNode;
  /** 草稿模式：不落库，仅通过 onSaved 回传新的 extJson */
  draftMode?: boolean;
  onSaved?: (nodeKey: string, extJson: string) => void;
  onClose: () => void;
}

/** 各操作类型下「目标 / 内容」两个输入框的文案（对齐 E9 附加操作按类型切换输入项） */
const TYPE_FIELD_LABELS: Record<
  string,
  { target: string; payload: string; targetPh?: string; payloadPh?: string }
> = {
  fieldAssign: {
    target: '目标字段',
    payload: '赋值表达式',
    targetPh: '如：amount',
    payloadPh: '如：${price} * ${qty}（支持引用其它字段）',
  },
  updateTable: {
    target: '业务表',
    payload: '更新内容',
    targetPh: '如：biz_order',
    payloadPh: '如：status=2, remark=已审批（多个用逗号分隔）',
  },
  callApi: {
    target: '接口地址',
    payload: '请求体(JSON)',
    targetPh: '如：https://api.xxx.com/notify',
    payloadPh: '如：{"billId":"${billId}"}',
  },
  sendMsg: {
    target: '接收人',
    payload: '消息内容',
    targetPh: '如：${operator}（支持字段/变量）',
    payloadPh: '如：您有一张单据待处理',
  },
  script: {
    target: '附加目标(可选)',
    payload: '执行参数(可选)',
    targetPh: '可留空',
    payloadPh: '可留空',
  },
};

/**
 * 节点「前 / 后附加操作」配置弹窗（对齐 ecology E9 节点前后附加操作）。
 *
 * E9 里该配置是独立弹窗：先选**操作类型**（字段赋值 / 更新业务表 / 调用接口 / 发送消息 / 自定义脚本），
 * 再按类型填**目标**与**内容**，另可写自定义脚本、指定**执行失败时**的处理与备注。
 * 存储到 ext_json.settings[preOperate|postOperate]。
 */
const NodeExtraOperateModal: React.FC<NodeExtraOperateModalProps> = ({
  open,
  defId,
  field,
  node,
  draftMode,
  onSaved,
  onClose,
}) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<string>('none');

  useEffect(() => {
    if (!open || !node) return;
    const v = normalizeExtraOperate(nodeSettings(node)[field]);
    setType(v.type);
    form.setFieldsValue(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, field, node?.nodeKey, node?.extJson]);

  const labels = TYPE_FIELD_LABELS[type] || TYPE_FIELD_LABELS.script;
  const showTargetPayload = type !== 'none';
  const isScriptType = type === 'script';

  const handleOk = async () => {
    if (!node?.nodeKey) return;
    let values: any;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    if (type === 'none') {
      values = { type: 'none' };
    }
    const payload = {
      type: values.type || 'none',
      target: values.target || '',
      payload: values.payload || '',
      script: values.script || '',
      failMode: values.failMode || 'continue',
      remark: values.remark || '',
    };
    const extJson = buildExtJson(node, (s) => {
      s[field] = payload;
    });

    setSaving(true);
    try {
      if (draftMode) {
        onSaved?.(node.nodeKey, extJson);
        onClose();
        return;
      }
      const r: any = await updateNode(defId, node.nodeKey, { extJson });
      if (r?.success === false) {
        message.error('保存失败');
        return;
      }
      onSaved?.(node.nodeKey, extJson);
      message.success(field === 'preOperate' ? '节点前附加操作已保存' : '节点后附加操作已保存');
      onClose();
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`${field === 'preOperate' ? '节点前附加操作' : '节点后附加操作'}${
        node ? `（${node.nodeName || node.nodeKey}）` : ''
      }`}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={saving}
      destroyOnClose
      width={620}
      okText="保存"
      cancelText="取消"
    >
      <Form form={form} layout="vertical" initialValues={{ type: 'none', failMode: 'continue' }}>
        <Form.Item name="type" label="操作类型">
          <Select
            options={EXTRA_OPERATE_TYPES}
            onChange={(v) => setType(String(v))}
            style={{ width: 220 }}
          />
        </Form.Item>

        {showTargetPayload && (
          <>
            <Form.Item name="target" label={labels.target}>
              <Input placeholder={labels.targetPh} allowClear />
            </Form.Item>
            <Form.Item name="payload" label={labels.payload}>
              <Input.TextArea rows={3} placeholder={labels.payloadPh} />
            </Form.Item>
          </>
        )}

        <Form.Item
          name="script"
          label="自定义脚本"
          extra={
            isScriptType
              ? '随节点动作前后执行；可用 ${字段名} 引用表单字段'
              : '可选：作为该附加动作的补充脚本'
          }
        >
          <Input.TextArea
            rows={5}
            placeholder={'// 例：\n// if (amount > 10000) { reject("金额超限"); }'}
          />
        </Form.Item>

        <Form.Item name="failMode" label="执行失败时">
          <Radio.Group options={FAIL_MODES.map((o) => ({ label: o.label, value: o.value }))} />
        </Form.Item>

        <Form.Item name="remark" label="备注">
          <Input placeholder="便于维护的说明文字" allowClear />
        </Form.Item>
      </Form>

      <Alert
        type="info"
        showIcon
        style={{ marginTop: 4 }}
        message="附加操作在节点动作（提交/退回等）之前 / 之后执行；「中断」会在附加操作失败时终止本次流转。"
      />
    </Modal>
  );
};

export default NodeExtraOperateModal;
