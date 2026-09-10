import React, { useEffect, useState } from 'react';
import { Button, Form, Input, InputNumber, Modal, Space, message } from 'antd';
import { createWorkflowType, FormFieldOption } from '@/services/workflow';

/**
 * 新增路径类型弹窗 —— 浏览框 wftype「+」触发（对齐 ecology 浏览框新增）。
 *
 * 提交经 POST /definition/browser/wftype 落库 wf_workflow_type，
 * 成功后回写新选项（含自增主键），由父级直接选中。
 */
export interface WorkflowTypeAddModalProps {
  open: boolean;
  onCancel: () => void;
  /** 创建成功，回传新选项 */
  onCreated: (option: FormFieldOption) => void;
}

const WorkflowTypeAddModal: React.FC<WorkflowTypeAddModalProps> = ({
  open,
  onCancel,
  onCreated,
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  const handleOk = async () => {
    let values: any;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setSubmitting(true);
    try {
      const res: any = await createWorkflowType({
        typeName: values.typeName?.trim(),
        typeDesc: values.typeDesc?.trim() || undefined,
        sortOrder: values.sortOrder ?? 0,
      });
      const opt: FormFieldOption = res?.data || {};
      message.success('路径类型已添加');
      onCreated(opt);
    } catch (e: any) {
      message.error(`添加失败：${e?.msg || e?.message || '请稍后重试'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="新增路径类型"
      open={open}
      onCancel={onCancel}
      destroyOnClose
      maskClosable={false}
      footer={
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" loading={submitting} onClick={handleOk}>
            确定
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" initialValues={{ sortOrder: 0 }}>
        <Form.Item
          name="typeName"
          label="路径类型名称"
          rules={[{ required: true, message: '请输入路径类型名称' }]}
        >
          <Input placeholder="如：采购流程" maxLength={100} />
        </Form.Item>
        <Form.Item name="typeDesc" label="类型描述">
          <Input.TextArea placeholder="可选" rows={3} maxLength={500} />
        </Form.Item>
        <Form.Item name="sortOrder" label="显示顺序">
          <InputNumber min={0} max={99999999} style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default WorkflowTypeAddModal;
