import React from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Empty } from 'antd';

/**
 * 物流管理页面（占位）
 */
const LogisticsList: React.FC = () => {
  return (
    <PageContainer>
      <Card title="物流管理">
        <Empty description="物流管理页面开发中..." />
      </Card>
    </PageContainer>
  );
};

export default LogisticsList;
