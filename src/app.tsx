import { LinkOutlined, SettingOutlined, UserOutlined, ToolOutlined, ApiOutlined, DashboardOutlined, DesktopOutlined, TeamOutlined, FileTextOutlined, DatabaseOutlined, Icon } from '@ant-design/icons';
import * as icons from '@ant-design/icons';
import type { Settings as LayoutSettings, MenuDataItem } from '@ant-design/pro-components';
import { SettingDrawer } from '@ant-design/pro-components';
import type { RequestConfig, RunTimeLayoutConfig } from '@umijs/max';
import { history, Link, Navigate } from '@umijs/max';
import { Spin } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import React from 'react';
import { stringify } from 'qs';

import {
  AvatarDropdown,
  DocLink,
  ErrorBoundary,
  Footer,
  LangDropdown,
  OfflineBanner,
  VersionDropdown,
} from '@/components';
import { currentUser as queryCurrentUser } from '@/services/ant-design-pro/api';
import defaultSettings from '../config/defaultSettings';
import { errorConfig, getSavedFormData } from '@/requestErrorConfig';
import { dynamicRoutes, dynamicButtons } from '@/services/system/menu';
import { setButtons, getButtons } from '@/utils/authority';
import Func from '@/utils/Func';
import { formatRoutes } from '@/utils/utils';

dayjs.extend(relativeTime);

const isDev = process.env.NODE_ENV === 'development';
const isDevOrTest = isDev || process.env.CI;
const loginPath = '/user/login';

interface MenuItem {
  url: string;
  menuName: string;
  icon: string;
  menuID: number | string;
  page?: string;
  children?: MenuItem[];
  category?: number;
  isComponent?: number;
  path?: string;
  name?: string;
  id?: number | string;
}
interface RouteItem {
  path?: string;
  name?: string;
  icon?: string;
  id?: number | string;
  parentId?: number | string;
  element?: JSX.Element;
  children?: RouteItem[];
}

let extraRoutes: any[] = [];


export function patchClientRoutes({ routes }: { routes: any }) {
  const routerIndex = routes.findIndex((item: RouteItem) => item.path === '/');
  const parentId = routes[routerIndex].id;
  if (extraRoutes) {
    Object.assign(routes[routerIndex], { routes: [] }, { children: [] });
    const x = loopMenuItem(extraRoutes, parentId);
    routes[routerIndex].routes.push(...x);
    routes[routerIndex].children.push(...x);
    console.log(`test:  ${routes}`);
  }
}

const toPascalCase = (str: string): string => {
  if (!str) return '';

  // 定义常见的单词列表，用于智能分割
  const commonWords = ['Form', 'Mode', 'Manage', 'Data', 'View', 'Field', 'Edit', 'Add', 'List', 'Detail', 'System', 'Mall', 'Product', 'Category', 'User', 'Role', 'Menu', 'Exception', 'Table', 'Design'];

  let result = str.toLowerCase();

  // 尝试匹配常见单词并确保它们的首字母大写
  commonWords.forEach(word => {
    const lowercaseWord = word.toLowerCase();
    // 匹配小写形式并替换为大写形式
    result = result.replace(new RegExp(lowercaseWord, 'g'), word);
  });

  // 确保第一个字符大写
  return result.charAt(0).toUpperCase() + result.slice(1);
};

