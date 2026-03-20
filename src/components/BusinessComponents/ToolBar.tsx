import React from 'react';
import { Button, Space } from 'antd';
import type { ButtonProps } from 'antd';
import { usePermission } from '@/hooks/usePermission';

/**
 * 按钮配置
 */
export interface ButtonConfig {
  /** 按钮代码（权限标识） */
  code: string;
  /** 按钮名称 */
  name: string;
  /** 按钮别名 */
  alias?: string;
  /** 按钮类型 */
  action?: number; // 1=顶部，2=行内，3=都显示
  /** 按钮图标 */
  source?: string;
  /** 按钮路径 */
  path?: string;
  /** 权限标识（可选，如不传则使用 code 作为权限标识） */
  permission?: string;
}

/**
 * ToolBar 组件属性
 */
export interface ToolBarProps {
  /** 按钮列表 */
  buttons: ButtonConfig[];
  /** 自定义左侧按钮 */
  renderLeftButton?: () => React.ReactNode;
  /** 自定义右侧按钮 */
  renderRightButton?: () => React.ReactNode;
  /** 点击回调 */
  onClick: (button: ButtonConfig) => void;
  /** 是否启用权限过滤（默认 true） */
  enablePermissionCheck?: boolean;
}

/**
 * ToolBar 工具栏组件
 * 
 * 用于渲染顶部工具栏按钮，支持权限控制
 * 根据按钮的 action 属性过滤显示位置
 * 根据用户权限过滤可显示的按钮
 * 
 * @example
 * ```tsx
 * <ToolBar
 *   buttons={buttons}
 *   onClick={(btn) => handleButtonClick(btn)}
 *   enablePermissionCheck={true}
 * />
 * ```
 */
const ToolBar: React.FC<ToolBarProps> = ({
  buttons,
  renderLeftButton,
  renderRightButton,
  onClick,
  enablePermissionCheck = true,
}) => {
  const { hasPermission, filterButtons } = usePermission();

  // 权限过滤
  const permissionFilteredButtons = React.useMemo(() => {
    if (!enablePermissionCheck) {
      return buttons;
    }
    return filterButtons(buttons);
  }, [buttons, enablePermissionCheck, filterButtons]);

  // 过滤顶部按钮 (action = 1 或 3)
  const topButtons = React.useMemo(() => {
    return permissionFilteredButtons.filter(
      (button) => button.action === 1 || button.action === 3
    );
  }, [permissionFilteredButtons]);

  return (
    <div
      style={{
        marginBottom: 16,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Space>
        {topButtons.map((button) => (
          <Button
            key={button.code}
            icon={button.source ? <span>{button.source}</span> : undefined}
            type={
              button.alias === 'delete'
                ? 'primary'
                : button.alias === 'add'
                ? 'primary'
                : 'default'
            }
            danger={button.alias === 'delete'}
            onClick={() => onClick(button)}
          >
            {button.name}
          </Button>
        ))}
        {renderLeftButton?.()}
      </Space>
      {renderRightButton?.()}
    </div>
  );
};

export default ToolBar;
