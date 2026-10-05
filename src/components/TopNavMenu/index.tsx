import * as icons from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Menu } from 'antd';
import React, { useMemo } from 'react';
import { history, useLocation, useRequest } from '@umijs/max';
import * as menuApi from '@/services/system/menu';
import { pickPayload } from '@/utils/utils';

/** 后端菜单节点（MenuVO） */
interface MenuNode {
  id?: string | number;
  code?: string;
  name?: string;
  alias?: string;
  path?: string;
  source?: string;
  sort?: number;
  isOpen?: number;
  children?: MenuNode[];
}

/**
 * 顶部导航菜单
 *
 * 数据来源全部来自后端，且天然带权限过滤：
 *   1. GET /menu/top-menu 取当前用户可见的顶部菜单；
 *   2. 对每个顶部菜单请求 GET /menu/routes?topMenuId=xx，
 *      该接口按角色 + 租户 + 产品包过滤，无权限的菜单不会返回；
 *   3. 若某个顶部菜单没有任何子路由，视为当前用户无权限，不渲染；
 *   4. 后端未配置顶部菜单时，降级为「动态路由的一级菜单」。
 */
const TopNavMenu: React.FC = () => {
  const location = useLocation();

  const { data, loading } = useRequest(async () => {
    // 1. 顶部菜单列表（未登录时后端直接返回 null，需要兜底）
    let tops: MenuNode[] = [];
    try {
      const res = await menuApi.topMenuList();
      const list = pickPayload<MenuNode[]>(res, []) || [];
      tops = Array.isArray(list) ? list : [];
    } catch {
      tops = [];
    }
    tops = [...tops].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

    if (tops.length === 0) {
      // 2. 兜底：直接用动态路由的一级菜单
      try {
        const res = await menuApi.dynamicRoutes();
        const routes = pickPayload<MenuNode[]>(res, []) || [];
        return Array.isArray(routes) ? routes : [];
      } catch {
        return [];
      }
    }

    // 3. 逐个拉取顶部菜单下的多级路由
    const detailed = await Promise.all(
      tops.map(async (top) => {
        try {
          const res = await menuApi.dynamicRoutes({ topMenuId: top.id });
          const routes = pickPayload<MenuNode[]>(res, []) || [];
          return { ...top, children: Array.isArray(routes) ? routes : [] };
        } catch {
          return { ...top, children: [] };
        }
      }),
    );

    // 没有任何可见子路由 → 无权限，丢弃
    return detailed.filter((item) => (item.children?.length ?? 0) > 0);
  });

  const menus = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  /** 点击菜单：外链新开，内部路由直接跳转 */
  const go = (node: MenuNode) => {
    const path = node?.path;
    if (!path) return;
    if (/^https?:\/\//.test(path)) {
      window.open(path, node.isOpen === 2 ? '_blank' : '_blank');
      return;
    }
    history.push(path);
  };

  /** 后端 source 字段即图标名，映射到 antd 图标 */
  const renderIcon = (source?: string) => {
    const key = (source || '') as keyof typeof icons;
    // biome-ignore lint/performance/noDynamicNamespaceImportAccess: 图标名由后端 menu.source 下发，只能动态取
    const Comp = key ? (icons[key] as any) : undefined;
    return Comp ? React.createElement(Comp) : undefined;
  };

  /** 递归生成 antd Menu items，天然支持多级 */
  const buildItems = (list: MenuNode[]): Required<MenuProps>['items'] =>
    list.map((node) => {
      const children =
        Array.isArray(node.children) && node.children.length
          ? buildItems(node.children)
          : undefined;
      return {
        key: String(node.path || node.id),
        icon: renderIcon(node.source),
        label: node.name,
        children,
        onClick: children ? undefined : () => go(node),
      } as any;
    });

  const items = useMemo(() => buildItems(menus), [menus]);

  /** 高亮：取所有命中当前路径的祖先节点中最深的一级 */
  const selectedKeys = useMemo(() => {
    const pathname = location.pathname;
    let bestKey = '';
    const walk = (list: MenuNode[]) => {
      list.forEach((node) => {
        const nodePath = node.path || '';
        if (nodePath && (pathname === nodePath || pathname.startsWith(`${nodePath}/`))) {
          const key = String(nodePath || node.id);
          if (key.length > bestKey.length) {
            bestKey = key;
          }
        }
        if (node.children?.length) walk(node.children);
      });
    };
    walk(menus);
    return bestKey ? [bestKey] : [];
  }, [location.pathname, menus]);

  if (loading || items.length === 0) {
    return null;
  }

  return (
    <div style={{ width: '100%', minWidth: 0, overflowX: 'auto' }}>
      <Menu
        mode="horizontal"
        items={items}
        selectedKeys={selectedKeys}
        triggerSubMenuAction="hover"
        style={{ borderBottom: 'none', background: 'transparent', minWidth: 'max-content' }}
      />
    </div>
  );
};

export default TopNavMenu;
