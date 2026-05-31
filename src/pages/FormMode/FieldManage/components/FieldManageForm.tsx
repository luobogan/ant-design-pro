import {
  ProForm,
  ProFormText,
  ProFormTextArea,
  ProFormSwitch,
  ProFormDigit,
  ProFormSelect,
  ProFormDependency,
} from '@ant-design/pro-components';
import React, { useEffect, useState, useMemo } from 'react';
import { fieldApi } from '@/services/formmode';
import type { FieldDefinitionFormData, FieldTypeInfo } from '@/services/formmode/typings';

interface FieldManageFormProps {
  initialValues?: Partial<FieldDefinitionFormData>;
  onFinish: (values: FieldDefinitionFormData) => void;
  loading?: boolean;
  formId?: string;
}

/**
 * 字段管理表单组件
 */
const FieldManageForm: React.FC<FieldManageFormProps> = ({
  initialValues,
  onFinish,
  loading = false,
  formId,
}) => {
  const [fieldTypes, setFieldTypes] = useState<FieldTypeInfo[]>([]);

  // 获取字段类型列表
  const fetchFieldTypes = async () => {
    try {
      const result = await fieldApi.getFieldTypes();
      setFieldTypes(result || []);
    } catch (error) {
      console.error('获取字段类型失败:', error);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchFieldTypes();
  }, []);

  // 根据 fieldHtmlType 和 fieldType 确定数据库类型
  const getDbTypeByFieldType = (htmlType: number, type: number): string => {
    // 根据泛微系统的字段类型映射，确定数据库类型
    if (htmlType === 1) {
      // 文本字段
      return 'varchar';
    } else if (htmlType === 2) {
      // 浏览按钮
      return 'varchar';
    } else if (htmlType === 3) {
      // 选择框
      return 'varchar';
    } else if (htmlType === 4) {
      // 附件上传
      return 'varchar';
    } else if (htmlType === 5) {
      // 特殊字段
      if (type === 1) return 'date'; // 日期
      if (type === 2) return 'datetime'; // 时间
      return 'varchar';
    } else if (htmlType === 6) {
      // 复选框
      return 'int';
    } else if (htmlType === 8) {
      // 下拉选择框
      return 'varchar';
    } else if (htmlType === 9) {
      // 树形选择
      return 'varchar';
    }
    return 'varchar';
  };

  // 使用 useMemo 生成初始值
  const memoizedInitialValues = useMemo(() => {
    return {
      ...initialValues,
      isRequired: initialValues?.isRequired ?? 0,
      isReadOnly: initialValues?.isReadOnly ?? 0,
      isDisabled: initialValues?.isDisabled ?? 0,
      status: initialValues?.status ?? 1,
      sort: initialValues?.sort ?? 0,
      formId: initialValues?.formId ?? formId,
    };
  }, [initialValues, formId]);

  return (
    <ProForm
      initialValues={memoizedInitialValues}
      onFinish={async (values) => {
        // 根据字段类型自动设置数据库类型
        if (values.fieldHtmlType !== undefined && values.fieldType !== undefined) {
          values.fieldDbType = getDbTypeByFieldType(values.fieldHtmlType, values.fieldType);
        }
        await onFinish(values as FieldDefinitionFormData);
      }}
      submitter={{
        searchConfig: {
          submitText: '保存',
          resetText: '重置',
        },
        submitButtonProps: {
          loading,
        },
      }}
    >
      <ProFormText
        name="fieldName"
        label="字段名称"
        placeholder="请输入字段名称（数据库字段名）"
        rules={[
          { required: true, message: '请输入字段名称' },
          { max: 50, message: '字段名称不能超过50个字符' },
          {
            pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/,
            message: '字段名称只能包含字母、数字和下划线，且必须以字母开头',
          },
        ]}
      />

      <ProFormText
        name="fieldLabel"
        label="字段标签"
        placeholder="请输入字段标签（显示名称）"
        rules={[
          { required: true, message: '请输入字段标签' },
          { max: 50, message: '字段标签不能超过50个字符' },
        ]}
      />

      <ProFormSelect
        name="fieldHtmlType"
        label="字段HTML类型"
        placeholder="请选择字段HTML类型"
        rules={[{ required: true, message: '请选择字段HTML类型' }]}
        options={[
          { value: 1, label: '文本字段' },
          { value: 2, label: '浏览按钮' },
          { value: 3, label: '选择框' },
          { value: 4, label: '附件上传' },
          { value: 5, label: '特殊字段' },
          { value: 6, label: '复选框' },
          { value: 8, label: '下拉选择框' },
          { value: 9, label: '树形选择' },
        ]}
      />

      <ProFormDependency name={['fieldHtmlType']}>
        {({ fieldHtmlType }) => {
          // 根据 fieldHtmlType 动态生成 fieldType 的选项
          let typeOptions: { value: number; label: string }[] = [];

          if (fieldHtmlType === 1) {
            typeOptions = [
              { value: 1, label: '单行文本' },
              { value: 2, label: '多行文本' },
              { value: 3, label: '保密字段' },
            ];
          } else if (fieldHtmlType === 2) {
            typeOptions = [
              { value: 1, label: '人力资源' },
              { value: 2, label: '部门' },
              { value: 3, label: '角色' },
              { value: 4, label: '资产' },
              { value: 5, label: '客户' },
              { value: 6, label: '项目' },
              { value: 7, label: '文档' },
              { value: 8, label: '流程' },
              { value: 9, label: '自定义浏览框' },
            ];
          } else if (fieldHtmlType === 3) {
            typeOptions = [
              { value: 1, label: '单选框' },
              { value: 2, label: '多选框' },
              { value: 3, label: '下拉框' },
              { value: 4, label: '单选下拉框' },
              { value: 5, label: '多选下拉框' },
            ];
          } else if (fieldHtmlType === 4) {
            typeOptions = [
              { value: 1, label: '附件上传' },
              { value: 2, label: '图片上传' },
            ];
          } else if (fieldHtmlType === 5) {
            typeOptions = [
              { value: 1, label: '日期' },
              { value: 2, label: '时间' },
              { value: 3, label: '说明' },
              { value: 4, label: '分割线' },
              { value: 5, label: '关联字段' },
            ];
          } else if (fieldHtmlType === 6) {
            typeOptions = [
              { value: 1, label: '复选框' },
            ];
          } else if (fieldHtmlType === 8) {
            typeOptions = [
              { value: 1, label: '下拉选择框' },
            ];
          } else if (fieldHtmlType === 9) {
            typeOptions = [
              { value: 1, label: '树形选择' },
            ];
          }

          return (
            <ProFormSelect
              name="fieldType"
              label="字段详细类型"
              placeholder="请选择字段详细类型"
              rules={[{ required: true, message: '请选择字段详细类型' }]}
              options={typeOptions}
            />
          );
        }}
      </ProFormDependency>

      <ProFormText
        name="fieldDbType"
        label="数据库类型"
        placeholder="根据字段类型自动设置"
        readonly
      />

      <ProFormDigit
        name="fieldLength"
        label="字段长度"
        placeholder="请输入字段长度"
        min={0}
      />

      <ProFormDigit
        name="fieldDecimals"
        label="小数位数"
        placeholder="请输入小数位数"
        min={0}
      />

      <ProFormSwitch
        name="isRequired"
        label="是否必填"
        checkedChildren="是"
        unCheckedChildren="否"
        initialValue={0}
      />

      <ProFormSwitch
        name="isReadOnly"
        label="是否只读"
        checkedChildren="是"
        unCheckedChildren="否"
        initialValue={0}
      />

      <ProFormSwitch
        name="isDisabled"
        label="是否禁用"
        checkedChildren="是"
        unCheckedChildren="否"
        initialValue={0}
      />

      <ProFormText
        name="defaultValue"
        label="默认值"
        placeholder="请输入默认值"
      />

      <ProFormDigit
        name="sort"
        label="排序"
        placeholder="请输入排序"
        min={0}
        initialValue={0}
      />

      <ProFormTextArea
        name="validateRule"
        label="校验规则"
        placeholder="请输入校验规则（JSON字符串）"
      />

      <ProFormTextArea
        name="description"
        label="字段描述"
        placeholder="请输入字段描述"
        rules={[
          { max: 500, message: '字段描述不能超过500个字符' },
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
        name="formId"
        label="表单ID"
        placeholder="请输入表单ID"
        initialValue={formId}
        readonly
      />
    </ProForm>
  );
};

export default FieldManageForm;
