import { LinkOutlined, SettingOutlined, UserOutlined, ToolOutlined, ApiOutlined, DashboardOutlined, DesktopOutlined, TeamOutlined, FileTextOutlined, DatabaseOutlined, Icon } from '@ant-design/icons';
import * as icons from '@ant-design/icons';
import type { Settings as LayoutSettings, MenuDataItem } from '@ant-design/pro-components';
import { SettingDrawer } from '@ant-design/pro-components';
import type { RequestConfig, RunTimeLayoutConfig } from '@umijs/max';
import { history, Link, Navigate, request as httpRequest } from '@umijs/max';
import { message, Spin, Button, Space } from 'antd';
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
import FloatingMessageBox from '@/components/FloatingMessageBox';
import MessageBell from '@/components/MessageBell';
import TopNavMenu from '@/components/TopNavMenu';
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

/**
 * 跳登录页并**保留来源地址**（?redirect=...），登录后才能回到原页面。
 * 已有 redirect 参数时原样保留，避免二次编码。
 */
const pushToLoginWithRedirect = () => {
  const { pathname, search } = window.location;
  if (pathname === loginPath) {
    history.push(loginPath + search);
    return;
  }
  const existing = new URLSearchParams(search).get('redirect');
  const nextSearch = existing
    ? search
    : `?redirect=${encodeURIComponent(`${pathname}${search}`)}`;
  history.push(`${loginPath}${nextSearch}`);
};

