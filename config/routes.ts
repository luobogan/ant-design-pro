/**
 * @name umi 的路由配置
 * @description 只支持 path,component,routes,redirect,wrappers,name,icon 的配置
 * @param path  path 只支持两种占位符配置，第一种是动态参数 :id 的形式，第二种是 * 通配符，通配符只能出现路由字符串的最后。
 * @param component 配置 location 和 path 匹配后用于渲染的 React 组件路径。可以是绝对路径，也可以是相对路径，如果是相对路径，会从 src/pages 开始找起。
 * @param routes 配置子路由，通常在需要为多个路径增加 layout 组件时使用。
 * @param redirect 配置路由跳转
 * @param wrappers 配置路由组件的包装组件，通过包装组件可以为当前的路由组件组合进更多的功能。 比如，可以用于路由级别的权限校验
 * @param name 配置路由的标题，默认读取国际化文件 menu.ts 中 menu.xxxx 的值，如配置 name 为 login，则读取 menu.ts 中 menu.login 的取值作为标题
 * @param icon 配置路由的图标，取值参考 https://ant.design/components/icon-cn， 注意去除风格后缀和大小写，如想要配置图标为 <StepBackwardOutlined /> 则取值应为 stepBackward 或 StepBackward，如想要配置图标为 <UserOutlined /> 则取值应为 user 或者 User
 * @doc https://umijs.org/docs/guides/routes
 */
export default [
  {
    path: '/user',
    layout: false,
    routes: [
      {
        name: 'login',
        path: '/user/login',
        component: './Login/Login',
      },
    ],
  },
  // 登录前门户（免鉴权公开页）：渲染 page_type=0 的门户内容（公告/链接/富文本等）
  {
    path: '/prelogin',
    layout: false,
    component: './PreLogin',
  },
  // 两个「独立页」（Excel 表单预览 / 流程审批）已改为菜单驱动，不再在此静态声明：
  //   * 后端 blade_menu 各有一行 category=2 + is_component=1 + is_open=2 的组件型菜单；
  //   * MenuServiceImpl.buildRoutes() 已放行 category=2 && isComponent=1，故 /menu/routes 会下发；
  //   * 前端 app.tsx 的 loopMenuItem 识别 is_component=1 && is_open=2 → 收集进 standaloneRoutes，
  //     由 patchClientRoutes 挂到顶层（不套 ProLayout），等价原先的 layout: false；
  //   * 同时 app.tsx 的菜单数据源已过滤 category=2，它们不会出现在左侧菜单里。
  {
    path: '/',
    routes: [
      // 默认路由：统一落到 /portal/home（菜单驱动路由，与登录后落地一致，
      // 侧边栏「门户」才能高亮）。此前落到 /welcome —— 该 path 不在菜单数据里，
      // 直接访问 "/" 与登录进入会出现「左侧菜单选中态/标题不一致」。
      {
        path: '/',
        redirect: '/portal/home',
      },
      // 系统首页别名：/welcome 与 /portal/home 渲染同一组件（./Portal/Home）。
      // 保留它是为了兼容历史书签/外部链接；主入口统一走 /portal/home。
      // 原模板欢迎页组件保留在 src/pages/Welcome.tsx，需要时把 component 改回 './Welcome' 即可。
      {
        path: '/welcome',
        name: 'welcome',
        component: './Portal/Home',
      },
      // 消息中心：菜单驱动（blade_menu code='message'，path=/message），无需在此静态声明。
      // 入口是顶部消息铃铛（MessageBell → navigate('/message')）。
      // 注：此前访问 /message 报 404 并非缺菜单，而是 blade-system 宕机导致
      // /menu/routes 取不到数据、动态路由为空，从而落到下面的 /* 兜底。
      // 通配符路由，直接指向404页面
      {
        path: '/*',
        component: './exception/404',
      },
    ],
  },
  {
    path: '*',
    component: './exception/404',
  },
];
