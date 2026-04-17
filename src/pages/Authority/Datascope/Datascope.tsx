import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SettingOutlined,
  UserOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  message,
  Row,
  Select,
  Space,
  Tag,
  Tree,
} from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import * as dataPermissionApi from '@/services/authority/dataPermission';
import * as menuApi from '@/services/system/menu';
import * as tenantApi from '@/services/system/tenant';
import { useModel } from '@umijs/max';

const { Option } = Select;
const { TextArea } = Input;

interface Menu {
  id: string;
  name: string;
  path: string;
  alias: string;
  code: string;
  sort: number;
  icon?: string;
  hasDataPermission?: boolean;
}

interface DataPermission {
  id: string;
  scopeName: string;
  resourceCode: string;
  scopeColumn: string;
  scopeType: string;
  scopeTypeName?: string;
  scopeClass: string;
  visibleField: string;
  remark: string;
  createTime: string;
  tenantId: string;
}

interface Tenant {
  id: string;
  tenantId: string;
  tenantName: string;
  children?: Tenant[];
}

const DataPermissionPage: React.FC = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [configModalVisible, setConfigModalVisible] = useState<boolean>(false);
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [viewModalVisible, setViewModalVisible] = useState<boolean>(false);
  const [currentMenu, setCurrentMenu] = useState<Menu | null>(null);
  const [currentDataPermission, setCurrentDataPermission] =
    useState<DataPermission | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('000000');
  const [tenantTree, setTenantTree] = useState<any[]>([]);
  const [form] = Form.useForm();

  // 获取全局状态
  const { initialState } = useModel('@@initialState');

  // 获取当前租户ID
  const getCurrentTenantId = (): string => {
    let tenantId = '000000';
    if (initialState?.user?.tenantId) {
      tenantId = initialState.user.tenantId;
    } else if (initialState?.user?.tenant_id) {
      tenantId = initialState.user.tenant_id;
    } else {
      try {
        const userInfoStr = localStorage.getItem('sword-user-info');
        if (userInfoStr) {
          const userInfo = JSON.parse(userInfoStr);
          tenantId = userInfo.tenantId || userInfo.tenant_id || '000000';
        }
      } catch (e) {
        tenantId = '000000';
      }
    }
    return tenantId;
  };

  const currentTenantId = getCurrentTenantId();
  const isSuperAdmin = currentTenantId === '000000';

  // 新增弹窗打开时预填充表单
  useEffect(() => {
    if (addModalVisible && currentMenu) {
      form.setFieldsValue({
        scopeName: `${currentMenu.name} [暂无]`,
        resourceCode: currentMenu.code,
        scopeColumn: '-',
        visibleField: '*',
        tenantId: currentTenantId,
      });
    }
  }, [addModalVisible, currentMenu, form, currentTenantId]);

  // 获取租户列表
  const {
    data: tenantData,
    loading: tenantLoading,
    refresh: refreshTenant,
  } = useRequest(tenantApi.select, {
    onSuccess: (data) => {
      const tenants = Array.isArray(data) ? data : data?.data || [];
      const tree = buildTenantTree(tenants);
      setTenantTree(tree);
    },
  });

  // 构建租户树
  const buildTenantTree = (tenants: any[]): any[] => {
    return tenants.map((tenant) => ({
      title: (
        <span>
          <TeamOutlined style={{ marginRight: 4 }} />
          {tenant.tenantName} ({tenant.tenantId})
        </span>
      ),
      value: tenant.tenantId,
      key: tenant.tenantId,
    }));
  };

  // 获取菜单列表
  const {
    data: menuData,
    loading: menuLoading,
    refresh: refreshMenu,
  } = useRequest(() => {
    return menuApi.list({ tenantId: selectedTenantId });
  }, {
    refreshDeps: [selectedTenantId],
  });

  // 转换菜单数据
  const menus = useMemo(() => {
    const records = Array.isArray(menuData)
      ? menuData
      : menuData?.records || menuData?.data || [];
    return records.map((item: any) => ({
      ...item,
      id: item.id || item.menuId,
      name: item.name || item.menuName || item.title,
      path: item.path || item.route || '-',
      alias: item.alias || item.menuAlias || '-',
      code: item.code || item.menuCode || '-',
      sort: item.sort || item.menuSort || 0,
      icon: item.icon || item.source || '',
    }));
  }, [menuData]);

  // 获取数据权限列表（根据当前选中的菜单）
  const {
    data: dataPermissionData,
    loading: dataPermissionLoading,
    refresh: refreshDataPermission,
  } = useRequest(
    () => {
      if (!currentMenu?.id) return Promise.resolve({ data: [] });
      return dataPermissionApi.list({ menuId: currentMenu.id });
    },
    {
      refreshDeps: [currentMenu?.id],
      ready: !!currentMenu?.id,
    },
  );

  // 转换数据权限数据 - 适配后端字段名
  const dataPermissions = useMemo(() => {
    const records = Array.isArray(dataPermissionData)
      ? dataPermissionData
      : dataPermissionData?.records || dataPermissionData?.data || [];
    return records.map((item: any) => ({
      ...item,
      // 适配后端字段名
      scopeName: item.scopeName || item.name || '',
      // 权限编号：优先使用 resourceCode，备选 scopeCode/code
      resourceCode: item.resourceCode || item.scopeCode || item.code || '',
      // 权限字段：优先使用 scopeColumn，备选 scopeField/field
      scopeColumn: item.scopeColumn || item.scopeField || item.field || '-',
      scopeType: item.scopeType || item.type || '',
      scopeClass: item.scopeClass || item.className || '',
      visibleField: item.visibleField || item.column || '*',
      tenantId: item.tenantId || item.tenant_id || '',
      scopeTypeName: getScopeTypeName(item.scopeType || item.type),
    }));
  }, [dataPermissionData]);

  // 获取规则类型名称
  function getScopeTypeName(type: string): string {
    const typeMap: Record<string, string> = {
      '1': '全部可见',
      '2': '本人可见',
      '3': '所在机构可见',
      '4': '所在机构及子级可见',
      '5': '自定义',
    };
    return typeMap[type] || type;
  }

  // 菜单列表列
  const menuColumns: ProColumns<Menu>[] = [
    {
      title: '#',
      dataIndex: 'index',
      key: 'index',
      width: 50,
      render: (_, __, index) => index + 1,
    },
    {
      title: '菜单名称',
      dataIndex: 'name',
      key: 'name',
      search: true,
      width: 180,
    },
    {
      title: '路由地址',
      dataIndex: 'path',
      key: 'path',
      width: 200,
    },
    {
      title: '菜单图标',
      dataIndex: 'icon',
      key: 'icon',
      width: 100,
      render: (icon) => icon || '-',
    },
    {
      title: '菜单编号',
      dataIndex: 'code',
      key: 'code',
      search: true,
      width: 150,
    },
    {
      title: '菜单别名',
      dataIndex: 'alias',
      key: 'alias',
      width: 120,
    },
    {
      title: '菜单排序',
      dataIndex: 'sort',
      key: 'sort',
      width: 100,
      sorter: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: Menu) => (
        <Button
          type="link"
          icon={<SettingOutlined />}
          onClick={() => handleConfig(record)}
        >
          权限配置
        </Button>
      ),
    },
  ];

  // 数据权限列表列
  const dataPermissionColumns: ProColumns<DataPermission>[] = [
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
      width: 120,
      render: (tenantId) => <Tag color="blue">{tenantId || '-'}</Tag>,
    },
    {
      title: '权限名称',
      dataIndex: 'scopeName',
      key: 'scopeName',
      search: true,
      width: 180,
    },
    {
      title: '权限编号',
      dataIndex: 'resourceCode',
      key: 'resourceCode',
      search: true,
      width: 150,
    },
    {
      title: '权限字段',
      dataIndex: 'scopeColumn',
      key: 'scopeColumn',
      width: 150,
    },
    {
      title: '规则类型',
      dataIndex: 'scopeTypeName',
      key: 'scopeTypeName',
      width: 150,
      render: (type) => <Tag color="blue">{type}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: DataPermission) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            disabled={!isSuperAdmin && record.tenantId !== currentTenantId}
          >
            编辑
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete([record.id])}
            disabled={!isSuperAdmin && record.tenantId !== currentTenantId}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  // 打开权限配置弹窗
  const handleConfig = (record: Menu) => {
    setCurrentMenu(record);
    setConfigModalVisible(true);
    setSelectedRowKeys([]);
  };

  const handleDelete = (ids: React.Key[]) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${ids.length} 个数据权限吗？`,
      onOk: async () => {
        try {
          // 将 React.Key[] 转换为 string[]
          const idList = ids.map((id) => String(id));
          // 尝试不同的参数格式
          await dataPermissionApi.remove({
            ids: idList,
            id: idList[0], // 单个删除时优先使用 id
          });
          message.success('删除成功');
          setSelectedRowKeys([]);
          refreshDataPermission();
        } catch (_error) {
          message.error('删除失败');
        }
      },
    });
  };

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的数据权限');
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
      // 字段映射：将前端字段名转换为后端期望的字段名
      const submitData = {
        scopeName: values.scopeName,
        resourceCode: values.resourceCode,
        scopeColumn: values.scopeColumn,
        scopeType: values.scopeType,
        scopeClass: values.scopeClass,
        visibleField: values.visibleField,
        remark: values.remark,
        menuId: currentMenu?.id,
        tenantId: values.tenantId || currentTenantId,
      };
      await dataPermissionApi.submit(submitData);
      message.success('添加成功');
      setAddModalVisible(false);
      refreshDataPermission();
    } catch (_error) {
      message.error('添加失败');
    }
  };

  const handleEditOk = async () => {
    try {
      const values = await form.validateFields();
      // 字段映射：将前端字段名转换为后端期望的字段名
      const submitData = {
        id: currentDataPermission?.id,
        scopeName: values.scopeName,
        resourceCode: values.resourceCode,
        scopeColumn: values.scopeColumn,
        scopeType: values.scopeType,
        scopeClass: values.scopeClass,
        visibleField: values.visibleField,
        remark: values.remark,
        menuId: currentMenu?.id,
        tenantId: values.tenantId || currentTenantId,
      };
      await dataPermissionApi.submit(submitData);
      message.success('编辑成功');
      setEditModalVisible(false);
      refreshDataPermission();
    } catch (_error) {
      message.error('编辑失败');
    }
  };

  const handleView = (record: DataPermission) => {
    setCurrentDataPermission(record);
    setViewModalVisible(true);
  };

  const handleEdit = (record: DataPermission) => {
    setCurrentDataPermission(record);
    // 确保 scopeType 是字符串类型，因为 Select 组件的 value 是字符串
    form.setFieldsValue({
      scopeName: record.scopeName,
      resourceCode: record.resourceCode,
      scopeColumn: record.scopeColumn,
      scopeType: record.scopeType ? String(record.scopeType) : undefined,
      scopeClass: record.scopeClass,
      visibleField: record.visibleField,
      remark: record.remark,
    });
    setEditModalVisible(true);
  };

  // 规则类型选项
  const scopeTypeOptions = [
    { label: '全部可见', value: '1' },
    { label: '本人可见', value: '2' },
    { label: '所在机构可见', value: '3' },
    { label: '所在机构及子级可见', value: '4' },
    { label: '自定义', value: '5' },
  ];

  return (
    <PageContainer title="数据权限管理" subTitle="基于菜单的数据权限配置管理">
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card title="租户选择" bordered={true} style={{ height: 'calc(100vh - 200px)' }}>
            <Tree
              showLine
              defaultExpandAll
              treeData={tenantTree}
              selectedKeys={[selectedTenantId]}
              onSelect={(keys) => {
                if (keys.length > 0) {
                  setSelectedTenantId(keys[0]);
                }
              }}
              style={{ maxHeight: 'calc(100% - 40px)', overflow: 'auto' }}
            />
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Button type="link" onClick={refreshTenant}>
                刷新租户列表
              </Button>
            </div>
          </Card>
        </Col>
        <Col span={18}>
          {/* 菜单列表 */}
          <ProTable
            columns={menuColumns}
            dataSource={menus}
            loading={menuLoading}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            search={{
              labelWidth: 'auto',
              defaultCollapsed: false,
              span: 8,
            }}
            toolBarRender={() => [
              <Button key="refresh" onClick={refreshMenu}>
                刷新
              </Button>,
            ]}
          />
        </Col>
      </Row>

      {/* 数据权限配置弹窗 */}
      <Modal
        title={
          currentMenu ? `[${currentMenu.name}] 数据权限配置` : '数据权限配置'
        }
        open={configModalVisible}
        onCancel={() => setConfigModalVisible(false)}
        footer={null}
        width={1000}
      >
        <ProTable
          columns={dataPermissionColumns}
          dataSource={dataPermissions}
          loading={dataPermissionLoading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
          toolBarRender={() => [
            <Button
              key="add"
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              新增
            </Button>,
            <Button
              key="delete"
              danger
              icon={<DeleteOutlined />}
              onClick={handleBatchDelete}
              disabled={selectedRowKeys.length === 0}
            >
              删除
            </Button>,
          ]}
          search={{
            labelWidth: 'auto',
            defaultCollapsed: false,
            span: 8,
          }}
        />
      </Modal>

      {/* 新增数据权限弹窗 */}
      <Modal
        title="新增"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        onOk={handleAddOk}
        width={700}
      >
        <Form
          form={form}
          layout="horizontal"
          style={{ padding: '24px' }}
          labelCol={{ span: 4 }}
          wrapperCol={{ span: 20 }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="scopeName"
                label="权限名称"
                rules={[{ required: true, message: '请输入权限名称' }]}
              >
                <Input placeholder="请输入权限名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="resourceCode"
                label="权限编号"
                rules={[{ required: true, message: '请输入权限编号' }]}
              >
                <Input placeholder="请输入权限编号" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="scopeColumn"
                label="权限字段"
                rules={[{ required: true, message: '请输入权限字段' }]}
              >
                <Input placeholder="请输入权限字段" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="scopeType"
                label="规则类型"
                rules={[{ required: true, message: '请选择规则类型' }]}
              >
                <Select placeholder="请选择规则类型">
                  {scopeTypeOptions.map((option) => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="tenantId"
                label="租户ID"
                rules={[{ required: true, message: '请输入租户ID' }]}
              >
                <Input
                  placeholder="请输入租户ID"
                  disabled={!isSuperAdmin}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="visibleField"
                label="可见字段"
                rules={[{ required: true, message: '请输入可见字段' }]}
              >
                <Input placeholder="请输入可见字段" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="scopeClass"
                label="权限类名"
                rules={[{ required: true, message: '请输入权限类名' }]}
              >
                <Input placeholder="请输入权限类名" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="remark"
            label="备注"
            labelCol={{ span: 4 }}
            wrapperCol={{ span: 20 }}
          >
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑数据权限弹窗 */}
      <Modal
        title="编辑"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleEditOk}
        width={700}
      >
        <Form
          form={form}
          layout="horizontal"
          style={{ padding: '24px' }}
          labelCol={{ span: 4 }}
          wrapperCol={{ span: 20 }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="scopeName"
                label="权限名称"
                rules={[{ required: true, message: '请输入权限名称' }]}
              >
                <Input placeholder="请输入权限名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="resourceCode"
                label="权限编号"
                rules={[{ required: true, message: '请输入权限编号' }]}
              >
                <Input placeholder="请输入权限编号" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="scopeColumn"
                label="权限字段"
                rules={[{ required: true, message: '请输入权限字段' }]}
              >
                <Input placeholder="请输入权限字段" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="scopeType"
                label="规则类型"
                rules={[{ required: true, message: '请选择规则类型' }]}
              >
                <Select placeholder="请选择规则类型">
                  {scopeTypeOptions.map((option) => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="visibleField"
                label="可见字段"
                rules={[{ required: true, message: '请输入可见字段' }]}
              >
                <Input placeholder="请输入可见字段" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="scopeClass"
                label="权限类名"
                rules={[{ required: true, message: '请输入权限类名' }]}
              >
                <Input placeholder="请输入权限类名" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="remark"
            label="备注"
            labelCol={{ span: 4 }}
            wrapperCol={{ span: 20 }}
          >
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 查看数据权限弹窗 */}
      <Modal
        title="查看数据权限"
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
          {currentDataPermission && (
            <div>
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={12}>
                  <p>
                    <strong>租户ID：</strong>
                    {currentDataPermission.tenantId || '-'}
                  </p>
                </Col>
                <Col span={12}>
                  <p>
                    <strong>权限名称：</strong>
                    {currentDataPermission.scopeName}
                  </p>
                </Col>
              </Row>
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={12}>
                  <p>
                    <strong>权限编号：</strong>
                    {currentDataPermission.resourceCode}
                  </p>
                </Col>
                <Col span={12}>
                  <p>
                    <strong>权限字段：</strong>
                    {currentDataPermission.scopeColumn}
                  </p>
                </Col>
              </Row>
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={12}>
                  <p>
                    <strong>规则类型：</strong>
                    {getScopeTypeName(currentDataPermission.scopeType)}
                  </p>
                </Col>
                <Col span={12}>
                  <p>
                    <strong>可见字段：</strong>
                    {currentDataPermission.visibleField}
                  </p>
                </Col>
              </Row>
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={12}>
                  <p>
                    <strong>权限类名：</strong>
                    {currentDataPermission.scopeClass}
                  </p>
                </Col>
              </Row>
              <p>
                <strong>备注：</strong>
                {currentDataPermission.remark || '-'}
              </p>
            </div>
          )}
        </div>
      </Modal>
    </PageContainer>
  );
};

export default DataPermissionPage;
