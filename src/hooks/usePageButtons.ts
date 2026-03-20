import { useEffect, useState } from 'react';
import { useLocation } from '@umijs/max';
import { getButton } from '@/utils/authority';

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
 * 动态获取当前页面按钮权限的自定义 Hook
 * 
 * @example
 * ```tsx
 * // 基础用法 - 自动从路由获取
 * const { buttons, loading } = usePageButtons();
 * 
 * // 指定菜单 code
 * const { buttons } = usePageButtons('user');
 * 
 * // 在组件中使用
 * useEffect(() => {
 *   console.log('页面按钮:', buttons);
 * }, [buttons]);
 * ```
 * 
 * @param menuCode 可选，指定菜单 code，不传则自动从路由提取
 * @returns 按钮权限数组和加载状态
 */
export const usePageButtons = (menuCode?: string) => {
  const [buttons, setButtons] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const location = useLocation();

  useEffect(() => {
    setLoading(true);
    
    // 如果没有传入 menuCode，则从路由路径自动提取
    const code = menuCode || getMenuCodeFromPath(location.pathname);
    
    console.log('当前路由路径:', location.pathname);
    console.log('使用的菜单 code:', code);
    
    const btns = getButton(code);
    console.log('获取到的按钮权限:', btns);
    
    setButtons(btns || []);
    setLoading(false);
  }, [menuCode, location.pathname]);

  return { buttons, loading };
};

export default usePageButtons;
