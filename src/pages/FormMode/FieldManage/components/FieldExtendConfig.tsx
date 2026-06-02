import React, { useEffect, useState } from 'react';
import {
  Card,
  Col,
  Form,
  Input,
  Row,
  Space,
  Tabs,
  message,
} from 'antd';
import { KeyOutlined, SettingOutlined } from '@ant-design/icons';
import type { FieldExtend } from '@/services/formmode/typings';

interface FieldExtendConfigProps {
  fieldId?: string;
  formId?: string;
  value?: string; // expendAttr JSON 字符串
  onChange?: (value: string) => void;
  readonly?: boolean; // 是否只读模式
}

/**
 * 字段扩展属性配置组件
 * 对标泛微E9的 expendattr 字段
 * 支持 SQL 计算、浏览框配置、树形配置等
 */
const FieldExtendConfig: React.FC<FieldExtendConfigProps> = ({
  fieldId,
  formId,
  value = '{}',
  onChange,
  readonly = false,
}) => {
  const [activeTab, setActiveTab] = useState<string>('sql');
  const [form] = Form.useForm();
  const [jsonValue, setJsonValue] = useState<string>(value || '{}');

  // 当外部 value 变化时更新内部状态
  useEffect(() => {
    setJsonValue(value || '{}');
    try {
      const parsed = JSON.parse(value || '{}');
      form.setFieldsValue(parsed);
    } catch (e) {
      console.error('解析扩展属性失败:', e);
    }
  }, [value]);

  // 保存扩展属性
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const jsonStr = JSON.stringify(values, null, 2);
      setJsonValue(jsonStr);
      if (onChange) {
        onChange(jsonStr);
      }
      message.success('保存成功');
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // SQL 计算字段配置
  const renderSqlConfig = () => {
    return (
      <Form form={form} layout="vertical">
        <Form.Item
          name="sqlwhere"
          label="SQL WHERE 条件"
          tooltip="用于过滤浏览框数据的 SQL WHERE 条件，支持变量如 $obj1$"
        >
          <Input.TextArea
            rows={3}
            placeholder="例如：deptid=$deptid$"
            disabled={readonly}
          />
        </Form.Item>
        <Form.Item
          name="sqlcondition"
          label="SQL 查询条件"
          tooltip="用于浏览框默认查询条件的 SQL 片段"
        >
          <Input.TextArea
            rows={3}
            placeholder="例如：status=1"
            disabled={readonly}
          />
        </Form.Item>
        <Form.Item
          name="sqlexpression"
          label="SQL 计算表达式"
          tooltip="用于计算字段值的 SQL 表达式，如 doFieldSQL('SELECT SUM(amount) FROM table WHERE id=@id')"
        >
          <Input.TextArea
            rows={3}
            placeholder="例如：doFieldSQL('SELECT SUM(amount) FROM formtable_main_1 WHERE requestid=@requestid')"
            disabled={readonly}
          />
        </Form.Item>
      </Form>
    );
  };

  // 浏览框配置
  const renderBrowserConfig = () => {
    return (
      <Form form={form} layout="vertical">
        <Form.Item
          name="browsertype"
          label="浏览框类型"
          tooltip="指定浏览框的类型，如人力资源、部门等"
        >
          <Input placeholder="例如：1（人力资源）" disabled={readonly} />
        </Form.Item>
        <Form.Item
          name="showall"
          label="显示全部"
          tooltip="是否在选择框中显示全部数据"
        >
          <Input placeholder="0-不显示，1-显示" disabled={readonly} />
        </Form.Item>
        <Form.Item
          name="iscustom"
          label="是否自定义"
          tooltip="是否使用自定义浏览框"
        >
          <Input placeholder="0-否，1-是" disabled={readonly} />
        </Form.Item>
      </Form>
    );
  };

  // 树形配置
  const renderTreeConfig = () => {
    return (
      <Form form={form} layout="vertical">
        <Form.Item
          name="treerootnode"
          label="树形根节点"
          tooltip="树形浏览框的根节点 ID 或条件"
        >
          <Input placeholder="例如：objzdy=$obj1$" disabled={readonly} />
        </Form.Item>
        <Form.Item
          name="treeparentfield"
          label="树形父字段"
          tooltip="指定树形结构中表示父节点的字段名"
        >
          <Input placeholder="例如：parentid" disabled={readonly} />
        </Form.Item>
      </Form>
    );
  };

  // JSON 编辑
  const renderJsonEdit = () => {
    return (
      <div>
        <Form layout="vertical">
          <Form.Item label="扩展属性（JSON 格式）">
            <Input.TextArea
              rows={10}
              value={jsonValue}
              onChange={(e) => {
                setJsonValue(e.target.value);
                if (onChange) {
                  onChange(e.target.value);
                }
              }}
              placeholder='请输入 JSON 格式的扩展属性，例如：{"sqlwhere": "deptid=$deptid$"}'
              disabled={readonly}
            />
          </Form.Item>
        </Form>
        <Space>
          {!readonly && (
            <Button type="primary" onClick={handleSave}>
              格式化 JSON
            </Button>
          )}
          <Button
            onClick={() => {
              try {
                const parsed = JSON.parse(jsonValue);
                setJsonValue(JSON.stringify(parsed, null, 2));
                message.success('JSON 格式化成功');
              } catch (e: any) {
                message.error(`JSON 格式错误: ${e.message}`);
              }
            }}
          >
            格式化
          </Button>
        </Space>
      </div>
    );
  };

  return (
    <Card
      title={
        <Space>
          <SettingOutlined />
          <span>扩展属性配置</span>
        </Space>
      }
      size="small"
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.TabPane tab="SQL 配置" key="sql">
          {renderSqlConfig()}
        </Tabs.TabPane>
        <Tabs.TabPane tab="浏览框配置" key="browser">
          {renderBrowserConfig()}
        </Tabs.TabPane>
        <Tabs.TabPane tab="树形配置" key="tree">
          {renderTreeConfig()}
        </Tabs.TabPane>
        <Tabs.TabPane tab="JSON 编辑" key="json">
          {renderJsonEdit()}
        </Tabs.TabPane>
      </Tabs>

      {!readonly && (
        <Row justify="end" style={{ marginTop: 16 }}>
          <Col>
            <Space>
              <Button type="primary" onClick={handleSave}>
                保存配置
              </Button>
            </Space>
          </Col>
        </Row>
      )}
    </Card>
  );
};

export default FieldExtendConfig;
