/**
 * 门户引擎前端类型定义
 * 与后端 org.springblade.portal.vo / entity 严格对应
 */

/** 门户页面 */
export interface PortalPage {
  id?: number;
  tenantId?: string;
  pageCode: string;
  pageName: string;
  isDefault?: number;
  /** 页面类型：0登录前门户 1登录后门户 */
  pageType?: number;
  /** 访问次数（热度统计） */
  viewCount?: number;
  sort?: number;
  theme?: string;
  remark?: string;
  isDeleted?: number;
  status?: number;
  createTime?: string;
  updateTime?: string;
}

/** 页面保存入参 */
export interface PortalPageSaveData {
  pageId?: number;
  pageCode: string;
  pageName: string;
  isDefault?: number;
  pageType?: number;
  sort?: number;
  theme?: string;
  remark?: string;
}

/** 登录前门户皮肤模板（对标 SystemLoginTemplate） */
export interface PortalLoginTemplate {
  id?: number;
  templateName?: string;
  templateType?: string;
  isCurrent?: number;
  openTimer?: number;
  timerStart?: string;
  timerEnd?: string;
}

/** 登录皮肤保存入参 */
export interface PortalLoginTemplateSaveData {
  templateId?: number;
  templateName: string;
  templateType?: string;
  backgroundConfig?: Record<string, any>;
  logoConfig?: Record<string, any>;
  formConfig?: Record<string, any>;
  qrcodeConfig?: Record<string, any>;
  copyrightConfig?: Record<string, any>;
  openTimer?: number;
  timerStart?: string;
  timerEnd?: string;
}

/** 登录皮肤视图（config 已解析，供登录页渲染） */
export interface PortalLoginTemplateVO {
  id?: number;
  templateName?: string;
  templateType?: string;
  backgroundConfig?: Record<string, any>;
  logoConfig?: Record<string, any>;
  formConfig?: Record<string, any>;
  qrcodeConfig?: Record<string, any>;
  copyrightConfig?: Record<string, any>;
  isCurrent?: number;
}

/** 布局模板 */
export interface PortalLayout {
  id?: number;
  layoutName?: string;
  layoutType?: string;
  remark?: string;
  /** 元素排列 JSON（页面级元素快照，用于缩略图预览） */
  elementsJson?: string;
}

/** 布局模板保存入参（存页面为模板） */
export interface PortalLayoutTemplateSaveData {
  pageId: number;
  layoutName: string;
  layoutType?: string;
  remark?: string;
}

/** 布局模板实例化入参 */
export interface PortalLayoutInstantiateData {
  layoutId: number;
  pageCode: string;
  pageName?: string;
}

/** 独立元素库元素 */
export interface PortalElementLib {
  id?: number;
  elementType?: string;
  elementName?: string;
  configJson?: string;
  styleJson?: string;
  remark?: string;
  status?: number;
}

/** 元素库保存入参 */
export interface PortalElementLibSaveData {
  libId?: number;
  elementType: string;
  elementName: string;
  configJson?: string;
  styleJson?: string;
  remark?: string;
}

/** 元素库实例化入参 */
export interface PortalElementLibInstantiateData {
  libId: number;
  pageId: number;
  rowNo?: number;
  colSpan?: number;
}

/** 门户元素（配置视图，已合并用户个性化） */
export interface PortalElement {
  id?: number;
  /** 归属用户ID（0=页面级共享；>0=终端用户私有，可删） */
  ownerUserId?: number;
  elementType: ElementType;
  elementName?: string;
  showTitle?: number;
  rowNo?: number;
  colSpan?: number;
  sortOrder?: number;
  /** 元素私有配置（后端已从 JSON 解析为对象） */
  config?: Record<string, any>;
  /** 元素样式配置 */
  style?: Record<string, any>;
  /** 显示条数（元素定义 + 用户个性化合并结果） */
  perPage?: number;
}

