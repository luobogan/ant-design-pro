import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  message,
  Radio,
  Select,
  Space,
  Tag,
} from 'antd';
import React, { useMemo, useState } from 'react';
import * as dataScopeApi from '@/services/authority/dataPermission';
import * as roleApi from '@/services/authority/role';
import * as menuApi from '@/services/system/menu';
import PermissionConfig from './components/PermissionConfig';

interface Role {
  id: string;
  roleName: string;
  tenantName: string;
  roleAlias: string;
  sort: number;
  parentId: string;
  parentName: string;
  remark: string;
  createTime: string;
}

const RolePage: React.FC = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [viewModalVisible, setViewModalVisible] = useState<boolean>(false);
  const [permissionModalVisible, setPermissionModalVisible] =
    useState<boolean>(false);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [form] = Form.useForm();

  // 权限配置相关状态
  const [permissionLoading, setPermissionLoading] = useState<boolean>(false);
  const [rolePermissions, setRolePermissions] = useState<{
    menuIds: React.Key[];
    dataScopeIds: React.Key[];
    apiIds: React.Key[];
  }>({ menuIds: [], dataScopeIds: [], apiIds: [] });

  // 获取角色列表
  const { data: roleData, loading, refresh } = useRequest(roleApi.list);

  // 获取角色树（用于上级角色选择）
  const { data: roleTreeData } = useRequest(roleApi.tree);

  // 获取菜单树（用于权限配置）
  const {
    data: menuTreeData,
    loading: menuTreeLoading,
    runAsync: refreshMenuTree,
  } = useRequest(menuApi.grantTree, {
    onSuccess: (data) => {
      console.log('Menu tree data received:', data);
      console.log('Menu data structure:', data?.data?.menu);
    },
    onError: (error) => {
      console.error('Failed to get menu tree:', error);
      message.error('获取菜单树失败');
    },
  });

  // 获取数据权限列表（用于权限配置）
  const { data: dataScopeListData } = useRequest(() => dataScopeApi.list({}), {
    onSuccess: (data) => {
      console.log('Data scope list received:', data);
    },
  });

  // 转换角色数据
  const roles = useMemo(() => {
    const records = Array.isArray(roleData)
      ? roleData
      : roleData?.records || [];
    return records.map((role: any) => ({
      ...role,
      roleName: role.roleName || role.name || '',
      roleAlias: role.roleAlias || role.alias || '',
      tenantName: role.tenantName || '管理组',
      parentName: role.parentName || '无',
    }));
  }, [roleData]);

  // 构建角色树选项
  const roleOptions = useMemo(() => {
    const buildOptions = (data: any[]): any[] => {
      if (!Array.isArray(data)) return [];
      return data.map((item) => ({
        value: item.id,
        label: item.title || item.name,
        children: item.children ? buildOptions(item.children) : undefined,
      }));
    };
    const treeData = Array.isArray(roleTreeData)
      ? roleTreeData
      : roleTreeData?.data || [];
    return buildOptions(treeData);
  }, [roleTreeData]);

  // 转换菜单树数据（兼容多种返回结构）
  const menuTree = useMemo(() => {
    const raw: any = menuTreeData;
    const data = Array.isArray(raw)
      ? raw
      : (raw?.data?.menu ?? // 常见结构：{ success, data: { menu: [...] } }
        raw?.menu ?? // 兜底结构：{ menu: [...] }
        []);
    console.log('Menu tree data before processing:', data);
    return data;
  }, [menuTreeData]);

  // 数据权限树：从后端 data-scope/list 接口获取
  const dataScopeTree = useMemo(() => {
    const raw = dataScopeListData as any;
    console.log('Raw dataScopeListData:', raw);

    // 尝试多种可能的数据路径
    let data = [];
    if (raw?.data?.records) {
      data = raw.data.records;
    } else if (raw?.data?.data) {
      data = raw.data.data;
    } else if (raw?.records) {
      data = raw.records;
    } else if (raw?.data) {
      data = raw.data;
    } else if (Array.isArray(raw)) {
      data = raw;
    }

    console.log('Data scope tree data extracted:', data);
    return data;
  }, [dataScopeListData]);

  // 接口权限树：从后端 grant-tree 接口获取
  const apiTree = useMemo(() => {
    const raw = menuTreeData as any;
    // 尝试多种可能的数据路径
    const data =
      raw?.data?.apiScope || // 标准路径
      raw?.data?.api || // 备选路径
      raw?.apiScope || // 备选路径
      raw?.api || // 备选路径
      [];
    console.log('API scope tree data extracted:', data);
    return data;
  }, [menuTreeData]);

  // 打开权限配置弹窗（对齐 Sword 行为）
  const handleOpenPermission = async (role: Role) => {
    setCurrentRole(role);
    setPermissionLoading(true);
    try {
      console.log('Opening permission config for role:', role);
      // 获取角色已有的权限配置
      const permissionResp = await menuApi.roleTreeKeys({ roleIds: role.id });
      console.log('Permission data received:', permissionResp);

      // R<CheckedTreeVO> 兼容：优先从 resp.data 取，再兜底 resp 本身
      const checkedTree =
        (permissionResp && (permissionResp as any).data) ||
        permissionResp ||
        {};
      const menuIds = checkedTree.menu || [];
      const dataScopeIds = checkedTree.dataScope || [];
      const apiIds = checkedTree.apiScope || [];

      console.log('Extracted permissions:', { menuIds, dataScopeIds, apiIds });

      setRolePermissions({
        menuIds,
        dataScopeIds,
        apiIds,
      });
    } catch (error) {
      console.error('Error getting permission config:', error);
      message.error('获取权限配置失败');
      setRolePermissions({ menuIds: [], dataScopeIds: [], apiIds: [] });
    } finally {
      setPermissionLoading(false);
      setPermissionModalVisible(true);
    }
  };

  // 保存权限配置（对齐后端 GrantVO：dataScopeIds / apiScopeIds）
  const handleSavePermission = async (permissions: {
    menuIds: React.Key[];
    dataScopeIds: React.Key[];
    apiIds: React.Key[];
  }) => {
    if (!currentRole) return;
    try {
      await roleApi.grant({
        roleIds: [currentRole.id],
        menuIds: permissions.menuIds,
        dataScopeIds: permissions.dataScopeIds,
        apiScopeIds: permissions.apiIds,
      });
      message.success('权限配置成功');
      setPermissionModalVisible(false);
    } catch (_error) {
      message.error('权限配置失败');
    }
  };

  const columns: ProColumns<Role>[] = [
    {
      title: '角色名称',
      dataIndex: 'roleName',
      key: 'roleName',
      search: true,
      width: 150,
    },
    {
      title: '所属租户',
      dataIndex: 'tenantName',
      key: 'tenantName',
      width: 120,
      render: (tenantName) => <Tag color="blue">{tenantName}</Tag>,
    },
    {
      title: '角色别名',
      dataIndex: 'roleAlias',
      key: 'roleAlias',
      width: 150,
    },
    {
      title: '角色排序',
      dataIndex: 'sort',
      key: 'sort',
      width: 100,
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      render: (_: any, record: Role) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => {
              setCurrentRole(record);
              setViewModalVisible(true);
            }}
          >
            查看
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              setCurrentRole(record);
              setEditModalVisible(true);
            }}
          >
            编辑
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete([record.id])}
          >
            删除
          </Button>
          <Button
            type="link"
            icon={<SettingOutlined />}
            onClick={() => handleOpenPermission(record)}
          >
            权限设置
          </Button>
        </Space>
      ),
    },
  ];

  const handleDelete = (ids: React.Key[]) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${ids.length} 个角色吗？`,
      onOk: async () => {
        try {
          await roleApi.remove({ ids });
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
      message.warning('请选择要删除的角色');
      return;
    }
    handleDelete(selectedRowKeys);
  };

  // 编辑表单提交
  const handleEditSubmit = async (values: any) => {
    try {
      await roleApi.submit({
        ...values,
        id: currentRole?.id,
      });
      message.success('编辑成功');
      setEditModalVisible(false);
      refresh();
    } catch (_error) {
      message.error('编辑失败');
    }
  };

  // 新增表单提交
  const handleAddSubmit = async (values: any) => {
    try {
      await roleApi.submit(values);
      message.success('新增成功');
      setAddModalVisible(false);
      form.resetFields();
      refresh();
    } catch (_error) {
      message.error('新增失败');
    }
  };

  // 编辑弹窗打开时设置表单值
  React.useEffect(() => {
    if (editModalVisible && currentRole) {
      form.setFieldsValue({
        roleName: currentRole.roleName,
        roleAlias: currentRole.roleAlias,
        sort: currentRole.sort,
        parentId: currentRole.parentId,
        remark: currentRole.remark,
      });
    }
  }, [editModalVisible, currentRole, form]);

  return (
    <PageContainer
      title="角色管理"
      subTitle="管理系统角色，包括添加、编辑、删除角色和权限配置等操作"
    >
      <ProTable
        columns={columns}
        dataSource={roles}
        loading={loading}
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
            onClick={() => setAddModalVisible(true)}
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
          <Button
            key="permission"
            icon={<SettingOutlined />}
            onClick={() => {
              if (selectedRowKeys.length === 0) {
                message.warning('请先选择一个角色');
                return;
              }
              if (selectedRowKeys.length > 1) {
                message.warning('一次只能为一个角色配置权限');
                return;
              }
              const role = roles.find((r) => r.id === selectedRowKeys[0]);
              if (!role) {
                message.error('未找到选中的角色');
                return;
              }
              handleOpenPermission(role);
            }}
            disabled={roles.length === 0}
          >
            权限设置
          </Button>,
        ]}
        search={{
          labelWidth: 'auto',
        }}
      />

      {/* 新增角色弹窗 */}
      <Modal
        title="新增角色"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddSubmit}
          style={{ padding: '24px' }}
        >
          <Form.Item name="parentId" label="上级角色">
            <Select
              placeholder="请选择上级角色"
              options={roleOptions}
              allowClear
            />
          </Form.Item>
          <Form.Item
            name="roleName"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input placeholder="请输入角色名称" />
          </Form.Item>
          <Form.Item
            name="roleAlias"
            label="角色别名"
            rules={[{ required: true, message: '请输入角色别名' }]}
          >
            <Input placeholder="请输入角色别名" />
          </Form.Item>
          <Form.Item label="现有别名">
            <Radio.Group defaultValue="boss">
              <Radio value="boss">boss (老板)</Radio>
              <Radio value="manager">manager (经理)</Radio>
              <Radio value="hr">hr (人事)</Radio>
              <Radio value="user">user (用户)</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            name="sort"
            label="角色排序"
            rules={[{ required: true, message: '请输入角色排序' }]}
          >
            <InputNumber
              min={1}
              style={{ width: '100%' }}
              placeholder="请输入角色排序"
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ marginRight: 8 }}>
              确定
            </Button>
            <Button onClick={() => setAddModalVisible(false)}>取消</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑角色弹窗 */}
      <Modal
        title="编辑角色"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleEditSubmit}
          style={{ padding: '24px' }}
        >
          <Form.Item name="parentId" label="上级角色">
            <Select
              placeholder="请选择上级角色"
              options={roleOptions}
              allowClear
            />
          </Form.Item>
          <Form.Item
            name="roleName"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input placeholder="请输入角色名称" />
          </Form.Item>
          <Form.Item
            name="roleAlias"
            label="角色别名"
            rules={[{ required: true, message: '请输入角色别名' }]}
          >
            <Input placeholder="请输入角色别名" />
          </Form.Item>
          <Form.Item label="现有别名">
            <Radio.Group defaultValue="boss">
              <Radio value="boss" style={{ color: '#1890ff' }}>
                boss (老板)
              </Radio>
              <Radio value="manager">manager (经理)</Radio>
              <Radio value="hr">hr (人事)</Radio>
              <Radio value="user">user (用户)</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            name="sort"
            label="角色排序"
            rules={[{ required: true, message: '请输入角色排序' }]}
          >
            <InputNumber
              min={1}
              style={{ width: '100%' }}
              placeholder="请输入角色排序"
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<EditOutlined />}
              style={{ marginRight: 8 }}
            >
              修改
            </Button>
            <Button onClick={() => setEditModalVisible(false)}>取消</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 查看角色弹窗 */}
      <Modal
        title="查看角色"
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
          <p>
            <strong>角色名称:</strong> {currentRole?.roleName}
          </p>
          <p>
            <strong>角色别名:</strong> {currentRole?.roleAlias}
          </p>
          <p>
            <strong>所属租户:</strong> {currentRole?.tenantName}
          </p>
          <p>
            <strong>角色排序:</strong> {currentRole?.sort}
          </p>
          <p>
            <strong>上级角色:</strong> {currentRole?.parentName}
          </p>
        </div>
      </Modal>

      {/* 权限配置弹窗 */}
      <PermissionConfig
        visible={permissionModalVisible}
        roleId={currentRole?.id}
        roleName={currentRole?.roleName}
        menuTreeData={menuTree}
        dataScopeTreeData={dataScopeTree}
        apiTreeData={apiTree}
        initialMenuKeys={rolePermissions.menuIds}
        initialDataScopeKeys={rolePermissions.dataScopeIds}
        initialApiKeys={rolePermissions.apiIds}
        onCancel={() => setPermissionModalVisible(false)}
        onSave={handleSavePermission}
        loading={permissionLoading || menuTreeLoading}
      />
    </PageContainer>
  );
};

export default RolePage;
