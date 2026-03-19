import React from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Empty } from 'antd';

/**
 * 会员权益管理页面（占位）
 */
const MemberBenefitList: React.FC = () => {
  return (
    <PageContainer>
      <Card title="会员权益管理">
        <Empty description="会员权益管理页面开发中..." />
      </Card>
    </PageContainer>
  );
};

export default MemberBenefitList;
