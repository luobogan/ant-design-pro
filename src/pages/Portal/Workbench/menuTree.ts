import type { PortalMenuNode } from '@/services/portal';
import type { WorkbenchMenuNode } from './types';

/**
 * 左侧菜单树纯函数集合。
 * 与 UI 解耦，便于单测覆盖「构建 / 搜索过滤 / 定位 / 默认选中」。
 */

/** 模块解析器：由 routeUrl 推断内容模块 key */
export type ModuleResolver = (routeUrl?: string) => string | undefined;

/** 从路由截出末段作为模块 key：/portal/noticedetail -> noticedetail */
export function segmentOf(routeUrl?: string): string | undefined {
  if (!routeUrl) return undefined;
  const cleaned = routeUrl.split('?')[0].split('#')[0].replace(/\/+$/, '');
  const seg = cleaned.slice(cleaned.lastIndexOf('/') + 1);
  return seg ? seg.toLowerCase() : undefined;
}

/** 后端菜单树 -> 工作台菜单树（补 key / moduleKey，剔除空节点） */
export function toWorkbenchTree(
  nodes: PortalMenuNode[] | undefined,
  resolveModule: ModuleResolver,
  parentKey = 'wb',
): WorkbenchMenuNode[] {
  return (nodes || [])
    .filter((n) => !!n)
    .map((n, index) => {
      const key = n.id != null ? String(n.id) : `${parentKey}-${index}`;
      return {
        key,
        label: n.menuName || n.routeUrl || key,
        icon: n.icon,
        routeUrl: n.routeUrl,
        linkMode: n.linkMode,
        moduleKey: resolveModule(n.routeUrl),
        children: toWorkbenchTree(n.children, resolveModule, key),
      } satisfies WorkbenchMenuNode;
    })
    .filter((n) => !!n.label);
}

/** 深度优先展开 */
export function flattenMenuTree(nodes: WorkbenchMenuNode[]): WorkbenchMenuNode[] {
  const out: WorkbenchMenuNode[] = [];
  const walk = (list: WorkbenchMenuNode[]) => {
    list.forEach((n) => {
      out.push(n);
      if (n.children?.length) walk(n.children);
    });
  };
  walk(nodes || []);
  return out;
}

/** 递归查找节点 */
export function findMenuNode(nodes: WorkbenchMenuNode[], key: string): WorkbenchMenuNode | undefined {
  for (const n of nodes || []) {
    if (n.key === key) return n;
    const hit = findMenuNode(n.children || [], key);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * 关键字过滤：自身命中或任一后代命中的节点保留，
 * 保证搜索结果仍是完整路径（不会出现孤儿子节点）。
 */
export function filterMenuTree(nodes: WorkbenchMenuNode[], keyword: string): WorkbenchMenuNode[] {
  const kw = (keyword || '').trim().toLowerCase();
  if (!kw) return nodes || [];
  const walk = (list: WorkbenchMenuNode[]): WorkbenchMenuNode[] =>
    (list || []).reduce<WorkbenchMenuNode[]>((acc, n) => {
      const children = walk(n.children || []);
      const selfHit = `${n.label}`.toLowerCase().includes(kw) || `${n.routeUrl || ''}`.toLowerCase().includes(kw);
      if (selfHit || children.length) {
        acc.push(selfHit ? { ...n, children: n.children || [] } : { ...n, children });
      }
      return acc;
    }, []);
  return walk(nodes);
}

/** 首个可渲染内容（命中模块）的节点 key */
export function firstSelectableKey(nodes: WorkbenchMenuNode[]): string | undefined {
  return flattenMenuTree(nodes).find((n) => !!n.moduleKey)?.key;
}

/** 过滤后需要展开的祖先 key 集合 */
export function expandedKeysOf(nodes: WorkbenchMenuNode[]): string[] {
  return (nodes || []).filter((n) => (n.children?.length ?? 0) > 0).map((n) => n.key);
}