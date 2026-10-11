import { useMemo } from 'react';
import { useLocation, useAccess } from '@umijs/max';

/**
 * 从路由路径提取菜单 code
 * 例如：/system/user -> user, /system/menu -> menu
 * @param pathname 路由路径
 * @returns 菜单 code
 */
export const getMenuCodeFromPath = (pathname: string): string => {
  const parts = pathname.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : '';
};

/**
 * 当前页面按钮权限 hook
 *
 * 数据源改为官方 access 方案（initialState.buttons，见 src/access.ts），
 * 不再直接读 localStorage 缓存（utils/authority.getButton）。
 *
 * @example
 * ```tsx
 * const { buttons } = usePageButtons();        // 自动按当前路由取
 * const { buttons } = usePageButtons('user');  // 指定菜单 code
 * ```
 */
export const usePageButtons = (menuCode?: string) => {
  const { getPageButtons } = useAccess();
  const location = useLocation();

  // 未传 menuCode 时，从路由路径自动提取
  const code = menuCode || getMenuCodeFromPath(location.pathname);

  // access 数据随 initialState 就绪，无需 loading 中间态（避免按钮闪现）
  const buttons = useMemo(() => getPageButtons(code) || [], [getPageButtons, code]);

  return { buttons, loading: false };
};

export default usePageButtons;
