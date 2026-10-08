import { Col, DatePicker, Divider, Form, Input, InputNumber, Row, Select } from 'antd';
import type { FormSchemaGroup } from '@/services/system/user';
import moment from 'moment';
import React from 'react';

/**
 * 归一化自定义字段值：moment -> YYYY-MM-DD，空值剔除
 * 输出 { fieldId: value }，与后端 User.extData 对齐
 */
export const normalizeExtData = (raw: any): Record<string, string> => {
  const result: Record<string, string> = {};
  if (!raw) return result;
  Object.keys(raw).forEach((key) => {
    const v = raw[key];
    if (v === undefined || v === null || v === '') return;
    result[key] = moment.isMoment(v) ? v.format('YYYY-MM-DD') : String(v);
  });
  return result;
};

/** 解析控件扩展配置（如 select 的 options） */
const parseOptions = (extJson?: string): { label: string; value: string }[] => {
  if (!extJson) return [];
  try {
    const json = JSON.parse(extJson);
    const options = json?.options;
    if (!Array.isArray(options)) return [];
    return options.map((o: any) => ({ label: String(o.label ?? o.value ?? ''), value: String(o.value ?? '') }));
  } catch {
    return [];
  }
};

/** 按控件类型渲染表单控件（对齐 ecology eleclazzname 反射） */
const renderControl = (field: FormSchemaGroup['fields'][number]) => {
  switch (field.eleType) {
    case 'textarea':
      return <Input.TextArea rows={3} placeholder={`请输入${field.label}`} />;
    case 'number':
      return <InputNumber style={{ width: '100%' }} placeholder={`请输入${field.label}`} />;
    case 'date':
      return <DatePicker style={{ width: '100%' }} placeholder={`请选择${field.label}`} />;
    case 'select':
      return (
        <Select
          allowClear
          placeholder={`请选择${field.label}`}
          options={parseOptions(field.extJson)}
        />
      );
    default:
      return <Input placeholder={`请输入${field.label}`} />;
  }
};

interface UserExtFieldsProps {
  groups: FormSchemaGroup[];
}

/**
 * 配置驱动的自定义字段区块（P2，对齐 ecology HrmResourceAddNew.jsp 的字段分组渲染）
 * 字段名使用 ['extData', fieldId] 嵌套路径，提交时直接作为 extData: {fieldId: value} 传给后端。
 */
const UserExtFields: React.FC<UserExtFieldsProps> = ({ groups }) => {
  if (!groups || groups.length === 0) return null;

  return (
    <>
      {groups.map((group) => (
        <div key={group.groupId || group.groupCode} style={{ marginBottom: 24 }}>
          <Divider />
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>{group.groupName}</h3>
          <Row gutter={16}>
            {(group.fields || []).map((field) => (
              <Col span={12} key={field.fieldId}>
                <Form.Item
                  name={['extData', field.fieldId]}
                  label={field.label}
                  rules={
                    field.required === 1
                      ? [{ required: true, message: `请输入${field.label}` }]
                      : undefined
                  }
                >
                  {renderControl(field)}
                </Form.Item>
              </Col>
            ))}
          </Row>
        </div>
      ))}
    </>
  );
};

export default UserExtFields;
