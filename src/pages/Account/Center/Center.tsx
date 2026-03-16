import {
  BellOutlined,
  EditOutlined,
  MessageOutlined,
  SettingOutlined,
  StarOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { Avatar, Button, Card, Col, Row, Statistic, Tabs } from 'antd';
import React, { useState } from 'react';
import { Link, useLocation } from 'umi';
import Applications from './Applications';
import Articles from './Articles';
import Projects from './Projects';

const Center: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('articles');
  const _location = useLocation();

  const handleTabChange = (key: string) => {
    setActiveTab(key);
  };

  const userInfo = {
    name: '管理员',
    email: 'admin@sword.com',
    phone: '138****8888',
    avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
    role: '系统管理员',
    joinDate: '2026-01-01',
  };

  const stats = {
    articles: 12,
    applications: 8,
    projects: 5,
    followers: 24,
  };

  const tabsItems = [
    {
      key: 'articles',
      label: '我的文章',
      children: <Articles />,
    },
    {
      key: 'applications',
      label: '我的应用',
      children: <Applications />,
    },
    {
      key: 'projects',
      label: '我的项目',
      children: <Projects />,
    },
  ];

  return (
    <PageContainer
      title="个人中心"
      subTitle="查看和管理个人信息"
      extra={[
        <Button key="edit" type="primary" icon={<EditOutlined />}>
          编辑资料
        </Button>,
        <Button key="settings" icon={<SettingOutlined />}>
          <Link to="/account/settings">账户设置</Link>
        </Button>,
      ]}
    >
      <Card variant="outlined" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col span={8} style={{ textAlign: 'center' }}>
            <Avatar size={128} src={userInfo.avatar} icon={<UserOutlined />} />
            <h2 style={{ marginTop: 16 }}>{userInfo.name}</h2>
            <p style={{ color: '#666' }}>{userInfo.role}</p>
            <div style={{ marginTop: 16 }}>
              <Button
                type="default"
                size="small"
                icon={<MessageOutlined />}
                style={{ marginRight: 8 }}
              >
                消息
              </Button>
              <Button type="default" size="small" icon={<BellOutlined />}>
                通知
              </Button>
            </div>
          </Col>
          <Col span={16}>
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Statistic
                  title="文章"
                  value={stats.articles}
                  prefix={<StarOutlined />}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="应用"
                  value={stats.applications}
                  prefix={<TeamOutlined />}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="项目"
                  value={stats.projects}
                  prefix={<UserOutlined />}
                />
              </Col>
            </Row>
            <Card variant="outlined" style={{ marginTop: 16 }}>
              <h3>个人信息</h3>
              <Row gutter={[16, 8]} style={{ marginTop: 8 }}>
                <Col span={8}>
                  <strong>邮箱：</strong>
                  {userInfo.email}
                </Col>
                <Col span={8}>
                  <strong>电话：</strong>
                  {userInfo.phone}
                </Col>
                <Col span={8}>
                  <strong>加入时间：</strong>
                  {userInfo.joinDate}
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      </Card>

      <Card variant="outlined">
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={tabsItems}
        />
      </Card>
    </PageContainer>
  );
};

export default Center;
