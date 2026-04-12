import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { usePageButtons } from '@/hooks/usePageButtons';
import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, TreeSelect, message } from 'antd';
import React, { useState, useMemo } from 'react';
import * as deptApi from '@/services/system/dept';

interface Dept {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  parentId: string;
  parentName: string;
  sort: number;
  status: string;
  remark: string;
  createTime: string;
  children?: Dept[];
}

const { Option } = Select;
const { TextArea } = Input;

const Dept: React.FC = () => {
  const { buttons } = usePageButtons();

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [viewModalVisible, setViewModalVisible] = useState<boolean>(false);
  const [currentDept, setCurrentDept] = useState<Dept | null>(null);
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // 获取部门列表
  const {
    data: deptData,
    loading,
    refresh,
  } = useRequest(() => {
    return deptApi.list({});
  });

  // 转换部门数据为树形结构
  const depts = useMemo(() => {
    const records = Array.isArray(deptData)
      ? deptData
      : deptData?.records || deptData?.data || [];

    const mappedRecords = records.map((dept: any) => ({
      ...dept,
      id: String(dept.id || ''),
      key: String(dept.id || ''),
      tenantId: dept.tenantId || '-',
      name: dept.deptName || dept.name || '',
      code: dept.code || '-',
      parentId: String(dept.parentId || '0'),
      parentName: dept.parentName || '-',
      sort: dept.sort || 0,
      status: dept.status !== undefined ? dept.status : '启用',
      remark: dept.remark || '',
      createTime: dept.createTime || '',
    }));

    // 构建树形结构
    const deptMap = new Map<string, typeof mappedRecords[0]>();
    const rootNodes: typeof mappedRecords = [];

    mappedRecords.forEach((dept) => {
      deptMap.set(dept.id, { ...dept });
    });

    deptMap.forEach((dept) => {
      if (dept.parentId === '0' || !deptMap.has(dept.parentId)) {
        rootNodes.push(dept);
      } else {
        const parent = deptMap.get(dept.parentId);
        if (parent) {
          if (!parent.children) {
            parent.children = [] as typeof mappedRecords;
          }
          parent.children.push(dept);
        }
      }
    });

    // 按排序字段排序，只有当有子节点时才保留 children 字段
    const sortNodes = (nodes: typeof mappedRecords): typeof mappedRecords => {
      return nodes.sort((a, b) => (a.sort || 0) - (b.sort || 0)).map(node => {
        if (node.children && node.children.length > 0) {
          return {
            ...node,
            children: sortNodes(node.children),
          };
        }
        const { children, ...rest } = node;
        return rest;
      });
    };

    return sortNodes(rootNodes);
  }, [deptData]);

  const deptTreeData = useMemo(() => {
    const records = Array.isArray(deptData)
      ? deptData
      : deptData?.records || deptData?.data || [];

    const deptMap = new Map<string, any>();
    const rootNodes: any[] = [];

    records.forEach((dept: any) => {
      deptMap.set(String(dept.id), {
        value: String(dept.id),
        title: dept.deptName || dept.name || dept.id,
        children: [],
      });
    });

    deptMap.forEach((dept, id) => {
      const parentId = records.find((r: any) => String(r.id) === id)?.parentId;
      if (!parentId || parentId === '0' || !deptMap.has(String(parentId))) {
        rootNodes.push(dept);
      } else {
        const parent = deptMap.get(String(parentId));
        if (parent) {
          parent.children.push(dept);
        }
      }
    });

    const removeEmptyChildren = (nodes: any[]): any[] => {
      return nodes.map(node => {
        if (node.children && node.children.length > 0) {
          return {
            ...node,
            children: removeEmptyChildren(node.children),
          };
        }
        const { children, ...rest } = node;
        return rest;
      });
    };

    return [{
      value: '0',
      title: '无',
      children: removeEmptyChildren(rootNodes),
    }];
  }, [deptData]);

  const columns: ProColumns<Dept>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      hideInTable: true,
    },
    {
      title: '租户ID',
      dataIndex: 'tenantId',
      key: 'tenantId',
      width: 100,
    },
    {
      title: '部门名称',
      dataIndex: 'name',
      key: 'name',
      search: true,
      width: 150,
    },
    {
      title: '部门编码',
      dataIndex: 'code',
      key: 'code',
      search: true,
      width: 150,
    },
    {
      title: '上级部门',
      dataIndex: 'parentName',
      key: 'parentName',
      search: true,
      width: 150,
    },
    {
      title: '排序',
      dataIndex: 'sort',
      key: 'sort',
      width: 80,
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
      width: 200,
      render: (_: unknown, record: Dept) => (
        <Space size="small">
          {buttons.some(btn => btn.code === 'dept_view') && (
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            >
              查看
            </Button>
          )}
          {buttons.some(btn => btn.code === 'dept_edit') && (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
          )}
          {buttons.some(btn => btn.code === 'dept_delete') && (
            <Popconfirm
              title="确认删除"
              description={`确定要删除部门 ${record.name} 吗？`}
              onConfirm={() => handleDelete(record.id)}
              okText="确认"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const handleAdd = () => {
    addForm.resetFields();
    setAddModalVisible(true);
  };

  const handleAddOk = async () => {
    try {
      const values = await addForm.validateFields();
      const submitData = {
        ...values,
        deptName: values.name,
      };
      delete submitData.name;
      await deptApi.submit(submitData);
      message.success('添加成功');
      setAddModalVisible(false);
      refresh();
    } catch (_error) {
      message.error('添加失败');
    }
  };

  const handleEditOk = async () => {
    try {
      const values = await editForm.validateFields();
      const submitData = {
        ...values,
        deptName: values.name,
      };
      delete submitData.name;
      await deptApi.submit(submitData);
      message.success('编辑成功');
      setEditModalVisible(false);
      refresh();
    } catch (_error) {
      message.error('编辑失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deptApi.remove({ ids: [id] });
      message.success('删除成功');
      refresh();
    } catch (_error) {
      message.error('删除失败');
    }
  };

  const handleView = (record: Dept) => {
    setCurrentDept(record);
    setViewModalVisible(true);
  };

  const handleEdit = (record: Dept) => {
    setCurrentDept(record);
    editForm.setFieldsValue({
      id: record.id,
      name: record.name,
      code: record.code,
      parentId: record.parentId || '0',
      sort: record.sort,
      status: record.status,
      remark: record.remark,
    });
    setEditModalVisible(true);
  };

  return (
    <PageContainer
      title="部门管理"
      subTitle="管理系统部门，包括添加、编辑、删除部门等操作"
      extra={
        <Space>
          {buttons.some(btn => btn.code === 'dept_add') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              新增部门
            </Button>
          )}
        </Space>
      }
    >
      <Card title="部门列表">
        <ProTable
          columns={columns}
          dataSource={depts || []}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
          toolBarRender={false}
          treeData
          childrenColumnName="children"
        />
      </Card>

      {/* 添加部门弹窗 */}
      <Modal
        title="添加部门"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
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
        <Form form={addForm} layout="vertical" style={{ padding: '24px' }}>
          <Form.Item
            name="name"
            label="部门名称"
            rules={[{ required: true, message: '请输入部门名称' }]}
          >
            <Input placeholder="请输入部门名称" />
          </Form.Item>
          <Form.Item
            name="code"
            label="部门编码"
            rules={[{ required: true, message: '请输入部门编码' }]}
          >
            <Input placeholder="请输入部门编码" />
          </Form.Item>
          <Form.Item name="parentId" label="上级部门">
            <TreeSelect
              placeholder="请选择上级部门"
              treeData={deptTreeData}
              treeDefaultExpandAll
            />
          </Form.Item>
          <Form.Item
            name="sort"
            label="排序"
            rules={[{ required: true, message: '请输入排序' }]}
          >
            <InputNumber placeholder="请输入排序" min={1} />
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select placeholder="请选择状态">
              <Option value="启用">启用</Option>
              <Option value="禁用">禁用</Option>
            </Select>
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑部门弹窗 */}
      <Modal
        title="编辑部门"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
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
        <Form form={editForm} layout="vertical" style={{ padding: '24px' }}>
          <Form.Item name="id" hidden>
            <Input />
          </Form.Item>
          <Form.Item
            name="name"
            label="部门名称"
            rules={[{ required: true, message: '请输入部门名称' }]}
          >
            <Input placeholder="请输入部门名称" />
          </Form.Item>
          <Form.Item
            name="code"
            label="部门编码"
            rules={[{ required: true, message: '请输入部门编码' }]}
          >
            <Input placeholder="请输入部门编码" />
          </Form.Item>
          <Form.Item name="parentId" label="上级部门">
            <TreeSelect
              placeholder="请选择上级部门"
              treeData={deptTreeData}
              treeDefaultExpandAll
            />
          </Form.Item>
          <Form.Item
            name="sort"
            label="排序"
            rules={[{ required: true, message: '请输入排序' }]}
          >
            <InputNumber placeholder="请输入排序" min={1} />
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select placeholder="请选择状态">
              <Option value="启用">启用</Option>
              <Option value="禁用">禁用</Option>
            </Select>
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 查看部门弹窗 */}
      <Modal
        title="查看部门"
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
          {currentDept && (
            <div>
              <p>
                <strong>部门名称：</strong>
                {currentDept.name}
              </p>
              <p>
                <strong>部门编码：</strong>
                {currentDept.code}
              </p>
              <p>
                <strong>上级部门：</strong>
                {currentDept.parentName}
              </p>
              <p>
                <strong>排序：</strong>
                {currentDept.sort}
              </p>
              <p>
                <strong>状态：</strong>
                {currentDept.status}
              </p>
              <p>
                <strong>备注：</strong>
                {currentDept.remark}
              </p>
              <p>
                <strong>创建时间：</strong>
                {currentDept.createTime}
              </p>
            </div>
          )}
        </div>
      </Modal>
    </PageContainer>
  );
};

export default Dept;
