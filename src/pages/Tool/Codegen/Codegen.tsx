import { DownloadOutlined, GenerateOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { Button, Form, Input, Modal, message, Select, TreeSelect } from 'antd';
import React, { useState } from 'react';

const { Option } = Select;
const { TextArea } = Input;

const Codegen: React.FC = () => {
  const [form] = Form.useForm();
  const [generateModalVisible, setGenerateModalVisible] =
    useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const handleGenerate = async (_values: any) => {
    setLoading(true);
    try {
      // Simulate code generation
      await new Promise((resolve) => setTimeout(resolve, 1000));
      message.success('代码生成成功');
      setGenerateModalVisible(true);
    } catch (_error) {
      message.error('代码生成失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    message.success('代码下载成功');
    setGenerateModalVisible(false);
  };

  const tableOptions = [
    { label: '用户表', value: 'user' },
    { label: '角色表', value: 'role' },
    { label: '部门表', value: 'dept' },
    { label: '菜单表', value: 'menu' },
    { label: '字典表', value: 'dict' },
  ];

  const templateOptions = [
    { label: 'CRUD模板', value: 'crud' },
    { label: '列表模板', value: 'list' },
    { label: '表单模板', value: 'form' },
    { label: '详情模板', value: 'detail' },
  ];

  const frameworkOptions = [
    { label: 'React + Ant Design Pro', value: 'react_antd' },
    { label: 'Vue + Element Plus', value: 'vue_element' },
    { label: 'Angular + NgZorro', value: 'angular_ngzorro' },
  ];

  return (
    <PageContainer
      title="代码生成"
      subTitle="根据数据库表结构生成前端代码，支持多种框架和模板"
      extra={[
        <Button
          key="generate"
          type="primary"
          icon={<GenerateOutlined />}
          onClick={() => form.submit()}
          loading={loading}
        >
          生成代码
        </Button>,
      ]}
    >
      <div
        style={{
          padding: '24px',
          backgroundColor: '#fff',
          borderRadius: '8px',
        }}
      >
        <Form form={form} layout="vertical" onFinish={handleGenerate}>
          <Form.Item
            label="数据库表"
            name="tables"
            rules={[{ required: true, message: '请选择数据库表' }]}
          >
            <TreeSelect
              treeData={[
                {
                  title: '系统表',
                  value: 'system',
                  children: tableOptions,
                },
              ]}
              placeholder="请选择要生成代码的表"
              treeCheckable
              showCheckedStrategy={TreeSelect.SHOW_PARENT}
            />
          </Form.Item>

          <Form.Item
            label="代码模板"
            name="template"
            rules={[{ required: true, message: '请选择代码模板' }]}
          >
            <Select placeholder="请选择代码模板" options={templateOptions} />
          </Form.Item>

          <Form.Item
            label="前端框架"
            name="framework"
            rules={[{ required: true, message: '请选择前端框架' }]}
          >
            <Select placeholder="请选择前端框架" options={frameworkOptions} />
          </Form.Item>

          <Form.Item
            label="生成路径"
            name="path"
            rules={[{ required: true, message: '请输入生成路径' }]}
          >
            <Input placeholder="请输入代码生成路径" />
          </Form.Item>

          <Form.Item label="代码注释" name="comment">
            <TextArea rows={4} placeholder="请输入代码注释" />
          </Form.Item>
        </Form>
      </div>

      {/* 代码生成结果弹窗 */}
      <Modal
        title="代码生成结果"
        open={generateModalVisible}
        onCancel={() => setGenerateModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setGenerateModalVisible(false)}>
            取消
          </Button>,
          <Button
            key="download"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleDownload}
          >
            下载代码
          </Button>,
        ]}
        width={800}
      >
        <div style={{ padding: '24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <strong>生成状态：</strong>
            <span style={{ color: '#52c41a' }}>成功</span>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <strong>生成文件：</strong>
            <ul style={{ marginTop: '8px', marginLeft: '20px' }}>
              <li>User.tsx</li>
              <li>UserAdd.tsx</li>
              <li>UserEdit.tsx</li>
              <li>UserView.tsx</li>
              <li>User.tsx</li>
            </ul>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <strong>生成路径：</strong>
            <span>/src/pages/System/User</span>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <strong>生成时间：</strong>
            <span>{new Date().toLocaleString()}</span>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
};

export default Codegen;
