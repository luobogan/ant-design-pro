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
import { clearFormData, getSavedFormData } from '@/requestErrorConfig';
import Crypto from '@/utils/crypto';
import { getQueryString, getTopUrl, pickPayload, validateNull } from '@/utils/utils';
import { dynamicButtons, dynamicRoutes } from '@/services/system/menu';
// 左侧 AI 流程引擎视觉图形（SVG + CSS 动画）
import AiFlowVisual from './components/AiFlowVisual';
import styles from './Login.less';

const { Title, Paragraph } = Typography;

/** 左侧能力标签 */
const BRAND_POINTS = ['智能节点推荐', '自动路由分流', '实时流程洞察', '多租户权限隔离'];

/** 品牌标记：六边形 + 流程链（与左侧视觉图形的「引擎核心」呼应） */
const BrandMark: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M12 2.6 20 7v10l-8 4.4L4 17V7z"
      stroke="#04121a"
      strokeWidth="1.6"
      strokeLinejoin="round"
      fill="rgba(4,18,26,0.25)"
    />
    <path
      d="M8 14.5h3V9.5h3V14.5h2"
      stroke="#04121a"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

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
        // 清除之前保存的表单数据（因为用户已经重新登录成功）
        const savedFormData = getSavedFormData();
        if (savedFormData) {
          message.info('检测到您有未完成的操作，登录后将自动恢复表单数据');
        }
        clearFormData();

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

          const routes: any[] = pickPayload(routesRes) || [];
          const buttons: any[] = pickPayload(buttonsRes) || [];

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
      <div className={styles.layout}>
        {/* 左：AI 流程引擎视觉区（≤1024px 收起，保证移动端只保留登录卡片） */}
        <aside className={styles.brand}>
          <div className={styles.brandTop}>
            <span className={styles.mark}>
              <BrandMark />
            </span>
            <span>
              <div className={styles.logoText}>流程引擎系统</div>
              <div className={styles.logoSub}>FLOW ENGINE · AI</div>
            </span>
          </div>

          <Title className={styles.brandTitle} level={1}>
            让每一条流程
            <br />
            都<em>自动流转</em>
          </Title>
          <Paragraph className={styles.brandDesc}>
            面向企业的 AI 流程中枢：可视化编排、智能审批路由与自动化执行，
            让审批、表单与业务数据在一条流水线上闭环。
          </Paragraph>

          <div className={styles.visualWrap}>
            <AiFlowVisual />
          </div>

          <ul className={styles.brandPoints}>
            {BRAND_POINTS.map((p) => (
              <li key={p}>
                <i />
                {p}
              </li>
            ))}
          </ul>
        </aside>

        {/* 右：登录卡片 */}
        <section className={styles.panel}>
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.mark}>
                <BrandMark />
              </span>
              <Title className={styles.cardTitle} level={3}>
                流程引擎系统
              </Title>
              <Paragraph className={styles.cardSub}>
                登录以进入流程设计与审批工作台
              </Paragraph>
            </div>

            <Form form={form} onFinish={handleSubmit} layout="vertical">
            {loginError && (
              <Alert
                style={{ marginBottom: 20 }}
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
                      {captchaImage && (
                        <img
                          alt="验证码"
                          src={captchaImage}
                          className={styles.captchaImg}
                          onClick={refreshCaptcha}
                          title="点击刷新验证码"
                        />
                      )}
                    </Spin>
                  </Col>
                </Row>
              </Form.Item>
            )}

            <div className={styles.extra}>
              <Checkbox
                checked={autoLogin}
                onChange={(e) => setAutoLogin(e.target.checked)}
              >
                记住我
              </Checkbox>
              <a className={styles.forgot} href="#">
                忘记密码？
              </a>
            </div>

            <Form.Item>
              <Button
                className={styles.submitBtn}
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={loginLoading}
              >
                登录
              </Button>
            </Form.Item>

            <div className={styles.divider}>其他登录方式</div>

            <div className={styles.socials}>
              <Button
                shape="circle"
                icon={<GithubOutlined />}
                onClick={() => handleSocialLogin('github')}
              />
              <Button
                shape="circle"
                icon={<GoogleOutlined />}
                onClick={() => handleSocialLogin('gitee')}
              />
              <Button
                shape="circle"
                icon={<WechatOutlined />}
                onClick={() => handleSocialLogin('wechat_open')}
              />
              <Button
                shape="circle"
                icon={<DingtalkOutlined />}
                onClick={() => handleSocialLogin('dingtalk')}
              />
              <Button
                shape="circle"
                icon={<AlipayOutlined />}
                onClick={() => handleSocialLogin('alipay')}
              />
              <Button
                shape="circle"
                icon={<TaobaoOutlined />}
                onClick={() => handleSocialLogin('taobao')}
              />
            </div>
            </Form>
            <div className={styles.footer}>© 2026 FLOW ENGINE · AI 流程引擎系统</div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Login;