const loopMenuItem = (menus: MenuItem[], pId: number | string): RouteItem[] => {
  return menus.flatMap((item) => {
    let Component: React.ComponentType<any> | null = null;
    const buttonRoutes: RouteItem[] = [];

    if (item.path) {
      const formattedPath = Func.formatRoutePath(item.path);
      const pathParts = formattedPath.split('/').filter(Boolean);

      if (pathParts.length >= 2) {
          const [module, page] = [toPascalCase(pathParts[0]), toPascalCase(pathParts[pathParts.length - 1])];

        const buttonsData = getButtons();
        console.log('从 localStorage 获取按钮数据:', buttonsData);

        const findButtonItems = (list: any[], targetId: string): any[] => {
          const results: any[] = [];
          for (const btn of list) {
            if (btn.children) {
              const matched = btn.children.filter((child: any) => child.parentId === targetId);
              if (matched.length > 0) results.push({ ...btn, children: matched });
              results.push(...findButtonItems(btn.children, targetId));
            }
          }
          return results;
        };
        const relatedButtons = findButtonItems(buttonsData, item.id);
        console.log(`与菜单 ${item.name} (id: ${item.id}) 关联的按钮：`, relatedButtons);

        const componentButtons: any[] = [];
        relatedButtons.forEach((button) => {
          button.children?.forEach((item1: any) => {
            if (item1.category === 2 && item1.isComponent === 1 && item1.path) {
              componentButtons.push(item1);
            }
          });
        });

        componentButtons.forEach((item1) => {
              const formattedPath1 = Func.formatRoutePath(item1.path);
              const pathParts1 = formattedPath1.split('/').filter(Boolean);
              const lastSegment = pathParts1[pathParts1.length - 1];
              const componentName = `${toPascalCase(page)}${toPascalCase(lastSegment)}`;
              console.log(`按钮组件路径：./pages/${module}/${page}/${componentName}.tsx`);

              const ButtonComponent = React.lazy(
                () =>
                  new Promise((resolve, _reject) => {
                    import(`./pages/${module}/${page}/${componentName}.tsx`)
                      .then((mod) => resolve(mod))
                      .catch((error) => {
                        console.error('组件导入错误:', error);
                        import('./pages/exception/404').then((mod) => resolve(mod));
                      });
                  }),
              );

              buttonRoutes.push({
                path: item1.path,
                name: item1.name,
                id: item1.id,
                parentId: item1.parentId,
                element: (
                  <React.Suspense
                    fallback={
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: '400px',
                          padding: '20px',
                          textAlign: 'center',
                        }}
                      >
                        <div style={{ marginBottom: '16px' }}>
                          <Spin size="large" description="加载中..." />
                        </div>
                        <p style={{ fontSize: '14px', color: '#666', marginTop: '16px' }}>
                          正在加载页面，请稍候...
                        </p>
                      </div>
                    }
                  >
                    <ButtonComponent />
                  </React.Suspense>
                ),
              });
        });

        const pageComponentName = toPascalCase(page);
        const componentPath = `./pages/${module}/${page}/${pageComponentName}.tsx`;
        console.log(`组件路径：${componentPath}`);

        Component = React.lazy(
          () =>
            new Promise((resolve, _reject) => {
              import(`./pages/${module}/${page}/${pageComponentName}.tsx`)
                .then((mod) => resolve(mod))
                .catch((error) => {
                  console.error('组件导入错误:', error);
                  import('./pages/exception/404').then((mod) => resolve(mod));
                });
            }),
        );
      }
    }

    if (item.children) {
      console.log(item.children[0]);
      return [
        {
          path: item.path,
          name: item.name,
          icon: item.icon,
          id: item.id,
          parentId: pId,
          children: [
            {
              path: item.path,
              element: <Navigate to={item.children[0].path} replace />,
            },
            ...loopMenuItem(item.children, item.id),
          ],
        },
      ];
    } else {
      return [
        {
          path: item.path,
          name: item.name,
          icon: item.icon,
          id: item.id,
          parentId: pId,
          element: (
            <React.Suspense
              fallback={
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '400px',
                    padding: '20px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ marginBottom: '16px' }}>
                    <Spin size="large" description="加载中..." />
                  </div>
                  <p
                    style={{
                      fontSize: '14px',
                      color: '#666',
                      marginTop: '16px',
                    }}
                  >
                    正在加载页面，请稍候...
                  </p>
                </div>
              }
            >
              {Component && <Component />}
            </React.Suspense>
          ),
        },
        ...buttonRoutes,
      ];
    }
  });
};

export function render(oldRender: () => void) {
  setTimeout(async () => {
    try {
      const menuData = await dynamicRoutes();
      extraRoutes = formatRoutes(menuData.data);
      const urlParams = new URL(window.location.href).searchParams;
      const redirect = urlParams.get('redirect');
      if (redirect) {
        history.push(redirect);
      }
      oldRender();
    } catch (_e) {
      const { search, pathname } = window.location;
      const urlParams = new URL(window.location.href).searchParams;
      const redirect = urlParams.get('redirect');
      if (window.location.pathname !== loginPath && !redirect) {
        history.replace({
          pathname: loginPath,
          search: stringify({
            redirect: pathname + search,
          }),
        });
      } else {
        history.push(loginPath + window.location.search);
      }
      oldRender();
    }
  }, 500);
}