interface MenuItem {
  url: string;
  menuName: string;
  icon: string;
  menuID: number | string;
  page?: string;
  children?: MenuItem[];
  category?: number;
  isComponent?: number;
  /** 打开方式：1=默认；2=「独立页」（按钮型组件页顶层挂载，不套 ProLayout 外壳；侧边栏菜单项则新标签打开） */
  isOpen?: number;
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
// 「独立页」收集（按钮型组件页且 is_open=2）：由 loopMenuItem 收集，patchClientRoutes 挂到「顶层」，
// 不套 ProLayout/左侧菜单外壳（等价 config/routes.ts 里 layout:false 的静态独立页）。
let standaloneRoutes: any[] = [];


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
    // 独立页：挂到顶层（顶层路由不被布局插件包裹 → 无 ProLayout/左侧菜单）。
    // 已有同名顶层路由（如静态注册的 ExcelPreviewPage）则跳过，避免把静态独立页顶掉。
    const topLevelPaths = new Set(routes.map((r: any) => String(r?.path)));
    standaloneRoutes.forEach((r: any) => {
      if (!topLevelPaths.has(String(r.path))) {
        routes.push(r);
        topLevelPaths.add(String(r.path));
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

/**
 * 少数目录名无法从菜单 path 推导出来（复合词的内部大写推不出来），在此显式登记。
 * key 为「模块/目录」的小写且忽略连字符形式，value 为磁盘上的真实目录名。
 */
const PAGE_DIR_ALIAS: Record<string, string> = {
  // /system/tenantpackage、/system/tenant-package 都会被推导成 Tenantpackage，
  // 但磁盘目录是 TenantPackage —— 复合词大小写无法从 path 还原，只能登记。
  'system/tenantpackage': 'TenantPackage',
};

const normalizeDirKey = (p: string): string => p.toLowerCase().replace(/[-_]/g, '');

/**
 * 生成页面组件的加载器候选（大小写兜底）。
 *
 * ⚠️ 必须保持「带静态前缀的模板字符串」写法：utoo/turbopack 只能从模板字符串
 * 里推断出动态 import 的目录上下文。若先把路径拼进数组再 `import(arr[i])`，
 * 打包器推断不出前缀，会导致**所有**动态页面组件都加载失败（2026-10-05 踩坑）。
 *
 * 候选顺序：别名登记的真实目录 → Pascal 推导值 → 原始路径分段（大小写不同）。
 * 典型场景：菜单 /system/topmenu 推导出 TopMenu，磁盘目录却是 Topmenu。
 */
const buildComponentLoaders = (
  module: string,
  page: string,
  rawPage: string,
): Array<() => Promise<any>> => {
  const loaders: Array<() => Promise<any>> = [];
  const aliasDir = PAGE_DIR_ALIAS[normalizeDirKey(`${module}/${page}`)];
  if (aliasDir) {
    loaders.push(() => import(`./pages/${module}/${aliasDir}/${aliasDir}.tsx`));
    loaders.push(() => import(`./pages/${module}/${aliasDir}/index.tsx`));
  }
  loaders.push(() => import(`./pages/${module}/${page}/${page}.tsx`));
  loaders.push(() => import(`./pages/${module}/${page}/index.tsx`));
  if (rawPage && rawPage !== page) {
    loaders.push(() => import(`./pages/${module}/${rawPage}/${rawPage}.tsx`));
    loaders.push(() => import(`./pages/${module}/${rawPage}/index.tsx`));
  }
  return loaders;
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
          const rawPage = pathParts[pathParts.length - 1];
          const [module, page] = [toPascalCase(pathParts[0]), toPascalCase(rawPage)];

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

        // 按钮型组件页：category=2 + is_component=1 + 带 path 才注册路由；
        // is_open=2 的按「独立页」处理（顶层挂载、不套 ProLayout 外壳）。
        const componentButtons: Array<{ item: any; standalone: boolean }> = [];
        relatedButtons.forEach((button) => {
          button.children?.forEach((item1: any) => {
            if (item1.category === 2 && item1.isComponent === 1 && item1.path) {
              componentButtons.push({ item: item1, standalone: item1.isOpen === 2 });
            }
          });
        });

        componentButtons.forEach(({ item: item1, standalone }) => {
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
              // 兼容「旧命名」回退：历史文件名为 {页面}{组件}.tsx
              //   /mall/product/aae    → 主 ./pages/Mall/Product/Aae.tsx     → 回退 ./pages/Mall/Product/ProductAae.tsx
              //   /formmode/formmanage/aae → 回退 ./pages/FormMode/FormManage/FormManageAae.tsx
              // 主路径不存在时自动尝试回退路径，再不行才 404。
              const importPathAlt = `./pages/${moduleSeg}/${pageSeg}/${pageSeg}${componentSeg}.tsx`;
              //  debugger;
              console.log(`按钮组件路径：${importPath}（回退：${importPathAlt}）`);

              const ButtonComponent = React.lazy(
                () =>
                  new Promise((resolve, _reject) => {
                    import(importPath)
                      .then((mod) => resolve(mod))
                      .catch(() => {
                        import(importPathAlt)
                          .then((mod) => resolve(mod))
                          .catch((error) => {
                            console.error('组件导入错误:', importPath, importPathAlt, error);
                            message.error(`按钮组件加载失败：${importPath} / ${importPathAlt}（详见控制台）`);
                            import('./pages/exception/404').then((mod) => resolve(mod));
                          });
                      });
                  }),
              );

              const componentRoute: any = {
                path: item1.path,
                name: item1.name,
                id: item1.id,
                parentId: item1.parentId,
                // 独立页：显式 layout:false（顶层挂载时兜底，防被布局插件包裹）
                ...(standalone ? { layout: false } : {}),
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
              };
              if (standalone) {
                // 独立页：交由 patchClientRoutes 挂到顶层（无 ProLayout/左侧菜单）。
                // 清掉 parentId，避免被路由转换当作某菜单下的子路由处理。
                delete componentRoute.parentId;
                standaloneRoutes.push(componentRoute);
              } else {
                buttonRoutes.push(componentRoute);
              }
        });

        // 组件加载候选（按命中概率排序）：
        // ① ./pages/{Module}/{Page}/{Page}.tsx   常规：/system/user → ./pages/System/User/User.tsx
        // ② ./pages/{Module}/{Page}/index.tsx     目录入口：/account/settings → ./pages/Account/Settings/index.tsx
        // ③ 大小写变体：菜单 path 经 toPascalCase 推导出的目录名可能与磁盘实际大小写不一致
        //    （如 /system/topmenu → TopMenu，而目录实际是 Topmenu；打包器按精确路径匹配，大小写不符即失败）
        const componentPath = `./pages/${module}/${page}/${page}.tsx`;
        const componentIndexPath = `./pages/${module}/${page}/index.tsx`;
        const loaders = buildComponentLoaders(module, page, rawPage);
        console.log(
          `组件路径：${componentPath}（兜底：${rawPage !== page ? `./pages/${module}/${rawPage}/${rawPage}.tsx | ` : ''}index）`,
        );

        Component = React.lazy(
          () =>
            new Promise((resolve, _reject) => {
              const tryImport = (index: number) => {
                if (index >= loaders.length) {
                  console.error('组件导入失败，已尝试候选数：', loaders.length, componentPath, componentIndexPath);
                  message.error(`页面组件加载失败：${componentPath} / ${componentIndexPath}（详见控制台）`);
                  import('./pages/exception/404').then((mod) => resolve(mod));
                  return;
                }
                loaders[index]()
                  .then((mod) => resolve(mod))
                  .catch(() => tryImport(index + 1));
              };
              tryImport(0);
            }),
        );
      } else if (pathParts.length === 1) {
        // 单段顶级路径（如 /message → ./pages/Message/index.tsx）：
        // 多段路径在上方按 module/page 两级推导组件，单段路径拆不出两级，
        // 此前直接跳过导致 Component=null ⇒ 路由命中但页面空白（2026-10-07 消息中心踩坑）。
        // 约定单段路径解析模块级页面：./pages/{Module}/index.tsx 或 ./pages/{Module}/{Module}.tsx。
        const module = toPascalCase(pathParts[0]);
        const loaders: Array<() => Promise<any>> = [
          () => import(`./pages/${module}/index.tsx`),
          () => import(`./pages/${module}/${module}.tsx`),
        ];
        Component = React.lazy(
          () =>
            new Promise((resolve, _reject) => {
              const tryImport = (index: number) => {
                if (index >= loaders.length) {
                  console.error('组件导入失败（单段路径）：', `./pages/${module}/index.tsx`);
                  message.error(`页面组件加载失败：./pages/${module}/index.tsx（详见控制台）`);
                  import('./pages/exception/404').then((mod) => resolve(mod));
                  return;
                }
                loaders[index]()
                  .then((mod) => resolve(mod))
                  .catch(() => tryImport(index + 1));
              };
              tryImport(0);
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
    // 动态路由拉取加重试：开发期 HMR 重编译、代理抖动、后端服务重启窗口都可能造成瞬时
    // 超时/失败。此前一失败就跳登录页，会让「token 仍有效」的用户误以为掉线被踢出。
    // 策略：最多 3 次（0.8s/1.6s 退避），仅 401 才认定登录态失效跳登录；
    // 其余失败进应用并提示刷新（菜单可能为空，刷新即可恢复）。
    const statusOf = (e: any) =>
      e?.response?.status ?? e?.status ?? e?.response?.data?.code ?? e?.data?.code;
    let menuData: any = null;
    let lastErr: any = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        menuData = await dynamicRoutes();
        lastErr = null;
        break;
      } catch (e: any) {
        lastErr = e;
        if (statusOf(e) === 401) break;
        await new Promise((r) => setTimeout(r, attempt * 800));
      }
    }
    try {
      if (lastErr) {
        if (statusOf(lastErr) === 401) {
          pushToLoginWithRedirect();
        } else {
          console.error('动态菜单拉取失败（已重试）：', lastErr);
          message.error('菜单加载失败（网络/服务波动），请稍后刷新重试');
          extraRoutes = [];
        }
      } else {
        // ⚠️ 按钮型组件页（category=2 + isComponent=1 + path，如流程设计器 /formmode/workflowdesign）
        // 的路由注册依赖按钮数据（getButtons() 读 localStorage）。而按钮数据在 getInitialState
        // 里才拉取，晚于本 render ⇒ 首次进入（sword-buttons 无缓存）路由会漏注册，进入即 404。
        // 故此处若缓存为空先拉一次按钮并落盘，再构建路由，保证按钮组件页首次即可用。
        if (!(getButtons() || []).length) {
          try {
            setButtons(pickPayload(await dynamicButtons()) || []);
          } catch (e) {
            console.warn('按钮数据预加载失败，按钮型组件页可能不可用：', e);
          }
        }
        // 兼容两种形态：拦截器已拆包时 menuData.data 就是路由数组；
        // 未拆包（umi 包装对象）时 menuData.data 是 ApiResponse，由 formatRoutes 内部再取 .data。
        extraRoutes = formatRoutes(pickPayload(menuData));
        const urlParams = new URL(window.location.href).searchParams;
        const redirect = urlParams.get('redirect');
        // ⚠️ 只有「确实拿到了菜单（=已登录）」才自动跳回 redirect。
        // 未登录时后端返回空列表（不报错，走的是 try 分支），若此时直接 push(redirect)，
        // 会被 onPageChange 以「无 currentUser」打回登录页，而打回时丢了 redirect 参数
        // → 登录后只能去默认首页，回不到原页面（/user/login?redirect=xxx 失效的根因）。
        if (redirect && extraRoutes.length > 0) {
          history.push(redirect);
        }
      }
      oldRender();
    } catch (_e) {
      pushToLoginWithRedirect();
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
      const user = pickPayload(res) as API.CurrentUser & { id?: string | number };
      // ⚠️ 后端 /blade-system/user/info 返回的用户主键是 id（没有 userid 字段），
      // 而全项目（消息中心、工作流、头像下拉等）统一读 currentUser?.userid。
      // 此处归一化 id → userid，避免下游静默取空（如 FloatingMessageBox 拿不到用户 ID 直接不渲染）。
      if (user && user.userid === undefined && user.id !== undefined) {
        user.userid = String(user.id);
      }
      return user;
    } catch (_error) {
      console.error('获取用户信息失败:', _error);
      // 保留来源地址，登录后跳回（而非落到默认首页）
      pushToLoginWithRedirect();
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
    // 登录时加载当前用户保存的主题设置（若存在），合并到布局 settings，实现「按用户加载主题」
    let settings = defaultSettings as Partial<LayoutSettings>;
    const savedTheme = currentUser?.themeSetting;
    if (savedTheme) {
      try {
        const parsed = JSON.parse(savedTheme);
        settings = { ...settings, ...parsed };
      } catch {
        // 主题配置损坏则忽略，回退默认
      }
    }
    return {
      fetchUserInfo,
      currentUser,
      buttons,
      settings,
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
    // 顶部消息铃铛：全局未读红点（WS 实时更新），点击进入 /message 消息中心。
    // /message 路由由后端菜单驱动注册（见 formatRoutes），不在 config/routes.ts 静态声明。
    actionsRender: () => [<MessageBell key="message-bell" />],
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
    // 顶部导航栏：数据取自后端 /menu/top-menu + /menu/routes?topMenuId=xx，
    // 支持多级下拉、路由跳转，且已按角色/租户权限过滤。
    splitMenus: false,
    headerContentRender: () => <TopNavMenu />,
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
        // 带上 ?redirect=，登录后回到被拦截的页面（此前直接 push(loginPath) 把参数丢了）
        pushToLoginWithRedirect();
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
      console.log('[MSG-DIAG] childrenRender 执行, currentUser?.userid =', initialState?.currentUser?.userid);
      // 保存当前用户的主题设置到后端（按用户持久化，登录时随用户信息返回并加载）
      const handleSaveTheme = async () => {
        const theme = initialState?.settings;
        if (!theme) return;
        try {
          const res = await httpRequest('/api/blade-system/user/theme-setting', {
            method: 'POST',
            data: { themeSetting: JSON.stringify(theme) },
          });
          // 响应形态：umi 包装对象 { data: ApiResponse }，ApiResponse = { code, success, data, msg }。
          // 注意 pickPayload 对 data 为基本类型（本接口 data 为 boolean）会多剥一层，取不到 success，
          // 这里直接定位 ApiResponse 的成功标识，并兼容「包装对象 / ApiResponse 直出」两种形态。
          const r = res as any;
          const api = r?.data && typeof r.data === 'object' && r.data.success !== undefined ? r.data : r;
          if (api?.success) {
            message.success('主题设置已保存');
            setInitialState((pre) => ({
              ...pre,
              currentUser: pre.currentUser
                ? { ...pre.currentUser, themeSetting: JSON.stringify(theme) }
                : pre.currentUser,
            }));
          } else {
            message.error(api?.msg || '主题设置保存失败');
          }
        } catch {
          message.error('主题设置保存失败');
        }
      };
      // 恢复默认主题（仅本地重置，不自动保存）
      const handleResetTheme = () => {
        setInitialState((pre) => ({
          ...pre,
          settings: defaultSettings as Partial<LayoutSettings>,
        }));
        message.success('已恢复默认主题，点击「保存主题」可生效');
      };
      return (
        <>
          {children}
          <SettingDrawer
            disableUrlParams
            enableDarkTheme
            settings={initialState?.settings}
            // SettingDrawer 的抽屉 open 由内部 state 控制，但 drawerProps.open 会覆盖它，
            // 导致浮动齿轮（setOpen 改内部 state）点了没反应。
            // 改用受控项 collapse + onCollapseChange 驱动 open，齿轮与「主题设置」菜单都能正常开关。
            collapse={initialState?.settingDrawerOpen}
            onCollapseChange={(o: boolean) => {
              setInitialState((pre) => ({ ...pre, settingDrawerOpen: !!o }));
            }}
            drawerProps={{
              onClose: () => {
                setInitialState((pre) => ({ ...pre, settingDrawerOpen: false }));
              },
              footer: (
                <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Button onClick={handleResetTheme}>恢复默认</Button>
                  <Button type="primary" onClick={handleSaveTheme}>
                    保存主题
                  </Button>
                </Space>
              ),
            }}
            onSettingChange={(settings) => {
              setInitialState((preInitialState) => ({
                ...preInitialState,
                settings,
              }));
            }}
          />
          {/* 全局消息中心（右下角悬浮聊天框 + 未读红点），见提交 8f473e9b。
              放在 childrenRender 内（Umi Context 作用域中），useModel 才能取到 initialState；
              组件用 position:fixed，不受 DOM 位置影响。未登录时内部返回 null。 */}
          <FloatingMessageBox />
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
