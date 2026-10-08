import { Descriptions, Image, Progress, Tag } from 'antd';
import { useRequest } from '@umijs/max';
import React from 'react';
import * as userApi from '@/services/system/user';
import { PERSON_STATUS_TEXT } from '@/services/system/user';

interface User {
  id: string;
  account: string;
  name: string;
  realName: string;
  email: string;
  phone: string;
  roleName: string;
  deptName: string;
  postName?: string;
  status: number;
  createTime: string;
  /** P0：工号 */
  workCode?: string;
  /** P0：人员状态（0试用 1正式 2临时 3延期 4解聘 5退休） */
  personStatus?: number;
  /** P0：证件号 */
  certificateNum?: string;
  /** P1：直接上级 */
  managerId?: string | number;
  managerName?: string;
  /** P1：头像 */
  avatar?: string;
}

interface UserViewProps {
  user: User;
  onCancel: () => void;
}

/** 人员状态标签配色：在职态绿、离职/解聘/退休灰红 */
const personStatusColor = (status?: number) => {
  if (status === undefined || status === null) return 'default';
  return status === 4 || status === 5 ? 'red' : 'green';
};

const UserView: React.FC<UserViewProps> = ({ user }) => {
  const hasManager = Boolean(user.managerName) || Boolean(user.managerId && Number(user.managerId) > 0);

  // P2：自定义字段回显（对齐 ecology cus_fielddata）
  const { data: schemaRes } = useRequest(() => userApi.addFormSchema({}), {
    refreshDeps: [user?.id],
  });
  const formSchema = userApi.normalizeFormSchema(schemaRes);
  const { data: extRes } = useRequest(
    () => (user?.id ? userApi.extData({ userId: String(user.id) }) : Promise.resolve(null)),
    { refreshDeps: [user?.id] },
  );
  const extValues: Record<string, any> =
    (typeof extRes?.data === 'object' && extRes?.data) || (typeof extRes === 'object' && extRes) || {};

  // P3-3：信息完善度（对齐 ecology HrmInfoStatus）
  const { data: completeRes } = useRequest(
    () => (user?.id ? userApi.completeStatus({ userId: String(user.id) }) : Promise.resolve(null)),
    { refreshDeps: [user?.id] },
  );
  const completeMap: Record<string, number> =
    (typeof completeRes?.data === 'object' && completeRes?.data) ||
    (typeof completeRes === 'object' && completeRes) ||
    {};
  const completeItems = Object.keys(userApi.COMPLETE_STATUS_TEXT);
  const doneCount = completeItems.filter((k) => Number(completeMap[k]) === 1).length;
  const completePercent =
    completeItems.length === 0
      ? 0
      : Math.round((doneCount / completeItems.length) * 100);

  return (
    <div style={{ padding: '24px' }}>
      <Descriptions title="用户详情" bordered column={2}>
        <Descriptions.Item label="登录账号">{user.account}</Descriptions.Item>
        <Descriptions.Item label="用户昵称">{user.name}</Descriptions.Item>
        <Descriptions.Item label="用户姓名">{user.realName}</Descriptions.Item>
        <Descriptions.Item label="工号">{user.workCode || '-'}</Descriptions.Item>
        <Descriptions.Item label="人员状态">
          {user.personStatus === undefined || user.personStatus === null ? (
            '-'
          ) : (
            <Tag color={personStatusColor(user.personStatus)}>
              {PERSON_STATUS_TEXT[user.personStatus] || user.personStatus}
            </Tag>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="证件号">{user.certificateNum || '-'}</Descriptions.Item>
        <Descriptions.Item label="所属角色">
          <Tag color="blue">{user.roleName}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="所属部门">{user.deptName}</Descriptions.Item>
        <Descriptions.Item label="所属岗位">{user.postName || '-'}</Descriptions.Item>
        <Descriptions.Item label="直接上级">
          {hasManager ? user.managerName || `用户ID：${user.managerId}` : '无'}
        </Descriptions.Item>
        <Descriptions.Item label="状态">
          {user.status === 1 ? (
            <Tag color="green">启用</Tag>
          ) : (
            <Tag color="red">禁用</Tag>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="邮箱">{user.email}</Descriptions.Item>
        <Descriptions.Item label="手机号">{user.phone}</Descriptions.Item>
        <Descriptions.Item label="头像">
          {user.avatar ? <Image src={user.avatar} width={64} height={64} style={{ objectFit: 'cover' }} /> : '未上传'}
        </Descriptions.Item>
        <Descriptions.Item label="信息完善度" span={2}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Progress
              type="circle"
              size={56}
              percent={completePercent}
              format={() => `${doneCount}/${completeItems.length}`}
            />
            <div>
              {completeItems.map((key) => (
                <Tag
                  key={key}
                  color={Number(completeMap[key]) === 1 ? 'green' : 'default'}
                  style={{ marginBottom: 4 }}
                >
                  {userApi.COMPLETE_STATUS_TEXT[key]}
                  {Number(completeMap[key]) === 1 ? ' · 已完善' : ' · 待完善'}
                </Tag>
              ))}
            </div>
          </div>
        </Descriptions.Item>
        <Descriptions.Item label="创建时间" span={2}>
          {user.createTime}
        </Descriptions.Item>
        {formSchema
          .flatMap((group) => group.fields || [])
          .map((field) => (
            <Descriptions.Item key={field.fieldId} label={field.label}>
              {extValues[field.fieldId] || '-'}
            </Descriptions.Item>
          ))}
      </Descriptions>
    </div>
  );
};

export default UserView;
