import { PageContainer } from '@ant-design/pro-components';
import { Card, Empty } from 'antd';
import React from 'react';

/**
 * 商品分类管理页面（占位）
 */
const CategoryList: React.FC = () => {
  return (
    <PageContainer>
      <Card title="商品分类管理">
        <Empty description="商品分类管理页面开发中..." />
      </Card>
    </PageContainer>
  );
};

export default CategoryList;
