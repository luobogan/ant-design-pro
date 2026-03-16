import { DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { Button, Modal, message } from 'antd';
import React, { useState } from 'react';

interface Log {
  id: string;
  type: string;
  content: string;
  username: string;
  ip: string;
  userAgent: string;
  createTime: string;
}

const Log: React.FC = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [viewModalVisible, setViewModalVisible] = useState<boolean>(false);
  const [currentLog, setCurrentLog] = useState<Log | null>(null);

  // 模拟日志数据
  const {
    data: logs,
    loading,
    refresh,
  } = useRequest(() => {
    return new Promise<Log[]>((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: '1',
            type: '登录',
            content: '用户登录成功',
            username: 'admin',
            ip: '127.0.0.1',
            userAgent:
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            createTime: '2026-01-29 10:00:00',
          },
          {
            id: '2',
            type: '操作',
            content: '添加了新用户',
            username: 'admin',
            ip: '127.0.0.1',
            userAgent:
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            createTime: '2026-01-29 09:30:00',
          },
          {
            id: '3',
            type: '操作',
            content: '修改了用户信息',
            username: 'admin',
            ip: '127.0.0.1',
            userAgent:
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            createTime: '2026-01-29 09:00:00',
          },
          {
            id: '4',
            type: '登录',
            content: '用户登录失败',
            username: 'user',
            ip: '192.168.1.100',
            userAgent:
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            createTime: '2026-01-29 08:30:00',
          },
          {
            id: '5',
            type: '操作',
            content: '删除了用户',
            username: 'admin',
            ip: '127.0.0.1',
            userAgent:
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            createTime: '2026-01-29 08:00:00',
          },
        ]);
      }, 500);
    });
  });

  const columns: ProColumns<Log>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '日志类型',
      dataIndex: 'type',
      key: 'type',
      filters: [
        { text: '登录', value: '登录' },
        { text: '操作', value: '操作' },
        { text: '错误', value: '错误' },
      ],
      width: 100,
    },
    {
      title: '日志内容',
      dataIndex: 'content',
      key: 'content',
      search: true,
      width: 300,
    },
    {
      title: '操作用户',
      dataIndex: 'username',
      key: 'username',
      search: true,
      width: 120,
    },
    {
      title: 'IP地址',
      dataIndex: 'ip',
      key: 'ip',
      search: true,
      width: 150,
    },
    {
      title: 'User-Agent',
      dataIndex: 'userAgent',
      key: 'userAgent',
      width: 400,
      ellipsis: true,
    },
    {
      title: '操作时间',
      dataIndex: 'createTime',
      key: 'createTime',
      valueType: 'dateTime',
      width: 180,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: Log) => (
        <>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => {
              setCurrentLog(record);
              setViewModalVisible(true);
            }}
            style={{ marginRight: 8 }}
          >
            查看
          </Button>
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: '确认删除',
                content: `确定要删除该日志吗？`,
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

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的日志');
      return;
    }
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 条日志吗？`,
      onOk: () => {
        message.success('删除成功');
        setSelectedRowKeys([]);
        refresh();
      },
    });
  };

  const handleClearAll = () => {
    Modal.confirm({
      title: '确认清空',
      content: '确定要清空所有日志吗？',
      onOk: () => {
        message.success('清空成功');
        refresh();
      },
    });
  };

  return (
    <PageContainer
      title="日志管理"
      subTitle="管理系统日志，包括查看、删除日志等操作"
      extra={[
        <Button
          key="batchDelete"
          danger
          onClick={handleBatchDelete}
          disabled={selectedRowKeys.length === 0}
        >
          批量删除
        </Button>,
        <Button key="clearAll" danger onClick={handleClearAll}>
          清空日志
        </Button>,
      ]}
    >
      <ProTable
        columns={columns}
        dataSource={logs}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        toolBarRender={false}
      />

      {/* 查看日志弹窗 */}
      <Modal
        title="日志详情"
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={[
          <Button key="ok" onClick={() => setViewModalVisible(false)}>
            确定
          </Button>,
        ]}
        width={800}
      >
        {currentLog && (
          <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <strong>日志类型：</strong>
              {currentLog.type}
            </div>
            <div style={{ marginBottom: '16px' }}>
              <strong>日志内容：</strong>
              {currentLog.content}
            </div>
            <div style={{ marginBottom: '16px' }}>
              <strong>操作用户：</strong>
              {currentLog.username}
            </div>
            <div style={{ marginBottom: '16px' }}>
              <strong>IP地址：</strong>
              {currentLog.ip}
            </div>
            <div style={{ marginBottom: '16px' }}>
              <strong>User-Agent：</strong>
              {currentLog.userAgent}
            </div>
            <div style={{ marginBottom: '16px' }}>
              <strong>操作时间：</strong>
              {currentLog.createTime}
            </div>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
};

export default Log;
