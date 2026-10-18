import { request } from '@umijs/max';
import { getTenantId, getToken } from '@/utils/authority';
import { pickPayload } from '@/utils/utils';
import type {
  BladeResponse,
  ElementDataBatchParams,
  ElementDataMap,
  MyPortal,
  PortalElement,
  PortalElementSaveData,
  PortalPage,
  PortalPageExportData,
  PortalPageSaveData,
  PortalPageShare,
  PortalPageStatVO,
  PortalTheme,
  PortalThemeSaveData,
  ThemeVO,
} from './typings';

export type {
  BladeResponse,
  ElementDataBatchParams,
  ElementDataMap,
  ElementDataVO,
  ElementDataRow,
  ElementType,
  MyPortal,
  PortalElement,
  PortalElementSaveData,
  PortalMenu,
  PortalMenuNode,
  PortalDeptMenuVO,
  PortalMenuSaveData,
  PortalLog,
  PortalLayoutItem,
  PortalLayout,
  PortalLayoutInstantiateData,
  PortalLayoutTemplateSaveData,
  PortalElementLib,
  PortalElementLibInstantiateData,
  PortalElementLibSaveData,
  PortalLoginTemplate,
  PortalLoginTemplateSaveData,
  PortalLoginTemplateVO,
  PortalPage,
  PortalPageBrief,
  PortalPageExportData,
  PortalPageSaveData,
  PortalPageShare,
  PageResult,
  PortalOrgDefault,
  PortalTheme,
  PortalThemeSaveData,
  ThemeVO,
  PortalSetting,
  PortalSettingSaveData,
  AccountMoreVO,
  AccountMoreSaveData,
  PortalQuickSearch,
  PortalQuickSearchSaveData,
  PortalPlugin,
  PortalPluginSaveData,
  PortalMenuStyle,
  PortalMenuStyleSaveData,
  PortalElementStyle,
  PortalElementStyleSaveData,
  PortalElementTemplate,
  PortalElementTemplateSaveData,
  PortalMaterial,
  PortalMaterialSaveData,
  PortalNewsTemplate,
  PortalNewsTemplateSaveData,
  PortalGridLayout,
  PortalGridLayoutSaveData,
  PortalConfig,
  ThemeUser,
  UserThemeInfo,
  PortalElementRegister,
  PortalSynergyArea,
  WorkflowOption,
} from './typings';
export { ELEMENT_TYPE_META } from './typings';

// API 基础路径（对应 blade-portal 微服务 :8140，经网关访问）
const API_BASE_PATH = '/api/blade-portal';

/**
 * 门户引擎 API
 *
 * 说明：查看页只用到 getMyPortal + fetchElementDataBatch（一次批量取数）；
 * 其余为设计器（/portal/design）维护接口。
 */
