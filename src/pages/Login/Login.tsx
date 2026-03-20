import {
  AlipayOutlined,
  CodeOutlined,
  DingtalkOutlined,
  GithubOutlined,
  GoogleOutlined,
  LockOutlined,
  TaobaoOutlined,
  UserOutlined,
  WechatOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Checkbox,
  Col,
  Form,
  Input,
  message,
  Row,
  Spin,
  Typography,
} from 'antd';
import React, { useEffect, useState } from 'react';
import { getBasicAuth, isCaptchaEnabled } from '@/utils/auth';
import {
  setAccessToken,
  setButtons,
  setRoutes,
  setToken,
  setUserInfo,
} from '@/utils/authority';
import Crypto from '@/utils/crypto';
import { getQueryString, getTopUrl, validateNull } from '@/utils/utils';
import { dynamicButtons, dynamicRoutes } from '@/services/system/menu';
import styles from './Login.less';

const { Title, Paragraph } = Typography;

interface CaptchaResponse {
  code: number;
  data: {
    key: string;
    image: string;
  };
  msg: string;
}

interface LoginResponse {
  code: number;
  data: {
    accessToken: string;
    tokenType: string;
    refreshToken: string;
    userId: number;
    tenantId: string;
    oauthId: string;
    avatar: string;
    authority: string;
    userName: string;
    account: string;
    expiresIn: number;
    license: string;
  };
  msg: string;
}

