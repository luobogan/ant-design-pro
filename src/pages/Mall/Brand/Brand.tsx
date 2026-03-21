import { PageContainer } from '@ant-design/pro-components';
import { Card, Empty } from 'antd';
import React from 'react';

/**
 * 品牌管理页面（占位）
 */
const BrandList: React.FC = () => {
  return (
    <PageContainer>
      <Card title="品牌管理">
        <Empty description="品牌管理页面开发中..." />
      </Card>
    </PageContainer>
  );
};

export default BrandList;