/** 元素保存入参 */
export interface PortalElementSaveData {
  elementId?: number;
  pageId?: number;
  elementType: ElementType;
  elementName?: string;
  showTitle?: number;
  rowNo?: number;
  colSpan?: number;
  sortOrder?: number;
  /** 注意：保存时需为 JSON 字符串 */
  configJson?: string;
  styleJson?: string;
}

/** 我的门户聚合结果 */
export interface MyPortal {
  pageId?: number;
  pageCode?: string;
  pageName?: string;
  theme?: string;
  remark?: string;
  /** 生效主题（已解析：用户偏好 > 页面主题 > 租户默认） */
  resolvedTheme?: ThemeVO;
  elements?: PortalElement[];
  /** 当前用户可见的全部门户页面（多门户切换；已按授权过滤） */
  visiblePages?: PortalPageBrief[];
  /** 导航菜单源（1系统菜单 2门户私有菜单 front/top；首页据此分流菜单接口） */
  menuSource?: number;
  /** 是否允许页面维护者在查看页进入编辑布局（配置项 canPageMaintainerSettingInViewpage） */
  canMaintainInViewpage?: number;
}

/** 可见门户页面简要信息（切换用） */
export interface PortalPageBrief {
  id?: number;
  pageCode?: string;
  pageName?: string;
  isDefault?: number;
}

/** 个人门户布局项（对标 hpcurrentuse） */
export interface PortalLayoutItem {
  elementId?: number;
  rowNo?: number;
  colSpan?: number;
  sortOrder?: number;
  hidden?: number;
}

/** 门户审计日志 */
export interface PortalLog {
  id?: number;
  logType?: string;
  bizType?: string;
  bizKey?: string;
  title?: string;
  summary?: string;
  beforeJson?: string;
  afterJson?: string;
  status?: number;
  errorMsg?: string;
  createUser?: number;
  createDept?: number;
  createTime?: string;
  ip?: string;
}

/** 分页结果（Mybatis-Plus IPage 序列化结构） */
export interface PageResult<T> {
  records: T[];
  total: number;
  current?: number;
  size?: number;
  pages?: number;
}

/** 生效主题（来自 /my-portal 的 resolvedTheme；themeConfig 为已解析对象） */
export interface ThemeVO {
  themeKey?: string;
  themeName?: string;
  themeConfig?: Record<string, any>;
}

/** 主题库实体（来自 /theme/list；注意 themeConfig 是 JSON 字符串，前端需 JSON.parse） */
export interface PortalTheme {
  id?: number;
  themeName?: string;
  themeKey?: string;
  themeConfig?: string;
  isDefault?: number;
  sort?: number;
  /** 是否开启定时切换（0否 1是） */
  openTimer?: number;
  timerStart?: string;
  timerEnd?: string;
}

/** 主题保存入参（themeConfig 为对象，后端按 Map 接收） */
export interface PortalThemeSaveData {
  themeId?: number;
  themeName: string;
  themeKey: string;
  themeConfig: Record<string, any>;
  openTimer?: number;
  timerStart?: string;
  timerEnd?: string;
}

/** 主题使用人员（反查 getAllHrmOfTheme） */
export interface ThemeUser {
  userId?: number;
  account?: string;
  realName?: string;
  deptId?: number;
  updateTime?: string;
}

/** 人员当前主题详情（查人员 getAllThemesOfUserId） */
export interface UserThemeInfo {
  userId?: number;
  account?: string;
  realName?: string;
  deptId?: number;
  hasExplicit?: boolean;
  themeId?: number;
  themeName?: string;
  effectiveThemeName?: string;
}

/** 门户访问趋势（按日聚合 PV/UV） */
export interface PortalPageStatVO {
  /** 统计日期 yyyy-MM-dd */
  statDate: string;
  /** 当日访问量(PV) */
  viewCount: number;
  /** 当日独立访客数(UV) */
  uv?: number;
}

/** 元素类型 */
export type ElementType = 'todo' | 'notice' | 'message' | 'chart' | 'links' | 'rich';