const Login: React.FC = () => {
  const [autoLogin, setAutoLogin] = useState<boolean>(true);
  const [loginError, setLoginError] = useState<string>('');
  const [captchaImage, setCaptchaImage] = useState<string>('');
  const [captchaKey, setCaptchaKey] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [form] = Form.useForm();

  const fetchCaptcha = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/blade-auth/captcha', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: getBasicAuth(),
        },
      });

      if (response.ok) {
        const data: CaptchaResponse = await response.json();
        if (data.code === 200 && data.data && data.data.image) {
          setCaptchaImage(data.data.image);
          setCaptchaKey(data.data.key);
        } else {
          setCaptchaImage(
            'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
          );
        }
      } else {
        setCaptchaImage(
          'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        );
      }
    } catch (error) {
      console.error('获取验证码失败:', error);
      setCaptchaImage(
        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const domain = getTopUrl();
    const redirectUrl = '/oauth/redirect/';

    let source = getQueryString('source');
    const code = getQueryString('code');
    const state = getQueryString('state');

    if (validateNull(source) && domain.includes(redirectUrl)) {
      source = domain.split('?')[0];
      source = source.split(redirectUrl)[1];
    }

    if (!validateNull(source) && !validateNull(code) && !validateNull(state)) {
      console.log('Social login:', { source, code, state });
    }

    // form.setFieldsValue({ tenantId: '000000', account: 'admin', password: 'admin' });

    // 只有在启用验证码时才获取验证码
    if (isCaptchaEnabled()) {
      fetchCaptcha();
    }
  }, []);

  const handleSubmit = async (values: any) => {
    setLoginError('');
    setLoginLoading(true);

    try {
      console.log('Login submit:', values);
      console.log('BASIC_AUTH:', getBasicAuth());
      // 加密密码，使用SM2算法
      const encryptedPassword = Crypto.encryptPassword(values.password);
      console.log('Original password:', values.password);
      console.log('Encrypted password:', encryptedPassword);
      console.log('SM2 public key:', Crypto.publicKey);

      // 构建请求体
      const formData = new URLSearchParams();
      // 根据验证码模式决定 grant_type
      const grantType = isCaptchaEnabled() ? 'captcha' : 'password';
      formData.append('grantType', grantType);
      formData.append('tenantId', values.tenantId || '000000');
      formData.append('account', values.account);
      formData.append('password', encryptedPassword);
      formData.append('scope', 'all');
      // 验证码参数（如果启用了验证码）
      if (isCaptchaEnabled() && captchaKey && values.code) {
        formData.append('key', captchaKey);
        formData.append('code', values.code);
        console.log('Captcha key:', captchaKey);
        console.log('Captcha code:', values.code);
      }

      const formDataString = formData.toString();
      console.log('Form data:', formDataString);

      // 构建完整的请求配置
      const requestConfig: {
        method: string;
        headers: Record<string, string>;
        body: string;
      } = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: getBasicAuth(),
        },
        body: formDataString,
      };

      // 如果启用验证码，添加验证码相关的 headers
      if (isCaptchaEnabled()) {
        if (captchaKey) {
          requestConfig.headers['Captcha-Key'] = captchaKey;
        }
        if (values.code) {
          requestConfig.headers['Captcha-Code'] = values.code;
        }
      }

      console.log('Request config:', requestConfig);

      const response = await fetch('/api/blade-auth/token', requestConfig);
      console.log('Response status:', response.status);
      console.log(
        'Response headers:',
        Object.fromEntries(response.headers.entries()),
      );

      // 检查HTTP状态码
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log('Error response data:', errorData);
        setLoginError(
          errorData.msg || `登录失败，服务器错误 (${response.status})`,
        );
        fetchCaptcha();
        return;
      }

      const data: LoginResponse = await response.json();
      console.log('Response data:', data);

      if (data.code === 200 && data.data && data.data.accessToken) {
        // 设置token到localStorage
        setToken(data.data.accessToken);
        setAccessToken(data.data.accessToken);

        console.log('Token已保存到localStorage:', {
          'sword-token': localStorage.getItem('sword-token'),
          'sword-access-token': localStorage.getItem('sword-access-token'),
        });

        // 从登录响应中提取用户信息
        const userInfo = {
          id: data.data.userId?.toString() || '1',
          name: data.data.userName || '管理员',
          account: data.data.account || values.account,
          tenantId: data.data.tenantId || values.tenantId || '000000',
          avatar: data.data.avatar,
          authority: data.data.authority,
        };

        // 获取路由和按钮权限
        try {
          const [routesRes, buttonsRes] = await Promise.all([
            dynamicRoutes(),
            dynamicButtons(),
          ]);

          console.log('获取到的路由权限:', routesRes);
          console.log('获取到的按钮权限:', buttonsRes);

          const routes: any[] = routesRes?.data || [];
          const buttons: any[] = buttonsRes?.data || [];

          // 设置用户信息、路由权限和按钮权限
          setUserInfo(userInfo);
          setRoutes(routes);
          setButtons(buttons);

          console.log('权限设置完成:', {
            routesCount: routes.length,
            buttonsCount: buttons.length,
          });
        } catch (error) {
          console.error('获取权限失败:', error);
          // 如果获取权限失败，至少设置用户信息
          setUserInfo(userInfo);
        }

        message.success('登录成功');
        console.log('准备跳转到 /dashboard/workplace');
        // 使用 window.location.href 强制刷新页面,触发 getInitialState 重新加载用户信息
        window.location.href = '/dashboard/workplace';
      } else {
        setLoginError(data.msg || '登录失败,请检查您的凭据');
        fetchCaptcha();
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('登录失败，请检查网络连接或服务状态');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSocialLogin = (source: string) => {
    console.log('Social login click:', source);
  };

  const refreshCaptcha = () => {
    fetchCaptcha();
  };

  return (
    <div className={styles.main}>
      <div className={styles.container}>
        <div className={styles.header}>
          <Title level={1}>Sword Admin</Title>
          <Paragraph type="secondary">企业级中后台管理系统</Paragraph>
        </div>
        <div className={styles.form}>
          <Form form={form} onFinish={handleSubmit} layout="vertical">
            {loginError && (
              <Alert
                style={{ marginBottom: 24 }}
                message={loginError}
                type="error"
                showIcon
              />
            )}

            <Form.Item
              name="tenantId"
              label="租户ID"
              rules={[
                {
                  required: true,
                  message: '请输入租户ID',
                },
              ]}
            >
              <Input placeholder="租户ID: 000000" prefix={<UserOutlined />} />
            </Form.Item>

            <Form.Item
              name="account"
              label="用户名"
              rules={[
                {
                  required: true,
                  message: '请输入用户名',
                },
              ]}
            >
              <Input
                placeholder="用户名: admin"
                prefix={<UserOutlined />}
                autoComplete="username"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="密码"
              rules={[
                {
                  required: true,
                  message: '请输入密码',
                },
              ]}
            >
              <Input.Password
                placeholder="密码: admin"
                prefix={<LockOutlined />}
                autoComplete="current-password"
              />
            </Form.Item>

            {isCaptchaEnabled() && (
              <Form.Item
                name="code"
                label="验证码"
                rules={[
                  {
                    required: true,
                    message: '请输入验证码',
                  },
                ]}
              >
                <Row gutter={8}>
                  <Col span={16}>
                    <Input
                      placeholder="请输入验证码"
                      prefix={<CodeOutlined />}
                    />
                  </Col>
                  <Col span={8}>
                    <Spin spinning={loading}>
                      <img
                        alt="验证码"
                        src={captchaImage}
                        style={{
                          width: '100%',
                          height: 32,
                          cursor: 'pointer',
                          border: '1px solid #d9d9d9',
                          borderRadius: '4px',
                        }}
                        onClick={refreshCaptcha}
                        title="点击刷新验证码"
                      />
                    </Spin>
                  </Col>
                </Row>
              </Form.Item>
            )}

            <div
              style={{
                marginBottom: 24,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Checkbox
                checked={autoLogin}
                onChange={(e) => setAutoLogin(e.target.checked)}
              >
                记住我
              </Checkbox>
              <a href="#">忘记密码？</a>
            </div>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={loginLoading}
                style={{ marginBottom: 24 }}
              >
                登录
              </Button>
            </Form.Item>

            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <span>其他登录方式：</span>
            </div>

            <Row gutter={24} justify="center">
              <Col span={4}>
                <Button
                  shape="circle"
                  icon={<GithubOutlined />}
                  onClick={() => handleSocialLogin('github')}
                />
              </Col>
              <Col span={4}>
                <Button
                  shape="circle"
                  icon={<GoogleOutlined />}
                  onClick={() => handleSocialLogin('gitee')}
                />
              </Col>
              <Col span={4}>
                <Button
                  shape="circle"
                  icon={<WechatOutlined />}
                  onClick={() => handleSocialLogin('wechat_open')}
                />
              </Col>
              <Col span={4}>
                <Button
                  shape="circle"
                  icon={<DingtalkOutlined />}
                  onClick={() => handleSocialLogin('dingtalk')}
                />
              </Col>
              <Col span={4}>
                <Button
                  shape="circle"
                  icon={<AlipayOutlined />}
                  onClick={() => handleSocialLogin('alipay')}
                />
              </Col>
              <Col span={4}>
                <Button
                  shape="circle"
                  icon={<TaobaoOutlined />}
                  onClick={() => handleSocialLogin('taobao')}
                />
              </Col>
            </Row>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default Login;
