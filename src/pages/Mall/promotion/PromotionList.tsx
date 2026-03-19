import React from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Empty } from 'antd';

/**
 * 促销管理页面（占位）
 */
const PromotionList: React.FC = () => {
  return (
    <PageContainer>
      <Card title="促销管理">
        <Empty description="促销管理页面开发中..." />
      </Card>
    </PageContainer>
  );
};

export default PromotionList;