/** 元素类型中文名与图标（设计器元素面板 / 查看页兜底用） */
export const ELEMENT_TYPE_META: Record<ElementType, { label: string; icon: string; desc: string }> = {
  todo: { label: '我的待办', icon: '✅', desc: '当前登录人的流程待办，可直接跳转办理' },
  notice: { label: '通知公告', icon: '📢', desc: '取通知公告表最新发布内容' },
  message: { label: '消息提醒', icon: '💬', desc: '站内消息未读红点与消息中心入口' },
  chart: { label: '统计图表', icon: '📊', desc: '柱状/折线图，按配置渲染' },
  links: { label: '快捷链接', icon: '🔗', desc: '常用系统入口宫格' },
  rich: { label: '富文本公告', icon: '📝', desc: '自定义 HTML 内容区块' },
};

/** 元素数据类型（后端返回的通用行结构） */
export type ElementDataRow = Record<string, any>;

/** 单个元素类型的数据与状态 */
export interface ElementDataVO {
  type: string;
  data: ElementDataRow[];
  success: boolean;
  message?: string;
}

/** 批量取数结果：key = elementId（元素维度）或 elementType（类型维度兼容） */
export type ElementDataMap = Record<string, ElementDataVO>;

/** 元素维度取数引用 */
export interface ElementDataElementRef {
  elementId: number;
  type: string;
  perPage?: number;
}

/** 批量取数入参（优先 elements 元素维度；types 为兼容旧口径） */
export interface ElementDataBatchParams {
  types?: string[];
  limit?: number;
  pageId?: number;
  elements?: ElementDataElementRef[];
}

/** SpringBlade 统一响应 */
export interface BladeResponse<T> {
  code: number;
  data: T;
  msg: string;
  success: boolean;
}

/** 机构默认首页配置（对标泛微 defaultportal） */
export interface PortalOrgDefault {
  id?: number;
  deptId: number;
  pageId: number;
  remark?: string;
  createTime?: string;
}

/** 页面授权（可见范围：1全员 2部门 3个人） */
export interface PortalPageShare {
  id?: number;
  shareType?: number;
  shareId?: number;
}

/** 门户菜单 */
export interface PortalMenu {
  id?: number;
  parentId?: number;
  menuName?: string;
  icon?: string;
  routeUrl?: string;
  menuType?: string;
  linkMode?: number;
  sortOrder?: number;
  visible?: number;
  isSystem?: number;
}

/** 门户菜单保存入参 */
export interface PortalMenuSaveData {
  menuId?: number;
  parentId?: number;
  menuName: string;
  icon?: string;
  routeUrl?: string;
  menuType: string;
  linkMode?: number;
  sortOrder?: number;
  visible?: number;
}

/** 门户菜单树节点 */
export interface PortalMenuNode {
  id?: number;
  parentId?: number;
  menuName?: string;
  icon?: string;
  routeUrl?: string;
  menuType?: string;
  linkMode?: number;
  sortOrder?: number;
  visible?: number;
  children?: PortalMenuNode[];
}

/** 门户页面导出数据（页面 + 元素 + 授权） */
export interface PortalPageExportData {
  page: PortalPage;
  elements: PortalElement[];
  shares: PortalPageShare[];
}

/* ==================== 门户应用设置（对标泛微 portalsetting §16.3） ==================== */

/** 门户应用设置（租户单例；数字为 0/1 开关） */
export interface PortalSetting {
  id?: number;
  tenantId?: string;
  needRefresh?: number;
  refreshScope?: number;
  refreshMins?: number;
  rsstype?: number;
  showLastHp?: number;
  showNoRightElement?: number;
  hiddenMyPortal?: number;
  autoSortTopMenu?: number;
  defaultExpandLeft?: number;
  showTopMenuFullName?: number;
  showFreqMenu?: number;
  quickSearchEnabled?: number;
  layoutType?: number;
  fontSize?: number;
  /** 导航菜单源：1系统菜单(blade_menu) 2门户私有菜单(blade_portal_menu front/top) */
  menuSource?: number;
}

