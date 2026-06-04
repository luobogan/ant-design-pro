import React from 'react';
import { Card, Form, Input, Select, InputNumber, Switch, Empty, Divider, Row, Col } from 'antd';
import { SettingOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';

/**
 * 属性配置面板组件
 * 配置选中字段或组件的属性
 * 参照迁移文档 §4.3 单元格操作 + §6 数据验证 + §8 样式
 */

const FIELD_TYPE_OPTIONS = [
  { label: '单行文本', value: 'text' },
  { label: '多行文本', value: 'textarea' },
  { label: '数字', value: 'number' },
  { label: '整数', value: 'wholeNumber' },
  { label: '日期', value: 'date' },
  { label: '日期时间', value: 'datetime' },
  { label: '下拉框', value: 'select' },
  { label: '复选框', value: 'checkbox' },
  { label: '单选框', value: 'radio' },
  { label: '附件', value: 'attachment' },
  { label: '富文本', value: 'richtext' },
  { label: '分组框', value: 'group' },
  { label: '自定义', value: 'custom' },
];

interface PropertyPanelProps {
  selectedField: any;
}

const PropertyPanel: React.FC<PropertyPanelProps> = ({ selectedField }) => {
  const [form] = Form.useForm();
  const [options, setOptions] = React.useState<{ label: string; value: string }[]>([]);

  React.useEffect(() => {
    if (selectedField) {
      form.setFieldsValue(selectedField);
      if (selectedField.options) {
        setOptions(selectedField.options);
      } else {
        setOptions([]);
      }
    } else {
      form.resetFields();
      setOptions([]);
    }
  }, [selectedField, form]);

  const handleValuesChange = (changedValues: any, allValues: any) => {
    console.log('属性变更:', changedValues);
    // 同步更新到 window.__pendingField 或 selectedField
    if ((window as any).__pendingField) {
      (window as any).__pendingField = {
        ...(window as any).__pendingField,
        ...allValues,
        options,
      };
    }
  };

  if (!selectedField) {
    return (
      <Card
        title={
          <span>
            <SettingOutlined style={{ marginRight: 8 }} />
            属性配置
          </span>
        }
        size="small"
        style={{ height: '100%' }}
      >
        <Empty description="请选择一个字段进行配置" />
      </Card>
    );
  }

  const fieldType = selectedField.fieldType || selectedField.type;
  const showOptions = fieldType === 'select' || fieldType === 'radio';

  const addOption = () => {
    const newOptions = [...options, { label: '', value: '' }];
    setOptions(newOptions);
  };

  const updateOption = (index: number, key: 'label' | 'value', val: string) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], [key]: val };
    setOptions(newOptions);
  };

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  return (
    <Card
      title={
        <span>
          <SettingOutlined style={{ marginRight: 8 }} />
          属性配置
        </span>
      }
      size="small"
      style={{ height: '100%', overflow: 'auto' }}
    >
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleValuesChange}
        size="small"
      >
        {/* 基本属性 */}
        <Divider titlePlacement="left" plain style={{ fontSize: 12 }}>基本属性</Divider>

        <Form.Item label="字段标签" name="fieldLabel">
          <Input placeholder="请输入字段标签" />
        </Form.Item>

        <Form.Item label="字段名" name="fieldName">
          <Input placeholder="请输入字段名" />
        </Form.Item>

        <Form.Item label="字段类型" name="fieldType">
          <Select options={FIELD_TYPE_OPTIONS} />
        </Form.Item>

        <Row gutter={8}>
          <Col span={12}>
            <Form.Item label="是否必填" name="required" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="是否只读" name="readonly" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>

        {/* 显示属性 */}
        <Divider titlePlacement="left" plain style={{ fontSize: 12 }}>显示属性</Divider>

        <Form.Item label="默认值" name="defaultValue">
          <Input placeholder="请输入默认值" />
        </Form.Item>

        <Form.Item label="占位符" name="placeholder">
          <Input placeholder="请输入占位符" />
        </Form.Item>

        <Form.Item label="字段提示" name="tooltip">
          <Input.TextArea rows={2} placeholder="请输入字段提示" />
        </Form.Item>

        <Form.Item label="字段长度" name="length">
          <InputNumber min={1} max={65535} style={{ width: '100%' }} />
        </Form.Item>

        {/* 选项列表（下拉框/单选框/复选框专用） */}
        {showOptions && (
          <>
            <Divider titlePlacement="left" plain style={{ fontSize: 12 }}>
              选项列表
              <a onClick={addOption} style={{ marginLeft: 8, fontSize: 12 }}>
                <PlusOutlined /> 添加
              </a>
            </Divider>
            {options.map((opt, idx) => (
              <Row key={idx} gutter={4} align="middle" style={{ marginBottom: 8 }}>
                <Col span={9}>
                  <Input
                    size="small"
                    placeholder="显示名"
                    value={opt.label}
                    onChange={(e) => updateOption(idx, 'label', e.target.value)}
                  />
                </Col>
                <Col span={9}>
                  <Input
                    size="small"
                    placeholder="值"
                    value={opt.value}
                    onChange={(e) => updateOption(idx, 'value', e.target.value)}
                  />
                </Col>
                <Col span={6}>
                  <DeleteOutlined
                    style={{ color: '#ff4d4f', cursor: 'pointer' }}
                    onClick={() => removeOption(idx)}
                  />
                </Col>
              </Row>
            ))}
          </>
        )}

        {/* 验证规则（参照迁移文档 §6） */}
        <Divider titlePlacement="left" plain style={{ fontSize: 12 }}>
          验证规则（§6 数据验证迁移）
        </Divider>

        <Form.Item label="验证类型" name={['validationRule', 'type']}>
          <Select
            allowClear
            placeholder="选择验证类型"
            options={[
              { label: '无验证', value: '' },
              { label: '列表(List)', value: 'list' },
              { label: '数字(Number)', value: 'number' },
              { label: '整数(WholeNumber)', value: 'wholeNumber' },
              { label: '小数(Decimal)', value: 'decimal' },
              { label: '日期(Date)', value: 'date' },
              { label: '文本长度(TextLength)', value: 'textLength' },
              { label: '自定义公式(Formula)', value: 'custom' },
            ]}
          />
        </Form.Item>

        <Form.Item label="最小值/公式1" name={['validationRule', 'formula1']}>
          <Input placeholder="例如: 0" />
        </Form.Item>

        <Form.Item label="最大值/公式2" name={['validationRule', 'formula2']}>
          <Input placeholder="例如: 100" />
        </Form.Item>

        <Row gutter={8}>
          <Col span={12}>
            <Form.Item label="允许为空" name={['validationRule', 'allowBlank']} valuePropName="checked">
              <Switch defaultChecked />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="显示错误" name={['validationRule', 'showErrorMessage']} valuePropName="checked">
              <Switch defaultChecked />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="错误标题" name={['validationRule', 'errorTitle']}>
          <Input placeholder="输入无效" />
        </Form.Item>

        <Form.Item label="错误信息" name={['validationRule', 'errorMessage']}>
          <Input placeholder="请输入有效值" />
        </Form.Item>
      </Form>
    </Card>
  );
};

export default PropertyPanel;
