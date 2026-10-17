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
import { portalApi } from '@/services/portal';
import type { PortalMenuNode } from '@/services/portal';

const { Text } = Typography;

/** 应用宫格磁贴配色（彩色方块 + 居中图标） */
const APP_TILE_COLORS = [
  '#e8590c', '#1c7ed6', '#0ca678', '#7048e8', '#f08c00', '#d6336c', '#5f3dc4',
  '#1098ad', '#e64980', '#f76707', '#1971c2', '#2f9e44', '#e8590c',
];

/** 门户菜单 icon -> 磁贴图标（未命中回退 Appstore） */
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
 * 门户应用启动器：标题栏里的「门户小图标」。
 *
 * - 点击后就地展开应用宫格，不新开窗口、不弹页面；
 * - 面板用 createPortal 挂到 body 并以 fixed 定位，规避标题栏 overflow 裁切与层级问题；
 * - 磁贴点击一律走应用内路由 history.push，门户始终渲染在当前 app 内，
 *   不做整页刷新；已在目标页时直接跳过，避免「又跳一遍」；
 * - 菜单首次展开时懒加载，来源与左侧原始菜单一致（系统菜单优先，门户私有菜单兜底）。
 */
const PortalAppLauncher: React.FC<PortalAppLauncherProps> = ({ align = 'right' }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<PortalMenuNode[]>([]);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const loadedRef = useRef(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let nodes: PortalMenuNode[] = [];
    try {
      nodes = (await portalApi.getSystemMenuTree('front')) || [];
    } catch {
      try {
        nodes = (await portalApi.getMenuTree('front')) || [];
      } catch {
        nodes = [];
      }
    }
    const out: PortalMenuNode[] = [];
    const walk = (list: PortalMenuNode[]) => {
      (list || []).forEach((n) => {
        if (n?.routeUrl) out.push(n);
        if (n?.children?.length) walk(n.children);
      });
    };
    walk(nodes);
    setEntries(out);
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
  const openEntry = (node: PortalMenuNode) => {
    setOpen(false);
    const url = node.routeUrl;
    if (!url) return;
    const target = url.split('#')[0];
    const current = history.location.pathname + (history.location.search || '');
    if (target === current) return;
    history.push(url);
  };

  const toggle = () => {
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
                    key={String(node.id ?? node.routeUrl + '-' + idx)}
                    type="button"
                    onClick={() => openEntry(node)}
                    title={node.menuName}
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
                      {node.menuName}
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
