import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  TestTubeOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { Button, Form, Input, Modal, message, Select, Switch } from 'antd';
import React, { useState } from 'react';

interface Datasource {
  id: string;
  name: string;
  type: string;
  url: string;
  username: string;
  password: string;
  driver: string;
  status: string;
  remark: string;
  createTime: string;
}

const Datasource: React.FC = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [viewModalVisible, setViewModalVisible] = useState<boolean>(false);
  const [_currentDatasource, setCurrentDatasource] =
    useState<Datasource | null>(null);
  const [_testing, setTesting] = useState<boolean>(false);

  // 模拟数据源数据
  const {
    data: datasources,
    loading,
    refresh,
  } = useRequest(() => {
    return new Promise<Datasource[]>((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: '1',
            name: '本地数据库',
            type: 'MySQL',
            url: 'jdbc:mysql://localhost:3306/sword',
            username: 'root',
            password: 'root',
            driver: 'com.mysql.cj.jdbc.Driver',
            status: '启用',
            remark: '本地开发数据库',
            createTime: '2026-01-01 00:00:00',
          },
          {
            id: '2',
            name: '测试数据库',
            type: 'MySQL',
            url: 'jdbc:mysql://test:3306/sword',
            username: 'test',
            password: 'test',
            driver: 'com.mysql.cj.jdbc.Driver',
            status: '启用',
            remark: '测试环境数据库',
            createTime: '2026-01-02 00:00:00',
          },
          {
            id: '3',
            name: '生产数据库',
            type: 'MySQL',
            url: 'jdbc:mysql://prod:3306/sword',
            username: 'prod',
            password: 'prod',
            driver: 'com.mysql.cj.jdbc.Driver',
            status: '禁用',
            remark: '生产环境数据库',
            createTime: '2026-01-03 00:00:00',
          },
        ]);
      }, 500);
    });
  });

  const columns: ProColumns<Datasource>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '数据源名称',
      dataIndex: 'name',
      key: 'name',
      search: true,
      width: 150,
    },
    {
      title: '数据库类型',
      dataIndex: 'type',
      key: 'type',
      filters: [
        { text: 'MySQL', value: 'MySQL' },
        { text: 'Oracle', value: 'Oracle' },
        { text: 'SQL Server', value: 'SQL Server' },
        { text: 'PostgreSQL', value: 'PostgreSQL' },
      ],
      width: 120,
    },
    {
      title: '连接URL',
      dataIndex: 'url',
      key: 'url',
      search: true,
      width: 300,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 120,
    },
    {
      title: '密码',
      dataIndex: 'password',
      key: 'password',
      width: 100,
      render: (_password) => <span>****</span>,
    },
    {
      title: '驱动类',
      dataIndex: 'driver',
      key: 'driver',
      width: 200,
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
      width: 180,
      render: (_: any, record: Datasource) => (
        <>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => {
              setCurrentDatasource(record);
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
              setCurrentDatasource(record);
              setEditModalVisible(true);
            }}
            style={{ marginRight: 8 }}
          >
            编辑
          </Button>
          <Button
            type="text"
            icon={<TestTubeOutlined />}
            onClick={() => {
              handleTestConnection(record);
            }}
            style={{ marginRight: 8 }}
          >
            测试
          </Button>
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: '确认删除',
                content: `确定要删除数据源 ${record.name} 吗？`,
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

  const handleTestConnection = (_datasource: Datasource) => {
    setTesting(true);
    setTimeout(() => {
      message.success('连接测试成功');
      setTesting(false);
    }, 1000);
  };

  const databaseTypes = [
    { label: 'MySQL', value: 'MySQL' },
    { label: 'Oracle', value: 'Oracle' },
    { label: 'SQL Server', value: 'SQL Server' },
    { label: 'PostgreSQL', value: 'PostgreSQL' },
  ];

  return (
    <PageContainer
      title="数据源管理"
      subTitle="管理系统数据源，包括添加、编辑、删除数据源和测试连接等操作"
      extra={[
        <Button
          key="add"
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
        >
          添加数据源
        </Button>,
      ]}
    >
      <ProTable
        columns={columns}
        dataSource={datasources}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        toolBarRender={false}
      />

      {/* 添加数据源弹窗 */}
      <Modal
        title="添加数据源"
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
          <Form layout="vertical">
            <Form.Item label="数据源名称">
              <Input placeholder="请输入数据源名称" />
            </Form.Item>
            <Form.Item label="数据库类型">
              <Select placeholder="请选择数据库类型">
                {databaseTypes.map((type) => (
                  <Option key={type.value} value={type.value}>
                    {type.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item label="连接URL">
              <Input placeholder="请输入连接URL" />
            </Form.Item>
            <Form.Item label="用户名">
              <Input placeholder="请输入用户名" />
            </Form.Item>
            <Form.Item label="密码">
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
            <Form.Item label="驱动类">
              <Input placeholder="请输入驱动类" />
            </Form.Item>
            <Form.Item label="启用">
              <Switch defaultChecked />
            </Form.Item>
            <Form.Item label="备注">
              <Input.TextArea rows={4} placeholder="请输入备注" />
            </Form.Item>
          </Form>
        </div>
      </Modal>

      {/* 编辑数据源弹窗 */}
      <Modal
        title="编辑数据源"
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
          <Form layout="vertical">
            <Form.Item label="数据源名称">
              <Input placeholder="请输入数据源名称" />
            </Form.Item>
            <Form.Item label="数据库类型">
              <Select placeholder="请选择数据库类型">
                {databaseTypes.map((type) => (
                  <Option key={type.value} value={type.value}>
                    {type.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item label="连接URL">
              <Input placeholder="请输入连接URL" />
            </Form.Item>
            <Form.Item label="用户名">
              <Input placeholder="请输入用户名" />
            </Form.Item>
            <Form.Item label="密码">
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
            <Form.Item label="驱动类">
              <Input placeholder="请输入驱动类" />
            </Form.Item>
            <Form.Item label="启用">
              <Switch defaultChecked />
            </Form.Item>
            <Form.Item label="备注">
              <Input.TextArea rows={4} placeholder="请输入备注" />
            </Form.Item>
          </Form>
        </div>
      </Modal>

      {/* 查看数据源弹窗 */}
      <Modal
        title="查看数据源"
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
          <p>查看数据源详情</p>
        </div>
      </Modal>
    </PageContainer>
  );
};

export default Datasource;
