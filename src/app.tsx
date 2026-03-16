import { LinkOutlined } from '@ant-design/icons';
import type { Settings as LayoutSettings } from '@ant-design/pro-components';
import { SettingDrawer } from '@ant-design/pro-components';
import type { RequestConfig, RunTimeLayoutConfig } from '@umijs/max';
import { history, Link } from '@umijs/max';
import React, { useState } from 'react';
import {
  AvatarDropdown,
  AvatarName,
  Footer,
  Question,
  SelectLang,
} from '@/components';
import { currentUser as queryCurrentUser } from '@/services/ant-design-pro/api';
import { dynamicRoutes } from '@/services/system/menu';
import defaultSettings from '../config/defaultSettings';
import Loading from './loading';
import { errorConfig } from './requestErrorConfig';

const isDev = process.env.NODE_ENV === 'development';
const isDevOrTest = isDev || process.env.CI;
const loginPath = '/user/login';

/**
 * @see https://umijs.org/docs/api/runtime-config#getinitialstate
 * */
export async function getInitialState(): Promise<{
  settings?: Partial<LayoutSettings>;
  currentUser?: API.CurrentUser;
  loading?: boolean;
  fetchUserInfo?: () => Promise<API.CurrentUser | undefined>;
}> {
  const fetchUserInfo = async () => {
    try {
      const msg = await queryCurrentUser({
        skipErrorHandler: true,
      });
      return msg.data;
    } catch (_error) {
      history.push(loginPath);
    }
    return undefined;
  };
  // 如果不是登录页面，执行
  const { location } = history;
  if (
    ![loginPath, '/user/register', '/user/register-result'].includes(
      location.pathname,
    )
  ) {
    const currentUser = await fetchUserInfo();
    return {
      fetchUserInfo,
      currentUser,
      settings: defaultSettings as Partial<LayoutSettings>,
    };
  }
  return {
    fetchUserInfo,
    settings: defaultSettings as Partial<LayoutSettings>,
  };
}

// ProLayout 支持的api https://procomponents.ant.design/components/layout
export const layout: RunTimeLayoutConfig = ({
  initialState,
  setInitialState,
}) => {
  // 菜单加载状态
  const [menuLoading, setMenuLoading] = useState(false);

  return {
    actionsRender: () => [
      <Question key="doc" />,
      <SelectLang key="SelectLang" />,
    ],
    avatarProps: {
      src: initialState?.currentUser?.avatar,
      title: <AvatarName />,
      render: (_, avatarChildren) => (
        <AvatarDropdown>{avatarChildren}</AvatarDropdown>
      ),
    },
    waterMarkProps: {
      content: initialState?.currentUser?.name,
    },
    footerRender: () => <Footer />,
    onPageChange: () => {
      const { location } = history;
      // 如果没有登录，重定向到 login
      if (!initialState?.currentUser && location.pathname !== loginPath) {
        history.push(loginPath);
      }
    },
    bgLayoutImgList: [
      {
        src: 'https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/D2LWSqNny4sAAAAAAAAAAAAAFl94AQBr',
        left: 85,
        bottom: 100,
        height: '303px',
      },
      {
        src: 'https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/C2TWRpJpiC0AAAAAAAAAAAAAFl94AQBr',
        bottom: -68,
        right: -45,
        height: '303px',
      },
      {
        src: 'https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/F6vSTbj8KpYAAAAAAAAAAAAAFl94AQBr',
        bottom: 0,
        left: 0,
        width: '331px',
      },
    ],
    links: isDevOrTest
      ? [
          <Link key="openapi" to="/umi/plugin/openapi" target="_blank">
            <LinkOutlined />
            <span>OpenAPI 文档</span>
          </Link>,
        ]
      : [],
    menuHeaderRender: undefined,
    // 自定义 403 页面
    unAccessible: (
      <div style={{ padding: '24px', textAlign: 'center' }}>无权限访问</div>
    ),
    // 增加一个 loading 的状态
    childrenRender: (children) => {
      if (menuLoading) return <Loading />;
      return (
        <>
          {children}
          {isDevOrTest && (
            <SettingDrawer
              disableUrlParams
              enableDarkTheme
              settings={initialState?.settings}
              onSettingChange={(settings) => {
                setInitialState((preInitialState) => ({
                  ...preInitialState,
                  settings,
                }));
              }}
            />
          )}
        </>
      );
    },
    // 动态菜单配置
    menu: {
      // 每当 initialState?.currentUser 发生修改时重新执行 request
      params: {
        userId: initialState?.currentUser?.userid,
      },
      // 从服务端直接请求菜单数据，性能最好的方法
      request: async (_params, defaultMenuData) => {
        try {
          // 开始加载
          setMenuLoading(true);

          // 从后端获取动态菜单数据
          const response = await dynamicRoutes();
          console.log('Raw menu response:', response);

          // 检查响应格式，确保返回正确的菜单数据结构
          if (response?.data && Array.isArray(response.data)) {
            // 处理菜单数据，确保每个路由对象都有正确的结构
            const processRoutes = (routes: any[]) => {
              if (!routes || !Array.isArray(routes)) {
                return [];
              }
              return routes
                .filter(
                  (route: any) =>
                    route && typeof route === 'object' && route.path,
                )
                .map((route: any) => {
                  const processedRoute: any = {
                    ...route,
                    // 确保 access 属性格式正确
                    access: route.access || undefined,
                    // 确保 icon 属性格式正确
                    icon: route.icon || undefined,
                    // 确保 name 属性格式正确
                    name: route.name || route.title || undefined,
                    // 确保 component 属性格式正确 - 使用通用组件包装器
                    component: route.component || './404',
                  };
                  // 确保 routes 属性是数组，递归处理子路由
                  if (route.routes && Array.isArray(route.routes)) {
                    processedRoute.routes = processRoutes(route.routes);
                  } else {
                    processedRoute.routes = [];
                  }
                  return processedRoute;
                });
            };

            const processedRoutes = processRoutes(response.data);
            console.log('Processed menu routes:', processedRoutes);

            // 将处理后的路由注册到 Umi
            // 注意：这里返回的只是菜单数据，不是实际的路由配置
            // 实际的路由匹配由 ProLayout 的 menu 配置处理
            return processedRoutes;
          }

          // 如果后端返回格式不符合预期，返回默认菜单数据
          return defaultMenuData || [];
        } catch (error) {
          console.error('获取菜单数据失败:', error);
          // 发生错误时返回默认菜单数据
          return defaultMenuData || [];
        } finally {
          // 结束加载
          setMenuLoading(false);
        }
      },
    },
    // 配置 ProLayout 使用动态路由
    route: {
      path: '/',
      routes: [],
    },
    ...initialState?.settings,
  };
};

/**
 * @name request 配置，可以配置错误处理
 * 它基于 axios 和 ahooks 的 useRequest 提供了一套统一的网络请求和错误处理方案。
 * @doc https://umijs.org/docs/max/request#配置
 */
export const request: RequestConfig = {
  baseURL: isDev ? '' : 'https://proapi.azurewebsites.net',
  ...errorConfig,
};
