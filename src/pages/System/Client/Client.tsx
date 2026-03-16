import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { Button, Modal, message } from 'antd';
import React, { useState } from 'react';

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

const Client: React.FC = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [viewModalVisible, setViewModalVisible] = useState<boolean>(false);
  const [_currentClient, setCurrentClient] = useState<Client | null>(null);

  // 模拟客户端数据
  const {
    data: clients,
    loading,
    refresh,
  } = useRequest(() => {
    return new Promise<Client[]>((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: '1',
            name: 'Web端',
            clientId: 'web',
            clientSecret: 'web_secret',
            redirectUri: 'http://localhost:8000/callback',
            scope: 'all',
            status: '启用',
            remark: 'Web端客户端',
            createTime: '2026-01-01 00:00:00',
          },
          {
            id: '2',
            name: '移动端',
            clientId: 'mobile',
            clientSecret: 'mobile_secret',
            redirectUri: 'http://localhost:8000/mobile/callback',
            scope: 'all',
            status: '启用',
            remark: '移动端客户端',
            createTime: '2026-01-02 00:00:00',
          },
          {
            id: '3',
            name: '第三方',
            clientId: 'third',
            clientSecret: 'third_secret',
            redirectUri: 'http://localhost:8000/third/callback',
            scope: 'read',
            status: '禁用',
            remark: '第三方客户端',
            createTime: '2026-01-03 00:00:00',
          },
        ]);
      }, 500);
    });
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
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => {
              setCurrentClient(record);
              setEditModalVisible(true);
            }}
            style={{ marginRight: 8 }}
          >
            编辑
          </Button>
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: '确认删除',
                content: `确定要删除客户端 ${record.name} 吗？`,
                onOk: () => {
                  message.success('删除成功');
                  refresh();
                },
              });
            }}
          >
            删除
          </Button>
        </>
      ),
    },
  ];

  const handleAdd = () => {
    setAddModalVisible(true);
  };

  const handleAddOk = () => {
    message.success('添加成功');
    setAddModalVisible(false);
    refresh();
  };

  const handleEditOk = () => {
    message.success('编辑成功');
    setEditModalVisible(false);
    refresh();
  };

  return (
    <PageContainer
      title="客户端管理"
      subTitle="管理系统客户端，包括添加、编辑、删除客户端等操作"
      extra={[
        <Button
          key="add"
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
        >
          添加客户端
        </Button>,
      ]}
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
        <div style={{ padding: '24px' }}>
          <p>添加客户端表单</p>
        </div>
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
        <div style={{ padding: '24px' }}>
          <p>编辑客户端表单</p>
        </div>
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
          <p>查看客户端详情</p>
        </div>
      </Modal>
    </PageContainer>
  );
};

export default Client;
