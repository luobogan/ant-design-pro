import React from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Empty } from 'antd';

/**
 * 会员等级管理页面（占位）
 */
const MemberLevelList: React.FC = () => {
  return (
    <PageContainer>
      <Card title="会员等级管理">
        <Empty description="会员等级管理页面开发中..." />
      </Card>
    </PageContainer>
  );
};

export default MemberLevelList;
