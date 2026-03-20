import {
  ApiOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  BookOutlined,
  DashboardOutlined,
  DeleteFilled,
  DeleteOutlined,
  DesktopOutlined,
  EditFilled,
  EditOutlined,
  EyeFilled,
  EyeOutlined,
  FileOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  FormOutlined,
  HomeOutlined,
  MenuOutlined,
  MonitorOutlined,
  PlusCircleOutlined,
  PlusOutlined,
  SafetyOutlined,
  SettingOutlined,
  TeamOutlined,
  ToolOutlined,
  UnorderedListOutlined,
  UserOutlined,
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
  Radio,
  Row,
  Select,
  Space,
  TreeSelect,
} from 'antd';
import React, { useMemo, useState } from 'react';
import * as menuApi from '@/services/system/menu';
import { usePageButtons } from '@/hooks/usePageButtons';
import type { ButtonConfig } from '@/components/BusinessComponents/ToolBar';

const { Option } = Select;
const { TextArea } = Input;

// 图标列表
const iconList = [
  { name: 'dashboard', component: <DashboardOutlined />, label: '仪表盘' },
  { name: 'home', component: <HomeOutlined />, label: '首页' },
  { name: 'setting', component: <SettingOutlined />, label: '设置' },
  { name: 'user', component: <UserOutlined />, label: '用户' },
  { name: 'team', component: <TeamOutlined />, label: '团队' },
  { name: 'book', component: <BookOutlined />, label: '书籍' },
  { name: 'desktop', component: <DesktopOutlined />, label: '桌面' },
  { name: 'form', component: <FormOutlined />, label: '表单' },
  { name: 'api', component: <ApiOutlined />, label: 'API' },
  { name: 'list', component: <UnorderedListOutlined />, label: '列表' },
  { name: 'appstore', component: <AppstoreOutlined />, label: '应用' },
  { name: 'file-text', component: <FileTextOutlined />, label: '文档' },
  { name: 'delete', component: <DeleteFilled />, label: '删除' },
  { name: 'eye', component: <EyeFilled />, label: '查看' },
  { name: 'edit', component: <EditFilled />, label: '编辑' },
  { name: 'plus', component: <PlusCircleOutlined />, label: '添加' },
  { name: 'menu', component: <MenuOutlined />, label: '菜单' },
  { name: 'safety', component: <SafetyOutlined />, label: '安全' },
  { name: 'tool', component: <ToolOutlined />, label: '工具' },
  { name: 'monitor', component: <MonitorOutlined />, label: '监控' },
  { name: 'bar-chart', component: <BarChartOutlined />, label: '图表' },
  { name: 'file', component: <FileOutlined />, label: '文件' },
  { name: 'folder', component: <FolderOutlined />, label: '文件夹' },
  {
    name: 'folder-open',
    component: <FolderOpenOutlined />,
    label: '打开文件夹',
  },
];

// 图标映射函数
const getIconByString = (iconStr: string): React.ReactNode => {
  if (!iconStr) return null;
  const icon = iconList.find((item) => item.name === iconStr);
  return icon ? icon.component : <span>{iconStr}</span>;
};

interface MenuItem {
  id: string;
  name: string;
  code: string;
  alias: string;
  path: string;
  parentId: string;
  parentName: string;
  sort: number;
  source: string;
  category: number;
  isOpen: number;
  remark: string;
  createTime: string;
  children?: MenuItem[];
}

