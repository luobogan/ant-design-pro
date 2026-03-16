import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { PageContainer } from '@ant-design/pro-layout';
import { useRequest } from '@umijs/max';
import { Button, Modal, message } from 'antd';
import React, { useState } from 'react';

interface Report {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
  remark: string;
  createTime: string;
}

const ReportList: React.FC = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [viewModalVisible, setViewModalVisible] = useState<boolean>(false);
  const [_currentReport, setCurrentReport] = useState<Report | null>(null);

  // 模拟报表数据
  const {
    data: reports,
    loading,
    refresh,
  } = useRequest(() => {
    return new Promise<Report[]>((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: '1',
            name: '用户统计报表',
            code: 'user_statistics',
            type: '表格',
            status: '启用',
            remark: '用户统计数据报表',
            createTime: '2026-01-01 00:00:00',
          },
          {
            id: '2',
            name: '部门绩效报表',
            code: 'dept_performance',
            type: '图表',
            status: '启用',
            remark: '部门绩效数据报表',
            createTime: '2026-01-02 00:00:00',
          },
          {
            id: '3',
            name: '系统日志报表',
            code: 'system_log',
            type: '表格',
            status: '禁用',
            remark: '系统日志数据报表',
            createTime: '2026-01-03 00:00:00',
          },
          {
            id: '4',
            name: '操作统计报表',
            code: 'operation_statistics',
            type: '图表',
            status: '启用',
            remark: '操作统计数据报表',
            createTime: '2026-01-04 00:00:00',
          },
        ]);
      }, 500);
    });
  });

  const columns: ProColumns<Report>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '报表名称',
      dataIndex: 'name',
      key: 'name',
      search: true,
      width: 150,
    },
    {
      title: '报表编码',
      dataIndex: 'code',
      key: 'code',
      search: true,
      width: 150,
    },
    {
      title: '报表类型',
      dataIndex: 'type',
      key: 'type',
      filters: [
        { text: '表格', value: '表格' },
        { text: '图表', value: '图表' },
        { text: '混合', value: '混合' },
      ],
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
      width: 200,
      render: (_: any, record: Report) => (
        <>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => {
              setCurrentReport(record);
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
              setCurrentReport(record);
              setEditModalVisible(true);
            }}
            style={{ marginRight: 8 }}
          >
            编辑
          </Button>
          <Button
            type="text"
            icon={<DownloadOutlined />}
            onClick={() => {
              message.info('报表下载功能');
            }}
            style={{ marginRight: 8 }}
          >
            下载
          </Button>
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: '确认删除',
                content: `确定要删除报表 ${record.name} 吗？`,
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
      title="报表管理"
      subTitle="管理系统报表，包括添加、编辑、删除报表等操作"
      extra={[
        <Button
          key="add"
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
        >
          添加报表
        </Button>,
      ]}
    >
      <ProTable
        columns={columns}
        dataSource={reports}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        toolBarRender={false}
      />

      {/* 添加报表弹窗 */}
      <Modal
        title="添加报表"
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
          <p>添加报表表单</p>
        </div>
      </Modal>

      {/* 编辑报表弹窗 */}
      <Modal
        title="编辑报表"
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
          <p>编辑报表表单</p>
        </div>
      </Modal>

      {/* 查看报表弹窗 */}
      <Modal
        title="查看报表"
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={[
          <Button key="ok" onClick={() => setViewModalVisible(false)}>
            确定
          </Button>,
        ]}
        width={800}
      >
        <div style={{ padding: '24px' }}>
          <p>报表查看功能</p>
        </div>
      </Modal>
    </PageContainer>
  );
};

export default ReportList;
