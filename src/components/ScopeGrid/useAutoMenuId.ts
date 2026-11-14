import { useLocation } from '@umijs/max';
import { useMemo } from 'react';
import { getRoutes } from '@/utils/authority';

/** 去掉首尾斜杠，便于按段比较 */
const clean = (p: any): string => String(p ?? '').trim().replace(/^\/+|\/+$/g, '');

/**
 * 在 /menu/routes 下发的菜单树里按当前路由反查 blade_menu.id。
 *
 * 背景：blade_scope_field 以 menu_id 为主键，而 menuId 是雪花 ID（各环境不同），
 * 业务列表页不可能硬编码。登录时 Login.tsx 已把菜单树写入 localStorage
 * （utils/authority.getRoutes），这里同步读取即可，无需额外请求。
 *
 * 匹配顺序：完整 path 优先，其次按路径末段匹配菜单 code/alias。
 * 兼容 path 为相对段（拼父路径）与绝对路径两种下发形态。
 */
export function findMenuIdByPath(nodes: any[], pathname: string): string | undefined {
  const target = clean(pathname);
  if (!target) return undefined;
  const code = target.split('/').filter(Boolean).pop();
  let codeHit: string | undefined;

  const walk = (list: any[], prefix: string[]): string | undefined => {
    for (const node of list || []) {
      if (!node || typeof node !== 'object') continue;
      const rawPath = node.path ?? node.menuPath;
      const raw = String(rawPath ?? '');
      const isAbsolute = raw.startsWith('/');
      const seg = clean(rawPath);
      const segments = seg && !/^https?:\/\//i.test(raw)
        ? seg.split('/').filter(Boolean)
        : [];
      const full = isAbsolute
        ? segments.join('/')
        : [...prefix, ...segments].join('/');

      const id = node.id ?? node.menuId;
      if (code && !codeHit && (node.code === code || node.alias === code) && id != null) {
        codeHit = String(id);
      }
      if (full && full === target && id != null) return String(id);

      const children = Array.isArray(node.children) ? node.children : node.routes;
      if (Array.isArray(children) && children.length) {
        const nextPrefix = full ? full.split('/').filter(Boolean) : prefix;
        const found = walk(children, nextPrefix);
        if (found) return found;
      }
    }
    return undefined;
  };

  return walk(nodes, []) ?? codeHit;
}

/**
 * 列配置主键：显式传入优先，否则按当前路由自动反查。
 * 返回字符串，避免雪花 ID 在 JS Number 下静默丢精度。
 */
export const useAutoMenuId = (
  explicit?: string | number,
): string | undefined => {
  const location = useLocation();
  return useMemo(() => {
    if (explicit != null && explicit !== '') return String(explicit);
    try {
      return findMenuIdByPath(getRoutes(), location.pathname);
    } catch (_e) {
      return undefined;
    }
  }, [explicit, location.pathname]);
};

export default useAutoMenuId;