/** 门户应用设置保存入参 */
export interface PortalSettingSaveData {
  needRefresh?: number;
  refreshScope?: number;
  refreshMins?: number;
  rsstype?: number;
  showLastHp?: number;
  showNoRightElement?: number;
  hiddenMyPortal?: number;
  autoSortTopMenu?: number;
  defaultExpandLeft?: number;
  showTopMenuFullName?: number;
  showFreqMenu?: number;
  quickSearchEnabled?: number;
  layoutType?: number;
  fontSize?: number;
  /** 导航菜单源：1系统菜单(blade_menu) 2门户私有菜单(blade_portal_menu front/top) */
  menuSource?: number;
}

/* ==================== 个人通用设置（对标泛微 accountmore §14.2 I） ==================== */

/** 个人通用设置生效值（个人优先，NULL 回退全局） */
export interface AccountMoreVO {
  fontSize?: number;
  layoutType?: number;
  menuConfig?: Record<string, any>;
  /** 个人原始字体值（null=未设置沿用全局；供设置表单回显） */
  personalFontSize?: number | null;
  /** 个人原始布局值（null=未设置沿用全局；供设置表单回显） */
  personalLayoutType?: number | null;
  globalFontSize?: number;
  globalLayoutType?: number;
  quickSearchEnabled?: number;
  hiddenMyPortal?: number;
  showFreqMenu?: number;
  defaultExpandLeft?: number;
}

/** 个人通用设置保存入参（字段传 null=回退全局） */
export interface AccountMoreSaveData {
  fontSize?: number | null;
  layoutType?: number | null;
  menuConfig?: Record<string, any>;
}

/* ==================== 快捷搜索（对标泛微 quick_search_types §14.2 H） ==================== */

/** 快捷搜索类型 */
export interface PortalQuickSearch {
  id?: number;
  module?: string;
  type?: string;
  customName?: string;
  icon?: string;
  url?: string;
  linkMode?: number;
  isUse?: number;
  isSys?: number;
  orderNum?: number;
  remark?: string;
}

/** 快捷搜索类型保存入参 */
export interface PortalQuickSearchSaveData {
  id?: number;
  module: string;
  type: string;
  customName: string;
  icon?: string;
  url?: string;
  linkMode?: number;
  isUse?: number;
  orderNum?: number;
  remark?: string;
}

/* ==================== 插件管理（对标泛微 hppluginsetting §14.2 G） ==================== */

/** 门户插件登记 */
export interface PortalPlugin {
  id?: number;
  pid?: string;
  pluginDesc?: string;
  filePath?: string;
  isUse?: number;
  orderNum?: number;
  pType?: string;
  remark?: string;
}

/** 门户插件保存入参 */
export interface PortalPluginSaveData {
  id?: number;
  pid: string;
  pluginDesc?: string;
  filePath?: string;
  isUse?: number;
  orderNum?: number;
  pType?: string;
  remark?: string;
}

/* ==================== 菜单样式库（对标泛微 hpMenuStyle menuh/menuv §14.2 E） ==================== */

/** 菜单样式 */
export interface PortalMenuStyle {
  id?: number;
  styleName?: string;
  styleDesc?: string;
  styleType?: string;
  styleConfig?: string;
  citeCount?: number;
  remark?: string;
}

/** 菜单样式保存入参 */
export interface PortalMenuStyleSaveData {
  id?: number;
  styleName: string;
  styleDesc?: string;
  styleType: string;
  styleConfig?: Record<string, any>;
  remark?: string;
}

/* ==================== 元素样式库/头条样式库（对标泛微 §15.3 B3/B4） ==================== */

/** 元素样式（styleKind 区分 element 元素样式 / headline 头条样式） */
export interface PortalElementStyle {
  id?: number;
  styleKind?: string;
  styleName?: string;
  styleDesc?: string;
  styleConfig?: string;
  citeCount?: number;
  remark?: string;
}

