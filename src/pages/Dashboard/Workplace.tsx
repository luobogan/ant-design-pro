import {
  BellOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  HomeOutlined,
  MessageOutlined,
  PlusOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Col,
  List,
  Row,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import React, { useEffect, useState } from 'react';
import { history } from 'umi';

const { Title, Paragraph } = Typography;
const { Meta } = List;

const Workplace: React.FC = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});

  useEffect(() => {
    const mockTasks = [
      {
        id: 1,
        title: '完成用户认证模块迁移',
        status: 'pending',
        priority: 'high',
        dueDate: '2026-01-30',
      },
      {
        id: 2,
        title: '优化仪表盘性能',
        status: 'in_progress',
        priority: 'medium',
        dueDate: '2026-02-01',
      },
      {
        id: 3,
        title: '添加系统监控告警',
        status: 'pending',
        priority: 'low',
        dueDate: '2026-02-03',
      },
      {
        id: 4,
        title: '更新用户手册',
        status: 'completed',
        priority: 'low',
        dueDate: '2026-01-28',
      },
      {
        id: 5,
        title: '修复数据导出bug',
        status: 'pending',
        priority: 'high',
        dueDate: '2026-01-29',
      },
    ];

    const mockActivities = [
      {
        id: 1,
        user: '张三',
        action: '创建了新用户',
        time: '2小时前',
        avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
      },
      {
        id: 2,
        user: '李四',
        action: '更新了系统配置',
        time: '4小时前',
        avatar: 'https://randomuser.me/api/portraits/women/2.jpg',
      },
      {
        id: 3,
        user: '王五',
        action: '删除了过期数据',
        time: '6小时前',
        avatar: 'https://randomuser.me/api/portraits/men/3.jpg',
      },
      {
        id: 4,
        user: '赵六',
        action: '发布了新版本',
        time: '1天前',
        avatar: 'https://randomuser.me/api/portraits/women/4.jpg',
      },
    ];

    const mockNotifications = [
      {
        id: 1,
        title: '系统更新完成',
        content: '版本 2.0.0 已成功更新',
        time: '10分钟前',
        read: false,
      },
      {
        id: 2,
        title: '数据库备份',
        content: '每日数据库备份已完成',
        time: '1小时前',
        read: false,
      },
      {
        id: 3,
        title: '安全告警',
        content: '检测到异常登录尝试',
        time: '3小时前',
        read: true,
      },
    ];

    const mockStats = {
      tasks: 5,
      completedTasks: 1,
      pendingTasks: 3,
      inProgressTasks: 1,
      notifications: 3,
      unreadNotifications: 2,
    };

    setTasks(mockTasks);
    setActivities(mockActivities);
    setNotifications(mockNotifications);
    setStats(mockStats);
  }, []);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'red';
      case 'medium':
        return 'orange';
      case 'low':
        return 'blue';
      default:
        return 'default';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high':
        return '高';
      case 'medium':
        return '中';
      case 'low':
        return '低';
      default:
        return '未知';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'in_progress':
        return <ClockCircleOutlined style={{ color: '#1890ff' }} />;
      case 'pending':
        return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
      default:
        return <ExclamationCircleOutlined />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'in_progress':
        return '进行中';
      case 'pending':
        return '待处理';
      default:
        return '未知';
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          {
            href: '/',
            title: <HomeOutlined />,
          },
          {
            title: '工作台',
          },
        ]}
      />

      <div style={{ marginBottom: 24 }}>
        <Title level={2}>工作台</Title>
        <Paragraph type="secondary">欢迎回来，管理员</Paragraph>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总待办事项"
              value={stats.tasks}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成"
              value={stats.completedTasks}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              suffix={`/${stats.tasks}`}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="进行中"
              value={stats.inProgressTasks}
              prefix={<ClockCircleOutlined style={{ color: '#1890ff' }} />}
              suffix={`/${stats.tasks}`}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="未读通知"
              value={stats.unreadNotifications}
              prefix={<BellOutlined style={{ color: '#faad14' }} />}
              suffix={`/${stats.notifications}`}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card
            title="待办事项"
            extra={
              <Button type="primary" icon={<PlusOutlined />} size="small">
                新建任务
              </Button>
            }
          >
            <List
              itemLayout="horizontal"
              dataSource={tasks}
              renderItem={(task) => (
                <List.Item
                  actions={[
                    <Tag key="priority" color={getPriorityColor(task.priority)}>
                      {getPriorityText(task.priority)}
                    </Tag>,
                    <span key="dueDate">{task.dueDate}</span>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={getStatusIcon(task.status)}
                    title={
                      <div>
                        <span style={{ marginRight: 8 }}>{task.title}</span>
                        <Tag
                          color={
                            task.status === 'completed'
                              ? 'green'
                              : task.status === 'in_progress'
                                ? 'blue'
                                : 'orange'
                          }
                        >
                          {getStatusText(task.status)}
                        </Tag>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>

          <Card title="最近活动" style={{ marginTop: 16 }}>
            <List
              itemLayout="horizontal"
              dataSource={activities}
              renderItem={(activity) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar src={activity.avatar} />}
                    title={
                      <span>
                        <span style={{ fontWeight: 500 }}>{activity.user}</span>
                        <span style={{ margin: '0 8px' }}>·</span>
                        <span>{activity.action}</span>
                      </span>
                    }
                    description={activity.time}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col span={12}>
          <Card
            title="通知中心"
            extra={<Button size="small">全部标记为已读</Button>}
          >
            <List
              dataSource={notifications}
              renderItem={(notification) => (
                <List.Item
                  className={notification.read ? '' : 'bg-gray-50'}
                  actions={[<span key="time">{notification.time}</span>]}
                >
                  <Badge
                    status={notification.read ? 'default' : 'processing'}
                  />
                  <List.Item.Meta
                    title={
                      <span style={{ marginLeft: 8 }}>
                        {notification.title}
                      </span>
                    }
                    description={
                      <span style={{ marginLeft: 24 }}>
                        {notification.content}
                      </span>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>

          <Card title="快捷操作" style={{ marginTop: 16 }}>
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Card
                  hoverable
                  style={{ textAlign: 'center', padding: 16 }}
                  onClick={() => history.push('/system/user/list')}
                >
                  <UserOutlined
                    style={{ fontSize: 24, color: '#1890ff', marginBottom: 8 }}
                  />
                  <div>用户管理</div>
                </Card>
              </Col>
              <Col span={8}>
                <Card
                  hoverable
                  style={{ textAlign: 'center', padding: 16 }}
                  onClick={() => history.push('/authority/role/list')}
                >
                  <TeamOutlined
                    style={{ fontSize: 24, color: '#52c41a', marginBottom: 8 }}
                  />
                  <div>角色管理</div>
                </Card>
              </Col>
              <Col span={8}>
                <Card
                  hoverable
                  style={{ textAlign: 'center', padding: 16 }}
                  onClick={() => history.push('/system/menu/list')}
                >
                  <SettingOutlined
                    style={{ fontSize: 24, color: '#faad14', marginBottom: 8 }}
                  />
                  <div>菜单管理</div>
                </Card>
              </Col>
              <Col span={8}>
                <Card
                  hoverable
                  style={{ textAlign: 'center', padding: 16 }}
                  onClick={() => history.push('/monitor/log/list')}
                >
                  <FileTextOutlined
                    style={{ fontSize: 24, color: '#722ed1', marginBottom: 8 }}
                  />
                  <div>日志管理</div>
                </Card>
              </Col>
              <Col span={8}>
                <Card
                  hoverable
                  style={{ textAlign: 'center', padding: 16 }}
                  onClick={() => history.push('/dashboard/monitor')}
                >
                  <BellOutlined
                    style={{ fontSize: 24, color: '#ff4d4f', marginBottom: 8 }}
                  />
                  <div>系统监控</div>
                </Card>
              </Col>
              <Col span={8}>
                <Card
                  hoverable
                  style={{ textAlign: 'center', padding: 16 }}
                  onClick={() => history.push('/account/settings')}
                >
                  <MessageOutlined
                    style={{ fontSize: 24, color: '#13c2c2', marginBottom: 8 }}
                  />
                  <div>个人设置</div>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Workplace;
