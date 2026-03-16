import {
  CodeOutlined,
  DatabaseOutlined,
  FunctionOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Drawer,
  Form,
  Input,
  message,
  Select,
  Space,
  Tabs,
} from 'antd';
import React, { useEffect, useState } from 'react';

interface EnhanceDrawerProps {
  open: boolean;
  onClose: () => void;
  dbformId: string;
  type: 'sql' | 'java' | 'js';
}

const EnhanceDrawer: React.FC<EnhanceDrawerProps> = ({
  open,
  onClose,
  dbformId,
  type,
}) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(type);
  const [sqlScript, setSqlScript] = useState('');
  const [javaScript, setJavaScript] = useState('');
  const [jsScript, setJsScript] = useState('');

  useEffect(() => {
    if (open) {
      setActiveTab(type);
      loadEnhanceConfig();
    }
  }, [open, type]);

  const loadEnhanceConfig = async () => {
    setLoading(true);
    try {
      // TODO: 调用API加载增强配置
      setSqlScript('-- SQL增强脚本\n-- 在此处编写SQL语句');
      setJavaScript('// Java增强脚本\n// 在此处编写Java代码');
      setJsScript('// JS增强脚本\n// 在此处编写JavaScript代码');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // TODO: 调用API保存增强配置
      await new Promise((resolve) => setTimeout(resolve, 500));
      message.success('保存成功');
    } catch (_error) {
      message.error('保存失败');
    } finally {
      setLoading(false);
    }
  };

  const tabItems = [
    {
      key: 'sql',
      label: (
        <span>
          <DatabaseOutlined />
          SQL增强
        </span>
      ),
      children: (
        <div style={{ padding: '16px 0' }}>
          <Card title="SQL增强配置" size="small">
            <Form layout="vertical">
              <Form.Item label="按钮选择">
                <Select
                  placeholder="请选择要增强的按钮"
                  style={{ width: '100%' }}
                >
                  <Select.Option value="add">新增按钮</Select.Option>
                  <Select.Option value="edit">编辑按钮</Select.Option>
                  <Select.Option value="delete">删除按钮</Select.Option>
                  <Select.Option value="import">导入按钮</Select.Option>
                  <Select.Option value="export">导出按钮</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item label="执行时机">
                <Select placeholder="请选择执行时机" style={{ width: '100%' }}>
                  <Select.Option value="before">执行前</Select.Option>
                  <Select.Option value="after">执行后</Select.Option>
                  <Select.Option value="replace">替换执行</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item label="SQL脚本">
                <Input.TextArea
                  rows={15}
                  value={sqlScript}
                  onChange={(e) => setSqlScript(e.target.value)}
                  placeholder="请输入SQL脚本"
                  style={{ fontFamily: 'monospace' }}
                />
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleSave}
                    loading={loading}
                  >
                    保存
                  </Button>
                  <Button onClick={() => setSqlScript('')}>清空</Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </div>
      ),
    },
    {
      key: 'java',
      label: (
        <span>
          <FunctionOutlined />
          JAVA增强
        </span>
      ),
      children: (
        <div style={{ padding: '16px 0' }}>
          <Card title="JAVA增强配置" size="small">
            <Form layout="vertical">
              <Form.Item label="按钮选择">
                <Select
                  placeholder="请选择要增强的按钮"
                  style={{ width: '100%' }}
                >
                  <Select.Option value="add">新增按钮</Select.Option>
                  <Select.Option value="edit">编辑按钮</Select.Option>
                  <Select.Option value="delete">删除按钮</Select.Option>
                  <Select.Option value="import">导入按钮</Select.Option>
                  <Select.Option value="export">导出按钮</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item label="增强方式">
                <Select placeholder="请选择增强方式" style={{ width: '100%' }}>
                  <Select.Option value="spring">Spring Bean</Select.Option>
                  <Select.Option value="class">Java类</Select.Option>
                  <Select.Option value="http">HTTP接口</Select.Option>
                  <Select.Option value="online">在线脚本</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item label="Java类路径">
                <Input placeholder="请输入Java类路径，如：com.example.service.CustomService" />
              </Form.Item>
              <Form.Item label="在线脚本">
                <Input.TextArea
                  rows={15}
                  value={javaScript}
                  onChange={(e) => setJavaScript(e.target.value)}
                  placeholder="请输入Java脚本"
                  style={{ fontFamily: 'monospace' }}
                />
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleSave}
                    loading={loading}
                  >
                    保存
                  </Button>
                  <Button onClick={() => setJavaScript('')}>清空</Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </div>
      ),
    },
    {
      key: 'js',
      label: (
        <span>
          <CodeOutlined />
          JS增强
        </span>
      ),
      children: (
        <div style={{ padding: '16px 0' }}>
          <Card title="JS增强配置" size="small">
            <Form layout="vertical">
              <Form.Item label="按钮选择">
                <Select
                  placeholder="请选择要增强的按钮"
                  style={{ width: '100%' }}
                >
                  <Select.Option value="add">新增按钮</Select.Option>
                  <Select.Option value="edit">编辑按钮</Select.Option>
                  <Select.Option value="delete">删除按钮</Select.Option>
                  <Select.Option value="import">导入按钮</Select.Option>
                  <Select.Option value="export">导出按钮</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item label="执行时机">
                <Select placeholder="请选择执行时机" style={{ width: '100%' }}>
                  <Select.Option value="before">执行前</Select.Option>
                  <Select.Option value="after">执行后</Select.Option>
                  <Select.Option value="replace">替换执行</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item label="JS脚本">
                <Input.TextArea
                  rows={15}
                  value={jsScript}
                  onChange={(e) => setJsScript(e.target.value)}
                  placeholder="请输入JavaScript脚本"
                  style={{ fontFamily: 'monospace' }}
                />
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleSave}
                    loading={loading}
                  >
                    保存
                  </Button>
                  <Button onClick={() => setJsScript('')}>清空</Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </div>
      ),
    },
  ];

  return (
    <Drawer
      title="增强配置"
      width={800}
      open={open}
      onClose={onClose}
      footer={
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose}>关闭</Button>
        </Space>
      }
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
    </Drawer>
  );
};

export default EnhanceDrawer;
