import { Descriptions, Tag } from 'antd';
import React from 'react';

interface User {
  id: string;
  account: string;
  name: string;
  realName: string;
  email: string;
  phone: string;
  roleName: string;
  deptName: string;
  status: number;
  createTime: string;
}

interface UserViewProps {
  user: User;
  onCancel: () => void;
}

const UserView: React.FC<UserViewProps> = ({ user }) => {
  return (
    <div style={{ padding: '24px' }}>
      <Descriptions title="用户详情" bordered column={2}>
        <Descriptions.Item label="登录账号">{user.account}</Descriptions.Item>
        <Descriptions.Item label="用户昵称">{user.name}</Descriptions.Item>
        <Descriptions.Item label="用户姓名">{user.realName}</Descriptions.Item>
        <Descriptions.Item label="所属角色">
          <Tag color="blue">{user.roleName}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="所属部门">{user.deptName}</Descriptions.Item>
        <Descriptions.Item label="状态">
          {user.status === 1 ? (
            <Tag color="green">启用</Tag>
          ) : (
            <Tag color="red">禁用</Tag>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="邮箱">{user.email}</Descriptions.Item>
        <Descriptions.Item label="手机号">{user.phone}</Descriptions.Item>
        <Descriptions.Item label="创建时间" span={2}>
          {user.createTime}
        </Descriptions.Item>
      </Descriptions>
    </div>
  );
};

export default UserView;
