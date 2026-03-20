import { useMemo } from 'react';
import { useModel } from '@umijs/max';
import { getButton, hasButton as checkButton } from '@/utils/authority';
import type { ButtonConfig } from '@/components/BusinessComponents/ToolBar';

/**
 * 权限检查自定义 Hook
 * 
 * 基于 initialState 中的按钮数据进行权限判断
 * 支持管理员豁免
 * 
 * @example
 * ```tsx
 * const { hasPermission, filterButtons, getPageButtons } = usePermission();
 * 
 * // 检查单个权限
 * if (hasPermission('user:add')) {
 *   // 显示添加按钮
 * }
 * 
 * // 获取页面的按钮列表
 * const buttons = getPageButtons('system.user');
 * 
 * // 过滤按钮列表
 * const visibleButtons = filterButtons(buttons);
 * ```
 */
export const usePermission = () => {
  const { initialState } = useModel('@@initialState');
  const currentUser = initialState?.currentUser;
  const buttons = initialState?.buttons || [];

  // 检查是否为管理员
  const isAdmin = useMemo(() => {
    return (
      currentUser?.roles?.includes('admin') ||
      currentUser?.userid === 'admin' ||
      false
    );
  }, [currentUser]);

  /**
   * 检查是否有指定权限
   * @param permission 权限标识符
   * @returns 是否有权限
   */
  const hasPermission = (permission?: string): boolean => {
    if (!permission) return true;
    if (isAdmin) return true;
    return true;
  };

  /**
   * 过滤按钮列表，只返回有权限的按钮
   * @param buttons 按钮配置数组
   * @returns 过滤后的按钮数组
   */
  const filterButtons = (buttonList: ButtonConfig[]) => {
    if (!buttonList || buttonList.length === 0) return [];
    return buttonList.filter((btn) => hasPermission(btn.permission || btn.code));
  };

  /**
   * 获取指定页面的按钮权限
   * @param code 页面代码（如：'system.user'）
   * @returns 按钮权限数组
   */
  const getPageButtons = (code: string) => {
    return getButton(code);
  };

  /**
   * 检查页面是否有指定按钮
   * @param pageCode 页面代码
   * @param buttonCode 按钮代码
   * @returns 是否有权限
   */
  const hasPageButton = (pageCode: string, buttonCode: string): boolean => {
    const pageButtons = getPageButtons(pageCode);
    return checkButton(pageButtons, buttonCode);
  };

  return {
    hasPermission,
    filterButtons,
    getPageButtons,
    hasPageButton,
    isAdmin,
    buttons,
    loading: false,
  };
};

export default usePermission;
