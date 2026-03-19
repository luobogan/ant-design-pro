import { CalendarOutlined } from '@ant-design/icons';
import {
  Button,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  message,
  Row,
  Select,
  Space,
  Switch,
  TreeSelect,
} from 'antd';
import moment from 'moment';
import React, { useEffect, useState } from 'react';
import * as userApi from '@/services/system/user';

interface User {
  id: string;
  account: string;
  name: string;
  realName: string;
  tenantId?: string;
  tenantName?: string;
  platform?: string;
  phone?: string;
  email?: string;
  sex?: number;
  birthday?: string;
  userCode?: string;
  roleId?: string;
  deptId?: string;
  positionId?: string;
  managerId?: string;
  isManager?: number;
  status?: number;
}

interface UserEditProps {
  user: User;
  onOk: () => void;
  onCancel: () => void;
  roleTree?: any[];
  deptTree?: any[];
  positionList?: any[];
}

const UserEdit: React.FC<UserEditProps> = ({
  user,
  onOk,
  onCancel,
  roleTree = [],
  deptTree = [],
  positionList = [],
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        tenantId: user.tenantId || '000000',
        account: user.account,
        name: user.name,
        realName: user.realName,
        phone: user.phone,
        email: user.email,
        sex: user.sex ?? 0,
        birthday: user.birthday ? moment(user.birthday) : null,
        // 将逗号分隔的字符串转为数组，用于 TreeSelect 回显
        roleId: user.roleId
          ? typeof user.roleId === 'string'
            ? user.roleId.split(',')
            : user.roleId
          : undefined,
        deptId: user.deptId
          ? typeof user.deptId === 'string'
            ? user.deptId.split(',')
            : user.deptId
          : undefined,
        positionId: user.positionId
          ? typeof user.positionId === 'string'
            ? user.positionId.split(',')
            : user.positionId
          : undefined,
      });
    }
  }, [user, form]);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const submitValues = { ...values };

      // 处理生日字段，转换为字符串格式
      if (submitValues.birthday) {
        submitValues.birthday = moment(submitValues.birthday).format('YYYY-MM-DD HH:mm:ss');
      }

      // 处理 TreeSelect 返回的数组，转换为逗号分隔的字符串
      if (Array.isArray(submitValues.roleId)) {
        submitValues.roleId = submitValues.roleId.join(',');
      }
      if (Array.isArray(submitValues.deptId)) {
        submitValues.deptId = submitValues.deptId.join(',');
      }
      if (Array.isArray(submitValues.positionId)) {
        submitValues.positionId = submitValues.positionId.join(',');
      }

      // 只保留后端 User 实体中存在的字段
      const filteredValues: any = {
        id: user.id,
        tenantId: submitValues.tenantId,
        account: submitValues.account,
        name: submitValues.name,
        realName: submitValues.realName,
        phone: submitValues.phone,
        email: submitValues.email,
        sex: submitValues.sex,
        birthday: submitValues.birthday,
        roleId: submitValues.roleId,
        deptId: submitValues.deptId,
        postId: submitValues.positionId,
      };

      await userApi.update(filteredValues);
      message.success('修改成功');
      onOk();
    } catch (_error) {
      message.error('修改失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      style={{ padding: '24px' }}
    >
      {/* 基础信息部分 */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>基础信息</h3>
        </div>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="tenantId"
              label="所属租户"
              rules={[{ required: true, message: '请选择所属租户' }]}
            >
              <Select
                placeholder="请选择所属租户"
                options={[
                  { label: '默认租户', value: '000000' },
                  { label: '租户 1', value: '000001' },
                  { label: '租户 2', value: '000002' },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="account"
              label="登录账号"
              rules={[{ required: true, message: '请输入登录账号' }]}
            >
              <Input disabled placeholder="登录账号不可修改" />
            </Form.Item>
          </Col>
        </Row>
      </div>

      <Divider />

      {/* 详细信息部分 */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>详细信息</h3>
        </div>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="name"
              label="用户昵称"
              rules={[{ required: true, message: '请输入用户昵称' }]}
            >
              <Input placeholder="请输入用户昵称" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="realName"
              label="用户姓名"
              rules={[{ required: true, message: '请输入用户姓名' }]}
            >
              <Input placeholder="请输入用户姓名" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="phone"
              label="手机号码"
              rules={[
                { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号码' },
              ]}
            >
              <Input placeholder="请输入手机号码" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="email"
              label="电子邮箱"
              rules={[{ type: 'email', message: '请输入正确的电子邮箱' }]}
            >
              <Input placeholder="请输入电子邮箱" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="sex" label="用户性别">
              <Select
                placeholder="请选择用户性别"
                options={[
                  { label: '男', value: 1 },
                  { label: '女', value: 2 },
                  { label: '未知', value: 0 },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="birthday" label="用户生日">
              <DatePicker
                placeholder="请选择用户生日"
                style={{ width: '100%' }}
                suffixIcon={<CalendarOutlined />}
              />
            </Form.Item>
          </Col>
        </Row>
      </div>

      <Divider />

      {/* 职责信息部分 */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>职责信息</h3>
        </div>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="roleId"
              label="所属角色"
              rules={[{ required: true, message: '请选择所属角色' }]}
            >
              <TreeSelect
                treeData={roleTree}
                placeholder="请选择所属角色"
                treeCheckable
                showCheckedStrategy={TreeSelect.SHOW_CHILD}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="deptId"
              label="所属部门"
              rules={[{ required: true, message: '请选择所属部门' }]}
            >
              <TreeSelect
                treeData={deptTree}
                placeholder="请选择所属部门"
                treeCheckable
                showCheckedStrategy={TreeSelect.SHOW_CHILD}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="positionId"
              label="所属岗位"
              rules={[{ required: true, message: '请选择所属岗位' }]}
            >
              <TreeSelect
                treeData={positionList.map((p: any) => ({
                  title: p.positionName || p.name,
                  value: p.id,
                  key: p.id,
                }))}
                placeholder="请选择所属岗位"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
        </Row>
      </div>

      <Form.Item style={{ textAlign: 'right', marginTop: 32 }}>
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            确定
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default UserEdit;
