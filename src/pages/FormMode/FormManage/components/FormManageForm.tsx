import { ProForm, ProFormText, ProFormTextArea, ProFormSwitch, ProFormDigit } from '@ant-design/pro-components';
import React, { useMemo } from 'react';
import type { WorkflowBill, WorkflowBillFormData } from '@/services/formmode/typings';

interface FormManageFormProps {
  formDefinition?: WorkflowBill;
  onSubmit: (data: WorkflowBillFormData) => void;
  onCancel: () => void;
  submitting?: boolean;
  mode?: 'add' | 'edit';
}

/**
 * 表单管理表单组件
 */
const FormManageForm: React.FC<FormManageFormProps> = ({
  formDefinition,
  onSubmit,
  onCancel,
  submitting = false,
  mode = 'add',
}) => {
  // 从 formDefinition 生成初始值
  const initialValues = useMemo(() => {
    if (!formDefinition) return undefined;
    return {
      formName: formDefinition.formName,
      tableName: formDefinition.tableName,
      description: formDefinition.description,
      status: formDefinition.status,
      moduleId: formDefinition.moduleId,
    };
  }, [formDefinition]);

  return (
    <ProForm
      initialValues={initialValues}
      onFinish={async (values) => {
        await onSubmit(values as WorkflowBillFormData);
      }}
      submitter={{
        searchConfig: {
          submitText: '保存',
          resetText: '重置',
        },
        submitButtonProps: {
          loading: submitting,
        },
      }}
    >
      <ProFormText
        name="formName"
        label="表单名称"
        placeholder="请输入表单名称"
        rules={[
          { required: true, message: '请输入表单名称' },
          { max: 50, message: '表单名称不能超过50个字符' },
        ]}
      />

      <ProFormText
        name="tableName"
        label="数据库表名"
        placeholder="请输入数据库表名"
        rules={[
          { required: true, message: '请输入数据库表名' },
          { max: 50, message: '数据库表名不能超过50个字符' },
          {
            pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/,
            message: '数据库表名只能包含字母、数字和下划线，且必须以字母开头',
          },
        ]}
      />

      <ProFormTextArea
        name="description"
        label="表单描述"
        placeholder="请输入表单描述"
        rules={[
          { max: 500, message: '表单描述不能超过500个字符' },
        ]}
      />

      <ProFormSwitch
        name="status"
        label="启用状态"
        checkedChildren="启用"
        unCheckedChildren="禁用"
        initialValue={1}
      />

      <ProFormDigit
        name="moduleId"
        label="模块ID"
        placeholder="请输入模块ID"
        min={0}
      />
    </ProForm>
  );
};

export default FormManageForm;
