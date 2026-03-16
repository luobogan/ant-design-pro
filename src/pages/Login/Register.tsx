import {
  CodeOutlined,
  LockOutlined,
  MailOutlined,
  MobileOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  ProForm,
  ProFormCaptcha,
  ProFormPassword,
  ProFormSubmit,
  ProFormText,
} from '@ant-design/pro-components';
import { Alert, Checkbox, Link } from 'antd';
import React, { useState } from 'react';
import { history, useIntl } from 'umi';
import styles from './Login.less';

const Register: React.FC = () => {
  const [agreeTerms, setAgreeTerms] = useState<boolean>(false);
  const [registerError, setRegisterError] = useState<string>('');
  const _intl = useIntl();

  const handleSubmit = async (values: any) => {
    try {
      setRegisterError('');
      // 模拟注册请求
      console.log('Register submit:', values);

      // 模拟注册成功，跳转到注册结果页
      setTimeout(() => {
        history.push('/user/register-result');
      }, 1000);
    } catch (_error) {
      setRegisterError('注册失败，请稍后重试');
    }
  };

  const getCaptcha = async (mobile: string) => {
    // 模拟获取验证码
    console.log('Get captcha for:', mobile);
    return Promise.resolve();
  };

  return (
    <div className={styles.main}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Sword Admin</h1>
          <p>企业级中后台管理系统 - 注册</p>
        </div>
        <div className={styles.form}>
          <ProForm onFinish={handleSubmit} layout="vertical">
            {registerError && (
              <Alert
                style={{ marginBottom: 24 }}
                message={registerError}
                type="error"
                showIcon
              />
            )}

            <ProFormText
              name="tenantId"
              label="租户ID"
              placeholder="请输入租户ID"
              initialValue="000000"
              rules={[
                {
                  required: true,
                  message: '请输入租户ID',
                },
              ]}
              prefix={<UserOutlined />}
            />

            <ProFormText
              name="account"
              label="用户名"
              placeholder="请输入用户名"
              rules={[
                {
                  required: true,
                  message: '请输入用户名',
                },
                {
                  min: 4,
                  max: 20,
                  message: '用户名长度应在4-20个字符之间',
                },
              ]}
              prefix={<UserOutlined />}
            />

            <ProFormPassword
              name="password"
              label="密码"
              placeholder="请输入密码"
              rules={[
                {
                  required: true,
                  message: '请输入密码',
                },
                {
                  min: 6,
                  message: '密码长度至少为6个字符',
                },
              ]}
              prefix={<LockOutlined />}
            />

            <ProFormPassword
              name="confirmPassword"
              label="确认密码"
              placeholder="请再次输入密码"
              rules={[
                {
                  required: true,
                  message: '请确认密码',
                },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  },
                }),
              ]}
              prefix={<LockOutlined />}
            />

            <ProFormText
              name="mobile"
              label="手机号"
              placeholder="请输入手机号"
              rules={[
                {
                  required: true,
                  message: '请输入手机号',
                },
                {
                  pattern: /^1[3-9]\d{9}$/,
                  message: '请输入正确的手机号',
                },
              ]}
              prefix={<MobileOutlined />}
            />

            <ProFormCaptcha
              name="code"
              label="验证码"
              placeholder="请输入验证码"
              rules={[
                {
                  required: true,
                  message: '请输入验证码',
                },
              ]}
              prefix={<CodeOutlined />}
              getCaptcha={() => getCaptcha('13800138000')}
            />

            <ProFormText
              name="email"
              label="邮箱"
              placeholder="请输入邮箱"
              rules={[
                {
                  required: true,
                  message: '请输入邮箱',
                },
                {
                  type: 'email',
                  message: '请输入正确的邮箱地址',
                },
              ]}
              prefix={<MailOutlined />}
            />

            <div
              style={{
                marginBottom: 24,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Checkbox
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
              >
                我已阅读并同意
                <Link href="#">《用户协议》</Link>和
                <Link href="#">《隐私政策》</Link>
              </Checkbox>
            </div>

            <ProFormSubmit block size="large" disabled={!agreeTerms}>
              注册
            </ProFormSubmit>

            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <span>已有账号？</span>
              <Link href="/user/login" style={{ marginLeft: 8 }}>
                去登录
              </Link>
            </div>
          </ProForm>
        </div>
      </div>
    </div>
  );
};

export default Register;
