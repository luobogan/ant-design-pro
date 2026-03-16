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

interface Config {
  id: string;
  name: string;
  code: string;
  value: string;
  type: string;
  status: string;
  remark: string;
  createTime: string;
}

const Config: React.FC = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [viewModalVisible, setViewModalVisible] = useState<boolean>(false);
  const [_currentConfig, setCurrentConfig] = useState<Config | null>(null);

  // 模拟参数数据
  const {
    data: configs,
    loading,
    refresh,
  } = useRequest(() => {
    return new Promise<Config[]>((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: '1',
            name: '系统名称',
            code: 'system_name',
            value: 'Sword',
            type: 'string',
            status: '启用',
            remark: '系统名称配置',
            createTime: '2026-01-01 00:00:00',
          },
          {
            id: '2',
            name: '系统版本',
            code: 'system_version',
            value: 'v1.0.0',
            type: 'string',
            status: '启用',
            remark: '系统版本配置',
            createTime: '2026-01-02 00:00:00',
          },
          {
            id: '3',
            name: '登录超时时间',
            code: 'login_timeout',
            value: '3600',
            type: 'number',
            status: '启用',
            remark: '登录超时时间（秒）',
            createTime: '2026-01-03 00:00:00',
          },
          {
            id: '4',
            name: '是否开启验证码',
            code: 'captcha_enabled',
            value: 'true',
            type: 'boolean',
            status: '启用',
            remark: '是否开启登录验证码',
            createTime: '2026-01-04 00:00:00',
          },
        ]);
      }, 500);
    });
  });

  const columns: ProColumns<Config>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '参数名称',
      dataIndex: 'name',
      key: 'name',
      search: true,
      width: 150,
    },
    {
      title: '参数编码',
      dataIndex: 'code',
      key: 'code',
      search: true,
      width: 150,
    },
    {
      title: '参数值',
      dataIndex: 'value',
      key: 'value',
      search: true,
      width: 200,
    },
    {
      title: '参数类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
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
      render: (_: any, record: Config) => (
        <>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => {
              setCurrentConfig(record);
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
              setCurrentConfig(record);
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
                content: `确定要删除参数 ${record.name} 吗？`,
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
      title="配置管理"
      subTitle="管理系统配置，包括添加、编辑、删除配置等操作"
      extra={[
        <Button
          key="add"
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
        >
          添加配置
        </Button>,
      ]}
    >
      <ProTable
        columns={columns}
        dataSource={configs}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        toolBarRender={false}
      />

      {/* 添加参数弹窗 */}
      <Modal
        title="添加参数"
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
          <p>添加参数表单</p>
        </div>
      </Modal>

      {/* 编辑参数弹窗 */}
      <Modal
        title="编辑参数"
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
          <p>编辑参数表单</p>
        </div>
      </Modal>

      {/* 查看参数弹窗 */}
      <Modal
        title="查看参数"
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
          <p>查看参数详情</p>
        </div>
      </Modal>
    </PageContainer>
  );
};

export default Config;
