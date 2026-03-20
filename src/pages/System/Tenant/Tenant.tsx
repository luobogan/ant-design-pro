import {
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { Button, Form, Input, Modal, message, Select, Space, Tag } from 'antd';
import React, { useMemo, useState, useEffect } from 'react';
import * as tenantApi from '@/services/system/tenant';
import { getButton } from '@/utils/authority';
import type { ButtonConfig } from '@/components/BusinessComponents/ToolBar';

const { Option } = Select;
const { TextArea } = Input;

interface Tenant {
  id: string;
  tenantId: string;
  tenantName: string;
  contactPerson: string;
  contactPhone: string;
  accountNumber: number;
  expireTime: string;
  bindDomain: string;
  status: number;
  createTime: string;
}

const TenantPage: React.FC = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [viewModalVisible, setViewModalVisible] = useState<boolean>(false);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [form] = Form.useForm();
  const [buttons, setButtons] = useState<ButtonConfig[]>([]);

  useEffect(() => {
    const btns = getButton('tenant');
    setButtons(btns || []);
  }, []);

  // 获取租户列表
  const {
    data: tenantData,
    loading,
    refresh,
  } = useRequest(() => {
    return tenantApi.list({});
  });

  // 转换租户数据
  const tenants = useMemo(() => {
    const records = Array.isArray(tenantData)
      ? tenantData
      : tenantData?.records || tenantData?.data || [];
    return records.map((tenant: any) => ({
      ...tenant,
      tenantId: tenant.tenantId || tenant.id || '',
      tenantName: tenant.tenantName || tenant.name || '',
      contactPerson: tenant.contactPerson || tenant.contact || '',
      contactPhone: tenant.contactPhone || tenant.phone || '',
      accountNumber: tenant.accountNumber || 0,
      expireTime: tenant.expireTime || '',
      bindDomain: tenant.bindDomain || '',
    }));
  }, [tenantData]);

  const columns: ProColumns<Tenant>[] = [
    {
      title: '#',
      dataIndex: 'index',
      key: 'index',
      width: 50,
      render: (_, __, index) => index + 1,
    },
    {
      title: '租户ID',
      dataIndex: 'tenantId',
      key: 'tenantId',
      search: true,
      width: 120,
    },
    {
      title: '租户名称',
      dataIndex: 'tenantName',
      key: 'tenantName',
      search: true,
      width: 150,
    },
    {
      title: '联系人',
      dataIndex: 'contactPerson',
      key: 'contactPerson',
      search: true,
      width: 120,
    },
    {
      title: '联系电话',
      dataIndex: 'contactPhone',
      key: 'contactPhone',
      search: true,
      width: 150,
    },
    {
      title: '账号额度',
      dataIndex: 'accountNumber',
      key: 'accountNumber',
      width: 100,
      render: (num) => <Tag color="blue">{num}</Tag>,
    },
    {
      title: '过期时间',
      dataIndex: 'expireTime',
      key: 'expireTime',
      width: 150,
      render: (time) =>
        time ? <Tag color="orange">{time}</Tag> : <Tag>不限期</Tag>,
    },
    {
      title: '绑定域名',
      dataIndex: 'bindDomain',
      key: 'bindDomain',
      width: 200,
      render: (domain) => domain || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_: any, record: Tenant) => (
        <Space>
          {buttons.some(btn => btn.code === 'tenant:view') && (
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            >
              查看
            </Button>
          )}
          {buttons.some(btn => btn.code === 'tenant:edit') && (
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
          )}
          {buttons.some(btn => btn.code === 'tenant:delete') && (
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete([record.id])}
            >
              删除
            </Button>
          )}
          {buttons.some(btn => btn.code === 'tenant:datasource') && (
            <Button type="link" icon={<DatabaseOutlined />}>
              数据源
            </Button>
          )}
          {buttons.some(btn => btn.code === 'tenant:package') && (
            <Button type="link" icon={<SettingOutlined />}>
              产品包
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const handleDelete = (ids: React.Key[]) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${ids.length} 个租户吗？`,
      onOk: async () => {
        try {
          await tenantApi.remove({ ids });
          message.success('删除成功');
          setSelectedRowKeys([]);
          refresh();
        } catch (_error) {
          message.error('删除失败');
        }
      },
    });
  };

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的租户');
      return;
    }
    handleDelete(selectedRowKeys);
  };

  const handleAdd = () => {
    form.resetFields();
    setAddModalVisible(true);
  };

  const handleAddOk = async () => {
    try {
      const values = await form.validateFields();
      await tenantApi.submit(values);
      message.success('添加成功');
      setAddModalVisible(false);
      refresh();
    } catch (_error) {
      message.error('添加失败');
    }
  };

  const handleEditOk = async () => {
    try {
      const values = await form.validateFields();
      await tenantApi.submit({ ...values, id: currentTenant?.id });
      message.success('编辑成功');
      setEditModalVisible(false);
      refresh();
    } catch (_error) {
      message.error('编辑失败');
    }
  };

  const handleView = (record: Tenant) => {
    setCurrentTenant(record);
    setViewModalVisible(true);
  };

  const handleEdit = (record: Tenant) => {
    setCurrentTenant(record);
    form.setFieldsValue({
      tenantId: record.tenantId,
      tenantName: record.tenantName,
      contactPerson: record.contactPerson,
      contactPhone: record.contactPhone,
      accountNumber: record.accountNumber,
      expireTime: record.expireTime,
      bindDomain: record.bindDomain,
    });
    setEditModalVisible(true);
  };

  return (
    <PageContainer
      title="租户管理"
      subTitle="管理系统租户，包括添加、编辑、删除租户等操作"
    >
      <ProTable
        columns={columns}
        dataSource={tenants}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        toolBarRender={() => [
          buttons.some(btn => btn.code === 'tenant:add') && (
            <Button
              key="add"
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              新增
            </Button>
          ),
          buttons.some(btn => btn.code === 'tenant:delete') && (
            <Button
              key="delete"
              danger
              icon={<DeleteOutlined />}
              onClick={handleBatchDelete}
              disabled={selectedRowKeys.length === 0}
            >
              删除
            </Button>
          ),
        ].filter(Boolean)}
        search={{
          labelWidth: 'auto',
          defaultCollapsed: false,
          span: 8,
        }}
      />

      {/* 新增/编辑租户弹窗 */}
      <Modal
        title={editModalVisible ? '编辑租户' : '新增租户'}
        open={addModalVisible || editModalVisible}
        onCancel={() => {
          setAddModalVisible(false);
          setEditModalVisible(false);
        }}
        onOk={editModalVisible ? handleEditOk : handleAddOk}
        width={700}
      >
        <Form form={form} layout="vertical" style={{ padding: '24px' }}>
          <Form.Item
            name="tenantId"
            label="租户ID"
            rules={[{ required: true, message: '请输入租户ID' }]}
          >
            <Input placeholder="请输入租户ID" disabled={editModalVisible} />
          </Form.Item>
          <Form.Item
            name="tenantName"
            label="租户名称"
            rules={[{ required: true, message: '请输入租户名称' }]}
          >
            <Input placeholder="请输入租户名称" />
          </Form.Item>
          <Form.Item
            name="contactPerson"
            label="联系人"
            rules={[{ required: true, message: '请输入联系人' }]}
          >
            <Input placeholder="请输入联系人" />
          </Form.Item>
          <Form.Item
            name="contactPhone"
            label="联系电话"
            rules={[{ required: true, message: '请输入联系电话' }]}
          >
            <Input placeholder="请输入联系电话" />
          </Form.Item>
          <Form.Item
            name="accountNumber"
            label="账号额度"
            rules={[{ required: true, message: '请输入账号额度' }]}
          >
            <Input type="number" placeholder="请输入账号额度" />
          </Form.Item>
          <Form.Item name="expireTime" label="过期时间">
            <Input placeholder="请输入过期时间，留空表示不限期" />
          </Form.Item>
          <Form.Item name="bindDomain" label="绑定域名">
            <Input placeholder="请输入绑定域名" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 查看租户弹窗 */}
      <Modal
        title="查看租户"
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
          {currentTenant && (
            <div>
              <p>
                <strong>租户ID：</strong>
                {currentTenant.tenantId}
              </p>
              <p>
                <strong>租户名称：</strong>
                {currentTenant.tenantName}
              </p>
              <p>
                <strong>联系人：</strong>
                {currentTenant.contactPerson}
              </p>
              <p>
                <strong>联系电话：</strong>
                {currentTenant.contactPhone}
              </p>
              <p>
                <strong>账号额度：</strong>
                {currentTenant.accountNumber}
              </p>
              <p>
                <strong>过期时间：</strong>
                {currentTenant.expireTime || '不限期'}
              </p>
              <p>
                <strong>绑定域名：</strong>
                {currentTenant.bindDomain || '-'}
              </p>
            </div>
          )}
        </div>
      </Modal>
    </PageContainer>
  );
};

export default TenantPage;
