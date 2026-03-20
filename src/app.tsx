import type { RunTimeLayoutConfig } from '@@/plugin-layout/types';
import * as icons from '@ant-design/icons';
import Icon, { LinkOutlined } from '@ant-design/icons';
import type {
  Settings as LayoutSettings,
  MenuDataItem,
} from '@ant-design/pro-components';
import { SettingDrawer } from '@ant-design/pro-components';
import { history, Link, Navigate } from '@umijs/max';
import { Spin } from 'antd';
import { stringify } from 'qs';
import React from 'react';
import Footer from '@/components/Footer';
import {
  AvatarDropdown,
  AvatarName,
} from '@/components/RightContent/AvatarDropdown';
import { errorConfig } from '@/requestErrorConfig';
import { currentUser as queryCurrentUser } from '@/services/ant-design-pro/api';
import { dynamicRoutes, dynamicButtons } from '@/services/system/menu';
import { setButtons } from '@/utils/authority';
import Func from '@/utils/Func';
import { formatRoutes } from '@/utils/utils';
import defaultSettings from '../config/defaultSettings';

const isDev = process.env.NODE_ENV === 'development';
// const vConsole = new VConsole();
const loginPath = '/user/login';

interface MenuItem {
  url: string;
  menuName: string;
  icon: string;
  menuID: number | string;
  page?: string;
  children?: MenuItem[];
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

const loopMenuItem = (menus: MenuItem[], pId: number | string): RouteItem[] => {
  // debugger
  return menus.flatMap((item) => {
    let Component: React.ComponentType<any> | null = null;
    if (item.path) {
      // 使用格式化路径，确保路径大小写与实际文件路径一致
      const x = Func.formatRoutePath(item.path);
      console.log(`tempComponent  路径 ${x}`);

      console.log(`tempComponent  路径详细 ./pages${x}/index.tsx`);
      // 防止配置了路由，但本地暂未添加对应的页面，产生的错误 /index.tsx
      Component = React.lazy(
        () =>
          new Promise((resolve, _reject) => {
            import(`./pages${x}/index.tsx`)
              .then((module) => resolve(module))
              .catch((error) => {
                console.error('组件导入错误:', error);
                resolve(import(`./pages/404.tsx`));
              });
          }),
      );
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
          // element: createElement(Component)
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
                    <Spin size="large" tip="加载中..." />
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
      ];
    }
  });
};

export function render(oldRender: () => void) {
  // fetchRouter().then((res: any) => {
  //   extraRoutes = res
  //
  //   oldRender()
  // })
  setTimeout(async () => {
    try {
      const menuData = await dynamicRoutes();
      extraRoutes = formatRoutes(menuData.data);
      // extraRoutes=loopMenuItem1(menu1);
      const urlParams = new URL(window.location.href).searchParams;
      const redirect = urlParams.get('redirect');
      if (redirect) {
        history.push(redirect);
      }
      oldRender();
    } catch (_e) {
      const { search, pathname } = window.location;
      // eslint-disable-next-line no-case-declarations
      const urlParams = new URL(window.location.href).searchParams;
      /** 此方法会跳转到 redirect 参数所在的位置 */
      // eslint-disable-next-line no-case-declarations
      const redirect = urlParams.get('redirect');
      // Note: There may be security issues, please note
      if (window.location.pathname !== loginPath && !redirect) {
        history.replace({
          pathname: loginPath,
          search: stringify({
            redirect: pathname + search,
          }),
        });
      } else {
        // history.push("/system/login?redirect=" + window.location.pathname + window.location.search);
        history.push(loginPath + window.location.search);
        // history.push(
        //   "/system/login"
        // );
      }
      oldRender();
    }
  }, 500);
}

/**
 * @see  https://umijs.org/zh-CN/plugins/plugin-initial-state
 * */
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
      const buttonsData = response.data || [];
      setButtons(buttonsData);
      console.log('按钮权限已加载:', buttonsData);
      return buttonsData;
    } catch (error) {
      console.error('获取按钮权限失败:', error);
      return [];
    }
  };

  const { location } = history;
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
// 映射菜单对应的图标
const loopMenuItem1 = (menus: MenuDataItem[]): MenuDataItem[] =>
  menus.map(({ icon, routes, ...item }) => ({
    ...item,
    icon: icon && <Icon component={icons[icon]} />,
    routes: routes && loopMenuItem1(routes),
  }));
// ProLayout 支持的api https://procomponents.ant.design/components/layout
export const layout: RunTimeLayoutConfig = ({
  initialState,
  setInitialState,
}) => {
  console.log(initialState?.currentUser?.name);
  // console.log(initialState?.currentUser?.id)
  console.log(initialState?.currentUser?.userid);
  return {
    // actionsRender: () => [<Question key="doc" />, <SelectLang key="SelectLang" />],
    avatarProps: {
      src: initialState?.currentUser?.avatar,
      title: <AvatarName />,
      render: (_, avatarChildren) => {
        return <AvatarDropdown>{avatarChildren}</AvatarDropdown>;
      },
    },
    waterMarkProps: {
      // content: initialState?.currentUser?.name,
      height: 36,
      width: 115,
      content: 'qixian.cs',
      image:
        'https://gw.alipayobjects.com/zos/bmw-prod/59a18171-ae17-4fc5-93a0-2645f64a3aca.svg',
    },
    menu: {
      // 每当 initialState?.currentUser?.userid 发生修改时重新执行 request
      params: {
        userId: initialState?.currentUser?.userid,
      },
      request: async (_params, _defaultMenuData) => {
        // initialState.currentUser 中包含了所有用户信息
        // console.log("menuData:test ")
        // const menuData = await dynamicRoutes();
        // console.log("menuData:2222 "+menuData)
        // const menu1=loopMenuItem1(formatRoutes(menuData.data));
        // console.log("menuData 转换1："+menu1)
        // //console.log("menuData 获取数据:"+menuData)
        // // console.log("menuData 转换2："+formatRoutes(menuData))
        // return menu1;

        // return extraRoutes;
        const menu1 = loopMenuItem1(formatRoutes(extraRoutes));
        console.log(`menuData 转换1：${menu1}`);
        //console.log("menuData 获取数据:"+menuData)
        // console.log("menuData 转换2："+formatRoutes(menuData))
        return menu1;
      },
    },
    footerRender: () => <Footer />,
    onPageChange: () => {
      const { location } = history;
      // 如果没有登录，重定向到 login
      if (!initialState?.currentUser && location.pathname !== loginPath) {
        history.push(loginPath);
      }
    },
    layoutBgImgList: [
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
    menuHeaderRender: undefined,
    // 自定义 403 页面
    // unAccessible: <div>unAccessible</div>,
    // 增加一个 loading 的状态
    childrenRender: (children) => {
      // if (initialState?.loading) return <PageLoading />;
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

/**
 * @name request 配置，可以配置错误处理
 * 它基于 axios 和 ahooks 的 useRequest 提供了一套统一的网络请求和错误处理方案。
 * @doc https://umijs.org/docs/max/request#配置
 */
export const request = {
  ...errorConfig,
};
