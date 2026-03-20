import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { Button, Form, Input, Modal, message, Select } from 'antd';
import React, { useState, useEffect } from 'react';
import * as clientApi from '@/services/system/client';
import { getButton } from '@/utils/authority';
import type { ButtonConfig } from '@/components/BusinessComponents/ToolBar';

interface Client {
  id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
  status: string;
  remark: string;
  createTime: string;
}

const { Option } = Select;
const { TextArea } = Input;

const Client: React.FC = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [viewModalVisible, setViewModalVisible] = useState<boolean>(false);
  const [currentClient, setCurrentClient] = useState<Client | null>(null);
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [buttons, setButtons] = useState<ButtonConfig[]>([]);

  useEffect(() => {
    const btns = getButton('client');
    setButtons(btns || []);
  }, []);

  // 获取客户端列表
  const {
    data: clients,
    loading,
    refresh,
  } = useRequest(() => {
    return clientApi.list({});
  });

  const columns: ProColumns<Client>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '客户端名称',
      dataIndex: 'name',
      key: 'name',
      search: true,
      width: 150,
    },
    {
      title: 'Client ID',
      dataIndex: 'clientId',
      key: 'clientId',
      search: true,
      width: 150,
    },
    {
      title: 'Client Secret',
      dataIndex: 'clientSecret',
      key: 'clientSecret',
      width: 150,
      render: (secret) => <span>{secret.substring(0, 6)}****</span>,
    },
    {
      title: 'Redirect URI',
      dataIndex: 'redirectUri',
      key: 'redirectUri',
      search: true,
      width: 300,
    },
    {
      title: 'Scope',
      dataIndex: 'scope',
      key: 'scope',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      filters: [
        { text: '启用', value: '启用' },
        { text: '禁用', value: '禁用' },
      ],
      render: (status) => (
        <span style={{ color: status === '启用' ? '#52c41a' : '#ff4d4f' }}>
          {status}
        </span>
      ),
      width: 80,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 200,
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
      valueType: 'dateTime',
      width: 180,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: Client) => (
        <>
          {buttons.some(btn => btn.code === 'client:view') && (
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => {
                setCurrentClient(record);
                setViewModalVisible(true);
              }}
              style={{ marginRight: 8 }}
            >
              查看
            </Button>
          )}
          {buttons.some(btn => btn.code === 'client:edit') && (
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => {
                setCurrentClient(record);
                editForm.setFieldsValue(record);
                setEditModalVisible(true);
              }}
              style={{ marginRight: 8 }}
            >
              编辑
            </Button>
          )}
          {buttons.some(btn => btn.code === 'client:delete') && (
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: '确认删除',
                  content: `确定要删除客户端 ${record.name} 吗？`,
                  onOk: async () => {
                    try {
                      await clientApi.remove({ ids: [record.id] });
                      message.success('删除成功');
                      refresh();
                    } catch {
                      message.error('删除失败');
                    }
                  },
                });
              }}
            >
              删除
            </Button>
          )}
        </>
      ),
    },
  ];

  const handleAdd = () => {
    addForm.resetFields();
    setAddModalVisible(true);
  };

  const handleAddOk = async () => {
    try {
      const values = await addForm.validateFields();
      await clientApi.submit(values);
      message.success('添加成功');
      setAddModalVisible(false);
      refresh();
    } catch {
      message.error('添加失败');
    }
  };

  const handleEditOk = async () => {
    try {
      const values = await editForm.validateFields();
      await clientApi.submit({ ...values, id: currentClient?.id });
      message.success('编辑成功');
      setEditModalVisible(false);
      refresh();
    } catch {
      message.error('编辑失败');
    }
  };

  return (
    <PageContainer
      title="客户端管理"
      subTitle="管理系统客户端，包括添加、编辑、删除客户端等操作"
      extra={buttons.filter(btn => btn.action === 1 || btn.action === 3).map(btn => (
        <Button
          key={btn.code}
          type={btn.alias === 'add' ? 'primary' : 'default'}
          icon={btn.source ? <span>{btn.source}</span> : undefined}
          onClick={handleAdd}
        >
          {btn.name}
        </Button>
      ))}
    >
      <ProTable
        columns={columns}
        dataSource={clients}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        toolBarRender={false}
      />

      {/* 添加客户端弹窗 */}
      <Modal
        title="添加客户端"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        onOk={handleAddOk}
        footer={[
          <Button key="cancel" onClick={() => setAddModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={handleAddOk}>
            确定
          </Button>,
        ]}
        width={600}
      >
        <Form form={addForm} layout="vertical" style={{ padding: '24px' }}>
          <Form.Item
            name="name"
            label="客户端名称"
            rules={[{ required: true, message: '请输入客户端名称' }]}
          >
            <Input placeholder="请输入客户端名称" />
          </Form.Item>
          <Form.Item
            name="clientId"
            label="Client ID"
            rules={[{ required: true, message: '请输入 Client ID' }]}
          >
            <Input placeholder="请输入 Client ID" />
          </Form.Item>
          <Form.Item
            name="clientSecret"
            label="Client Secret"
            rules={[{ required: true, message: '请输入 Client Secret' }]}
          >
            <Input.Password placeholder="请输入 Client Secret" />
          </Form.Item>
          <Form.Item
            name="redirectUri"
            label="Redirect URI"
            rules={[{ required: true, message: '请输入 Redirect URI' }]}
          >
            <Input placeholder="请输入 Redirect URI" />
          </Form.Item>
          <Form.Item
            name="scope"
            label="授权范围"
            rules={[{ required: true, message: '请选择授权范围' }]}
          >
            <Select placeholder="请选择授权范围">
              <Option value="all">全部权限</Option>
              <Option value="read">只读权限</Option>
              <Option value="write">写入权限</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select placeholder="请选择状态">
              <Option value="启用">启用</Option>
              <Option value="禁用">禁用</Option>
            </Select>
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑客户端弹窗 */}
      <Modal
        title="编辑客户端"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleEditOk}
        footer={[
          <Button key="cancel" onClick={() => setEditModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={handleEditOk}>
            确定
          </Button>,
        ]}
        width={600}
      >
        <Form form={editForm} layout="vertical" style={{ padding: '24px' }}>
          <Form.Item name="id" hidden>
            <Input />
          </Form.Item>
          <Form.Item
            name="name"
            label="客户端名称"
            rules={[{ required: true, message: '请输入客户端名称' }]}
          >
            <Input placeholder="请输入客户端名称" />
          </Form.Item>
          <Form.Item
            name="clientId"
            label="Client ID"
            rules={[{ required: true, message: '请输入 Client ID' }]}
          >
            <Input placeholder="请输入 Client ID" />
          </Form.Item>
          <Form.Item name="clientSecret" label="Client Secret">
            <Input.Password placeholder="留空表示不修改" />
          </Form.Item>
          <Form.Item
            name="redirectUri"
            label="Redirect URI"
            rules={[{ required: true, message: '请输入 Redirect URI' }]}
          >
            <Input placeholder="请输入 Redirect URI" />
          </Form.Item>
          <Form.Item
            name="scope"
            label="授权范围"
            rules={[{ required: true, message: '请选择授权范围' }]}
          >
            <Select placeholder="请选择授权范围">
              <Option value="all">全部权限</Option>
              <Option value="read">只读权限</Option>
              <Option value="write">写入权限</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select placeholder="请选择状态">
              <Option value="启用">启用</Option>
              <Option value="禁用">禁用</Option>
            </Select>
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 查看客户端弹窗 */}
      <Modal
        title="查看客户端"
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={[
          <Button key="ok" onClick={() => setViewModalVisible(false)}>
            确定
          </Button>,
        ]}
        width={600}
      >
        <div style={{ padding: '24px' }}>
          {currentClient && (
            <div>
              <p>
                <strong>客户端名称：</strong>
                {currentClient.name}
              </p>
              <p>
                <strong>Client ID：</strong>
                {currentClient.clientId}
              </p>
              <p>
                <strong>Client Secret：</strong>
                <span>{currentClient.clientSecret.substring(0, 6)}****</span>
              </p>
              <p>
                <strong>Redirect URI：</strong>
                {currentClient.redirectUri}
              </p>
              <p>
                <strong>授权范围：</strong>
                {currentClient.scope}
              </p>
              <p>
                <strong>状态：</strong>
                <span style={{ color: currentClient.status === '启用' ? '#52c41a' : '#ff4d4f' }}>
                  {currentClient.status}
                </span>
              </p>
              <p>
                <strong>备注：</strong>
                {currentClient.remark || '-'}
              </p>
              <p>
                <strong>创建时间：</strong>
                {currentClient.createTime}
              </p>
            </div>
          )}
        </div>
      </Modal>
    </PageContainer>
  );
};

export default Client;
