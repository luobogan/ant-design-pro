import { LinkOutlined, SettingOutlined, UserOutlined, ToolOutlined, ApiOutlined, DashboardOutlined, DesktopOutlined, TeamOutlined, FileTextOutlined, DatabaseOutlined, Icon } from '@ant-design/icons';
import * as icons from '@ant-design/icons';
import type { Settings as LayoutSettings, MenuDataItem } from '@ant-design/pro-components';
import { SettingDrawer } from '@ant-design/pro-components';
import type { RequestConfig, RunTimeLayoutConfig } from '@umijs/max';
import { history, Link, Navigate } from '@umijs/max';
import { message, Spin } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import React from 'react';
import { stringify } from 'qs';
// Initialize dayjs plugins globally
dayjs.extend(relativeTime);
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
import { formatRoutes, pickPayload } from '@/utils/utils';

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
  if (extraRoutes?.length > 0) {
    // 只初始化一次，避免重复挂载
    if (!routes[routerIndex].children) {
      routes[routerIndex].children = [];
    }
    const x = loopMenuItem(extraRoutes, parentId);
    // 只挂载到 children，不要同时 push 到 routes 和 children（会导致 key 重复）
    const existingPaths = new Set(routes[routerIndex].children.map((r: any) => r.path));
    x.forEach((r: any) => {
      if (!existingPaths.has(r.path)) {
        routes[routerIndex].children.push(r);
      }
    });
    const mounted: string[] = routes[routerIndex].children.map((r: any) => String(r?.path));
    console.log('patchClientRoutes: 已挂载动态路由', mounted.length);
    // 诊断用：打印全部已注册路由路径，便于确认目标页（如 /formmode/workflowdesign）是否注册
    console.log('patchClientRoutes: 路由清单 =', mounted);
    // 诊断用：组件懒加载失败会回退到 404 页，这里明确打出失败原因
    console.log(
      'patchClientRoutes: /formmode/workflowdesign 是否注册 =',
      mounted.includes('/formmode/workflowdesign'),
    );
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

    // 无 path 的菜单（如仅用于按钮权限的菜单）不注册路由。
    // 路由扁平化后，它们若生成 path='' 的顶级路由会污染路由表并可能抢占 '/' 的匹配。
    if (!item.path) return [];

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
              // 组件加载规则（与菜单页完全一致，嵌套）：./pages/{Module}/{Page}/{Component}.tsx
              // 前两段为「模块/页面」目录，末段为组件文件名（PascalCase）。
              //   /formmode/workflowdesign            → ./pages/FormMode/WorkflowDesign/WorkflowDesign.tsx
              //   /formmode/workflowdesign/preview     → ./pages/FormMode/WorkflowDesign/Preview.tsx
              const moduleSeg = toPascalCase(pathParts1[0]);
              const pageSeg = toPascalCase(pathParts1[1] ?? lastSegment);
              const componentSeg = toPascalCase(lastSegment);
              const importPath = `./pages/${moduleSeg}/${pageSeg}/${componentSeg}.tsx`;
              //  debugger;
              console.log(`按钮组件路径：${importPath}`);

              const ButtonComponent = React.lazy(
                () =>
                  new Promise((resolve, _reject) => {
                    import(importPath)
                      .then((mod) => resolve(mod))
                      .catch((error) => {
                        console.error('组件导入错误:', importPath, error);
                        message.error(`按钮组件加载失败：${importPath}（详见控制台）`);
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
                  console.error('组件导入错误:', componentPath, error);
                  message.error(`页面组件加载失败：${componentPath}（详见控制台）`);
                  import('./pages/exception/404').then((mod) => resolve(mod));
                });
            }),
        );
      }
    }

    const children = item.children || [];
    // 仅当存在「位于本路径之下的子页面」时，本菜单才是纯分组，渲染成重定向；
    // 否则（子项只是按钮权限无 path，或跨命名空间如 /system/workflow 下的
    // /formmode/workflowdesign）本菜单本身就是一个页面，必须渲染自己的组件，
    // 不然会被 <Navigate to="" /> 空转，表现为「打开了但是一片空白 / 404」。
    const navChild = children.find(
      (c: any) => c.path && String(c.path).startsWith(`${item.path}/`),
    );

    // 扁平化：本菜单与其子菜单都作为顶层兄弟路由挂到 '/' 下（不再嵌套 children），
    // 避免子菜单使用跨命名空间绝对路径被嵌套而触发
    // "Absolute route path ... nested under path ... is not valid" 报错。
    return [
      {
        path: item.path,
        name: item.name,
        icon: item.icon,
        id: item.id,
        parentId: pId,
        element: navChild ? (
          <Navigate to={navChild.path} replace />
        ) : (
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
      ...loopMenuItem(children, item.id),
      ...buttonRoutes,
    ];
  });
};

export function render(oldRender: () => void) {
  setTimeout(async () => {
    try {
      const menuData = await dynamicRoutes();
      // 兼容两种形态：拦截器已拆包时 menuData.data 就是路由数组；
      // 未拆包（umi 包装对象）时 menuData.data 是 ApiResponse，由 formatRoutes 内部再取 .data。
      extraRoutes = formatRoutes(pickPayload(menuData));
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
  settingDrawerOpen?: boolean;
}> {
  const fetchUserInfo = async () => {
    try {
      const res = await queryCurrentUser();
      console.log('用户信息响应:', res);
      // 响应可能直接就是用户对象，也可能是 {data: 用户对象}，统一剥取
      return pickPayload(res);
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
      const buttonsData = pickPayload(response) || [];

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
