import { useMemo } from 'react';
import { useModel, useAccess } from '@umijs/max';
import type { ButtonConfig } from '@/components/BusinessComponents/ToolBar';

/**
 * 权限检查自定义 Hook
 *
 * 判定统一走官方 access 方案（见 src/access.ts，数据源 initialState.buttons），
 * 不再从 localStorage 缓存（utils/authority）里翻按钮。
 *
 * ⚠️ 关于 `hasPermission`：后端 /menu/buttons 已按当前用户权限下发按钮树，
 * 前端再按 code 过滤一次会把非 admin 用户的按钮全部误杀（角色码 ≠ 按钮码），
 * 故保持历史行为——默认放行；需要按角色严格判定时用新暴露的 `canAccess(code)`。
 *
 * @example
 * ```tsx
 * const { hasPermission, filterButtons, getPageButtons, canAccess } = usePermission();
 *
 * const buttons = getPageButtons('dict');   // 取页面按钮（来自 access）
 * canAccess('系统管理员');                    // 按角色码判定
 * hasPageButton('dict', 'dict_add');        // 按钮级判定
 * ```
 */
export const usePermission = () => {
  const { initialState } = useModel('@@initialState');
  const { canAdmin, canAccess, hasButton, getPageButtons: getAccessPageButtons } = useAccess();

  const currentUser = initialState?.currentUser;
  const buttons = initialState?.buttons || [];

  // 管理员判定以 access 计算结果为准（兼容 access/roles/roleName 三种数据形态）
  const isAdmin = useMemo(() => canAdmin, [canAdmin]);

  /**
   * 是否放行该权限标识（默认放行：按钮树已由后端按权限下发）
   * @param permission 权限标识符
   */
  const hasPermission = (permission?: string): boolean => {
    if (!permission) return true;
    return true;
  };

  /**
   * 过滤按钮列表
   * @param buttonList 按钮配置数组
   * @returns 过滤后的按钮数组
   */
  const filterButtons = (buttonList: ButtonConfig[]) => {
    if (!buttonList || buttonList.length === 0) return [];
    return buttonList.filter((btn) => hasPermission(btn.permission || btn.code));
  };

  /**
   * 获取指定页面的按钮列表（access 数据源）
   * @param pageCode 菜单 code（如 'dict'）
   */
  const getPageButtons = (pageCode: string) => getAccessPageButtons(pageCode);

  /**
   * 页面是否拥有指定按钮
   * @param pageCode 菜单 code
   * @param buttonCode 按钮 code
   */
  const hasPageButton = (pageCode: string, buttonCode: string): boolean =>
    hasButton(pageCode, buttonCode);

  return {
    hasPermission,
    filterButtons,
    canAccess,
    getPageButtons,
    hasPageButton,
    isAdmin,
    buttons,
    currentUser,
    loading: false,
  };
};

export default usePermission;
