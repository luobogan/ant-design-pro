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
  TreeSelect,
} from 'antd';
import { useModel, useRequest } from '@umijs/max';
import moment from 'moment';
import React, { useState, useMemo, useEffect } from 'react';
import * as userApi from '@/services/system/user';
import * as tenantApi from '@/services/system/tenant';

interface UserAddProps {
  onOk: () => void;
  onCancel: () => void;
  roleTree?: any[];
  deptTree?: any[];
  positionList?: any[];
}

const UserAdd: React.FC<UserAddProps> = ({
  onOk,
  onCancel,
  roleTree = [],
  deptTree = [],
  positionList = [],
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);

  const { initialState } = useModel('@@initialState');

  let currentTenantId = '000000';
  if (initialState?.user?.tenantId) {
    currentTenantId = initialState.user.tenantId;
  } else if (initialState?.user?.tenant_id) {
    currentTenantId = initialState.user.tenant_id;
  } else {
    try {
      const userInfoStr = localStorage.getItem('sword-user-info');
      if (userInfoStr) {
        const userInfo = JSON.parse(userInfoStr);
        currentTenantId = userInfo.tenantId || userInfo.tenant_id || '000000';
      }
    } catch (e) {
      currentTenantId = '000000';
    }
  }

  const isSuperAdmin = currentTenantId === '000000';

  const { data: tenantData } = useRequest(() => tenantApi.list({}));

  const tenantOptions = useMemo(() => {
    const records = Array.isArray(tenantData)
      ? tenantData
      : tenantData?.records || tenantData?.data || [];
    return records.map((tenant: any) => ({
      label: tenant.tenantName || tenant.name || tenant.id,
      value: tenant.tenantId || tenant.id,
    }));
  }, [tenantData]);

  useEffect(() => {
    if (!isSuperAdmin && currentTenantId && currentTenantId !== '000000') {
      form.setFieldsValue({ tenantId: currentTenantId });
    }
  }, [form, isSuperAdmin, currentTenantId]);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const { confirmPassword, ...submitValues } = values;

      if (submitValues.birthday) {
        submitValues.birthday = moment(submitValues.birthday).format(
          'YYYY-MM-DD HH:mm:ss',
        );
      }

      if (Array.isArray(submitValues.roleId)) {
        submitValues.roleId = submitValues.roleId.join(',');
      }
      if (Array.isArray(submitValues.deptId)) {
        submitValues.deptId = submitValues.deptId.join(',');
      }
      if (Array.isArray(submitValues.positionId)) {
        submitValues.positionId = submitValues.positionId.join(',');
      }

      const filteredValues: any = {
        tenantId: submitValues.tenantId,
        account: submitValues.account,
        password: submitValues.password,
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

      await userApi.submit(filteredValues);
      message.success('添加成功');
      form.resetFields();
      onOk();
    } catch (_error) {
      message.error('添加失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const currentTenantLabel = tenantOptions.find(t => t.value === currentTenantId)?.label || currentTenantId;

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      style={{ padding: '24px' }}
    >
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
              {isSuperAdmin ? (
                <Select
                  placeholder="请选择所属租户"
                  options={tenantOptions}
                />
              ) : (
                <Input disabled value={currentTenantLabel} />
              )}
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="account"
              label="登录账号"
              rules={[{ required: true, message: '请输入登录账号' }]}
            >
              <Input placeholder="请输入登录账号" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="confirmPassword"
              label="确认密码"
              dependencies={['password']}
              rules={[
                { required: true, message: '请输入确认密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  },
                }),
              ]}
            >
              <Input.Password placeholder="请输入确认密码" />
            </Form.Item>
          </Col>
        </Row>
      </div>

      <Divider />

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

export default UserAdd;