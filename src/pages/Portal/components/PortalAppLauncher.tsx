import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ApartmentOutlined,
  AppstoreOutlined,
  CloseOutlined,
  DashboardOutlined,
  EditOutlined,
  HomeOutlined,
  MessageOutlined,
  NotificationOutlined,
  ProfileOutlined,
  SkinOutlined,
  SolutionOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { Button, Empty, Spin, Typography } from 'antd';
import { history } from '@umijs/max';
import { dynamicRoutes } from '@/services/system/menu';
import { pickPayload } from '@/utils/utils';

const { Text } = Typography;

/** 应用宫格磁贴配色（彩色方块 + 居中图标） */
const APP_TILE_COLORS = [
  '#e8590c', '#1c7ed6', '#0ca678', '#7048e8', '#f08c00', '#d6336c', '#5f3dc4',
  '#1098ad', '#e64980', '#f76707', '#1971c2', '#2f9e44', '#e8590c',
];

/** 菜单 icon -> 磁贴图标（未命中回退 Appstore） */
const APP_ICON_MAP: Record<string, React.ReactNode> = {
  home: <HomeOutlined />,
  message: <MessageOutlined />,
  appstore: <AppstoreOutlined />,
  dashboard: <DashboardOutlined />,
  table: <TableOutlined />,
  edit: <EditOutlined />,
  notification: <NotificationOutlined />,
  profile: <ProfileOutlined />,
  solution: <SolutionOutlined />,
  cluster: <ApartmentOutlined />,
  skin: <SkinOutlined />,
};

export interface PortalAppLauncherProps {
  /** 面板相对图标的展开方向 */
  align?: 'left' | 'right';
}

interface AnchorRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

/**
 * 取节点（及其子树）第一个可跳转的路由 path。
 * 顶级菜单常常是「纯分组」（自身无 path），此时下钻到第一个子页面，
 * 跳转后 ProLayout 会自动在左侧展开该顶级下的子菜单。
 */
const kidsOf = (n: any): any[] => (n?.routes || n?.children) || [];

/**
 * 优先：左侧菜单里「真实可见」的第一个页面地址。
 * 组件型菜单（category=2，如 /workflow/create/start）只是路由载体，已被 stripComponentMenus
 * 从菜单剔除，跳过去菜单无匹配 → 不展开/不高亮，故这类节点整棵跳过。
 */
/**
 * 最优先：叶子节点（无子级）的可见页面。
 * 有子级的节点常被路由层渲染成「分组重定向」（<Navigate to="" />），push 过去会被弹回首页
 * （实测 /workflow/create 有子路由 /workflow/create/start，push 后跳到 / 再 redirect 回门户），
 * 所以目标必须优先落在真正的叶子页面上。
 */
const firstLeafPath = (node: any): string | undefined => {
  if (Number(node?.category) === 2) return undefined;
  const kids = kidsOf(node);
  if (!kids.length) return node?.path ? String(node.path) : undefined;
  for (const c of kids) {
    const p = firstLeafPath(c);
    if (p) return p;
  }
  return undefined;
};

const firstVisiblePath = (node: any): string | undefined => {
  if (Number(node?.category) === 2) return undefined;
  const kids = kidsOf(node);
  // 深度优先：先找子级里第一个「可见页面」
  for (const c of kids) {
    const p = firstVisiblePath(c);
    if (p) return p;
  }
  // 子级里没有可见页面时，分组节点自身的 path 也是合法目标
  // （例如「表单列表」/formmode/formmanage 下面挂的都是 category=2 的按钮页，
  //   但它自己就是真实页面，应当作为该顶级下的第一个页面）
  if (node?.path) return String(node.path);
  return undefined;
};

/** 兜底：整棵子树里第一个有 path 的地址（含组件型），保证点击总有跳转反馈 */
const firstAnyPath = (node: any): string | undefined => {
  const kids = kidsOf(node);
  for (const c of kids) {
    const p = firstAnyPath(c);
    if (p) return p;
  }
  if (node?.path) return String(node.path);
  return undefined;
};

/** 目标地址：优先菜单可见页，拿不到就退到任意有 path 的页 */
const resolveTarget = (node: any): string | undefined =>
  firstLeafPath(node) || firstVisiblePath(node) || firstAnyPath(node);

