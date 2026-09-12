import React, { useEffect, useState } from 'react';
import { Form, Input, InputNumber, Modal, Radio, Select, Switch, message } from 'antd';
import { updateNode, WfProcessNode } from '@/services/workflow';
import { buildExtJson, nodeSettings, SETTING_DEFS, SettingField } from './nodeSettings';

export interface NodeSettingModalProps {
  open: boolean;
  defId: any;
  /** 所属节点 */
  node?: WfProcessNode;
  /** 当前流程的全部节点：供 `nodeMultiSelect`（如「可见节点」）生成下拉选项 */
  nodes?: WfProcessNode[];
  /** 设置项 key（SETTING_DEFS 中的 key） */
  defKey?: string;
  /** 保存成功回调，回传新的 extJson 供父级就地更新 */
  onSaved?: (nodeKey: string, extJson: string) => void;
  /** 草稿模式：不落库，仅通过 onSaved 回传，供列表本地暂存 */
  draftMode?: boolean;
  onClose: () => void;
}

/**
 * 节点设置项编辑弹窗（schema 驱动）。
 *
 * 列表里任一「设置类」列点「设置」都复用它：字段渲染由 `SETTING_DEFS` 描述，
 * 保存时只改 `ext_json.settings[defKey]`，其余设置项与旧的 timeoutHours/remind/sign 保持不变。
 */
const NodeSettingModal: React.FC<NodeSettingModalProps> = ({
  open,
  defId,
  node,
  nodes,
  defKey,
  draftMode,
  onSaved,
  onClose,
}) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const def = SETTING_DEFS.find((d) => d.key === defKey);

  useEffect(() => {
    if (!open || !def || !node) return;
    form.setFieldsValue(nodeSettings(node)[def.key] || {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defKey, node?.nodeKey]);

  /** 节点下拉选项（nodeMultiSelect 用）：value 用 nodeKey，label 用节点名称 */
  const nodeOptions = (nodes || [])
    .filter((n) => n.nodeKey)
    .map((n) => ({ value: n.nodeKey as string, label: n.nodeName || (n.nodeKey as string) }));

  const renderField = (f: SettingField) => {
    switch (f.type) {
      case 'switch':
        return <Switch />;
      case 'number':
        return <InputNumber style={{ width: '100%' }} min={0} />;
      case 'textarea':
        return <Input.TextArea rows={3} placeholder={f.placeholder} />;
      case 'select':
        return <Select options={f.options} allowClear style={{ width: '100%' }} />;
      case 'multiSelect':
        return <Select mode="multiple" options={f.options} allowClear style={{ width: '100%' }} />;
      case 'nodeMultiSelect':
        return (
          <Select
            mode="multiple"
            options={nodeOptions}
            allowClear
            style={{ width: '100%' }}
            placeholder={f.placeholder}
            optionFilterProp="label"
            showSearch
          />
        );
      case 'radio':
        return (
          <Radio.Group>
            {f.options?.map((o) => (
              <Radio key={String(o.value)} value={o.value}>
                {o.label}
              </Radio>
            ))}
          </Radio.Group>
        );
      default:
        return <Input placeholder={f.placeholder} />;
    }
  };

  const handleOk = async () => {
    if (!node?.nodeKey || !def) return;
    let values: any;
    try {
      values = await form.validateFields();
    } catch {
      // 校验不通过：antd 已在表单上标红，这里直接中止保存
      return;
    }
    setSaving(true);
    try {
      const extJson = buildExtJson(node, (s) => {
        s[def.key] = values;
      });
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
      message.success('设置已保存');
      onClose();
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={def && node ? `${def.label}（${node.nodeName || node.nodeKey}）` : ''}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={saving}
      destroyOnClose
      width={440}
      okText="保存"
      cancelText="取消"
    >
      {def && (
        <Form form={form} layout="vertical">
          {def.fields.map((f) => (
            <Form.Item
              key={f.name}
              name={f.name}
              label={f.label}
              valuePropName={f.type === 'switch' ? 'checked' : undefined}
            >
              {renderField(f)}
            </Form.Item>
          ))}
        </Form>
      )}
    </Modal>
  );
};

export default NodeSettingModal;
