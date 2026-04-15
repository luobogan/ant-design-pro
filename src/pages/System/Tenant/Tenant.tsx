import {
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  GiftOutlined,
  BoxPlotOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
// @ts-expect-error useRequest 由 @umijs/max 的 request 插件在运行时提供
import { useRequest } from '@umijs/max';
import { Button, Form, Input, Modal, message, Select, Space, Tag, DatePicker, Tree, Checkbox } from 'antd';
import dayjs from 'dayjs';
import React, { useMemo, useState, useEffect } from 'react';
import * as tenantApi from '@/services/system/tenant';
import { getButton } from '@/utils/authority';
import type { ButtonConfig } from '@/components/BusinessComponents/ToolBar';

interface TenantPackage {
  id: number;
  packageName: string;
  packageCode: string;
  description: string;
  status: number;
  createTime: string;
}

interface MenuTree {
  key: string;
  title: string;
  children?: MenuTree[];
}

interface Tenant {
  id: string;
  tenantId: string;
  tenantName: string;
  contactPerson: string;
  contactPhone: string;
  accountNumber: number;
  expireTime: string;
  bindDomain: string;
  address: string;
  status: number;
  createTime: string;
  packageId: number;
}

const TenantPage: React.FC = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [viewModalVisible, setViewModalVisible] = useState<boolean>(false);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [form] = Form.useForm();
  const [buttons, setButtons] = useState<ButtonConfig[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [packageModalVisible, setPackageModalVisible] = useState<boolean>(false);
  const [packages, setPackages] = useState<TenantPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [grantingTenantId, setGrantingTenantId] = useState<string>('');
  const [grantingTenantName, setGrantingTenantName] = useState<string>('');

  const [packageManageModalVisible, setPackageManageModalVisible] = useState(false);
  const [packageAddModalVisible, setPackageAddModalVisible] = useState(false);
  const [packageEditModalVisible, setPackageEditModalVisible] = useState(false);
  const [packageForm] = Form.useForm();
  const [menuTree, setMenuTree] = useState<MenuTree[]>([]);
  const [checkedMenuKeys, setCheckedMenuKeys] = useState<string[]>([]);
  const [editingPackage, setEditingPackage] = useState<TenantPackage | null>(null);
  const [selectedPackageIds, setSelectedPackageIds] = useState<React.Key[]>([]);
  const [nodeChecked, setNodeChecked] = useState(false);

  useEffect(() => {
    const btns = getButton('tenant');
    setButtons(btns || []);
  }, []);

  useEffect(() => {
    const checkSuperAdmin = async () => {
      try {
        const result = await tenantApi.isSuperAdmin();
        setIsSuperAdmin(result.data || false);
      } catch (error) {
        console.error('检查超级管理员失败:', error);
        setIsSuperAdmin(false);
      }
    };
    checkSuperAdmin();
  }, []);

  const {
    data: tenantData,
    loading,
    refresh,
  } = useRequest(() => {
    return tenantApi.list({});
  });

  const tenants = useMemo(() => {
    const records = Array.isArray(tenantData)
      ? tenantData
      : tenantData?.records || tenantData?.data || [];
    return records.map((tenant: any) => ({
      ...tenant,
      tenantId: tenant.tenantId || tenant.id || '',
      tenantName: tenant.tenantName || tenant.name || '',
      contactPerson: tenant.contactPerson || tenant.contact || tenant.linkman || '',
      contactPhone: tenant.contactPhone || tenant.phone || tenant.contactNumber || '',
      accountNumber: tenant.accountNumber || 0,
      expireTime: tenant.expireTime || tenant.expires || tenant.expire || '',
      bindDomain: tenant.bindDomain || tenant.domain || '',
      address: tenant.address || '',
      packageId: tenant.packageId || null,
    }));
  }, [tenantData]);

  const columns: ProColumns<Tenant>[] = [
    {
      title: '#',
      dataIndex: 'index',
      key: 'index',
      width: 50,
      render: (_: any, __: Tenant, index: number) => index + 1,
    },
    {
      title: '租户ID',
      dataIndex: 'tenantId',
      key: 'tenantId',
      width: 120,
      fieldProps: { placeholder: '请输入租户ID' },
    },
    {
      title: '租户名称',
      dataIndex: 'tenantName',
      key: 'tenantName',
      width: 150,
      fieldProps: { placeholder: '请输入租户名称' },
    },
    {
      title: '联系人',
      dataIndex: 'contactPerson',
      key: 'contactPerson',
      width: 120,
      fieldProps: { placeholder: '请输入联系人' },
    },
    {
      title: '联系电话',
      dataIndex: 'contactPhone',
      key: 'contactPhone',
      width: 150,
      fieldProps: { placeholder: '请输入联系电话' },
    },
    {
      title: '账号额度',
      dataIndex: 'accountNumber',
      key: 'accountNumber',
      width: 100,
      render: (_, record) => <Tag color="blue">{record.accountNumber}</Tag>,
    },
    {
      title: '过期时间',
      dataIndex: 'expireTime',
      key: 'expireTime',
      width: 150,
      render: (_, record) =>
        record.expireTime ? <Tag color="orange">{record.expireTime}</Tag> : <Tag>不限期</Tag>,
    },
    {
      title: '绑定域名',
      dataIndex: 'bindDomain',
      key: 'bindDomain',
      width: 200,
      render: (_, record) => record.bindDomain || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_: any, record: Tenant) => (
        <Space>
          {buttons.some(btn => btn.code === 'tenant_view') && (
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            >
              查看
            </Button>
          )}
          {buttons.some(btn => btn.code === 'tenant_edit') && (
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
          )}
          {buttons.some(btn => btn.code === 'tenant_delete') && record.tenantId !== '000000' && (
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete([record.id])}
            >
              删除
            </Button>
          )}
          {buttons.some(btn => btn.code === 'tenant_datasource') && (
            <Button type="link" icon={<DatabaseOutlined />}>
              数据源
            </Button>
          )}
          {isSuperAdmin && record.tenantId !== '000000' && (
            <Button
              type="link"
              icon={<GiftOutlined />}
              onClick={() => handlePackageAssign(record)}
            >
              分配产品包
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const handlePackageAssign = async (record: Tenant) => {
    setGrantingTenantId(record.tenantId);
    setGrantingTenantName(record.tenantName);
    setSelectedPackageId(record.packageId || null);
    try {
      const result = await tenantApi.packageSelect();
      if (result.success && result.data) {
        setPackages(result.data);
      }
    } catch (error) {
      console.error('获取产品包列表失败:', error);
      message.error('获取产品包列表失败');
      return;
    }
    setPackageModalVisible(true);
  };

  const handlePackageAssignOk = async () => {
    if (!selectedPackageId) {
      message.warning('请选择产品包');
      return;
    }
    try {
      const result = await tenantApi.assignPackage(grantingTenantId, selectedPackageId);
      if (result.success) {
        message.success('产品包分配成功');
        setPackageModalVisible(false);
        refresh();
      } else {
        message.error(result.msg || '产品包分配失败');
      }
    } catch (error) {
      console.error('产品包分配失败:', error);
      message.error('产品包分配失败');
    }
  };

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
      const submitValues: any = {
        tenantId: values.tenantId,
        tenantName: values.tenantName,
        linkman: values.contactPerson,
        contactNumber: values.contactPhone,
        accountNumber: values.accountNumber,
        domain: values.bindDomain,
        address: values.address,
      };
      if (values.expireTime) {
        submitValues.expireTime = values.expireTime.format('YYYY-MM-DD');
      }
      await tenantApi.submit(submitValues);
      message.success('添加成功');
      setAddModalVisible(false);
      refresh();
    } catch (error) {
      console.error('添加失败:', error);
      message.error('添加失败');
    }
  };

  const handleEditOk = async () => {
    try {
      const values = await form.validateFields();
      const submitValues: any = {
        id: currentTenant?.id,
        tenantId: values.tenantId,
        tenantName: values.tenantName,
        linkman: values.contactPerson,
        contactNumber: values.contactPhone,
        accountNumber: values.accountNumber,
        domain: values.bindDomain,
        address: values.address,
      };
      if (values.expireTime) {
        submitValues.expireTime = values.expireTime.format('YYYY-MM-DD');
      }
      await tenantApi.submit(submitValues);
      message.success('编辑成功');
      setEditModalVisible(false);
      refresh();
    } catch (error) {
      console.error('编辑失败:', error);
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
      expireTime: record.expireTime ? dayjs(record.expireTime) : null,
      bindDomain: record.bindDomain,
      address: record.address,
    });
    setEditModalVisible(true);
  };

  const handleOpenPackageManage = async () => {
    await fetchPackages();
    setPackageManageModalVisible(true);
  };

  const fetchPackages = async () => {
    try {
      const result = await tenantApi.tenantPackageApi.list({ current: 1, size: 100 });
      if (result.success && result.data) {
        setPackages(result.data.records || []);
      }
    } catch (error) {
      console.error('获取产品包列表失败:', error);
    }
  };

  const handleAddPackage = async () => {
    packageForm.resetFields();
    setCheckedMenuKeys([]);
    setEditingPackage(null);
    await fetchMenuTree();
    setPackageAddModalVisible(true);
  };

  const fetchMenuTree = async (): Promise<MenuTree[]> => {
    try {
      const result = await tenantApi.tenantPackageApi.menuGrantTree();
      if (result.success && result.data) {
        const formattedTree = formatMenuTree(result.data.menu || []);
        setMenuTree(formattedTree);
        return formattedTree;
      }
    } catch (error) {
      console.error('获取菜单树失败:', error);
    }

    return [];
  };

  const formatMenuTree = (menuList: any[]): MenuTree[] => {
    return menuList.map(menu => ({
      key: String(menu.id),
      title: menu.title || menu.name || '---',
      children: menu.children ? formatMenuTree(menu.children) : undefined,
    }));
  };

  const handleEditPackage = async (pkg: TenantPackage) => {
    setEditingPackage(pkg);
    packageForm.setFieldsValue({
      id: pkg.id,
      packageName: pkg.packageName,
      packageCode: pkg.packageCode,
      description: pkg.description,
      status: pkg.status,
    });
    const menuData = await fetchMenuTree();
    console.log('menuData:', menuData);
    
    const result = await tenantApi.tenantPackageApi.packageMenuKeys(pkg.id);
    console.log('packageMenuKeys result:', result);
    
    if (result.success && result.data) {
      const checkedKeys = result.data.menu?.checkedKeys || [];
      console.log('checkedKeys from API:', checkedKeys);
      
      const validKeys = menuData.length > 0 ? filterValidKeys(checkedKeys, menuData) : [];
      console.log('validKeys after filter:', validKeys);
      
      setCheckedMenuKeys(validKeys);
    } else {
      console.log('API call failed or no data');
      setCheckedMenuKeys([]);
    }
    setPackageEditModalVisible(true);
  };

  const filterValidKeys = (keys: string[], tree: MenuTree[]): string[] => {
    const validKeySet = new Set<string>();
    const collectKeys = (nodes: MenuTree[]) => {
      nodes.forEach(node => {
        validKeySet.add(node.key);
        if (node.children) {
          collectKeys(node.children);
        }
      });
    };
    collectKeys(tree);
    return keys.filter(key => validKeySet.has(key));
  };

  const handleDeletePackage = async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个产品包吗？',
      onOk: async () => {
        try {
          const result = await tenantApi.tenantPackageApi.remove(id);
          if (result.success) {
            message.success('删除成功');
            await fetchPackages();
          } else {
            message.error(result.msg || '删除失败');
          }
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  const handleBatchDeletePackage = () => {
    if (selectedPackageIds.length === 0) {
      message.warning('请选择要删除的产品包');
      return;
    }
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedPackageIds.length} 个产品包吗？`,
      onOk: async () => {
        try {
          for (const id of selectedPackageIds) {
            await tenantApi.tenantPackageApi.remove(Number(id));
          }
          message.success('删除成功');
          setSelectedPackageIds([]);
          await fetchPackages();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  const handlePackageSubmit = async () => {
    try {
      const values = await packageForm.validateFields();
      const submitValues = {
        ...values,
        tenantId: '000000',
      };

      let pkgId = editingPackage?.id;

      if (editingPackage) {
        await tenantApi.tenantPackageApi.update(submitValues);
        message.success('更新成功');
        setPackageEditModalVisible(false);
      } else {
        const result = await tenantApi.tenantPackageApi.submit(submitValues);
        if (result.success && result.data) {
          pkgId = result.data.id;
        }
        message.success('创建成功');
        setPackageAddModalVisible(false);
      }

      if (checkedMenuKeys.length > 0 && pkgId) {
        await tenantApi.tenantPackageApi.grantMenu(pkgId, checkedMenuKeys.map(k => Number(k)));
      }

      await fetchPackages();
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败');
    }
  };

  const handleCheckAll = () => {
    const allKeys: string[] = [];
    const collectKeys = (tree: MenuTree[]) => {
      tree.forEach(node => {
        allKeys.push(node.key);
        if (node.children) {
          collectKeys(node.children);
        }
      });
    };
    collectKeys(menuTree);
    setCheckedMenuKeys(allKeys);
  };

  const handleUncheckAll = () => {
    setCheckedMenuKeys([]);
  };

  const handleNodeCheckChange = (checked: boolean) => {
    setNodeChecked(checked);
    // 只切换联动模式，不自动勾选/取消勾选菜单
    // 开启时：勾选父节点会自动勾选子节点
    // 关闭时：可以独立勾选任意节点
  };

  const packageColumns: ProColumns<TenantPackage>[] = [
    {
      title: '#',
      dataIndex: 'index',
      key: 'index',
      width: 50,
      render: (_: any, __: TenantPackage, index: number) => index + 1,
    },
    {
      title: '产品包名',
      dataIndex: 'packageName',
      key: 'packageName',
    },
    {
      title: '产品包编码',
      dataIndex: 'packageCode',
      key: 'packageCode',
    },
    {
      title: '备注',
      dataIndex: 'description',
      key: 'description',
      render: (_, record) => record.description || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: TenantPackage) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditPackage(record)}>
            编辑
          </Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDeletePackage(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

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
          getCheckboxProps: (record: Tenant) => ({
            disabled: record.tenantId === '000000',
          }),
        }}
        toolBarRender={() => [
          buttons.some(btn => btn.code === 'tenant_add') && (
            <Button
              key="add"
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              新增
            </Button>
          ),
          buttons.some(btn => btn.code === 'tenant_delete') && (
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
          isSuperAdmin && (
            <Button
              key="packageManage"
              type="primary"
              icon={<BoxPlotOutlined />}
              onClick={handleOpenPackageManage}
            >
              产品包管理
            </Button>
          ),
        ].filter(Boolean)}
        search={{
          labelWidth: 'auto',
          defaultCollapsed: false,
          span: 8,
        }}
      />

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
            <DatePicker
              style={{ width: '100%' }}
              placeholder="请选择过期时间，留空表示不限期"
              format="YYYY-MM-DD"
            />
          </Form.Item>
          <Form.Item name="bindDomain" label="绑定域名">
            <Input placeholder="请输入绑定域名" />
          </Form.Item>
          <Form.Item name="address" label="联系地址">
            <Input.TextArea style={{ minHeight: 32 }} rows={3} placeholder="请输入联系地址" />
          </Form.Item>
        </Form>
      </Modal>

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
              <p>
                <strong>联系地址：</strong>
                {currentTenant.address || '-'}
              </p>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        title={`为租户 "${grantingTenantName}" 分配产品包`}
        open={packageModalVisible}
        onCancel={() => setPackageModalVisible(false)}
        onOk={handlePackageAssignOk}
        width={500}
      >
        <div style={{ padding: '24px' }}>
          <Form.Item label="选择产品包">
            <Select
              style={{ width: '100%' }}
              placeholder="请选择产品包"
              value={selectedPackageId}
              onChange={(value) => setSelectedPackageId(value)}
            >
              {packages.map(pkg => (
                <Select.Option key={pkg.id} value={pkg.id}>
                  {pkg.packageName} ({pkg.packageCode})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </div>
      </Modal>

      <Modal
        title="租户产品包管理"
        open={packageManageModalVisible}
        onCancel={() => setPackageManageModalVisible(false)}
        width={900}
        footer={null}
      >
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <Input.Search
                placeholder="产品包名"
                style={{ width: 200, marginRight: 16 }}
              />
              <Button onClick={() => setPackages(packages)}>清空</Button>
            </div>
            <div>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddPackage}>
                新增
              </Button>
              <Button danger icon={<DeleteOutlined />} onClick={handleBatchDeletePackage} disabled={selectedPackageIds.length === 0} style={{ marginLeft: 8 }}>
                删除
              </Button>
            </div>
          </div>
          <ProTable
            columns={packageColumns}
            dataSource={packages}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            rowSelection={{
              selectedRowKeys: selectedPackageIds,
              onChange: (keys) => setSelectedPackageIds(keys),
            }}
          />
        </div>
      </Modal>

      <Modal
        title={editingPackage ? '编辑产品包' : '新增'}
        open={packageAddModalVisible || packageEditModalVisible}
        onCancel={() => {
          setPackageAddModalVisible(false);
          setPackageEditModalVisible(false);
        }}
        onOk={handlePackageSubmit}
        width={600}
      >
        <Form form={packageForm} layout="vertical" style={{ padding: '24px' }}>
          <Form.Item name="id" label={false}>
            <Input type="hidden" />
          </Form.Item>
          <Form.Item
            name="packageName"
            label="产品包名"
            rules={[{ required: true, message: '请输入产品包名' }]}
          >
            <Input placeholder="请输入产品包名" />
          </Form.Item>
          <Form.Item
            name="packageCode"
            label="产品包编码"
            rules={[{ required: true, message: '请输入产品包编码' }]}
          >
            <Input placeholder="请输入产品包编码" />
          </Form.Item>
          <Form.Item name="description" label="备注">
            <Input.TextArea placeholder="请输入备注" />
          </Form.Item>
          <div style={{ marginBottom: 8 }}>
            <Space>
              <Checkbox checked={nodeChecked} onChange={(e) => handleNodeCheckChange(e.target.checked)}>
                节点联动
              </Checkbox>
              <Button type="link" onClick={handleCheckAll}>全选</Button>
              <Button type="link" onClick={handleUncheckAll}>反选</Button>
            </Space>
          </div>
          <Tree
            checkable
            treeData={menuTree}
            checkedKeys={checkedMenuKeys}
            onCheck={(checkedKeys) => {
              setCheckedMenuKeys(checkedKeys as string[]);
            }}
            checkStrictly={!nodeChecked}
            defaultExpandAll
            style={{ maxHeight: 300, overflowY: 'auto' }}
          />
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default TenantPage;
