import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { Button, Card, message, Tabs } from 'antd';
import React, { useState } from 'react';
import { Link } from 'umi';
import BaseView from './BaseView';
import NotificationView from './NotificationView';
import PasswordView from './PasswordView';

const Info: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('base');

  const handleTabChange = (key: string) => {
    setActiveTab(key);
  };

  const handleSave = () => {
    message.success('保存成功');
  };

  const tabsItems = [
    {
      key: 'base',
      label: '基础信息',
      children: <BaseView />,
    },
    {
      key: 'password',
      label: '密码设置',
      children: <PasswordView />,
    },
    {
      key: 'notification',
      label: '通知设置',
      children: <NotificationView />,
    },
  ];

  return (
    <PageContainer
      title="账户设置"
      subTitle="管理个人账户信息和安全设置"
      extra={[
        <Button key="back" icon={<ArrowLeftOutlined />}>
          <Link to="/account/center">返回个人中心</Link>
        </Button>,
        <Button
          key="save"
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
        >
          保存设置
        </Button>,
      ]}
    >
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

export default Info;
