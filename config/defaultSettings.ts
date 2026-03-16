import type { ProLayoutProps } from '@ant-design/pro-components';

/**
 * @name
 */
const Settings: ProLayoutProps & {
  pwa?: boolean;
  logo?: string;
  // 客户端认证配置
  clientId?: string;
  clientSecret?: string;
  // 租户模式
  tenantMode?: boolean;
  // 验证码模式
  captchaMode?: boolean;
  // SM2加密公钥
  auth?: {
    publicKey: string;
  };
  // 第三方登陆授权地址
  authUrl?: string;
  // 报表设计器地址
  reportUrl?: string;
} = {
  // 移除硬编码的 navTheme，允许 SettingDrawer 的设置生效
  // navTheme: 'light',
  // 拂晓蓝
  colorPrimary: '#1890ff',
  layout: 'mix',
  contentWidth: 'Fluid',
  fixedHeader: false,
  fixSiderbar: true,
  colorWeak: false,
  title: 'Ant Design Pro',
  pwa: true,
  logo: 'https://gw.alipayobjects.com/zos/rmsportal/KDpgvguMpGfqaHPjicRK.svg',
  iconfontUrl: '',
  token: {
    // 参见ts声明，demo 见文档，通过token 修改样式
    //https://procomponents.ant.design/components/layout#%E9%80%9A%E8%BF%87-token-%E4%BF%AE%E6%94%B9%E6%A0%B7%E5%BC%8F
  },
  // 客户端认证配置
  clientId: 'sword',
  clientSecret: 'sword_secret',
  // 租户模式
  tenantMode: true,
  // 验证码模式
  captchaMode: true,
  // SM2加密公钥配置
  auth: {
    // 使用后端工程 @org.springblade.test.Sm2KeyGenerator 获取
    publicKey:
      '049b9585c01891455719536d412e9e13c26a5977e68aaef99d8b78d2a7e1313aa2fd40fcf8ddd94d366109c23b186b27e7024108e392a45ad5fb55f3b361483dcf',
  },
  // 第三方登陆授权地址
  authUrl: 'http://localhost/blade-auth/oauth/render',
  // 报表设计器地址
  reportUrl: 'http://localhost:8108/ureport',
};

export default Settings;
