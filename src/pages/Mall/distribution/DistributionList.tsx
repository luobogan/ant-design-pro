import { PageContainer } from '@ant-design/pro-components';
import { Card, Empty } from 'antd';
import React from 'react';

/**
 * 铺货管理页面（占位）
 */
const DistributionList: React.FC = () => {
  return (
    <PageContainer>
      <Card title="铺货管理">
        <Empty description="铺货管理页面开发中..." />
      </Card>
    </PageContainer>
  );
};

export default DistributionList;