/**
 * 门户应用启动器：标题栏里的「门户小图标」。
 *
 * - 点击后就地展开应用宫格，不新开窗口、不弹页面；
 * - 面板用 createPortal 挂到 body 并以 fixed 定位，规避标题栏 overflow 裁切与层级问题；
 * - 磁贴一律走应用内路由 history.push，门户始终渲染在当前 app 内，不做整页刷新；
 * - **只展示「授权的顶级菜单」**（与左侧 ProLayout 同源，取 /menu/routes 顶层，
 *   并剔除组件型菜单 category=2），不再把整棵菜单树平铺成宫格；
 * - 点击某顶级菜单 → 跳到该顶级下第一个可访问页面，左侧菜单随之展开其子菜单。
 */
const PortalAppLauncher: React.FC<PortalAppLauncherProps> = ({ align = 'right' }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<any[]>([]);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const loadedRef = useRef(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let tops: any[] = [];
    try {
      // 与左侧 ProLayout 完全同源：/menu/routes（已按当前用户角色授权过滤）
      const raw = await dynamicRoutes();
      const tree = (pickPayload(raw) as any[]) || [];
      // 只取「顶级」，并剔除组件型菜单（category=2，如 Excel 预览 / 流程审批等路由载体）
      tops = tree.filter((n: any) => n && Number(n.category) !== 2);
    } catch {
      tops = [];
    }
    setEntries(tops);
    loadedRef.current = true;
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open && !loadedRef.current) load();
  }, [open, load]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onReflow = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open]);

  /** 应用内跳转：不新开窗口、不整页刷新；已在目标页则不重复跳转 */
  const openEntry = (node: any) => {
    setOpen(false);
    const url = resolveTarget(node);
    if (!url) return;
    const target = url.split('#')[0];
    const current = history.location.pathname + (history.location.search || '');
    if (target === current) return;
    history.push(url);
  };

  const toggle = (e: React.MouseEvent) => {
    // 必须阻止冒泡：本组件渲染在 ProLayout 的 Logo/标题区里，点击该区域会跳 "/"，
    // 再被重定向回门户首页（表现为"点了没反应/又回到首页"）。
    e.stopPropagation();
    if (!open && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      setAnchor({ top: r.top, left: r.left, right: r.right, bottom: r.bottom });
    }
    setOpen((v) => !v);
  };

  const panel =
    open && anchor && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            // 面板虽 createPortal 到 body，React 事件仍沿 React 树冒泡到 Logo/标题区，
            // 必须在这里截断，否则磁贴点击会被 ProLayout 的"回首页"覆盖。
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: anchor.bottom + 8,
              left: align === 'left' ? anchor.left : undefined,
              right: align === 'right' ? Math.max(window.innerWidth - anchor.right, 8) : undefined,
              width: 560,
              maxWidth: '82vw',
              background: '#fff',
              border: '1px solid #f0f0f0',
              borderRadius: 8,
              boxShadow: '0 6px 24px rgba(0, 0, 0, 0.12)',
              padding: 12,
              zIndex: 1200,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text strong>门户应用</Text>
              <Button type="text" size="small" icon={<CloseOutlined />} aria-label="关闭" onClick={close} />
            </div>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 0' }}>
                <Spin size="small" />
              </div>
            ) : entries.length ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: 10 }}>
                {entries.map((node, idx) => (
                  <button
                    key={String(node.id ?? node.path ?? idx)}
                    type="button"
                    onClick={() => openEntry(node)}
                    title={node.name}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '14px 6px',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: APP_TILE_COLORS[idx % APP_TILE_COLORS.length],
                      color: '#fff',
                      fontSize: 13,
                      lineHeight: 1.3,
                    }}
                  >
                    <span style={{ fontSize: 20, display: 'flex' }}>
                      {APP_ICON_MAP[node.icon || ''] || <AppstoreOutlined />}
                    </span>
                    <span style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {node.name || '未命名'}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可用的门户应用" />
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
        <Button
          shape="circle"
          size="small"
          icon={<AppstoreOutlined />}
          title="门户应用"
          aria-label="门户应用"
          onClick={toggle}
          style={{
            background: open ? '#e6f4ff' : 'transparent',
            borderColor: open ? '#91caff' : '#d9d9d9',
          }}
        />
      </div>
      {panel}
    </>
  );
};

export default React.memo(PortalAppLauncher);
