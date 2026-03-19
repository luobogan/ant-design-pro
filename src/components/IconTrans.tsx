import React from 'react';
import * as icons from '@ant-design/icons';

/**
 * 动态加载图标组件
 * @param iconName 图标名称
 * @returns React.ReactNode
 */
const lazyLoadIcon = (iconName: string): React.ReactNode => {
  if (!iconName) {
    return null;
  }
  
  // Try to find the icon component
  const IconComponent = icons[`${iconName}Outlined`] || icons[iconName];
  
  if (IconComponent) {
    return React.createElement(IconComponent);
  }
  
  // Return a default icon if not found
  return React.createElement(icons.SettingOutlined);
};

export default lazyLoadIcon;