/** 元素样式保存入参 */
export interface PortalElementStyleSaveData {
  id?: number;
  styleKind: string;
  styleName: string;
  styleDesc?: string;
  styleConfig?: Record<string, any>;
  remark?: string;
}

/* ==================== 元素模板库（对标泛微 HPELEMENTTEMPLATE §15.3 B2） ==================== */

/** 元素模板 */
export interface PortalElementTemplate {
  id?: number;
  elementType?: string;
  templateName?: string;
  configJson?: string;
  styleJson?: string;
  remark?: string;
}

/** 元素模板保存入参 */
export interface PortalElementTemplateSaveData {
  id?: number;
  elementType: string;
  templateName: string;
  config?: Record<string, any>;
  style?: Record<string, any>;
  remark?: string;
}

/* ==================== 素材库/新闻模板（对标泛微 materiallib/newstemplate §15.4） ==================== */

/** 素材库元数据 */
export interface PortalMaterial {
  id?: number;
  dirName?: string;
  materialName?: string;
  materialType?: string;
  fileUrl?: string;
  fileSize?: number;
  mimeType?: string;
  remark?: string;
}

/** 素材保存入参 */
export interface PortalMaterialSaveData {
  id?: number;
  dirName: string;
  materialName: string;
  materialType?: string;
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
  remark?: string;
}

/** 新闻模板 */
export interface PortalNewsTemplate {
  id?: number;
  templateName?: string;
  templateType?: string;
  layoutHtml?: string;
  isDefault?: number;
  remark?: string;
}

/** 新闻模板保存入参 */
export interface PortalNewsTemplateSaveData {
  id?: number;
  templateName: string;
  templateType: string;
  layoutHtml?: string;
  isDefault?: number;
  remark?: string;
}

/* ==================== 特色门户/门户网格布局（对标泛微 tsportal §16.2 hp_grid_layout） ==================== */

/** 门户网格布局（layoutType：login 登录前门户 / theme 登录后门户） */
export interface PortalGridLayout {
  id?: number;
  layoutType?: string;
  layoutName?: string;
  layoutTitle?: string;
  layoutUse?: number;
  layoutDefaultEntrance?: number;
  layoutConfig?: string;
  layoutBackground?: string;
  layoutVersion?: number;
  remark?: string;
}

/** 门户网格布局保存入参 */
export interface PortalGridLayoutSaveData {
  id?: number;
  layoutType: string;
  layoutName: string;
  layoutTitle?: string;
  layoutConfig?: string;
  layoutBackground?: string;
  layoutUse?: number;
  layoutDefaultEntrance?: number;
  remark?: string;
}

/* ==================== 门户配置项（对标泛微 portalconfig §16.6） ==================== */

/** 门户配置项（ccode/vvalue/name/note 键值配置） */
export interface PortalConfig {
  id?: number;
  ccode?: string;
  vvalue?: string;
  name?: string;
  note?: string;
}

/* ==================== 元素注册（对标泛微 elementregister §15.3 B5） ==================== */

/** 元素注册记录（zip 开发包登记） */
export interface PortalElementRegister {
  id?: number;
  elementType?: string;
  elementName?: string;
  version?: string;
  manifestJson?: string;
  packagePath?: string;
  packageSize?: number;
  createTime?: string;
}

/* ==================== 协同区（对标泛微 synergy §15.7 C2；知识型延后） ==================== */

/** 协同区配置（流程 workflow / 流程表单 form / 流程节点 node） */
export interface PortalSynergyArea {
  id?: number;
  areaType?: 'workflow' | 'form' | 'node';
  title?: string;
  bindId?: string;
  bindName?: string;
  nodeId?: string;
  nodeName?: string;
  formId?: string;
  enabled?: number;
  width?: number;
  paramsJson?: string;
  createTime?: string;
}

/** 绑定选项（流程/节点下拉，复用 blade-workflow 的 BrowserOptionVO） */
export interface WorkflowOption {
  value?: string;
  label?: string;
}
