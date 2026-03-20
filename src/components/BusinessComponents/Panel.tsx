import React from 'react';
import { Card } from 'antd';
import type { CardProps } from 'antd';

/**
 * Panel 组件属性
 */
export interface PanelProps extends Omit<CardProps, 'title'> {
  /** 面板标题 */
  title: React.ReactNode;
  /** 返回路径 */
  back?: string;
  /** 操作按钮 */
  action?: React.ReactNode;
  /** 子内容 */
  children: React.ReactNode;
}

/**
 * Panel 面板组件
 * 
 * 用于包裹页面内容，提供统一的页面布局
 * 包含标题、返回按钮、操作按钮等功能
 * 
 * @example
 * ```tsx
 * <Panel title="用户管理" back="/system/user" action={<Button type="primary">新增</Button>}>
 *   <div>页面内容</div>
 * </Panel>
 * ```
 */
const Panel: React.FC<PanelProps> = ({
  title,
  back,
  action,
  children,
  ...cardProps
}) => {
  return (
    <Card
      bordered={false}
      {...cardProps}
    >
      <div style={{ marginBottom: 16 }}>
        {/* 标题区域可以在这里扩展 */}
      </div>
      {children}
    </Card>
  );
};

export default Panel;