export async function getInitialState(): Promise<{
  settings?: Partial<LayoutSettings>;
  currentUser?: API.CurrentUser;
  buttons?: any[];
  loading?: boolean;
  fetchUserInfo?: () => Promise<API.CurrentUser | undefined>;
}> {
  const fetchUserInfo = async () => {
    try {
      const res = await queryCurrentUser();
      console.log('用户信息响应:', res);
      return res.data;
    } catch (_error) {
      console.error('获取用户信息失败:', _error);
      history.push(loginPath);
    }
    return undefined;
  };

  const fetchButtons = async () => {
    try {
      const response = await dynamicButtons();
      console.log('按钮权限 API 响应:', response);
      const buttonsData = response.data || [];

      setButtons(buttonsData);
      console.log('按钮权限已加载:', buttonsData);
      console.log('按钮权限存储到 localStorage:', JSON.stringify(buttonsData));

      return buttonsData;
    } catch (error) {
      console.error('获取按钮权限失败:', error);
      return [];
    }
  };

  const { location } = history;

  const savedFormData = getSavedFormData();
  if (savedFormData) {
    console.log('检测到保存的表单数据:', savedFormData);
  }

  if (location.pathname !== loginPath) {
    const [currentUser, buttons] = await Promise.all([
      fetchUserInfo(),
      fetchButtons(),
    ]);
    return {
      fetchUserInfo,
      currentUser,
      buttons,
      settings: defaultSettings as Partial<LayoutSettings>,
    };
  }
  return {
    fetchUserInfo,
    settings: defaultSettings as Partial<LayoutSettings>,
  };
}

const loopMenuItem1 = (menus: MenuDataItem[]): MenuDataItem[] =>
  menus.map(({ icon, routes, ...item }) => ({
    ...item,
    icon: icon && icons[icon as keyof typeof icons] ? React.createElement(icons[icon as keyof typeof icons]) : undefined,
    routes: routes && loopMenuItem1(routes),
  }));

export const layout: RunTimeLayoutConfig = ({
  initialState,
  setInitialState,
}) => {
  console.log(initialState?.currentUser?.name);
  console.log(initialState?.currentUser?.userid);
  return {
    // actionsRender: () => [
    //   <DocLink key="doc" />,
    //   <VersionDropdown key="version" />,
    //   <LangDropdown key="lang" />,
    // ],
    avatarProps: {
      src: initialState?.currentUser?.avatar,
      title: initialState?.currentUser?.name || '用户',
      render: (_, avatarChildren) => {
        return <AvatarDropdown>{avatarChildren}</AvatarDropdown>;
      },
    },
    waterMarkProps: {
      height: 36,
      width: 115,
      content: 'qixian.cs',
      image:
        'https://gw.alipayobjects.com/zos/bmw-prod/59a18171-ae17-4fc5-93a0-2645f64a3aca.svg',
    },
    menu: {
      params: {
        userId: initialState?.currentUser?.userid,
      },
      request: async (_params, _defaultMenuData) => {
        const menu1 = loopMenuItem1(formatRoutes(extraRoutes));
        console.log(`menuData 转换1：${menu1}`);
        return menu1;
      },
    },
    footerRender: () => <Footer />,
    onPageChange: () => {
      const { location } = history;
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
    links: isDev
      ? [
          <Link key="openapi" to="/umi/plugin/openapi" target="_blank">
            <LinkOutlined />
            <span>OpenAPI 文档</span>
          </Link>,
        ]
      : [],
          // Replace ProLayout's default ErrorBoundary with our offline-aware version,
    // so chunk load errors show friendly messages instead of "Something went wrong."
    ErrorBoundary,
    menuHeaderRender: undefined,
    childrenRender: (children) => {
      return (
        <>
          {children}
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
        </>
      );
    },
    ...initialState?.settings,
  };
};

export const request = {
  ...errorConfig,
};
export function rootContainer(container: React.ReactNode) {
  return (
    <>
      <OfflineBanner />
      <ErrorBoundary>{container}</ErrorBoundary>
    </>
  );
}
