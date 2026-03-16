import {
  AppstoreOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { Avatar, Button, List, Progress, Space, Tag } from 'antd';
import React, { useState } from 'react';

const Applications: React.FC = () => {
  const [applications, _setApplications] = useState<any[]>([
    {
      id: 1,
      name: 'Sword Admin',
      description: '企业级中后台管理系统',
      version: '2.0.0',
      status: 'running',
      progress: 100,
      icon: 'https://randomuser.me/api/portraits/men/1.jpg',
      tags: ['管理系统', '企业级', '中后台'],
      lastUpdate: '2026-01-28',
    },
    {
      id: 2,
      name: '数据可视化平台',
      description: '基于 Ant Design 的数据可视化解决方案',
      version: '1.5.0',
      status: 'running',
      progress: 100,
      icon: 'https://randomuser.me/api/portraits/women/2.jpg',
      tags: ['数据可视化', '图表', '分析'],
      lastUpdate: '2026-01-25',
    },
    {
      id: 3,
      name: '用户管理系统',
      description: '用户认证和权限管理系统',
      version: '1.2.0',
      status: 'running',
      progress: 100,
      icon: 'https://randomuser.me/api/portraits/men/3.jpg',
      tags: ['用户管理', '权限', '认证'],
      lastUpdate: '2026-01-20',
    },
    {
      id: 4,
      name: '系统监控平台',
      description: '服务器和应用监控系统',
      version: '1.0.0',
      status: 'installing',
      progress: 65,
      icon: 'https://randomuser.me/api/portraits/women/4.jpg',
      tags: ['监控', '服务器', '运维'],
      lastUpdate: '2026-01-29',
    },
  ]);

  const handleEdit = (id: number) => {
    console.log('Edit application:', id);
  };

  const handleDelete = (id: number) => {
    console.log('Delete application:', id);
  };

  const handleDownload = (id: number) => {
    console.log('Download application:', id);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'green';
      case 'installing':
        return 'blue';
      case 'stopped':
        return 'red';
      case 'error':
        return 'orange';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running':
        return '运行中';
      case 'installing':
        return '安装中';
      case 'stopped':
        return '已停止';
      case 'error':
        return '错误';
      default:
        return '未知';
    }
  };

  return (
    <List
      itemLayout="horizontal"
      dataSource={applications}
      renderItem={(app) => (
        <List.Item
          key={app.id}
          extra={
            <Space size="small">
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(app.id)}
              >
                编辑
              </Button>
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(app.id)}
              >
                删除
              </Button>
              <Button
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => handleDownload(app.id)}
              >
                下载
              </Button>
            </Space>
          }
        >
          <List.Item.Meta
            avatar={<Avatar src={app.icon} icon={<AppstoreOutlined />} />}
            title={
              <div>
                <h3 style={{ marginBottom: 8 }}>
                  {app.name}
                  <Tag
                    color={getStatusColor(app.status)}
                    style={{ marginLeft: 8 }}
                  >
                    {getStatusText(app.status)}
                  </Tag>
                </h3>
                <Space size="small">
                  {app.tags.map((tag: string) => (
                    <Tag key={tag} color="green">
                      {tag}
                    </Tag>
                  ))}
                </Space>
              </div>
            }
            description={
              <div>
                <p style={{ marginBottom: 8 }}>{app.description}</p>
                {app.status === 'installing' && (
                  <Progress
                    percent={app.progress}
                    size="small"
                    style={{ marginBottom: 8 }}
                  />
                )}
                <Space size="middle">
                  <span>版本: {app.version}</span>
                  <span>
                    <ClockCircleOutlined /> {app.lastUpdate}
                  </span>
                </Space>
              </div>
            }
          />
        </List.Item>
      )}
    />
  );
};

export default Applications;
