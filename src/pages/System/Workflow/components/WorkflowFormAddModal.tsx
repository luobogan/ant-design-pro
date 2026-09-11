import React, { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Select, Space, message } from 'antd';
import { pickPayload } from '@/utils/utils';
import { workflowBillApi, fieldDefinitionApi } from '@/services/formmode';

/**
 * 新建自定义表单弹窗 —— 「添加路径 → 对应表单(自定义表单)」的「+」触发。
 *
 * 与「路径类型」的 WorkflowTypeAddModal 同一套交互：点「+」就地弹出小窗，不跳转页面。
 *
 * 行为：
 *   1) 数据库表名由后端按 formtable_main_{N} 规则自动生成（getNextTableName），界面不暴露；
 *   2) 可选「从已有表单复制」：选定来源表单后，把其字段定义复制到新表单，并同步物理表；
 *   3) 创建成功后回传新表单 id，由父级刷新下拉并自动选中。
 *
 * 字段的详细设计（增删字段、布局）仍可在「表设计 / 字段管理」中继续完成。
 */
export interface WorkflowFormAddModalProps {
  open: boolean;
  onCancel: () => void;
  /** 创建成功，回传新表单 { id, formName } */
  onCreated: (form: { id: string; formName: string }) => void;
}

const WorkflowFormAddModal: React.FC<WorkflowFormAddModalProps> = ({
  open,
  onCancel,
  onCreated,
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [forms, setForms] = useState<any[]>([]);

  // 打开时加载「可复制的已有表单」
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setSubmitting(false);
    workflowBillApi
      .getAll()
      .then((res: any) => {
        const list = pickPayload(res) || [];
        setForms(list);
      })
      .catch(() => setForms([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** 复制来源表单的字段定义到新表单 */
  const copyFields = async (sourceFormId: string, targetFormId: string) => {
    const res: any = await fieldDefinitionApi.getByFormId(sourceFormId);
    const sourceFields: any[] = pickPayload(res) || [];
    for (const f of sourceFields) {
      await fieldDefinitionApi.create({
        formId: targetFormId,
        fieldName: f.fieldName,
        fieldLabel: f.fieldLabel || f.fieldName,
        fieldHtmlType: f.fieldHtmlType,
        fieldType: f.fieldType,
        fieldDbType: f.fieldDbType,
        fieldLength: f.fieldLength,
        fieldDecimals: f.fieldDecimals,
        isRequired: f.isRequired,
        isReadOnly: f.isReadOnly,
        defaultValue: f.defaultValue,
        sort: f.sort,
        description: f.description,
        status: f.status,
        options: f.options,
      });
    }
    return sourceFields.length;
  };

  const handleOk = async () => {
    let values: any;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setSubmitting(true);
    try {
      // 1) 表名按规则自动生成，不展示给用户
      const nameRes: any = await workflowBillApi.getNextTableName();
      const rawName: any = pickPayload(nameRes);
      const tableName = typeof rawName === 'string' ? rawName : rawName?.tableName;
      if (!tableName) throw new Error('自动生成表名失败');

      // 2) 创建表单定义（form_type=0 自定义表单）
      const res: any = await workflowBillApi.create({
        formName: values.formName?.trim(),
        tableName,
        description: values.description?.trim() || undefined,
        status: 1,
        formType: 0,
      });
      const created = pickPayload(res);
      const newId = String(created?.id ?? '');

      // 3) 从已有表单复制字段
      let copied = 0;
      if (values.copyFrom && newId) {
        copied = await copyFields(String(values.copyFrom), newId);
        // 按复制出的字段创建/同步物理表；失败不阻断，可在「表设计」中手动同步
        try {
          await workflowBillApi.createTable(newId);
        } catch {
          message.warning('字段已复制，但物理表同步失败，可在「表设计」中手动同步');
        }
      }

      message.success(
        copied > 0
          ? `自定义表单已创建，并复制了 ${copied} 个字段`
          : '自定义表单已创建',
      );
      // 创建后即自动选中该表单，用户可直接点「设计」进入字段配置（弹窗内，不新开页签）
      onCreated({ id: newId, formName: created?.formName || values.formName });
    } catch (e: any) {
      message.error(`创建失败：${e?.msg || e?.message || '请稍后重试'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="新建自定义表单"
      open={open}
      onCancel={onCancel}
      destroyOnClose
      maskClosable={false}
      confirmLoading={submitting}
      onOk={handleOk}
      footer={
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" loading={submitting} onClick={handleOk}>
            创建
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="formName"
          label="表单名称"
          rules={[
            { required: true, message: '请输入表单名称' },
            { max: 50, message: '表单名称不能超过50个字符' },
          ]}
        >
          <Input placeholder="如：请假申请" maxLength={50} />
        </Form.Item>

        <Form.Item name="description" label="表单描述">
          <Input.TextArea placeholder="可选" rows={3} maxLength={500} />
        </Form.Item>

        <Form.Item
          name="copyFrom"
          label="从已有表单复制"
          extra="可选：选择后会把该表单的字段定义复制过来；不选则创建空白表单。数据库表名由系统自动生成，无需填写。"
        >
          <Select
            allowClear
            showSearch
            placeholder="不复制，创建空白表单"
            options={forms.map((f: any) => ({
              value: String(f.id),
              label: f.formName || f.tableName || String(f.id),
            }))}
            filterOption={(input, option) =>
              String(option?.label ?? '').includes(input)
            }
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default WorkflowFormAddModal;
