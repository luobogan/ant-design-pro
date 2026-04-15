import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Tree, message, Form, Input, Select, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import type { ColumnType } from 'antd/es/table';
import { tenantPackageApi } from '@/services/system/tenant';

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

const TenantPackage: React.FC = () => {
  const [tableData, setTableData] = useState<TenantPackage[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isGrantModalVisible, setIsGrantModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [grantingPackageId, setGrantingPackageId] = useState<number | null>(null);
  const [menuTree, setMenuTree] = useState<MenuTree[]>([]);
  const [checkedMenuKeys, setCheckedMenuKeys] = useState<string[]>([]);

  const columns: ColumnType<TenantPackage>[] = [
    {
      title: '产品包名称',
      dataIndex: 'packageName',
      key: 'packageName',
    },
    {
      title: '产品包编码',
      dataIndex: 'packageCode',
      key: 'packageCode',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (status === 1 ? '启用' : '禁用'),
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="primary" ghost size="small" onClick={() => handleEdit(record)}>
            <EditOutlined /> 编辑
          </Button>
          <Button type="primary" ghost size="small" onClick={() => handleGrant(record.id)}>
            分配菜单
          </Button>
          <Button danger ghost size="small" onClick={() => handleDelete(record.id)}>
            <DeleteOutlined /> 删除
          </Button>
        </Space>
      ),
    },
  ];

  const fetchData = async () => {
    try {
      const res = await tenantPackageApi.list({ current: 1, size: 100 });
      if (res.success && res.data) {
        setTableData(res.data.records || []);
      }
    } catch (error) {
      console.error('获取产品包列表失败:', error);
    }
  };

  const formatMenuTree = (menuList: any[]): MenuTree[] => {
    return menuList.map(menu => ({
      key: String(menu.id),
      title: menu.title || menu.name || '---',
      children: menu.children ? formatMenuTree(menu.children) : undefined,
    }));
  };

  const showModal = () => {
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (record: TenantPackage) => {
    form.setFieldsValue(record);
    setIsModalVisible(true);
  };

  const handleGrant = async (packageId: number) => {
    setGrantingPackageId(packageId);
    try {
      const treeRes = await tenantPackageApi.menuGrantTree();
      if (treeRes.success && treeRes.data) {
        setMenuTree(formatMenuTree(treeRes.data.menu || []));
      }

      const keysRes = await tenantPackageApi.packageMenuKeys(packageId);
      if (keysRes.success && keysRes.data) {
        setCheckedMenuKeys(keysRes.data.menu?.checkedKeys || []);
      } else {
        setCheckedMenuKeys([]);
      }
      setIsGrantModalVisible(true);
    } catch (error) {
      console.error('获取菜单树失败:', error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await tenantPackageApi.remove(id);
      if (res.success) {
        message.success('删除成功');
        fetchData();
      } else {
        message.error(res.msg || '删除失败');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const res = values.id
        ? await tenantPackageApi.update(values)
        : await tenantPackageApi.submit(values);
      if (res.success) {
        message.success(values.id ? '更新成功' : '创建成功');
        setIsModalVisible(false);
        fetchData();
      } else {
        message.error(res.msg || '操作失败');
      }
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const handleGrantOk = async () => {
    try {
      await tenantPackageApi.grantMenu(grantingPackageId!, checkedMenuKeys.map(k => Number(k)));
      message.success('菜单权限分配成功');
      setIsGrantModalVisible(false);
    } catch (error) {
      message.error('分配失败');
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

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div>
      <Button type="primary" onClick={showModal} style={{ marginBottom: 16 }}>
        <PlusOutlined /> 新增产品包
      </Button>
      <Table
        columns={columns}
        dataSource={tableData}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={form.getFieldValue('id') ? '编辑产品包' : '新增产品包'}
        visible={isModalVisible}
        onOk={handleOk}
        onCancel={() => setIsModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="id" hidden />
          <Form.Item
            name="packageName"
            label="产品包名称"
            rules={[{ required: true, message: '请输入产品包名称' }]}
          >
            <Input placeholder="请输入产品包名称" />
          </Form.Item>
          <Form.Item
            name="packageCode"
            label="产品包编码"
            rules={[{ required: true, message: '请输入产品包编码' }]}
          >
            <Input placeholder="请输入产品包编码" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="请输入产品包描述" />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select>
              <Select.Option value={1}>启用</Select.Option>
              <Select.Option value={0}>禁用</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`为产品包分配菜单权限`}
        visible={isGrantModalVisible}
        onOk={handleGrantOk}
        onCancel={() => setIsGrantModalVisible(false)}
        width={600}
        footer={[
          <Button key="checkAll" onClick={handleCheckAll}>
            <CheckOutlined /> 全选
          </Button>,
          <Button key="uncheckAll" onClick={handleUncheckAll}>
            <CloseOutlined /> 取消全选
          </Button>,
          <Button key="back" onClick={() => setIsGrantModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={handleGrantOk}>
            确定分配
          </Button>,
        ]}
      >
        <Tree
          checkable
          treeData={menuTree}
          checkedKeys={checkedMenuKeys}
          onCheck={(_, info) => setCheckedMenuKeys(info.checkedKeys as string[])}
          checkStrictly
          defaultExpandAll
          style={{ maxHeight: 400, overflowY: 'auto' }}
        />
      </Modal>
    </div>
  );
};

export default TenantPackage;