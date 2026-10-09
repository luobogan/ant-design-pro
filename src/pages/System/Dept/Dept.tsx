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
import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, TreeSelect, message, Tree, Tag } from 'antd';
import React, { useState, useMemo } from 'react';
import * as deptApi from '@/services/system/dept';
import usePermission from '@/hooks/usePermission';

interface Dept {
  id: string;
  tenantId: string;
  name: string;
  deptCode: string;
  deptType: number;
  subcompanyId?: string;
  parentId: string;
  parentName: string;
  sort: number;
  canceled: number;
  remark: string;
  createTime: string;
  children?: Dept[];
}

const { Option } = Select;
const { TextArea } = Input;

/** 组织树顶层「公司」虚拟根节点 key（点击=查看全部组织；真实公司/分部/部门节点在其下） */
const COMPANY_ROOT_KEY = '__company__';

/** 在嵌套组织树中按 id 查找节点 */
const findDeptNode = (nodes: Dept[], id: string): Dept | null => {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const hit = findDeptNode(n.children, id);
      if (hit) return hit;
    }
  }
  return null;
};

const Dept: React.FC = () => {
  const { buttons } = usePageButtons();
  const { currentUser } = usePermission();
  const tenantName = (currentUser as any)?.tenantName as string | undefined;

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [viewModalVisible, setViewModalVisible] = useState<boolean>(false);
  const [currentDept, setCurrentDept] = useState<Dept | null>(null);
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [selectedDept, setSelectedDept] = useState<string>('');

  // 获取部门列表（显式带当前租户：admin 后端不做租户过滤，缺省会把全部租户的组织混进来）
  const {
    data: deptData,
    loading,
    refresh,
  } = useRequest(() => {
    return deptApi.list({ tenantId: (currentUser as any)?.tenantId || undefined });
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
      tenantName: dept.tenantName || '-',
      name: dept.deptName || dept.name || '',
      deptCode: dept.deptCode || '',
      deptType: dept.deptType ?? 2,
      canceled: dept.canceled ?? 0,
      parentId: String(dept.parentId || '0'),
      parentName: dept.parentName || '-',
      sort: dept.sort || 0,
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

  // 部门树数据
  const treeData = useMemo(() => {
    const records = Array.isArray(deptData)
      ? deptData
      : deptData?.records || deptData?.data || [];

    const deptMap = new Map<string, any>();
    const rootNodes: any[] = [];

    records.forEach((dept: any) => {
      deptMap.set(String(dept.id), {
        key: String(dept.id),
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

    return [
      {
        key: COMPANY_ROOT_KEY,
        title: tenantName ? `公司：${tenantName}` : '公司',
        children: removeEmptyChildren(rootNodes),
      },
    ];
  }, [deptData, tenantName]);

  // 左侧组织树选中 → 右侧仅显示该子树（公司根节点/未选 = 全量）
  const tableDepts = useMemo(() => {
    if (!selectedDept || selectedDept === COMPANY_ROOT_KEY) return depts;
    const node = findDeptNode(depts, selectedDept);
    return node ? [node] : [];
  }, [depts, selectedDept]);

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
      title: '租户名称',
      dataIndex: 'tenantName',
      key: 'tenantName',
      width: 120,
      search: true,
      sorter: true,
    },
    {
      title: '部门名称',
      dataIndex: 'name',
      key: 'name',
      search: true,
      width: 150,
    },
    {
      title: '组织编号',
      dataIndex: 'deptCode',
      key: 'deptCode',
      search: true,
      width: 130,
      render: (deptCode) => deptCode || '-',
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
      title: '组织类型',
      dataIndex: 'deptType',
      key: 'deptType',
      width: 90,
      render: (_, record: Dept) => (
        <Tag color={record.deptType === 1 ? 'purple' : 'cyan'}>
          {record.deptType === 1 ? '分部' : '部门'}
        </Tag>
      ),
    },
    {
      title: '封存状态',
      dataIndex: 'canceled',
      key: 'canceled',
      filters: [
        { text: '正常', value: 0 },
        { text: '封存', value: 1 },
      ],
      onFilter: true,
      render: (_, record: Dept) => (
        <Tag color={record.canceled === 1 ? 'red' : 'green'}>
          {record.canceled === 1 ? '封存' : '正常'}
        </Tag>
      ),
      width: 90,
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
          {buttons.some(btn => btn.code === 'dept_edit') && (
            <Popconfirm
              title={record.canceled === 1 ? '确认解封' : '确认封存'}
              description={
                record.canceled === 1
                  ? `确定要解封组织 ${record.name} 吗？`
                  : `确定要封存组织 ${record.name} 吗？（封存后用户创建页不可选）`
              }
              onConfirm={() => handleToggleCanceled(record)}
              okText="确认"
              cancelText="取消"
            >
              <Button type="link" size="small">
                {record.canceled === 1 ? '解封' : '封存'}
              </Button>
            </Popconfirm>
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

  // 封存/解封组织（对齐 ecology canceled 机制：封存可解封，删除前置校验由后端承担）
  const handleToggleCanceled = async (record: Dept) => {
    const toCanceled = record.canceled === 1;
    try {
      if (toCanceled) {
        await deptApi.isCanceled({ ids: [record.id] });
        message.success('解封成功');
      } else {
        await deptApi.cancel({ ids: [record.id] });
        message.success('封存成功');
      }
      refresh();
    } catch (error: any) {
      message.error(error?.message || (toCanceled ? '解封失败' : '封存失败'));
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
      deptCode: record.deptCode,
      deptType: record.deptType ?? 2,
      parentId: record.parentId || '0',
      sort: record.sort,
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
      <div style={{ display: 'flex', gap: '16px' }}>
        {/* 左侧组织架构树（公司 → 分部 → 部门；点击节点右侧仅显示该子树，再次点击取消） */}
        <Card title="组织架构树" style={{ width: '280px', flexShrink: 0 }}>
          <Tree
            treeData={treeData}
            selectedKeys={selectedDept ? [selectedDept] : []}
            onSelect={(keys) => setSelectedDept((keys[0] as string) || '')}
            defaultExpandAll
            style={{ maxHeight: '600px', overflow: 'auto' }}
          />
        </Card>

        {/* 右侧部门列表 */}
        <Card title="部门列表" style={{ flex: 1 }}>
          <ProTable
            columns={columns}
            dataSource={tableDepts || []}
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
      </div>

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
        <Form form={addForm} layout="vertical" style={{ padding: '24px' }} initialValues={{ deptType: 2 }}>
          <Form.Item
            name="name"
            label="部门名称"
            rules={[{ required: true, message: '请输入部门名称' }]}
          >
            <Input placeholder="请输入部门名称" />
          </Form.Item>
          <Form.Item name="deptType" label="组织类型">
            <Select placeholder="请选择组织类型">
              <Option value={2}>部门</Option>
              <Option value={1}>分部（子公司/分支机构）</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="deptCode"
            label="组织编号"
          >
            <Input placeholder="请输入组织编号（选填）" />
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
          <Form.Item name="deptType" label="组织类型">
            <Select placeholder="请选择组织类型">
              <Option value={2}>部门</Option>
              <Option value={1}>分部（子公司/分支机构）</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="deptCode"
            label="组织编号"
          >
            <Input placeholder="请输入组织编号（选填）" />
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
                <strong>组织编号：</strong>
                {currentDept.deptCode || '-'}
              </p>
              <p>
                <strong>组织类型：</strong>
                {currentDept.deptType === 1 ? '分部' : '部门'}
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
                <strong>封存状态：</strong>
                {currentDept.canceled === 1 ? '封存' : '正常'}
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