export const portalApi = {
  /**
   * 我的门户：当前用户可见的页面 + 元素配置（已合并用户个性化）
   */
  getMyPortal: async (portalCode?: string) => {
    const response = await request<BladeResponse<MyPortal>>(`${API_BASE_PATH}/my-portal`, {
      method: 'GET',
      params: portalCode ? { portalCode } : undefined,
    });
    return pickPayload(response);
  },

  /**
   * 批量取元素数据（一次请求返回多类型，避免每元素一次请求）
   */
  fetchElementDataBatch: async (params: ElementDataBatchParams) => {
    const response = await request<BladeResponse<ElementDataMap>>(
      `${API_BASE_PATH}/element-data/batch`,
      {
        method: 'POST',
        data: params,
      },
    );
    return pickPayload(response);
  },

  /**
   * 登录前门户元素取数（免鉴权；无登录用户）
   */
  fetchPreLoginElementData: async (params: ElementDataBatchParams) => {
    const response = await request<BladeResponse<ElementDataMap>>(
      `${API_BASE_PATH}/pre-login/element-data/batch`,
      { method: 'POST', data: params },
    );
    return pickPayload(response);
  },

  /**
   * 已支持的元素类型（供设计器元素面板动态渲染）
   */
  getElementTypes: async () => {
    const response = await request<BladeResponse<string[]>>(`${API_BASE_PATH}/element-types`, {
      method: 'GET',
    });
    return pickPayload(response);
  },

  /**
   * 门户页面列表（管理端）
   */
  getPageList: async () => {
    const response = await request<BladeResponse<PortalPage[]>>(`${API_BASE_PATH}/page/list`, {
      method: 'GET',
    });
    return pickPayload(response);
  },

  /**
   * 保存门户页面（pageId 为空为新增）
   */
  submitPage: async (data: PortalPageSaveData) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/page/submit`, {
      method: 'POST',
      data,
    });
    return pickPayload(response);
  },

  /**
   * 设为默认门户
   */
  setDefaultPage: async (pageId: number) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/page/default`, {
      method: 'POST',
      params: { pageId },
    });
    return pickPayload(response);
  },

  /**
   * 公告详情（门户公告元素点击标题后查看）
   */
  getNoticeDetail: async (id: number | string) => {
    const response = await request<BladeResponse<Record<string, any>>>(`${API_BASE_PATH}/notice/detail`, {
      method: 'GET',
      params: { id },
    });
    return pickPayload(response);
  },

  /**
   * 保存元素个性化设置（当前用户的显示条数 / 标题显隐）
   */
  saveElementSetting: async (data: { elementId: number; perPage?: number; showTitle?: number }) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/element/setting`, {
      method: 'POST',
      data,
    });
    return pickPayload(response);
  },

  /**
   * 删除门户页面（级联逻辑删除元素/授权/个性化）
   */
  removePage: async (pageId: number) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/page/remove`, {
      method: 'POST',
      params: { pageId },
    });
    return pickPayload(response);
  },

  /**
   * 按页面查询元素（管理端）
   */
  getElementList: async (pageId: number) => {
    const response = await request<BladeResponse<PortalElement[]>>(`${API_BASE_PATH}/element/list`, {
      method: 'GET',
      params: { pageId },
    });
    return pickPayload(response);
  },

  /**
   * 整页保存元素（设计器保存：逻辑删除旧元素后全量插入）
   */
  saveElementBatch: async (pageId: number, elements: PortalElementSaveData[]) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/element/save-batch`, {
      method: 'POST',
      params: { pageId },
      data: elements,
    });
    return pickPayload(response);
  },

  /**
   * 删除单个元素
   */
  removeElement: async (elementId: number) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/element/remove`, {
      method: 'POST',
      params: { elementId },
    });
    return pickPayload(response);
  },

  /**
   * 机构默认首页列表（对标泛微 defaultportal）
   */
  getOrgDefaultList: async () => {
    const response = await request<BladeResponse<PortalOrgDefault[]>>(
      `${API_BASE_PATH}/page/default/org/list`,
      { method: 'GET' },
    );
    return pickPayload(response);
  },

  /**
   * 设置机构默认首页（按部门指定）
   */
  setOrgDefault: async (data: { deptId: number; pageId: number; remark?: string }) => {
    const response = await request<BladeResponse<boolean>>(
      `${API_BASE_PATH}/page/default/org/set`,
      { method: 'POST', params: data },
    );
    return pickPayload(response);
  },

  /**
   * 清除机构默认首页（按部门）
   */
  removeOrgDefault: async (deptId: number) => {
    const response = await request<BladeResponse<boolean>>(
      `${API_BASE_PATH}/page/default/org/remove`,
      { method: 'POST', params: { deptId } },
    );
    return pickPayload(response);
  },

  /**
   * 导出门户页面配置（页面 + 元素 + 授权）
   */
  exportPage: async (pageId: number) => {
    const response = await request<BladeResponse<PortalPageExportData>>(
      `${API_BASE_PATH}/page/export`,
      { method: 'GET', params: { pageId } },
    );
    return pickPayload(response);
  },

  /**
   * 导入门户页面配置（自动唯一编码、不抢默认页），返回新页面ID
   */
  importPage: async (data: PortalPageExportData) => {
    const response = await request<BladeResponse<number>>(`${API_BASE_PATH}/page/import`, {
      method: 'POST',
      data,
    });
    return pickPayload(response);
  },

  /**
   * 主题列表（当前租户全部未删除主题）
   */
  getThemeList: async () => {
    const response = await request<BladeResponse<PortalTheme[]>>(`${API_BASE_PATH}/theme/list`, {
      method: 'GET',
    });
    return pickPayload(response);
  },

  /**
   * 主题下拉选项（查看端，任意登录用户可用；供首页主题切换，免维护权限）
   */
  getThemeOptions: async () => {
    const response = await request<BladeResponse<PortalTheme[]>>(`${API_BASE_PATH}/theme/options`, {
      method: 'GET',
    });
    return pickPayload(response);
  },

  /**
   * 保存主题（themeId 为空为新增），返回主题ID
   */
  submitTheme: async (data: PortalThemeSaveData) => {
    const response = await request<BladeResponse<number>>(`${API_BASE_PATH}/theme/submit`, {
      method: 'POST',
      data,
    });
    return pickPayload(response);
  },

  /**
   * 设为默认主题（租户内仅一个默认）
   */
  setDefaultTheme: async (themeId: number) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/theme/set-default`, {
      method: 'POST',
      params: { themeId },
    });
    return pickPayload(response);
  },

  /**
   * 删除主题（默认主题不可删）
   */
  removeTheme: async (themeId: number) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/theme/remove`, {
      method: 'POST',
      params: { themeId },
    });
    return pickPayload(response);
  },

  /**
   * 我的主题偏好（当前用户选用的主题ID，无则返回 null）
   */
  getUserTheme: async () => {
    const response = await request<BladeResponse<number | null>>(`${API_BASE_PATH}/theme/user`, {
      method: 'GET',
    });
    return pickPayload(response);
  },

  /**
   * 设置我的主题（覆盖当前用户的主题偏好）
   */
  setUserTheme: async (themeId: number) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/theme/user/set`, {
      method: 'POST',
      params: { themeId },
    });
    return pickPayload(response);
  },

  /**
   * 页面可见范围列表（1全员/2部门/3个人）
   */
  getPageShareList: async (pageId: number) => {
    const response = await request<BladeResponse<PortalPageShare[]>>(`${API_BASE_PATH}/page/share/list`, {
      method: 'GET',
      params: { pageId },
    });
    return pickPayload(response);
  },

  /**
   * 保存页面可见范围（差量增删；传空数组=清空授权）
   */
  savePageShare: async (pageId: number, shares: PortalPageShare[]) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/page/share/set`, {
      method: 'POST',
      params: { pageId },
      data: shares,
    });
    return pickPayload(response);
  },

  /**
   * 复制页面（页面+元素+授权）为新页面，返回新页面ID
   */
  duplicatePage: async (pageId: number) => {
    const response = await request<BladeResponse<number>>(`${API_BASE_PATH}/page/duplicate`, {
      method: 'POST',
      params: { pageId },
    });
    return pickPayload(response);
  },

  /** 门户访问趋势：最近 days 天每日 PV（缺失日期补 0） */
  getPageViewDaily: async (days = 30) => {
    const response = await request<BladeResponse<PortalPageStatVO[]>>(`${API_BASE_PATH}/page/stats/daily`, {
      method: 'GET',
      params: { days },
    });
    return pickPayload(response);
  },

  /** 热门门户页 Top N（按 view_count 倒序） */
  getPageViewTop: async (limit = 10) => {
    const response = await request<BladeResponse<PortalPage[]>>(`${API_BASE_PATH}/page/stats/top`, {
      method: 'GET',
      params: { limit },
    });
    return pickPayload(response);
  },

  /**
   * 我的默认门户（当前用户个人默认首页ID，无则 null）
   */
  getUserDefaultPage: async () => {
    const response = await request<BladeResponse<number | null>>(`${API_BASE_PATH}/page/default/user`, {
      method: 'GET',
    });
    return pickPayload(response);
  },

  /**
   * 设为我的默认门户（landing 时优先于机构/全局默认）
   */
  setUserDefaultPage: async (pageId: number) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/page/default/user/set`, {
      method: 'POST',
      params: { pageId },
    });
    return pickPayload(response);
  },

  /**
   * 清除我的默认门户
   */
  removeUserDefaultPage: async () => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/page/default/user/remove`, {
      method: 'POST',
    });
    return pickPayload(response);
  },

  /**
   * 门户菜单列表（管理端，扁平）
   */
  getMenuList: async (menuType?: string) => {
    const response = await request<BladeResponse<PortalMenu[]>>(`${API_BASE_PATH}/menu/list`, {
      method: 'GET',
      params: menuType ? { menuType } : undefined,
    });
    return pickPayload(response);
  },

  /**
   * 保存门户菜单（menuId 为空为新增）
   */
  submitMenu: async (data: PortalMenuSaveData) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/menu/submit`, {
      method: 'POST',
      data,
    });
    return pickPayload(response);
  },

  /**
   * 删除门户菜单（含子孙；系统内置不可删）
   */
  removeMenu: async (menuId: number) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/menu/remove`, {
      method: 'POST',
      params: { menuId },
    });
    return pickPayload(response);
  },

  /**
   * 系统菜单树（前端/后端菜单）：当前用户有权限的系统导航菜单(blade_menu)，按角色授权过滤。
   * region: front 前端(左侧整树，对标 leftmenu) / top 后端(顶部仅一级，对标 topmenu)
   */
  getSystemMenuTree: async (region: 'front' | 'top' = 'front') => {
    const response = await request<BladeResponse<PortalMenuNode[]>>(`${API_BASE_PATH}/menu/system-tree`, {
      method: 'GET',
      params: { region },
    });
    return pickPayload(response);
  },

  /**
   * 门户私有菜单树（blade_portal_menu）：当前用户可见的指定类型菜单，按 blade_portal_menu_share 授权过滤。
   * menuType: front 前端(左侧整树) / top 后端(顶部) / toolbar 工具栏 / quick 快捷入口。
   * 仅在「门户应用设置 → 导航菜单源 = 门户私有菜单」时被首页消费（对标泛微 portalmenu 自有导航语义）。
   */
  getMenuTree: async (menuType: string) => {
    const response = await request<BladeResponse<PortalMenuNode[]>>(`${API_BASE_PATH}/menu/tree`, {
      method: 'GET',
      params: { menuType },
    });
    return pickPayload(response);
  },

  /**
   * 菜单可见范围列表
   */
  getMenuShareList: async (menuId: number) => {
    const response = await request<BladeResponse<PortalPageShare[]>>(`${API_BASE_PATH}/menu/share/list`, {
      method: 'GET',
      params: { menuId },
    });
    return pickPayload(response);
  },

  /**
   * 保存菜单可见范围（差量；传空数组=清空）
   */
  saveMenuShare: async (menuId: number, shares: PortalPageShare[]) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/menu/share/set`, {
      method: 'POST',
      params: { menuId },
      data: shares,
    });
    return pickPayload(response);
  },

  /**
   * 部门菜单权限反查：指定类型的全部菜单 + 该部门当前可见状态
   * menuType: front 前端菜单 / top 后端菜单
   */
  getDeptMenuShare: async (deptId: number, menuType: string) => {
    const response = await request<BladeResponse<PortalDeptMenuVO[]>>(`${API_BASE_PATH}/menu/dept/share`, {
      method: 'GET',
      params: { deptId, menuType },
    });
    return pickPayload(response);
  },

  /**
   * 部门菜单批量授权：一次性对齐该部门在指定类型下的可见菜单集合
   */
  saveDeptMenuShare: async (data: { deptId: number; menuType: string; menuIds: number[] }) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/menu/dept/share/set`, {
      method: 'POST',
      data,
    });
    return pickPayload(response);
  },

  /**
   * 门户审计日志分页（管理端）
   */
  getPortalLogList: async (params: { current?: number; size?: number; logType?: string; bizKey?: string }) => {
    const response = await request<BladeResponse<PageResult<PortalLog>>>(
      `${API_BASE_PATH}/log/list`,
      { method: 'GET', params },
    );
    return pickPayload(response);
  },

  /**
   * 保存我的门户布局（排序/行/栅格/显隐）
   */
  saveMyPortalLayout: async (data: { pageId: number; items: PortalLayoutItem[] }) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/my-portal/layout/save`, {
      method: 'POST',
      data,
    });
    return pickPayload(response);
  },

  /**
   * 重置我的门户布局（恢复创建者默认）
   */
  resetMyPortalLayout: async (pageId: number) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/my-portal/layout/reset`, {
      method: 'POST',
      params: { pageId },
    });
    return pickPayload(response);
  },

  /**
   * 添加元素到我的门户（终端用户私有元素，仅本人可见），返回新元素ID
   */
  addMyPortalElement: async (data: {
    pageId: number;
    elementType: string;
    elementName?: string;
    rowNo?: number;
    colSpan?: number;
    configJson?: string;
  }) => {
    const response = await request<BladeResponse<number>>(`${API_BASE_PATH}/my-portal/element/add`, {
      method: 'POST',
      data,
    });
    return pickPayload(response);
  },

  /**
   * 移除我的门户元素（仅限本人私有元素）
   */
  removeMyPortalElement: async (elementId: number) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/my-portal/element/remove`, {
      method: 'POST',
      params: { elementId },
    });
    return pickPayload(response);
  },

  /**
   * 编辑我的门户元素（仅限本人私有元素：标题/宽度/配置）
   */
  updateMyPortalElement: async (data: {
    elementId: number;
    elementName?: string;
    colSpan?: number;
    configJson?: string;
  }) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/my-portal/element/update`, {
      method: 'POST',
      data,
    });
    return pickPayload(response);
  },

  /* ==================== 登录前门户（皮肤 + 登录前页） ==================== */

  /** 当前登录皮肤（登录页用，免鉴权） */
  getCurrentLoginTemplate: async () => {
    const response = await request<BladeResponse<PortalLoginTemplateVO>>(`${API_BASE_PATH}/login-template/current`, {
      method: 'GET',
    });
    return pickPayload(response);
  },

  /** 登录前门户（免鉴权） */
  getPreLoginPortal: async (portalCode?: string) => {
    const response = await request<BladeResponse<MyPortal>>(`${API_BASE_PATH}/pre-login/portal`, {
      method: 'GET',
      params: portalCode ? { portalCode } : undefined,
    });
    return pickPayload(response);
  },

  /** 登录皮肤列表（管理端） */
  getLoginTemplateList: async () => {
    const response = await request<BladeResponse<PortalLoginTemplate[]>>(`${API_BASE_PATH}/login-template/list`, {
      method: 'GET',
    });
    return pickPayload(response);
  },

  /** 保存登录皮肤（templateId 空为新增），返回模板ID */
  submitLoginTemplate: async (data: PortalLoginTemplateSaveData) => {
    const response = await request<BladeResponse<number>>(`${API_BASE_PATH}/login-template/submit`, {
      method: 'POST',
      data,
    });
    return pickPayload(response);
  },

  /** 设为当前登录皮肤 */
  setCurrentLoginTemplate: async (templateId: number) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/login-template/set-current`, {
      method: 'POST',
      params: { templateId },
    });
    return pickPayload(response);
  },

  /** 删除登录皮肤 */
  removeLoginTemplate: async (templateId: number) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/login-template/remove`, {
      method: 'POST',
      params: { templateId },
    });
    return pickPayload(response);
  },

  /* ==================== 布局模板库 ==================== */

  /** 布局模板列表 */
  getLayoutList: async () => {
    const response = await request<BladeResponse<PortalLayout[]>>(`${API_BASE_PATH}/layout/list`, {
      method: 'GET',
    });
    return pickPayload(response);
  },

  /** 存页面为模板，返回模板ID */
  saveLayoutFromPage: async (data: PortalLayoutTemplateSaveData) => {
    const response = await request<BladeResponse<number>>(`${API_BASE_PATH}/layout/save-from-page`, {
      method: 'POST',
      data,
    });
    return pickPayload(response);
  },

  /** 删除布局模板 */
  removeLayout: async (layoutId: number) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/layout/remove`, {
      method: 'POST',
      params: { layoutId },
    });
    return pickPayload(response);
  },

  /** 从模板实例化新页面，返回新页面ID */
  instantiateLayout: async (data: PortalLayoutInstantiateData) => {
    const response = await request<BladeResponse<number>>(`${API_BASE_PATH}/layout/instantiate`, {
      method: 'POST',
      data,
    });
    return pickPayload(response);
  },

  /* ==================== 独立元素库 ==================== */

  /** 元素库列表 */
  getElementLibList: async () => {
    const response = await request<BladeResponse<PortalElementLib[]>>(`${API_BASE_PATH}/element-lib/list`, {
      method: 'GET',
    });
    return pickPayload(response);
  },

  /** 保存库元素（libId 空为新增），返回库元素ID */
  submitElementLib: async (data: PortalElementLibSaveData) => {
    const response = await request<BladeResponse<number>>(`${API_BASE_PATH}/element-lib/submit`, {
      method: 'POST',
      data,
    });
    return pickPayload(response);
  },

  /** 封存/解封库元素 */
  archiveElementLib: async (libId: number, archived: boolean) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/element-lib/archive`, {
      method: 'POST',
      params: { libId, archived },
    });
    return pickPayload(response);
  },

  /** 删除库元素（被引用时后端拒绝） */
  removeElementLib: async (libId: number) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/element-lib/remove`, {
      method: 'POST',
      params: { libId },
    });
    return pickPayload(response);
  },

  /** 库元素被引用页面列表 */
  getElementLibReferences: async (libId: number) => {
    const response = await request<BladeResponse<PortalPageBrief[]>>(`${API_BASE_PATH}/element-lib/references`, {
      method: 'GET',
      params: { libId },
    });
    return pickPayload(response);
  },

  /** 实例化库元素到页面，返回新元素ID */
  instantiateElementLib: async (data: PortalElementLibInstantiateData) => {
    const response = await request<BladeResponse<number>>(`${API_BASE_PATH}/element-lib/instantiate`, {
      method: 'POST',
      data,
    });
    return pickPayload(response);
  },

  /* ==================== 门户应用设置（对标泛微 portalsetting §16.3） ==================== */

  /** 读取全局应用设置（无记录时后端返回默认值兜底实例） */
  getPortalSetting: async () => {
    const response = await request<BladeResponse<PortalSetting>>(`${API_BASE_PATH}/setting/get`, {
      method: 'GET',
    });
    return pickPayload(response);
  },

  /** 保存全局应用设置 */
  savePortalSetting: async (data: PortalSettingSaveData) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/setting/save`, {
      method: 'POST',
      data,
    });
    return pickPayload(response);
  },

  /** 同步到所有人（全局字体/布局 → 所有已个性化用户），返回受影响行数 */
  syncPortalSetting: async () => {
    const response = await request<BladeResponse<number>>(`${API_BASE_PATH}/setting/sync`, {
      method: 'POST',
    });
    return pickPayload(response);
  },

  /* ==================== 个人通用设置（对标泛微 accountmore §14.2 I） ==================== */

  /** 个人设置生效值（个人优先，NULL 回退全局） */
  getAccountMore: async () => {
    const response = await request<BladeResponse<AccountMoreVO>>(`${API_BASE_PATH}/account-more/get`, {
      method: 'GET',
    });
    return pickPayload(response);
  },

  /** 保存个人设置（字段传 null=回退全局） */
  saveAccountMore: async (data: AccountMoreSaveData) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/account-more/save`, {
      method: 'POST',
      data,
    });
    return pickPayload(response);
  },

  /* ==================== 快捷搜索管理（对标泛微 quicksearchmanage §14.2 H） ==================== */

  /** 搜索类型列表 */
  getQuickSearchList: async () => {
    const response = await request<BladeResponse<PortalQuickSearch[]>>(`${API_BASE_PATH}/quick-search/list`, {
      method: 'GET',
    });
    return pickPayload(response);
  },

  /** 保存搜索类型（id 空为新增） */
  submitQuickSearch: async (data: PortalQuickSearchSaveData) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/quick-search/submit`, {
      method: 'POST',
      data,
    });
    return pickPayload(response);
  },

  /** 删除搜索类型（系统内置不可删） */
  removeQuickSearch: async (id: number) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/quick-search/remove`, {
      method: 'POST',
      params: { id },
    });
    return pickPayload(response);
  },

  /** 搜索类型使用限制列表 */
  getQuickSearchShareList: async (id: number) => {
    const response = await request<BladeResponse<PortalPageShare[]>>(`${API_BASE_PATH}/quick-search/share/list`, {
      method: 'GET',
      params: { id },
    });
    return pickPayload(response);
  },

  /** 保存搜索类型使用限制（差量；传空数组=清空） */
  saveQuickSearchShare: async (id: number, shares: PortalPageShare[]) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/quick-search/share/set`, {
      method: 'POST',
      params: { id },
      data: shares,
    });
    return pickPayload(response);
  },

  /* ==================== 插件管理（对标泛微 pluginmanage §14.2 G） ==================== */

  /** 插件列表 */
  getPluginList: async () => {
    const response = await request<BladeResponse<PortalPlugin[]>>(`${API_BASE_PATH}/plugin/list`, {
      method: 'GET',
    });
    return pickPayload(response);
  },

  /** 保存插件（id 空为新增） */
  submitPlugin: async (data: PortalPluginSaveData) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/plugin/submit`, {
      method: 'POST',
      data,
    });
    return pickPayload(response);
  },

  /** 删除插件 */
  removePlugin: async (id: number) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/plugin/remove`, {
      method: 'POST',
      params: { id },
    });
    return pickPayload(response);
  },

  /* ==================== 菜单样式库（对标泛微 menustylelib §14.2 E） ==================== */

  /** 菜单样式列表（styleType 可空：menuh/menuv） */
  getMenuStyleList: async (styleType?: string) => {
    const response = await request<BladeResponse<PortalMenuStyle[]>>(`${API_BASE_PATH}/menu-style/list`, {
      method: 'GET',
      params: styleType ? { styleType } : undefined,
    });
    return pickPayload(response);
  },

  /** 保存菜单样式（id 空为新增） */
  submitMenuStyle: async (data: PortalMenuStyleSaveData) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/menu-style/submit`, {
      method: 'POST',
      data,
    });
    return pickPayload(response);
  },

  /** 删除菜单样式 */
  removeMenuStyle: async (id: number) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/menu-style/remove`, {
      method: 'POST',
      params: { id },
    });
    return pickPayload(response);
  },

  /* ==================== 元素样式库/头条样式库（对标泛微 §15.3 B3/B4） ==================== */

  /** 元素样式列表（styleKind 可空：element/hl） */
  getElementStyleList: async (styleKind?: string) => {
    const response = await request<BladeResponse<PortalElementStyle[]>>(`${API_BASE_PATH}/element-style/list`, {
      method: 'GET',
      params: styleKind ? { styleKind } : undefined,
    });
    return pickPayload(response);
  },

  /** 保存元素样式（id 空为新增） */
  submitElementStyle: async (data: PortalElementStyleSaveData) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/element-style/submit`, {
      method: 'POST',
      data,
    });
    return pickPayload(response);
  },

  /** 删除元素样式 */
  removeElementStyle: async (id: number) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/element-style/remove`, {
      method: 'POST',
      params: { id },
    });
    return pickPayload(response);
  },

  /* ==================== 元素模板库（对标泛微 elementtemplate §15.3 B2） ==================== */

  /** 元素模板列表（elementType 可空） */
  getElementTemplateList: async (elementType?: string) => {
    const response = await request<BladeResponse<PortalElementTemplate[]>>(`${API_BASE_PATH}/element-template/list`, {
      method: 'GET',
      params: elementType ? { elementType } : undefined,
    });
    return pickPayload(response);
  },

  /** 保存元素模板（另存为；id 空为新增） */
  submitElementTemplate: async (data: PortalElementTemplateSaveData) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/element-template/submit`, {
      method: 'POST',
      data,
    });
    return pickPayload(response);
  },

  /** 删除元素模板 */
  removeElementTemplate: async (id: number) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/element-template/remove`, {
      method: 'POST',
      params: { id },
    });
    return pickPayload(response);
  },

  /** 模板实例化到页面，返回新元素ID */
  instantiateElementTemplate: async (templateId: number, pageId: number, rowNo?: number, colSpan?: number) => {
    const response = await request<BladeResponse<number>>(`${API_BASE_PATH}/element-template/instantiate`, {
      method: 'POST',
      params: { templateId, pageId, rowNo, colSpan },
    });
    return pickPayload(response);
  },

  /* ==================== 素材库/新闻模板（对标泛微 materiallib/newstemplate §15.4） ==================== */

  /** 素材列表（dirName 可空） */
  getMaterialList: async (dirName?: string) => {
    const response = await request<BladeResponse<PortalMaterial[]>>(`${API_BASE_PATH}/material/list`, {
      method: 'GET',
      params: dirName ? { dirName } : undefined,
    });
    return pickPayload(response);
  },

  /** 素材目录列表 */
  getMaterialDirs: async () => {
    const response = await request<BladeResponse<string[]>>(`${API_BASE_PATH}/material/dirs`, {
      method: 'GET',
    });
    return pickPayload(response);
  },

  /** 保存素材（id 空为新增） */
  submitMaterial: async (data: PortalMaterialSaveData) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/material/submit`, {
      method: 'POST',
      data,
    });
    return pickPayload(response);
  },

  /** 删除素材 */
  removeMaterial: async (id: number) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/material/remove`, {
      method: 'POST',
      params: { id },
    });
    return pickPayload(response);
  },

  /** 新闻模板列表（templateType 可空：inner/outer） */
  getNewsTemplateList: async (templateType?: string) => {
    const response = await request<BladeResponse<PortalNewsTemplate[]>>(`${API_BASE_PATH}/news-template/list`, {
      method: 'GET',
      params: templateType ? { templateType } : undefined,
    });
    return pickPayload(response);
  },

  /** 保存新闻模板（id 空为新增） */
  submitNewsTemplate: async (data: PortalNewsTemplateSaveData) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/news-template/submit`, {
      method: 'POST',
      data,
    });
    return pickPayload(response);
  },

  /** 删除新闻模板 */
  removeNewsTemplate: async (id: number) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/news-template/remove`, {
      method: 'POST',
      params: { id },
    });
    return pickPayload(response);
  },

  /** 设为默认新闻模板（同类型内唯一） */
  setDefaultNewsTemplate: async (id: number) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/news-template/set-default`, {
      method: 'POST',
      params: { id },
    });
    return pickPayload(response);
  },

  /* ==================== 特色门户/门户网格布局（对标泛微 tsportal §16.2） ==================== */

  /** 网格布局列表（layoutType 可空：login/theme） */
  getGridLayoutList: async (layoutType?: string) => {
    const response = await request<BladeResponse<PortalGridLayout[]>>(`${API_BASE_PATH}/grid-layout/list`, {
      method: 'GET',
      params: layoutType ? { layoutType } : undefined,
    });
    return pickPayload(response);
  },

  /** 保存网格布局（id 空为新增；defaultEntrance=1 时同类型内唯一） */
  submitGridLayout: async (data: PortalGridLayoutSaveData) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/grid-layout/submit`, {
      method: 'POST',
      data,
    });
    return pickPayload(response);
  },

  /** 删除网格布局（默认入口不可删） */
  removeGridLayout: async (id: number) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/grid-layout/remove`, {
      method: 'POST',
      params: { id },
    });
    return pickPayload(response);
  },

  /** 启用/停用网格布局 */
  setGridLayoutUse: async (id: number, use: boolean) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/grid-layout/set-use`, {
      method: 'POST',
      params: { id, use },
    });
    return pickPayload(response);
  },

  /** 设为默认入口（同类型内唯一） */
  setGridLayoutDefaultEntrance: async (id: number) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/grid-layout/set-default-entrance`, {
      method: 'POST',
      params: { id },
    });
    return pickPayload(response);
  },

  /** 网格布局使用限制列表 */
  getGridLayoutShareList: async (id: number) => {
    const response = await request<BladeResponse<PortalPageShare[]>>(`${API_BASE_PATH}/grid-layout/share/list`, {
      method: 'GET',
      params: { id },
    });
    return pickPayload(response);
  },

  /** 保存网格布局使用限制（差量；传空数组=清空） */
  saveGridLayoutShare: async (id: number, shares: PortalPageShare[]) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/grid-layout/share/set`, {
      method: 'POST',
      params: { id },
      data: shares,
    });
    return pickPayload(response);
  },

  /* ==================== 主题批量指定/使用查询（对标泛微 themeappoint/themesearch §15.5 A3/A4） ==================== */

  /** 按人员范围批量指定主题，返回生效用户数 */
  appointTheme: async (themeId: number, scopeType: number, scopeIds?: number[]) => {
    const response = await request<BladeResponse<number>>(`${API_BASE_PATH}/theme/appoint`, {
      method: 'POST',
      params: { themeId, scopeType },
      data: scopeIds || [],
    });
    return pickPayload(response);
  },

  /** 主题整体迁移（源主题全部偏好用户 → 目标主题），返回迁移用户数 */
  migrateTheme: async (fromThemeId: number, toThemeId: number) => {
    const response = await request<BladeResponse<number>>(`${API_BASE_PATH}/theme/migrate`, {
      method: 'POST',
      params: { fromThemeId, toThemeId },
    });
    return pickPayload(response);
  },

  /** 反查主题使用人员（分页） */
  getThemeUsers: async (params: { themeId: number; current?: number; size?: number }) => {
    const response = await request<BladeResponse<PageResult<ThemeUser>>>(`${API_BASE_PATH}/theme/users`, {
      method: 'GET',
      params,
    });
    return pickPayload(response);
  },

  /** 查人员当前主题（显式偏好 + 生效主题） */
  getThemeUserInfo: async (userId: number) => {
    const response = await request<BladeResponse<UserThemeInfo>>(`${API_BASE_PATH}/theme/user-info`, {
      method: 'GET',
      params: { userId },
    });
    return pickPayload(response);
  },

  /* ==================== 门户配置项（对标泛微 portalconfig §16.6） ==================== */

  /** 配置项列表 */
  getPortalConfigList: async () => {
    const response = await request<BladeResponse<PortalConfig[]>>(`${API_BASE_PATH}/config/list`, {
      method: 'GET',
    });
    return pickPayload(response);
  },

  /** 修改配置取值（写库后后端刷新进程内缓存） */
  setPortalConfigValue: async (ccode: string, vvalue: string) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/config/set`, {
      method: 'POST',
      params: { ccode, vvalue },
    });
    return pickPayload(response);
  },

  /** 读取配置值（运行时消费点查询；无记录返回 null） */
  getPortalConfigValue: async (ccode: string) => {
    const response = await request<BladeResponse<string>>(`${API_BASE_PATH}/config/value`, {
      method: 'GET',
      params: { ccode },
    });
    return pickPayload(response);
  },

  /* ==================== 元素注册（对标泛微 elementregister §15.3 B5） ==================== */

  /** 上传注册元素开发包（zip，≤10MB，含 manifest.json），返回注册ID（失败返回 null） */
  uploadElementRegister: async (file: File) => {
    // 走原生 fetch + FormData（umi request 无 multipart 封装；与 ImageUploader 上传模式一致）
    const form = new FormData();
    form.append('file', file);
    const token = getToken() || '';
    const tenantId = getTenantId() || '000000';
    const res = await fetch(`${API_BASE_PATH}/element-register/upload`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic c2FiZXI6c2FiZXJfc2VjcmV0',
        'Blade-Auth': `bearer ${token}`,
        'Tenant-Id': tenantId,
      },
      body: form,
    });
    const json = await res.json();
    if (json && json.success && json.data != null) {
      return json.data as number;
    }
    return null;
  },

  /** 元素注册列表 */
  getElementRegisterList: async () => {
    const response = await request<BladeResponse<PortalElementRegister[]>>(`${API_BASE_PATH}/element-register/list`, {
      method: 'GET',
    });
    return pickPayload(response);
  },

  /** 注销元素注册 */
  removeElementRegister: async (id: number) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/element-register/remove`, {
      method: 'POST',
      params: { id },
    });
    return pickPayload(response);
  },

  /* ==================== 协同区（对标泛微 synergy §15.7 C2；知识型延后） ==================== */

  /** 协同区树（按 area_type 分组） */
  getSynergyTree: async () => {
    const response = await request<BladeResponse<Record<string, PortalSynergyArea[]>>>(`${API_BASE_PATH}/synergy/tree`, {
      method: 'GET',
    });
    return pickPayload(response);
  },

  /** 保存协同区（新增/更新） */
  saveSynergy: async (dto: Partial<PortalSynergyArea>) => {
    const response = await request<BladeResponse<PortalSynergyArea>>(`${API_BASE_PATH}/synergy/save`, {
      method: 'POST',
      data: dto,
    });
    return pickPayload(response);
  },

  /** 注销协同区 */
  removeSynergy: async (id: number) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/synergy/remove`, {
      method: 'POST',
      params: { id },
    });
    return pickPayload(response);
  },

  /** 启用/禁用协同区 */
  setSynergyEnabled: async (id: number, enabled: number) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/synergy/set-enabled`, {
      method: 'POST',
      params: { id, enabled },
    });
    return pickPayload(response);
  },

  /** 设置协同区宽度 */
  setSynergyWidth: async (id: number, width: number) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/synergy/set-width`, {
      method: 'POST',
      params: { id, width },
    });
    return pickPayload(response);
  },

  /** 保存协同区扩展参数 */
  saveSynergyParams: async (id: number, paramsJson: string) => {
    const response = await request<BladeResponse<boolean>>(`${API_BASE_PATH}/synergy/save-params`, {
      method: 'POST',
      params: { id, paramsJson },
    });
    return pickPayload(response);
  },

  /** 已发布流程定义选项（深度对接 blade-workflow） */
  getSynergyWorkflowOptions: async () => {
    const response = await request<BladeResponse<WorkflowOption[]>>(`${API_BASE_PATH}/synergy/workflow-options`, {
      method: 'GET',
    });
    return pickPayload(response);
  },

  /** 流程节点选项（按流程定义ID） */
  getSynergyNodeOptions: async (defId: string | number) => {
    const response = await request<BladeResponse<WorkflowOption[]>>(`${API_BASE_PATH}/synergy/node-options`, {
      method: 'GET',
      params: { defId },
    });
    return pickPayload(response);
  },

  /** 流程表单字段（按流程定义ID；供流程表单协同区字段映射） */
  getSynergyWfFields: async (defId: string | number) => {
    const response = await request<BladeResponse<Array<{ key?: string; label?: string; control?: string }>>>(`${API_BASE_PATH}/synergy/wf-fields`, {
      method: 'GET',
      params: { defId },
    });
    return pickPayload(response);
  },
};
