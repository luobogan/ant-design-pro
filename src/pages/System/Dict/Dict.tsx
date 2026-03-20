import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { Button, Form, Input, Modal, message, Select } from 'antd';
import React, { useState, useEffect } from 'react';
import * as dictApi from '@/services/system/dict';
import { getButton } from '@/utils/authority';
import type { ButtonConfig } from '@/components/BusinessComponents/ToolBar';

interface Dict {
  id: string;
  name: string;
  code: string;
  status: string;
  remark: string;
  createTime: string;
}

const { Option } = Select;
const { TextArea } = Input;

const Dict: React.FC = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [viewModalVisible, setViewModalVisible] = useState<boolean>(false);
  const [currentDict, setCurrentDict] = useState<Dict | null>(null);
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [buttons, setButtons] = useState<ButtonConfig[]>([]);

  useEffect(() => {
    const btns = getButton('dict');
    setButtons(btns || []);
  }, []);

  // 获取字典列表
  const {
    data: dicts,
    loading,
    refresh,
  } = useRequest(() => {
    return dictApi.list({});
  });

  const columns: ProColumns<Dict>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '字典名称',
      dataIndex: 'name',
      key: 'name',
      search: true,
      width: 150,
    },
    {
      title: '字典编码',
      dataIndex: 'code',
      key: 'code',
      search: true,
      width: 150,
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
      render: (_: any, record: Dict) => (
        <>
          {buttons.some(btn => btn.code === 'dict:view') && (
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => {
                setCurrentDict(record);
                setViewModalVisible(true);
              }}
              style={{ marginRight: 8 }}
            >
              查看
            </Button>
          )}
          {buttons.some(btn => btn.code === 'dict:edit') && (
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => {
                setCurrentDict(record);
                editForm.setFieldsValue(record);
                setEditModalVisible(true);
              }}
              style={{ marginRight: 8 }}
            >
              编辑
            </Button>
          )}
          {buttons.some(btn => btn.code === 'dict:delete') && (
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: '确认删除',
                  content: `确定要删除字典 ${record.name} 吗？`,
                  onOk: async () => {
                    try {
                      await dictApi.remove({ ids: [record.id] });
                      message.success('删除成功');
                      refresh();
                    } catch {
                      message.error('删除失败');
                    }
                  },
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
      await dictApi.submit(values);
      message.success('添加成功');
      setAddModalVisible(false);
      refresh();
    } catch {
      message.error('添加失败');
    }
  };

  const handleEditOk = async () => {
    try {
      const values = await editForm.validateFields();
      await dictApi.submit(values);
      message.success('编辑成功');
      setEditModalVisible(false);
      refresh();
    } catch {
      message.error('编辑失败');
    }
  };

  return (
    <PageContainer
      title="字典管理"
      subTitle="管理系统字典，包括添加、编辑、删除字典等操作"
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
        dataSource={dicts}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        toolBarRender={false}
      />

      {/* 添加字典弹窗 */}
      <Modal
        title="添加字典"
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
            label="字典名称"
            rules={[{ required: true, message: '请输入字典名称' }]}
          >
            <Input placeholder="请输入字典名称" />
          </Form.Item>
          <Form.Item
            name="code"
            label="字典编码"
            rules={[{ required: true, message: '请输入字典编码' }]}
          >
            <Input placeholder="请输入字典编码" />
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

      {/* 编辑字典弹窗 */}
      <Modal
        title="编辑字典"
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
            label="字典名称"
            rules={[{ required: true, message: '请输入字典名称' }]}
          >
            <Input placeholder="请输入字典名称" />
          </Form.Item>
          <Form.Item
            name="code"
            label="字典编码"
            rules={[{ required: true, message: '请输入字典编码' }]}
          >
            <Input placeholder="请输入字典编码" />
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

      {/* 查看字典弹窗 */}
      <Modal
        title="查看字典"
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
          {currentDict && (
            <div>
              <p>
                <strong>字典名称：</strong>
                {currentDict.name}
              </p>
              <p>
                <strong>字典编码：</strong>
                {currentDict.code}
              </p>
              <p>
                <strong>状态：</strong>
                {currentDict.status}
              </p>
              <p>
                <strong>备注：</strong>
                {currentDict.remark}
              </p>
              <p>
                <strong>创建时间：</strong>
                {currentDict.createTime}
              </p>
            </div>
          )}
        </div>
      </Modal>
    </PageContainer>
  );
};

export default Dict;
