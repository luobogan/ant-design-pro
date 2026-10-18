import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Col, ConfigProvider, Drawer, Empty, Form, Input, InputNumber, Menu, Modal, Popconfirm, Row, Select, Space, Spin, Switch, Tag, Typography, message, theme as antdTheme } from 'antd';
import { ReloadOutlined, SettingOutlined, AppstoreOutlined, DashboardOutlined, EditOutlined, SaveOutlined, CloseOutlined, UndoOutlined, EyeOutlined, EyeInvisibleOutlined, UpOutlined, DownOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { history, useModel, useSearchParams } from '@umijs/max';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { portalApi, ELEMENT_TYPE_META } from '@/services/portal';
import { usePageButtons } from '@/hooks/usePageButtons';
import ElementShell from '../components/ElementShell';
import ElementRenderer, { REGISTERED_ELEMENT_TYPES } from '../components/ElementRegistry';
import { useElementData } from '../hooks/useElementData';
import type { AccountMoreVO, ElementType, MyPortal, PortalElement, PortalLayoutItem, PortalMenuNode, PortalTheme } from '@/services/portal';

dayjs.locale('zh-cn');

const { Title, Text } = Typography;

/** 按元素类型构建私有元素的 configJson（todo/notice/message→perPage；chart→图表配置；links→入口；rich→html） */
const buildAddConfig = (v: any): Record<string, any> => {
  switch (v.elementType) {
    case 'todo':
    case 'notice':
    case 'message':
      return { ...(v.perPage ? { perPage: v.perPage } : {}), dataOrgScope: v.dataOrgScope ?? 1 };
    case 'chart': {
      let data: any[] = [];
      try {
        data = v.chartData ? JSON.parse(v.chartData) : [];
      } catch {
        data = [];
      }
      return { chartType: v.chartType || 'column', xField: v.xField || 'x', yField: v.yField || 'y', data, dataOrgScope: v.dataOrgScope ?? 1 };
    }
    case 'links':
      return { links: (v.links || []).filter((l: any) => l && l.name) };
    case 'rich':
      return { html: v.richHtml || '' };
    default:
      return {};
  }
};

/**
 * 门户查看页（配置驱动）
 *
 * 数据流：
 *   GET /blade-portal/my-portal      → 页面 + 元素配置（已合并用户个性化）
 *   POST /blade-portal/element-data/batch → 本页去重后的元素类型数据（一次请求）
 *   前端按 elementType 走注册表渲染 + antd 24 栅格布局（rowNo / colSpan）
 *
 * 页面文件路径由 blade_menu 的 /portal（单段顶级路径）解析而来，
 * 详见 src/app.tsx buildComponentLoaders 的单段分支。
 */
const PortalPage: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const currentUser = initialState?.currentUser as any;
  const [refreshing, setRefreshing] = useState(false);
  /** 门户管理按钮（挂在 portal 菜单下：portal_page_manage）——控制「页面管理」入口显隐 */
  const { buttons: pageButtons } = usePageButtons('portal');
  const canManagePortal = pageButtons.some((b: any) => b.code === 'portal_page_manage');

  const [searchParams] = useSearchParams();
  /** URL 上的 code = 门户标识（page_code），对标 E-cology 的 portal-9-5；不传则取当前用户可见的默认门户 */
  const portalCode = searchParams.get('code') || undefined;

  const [portal, setPortal] = useState<MyPortal | undefined>(undefined);
  const [portalLoading, setPortalLoading] = useState(true);
  const [portalError, setPortalError] = useState<string | undefined>(undefined);

  /* ==================== 前端/后端菜单（导航源可配置，V2026.10.16_007） ==================== */
  /** 门户后端菜单（顶部导航）：源=系统菜单时取 blade_menu 顶级（对标 topmenu）；源=门户私有时取 blade_portal_menu(type=top) */
  const [topMenus, setTopMenus] = useState<PortalMenuNode[]>([]);
  /** 门户前端菜单（应用宫格数据源）：源=系统菜单时取 blade_menu 整树；源=门户私有时取 blade_portal_menu(type=front) */
  const [frontMenus, setFrontMenus] = useState<PortalMenuNode[]>([]);

  /**
   * 按导航菜单源加载菜单（menuSource：1=系统菜单 blade_menu / 2=门户私有菜单 blade_portal_menu）
   * <p>泛微为 LEFTMenuInfo/MAINMenuInfo 两物理表；本项目同表分型 + 源可配置（方案一），
   * 由门户应用设置下发 menuSource，首页据此分流 /menu/system-tree 或 /menu/tree。</p>
   */
  const loadMenus = useCallback((menuSource: number) => {
    const fromPortal = menuSource === 2;
    const topReq = fromPortal ? portalApi.getMenuTree('top') : portalApi.getSystemMenuTree('top');
    const frontReq = fromPortal ? portalApi.getMenuTree('front') : portalApi.getSystemMenuTree('front');
    topReq.then((data) => setTopMenus(data || [])).catch(() => setTopMenus([]));
    frontReq.then((data) => setFrontMenus(data || [])).catch(() => setFrontMenus([]));
  }, []);

  /**
   * 加载门户配置
   * 采用 useEffect + useState 直接 await（与 FormMode 列表页一致的项目既有范式），
   * 规避 useRequest 在本项目 getResponse=false 下的取值层级差异。
   * portalCode 变化（切换门户）时自动重新拉取。
   */
  const loadPortal = useCallback(async () => {
    setPortalLoading(true);
    try {
      const data = await portalApi.getMyPortal(portalCode);
      setPortal(data);
      setPortalError(undefined);
      // 导航菜单源随门户数据下发（V2026.10.16_007）：1=系统菜单 2=门户私有菜单
      loadMenus(data?.menuSource ?? 1);
    } catch (e) {
      console.error('[portal] 加载我的门户失败', e);
      setPortal(undefined);
      setPortalError('门户服务不可用，请确认 blade-portal 服务已启动（端口 8140），稍后重试。');
    } finally {
      setPortalLoading(false);
    }
  }, [portalCode, loadMenus]);

  useEffect(() => {
    loadPortal();
  }, [loadPortal]);

  const elements: PortalElement[] = useMemo(() => {
    const list = portal?.elements || [];
    return [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [portal?.elements]);

  /** 元素维度批量取数：一次请求按 elementId 取本页所有元素（§22 #5/#6） */
  const {
    dataMap,
    loading: dataLoading,
    error: dataError,
    refresh: refreshData,
  } = useElementData(elements, portal?.pageId);

  /** 按 rowNo 分组渲染，保证与配置的行/列一致 */
  const rows = useMemo(() => {
    const grouped = new Map<number, PortalElement[]>();
    elements.forEach((el) => {
      const rowNo = el.rowNo || 1;
      const bucket = grouped.get(rowNo) || [];
      bucket.push(el);
      grouped.set(rowNo, bucket);
    });
    return Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
  }, [elements]);

  /* ==================== 我的门户布局个性化（对标 hpcurrentuse §18.2） ==================== */
  type DraftEl = PortalElement & { _hidden?: boolean };
  const [editLayout, setEditLayout] = useState(false);
  const [draft, setDraft] = useState<DraftEl[]>([]);
  const [layoutSaving, setLayoutSaving] = useState(false);

  /** 编辑态渲染分组：编辑时取 draft（可排序/显隐），否则取合并后的 elements */
  const renderGroups = useMemo(() => {
    const src = (editLayout ? draft : elements) as DraftEl[];
    const grouped = new Map<number, DraftEl[]>();
    src.forEach((el) => {
      const rowNo = el.rowNo || 1;
      const bucket = grouped.get(rowNo) || [];
      bucket.push(el);
      grouped.set(rowNo, bucket);
    });
    return Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
  }, [editLayout, draft, elements]);

  /** 生效主题（后端已解析：用户偏好 > 页面主题 > 租户默认） */
  const themeConfig = (portal?.resolvedTheme?.themeConfig || {}) as Record<string, any>;
  /**
   * 门户主色：**用户主题设置优先**，其次门户主题，最后兜底默认蓝。
   * 早期这里直接用 themeConfig.primaryColor，会把用户在「主题设置」里选的主色盖掉，
   * 表现为"门户按钮/框体不跟随主题变色"。
   */
  const primaryColor =
    (initialState?.settings as any)?.colorPrimary || (themeConfig.primaryColor as string) || '#1677FF';
  const themeBg = (themeConfig.bgColor as string) || '';
  const logoUrl = (themeConfig.logoUrl as string) || '';

  /**
   * 暗黑/紧凑：跟随用户在「主题设置」里的选择。
   * 本页自带 ConfigProvider（为了按门户主题覆盖主色/字号），若不在这里同样传 algorithm，
   * 内层 Provider 会以默认亮色算法渲染，把外层的暗黑效果整个盖掉
   * —— 这就是"侧边栏变暗了、门户内容区还是白色"的原因。
   */
  const isDarkTheme = (initialState?.settings as any)?.navTheme === 'realDark';
  const isCompactTheme = !!(initialState?.settings as any)?.compact;
  const themeAlgorithm = (() => {
    const algorithms: any[] = [];
    if (isDarkTheme) algorithms.push(antdTheme.darkAlgorithm);
    if (isCompactTheme) algorithms.push(antdTheme.compactAlgorithm);
    if (!algorithms.length) return antdTheme.defaultAlgorithm;
    return algorithms.length === 1 ? algorithms[0] : algorithms;
  })();

  /** 终端用户主题偏好（themecenter）：下拉选项 + 当前偏好 */
  const [themeOptions, setThemeOptions] = useState<PortalTheme[]>([]);
  const [userThemeId, setUserThemeId] = useState<number | null | undefined>(undefined);
  /** 个人默认门户（对标 hpcurrentuse）：当前页是否已设为「我的默认」 */
  const [userDefaultPageId, setUserDefaultPageId] = useState<number | null | undefined>(undefined);
  const [defaultSaving, setDefaultSaving] = useState(false);

  useEffect(() => {
    portalApi
      .getThemeOptions()
      .then((data) => setThemeOptions(data || []))
      .catch(() => setThemeOptions([]));
    portalApi
      .getUserTheme()
      .then((id) => setUserThemeId(id ?? null))
      .catch(() => setUserThemeId(null));
    portalApi
      .getUserDefaultPage()
      .then((id) => setUserDefaultPageId(id ?? null))
      .catch(() => setUserDefaultPageId(null));
    // 个人通用设置生效值（对标 accountmore §14.2 I：个人优先，NULL 回退全局）
    portalApi
      .getAccountMore()
      .then((data) => setAccountMore(data))
      .catch(() => setAccountMore(undefined));
  }, []);

  /** 个人通用设置生效值（字体/布局密度；对标 accountmore） */
  const [accountMore, setAccountMore] = useState<AccountMoreVO | undefined>(undefined);
  /** 字体映射：1大 2中 3默认（对标 PortalConstant FONT_*） */
  const fontSizeOf = (v?: number) => (v === 1 ? 16 : v === 2 ? 15 : 14);
  /** 布局密度映射：1舒适 2标准 3紧凑（对标 PortalConstant LAYOUT_*） */
  const layoutGapOf = (v?: number) => (v === 1 ? 20 : v === 3 ? 8 : 14);

  const defaultThemeId = themeOptions.find((t) => t.isDefault === 1)?.id;

  const handleUserThemeChange = async (val: number | undefined) => {
    if (val == null) return;
    const realId = val === -1 ? defaultThemeId : val;
    if (!realId) {
      message.warning('暂无默认主题，请选择具体主题');
      return;
    }
    try {
      const ok = await portalApi.setUserTheme(realId);
      if (ok) {
        message.success('主题偏好已更新');
        setUserThemeId(realId);
        loadPortal();
      } else {
        message.error('设置失败');
      }
    } catch (e) {
      console.error('[portal] 设置用户主题失败', e);
      message.error('设置失败');
    }
  };

  /** 设为/取消「我的默认门户」（对标 hpcurrentuse，landing 时优先） */
  const isMyDefault = portal?.pageId != null && userDefaultPageId === portal.pageId;
  const handleToggleMyDefault = async () => {
    if (portal?.pageId == null) return;
    setDefaultSaving(true);
    try {
      const ok = isMyDefault
        ? await portalApi.removeUserDefaultPage()
        : await portalApi.setUserDefaultPage(portal.pageId);
      if (ok) {
        message.success(isMyDefault ? '已取消我的默认门户' : '已设为我的默认门户');
        setUserDefaultPageId(isMyDefault ? null : (portal.pageId as number));
      } else {
        message.error('操作失败');
      }
    } catch (e) {
      console.error('[portal] 设置我的默认门户失败', e);
      message.error('操作失败，请稍后重试');
    } finally {
      setDefaultSaving(false);
    }
  };

  /** 顶部导航菜单：树 → antd Menu items；点击按链接模式跳转 */
  const buildMenuItems = (nodes: PortalMenuNode[]): any[] =>
    (nodes || []).map((n) => ({
      key: String(n.id),
      label: n.menuName,
      children: n.children && n.children.length ? buildMenuItems(n.children) : undefined,
    }));

  const findMenuNode = (nodes: PortalMenuNode[], key: string): PortalMenuNode | undefined => {
    for (const n of nodes || []) {
      if (String(n.id) === key) return n;
      const hit = findMenuNode(n.children || [], key);
      if (hit) return hit;
    }
    return undefined;
  };

  const onTopMenuClick = ({ key }: { key: string }) => {
    const node = findMenuNode(topMenus, key);
    if (!node || !node.routeUrl) return;
    if (node.linkMode === 2) window.open(node.routeUrl, '_blank');
    else history.push(node.routeUrl);
  };

  /**
   * 门户应用宫格入口：把菜单树摊平成可点击磁贴。
   * 只保留带 routeUrl 的节点（分组节点无地址，不单独成贴）。
   */

  const handleRefresh = () => {
    setRefreshing(true);
    loadPortal();
    refreshData();
    message.success('已刷新门户数据');
    setTimeout(() => setRefreshing(false), 600);
  };

  /* ==================== 元素个性化设置（对标 hpElementSettingDetail） ==================== */
  const [settingEl, setSettingEl] = useState<PortalElement | null>(null);
  const [settingSaving, setSettingSaving] = useState(false);
  const [settingForm] = Form.useForm<{ perPage?: number; showTitle: boolean }>();

  const openSetting = (el: PortalElement) => {
    setSettingEl(el);
    settingForm.setFieldsValue({
      perPage: el.perPage && el.perPage > 0 ? el.perPage : undefined,
      showTitle: el.showTitle !== 0,
    });
  };

  const submitSetting = async () => {
    if (!settingEl?.id) return;
    const values = await settingForm.validateFields();
    setSettingSaving(true);
    try {
      const ok = await portalApi.saveElementSetting({
        elementId: settingEl.id,
        perPage: values.perPage && values.perPage > 0 ? values.perPage : undefined,
        showTitle: values.showTitle ? 1 : 0,
      });
      if (ok) {
        message.success('个性化设置已保存');
        setSettingEl(null);
        loadPortal(); // 重新拉取「我的门户」，让新设置立即生效
      } else {
        message.error('保存失败');
      }
    } catch (e) {
      console.error('[portal] 保存元素个性化设置失败', e);
      message.error('保存失败，请稍后重试');
    } finally {
      setSettingSaving(false);
    }
  };

  /* ==================== 布局个性化处理（排序/显隐/保存/重置） ==================== */
  const enterEditLayout = () => {
    // 门户配置项 canPageMaintainerSettingInViewpage=0 时，按钮权限之外的第二道闸（§16.6 消费点）
    if (portal && portal.canMaintainInViewpage === 0) {
      message.warning('门户配置项已禁止在查看页编辑布局（canPageMaintainerSettingInViewpage=0）');
      return;
    }
    setDraft((portal?.elements || []).map((e) => ({ ...e, _hidden: false })));
    setEditLayout(true);
  };
  const cancelEditLayout = () => setEditLayout(false);

  const moveDraft = (id: number | undefined, dir: -1 | 1) => {
    if (id == null) return;
    setDraft((prev) => {
      const arr = [...prev];
      const i = arr.findIndex((e) => e.id === id);
      if (i < 0) return prev;
      const row = arr[i].rowNo || 1;
      const sameRow = arr.map((e, k) => ({ e, k })).filter((x) => (x.e.rowNo || 1) === row);
      const pos = sameRow.findIndex((x) => x.k === i) + dir;

      // 行内交换
      if (pos >= 0 && pos < sameRow.length) {
        const j = sameRow[pos].k;
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
        let s = 1;
        arr.forEach((e) => {
          if ((e.rowNo || 1) === row) e.sortOrder = s++;
        });
        return arr;
      }

      // 跨行：移到相邻行（上越界→上一行末尾；下越界→下一行行首）
      const rowNums = Array.from(new Set(arr.map((e) => e.rowNo || 1))).sort((a, b) => a - b);
      const rowPos = rowNums.indexOf(row);
      const targetRow = dir < 0 ? rowNums[rowPos - 1] : rowNums[rowPos + 1];
      if (targetRow == null) return prev; // 已是最上/最下行
      const targetItems = arr.filter((e) => (e.rowNo || 1) === targetRow);
      const el: DraftEl = { ...arr[i], rowNo: targetRow };
      if (dir < 0) {
        el.sortOrder = Math.max(0, ...targetItems.map((e) => e.sortOrder || 0)) + 1;
      } else {
        el.sortOrder = Math.min(...targetItems.map((e) => e.sortOrder ?? 999)) - 1;
      }
      return [...arr.filter((_, k) => k !== i), el];
    });
  };

  const toggleHideDraft = (id: number | undefined) => {
    if (id == null) return;
    setDraft((prev) => prev.map((e) => (e.id === id ? { ...e, _hidden: !e._hidden } : e)));
  };

  const resizeDraft = (id: number | undefined, colSpan: number) => {
    if (id == null) return;
    setDraft((prev) => prev.map((e) => (e.id === id ? { ...e, colSpan } : e)));
  };

  const saveLayout = async () => {
    if (portal?.pageId == null) return;
    setLayoutSaving(true);
    try {
      const items: PortalLayoutItem[] = draft.map((e) => ({
        elementId: e.id,
        rowNo: e.rowNo,
        colSpan: e.colSpan,
        sortOrder: e.sortOrder,
        hidden: e._hidden ? 1 : 0,
      }));
      const ok = await portalApi.saveMyPortalLayout({ pageId: portal.pageId, items });
      if (ok) {
        message.success('布局已保存');
        setEditLayout(false);
        loadPortal();
      } else {
        message.error('保存失败');
      }
    } catch (e) {
      console.error('[portal] 保存我的门户布局失败', e);
      message.error('保存失败，请稍后重试');
    } finally {
      setLayoutSaving(false);
    }
  };

  const resetLayout = async () => {
    if (portal?.pageId == null) return;
    setLayoutSaving(true);
    try {
      const ok = await portalApi.resetMyPortalLayout(portal.pageId);
      if (ok) {
        message.success('已恢复默认布局');
        setEditLayout(false);
        loadPortal();
      } else {
        message.error('重置失败');
      }
    } catch (e) {
      console.error('[portal] 重置我的门户布局失败', e);
      message.error('重置失败');
    } finally {
      setLayoutSaving(false);
    }
  };

  /* ==================== 添加私有元素到我的门户（对标 UserAddElementInfo） ==================== */
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingMyEl, setEditingMyEl] = useState<PortalElement | null>(null);
  const [addForm] = Form.useForm<{
    elementType: string;
    elementName?: string;
    colSpan?: number;
    perPage?: number;
    dataOrgScope?: number;
    chartType?: string;
    xField?: string;
    yField?: string;
    chartData?: string;
    richHtml?: string;
    links?: { name: string; url: string }[];
  }>();
  const addType = Form.useWatch('elementType', addForm);

  /** 可添加的元素类型：前端已注册渲染器 ∩ 有元信息（与设计器一致的前端子集） */
  const paletteTypes = useMemo<ElementType[]>(
    () => REGISTERED_ELEMENT_TYPES.filter((t) => ELEMENT_TYPE_META[t as ElementType]) as ElementType[],
    [],
  );

  const handleAddElement = async () => {
    if (portal?.pageId == null) return;
    const values = await addForm.validateFields();
    setAdding(true);
    try {
      const cfg = buildAddConfig(values);
      if (editingMyEl) {
        const ok = await portalApi.updateMyPortalElement({
          elementId: editingMyEl.id as number,
          elementName: values.elementName,
          colSpan: values.colSpan || 12,
          configJson: JSON.stringify(cfg),
        });
        if (ok) {
          message.success('已更新');
          setAddOpen(false);
          setEditingMyEl(null);
          addForm.resetFields();
          loadPortal();
        } else {
          message.error('更新失败（仅可编辑本人添加的元素）');
        }
      } else {
        const id = await portalApi.addMyPortalElement({
          pageId: portal.pageId,
          elementType: values.elementType,
          elementName: values.elementName,
          colSpan: values.colSpan || 12,
          configJson: Object.keys(cfg).length ? JSON.stringify(cfg) : undefined,
        });
        if (id != null) {
          message.success('已添加到我的门户');
          setAddOpen(false);
          addForm.resetFields();
          setEditLayout(false);
          loadPortal();
        } else {
          message.error('添加失败');
        }
      }
    } catch (e) {
      console.error('[portal] 保存我的门户元素失败', e);
      message.error('保存失败，请稍后重试');
    } finally {
      setAdding(false);
    }
  };

  const handleEditMyElement = (el: PortalElement) => {
    const cfg = (el.config || {}) as Record<string, any>;
    addForm.setFieldsValue({
      elementType: el.elementType,
      elementName: el.elementName,
      colSpan: el.colSpan || 12,
      perPage: cfg.perPage,
      dataOrgScope: cfg.dataOrgScope,
      chartType: cfg.chartType,
      xField: cfg.xField,
      yField: cfg.yField,
      chartData: cfg.data ? JSON.stringify(cfg.data) : '',
      richHtml: cfg.html,
      links: Array.isArray(cfg.links) ? cfg.links : [],
    });
    setEditingMyEl(el);
    setAddOpen(true);
  };

  const handleRemoveMyElement = async (elementId: number | undefined) => {
    if (elementId == null) return;
    try {
      const ok = await portalApi.removeMyPortalElement(elementId);
      if (ok) {
        message.success('已移除');
        setDraft((prev) => prev.filter((e) => e.id !== elementId));
        loadPortal();
      } else {
        message.error('移除失败（仅可移除本人添加的元素）');
      }
    } catch (e) {
      console.error('[portal] 移除我的门户元素失败', e);
      message.error('移除失败');
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 6 ? '夜深了' : hour < 12 ? '上午好' : hour < 18 ? '下午好' : '晚上好';

  if (portalLoading) {
    return (
      <div style={{ padding: 120, textAlign: 'center' }}>
        <Spin size="large" tip="正在加载门户..." />
      </div>
    );
  }

  if (portalError) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="error"
          showIcon
          message="门户服务不可用"
          description="请确认 blade-portal 服务已启动（端口 8140），稍后重试。"
          action={<Button onClick={loadPortal}>重试</Button>}
        />
      </div>
    );
  }

  if (!portal?.pageId) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Empty description="暂无可访问的门户页面，请联系管理员在门户设计器中授权" />
      </div>
    );
  }

  return (
    <ConfigProvider
      theme={{
        token: { colorPrimary: primaryColor, fontSize: fontSizeOf(accountMore?.fontSize) },
        algorithm: themeAlgorithm,
      }}
    >
      <div style={{ padding: 16 }}>
        {/* 顶部欢迎区（主题化：背景色 / 主色左边框 / Logo；暗黑下用深色底，避免一块亮白） */}
        <div
          style={{
            borderRadius: 12,
            padding: '20px 24px',
            marginBottom: 16,
            background:
              themeBg || (isDarkTheme ? 'rgba(255,255,255,0.04)' : 'linear-gradient(120deg, #E6F0FF 0%, #F5F7FA 55%, #FFFFFF 100%)'),
            border: isDarkTheme ? '1px solid rgba(255,255,255,0.12)' : '1px solid #E6EDF5',
            borderLeft: `4px solid ${primaryColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {logoUrl && (
              <img
                src={logoUrl}
                alt="logo"
                style={{ height: 40, borderRadius: 8, background: isDarkTheme ? 'rgba(255,255,255,0.85)' : '#fff', padding: 4 }}
              />
            )}
            <div>
              <Title level={4} style={{ margin: 0 }}>
            {greeting}，{currentUser?.name || currentUser?.realName || '同事'}
          </Title>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text type="secondary">
              {portal.pageName} · {dayjs().format('YYYY年MM月DD日 dddd')}
            </Text>
            {portal.pageCode ? (
              <Tag color="geekblue" title="门户标识，地址可带 ?code= 精确访问（对标泛微 portal-9-5）">
                门户标识：{portal.pageCode}
              </Tag>
            ) : null}
            {(portal.visiblePages || []).length > 1 && (
              <Select
                size="small"
                style={{ minWidth: 150 }}
                value={portalCode || portal.pageCode}
                onChange={(code: string) =>
                  history.push(`/portal/home${code ? `?code=${code}` : ''}`)
                }
                options={(portal.visiblePages || []).map((p) => ({
                  value: p.pageCode as string,
                  label: `${p.pageName || p.pageCode}${p.isDefault === 1 ? '（默认）' : ''}`,
                }))}
              />
            )}
          </div>
        </div>
          </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Select
            value={userThemeId ?? -1}
            style={{ width: 150 }}
            loading={userThemeId === undefined}
            onChange={handleUserThemeChange}
            options={[
              { value: -1, label: '跟随系统默认' },
              ...themeOptions.map((t) => ({ value: t.id as number, label: t.themeName as string })),
            ]}
          />
          <Button type="primary" loading={defaultSaving} onClick={handleToggleMyDefault}>
            {isMyDefault ? '取消我的默认' : '设为我的默认'}
          </Button>
          <Button type="primary" onClick={() => history.push('/portal/setting')}>个人设置</Button>
          {editLayout ? (
            <>
              <Button type="primary" icon={<SaveOutlined />} loading={layoutSaving} onClick={saveLayout}>
                保存布局
              </Button>
              <Button icon={<UndoOutlined />} loading={layoutSaving} onClick={resetLayout}>
                恢复默认
              </Button>
              <Button icon={<CloseOutlined />} onClick={cancelEditLayout}>
                取消
              </Button>
              <Button
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingMyEl(null);
                  addForm.resetFields();
                  addForm.setFieldsValue({ elementType: paletteTypes[0], colSpan: 12 });
                  setAddOpen(true);
                }}
              >
                添加元素
              </Button>
            </>
          ) : (
            <Button
              type="primary"
              icon={<EditOutlined />}
              disabled={portal?.canMaintainInViewpage === 0}
              title={portal?.canMaintainInViewpage === 0 ? '门户配置项已禁止查看页编辑布局' : undefined}
              onClick={enterEditLayout}
            >
              编辑布局
            </Button>
          )}
          <Button type="primary" icon={<ReloadOutlined />} loading={refreshing} onClick={handleRefresh}>
            刷新
          </Button>
          {canManagePortal && (
            <Button type="primary" icon={<AppstoreOutlined />} onClick={() => history.push('/portal/pagemanage')}>
              页面管理
            </Button>
          )}
          {canManagePortal && (
            <Button type="primary" icon={<SettingOutlined />} onClick={() => history.push('/portal/design')}>
              门户设计
            </Button>
          )}
          <Button type="primary" icon={<DashboardOutlined />} onClick={() => history.push('/')}>
            进入后台
          </Button>
        </div>
      </div>

      {topMenus.length > 0 && (
        <Menu
          mode="horizontal"
          items={buildMenuItems(topMenus)}
          onClick={onTopMenuClick}
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
      )}

      <div style={{ display: 'flex', gap: layoutGapOf(accountMore?.layoutType), alignItems: 'flex-start' }}>
        {/* 门户不再使用左侧树菜单：前端菜单统一收进右上角「门户小图标」的应用宫格 */}
        <div style={{ flex: 1, minWidth: 0 }}>
        {dataError ? (
          <Alert type="warning" showIcon message={dataError} style={{ marginBottom: 16 }} />
        ) : null}

        {/* 元素网格区 */}
      {renderGroups.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <Empty description="当前门户页面还没有配置元素，去门户设计器拖入吧" />
        </div>
      ) : (
        renderGroups.map(([rowNo, list]) => (
          <Row key={rowNo} gutter={[16, 16]} align="stretch" style={{ marginBottom: 16 }}>
            {list.map((el) => {
              const vo = dataMap[String(el.id)];
              const failed = !!vo && vo.success === false;
              const rowsData = vo?.data || [];
              return (
                <Col
                  key={el.id || `${el.elementType}-${el.sortOrder}`}
                  xs={24}
                  sm={el.colSpan && el.colSpan <= 12 ? 24 : el.colSpan || 12}
                  md={el.colSpan || 12}
                  lg={el.colSpan || 12}
                  xl={el.colSpan || 12}
                >
                  {editLayout && (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6, padding: '2px 6px', background: isDarkTheme ? 'rgba(255,255,255,0.06)' : '#fafafa', borderRadius: 6 }}>
                      <Button size="small" type="text" icon={<UpOutlined />} onClick={() => moveDraft(el.id, -1)} title="上移（行首时移到上一行末尾）" />
                      <Button size="small" type="text" icon={<DownOutlined />} onClick={() => moveDraft(el.id, 1)} title="下移（行尾时移到下一行行首）" />
                      <Select
                        size="small"
                        style={{ width: 92 }}
                        value={el.colSpan || 12}
                        onChange={(v) => resizeDraft(el.id, v as number)}
                        options={[
                          { value: 6, label: '1/4 宽' },
                          { value: 8, label: '1/3 宽' },
                          { value: 12, label: '1/2 宽' },
                          { value: 16, label: '2/3 宽' },
                          { value: 24, label: '通栏' },
                        ]}
                      />
                      <Button
                        size="small"
                        type="text"
                        icon={el._hidden ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                        onClick={() => toggleHideDraft(el.id)}
                      >
                        {el._hidden ? '已隐藏' : '显示中'}
                      </Button>
                      {el.ownerUserId && el.ownerUserId > 0 && (
                        <Button
                          size="small"
                          type="text"
                          icon={<EditOutlined />}
                          title="编辑"
                          onClick={() => handleEditMyElement(el)}
                        />
                      )}
                      {el.ownerUserId && el.ownerUserId > 0 && (
                        <Popconfirm
                          title="移除我添加的这个元素？"
                          okText="移除"
                          cancelText="取消"
                          onConfirm={() => handleRemoveMyElement(el.id)}
                        >
                          <Button size="small" type="text" danger icon={<DeleteOutlined />} title="移除" />
                        </Popconfirm>
                      )}
                    </div>
                  )}
                  <div style={editLayout && el._hidden ? { opacity: 0.45 } : undefined}>
                  <ElementShell
                    title={el.elementName}
                    showTitle={el.showTitle}
                    loading={dataLoading}
                    error={failed ? vo?.message || '该元素数据加载失败' : undefined}
                    empty={!dataLoading && !failed && rowsData.length === 0}
                    onRefresh={refreshData}
                    onSetting={() => openSetting(el)}
                  >
                    <ElementRenderer
                      elementType={el.elementType}
                      rows={rowsData}
                      perPage={el.perPage}
                    />
                  </ElementShell>
                  </div>
                </Col>
              );
            })}
          </Row>
        ))
        )}
        </div>
      </div>

      {/* 添加元素到我的门户 */}
      <Modal
        title={editingMyEl ? '编辑元素' : '添加元素到我的门户'}
        open={addOpen}
        onOk={handleAddElement}
        confirmLoading={adding}
        onCancel={() => setAddOpen(false)}
        okText="添加"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={addForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="elementType" label="元素类型" rules={[{ required: true, message: '请选择元素类型' }]}>
            <Select
              disabled={!!editingMyEl}
              options={paletteTypes.map((t) => ({
                value: t,
                label: ELEMENT_TYPE_META[t as ElementType]?.label || t,
              }))}
            />
          </Form.Item>
          <Form.Item name="elementName" label="标题" extra="留空使用类型默认名">
            <Input placeholder="如：我的待办" maxLength={64} />
          </Form.Item>
          <Form.Item name="colSpan" label="宽度" initialValue={12}>
            <Select
              options={[
                { value: 6, label: '1/4 宽' },
                { value: 8, label: '1/3 宽' },
                { value: 12, label: '1/2 宽' },
                { value: 16, label: '2/3 宽' },
                { value: 24, label: '通栏' },
              ]}
            />
          </Form.Item>

          {['todo', 'notice', 'message'].includes(addType) && (
            <Form.Item name="perPage" label="显示条数" initialValue={5}>
              <InputNumber style={{ width: '100%' }} min={1} max={50} />
            </Form.Item>
          )}

          {['todo', 'notice', 'message', 'chart'].includes(addType) && (
            <Form.Item
              name="dataOrgScope"
              label="数据组织范围"
              initialValue={1}
              extra="按组织过滤元素数据：租户(默认) / 部门(仅本岗位部门创建的数据) / 分部(仅本分部及下属部门创建的数据)"
            >
              <Select
                options={[
                  { value: 1, label: '按租户（默认）' },
                  { value: 2, label: '按部门' },
                  { value: 3, label: '按分部' },
                ]}
              />
            </Form.Item>
          )}

          {addType === 'chart' && (
            <>
              <Form.Item name="chartType" label="图表类型" initialValue="column">
                <Select
                  options={[
                    { value: 'column', label: '柱状图' },
                    { value: 'bar', label: '条形图' },
                    { value: 'line', label: '折线图' },
                    { value: 'area', label: '面积图' },
                    { value: 'pie', label: '饼图' },
                  ]}
                />
              </Form.Item>
              <Form.Item name="xField" label="横轴字段" initialValue="x">
                <Input />
              </Form.Item>
              <Form.Item name="yField" label="纵轴字段" initialValue="y">
                <Input />
              </Form.Item>
              <Form.Item name="chartData" label="数据（JSON 数组）" extra='如 [{"x":"一月","y":12}]'>
                <Input.TextArea rows={4} placeholder='[{"x":"A","y":10},{"x":"B","y":20}]' />
              </Form.Item>
            </>
          )}

          {addType === 'rich' && (
            <Form.Item name="richHtml" label="富文本内容（HTML）">
              <Input.TextArea rows={6} placeholder="<p>公告内容...</p>" />
            </Form.Item>
          )}

          {addType === 'links' && (
            <Form.Item label="快捷入口">
              <Form.List name="links">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map((field) => (
                      <Space key={field.key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                        <Form.Item {...field} name={[field.name, 'name']} noStyle>
                          <Input placeholder="名称" style={{ width: 140 }} />
                        </Form.Item>
                        <Form.Item {...field} name={[field.name, 'url']} noStyle>
                          <Input placeholder="链接" style={{ width: 220 }} />
                        </Form.Item>
                        <DeleteOutlined onClick={() => remove(field.name)} />
                      </Space>
                    ))}
                    <Button type="link" icon={<PlusOutlined />} onClick={() => add({ name: '', url: '' })}>
                      添加入口
                    </Button>
                  </>
                )}
              </Form.List>
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 元素个性化设置抽屉 */}
      <Drawer
        title={`个性化设置 · ${settingEl?.elementName || ''}`}
        open={!!settingEl}
        onClose={() => setSettingEl(null)}
        width={360}
        extra={
          <Button type="primary" loading={settingSaving} onClick={submitSetting}>
            保存
          </Button>
        }
      >
        <Form form={settingForm} layout="vertical">
          <Form.Item
            name="perPage"
            label="显示条数"
            extra="留空表示使用元素默认条数"
            rules={[{ type: 'number', min: 1, max: 50, message: '请输入 1-50 之间的数字' }]}
          >
            <InputNumber style={{ width: '100%' }} placeholder="默认" min={1} max={50} />
          </Form.Item>
          <Form.Item name="showTitle" label="显示卡片标题" valuePropName="checked">
            <Switch checkedChildren="显示" unCheckedChildren="隐藏" />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
    </ConfigProvider>
  );
};

export default PortalPage;
