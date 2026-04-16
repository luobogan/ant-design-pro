import { history, useIntl } from '@umijs/max';
import { Button, Card, Result } from 'antd';
import React from 'react';
import { SafetyOutlined } from '@ant-design/icons';

const ForbiddenPage: React.FC = () => (
  <Card variant="borderless" style={{ minHeight: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
    <Result
      status="403"
      icon={<SafetyOutlined style={{ fontSize: '48px', color: '#ff4d4f' }} />}
      title="权限不足"
      subTitle="您没有访问该页面的权限，请联系管理员"
      extra={[
        <Button key="back" onClick={() => history.goBack()}>
          返回上一页
        </Button>,
        <Button key="home" type="primary" onClick={() => history.push('/')}>
          回到首页
        </Button>,
      ]}
    />
  </Card>
);

export default ForbiddenPage;