import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { Button, Form, Input, InputNumber, Modal, message, Select } from 'antd';
import React, { useState, useEffect } from 'react';
import * as deptApi from '@/services/system/dept';
import * as positionApi from '@/services/system/position';
import { getButton } from '@/utils/authority';
import type { ButtonConfig } from '@/components/BusinessComponents/ToolBar';

interface Position {
  id: string;
  name: string;
  code: string;
  deptId: string;
  deptName: string;
  sort: number;
  status: string;
  remark: string;
  createTime: string;
}

const { Option } = Select;
const { TextArea } = Input;

const Position: React.FC = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [viewModalVisible, setViewModalVisible] = useState<boolean>(false);
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [buttons, setButtons] = useState<ButtonConfig[]>([]);

  useEffect(() => {
    const btns = getButton('position');
    setButtons(btns || []);
  }, []);

  // 获取岗位列表
  const {
    data: positions,
    loading,
    refresh,
  } = useRequest(() => {
    return positionApi.list({});
  });

  // 获取部门树
  const { data: deptTree } = useRequest(() => {
    return deptApi.tree({});
  });

  const columns: ProColumns<Position>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '岗位名称',
      dataIndex: 'name',
      key: 'name',
      search: true,
      width: 150,
    },
    {
      title: '岗位编码',
      dataIndex: 'code',
      key: 'code',
      search: true,
      width: 150,
    },
    {
      title: '所属部门',
      dataIndex: 'deptName',
      key: 'deptName',
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
      render: (_: any, record: Position) => (
        <>
          {buttons.some(btn => btn.code === 'position:view') && (
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
              style={{ marginRight: 8 }}
            >
              查看
            </Button>
          )}
          {buttons.some(btn => btn.code === 'position:edit') && (
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              style={{ marginRight: 8 }}
            >
              编辑
            </Button>
          )}
          {buttons.some(btn => btn.code === 'position:delete') && (
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: '确认删除',
                  content: `确定要删除岗位 ${record.name} 吗？`,
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
      await positionApi.submit(values);
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
      await positionApi.submit(values);
      message.success('编辑成功');
      setEditModalVisible(false);
      refresh();
    } catch (_error) {
      message.error('编辑失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await positionApi.remove({ ids: [id] });
      message.success('删除成功');
      refresh();
    } catch (_error) {
      message.error('删除失败');
    }
  };

  const handleView = (record: Position) => {
    setCurrentPosition(record);
    setViewModalVisible(true);
  };

  const handleEdit = (record: Position) => {
    setCurrentPosition(record);
    editForm.setFieldsValue(record);
    setEditModalVisible(true);
  };

  return (
    <PageContainer
      title="岗位管理"
      subTitle="管理系统岗位，包括添加、编辑、删除岗位等操作"
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
      <ProTable
        columns={columns}
        dataSource={positions}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        toolBarRender={false}
      />

      {/* 添加岗位弹窗 */}
      <Modal
        title="添加岗位"
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
            label="岗位名称"
            rules={[{ required: true, message: '请输入岗位名称' }]}
          >
            <Input placeholder="请输入岗位名称" />
          </Form.Item>
          <Form.Item
            name="code"
            label="岗位编码"
            rules={[{ required: true, message: '请输入岗位编码' }]}
          >
            <Input placeholder="请输入岗位编码" />
          </Form.Item>
          <Form.Item
            name="deptId"
            label="所属部门"
            rules={[{ required: true, message: '请选择所属部门' }]}
          >
            <Select placeholder="请选择所属部门">
              {deptTree?.map((dept: any) => (
                <Option key={dept.id} value={dept.id}>
                  {dept.name}
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

      {/* 编辑岗位弹窗 */}
      <Modal
        title="编辑岗位"
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
            label="岗位名称"
            rules={[{ required: true, message: '请输入岗位名称' }]}
          >
            <Input placeholder="请输入岗位名称" />
          </Form.Item>
          <Form.Item
            name="code"
            label="岗位编码"
            rules={[{ required: true, message: '请输入岗位编码' }]}
          >
            <Input placeholder="请输入岗位编码" />
          </Form.Item>
          <Form.Item
            name="deptId"
            label="所属部门"
            rules={[{ required: true, message: '请选择所属部门' }]}
          >
            <Select placeholder="请选择所属部门">
              {deptTree?.map((dept: any) => (
                <Option key={dept.id} value={dept.id}>
                  {dept.name}
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

      {/* 查看岗位弹窗 */}
      <Modal
        title="查看岗位"
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
          {currentPosition && (
            <div>
              <p>
                <strong>岗位名称：</strong>
                {currentPosition.name}
              </p>
              <p>
                <strong>岗位编码：</strong>
                {currentPosition.code}
              </p>
              <p>
                <strong>所属部门：</strong>
                {currentPosition.deptName}
              </p>
              <p>
                <strong>排序：</strong>
                {currentPosition.sort}
              </p>
              <p>
                <strong>状态：</strong>
                {currentPosition.status}
              </p>
              <p>
                <strong>备注：</strong>
                {currentPosition.remark}
              </p>
              <p>
                <strong>创建时间：</strong>
                {currentPosition.createTime}
              </p>
            </div>
          )}
        </div>
      </Modal>
    </PageContainer>
  );
};

export default Position;
