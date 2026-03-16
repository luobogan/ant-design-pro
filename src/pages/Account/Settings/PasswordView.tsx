import { LockOutlined } from '@ant-design/icons';
import { Button, Form, Input, message, Progress } from 'antd';
import React, { useState } from 'react';

const { Password } = Input;

const PasswordView: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  const [passwordStrength, setPasswordStrength] = useState<number>(0);

  const handleSubmit = async (_values: any) => {
    try {
      setLoading(true);
      // 模拟保存操作
      setTimeout(() => {
        message.success('密码修改成功');
        form.resetFields();
        setLoading(false);
      }, 1000);
    } catch (_error) {
      message.error('密码修改失败，请稍后重试');
      setLoading(false);
    }
  };

  const handleReset = () => {
    form.resetFields();
    setPasswordStrength(0);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const password = e.target.value;
    // 简单的密码强度计算
    let strength = 0;
    if (password.length >= 6) strength += 25;
    if (password.length >= 10) strength += 25;
    if (/[A-Z]/.test(password)) strength += 15;
    if (/[a-z]/.test(password)) strength += 15;
    if (/[0-9]/.test(password)) strength += 10;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength += 10;
    setPasswordStrength(strength);
  };

  const getPasswordStrengthText = (strength: number) => {
    if (strength < 25) return '弱';
    if (strength < 50) return '中等';
    if (strength < 75) return '强';
    return '非常强';
  };

  const getPasswordStrengthColor = (strength: number) => {
    if (strength < 25) return '#ff4d4f';
    if (strength < 50) return '#faad14';
    if (strength < 75) return '#1890ff';
    return '#52c41a';
  };

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit}>
      <Form.Item
        name="currentPassword"
        label="当前密码"
        rules={[
          {
            required: true,
            message: '请输入当前密码',
          },
        ]}
      >
        <Password prefix={<LockOutlined />} placeholder="请输入当前密码" />
      </Form.Item>

      <Form.Item
        name="newPassword"
        label="新密码"
        rules={[
          {
            required: true,
            message: '请输入新密码',
          },
          {
            min: 6,
            message: '密码长度至少为6个字符',
          },
        ]}
      >
        <Password
          prefix={<LockOutlined />}
          placeholder="请输入新密码"
          onChange={handlePasswordChange}
        />
      </Form.Item>

      {passwordStrength > 0 && (
        <div style={{ marginBottom: 24 }}>
          <Progress
            percent={passwordStrength}
            status="active"
            strokeColor={getPasswordStrengthColor(passwordStrength)}
            format={() => getPasswordStrengthText(passwordStrength)}
          />
        </div>
      )}

      <Form.Item
        name="confirmPassword"
        label="确认新密码"
        dependencies={['newPassword']}
        rules={[
          {
            required: true,
            message: '请确认新密码',
          },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('newPassword') === value) {
                return Promise.resolve();
              }
              return Promise.reject(new Error('两次输入的密码不一致'));
            },
          }),
        ]}
      >
        <Password prefix={<LockOutlined />} placeholder="请再次输入新密码" />
      </Form.Item>

      <div style={{ marginBottom: 24 }}>
        <h4>密码强度要求：</h4>
        <ul style={{ listStyle: 'disc', paddingLeft: 20 }}>
          <li>长度至少6个字符</li>
          <li>包含大小写字母</li>
          <li>包含数字</li>
          <li>包含特殊字符</li>
        </ul>
      </div>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          修改密码
        </Button>
        <Button style={{ marginLeft: 8 }} onClick={handleReset}>
          重置
        </Button>
      </Form.Item>
    </Form>
  );
};

export default PasswordView;
