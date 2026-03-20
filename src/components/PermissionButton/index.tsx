import { Tooltip } from 'antd';
import type { ButtonProps } from 'antd';

/**
 * 按钮权限配置
 */
export interface PermissionButtonProps extends ButtonProps {
  /** 权限代码，如 'product:add' */
  permission?: string;
  /** 是否有权限（用于外部传入权限判断结果） */
  hasPermission?: boolean;
  /** 无权限时是否显示为禁用状态（默认为 false，即不显示） */
  showWhenNoPermission?: boolean;
  /** 无权限时的提示文本 */
  noPermissionTip?: string;
  /** 权限检查通过时渲染的子组件 */
  children?: React.ReactNode;
}

/**
 * 权限按钮组件
 * 
 * 特性：
 * - 自动根据权限控制按钮显示/隐藏
 * - 支持禁用模式（showWhenNoPermission=true）
 * - 支持无权限提示（Tooltip）
 * - 完全继承 antd Button 的所有属性
 * 
 * @example
 * ```tsx
 * // 基础用法 - 无权限时隐藏
 * <PermissionButton permission="product:add">
 *   <Button type="primary">新增</Button>
 * </PermissionButton>
 * 
 * // 禁用模式 - 无权限时显示为禁用
 * <PermissionButton 
 *   permission="product:delete"
 *   showWhenNoPermission
 *   noPermissionTip="您没有删除权限"
 * >
 *   <Button danger>删除</Button>
 * </PermissionButton>
 * 
 * // 配合 usePageButtons 使用
 * const { buttons } = usePageButtons();
 * <PermissionButton 
 *   hasPermission={buttons.some(btn => btn.code === 'product:add')}
 * >
 *   <Button type="primary">新增</Button>
 * </PermissionButton>
 * ```
 */
export const PermissionButton: React.FC<PermissionButtonProps> = ({
  permission,
  hasPermission,
  showWhenNoPermission = false,
  noPermissionTip = '您没有此操作权限',
  children,
  ...buttonProps
}) => {
  // 如果没有传入权限判断，默认认为有权限
  const permissionGranted = hasPermission !== undefined ? hasPermission : true;

  // 如果没有权限且不显示禁用状态，返回 null
  if (!permissionGranted && !showWhenNoPermission) {
    return null;
  }

  // 如果有权限，直接渲染
  if (permissionGranted) {
    return <>{children}</>;
  }

  // 如果没有权限但需要显示为禁用，使用 Tooltip 包裹
  return (
    <Tooltip title={noPermissionTip}>
      <span>
        {React.cloneElement(children as React.ReactElement, {
          disabled: true,
          ...buttonProps,
        })}
      </span>
    </Tooltip>
  );
};

/**
 * 权限检查辅助函数
 * 
 * @param buttons 按钮权限数组
 * @param code 权限代码
 * @returns 是否有权限
 */
export const checkPermission = (buttons: any[], code: string): boolean => {
  return buttons.some((btn) => btn.code === code);
};

/**
 * 批量权限检查辅助函数
 * 
 * @param buttons 按钮权限数组
 * @param codes 权限代码数组
 * @returns 是否有任一权限
 */
export const checkAnyPermission = (buttons: any[], codes: string[]): boolean => {
  return codes.some((code) => buttons.some((btn) => btn.code === code));
};

/**
 * 获取按钮权限
 * 
 * @param buttons 按钮权限数组
 * @param code 权限代码
 * @returns 按钮权限对象
 */
export const getButtonPermission = (
  buttons: any[],
  code: string,
): any | undefined => {
  return buttons.find((btn) => btn.code === code);
};

export default PermissionButton;
