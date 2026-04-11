import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { Button, Card, Col, Form, Input, InputNumber, Modal, message, Row, Select, Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';
import React, { useState, useEffect, useMemo } from 'react';
import * as deptApi from '@/services/system/dept';
import { getButton } from '@/utils/authority';
import type { ButtonConfig } from '@/components/BusinessComponents/ToolBar';

interface Dept {
  id: string;
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

interface DeptTreeNode {
  id: string;
  parentId: string;
  title: string;
  key: string;
  children?: DeptTreeNode[];
}

const { Option } = Select;
const { TextArea } = Input;

const Dept: React.FC = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [viewModalVisible, setViewModalVisible] = useState<boolean>(false);
  const [currentDept, setCurrentDept] = useState<Dept | null>(null);
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [buttons, setButtons] = useState<ButtonConfig[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [searchValue, setSearchValue] = useState<string>('');
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);

  useEffect(() => {
    const btns = getButton('dept');
    setButtons(btns || []);
  }, []);

  // 获取部门列表
  const {
    data: deptData,
    loading,
    refresh,
  } = useRequest(() => {
    return deptApi.list({});
  }, {
    refreshDeps: [selectedDeptId],
  });

  // 转换部门数据，适配后端字段
  const depts = useMemo(() => {
    const records = Array.isArray(deptData)
      ? deptData
      : deptData?.records || deptData?.data || [];
    
    // 根据选择的部门过滤数据
    let filteredRecords = records;
    if (selectedDeptId) {
      // 如果选择了某个部门，显示该部门及其所有子部门
      const getDescendantIds = (deptId: string): string[] => {
        const ids: string[] = [deptId];
        const children = records.filter((d: any) => String(d.parentId) === String(deptId));
        children.forEach((child: any) => {
          ids.push(...getDescendantIds(String(child.id)));
        });
        return ids;
      };
      const descendantIds = getDescendantIds(selectedDeptId);
      filteredRecords = records.filter((d: any) => descendantIds.includes(String(d.id)));
    }

    return filteredRecords.map((dept: any) => ({
      ...dept,
      id: dept.id || '',
      name: dept.deptName || dept.name || '',
      code: dept.code || '-',
      parentId: dept.parentId || '',
      parentName: dept.parentName || '-',
      sort: dept.sort || 0,
      status: dept.status !== undefined ? dept.status : '启用',
      remark: dept.remark || '',
      createTime: dept.createTime || '',
    }));
  }, [deptData, selectedDeptId]);

  // 构建树形数据
  const deptTreeData = useMemo(() => {
    const records = Array.isArray(deptData)
      ? deptData
      : deptData?.records || deptData?.data || [];
    
    const deptMap = new Map<string, DeptTreeNode>();
    const rootNodes: DeptTreeNode[] = [];

    records.forEach((dept: any) => {
      const node: DeptTreeNode = {
        id: String(dept.id),
        parentId: String(dept.parentId || 0),
        title: dept.deptName || dept.name || dept.id,
        key: String(dept.id),
        children: [],
      };
      deptMap.set(node.id, node);
    });

    deptMap.forEach((node) => {
      if (node.parentId === '0' || !deptMap.has(node.parentId)) {
        rootNodes.push(node);
      } else {
        const parent = deptMap.get(node.parentId);
        if (parent) {
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(node);
        }
      }
    });

    const sortNodes = (nodes: DeptTreeNode[]): DeptTreeNode[] => {
      return nodes.sort((a, b) => {
        const aSort = records.find((r: any) => String(r.id) === a.id)?.sort || 0;
        const bSort = records.find((r: any) => String(r.id) === b.id)?.sort || 0;
        return aSort - bSort;
      }).map(node => ({
        ...node,
        children: node.children ? sortNodes(node.children) : undefined,
      }));
    };

    return sortNodes(rootNodes);
  }, [deptData]);

  // 获取所有部门ID用于默认展开
  useEffect(() => {
    const getAllKeys = (data: DeptTreeNode[]): string[] => {
      let keys: string[] = [];
      data.forEach((item) => {
        keys.push(item.id);
        if (item.children) {
          keys = keys.concat(getAllKeys(item.children));
        }
      });
      return keys;
    };
    setExpandedKeys(getAllKeys(deptTreeData));
  }, [deptTreeData]);

  // 构建树形数据结构
  const buildTreeData = (data: DeptTreeNode[]): DataNode[] => {
    return data.map((item) => ({
      key: item.id,
      title: item.title,
      children: item.children ? buildTreeData(item.children) : undefined,
    }));
  };

  // 处理部门选择
  const handleDeptSelect = (selectedKeys: React.Key[], _info: any) => {
    if (selectedKeys.length > 0) {
      setSelectedDeptId(selectedKeys[0] as string);
    } else {
      setSelectedDeptId('');
    }
  };

  // 处理展开/折叠
  const handleExpand = (expandedKeys: React.Key[]) => {
    setExpandedKeys(expandedKeys);
  };

  const columns: ProColumns<Dept>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
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
      width: 150,
      render: (_: any, record: Dept) => (
        <>
          {buttons.some(btn => btn.code === 'dept_view') && (
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
              style={{ marginRight: 8 }}
            >
              查看
            </Button>
          )}
          {buttons.some(btn => btn.code === 'dept_edit') && (
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              style={{ marginRight: 8 }}
            >
              编辑
            </Button>
          )}
          {buttons.some(btn => btn.code === 'dept_delete') && (
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: '确认删除',
                  content: `确定要删除部门 ${record.name} 吗？`,
                  onOk: () => handleDelete(record.id),
                });
              }}
            >
              删除
            </Button>
          )}
        </>
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
      await deptApi.submit(values);
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
      await deptApi.submit(values);
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
    editForm.setFieldsValue(record);
    setEditModalVisible(true);
  };

  return (
    <PageContainer
      title="部门管理"
      subTitle="管理系统部门，包括添加、编辑、删除部门等操作"
      extra={buttons.filter(btn => btn.action === 1 || btn.action === 3).map(btn => (
        <Button
          key={btn.code}
          type={btn.alias === 'add' ? 'primary' : 'default'}
          icon={btn.source ? <span>{btn.source}</span> : undefined}
          onClick={handleAdd}
        >
          {btn.name}
        </Button>
      ))}
    >
      <Row gutter={16}>
        {/* 左侧部门树 */}
        <Col span={5}>
          <Card
            title="部门结构"
            extra={
              <Button
                type="text"
                icon={<ReloadOutlined />}
                onClick={() => refresh()}
                size="small"
              />
            }
            loading={loading}
            styles={{ body: { padding: '12px', minHeight: '600px' } }}
          >
            <Input
              placeholder="输入关键字进行过滤"
              prefix={<SearchOutlined />}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              style={{ marginBottom: 12 }}
            />
            <Tree
              treeData={buildTreeData(deptTreeData)}
              onSelect={handleDeptSelect}
              expandedKeys={expandedKeys}
              onExpand={handleExpand}
              selectable
              showLine
              showIcon={false}
              style={{ maxHeight: '500px', overflow: 'auto' }}
              defaultSelectedKeys={selectedDeptId ? [selectedDeptId] : []}
            />
          </Card>
        </Col>

        {/* 右侧部门列表 */}
        <Col span={19}>
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
          />
        </Col>
      </Row>

      {/* 添加部门弹窗 */}
      <Modal
        title="添加部门"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        onOk={handleAddOk}
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
            <Select placeholder="请选择上级部门">
              <Option value="0">无</Option>
              {deptTreeData?.map((dept: any) => (
                <Option key={dept.id} value={dept.id}>
                  {dept.title}
                </Option>
              ))}
            </Select>
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
        onOk={handleEditOk}
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
            <Select placeholder="请选择上级部门">
              <Option value="0">无</Option>
              {deptTreeData?.map((dept: any) => (
                <Option key={dept.id} value={dept.id}>
                  {dept.title}
                </Option>
              ))}
            </Select>
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
