import React from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Empty } from 'antd';

/**
 * 商品表单页面（占位）
 */
const ProductForm: React.FC = () => {
  return (
    <PageContainer>
      <Card title="新增商品">
        <Empty description="商品表单页面开发中..." />
      </Card>
    </PageContainer>
  );
};

export default ProductForm;
