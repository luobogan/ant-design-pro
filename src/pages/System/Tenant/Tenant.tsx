import {
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  GiftOutlined,
  BoxPlotOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
// @ts-expect-error useRequest 由 @umijs/max 的 request 插件在运行时提供
import { useRequest } from '@umijs/max';
import { Button, Form, Input, Modal, message, Select, Space, Tag, DatePicker, Tree, Checkbox, Spin } from 'antd';
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
  const [previewMenuTree, setPreviewMenuTree] = useState<MenuTree[]>([]);
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
  const [diagnoseModalVisible, setDiagnoseModalVisible] = useState(false);
  const [diagnoseData, setDiagnoseData] = useState<any>(null);
  const [diagnosingTenantId, setDiagnosingTenantId] = useState<string>('');

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
          {isSuperAdmin && record.tenantId !== '000000' && (
            <Button
              type="link"
              icon={<ToolOutlined />}
              onClick={() => handleDiagnoseAndFix(record)}
            >
              诊断修复
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
    setPreviewMenuTree([]);
    try {
      const result = await tenantApi.packageSelect();
      if (result.success && result.data) {
        setPackages(result.data);
      }
      if (record.packageId) {
        await loadPreviewMenuTree(record.packageId);
      }
    } catch (error) {
      console.error('获取产品包列表失败:', error);
      message.error('获取产品包列表失败');
      return;
    }
    setPackageModalVisible(true);
  };

  const loadPreviewMenuTree = async (packageId: number) => {
    try {
      const result = await tenantApi.tenantPackageApi.packageMenuTree(packageId);
      if (result.success && result.data) {
        setPreviewMenuTree(formatMenuTree(result.data));
      } else {
        setPreviewMenuTree([]);
      }
    } catch (error) {
      console.error('加载菜单预览失败:', error);
      setPreviewMenuTree([]);
    }
  };

  const handlePackageSelectChange = async (value: number) => {
    setSelectedPackageId(value);
    if (value) {
      await loadPreviewMenuTree(value);
    } else {
      setPreviewMenuTree([]);
    }
  };

  const handleDiagnoseAndFix = async (record: Tenant) => {
    setDiagnosingTenantId(record.tenantId);
    setDiagnoseData(null);
    setDiagnoseModalVisible(true);

    try {
      const result = await tenantApi.diagnose(record.tenantId);
      setDiagnoseData(result.data || null);
    } catch (error) {
      console.error('诊断失败:', error);
      message.error('诊断请求失败');
    }
  };

  const handleAutoFix = async () => {
    if (!diagnosingTenantId) return;

    try {
      const result = await tenantApi.autoFix(diagnosingTenantId);
      if (result.success) {
        const data = result.data || {};
        Modal.success({
          title: '修复完成',
          content: (
            <div>
              <div style={{ marginBottom: 8, fontWeight: 'bold' }}>{data.conclusion}</div>
              {(data.actions || []).map((action: string, i: number) => (
                <div key={i} style={{ lineHeight: '22px', fontSize: 13 }}>{action}</div>
              ))}
              {data.fixedUserCount > 0 && (
                <div style={{ marginTop: 8, color: '#fa8c16', fontSize: 12 }}>
                  ⚠️ 被修复的用户需要重新登录后才能生效
                </div>
              )}
            </div>
          ),
          okText: '知道了',
          onOk: () => {
            setDiagnoseModalVisible(false);
            refresh();
          },
        });
      } else {
        message.error(result.msg || '修复失败');
      }
    } catch (error) {
      console.error('修复失败:', error);
      message.error('修复请求失败');
    }
  };

  const handlePackageAssignOk = async () => {
    if (!selectedPackageId) {
      message.warning('请选择产品包');
      return;
    }
    try {
      const result = await tenantApi.assignPackage(grantingTenantId, selectedPackageId);
      if (result.success) {
        const data = result.data || {};
        const lines = [
          `✅ 产品包【${data.packageName || '未知'}】分配成功`,
          data.menuCount != null ? `📁 菜单权限: ${data.menuCount} 个` : '',
          data.buttonCount != null ? `🔘 按钮权限: ${data.buttonCount} 个` : '',
          data.roleCount != null ? `👥 关联角色: ${data.roleCount} 个` : '',
          data.fixedUserCount > 0 ? `🔧 自动修复用户: ${data.fixedUserCount} 个（roleId为空已补全）` : '',
        ].filter(Boolean);

        Modal.success({
          title: '分配完成',
          content: (
            <div>
              {lines.map((line, i) => (
                <div key={i} style={{ lineHeight: '24px' }}>{line}</div>
              ))}
              <div style={{ marginTop: 12, color: '#888', fontSize: 12 }}>
                提示：租户用户需要重新登录后才能看到新的菜单和权限
              </div>
            </div>
          ),
          okText: '知道了',
        });
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

  const countMenuNodes = (tree: MenuTree[]): number => {
    let count = 0;
    for (const node of tree) {
      count++;
      if (node.children && node.children.length > 0) {
        count += countMenuNodes(node.children);
      }
    }
    return count;
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

    // 兼容后端返回的多种数据格式
    let rawCheckedKeys: any[] = [];
    if (result.success && result.data) {
      rawCheckedKeys = result.data?.menu?.checkedKeys || result.data?.checkedKeys || result.data || [];
      console.log('rawCheckedKeys from API:', rawCheckedKeys, typeof rawCheckedKeys);
    }
    
    // 统一转为字符串，确保与 MenuTree 的 key 类型匹配
    const checkedKeys = rawCheckedKeys.map((k: any) => String(k));
    
    const validKeys = menuData.length > 0 ? filterValidKeys(checkedKeys, menuData) : checkedKeys;
    console.log('validKeys after filter:', validKeys);

    setCheckedMenuKeys(validKeys);
    setPackageEditModalVisible(true);
  };

  const filterValidKeys = (keys: string[], tree: MenuTree[]): string[] => {
    // 如果 tree 为空，不过滤直接返回
    if (!tree || tree.length === 0) return keys;
    const validKeySet = new Set<string>();
    const collectKeys = (nodes: MenuTree[]) => {
      nodes.forEach(node => {
        validKeySet.add(String(node.key));
        if (node.children) {
          collectKeys(node.children);
        }
      });
    };
    collectKeys(tree);
    return keys.filter(key => key != null && validKeySet.has(String(key)));
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
        // 直接传递字符串数组，避免 Number() 导致 JavaScript 大数(Long)精度丢失
        // 后端 Jackson 会自动将字符串解析为 Long
        await tenantApi.tenantPackageApi.grantMenu(pkgId, checkedMenuKeys);
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
        width={560}
      >
        <div style={{ padding: '16px 24px' }}>
          <Form.Item label="选择产品包" style={{ marginBottom: 12 }}>
            <Select
              style={{ width: '100%' }}
              placeholder="请选择产品包"
              value={selectedPackageId}
              onChange={handlePackageSelectChange}
            >
              {packages.map(pkg => (
                <Select.Option key={pkg.id} value={pkg.id}>
                  {pkg.packageName} ({pkg.packageCode})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {previewMenuTree.length > 0 ? (
            <div>
              <div style={{ marginBottom: 8, fontSize: 13, color: '#666' }}>
                📦 产品包包含以下菜单（共 {countMenuNodes(previewMenuTree)} 个）：
              </div>
              <Tree
                treeData={previewMenuTree}
                defaultExpandAll
                style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 6, padding: '8px 0', maxHeight: 320, overflowY: 'auto' }}
              />
            </div>
          ) : selectedPackageId ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
              该产品包暂未配置任何菜单权限
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 20, color: '#bbb' }}>
              👆 请先选择一个产品包
            </div>
          )}
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
            onCheck={(keys) => {
              // 兼容 Antd Tree 返回的多种格式：
              // - checkStrictly=true 时返回 string[] | number[]
              // - checkStrictly=false 时返回 { checked, halfChecked }
              const newKeys = Array.isArray(keys) ? keys : (keys as any).checked || [];
              setCheckedMenuKeys(newKeys.map((k: any) => String(k)));
            }}
            checkStrictly={!nodeChecked}
            defaultExpandAll
            style={{ maxHeight: 300, overflowY: 'auto' }}
          />
        </Form>
      </Modal>

      <Modal
        title={`租户诊断 - ${diagnosingTenantId}`}
        open={diagnoseModalVisible}
        onCancel={() => setDiagnoseModalVisible(false)}
        width={700}
        footer={
          diagnoseData ? [
            <Button key="close" onClick={() => setDiagnoseModalVisible(false)}>
              关闭
            </Button>,
            <Button key="fix" type="primary" icon={<ToolOutlined />} onClick={handleAutoFix}>
              一键修复
            </Button>,
          ] : [
            <Button key="close" onClick={() => setDiagnoseModalVisible(false)}>
              关闭
            </Button>,
          ]
        }
      >
        <div style={{ padding: '8px 0' }}>
          {!diagnoseData ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin description="正在诊断..." />
            </div>
          ) : (
            <div>
              {diagnoseData.tenant && (
                <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
                  <strong>租户:</strong> {diagnoseData.tenant.tenantName} (ID: {diagnoseData.tenantId})
                  {diagnoseData.tenant.packageId && (
                    <span style={{ marginLeft: 16 }}>产品包ID: {diagnoseData.tenant.packageId}</span>
                  )}
                </div>
              )}

              {(diagnoseData.issues || []).length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 'bold', color: '#ff4d4f', marginBottom: 4 }}>发现问题：</div>
                  {(diagnoseData.issues || []).map((issue: string, i: number) => (
                    <div key={i} style={{ lineHeight: '22px', fontSize: 13, color: '#ff4d4f' }}>{issue}</div>
                  ))}
                </div>
              )}

              {(diagnoseData.warnings || []).length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 'bold', color: '#fa8c16', marginBottom: 4 }}>警告信息：</div>
                  {(diagnoseData.warnings || []).map((w: string, i: number) => (
                    <div key={i} style={{ lineHeight: '22px', fontSize: 13, color: '#fa8c16' }}>{w}</div>
                  ))}
                </div>
              )}

              {diagnoseData.roles && diagnoseData.roles.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>角色权限（共{diagnoseData.roleCount}个）：</div>
                  {(diagnoseData.roles || []).map((role: any, i: number) => (
                    <div key={i} style={{
                      lineHeight: '20px',
                      fontSize: 12,
                      color: role.issue ? '#ff4d4f' : role.warning ? '#fa8c16' : '#52c41a',
                      paddingLeft: 8,
                    }}>
                      • {role.roleName}({role.roleAlias}): {role.menuCount || 0} 个菜单
                      {role.issue ? ` — ${role.issue}` : ''}
                    </div>
                  ))}
                </div>
              )}

              {diagnoseData.users && diagnoseData.users.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>用户状态（共{diagnoseData.userCount}个）：</div>
                  {(diagnoseData.users || []).map((user: any, i: number) => (
                    <div key={i} style={{
                      lineHeight: '20px',
                      fontSize: 12,
                      color: user.issue ? '#ff4d4f' : '#52c41a',
                      paddingLeft: 8,
                    }}>
                      • {user.name || user.account}: roleId={user.roleId || '(空)'}
                      {user.assignedMenuCount != null ? ` → ${user.assignedMenuCount}个菜单` : ''}
                      {user.issue ? ` ⚠ ${user.issue}` : user.assignedMenuCount != null ? ' ✅' : ''}
                    </div>
                  ))}
                </div>
              )}

              <div style={{
                marginTop: 12,
                padding: '8px 12px',
                borderRadius: 4,
                background: diagnoseData.hasError ? '#fff2f0' : '#f6ffed',
                border: `1px solid ${diagnoseData.hasError ? '#ffccc7' : '#b7eb8f'}`,
              }}>
                <strong style={{ color: diagnoseData.hasError ? '#ff4d4f' : '#52c41a' }}>
                  {diagnoseData.conclusion}
                </strong>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </PageContainer>
  );
};

export default TenantPage;
