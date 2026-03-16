import {
  CalendarOutlined,
  DeleteOutlined,
  EditOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Button, List, Progress, Space, Tag } from 'antd';
import React, { useState } from 'react';

const Projects: React.FC = () => {
  const [projects, _setProjects] = useState<any[]>([
    {
      id: 1,
      name: 'Sword Admin 重构',
      description: '将 Sword Admin 从 Ant Design Pro v4 重构到 v6',
      status: 'in_progress',
      progress: 75,
      members: 3,
      startDate: '2026-01-01',
      endDate: '2026-02-15',
      leader: '管理员',
      avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
      tags: ['前端', '重构', 'Ant Design'],
    },
    {
      id: 2,
      name: '数据可视化平台开发',
      description: '基于 Ant Design 的数据可视化解决方案',
      status: 'pending',
      progress: 0,
      members: 2,
      startDate: '2026-02-01',
      endDate: '2026-03-15',
      leader: '管理员',
      avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
      tags: ['前端', '数据可视化', '图表'],
    },
    {
      id: 3,
      name: 'API 网关升级',
      description: '升级 API 网关到最新版本，优化性能和安全性',
      status: 'completed',
      progress: 100,
      members: 2,
      startDate: '2025-12-01',
      endDate: '2025-12-31',
      leader: '管理员',
      avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
      tags: ['后端', 'API', '安全'],
    },
    {
      id: 4,
      name: '移动应用开发',
      description: '开发 Sword Admin 的移动应用版本',
      status: 'planning',
      progress: 25,
      members: 4,
      startDate: '2026-03-01',
      endDate: '2026-05-30',
      leader: '管理员',
      avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
      tags: ['移动开发', 'React Native', 'App'],
    },
  ]);

  const handleEdit = (id: number) => {
    console.log('Edit project:', id);
  };

  const handleDelete = (id: number) => {
    console.log('Delete project:', id);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'blue';
      case 'pending':
        return 'orange';
      case 'completed':
        return 'green';
      case 'planning':
        return 'purple';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'in_progress':
        return '进行中';
      case 'pending':
        return '待开始';
      case 'completed':
        return '已完成';
      case 'planning':
        return '规划中';
      default:
        return '未知';
    }
  };

  return (
    <List
      itemLayout="vertical"
      dataSource={projects}
      renderItem={(project) => (
        <List.Item
          key={project.id}
          extra={
            <Space size="small">
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(project.id)}
              >
                编辑
              </Button>
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(project.id)}
              >
                删除
              </Button>
            </Space>
          }
        >
          <List.Item.Meta
            avatar={<Avatar src={project.avatar} icon={<TeamOutlined />} />}
            title={
              <div>
                <h3 style={{ marginBottom: 8 }}>
                  {project.name}
                  <Tag
                    color={getStatusColor(project.status)}
                    style={{ marginLeft: 8 }}
                  >
                    {getStatusText(project.status)}
                  </Tag>
                </h3>
                <Space size="small">
                  {project.tags.map((tag: string, index: number) => (
                    <Tag key={index} color="purple">
                      {tag}
                    </Tag>
                  ))}
                </Space>
              </div>
            }
            description={
              <div>
                <p style={{ marginBottom: 8 }}>{project.description}</p>
                <Progress
                  percent={project.progress}
                  size="small"
                  style={{ marginBottom: 8 }}
                />
                <Space size="middle">
                  <span>
                    <TeamOutlined /> {project.members} 成员
                  </span>
                  <span>
                    <CalendarOutlined /> {project.startDate} 至{' '}
                    {project.endDate}
                  </span>
                  <span>
                    <UserOutlined /> {project.leader}
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

export default Projects;
