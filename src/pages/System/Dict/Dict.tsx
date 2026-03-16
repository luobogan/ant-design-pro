import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { Button, Modal, message } from 'antd';
import React, { useState } from 'react';

interface Dict {
  id: string;
  name: string;
  code: string;
  status: string;
  remark: string;
  createTime: string;
}

const Dict: React.FC = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [viewModalVisible, setViewModalVisible] = useState<boolean>(false);
  const [_currentDict, setCurrentDict] = useState<Dict | null>(null);

  // 模拟字典数据
  const {
    data: dicts,
    loading,
    refresh,
  } = useRequest(() => {
    return new Promise<Dict[]>((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: '1',
            name: '用户状态',
            code: 'user_status',
            status: '启用',
            remark: '用户状态字典',
            createTime: '2026-01-01 00:00:00',
          },
          {
            id: '2',
            name: '角色类型',
            code: 'role_type',
            status: '启用',
            remark: '角色类型字典',
            createTime: '2026-01-02 00:00:00',
          },
          {
            id: '3',
            name: '部门状态',
            code: 'dept_status',
            status: '禁用',
            remark: '部门状态字典',
            createTime: '2026-01-03 00:00:00',
          },
        ]);
      }, 500);
    });
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
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => {
              setCurrentDict(record);
              setEditModalVisible(true);
            }}
            style={{ marginRight: 8 }}
          >
            编辑
          </Button>
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: '确认删除',
                content: `确定要删除字典 ${record.name} 吗？`,
                onOk: () => {
                  message.success('删除成功');
                  refresh();
                },
              });
            }}
          >
            删除
          </Button>
        </>
      ),
    },
  ];

  const handleAdd = () => {
    setAddModalVisible(true);
  };

  const handleAddOk = () => {
    message.success('添加成功');
    setAddModalVisible(false);
    refresh();
  };

  const handleEditOk = () => {
    message.success('编辑成功');
    setEditModalVisible(false);
    refresh();
  };

  return (
    <PageContainer
      title="字典管理"
      subTitle="管理系统字典，包括添加、编辑、删除字典等操作"
      extra={[
        <Button
          key="add"
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
        >
          添加字典
        </Button>,
      ]}
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
        <div style={{ padding: '24px' }}>
          <p>添加字典表单</p>
        </div>
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
        <div style={{ padding: '24px' }}>
          <p>编辑字典表单</p>
        </div>
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
          <p>查看字典详情</p>
        </div>
      </Modal>
    </PageContainer>
  );
};

export default Dict;
