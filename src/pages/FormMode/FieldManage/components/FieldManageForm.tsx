import {
  ProForm,
  ProFormText,
  ProFormTextArea,
  ProFormSwitch,
  ProFormDigit,
  ProFormSelect,
  ProFormDependency,
  ProFormRadio,
} from '@ant-design/pro-components';
import React, { useEffect, useState, useMemo } from 'react';
import { fieldApi, fieldOptionApi, fieldExtendApi } from '@/services/formmode';
import type { FieldDefinitionFormData, FieldTypeInfo, FieldOption, FieldExtend } from '@/services/formmode/typings';
import FieldOptionManager from './FieldOptionManager';
import FieldExtendConfig from './FieldExtendConfig';

interface FieldManageFormProps {
  initialValues?: Partial<FieldDefinitionFormData>;
  onFinish: (values: FieldDefinitionFormData) => void;
  loading?: boolean;
  formId?: string;
  readonly?: boolean;
}

/**
 * 字段管理表单组件（对标泛微E9标准）
 * 字段属性配置界面分为：基本属性、高级属性、校验规则、选项配置、扩展属性
 */
const FieldManageForm: React.FC<FieldManageFormProps> = ({
  initialValues,
  onFinish,
  loading = false,
  formId,
  readonly = false,
}) => {
  const [fieldTypes, setFieldTypes] = useState<FieldTypeInfo[]>([]);
  const [localOptions, setLocalOptions] = useState<FieldOption[]>(initialValues?.options || []);
  const [localExtend, setLocalExtend] = useState<FieldExtend | undefined>(initialValues?.extend);

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
    if (htmlType === 1) return 'varchar';
    if (htmlType === 2) return 'varchar';
    if (htmlType === 3) return 'varchar';
    if (htmlType === 4) return 'varchar';
    if (htmlType === 5) {
      if (type === 1) return 'date';
      if (type === 2) return 'datetime';
      return 'varchar';
    }
    if (htmlType === 6) return 'int';
    if (htmlType === 8) return 'varchar';
    if (htmlType === 9) return 'varchar';
    return 'varchar';
  };

  // 使用 useMemo 生成初始值（对标泛微E9标准字段）
  const memoizedInitialValues = useMemo(() => {
    return {
      ...initialValues,
      // 基本属性
      fieldName: initialValues?.fieldName || '',
      fieldLabel: initialValues?.fieldLabel || '',
      fieldHtmlType: initialValues?.fieldHtmlType ?? undefined,
      fieldType: initialValues?.fieldType ?? undefined,
      fieldDbType: initialValues?.fieldDbType || 'varchar',
      fieldLength: initialValues?.fieldLength ?? 255,
      fieldDecimals: initialValues?.fieldDecimals ?? 0,
      isRequired: initialValues?.isRequired ?? initialValues?.isMand ?? 0,
      isReadOnly: initialValues?.isReadOnly ?? 0,
      isDisabled: initialValues?.isDisabled ?? 0,
      defaultValue: initialValues?.defaultValue || '',
      sort: initialValues?.sort ?? initialValues?.fieldOrder ?? 0,
      status: initialValues?.status ?? initialValues?.isUsed ?? 1,
      // 泛微E9标准字段
      textHeight: initialValues?.textHeight ?? 4,
      isMand: initialValues?.isMand ?? initialValues?.isRequired ?? 0,
      fieldOrder: initialValues?.fieldOrder ?? initialValues?.sort ?? 0,
      isUsed: initialValues?.isUsed ?? initialValues?.status ?? 1,
      quickType: initialValues?.quickType ?? 0,
      impCheck: initialValues?.impCheck ?? 0,
      checkExpression: initialValues?.checkExpression || '',
      placeholder: initialValues?.placeholder || '',
      needLog: initialValues?.needLog ?? 0,
      needExcel: initialValues?.needExcel ?? 0,
      // 其他字段
      description: initialValues?.description || '',
      formId: initialValues?.formId ?? formId,
    };
  }, [initialValues, formId]);

  // 处理选项变化
  const handleOptionsChange = (options: FieldOption[]) => {
    setLocalOptions(options);
  };

  // 处理扩展属性变化
  const handleExtendChange = (extend: FieldExtend) => {
    setLocalExtend(extend);
  };

  return (
    <ProForm
      initialValues={memoizedInitialValues}
      onFinish={async (values) => {
        // 根据字段类型自动设置数据库类型
        if (values.fieldHtmlType !== undefined && values.fieldType !== undefined) {
          values.fieldDbType = getDbTypeByFieldType(values.fieldHtmlType, values.fieldType);
        }
        // 映射泛微E9标准字段
        if (values.isMand !== undefined) values.isRequired = values.isMand;
        if (values.fieldOrder !== undefined) values.sort = values.fieldOrder;
        if (values.isUsed !== undefined) values.status = values.isUsed;
        // 附加选项和扩展属性
        if (localOptions.length > 0) {
          values.options = localOptions;
        }
        if (localExtend) {
          values.extend = localExtend;
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
      layout="vertical"
      readonly={readonly}
    >
      {/* ==================== 基本属性（对标泛微E9） ==================== */}

      <ProFormText
        name="fieldName"
        label="字段名称（fieldname）"
        placeholder="请输入字段名称（数据库字段名）"
        rules={[
          { required: true, message: '请输入字段名称' },
          { max: 50, message: '字段名称不能超过50个字符' },
          {
            pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/,
            message: '字段名称只能包含字母、数字和下划线，且必须以字母开头',
          },
        ]}
        readonly={readonly}
      />

      <ProFormText
        name="fieldLabel"
        label="字段标签（fieldlabel）"
        placeholder="请输入字段标签（显示名称）"
        rules={[
          { required: true, message: '请输入字段标签' },
          { max: 50, message: '字段标签不能超过50个字符' },
        ]}
        readonly={readonly}
      />

      <ProFormSelect
        name="fieldHtmlType"
        label="字段HTML类型（fieldhtmltype）"
        placeholder="请选择字段HTML类型"
        rules={[{ required: true, message: '请选择字段HTML类型' }]}
        options={[
          { value: 1, label: '1-文本字段' },
          { value: 2, label: '2-浏览按钮' },
          { value: 3, label: '3-选择框' },
          { value: 4, label: '4-附件上传' },
          { value: 5, label: '5-特殊字段' },
          { value: 6, label: '6-复选框' },
          { value: 8, label: '8-下拉选择框' },
          { value: 9, label: '9-树形选择' },
        ]}
        readonly={readonly}
      />

      <ProFormDependency name={['fieldHtmlType']}>
        {({ fieldHtmlType }) => {
          let typeOptions: { value: number; label: string }[] = [];
          if (fieldHtmlType === 1) {
            typeOptions = [
              { value: 1, label: '1-单行文本' },
              { value: 2, label: '2-多行文本' },
              { value: 3, label: '3-保密字段' },
            ];
          } else if (fieldHtmlType === 2) {
            typeOptions = [
              { value: 1, label: '1-人力资源' },
              { value: 2, label: '2-部门' },
              { value: 3, label: '3-角色' },
              { value: 4, label: '4-资产' },
              { value: 5, label: '5-客户' },
              { value: 6, label: '6-项目' },
              { value: 7, label: '7-文档' },
              { value: 8, label: '8-流程' },
              { value: 9, label: '9-自定义浏览框' },
            ];
          } else if (fieldHtmlType === 3) {
            typeOptions = [
              { value: 1, label: '1-单选框' },
              { value: 2, label: '2-多选框' },
              { value: 3, label: '3-下拉框' },
              { value: 4, label: '4-单选下拉框' },
              { value: 5, label: '5-多选下拉框' },
            ];
          } else if (fieldHtmlType === 4) {
            typeOptions = [
              { value: 1, label: '1-附件上传' },
              { value: 2, label: '2-图片上传' },
            ];
          } else if (fieldHtmlType === 5) {
            typeOptions = [
              { value: 1, label: '1-日期' },
              { value: 2, label: '2-时间' },
              { value: 3, label: '3-说明' },
              { value: 4, label: '4-分割线' },
              { value: 5, label: '5-关联字段' },
            ];
          } else if (fieldHtmlType === 6) {
            typeOptions = [
              { value: 1, label: '1-复选框' },
            ];
          } else if (fieldHtmlType === 8) {
            typeOptions = [
              { value: 1, label: '1-下拉选择框' },
            ];
          } else if (fieldHtmlType === 9) {
            typeOptions = [
              { value: 1, label: '1-树形选择' },
            ];
          }
          return (
            <ProFormSelect
              name="fieldType"
              label="字段详细类型（type）"
              placeholder="请选择字段详细类型"
              rules={[{ required: true, message: '请选择字段详细类型' }]}
              options={typeOptions}
              readonly={readonly}
            />
          );
        }}
      </ProFormDependency>

      <ProFormText
        name="fieldDbType"
        label="数据库类型（fielddbtype）"
        placeholder="根据字段类型自动设置"
        readonly
      />

      {/* ==================== 字段长度与精度（对标泛微E9） ==================== */}

      <ProFormDependency name={['fieldHtmlType']}>
        {({ fieldHtmlType }) => {
          if (fieldHtmlType === 1) {
            return (
              <ProFormDigit
                name="fieldLength"
                label="字段长度（fieldlen）"
                placeholder="请输入字段长度"
                min={0}
                readonly={readonly}
              />
            );
          }
          return null;
        }}
      </ProFormDependency>

      <ProFormDependency name={['fieldHtmlType', 'fieldType']}>
        {({ fieldHtmlType, fieldType }) => {
          if (fieldHtmlType === 1 && fieldType === 3) {
            return (
              <ProFormDigit
                name="fieldDecimals"
                label="小数位数（decimaldigit）"
                placeholder="请输入小数位数"
                min={0}
                readonly={readonly}
              />
            );
          }
          return null;
        }}
      </ProFormDependency>

      {/* ==================== 字段属性（对标泛微E9） ==================== */}

      <ProFormSwitch
        name="isRequired"
        label="是否必填（ismand）"
        checkedChildren="是"
        unCheckedChildren="否"
        initialValue={0}
        readonly={readonly}
      />

      <ProFormSwitch
        name="isReadOnly"
        label="是否只读"
        checkedChildren="是"
        unCheckedChildren="否"
        initialValue={0}
        readonly={readonly}
      />

      <ProFormSwitch
        name="isDisabled"
        label="是否禁用"
        checkedChildren="是"
        unCheckedChildren="否"
        initialValue={0}
        readonly={readonly}
      />

      <ProFormText
        name="defaultValue"
        label="默认值（defaultvalue）"
        placeholder="请输入默认值"
        readonly={readonly}
      />

      <ProFormDigit
        name="sort"
        label="显示顺序（fieldorder）"
        placeholder="请输入显示顺序"
        min={0}
        initialValue={0}
        readonly={readonly}
      />

      <ProFormSwitch
        name="status"
        label="启用状态（isused）"
        checkedChildren="启用"
        unCheckedChildren="禁用"
        initialValue={1}
        readonly={readonly}
      />

      {/* ==================== 高级属性（对标泛微E9） ==================== */}

      <ProFormDependency name={['fieldHtmlType', 'fieldType']}>
        {({ fieldHtmlType, fieldType }) => {
          if (fieldHtmlType === 1 && fieldType === 2) {
            return (
              <ProFormDigit
                name="textHeight"
                label="文本高度（textheight）"
                placeholder="请输入文本高度（多行文本行数）"
                min={1}
                initialValue={4}
                readonly={readonly}
              />
            );
          }
          return null;
        }}
      </ProFormDependency>

      <ProFormTextArea
        name="placeholder"
        label="提示信息（placeholder）"
        placeholder="请输入提示信息（输入框占位符）"
        readonly={readonly}
      />

      <ProFormSwitch
        name="needLog"
        label="记录日志（needlog）"
        checkedChildren="是"
        unCheckedChildren="否"
        initialValue={0}
        readonly={readonly}
      />

      <ProFormSwitch
        name="needExcel"
        label="允许Excel导入（needefcel）"
        checkedChildren="是"
        unCheckedChildren="否"
        initialValue={0}
        readonly={readonly}
      />

      {/* ==================== 校验规则（对标泛微E9） ==================== */}

      <ProFormSelect
        name="impCheck"
        label="导入验证类型（impcheck）"
        placeholder="请选择导入验证类型"
        options={[
          { value: 0, label: '0-不验证' },
          { value: 1, label: '1-电话' },
          { value: 2, label: '2-手机' },
          { value: 3, label: '3-邮编' },
          { value: 4, label: '4-身份证' },
          { value: 5, label: '5-日期' },
          { value: 6, label: '6-时间' },
          { value: 7, label: '7-email' },
          { value: 8, label: '8-自定义' },
        ]}
        readonly={readonly}
      />

      <ProFormTextArea
        name="checkExpression"
        label="验证表达式（checkexpression）"
        placeholder="请输入验证表达式（正则表达式）"
        readonly={readonly}
      />

      {/* ==================== 选项配置（对标泛微E9 selectItem 表） ==================== */}

      <ProFormDependency name={['fieldHtmlType']}>
        {({ fieldHtmlType }) => {
          if (fieldHtmlType === 3 || fieldHtmlType === 5 || fieldHtmlType === 6) {
            return (
              <FieldOptionManager
                fieldId={initialValues?.id}
                formId={formId}
                options={localOptions}
                onChange={handleOptionsChange}
                readonly={readonly}
              />
            );
          }
          return null;
        }}
      </ProFormDependency>

      {/* ==================== 扩展属性配置（对标泛微E9 expendattr 字段） ==================== */}

      <FieldExtendConfig
        fieldId={initialValues?.id}
        formId={formId}
        value={localExtend?.expendAttr}
        onChange={(value) => {
          setLocalExtend({
            ...localExtend,
            fieldId: initialValues?.id,
            formId: formId,
            expendAttr: value,
          });
        }}
        readonly={readonly}
      />

      {/* ==================== 其他字段 ==================== */}

      <ProFormTextArea
        name="description"
        label="字段描述（description）"
        placeholder="请输入字段描述"
        rules={[{ max: 500, message: '字段描述不能超过500个字符' }]}
        readonly={readonly}
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