const MenuPage: React.FC = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [viewModalVisible, setViewModalVisible] = useState<boolean>(false);
  const [currentMenu, setCurrentMenu] = useState<MenuItem | null>(null);
  const [selectedIcon, setSelectedIcon] = useState<string>('');
  const [form] = Form.useForm();

  // 获取页面按钮权限（自动从路由提取菜单 code）
  const { buttons } = usePageButtons();

  // 获取菜单数据
  const { data, loading, refresh } = useRequest(menuApi.list);

  // 递归转换数据结构
  const transformMenuData = (menuList: any[]): any[] => {
    return menuList.map((menu: any) => {
      const transformed = {
        ...menu,
        parentName:
          menu.parentId === 0 || menu.parentId === '0'
            ? '无'
            : menu.parentName || '未知',
        sort:
          typeof menu.sort === 'string' ? parseInt(menu.sort, 10) : menu.sort,
      };
      if (menu.children && menu.children.length > 0) {
        transformed.children = transformMenuData(menu.children);
      }
      return transformed;
    });
  };

  const menus = React.useMemo(() => {
    console.log('Menu data from API:', data);
    const menuData = Array.isArray(data) ? data : [];
    console.log('Processing menu data:', menuData);
    const transformedData = transformMenuData(menuData);
    console.log('Transformed menu data:', transformedData);
    return transformedData;
  }, [data]);

  // 构建上级菜单选项（树形结构）
  const parentMenuOptions = useMemo(() => {
    const buildTree = (list: any[]): any[] => {
      return list.map((item) => ({
        title: item.name,
        value: item.id,
        key: item.id,
        children: item.children ? buildTree(item.children) : undefined,
      }));
    };
    return [
      { title: '顶级菜单', value: '0', key: '0' },
      ...buildTree(menus),
    ];
  }, [menus]);

  const columns: ProColumns<MenuItem>[] = [
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
      search: true,
      width: 200,
    },
    {
      title: '菜单图标',
      dataIndex: 'source',
      key: 'source',
      width: 100,
      align: 'center',
      render: (icon) => getIconByString(icon || ''),
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
      align: 'center',
    },

    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: MenuItem) => (
        <Space>
          {buttons.some(btn => btn.code === 'menu_view') && (
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            >
              查看
            </Button>
          )}
          {buttons.some(btn => btn.code === 'menu_edit') && (
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
          )}
          {buttons.some(btn => btn.code === 'menu_delete') && (
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete([record.id])}
            >
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const handleDelete = (ids: React.Key[]) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${ids.length} 个菜单吗？`,
      onOk: async () => {
        try {
          await menuApi.remove({ ids });
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
      message.warning('请选择要删除的菜单');
      return;
    }
    handleDelete(selectedRowKeys);
  };

  const handleAdd = () => {
    form.resetFields();
    setSelectedIcon('');
    setCurrentMenu(null);
    setAddModalVisible(true);
  };

  const _handleAddChild = (record: MenuItem) => {
    form.resetFields();
    setSelectedIcon('');
    setCurrentMenu(record);
    form.setFieldsValue({ parentId: record.id });
    setAddModalVisible(true);
  };

  const handleAddOk = async () => {
    try {
      const values = await form.validateFields();
      // 确保 category 和 isOpen 是数字类型
      const submitData = {
        ...values,
        source: selectedIcon,
        category: Number(values.category),
        isOpen: Number(values.isOpen),
      };
      console.log('新增提交数据:', submitData);
      await menuApi.submit(submitData);
      message.success('添加成功');
      setAddModalVisible(false);
      refresh();
    } catch (_error) {
      message.error('添加失败');
    }
  };

  const handleEdit = (record: MenuItem) => {
    setCurrentMenu(record);
    setSelectedIcon(record.source || '');
    form.setFieldsValue({
      id: record.id,
      parentId: record.parentId,
      name: record.name,
      code: record.code,
      alias: record.alias,
      path: record.path,
      sort: record.sort,
      // 确保 category 是数字类型
      category: typeof record.category === 'string' 
        ? parseInt(record.category, 10) 
        : record.category,
      // 确保 isOpen 是数字类型
      isOpen: typeof record.isOpen === 'string' 
        ? parseInt(record.isOpen, 10) 
        : record.isOpen,
      remark: record.remark,
    });
    setEditModalVisible(true);
  };

  const handleEditOk = async () => {
    try {
      const values = await form.validateFields();
      // 确保 source 是字符串
      const iconValue = typeof selectedIcon === 'string' ? selectedIcon : '';
      
      // 确保 category 和 isOpen 是数字类型
      const submitData = {
        ...values,
        source: iconValue,
        id: currentMenu?.id,
        category: Number(values.category),
        isOpen: Number(values.isOpen),
      };
      
      console.log('提交数据:', submitData);
      
      await menuApi.submit(submitData);
      message.success('编辑成功');
      setEditModalVisible(false);
      refresh();
    } catch (error) {
      console.error('编辑菜单失败:', error);
      message.error('编辑失败');
    }
  };

  const handleView = (record: MenuItem) => {
    setCurrentMenu(record);
    setViewModalVisible(true);
  };

  // 图标选择组件
  const IconSelector = ({
    value,
    onChange,
  }: {
    value?: string;
    onChange?: (val: string) => void;
  }) => {
    return (
      <Card
        size="small"
        title="选择图标"
        style={{ maxHeight: '200px', overflow: 'auto' }}
      >
        <Radio.Group
          value={value}
          onChange={(e) => {
            onChange?.(e.target.value);
            setSelectedIcon(e.target.value);
          }}
        >
          <Space wrap>
            {iconList.map((icon) => (
              <Radio.Button
                key={icon.name}
                value={icon.name}
                style={{ padding: '8px 12px' }}
              >
                <Space style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} size={0}>
                  {icon.component}
                  <span style={{ fontSize: '10px', marginTop: '4px' }}>
                    {icon.label}
                  </span>
                </Space>
              </Radio.Button>
            ))}
          </Space>
        </Radio.Group>
      </Card>
    );
  };

  return (
    <PageContainer
      title="菜单管理"
      subTitle="管理系统菜单，包括添加、编辑、删除菜单等操作"
    >
      <ProTable
        columns={columns}
        dataSource={menus}
        loading={loading}
        rowKey="id"
        pagination={false}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        toolBarRender={() => [
          buttons.some(btn => btn.code === 'menu_add') && (
            <Button
              key="add"
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              新增
            </Button>
          ),
          buttons.some(btn => btn.code === 'menu_delete') && (
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
        expandable={{
          defaultExpandAllRows: true,
          childrenColumnName: 'children',
        }}
        locale={{
          emptyText: '暂无菜单数据',
        }}
      />

      {/* 新增/编辑菜单弹窗 */}
      <Modal
        title={editModalVisible ? '编辑菜单' : '新增菜单'}
        open={addModalVisible || editModalVisible}
        onCancel={() => {
          setAddModalVisible(false);
          setEditModalVisible(false);
        }}
        onOk={editModalVisible ? handleEditOk : handleAddOk}
        width={800}
      >
        <Form form={form} layout="vertical" style={{ padding: '24px' }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="菜单名称"
                rules={[{ required: true, message: '请输入菜单名称' }]}
              >
                <Input placeholder="请输入菜单名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="path"
                label="路由地址"
                rules={[{ required: true, message: '请输入路由地址' }]}
              >
                <Input placeholder="请输入路由地址，如：/system/user" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="parentId"
                label="上级菜单"
                rules={[{ required: true, message: '请选择上级菜单' }]}
              >
                <TreeSelect
                  placeholder="请选择上级菜单"
                  treeData={parentMenuOptions}
                  treeDefaultExpandAll
                  showSearch
                  treeNodeFilterProp="title"
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="菜单图标">
                <IconSelector value={selectedIcon} onChange={setSelectedIcon} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="code"
                label="菜单编号"
                rules={[{ required: true, message: '请输入菜单编号' }]}
              >
                <Input placeholder="请输入菜单编号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="alias"
                label="菜单别名"
                rules={[{ required: true, message: '请输入菜单别名' }]}
              >
                <Input placeholder="请输入菜单别名" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="category"
                label="菜单类型"
                rules={[{ required: true, message: '请选择菜单类型' }]}
                initialValue={1}
              >
                <Radio.Group>
                  <Radio value={1}>菜单</Radio>
                  <Radio value={2}>按钮</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="isOpen"
                label="是否缓存"
                rules={[{ required: true, message: '请选择是否缓存' }]}
                initialValue={1}
              >
                <Radio.Group>
                  <Radio value={1}>是</Radio>
                  <Radio value={0}>否</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="sort"
                label="菜单排序"
                rules={[{ required: true, message: '请输入菜单排序' }]}
              >
                <Input type="number" placeholder="请输入菜单排序" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="remark" label="菜单备注">
            <TextArea rows={3} placeholder="请输入菜单备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 查看菜单弹窗 */}
      <Modal
        title="查看菜单"
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
          {currentMenu && (
            <div>
              <p>
                <strong>菜单名称：</strong>
                {currentMenu.name}
              </p>
              <p>
                <strong>路由地址：</strong>
                {currentMenu.path}
              </p>
              <p>
                <strong>菜单图标：</strong>
                {getIconByString(currentMenu.source || '')}
              </p>
              <p>
                <strong>菜单编号：</strong>
                {currentMenu.code}
              </p>
              <p>
                <strong>菜单别名：</strong>
                {currentMenu.alias}
              </p>
              <p>
                <strong>上级菜单：</strong>
                {currentMenu.parentName}
              </p>
              <p>
                <strong>菜单排序：</strong>
                {currentMenu.sort}
              </p>
              <p>
                <strong>菜单类型：</strong>
                {currentMenu.category === 1 ? '菜单' : '按钮'}
              </p>
              <p>
                <strong>是否缓存：</strong>
                {currentMenu.isOpen === 1 ? '是' : '否'}
              </p>
              <p>
                <strong>备注：</strong>
                {currentMenu.remark || '-'}
              </p>
            </div>
          )}
        </div>
      </Modal>
    </PageContainer>
  );
};

export default MenuPage;
