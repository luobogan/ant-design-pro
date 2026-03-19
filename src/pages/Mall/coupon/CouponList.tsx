import React from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Empty } from 'antd';

/**
 * 优惠券管理页面（占位）
 */
const CouponList: React.FC = () => {
  return (
    <PageContainer>
      <Card title="优惠券管理">
        <Empty description="优惠券管理页面开发中..." />
      </Card>
    </PageContainer>
  );
};

export default CouponList;
