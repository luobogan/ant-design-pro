import React from 'react';
import dayjs from 'dayjs';
import {
  Input,
  InputNumber,
  Select,
  DatePicker,
  TimePicker,
  Checkbox,
  Radio,
  Upload,
  Switch,
  TreeSelect,
  Button,
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import type { FieldDefinition } from '@/services/formmode';

const { TextArea } = Input;
const { RangePicker } = DatePicker;

interface FieldRendererProps {
  field: FieldDefinition;
  value?: any;
  onChange?: (value: any) => void;
  disabled?: boolean;
  readonly?: boolean;
}

/**
 * 字段渲染组件
 * 根据字段定义动态渲染表单控件
 */
const FieldRenderer: React.FC<FieldRendererProps> = ({
  field,
  value,
  onChange,
  disabled = false,
  readonly = false,
}) => {
  const { fieldHtmlType, fieldType, fieldName, fieldLabel } = field;

  // 如果是只读模式，直接显示值
  if (readonly) {
    return <span>{value || '-'}</span>;
  }

  // 根据字段HTML类型和详细类型渲染不同的控件
  switch (fieldHtmlType) {
    case 1: // 文本字段
      return renderTextField(field, value, onChange, disabled);
    case 2: // 浏览按钮
      return renderBrowserField(field, value, onChange, disabled);
    case 3: // 选择框
      return renderSelectField(field, value, onChange, disabled);
    case 4: // 附件上传
      return renderAttachmentField(field, value, onChange, disabled);
    case 5: // 特殊字段
      return renderSpecialField(field, value, onChange, disabled);
    case 6: // 复选框
      return renderCheckboxField(field, value, onChange, disabled);
    case 8: // 下拉选择框
      return renderDropdownField(field, value, onChange, disabled);
    case 9: // 树形选择
      return renderTreeField(field, value, onChange, disabled);
    default:
      return <Input value={value} onChange={onChange} disabled={disabled} />;
  }
};

/**
 * 渲染文本字段
 */
const renderTextField = (
  field: FieldDefinition,
  value: any,
  onChange?: (value: any) => void,
  disabled: boolean = false,
) => {
  const { fieldType, fieldLabel } = field;

  if (fieldType === 1) {
    // 单行文本
    return (
      <Input
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={`请输入${fieldLabel}`}
      />
    );
  } else if (fieldType === 2) {
    // 多行文本
    return (
      <TextArea
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={`请输入${fieldLabel}`}
        rows={4}
      />
    );
  } else if (fieldType === 3) {
    // 保密字段
    return (
      <Input.Password
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={`请输入${fieldLabel}`}
      />
    );
  }

  return <Input value={value} onChange={onChange} disabled={disabled} />;
};

/**
 * 渲染浏览按钮字段
 */
const renderBrowserField = (
  field: FieldDefinition,
  value: any,
  onChange?: (value: any) => void,
  disabled: boolean = false,
) => {
  // 浏览按钮使用 Select 组件替代
  return (
    <Select
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={`请选择${field.fieldLabel}`}
      allowClear
      showSearch
      optionFilterProp="label"
      options={[]} // 这里需要从后端获取选项
    />
  );
};

/**
 * 渲染选择框字段
 */
const renderSelectField = (
  field: FieldDefinition,
  value: any,
  onChange?: (value: any) => void,
  disabled: boolean = false,
) => {
  const { fieldType, options } = field;

  // 将选项转换为 Select 需要的格式
  const selectOptions = options?.map(option => ({
    value: option.value,
    label: option.label,
  })) || [];

  if (fieldType === 1) {
    // 单选框
    return (
      <Radio.Group
        value={value}
        onChange={e => onChange?.(e.target.value)}
        disabled={disabled}
        options={selectOptions}
      />
    );
  } else if (fieldType === 2) {
    // 多选框
    return (
      <Checkbox.Group
        value={value ? (Array.isArray(value) ? value : [value]) : []}
        onChange={onChange}
        disabled={disabled}
        options={selectOptions}
      />
    );
  } else {
    // 下拉框、单选下拉框、多选下拉框
    return (
      <Select
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={`请选择${field.fieldLabel}`}
        allowClear
        mode={fieldType === 5 ? 'multiple' : undefined}
        options={selectOptions}
      />
    );
  }
};

/**
 * 渲染附件上传字段
 */
const renderAttachmentField = (
  field: FieldDefinition,
  value: any,
  onChange?: (value: any) => void,
  disabled: boolean = false,
) => {
  const { fieldType } = field;

  const handleChange = (info: any) => {
    if (onChange) {
      onChange(info.fileList);
    }
  };

  if (fieldType === 2) {
    // 图片上传
    return (
      <Upload
        listType="picture-card"
        fileList={value || []}
        onChange={handleChange}
        disabled={disabled}
      >
        {value && value.length >= 1 ? null : '+ 上传'}
      </Upload>
    );
  } else {
    // 附件上传
    return (
      <Upload
        fileList={value || []}
        onChange={handleChange}
        disabled={disabled}
      >
        <Button icon={<UploadOutlined />} disabled={disabled}>
          上传附件
        </Button>
      </Upload>
    );
  }
};

/**
 * 渲染特殊字段
 */
const renderSpecialField = (
  field: FieldDefinition,
  value: any,
  onChange?: (value: any) => void,
  disabled: boolean = false,
) => {
  const { fieldType } = field;

  if (fieldType === 1) {
    // 日期
    return (
      <DatePicker
        value={value ? dayjs(value) : undefined}
        onChange={(date, _dateString) => onChange?.(date ? date.format('YYYY-MM-DD') : undefined)}
        disabled={disabled}
        placeholder={`请选择${field.fieldLabel}`}
      />
    );
  } else if (fieldType === 2) {
    // 时间
    return (
      <TimePicker
        value={value ? dayjs(value, 'HH:mm:ss') : undefined}
        onChange={(time, _timeString) => onChange?.(time ? time.format('HH:mm:ss') : undefined)}
        disabled={disabled}
        placeholder={`请选择${field.fieldLabel}`}
      />
    );
  } else if (fieldType === 3) {
    // 说明
    return <div style={{ color: '#999' }}>{field.description || '说明文字'}</div>;
  } else if (fieldType === 4) {
    // 分割线
    return <div style={{ borderTop: '1px solid #e8e8e8', margin: '8px 0' }} />;
  }

  return <Input value={value} onChange={onChange} disabled={disabled} />;
};

/**
 * 渲染复选框字段
 */
const renderCheckboxField = (
  field: FieldDefinition,
  value: any,
  onChange?: (value: any) => void,
  disabled: boolean = false,
) => {
  return (
    <Switch
      checked={value === 1 || value === true || value === '1'}
      onChange={checked => onChange?.(checked ? 1 : 0)}
      disabled={disabled}
      checkedChildren="是"
      unCheckedChildren="否"
    />
  );
};

/**
 * 渲染下拉选择框字段
 */
const renderDropdownField = (
  field: FieldDefinition,
  value: any,
  onChange?: (value: any) => void,
  disabled: boolean = false,
) => {
  const { options } = field;

  // 将选项转换为 Select 需要的格式
  const selectOptions = options?.map(option => ({
    value: option.value,
    label: option.label,
  })) || [];

  return (
    <Select
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={`请选择${field.fieldLabel}`}
      allowClear
      options={selectOptions}
    />
  );
};

/**
 * 渲染树形选择字段
 */
const renderTreeField = (
  field: FieldDefinition,
  value: any,
  onChange?: (value: any) => void,
  disabled: boolean = false,
) => {
  // 树形选择使用 TreeSelect 组件
  return (
    <TreeSelect
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={`请选择${field.fieldLabel}`}
      allowClear
      treeData={[]} // 这里需要从后端获取树形数据
    />
  );
};

export default FieldRenderer;
