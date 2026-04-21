import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable, ProForm, ProFormSelect, ProFormText } from '@ant-design/pro-components';
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
import React, { useMemo, useState } from 'react';
import * as topMenuApi from '@/services/system/topMenu';
import * as menuApi from '@/services/system/menu';
import * as tenantApi from '@/services/system/tenant';
import { useModel } from '@umijs/max';

const { Option } = Select;
const { TextArea } = Input;

interface TopMenu {
  id: string;
  topMenuName: string;
  topMenuCode: string;
  topMenuIcon: string;
  sort: number;
  status: number;
  createTime: string;
  tenantId: string;
}

interface Menu {
  id: string;
  name: string;
  code: string;
  parentId: string;
  sort: number;
  children?: Menu[];
}

interface Tenant {
  id: string;
  tenantId: string;
  tenantName: string;
  children?: Tenant[];
}

const TopMenuPage: React.FC = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [viewModalVisible, setViewModalVisible] = useState<boolean>(false);
  const [grantModalVisible, setGrantModalVisible] = useState<boolean>(false);
  const [currentTopMenu, setCurrentTopMenu] = useState<TopMenu | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('000000');
  const [tenantTree, setTenantTree] = useState<any[]>([]);
  const [selectedMenuKeys, setSelectedMenuKeys] = useState<string[]>([]);
  const [form] = Form.useForm();

  // 获取全局状态
  const { initialState } = useModel('@@initialState');

  // 获取当前租户ID
  const getCurrentTenantId = (): string => {
    if (!initialState || !initialState.currentUser) {
      return '000000';
    }
    const tenantId = initialState.currentUser.tenantId;
    return tenantId || '000000';
  };

  const currentTenantId = getCurrentTenantId();
  const isSuperAdmin = currentTenantId === '000000';

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

  // 获取顶部菜单列表
  const {
    data: topMenuData,
    loading: topMenuLoading,
    refresh: refreshTopMenu,
  } = useRequest(() => {
    return topMenuApi.list({ tenantId: selectedTenantId });
  }, {
    refreshDeps: [selectedTenantId],
  });

  // 获取菜单树用于授权
  const {
    data: menuTreeData,
    loading: menuTreeLoading,
    run: fetchMenuTree,
  } = useRequest(() => {
    return menuApi.grantTree({ tenantId: selectedTenantId });
  }, {
    refreshDeps: [selectedTenantId],
  });

  // 转换顶部菜单数据
  const topMenus = useMemo(() => {
    const records = Array.isArray(topMenuData) ? topMenuData : topMenuData?.data || [];
    return records.map((item) => ({
      ...item,
      statusName: item.status === 1 ? '启用' : '禁用',
      statusTag: item.status === 1 ? 'success' : 'default',
    }));
  }, [topMenuData]);

  // 转换菜单树数据
  const menuTree = useMemo(() => {
    const transformMenu = (menu: any): any => ({
      title: menu.name,
      value: menu.id,
      key: menu.id,
      children: menu.children?.map(transformMenu),
    });
    const data = Array.isArray(menuTreeData) ? menuTreeData : menuTreeData?.data || [];
    return data.map(transformMenu);
  }, [menuTreeData]);

  // 顶部菜单列配置
  const columns: ProColumns<TopMenu>[] = [
    {
      title: '顶部菜单名称',
      dataIndex: 'topMenuName',
      width: 180,
    },
    {
      title: '顶部菜单编码',
      dataIndex: 'topMenuCode',
      width: 180,
    },
    {
      title: '顶部菜单图标',
      dataIndex: 'topMenuIcon',
      width: 120,
    },
    {
      title: '排序',
      dataIndex: 'sort',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'statusName',
      width: 80,
      render: (_, record) => (
        <Tag color={record.statusTag}>
          {record.statusName}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      width: 180,
      valueType: 'date',
    },
    {
      title: '操作',
      width: 200,
      valueType: 'option',
      render: (_, record) => [
        <Button
          key="view"
          type="text"
          icon={<EyeOutlined />}
          onClick={() => handleView(record)}
        >
          查看
        </Button>,
        <Button
          key="edit"
          type="text"
          icon={<EditOutlined />}
          onClick={() => handleEdit(record)}
        >
          编辑
        </Button>,
        <Button
          key="grant"
          type="text"
          icon={<SettingOutlined />}
          onClick={() => handleGrant(record)}
        >
          授权
        </Button>,
        <Button
          key="delete"
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDelete(record.id)}
        >
          删除
        </Button>,
      ],
    },
  ];

  // 处理添加顶部菜单
  const handleAdd = () => {
    form.resetFields();
    setCurrentTopMenu(null);
    form.setFieldsValue({
      tenantId: selectedTenantId,
      status: 1,
      sort: 1,
    });
    setAddModalVisible(true);
  };

  // 处理编辑顶部菜单
  const handleEdit = (record: TopMenu) => {
    setCurrentTopMenu(record);
    form.setFieldsValue({
      ...record,
    });
    setEditModalVisible(true);
  };

  // 处理查看顶部菜单
  const handleView = (record: TopMenu) => {
    setCurrentTopMenu(record);
    setViewModalVisible(true);
  };

  // 处理授权顶部菜单
  const handleGrant = (record: TopMenu) => {
    setCurrentTopMenu(record);
    // 先获取菜单树
    fetchMenuTree();
    // 清空选中的菜单
    setSelectedMenuKeys([]);
    setGrantModalVisible(true);
  };

  // 处理删除顶部菜单
  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '删除确认',
      content: '确定要删除此顶部菜单吗？',
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await topMenuApi.remove({ ids: id });
          message.success('删除成功');
          refreshTopMenu();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  // 处理批量删除
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的顶部菜单');
      return;
    }
    Modal.confirm({
      title: '批量删除确认',
      content: `确定要删除选中的 ${selectedRowKeys.length} 个顶部菜单吗？`,
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await topMenuApi.remove({ ids: selectedRowKeys.join(',') });
          message.success('删除成功');
          setSelectedRowKeys([]);
          refreshTopMenu();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  // 处理添加保存
  const handleAddOk = async () => {
    try {
      const values = await form.validateFields();
      await topMenuApi.submit(values);
      message.success('添加成功');
      setAddModalVisible(false);
      refreshTopMenu();
    } catch (error) {
      message.error('添加失败');
    }
  };

  // 处理编辑保存
  const handleEditOk = async () => {
    try {
      const values = await form.validateFields();
      await topMenuApi.submit(values);
      message.success('编辑成功');
      setEditModalVisible(false);
      refreshTopMenu();
    } catch (error) {
      message.error('编辑失败');
    }
  };

  // 处理授权保存
  const handleGrantOk = async () => {
    try {
      if (!currentTopMenu) return;
      await topMenuApi.grant({
        topMenuIds: [currentTopMenu.id],
        menuIds: selectedMenuKeys,
      });
      message.success('授权成功');
      setGrantModalVisible(false);
    } catch (error) {
      message.error('授权失败');
    }
  };

  return (
    <PageContainer title="顶部菜单管理" subTitle="管理系统顶部菜单，包括添加、编辑、删除顶部菜单等操作">
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card title="租户选择" variant="outlined" style={{ height: 'calc(100vh - 200px)' }}>
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
          <ProTable
            columns={columns}
            dataSource={topMenus}
            loading={topMenuLoading}
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
              selectedRowKeys.length > 0 && (
                <Button
                  key="delete"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleBatchDelete}
                >
                  批量删除
                </Button>
              ),
              <Button key="refresh" onClick={refreshTopMenu}>
                刷新
              </Button>,
            ]}
          />
        </Col>
      </Row>

      {/* 新增/编辑顶部菜单弹窗 */}
      <Modal
        title={editModalVisible ? '编辑顶部菜单' : '新增顶部菜单'}
        open={addModalVisible || editModalVisible}
        onCancel={() => {
          setAddModalVisible(false);
          setEditModalVisible(false);
        }}
        onOk={editModalVisible ? handleEditOk : handleAddOk}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ padding: '24px' }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="topMenuName"
                label="顶部菜单名称"
                rules={[{ required: true, message: '请输入顶部菜单名称' }]}
              >
                <Input placeholder="请输入顶部菜单名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="topMenuCode"
                label="顶部菜单编码"
                rules={[{ required: true, message: '请输入顶部菜单编码' }]}
              >
                <Input placeholder="请输入顶部菜单编码" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="topMenuIcon"
                label="顶部菜单图标"
                rules={[{ required: true, message: '请输入顶部菜单图标' }]}
              >
                <Input placeholder="请输入顶部菜单图标" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="sort"
                label="排序"
                rules={[{ required: true, message: '请输入排序' }]}
              >
                <Input type="number" placeholder="请输入排序" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="status"
                label="状态"
                rules={[{ required: true, message: '请选择状态' }]}
              >
                <Select placeholder="请选择状态">
                  <Option value={1}>启用</Option>
                  <Option value={0}>禁用</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="tenantId"
                label="租户ID"
                rules={[{ required: true, message: '请选择租户' }]}
              >
                <Input disabled />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 查看顶部菜单弹窗 */}
      <Modal
        title="查看顶部菜单"
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setViewModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        {currentTopMenu && (
          <div style={{ padding: '24px' }}>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <div>
                  <strong>顶部菜单名称：</strong>
                  {currentTopMenu.topMenuName}
                </div>
              </Col>
              <Col span={12}>
                <div>
                  <strong>顶部菜单编码：</strong>
                  {currentTopMenu.topMenuCode}
                </div>
              </Col>
            </Row>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <div>
                  <strong>顶部菜单图标：</strong>
                  {currentTopMenu.topMenuIcon}
                </div>
              </Col>
              <Col span={12}>
                <div>
                  <strong>排序：</strong>
                  {currentTopMenu.sort}
                </div>
              </Col>
            </Row>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <div>
                  <strong>状态：</strong>
                  {currentTopMenu.status === 1 ? '启用' : '禁用'}
                </div>
              </Col>
              <Col span={12}>
                <div>
                  <strong>租户ID：</strong>
                  {currentTopMenu.tenantId}
                </div>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={24}>
                <div>
                  <strong>创建时间：</strong>
                  {currentTopMenu.createTime}
                </div>
              </Col>
            </Row>
          </div>
        )}
      </Modal>

      {/* 顶部菜单授权弹窗 */}
      <Modal
        title={`为顶部菜单 "${currentTopMenu?.topMenuName || ''}" 授权菜单`}
        open={grantModalVisible}
        onCancel={() => setGrantModalVisible(false)}
        onOk={handleGrantOk}
        width={800}
        destroyOnClose
      >
        <div style={{ padding: '24px' }}>
          <div style={{ marginBottom: 16 }}>
            <strong>选择要关联的菜单：</strong>
          </div>
          <Tree
            checkable
            treeData={menuTree}
            checkedKeys={selectedMenuKeys}
            onCheck={(checkedKeys) => {
              setSelectedMenuKeys(checkedKeys.checked || []);
            }}
            style={{ maxHeight: '400px', overflow: 'auto' }}
          />
        </div>
      </Modal>
    </PageContainer>
  );
};

export default TopMenuPage;