// https://umijs.org/config/

import { join } from 'node:path';
import { defineConfig } from '@umijs/max';
import defaultSettings from './defaultSettings';
import proxy from './proxy';

import routes from './routes';

const { UMI_ENV = 'dev' } = process.env;

// Compute commit hash: env vars take precedence, fall back to git at build time
const commitHash =
  process.env.COMMIT_HASH ||
  process.env.CF_PAGES_COMMIT_SHA ||
  (() => {
    try {
      return require('node:child_process')
        .execSync('git rev-parse HEAD', {
          stdio: ['ignore', 'pipe', 'ignore'],
          encoding: 'utf-8',
        })
        .trim();
    } catch {
      return '';
    }
  })();

/**
 * @name 使用公共路径
 * @description 部署时的路径，如果部署在非根目录下，需要配置这个变量
 * @doc https://umijs.org/docs/api/config#publicpath
 */
const PUBLIC_PATH: string = '/';
// Univer 本地构建产物路径（复制到项目内部，避免 turbopack symlink 沙箱限制）
const UNIVER_LIB = join(__dirname, '..', 'src', 'univer-lib');
const IS_DEV = UMI_ENV === 'dev';

export default defineConfig({
  alias: {
    '@root': join(__dirname, '..'),
    // ── Univer 本地构建产物（仅保留实际使用的包）──
    '@univerjs/core': join(UNIVER_LIB, 'core', 'lib', 'es', 'index.js'),
    '@univerjs/data-validation': join(UNIVER_LIB, 'data-validation', 'lib', 'es', 'index.js'),
    '@univerjs/design': join(UNIVER_LIB, 'design', 'lib', 'es', 'index.js'),
    '@univerjs/docs': join(UNIVER_LIB, 'docs', 'lib', 'es', 'index.js'),
    '@univerjs/docs-ui': join(UNIVER_LIB, 'docs-ui', 'lib', 'es', 'index.js'),
    '@univerjs/drawing': join(UNIVER_LIB, 'drawing', 'lib', 'es', 'index.js'),
    '@univerjs/engine-formula': join(UNIVER_LIB, 'engine-formula', 'lib', 'es', 'index.js'),
    '@univerjs/engine-render': join(UNIVER_LIB, 'engine-render', 'lib', 'es', 'index.js'),
    '@univerjs/protocol': join(UNIVER_LIB, 'protocol', 'lib', 'es', 'index.js'),
    '@univerjs/rpc': join(UNIVER_LIB, 'rpc', 'lib', 'es', 'index.js'),
    '@univerjs/sheets': join(UNIVER_LIB, 'sheets', 'lib', 'es', 'index.js'),
    '@univerjs/sheets-data-validation': join(UNIVER_LIB, 'sheets-data-validation', 'lib', 'es', 'index.js'),
    '@univerjs/sheets-formula': join(UNIVER_LIB, 'sheets-formula', 'lib', 'es', 'index.js'),
    '@univerjs/sheets-formula-ui': join(UNIVER_LIB, 'sheets-formula-ui', 'lib', 'es', 'index.js'),
    '@univerjs/sheets-numfmt': join(UNIVER_LIB, 'sheets-numfmt', 'lib', 'es', 'index.js'),
    '@univerjs/sheets-numfmt-ui': join(UNIVER_LIB, 'sheets-numfmt-ui', 'lib', 'es', 'index.js'),
    '@univerjs/sheets-ui': join(UNIVER_LIB, 'sheets-ui', 'lib', 'es', 'index.js'),
    '@univerjs/telemetry': join(UNIVER_LIB, 'telemetry', 'lib', 'es', 'index.js'),
    '@univerjs/themes': join(UNIVER_LIB, 'themes', 'lib', 'es', 'index.js'),
    '@univerjs/ui': join(UNIVER_LIB, 'ui', 'lib', 'es', 'index.js'),
    // facade 子路径
    '@univerjs/core/facade': join(UNIVER_LIB, 'core', 'lib', 'es', 'facade.js'),
    // ui facade：为 FUniver 扩展 createMenu / createSubmenu（设计器自定义 ribbon 页签依赖）
    '@univerjs/ui/facade': join(UNIVER_LIB, 'ui', 'lib', 'es', 'facade.js'),
    '@univerjs/docs/facade': join(UNIVER_LIB, 'docs', 'lib', 'es', 'facade.js'),
    '@univerjs/sheets/facade': join(UNIVER_LIB, 'sheets', 'lib', 'es', 'facade.js'),
    '@univerjs/sheets-ui/facade': join(UNIVER_LIB, 'sheets-ui', 'lib', 'es', 'facade.js'),
    // 语言包 (zh-CN)
    '@univerjs/design/locale/zh-CN': join(UNIVER_LIB, 'design', 'lib', 'es', 'locale', 'zh-CN.js'),
    '@univerjs/ui/locale/zh-CN': join(UNIVER_LIB, 'ui', 'lib', 'es', 'locale', 'zh-CN.js'),
    '@univerjs/docs-ui/locale/zh-CN': join(UNIVER_LIB, 'docs-ui', 'lib', 'es', 'locale', 'zh-CN.js'),
    '@univerjs/sheets/locale/zh-CN': join(UNIVER_LIB, 'sheets', 'lib', 'es', 'locale', 'zh-CN.js'),
    '@univerjs/sheets-ui/locale/zh-CN': join(UNIVER_LIB, 'sheets-ui', 'lib', 'es', 'locale', 'zh-CN.js'),
    '@univerjs/sheets-formula-ui/locale/zh-CN': join(UNIVER_LIB, 'sheets-formula-ui', 'lib', 'es', 'locale', 'zh-CN.js'),
    '@univerjs/sheets-numfmt-ui/locale/zh-CN': join(UNIVER_LIB, 'sheets-numfmt-ui', 'lib', 'es', 'locale', 'zh-CN.js'),
    '@univerjs/sheets-data-validation/locale/zh-CN': join(UNIVER_LIB, 'sheets-data-validation', 'lib', 'es', 'locale', 'zh-CN.js'),
    // CSS 样式文件
    '@univerjs/design/lib/index.css': join(UNIVER_LIB, 'design', 'lib', 'index.css'),
    '@univerjs/ui/lib/index.css': join(UNIVER_LIB, 'ui', 'lib', 'index.css'),
    '@univerjs/docs-ui/lib/index.css': join(UNIVER_LIB, 'docs-ui', 'lib', 'index.css'),
    '@univerjs/sheets-ui/lib/index.css': join(UNIVER_LIB, 'sheets-ui', 'lib', 'index.css'),
    '@univerjs/sheets-formula-ui/lib/index.css': join(UNIVER_LIB, 'sheets-formula-ui', 'lib', 'index.css'),
    '@univerjs/sheets-numfmt-ui/lib/index.css': join(UNIVER_LIB, 'sheets-numfmt-ui', 'lib', 'index.css'),
  },
  /**
   * @name 开启 hash 模式
   * @description 让 build 之后的产物包含 hash 后缀。通常用于增量发布和避免浏览器加载缓存。
   * @doc https://umijs.org/docs/api/config#hash
   */
  hash: true,

  publicPath: PUBLIC_PATH,

  /**
   * @name 兼容性设置
   * @description 设置 ie11 不一定完美兼容，需要检查自己使用的所有依赖
   * @doc https://umijs.org/docs/api/config#targets
   */
  // targets: {
  //   ie: 11,
  // },
  /**
   * @name 路由的配置，不在路由中引入的文件不会编译
   * @description 只支持 path，component，routes，redirect，wrappers，title 的配置
   * @doc https://umijs.org/docs/guides/routes
   */
  // umi routes: https://umijs.org/docs/routing
  routes,
  /**
   * @name 主题的配置
   * @description 虽然叫主题，但是其实只是 less 的变量设置
   * @doc antd的主题设置 https://ant.design/docs/react/customize-theme-cn
   * @doc umi 的 theme 配置 https://umijs.org/docs/api/config#theme
   */
  // theme: { '@primary-color': '#1DA57A' }
  /**
   * @name moment 的国际化配置
   * @description 如果对国际化没有要求，打开之后能减少js的包大小
   * @doc https://umijs.org/docs/api/config#ignoremomentlocale
   */
  ignoreMomentLocale: true,
  /**
   * @name 代理配置
   * @description 可以让你的本地服务器代理到你的服务器上，这样你就可以访问服务器的数据了
   * @see 要注意以下 代理只能在本地开发时使用，build 之后就无法使用了。
   * @doc 代理介绍 https://umijs.org/docs/guides/proxy
   * @doc 代理配置 https://umijs.org/docs/api/config#proxy
   */
  proxy: proxy[UMI_ENV as keyof typeof proxy],
  /**
   * @name 快速热更新配置
   * @description 一个不错的热更新组件，更新时可以保留 state
   */
  fastRefresh: true,
  /**
   * @name 路由预加载
   * @description 预加载路由资源，提升页面切换速度
   * @doc https://umijs.org/docs/api/config#routePrefetch
   */
  routePrefetch: {},
  /**
   * @name manifest 配置
   * @description 生成资源清单，配合 routePrefetch 使用
   */
  manifest: {},
  //============== 以下都是max的插件配置 ===============
  /**
   * @name 数据流插件
   * @@doc https://umijs.org/docs/max/data-flow
   */
  model: {},
  /**
   * 一个全局的初始数据流，可以用它在插件之间共享数据
   * @description 可以用来存放一些全局的数据，比如用户信息，或者一些全局的状态，全局初始状态在整个 Umi 项目的最开始创建。
   * @doc https://umijs.org/docs/max/data-flow#%E5%85%A8%E5%B1%80%E5%88%9D%E5%A7%8B%E7%8A%B6%E6%80%81
   */
  initialState: {},
  /**
   * @name layout 插件
   * @doc https://umijs.org/docs/max/layout-menu
   */
  title: '流程引擎系统',
  layout: {
    locale: true,
    ...defaultSettings,
  },
  /**
   * @name moment2dayjs 插件
   * @description 将项目中的 moment 替换为 dayjs
   * @doc https://umijs.org/docs/max/moment2dayjs
   */
  moment2dayjs: {
    preset: 'antd',
    plugins: ['duration', 'relativeTime'],
  },
  /**
   * @name 国际化插件
   * @doc https://umijs.org/docs/max/i18n
   */
  locale: {
    // default zh-CN
    default: 'zh-CN',
    antd: true,
    // default true, when it is true, will use `navigator.language` overwrite default
    baseNavigator: true,
  },
  /**
   * @name antd 插件
   * @description 内置了 babel import 插件
   * @doc https://umijs.org/docs/max/antd#antd
   */
  antd: {
    appConfig: {},
    configProvider: {
      variant: 'filled',
      theme: {
        token: {
          fontFamily: 'AlibabaSans, sans-serif',
        },
      },
    },
  },
  /**
   * @name 网络请求配置
   * @description 它基于 axios 和 ahooks 的 useRequest 提供了一套统一的网络请求和错误处理方案。
   * @doc https://umijs.org/docs/max/request
   */
  request: {},
  /**
   * @name React Query 插件
   * @description 使用 react-query 管理服务端状态
   * @doc https://umijs.org/docs/max/react-query
   */
  reactQuery: {},
  /**
   * @name 权限插件
   * @description 基于 initialState 的权限插件，必须先打开 initialState
   * @doc https://umijs.org/docs/max/access
   */
  access: {},
  /**
   * @name Google Analytics
   * @description 使用 GA4 (gtag.js) 进行站点分析
   * @doc https://umijs.org/docs/max/analytics
   */
  analytics: IS_DEV ? undefined : {
    ga_v2: 'G-59NF1VHHPF',
  },
  /**
   * @name <head> 中额外的 meta 标签
   * @description 配置 <head> 中额外的 meta 标签
   */
  metas: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
  ],
  /**
   * @name <head> 中额外的 script
   * @description 配置 <head> 中额外的 script
   */
  headScripts: [
    // 解决首次加载时白屏的问题
    // { src: PUBLIC_PATH + 'scripts/loading.js', async: true },
    { src: join(PUBLIC_PATH, 'scripts/loading.js'), async: true },
  ],

  //================ pro 插件配置 =================
  // 2026-10-05 临时禁用：dev server 启动卡死在 "Using openapi Plugin"（日志不再增长、端口持续 503）。
  // 该插件只负责按 oneapi.json 生成 src/services 下的代码，禁用不影响已生成代码与运行时。
  // 需要重新生成 services 时再启用。
  plugins: [],

  /**
   * @name openAPI 插件的配置
   * @description 基于 openapi 的规范生成serve 和mock，能减少很多样板代码
   * @doc https://pro.ant.design/zh-cn/docs/openapi/
   */
  // 与上方 plugins 配套：插件已禁用，openAPI 配置项必须一并移除，否则 umi 报
  // "Invalid config keys: openAPI"。重新启用插件时把这段一并放开。
  // openAPI: [
  //   {
  //     requestLibPath: "import { request } from '@umijs/max'",
  //     schemaPath: join(__dirname, 'oneapi.json'),
  //     mock: false,
  //   },
  // ],

  tailwindcss: {},

  mock: {
    include: ['src/pages/**/_mock.ts'],
    exclude: ['mock/requestRecord.mock.js'],
  },
 utoopack: {
    module: {
      rules: {
        '*.md': {
          loaders: [{ loader: join(__dirname, 'md-raw-loader.cjs') }],
          as: '*.js',
        },
      },
    },
  },
  // requestRecord: false,
  // mock: {
  //   include: ['src/pages/**/_mock.ts'],
  //   exclude: ['mock/requestRecord.mock.js'],
  // },
  // mock: false,
  // utoopack: {},
  // requestRecord: {},
  ...(IS_DEV ? {} : { exportStatic: {} }),
  define: {
    'process.env.CI': process.env.CI,
    'process.env.COMMIT_HASH': commitHash,
    __APP_VERSION__: require('./../package.json').version,
    __UMI_VERSION__: require('@umijs/max/package.json').version,
    // @utoo/pack 只是 pnpm.overrides 里的条目、并非本项目的直接依赖，
    // node_modules 中可能没有顶层包；此处仅用于注入 footer 版本号，缺失时不应让 dev server 起不来。
    __UTOO_VERSION__: (() => {
      try {
        return require('@utoo/pack/package.json').version;
      } catch {
        return '';
      }
    })(),
  },
  esbuildMinifyIIFE: true,
});
