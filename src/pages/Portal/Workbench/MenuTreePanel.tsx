import React, { useMemo } from 'react';
import { Empty, Input, Tree, Typography } from 'antd';
import {
  AppstoreOutlined,
  BarChartOutlined,
  DashboardOutlined,
  EditOutlined,
  HomeOutlined,
  MessageOutlined,
  TableOutlined,
} from '@ant-design/icons';
import type { WorkbenchMenuNode } from './types';

/** antd Tree 需要的最小节点结构（避免深路径类型依赖） */
interface TreeNode {
  key: string;
  title: React.ReactNode;
  icon?: React.ReactNode;
  children?: TreeNode[];
}

/** 门户菜单 icon 字符串 -> antd 图标 */
const ICONS: Record<string, React.ReactNode> = {
  home: <HomeOutlined />,
  message: <MessageOutlined />,
  appstore: <AppstoreOutlined />,
  dashboard: <DashboardOutlined />,
  'bar-chart': <BarChartOutlined />,
  table: <TableOutlined />,
  edit: <EditOutlined />,
};

const toTreeData = (nodes: WorkbenchMenuNode[]): TreeNode[] =>
  (nodes || []).map((n) => {
    const children = n.children?.length ? toTreeData(n.children) : undefined;
    return {
      key: n.key,
      title: n.label,
      icon: ICONS[n.icon || ''] || <AppstoreOutlined />,
      children,
    };
  });

export interface MenuTreePanelProps {
  tree: WorkbenchMenuNode[];
  selectedKey?: string;
  onSelect: (key: string) => void;
  keyword: string;
  onKeywordChange: (value: string) => void;
  /** 当前所在模块标题，展示在菜单树顶部 */
  currentTitle?: string;
}

/**
 * 左侧固定菜单树：支持多级展示与关键字过滤，
 * 点击节点通过 onSelect 通知外层切换右侧内容（不发生路由跳转）。
 */
const MenuTreePanel: React.FC<MenuTreePanelProps> = ({
  tree,
  selectedKey,
  onSelect,
  keyword,
  onKeywordChange,
  currentTitle,
}) => {
  const treeData = useMemo(() => toTreeData(tree), [tree]);

  return (
    <div className="wb-sider-inner">
      <div className="wb-sider-head">
        <Typography.Text strong>功能菜单</Typography.Text>
        {currentTitle ? (
          <Typography.Text type="secondary" className="wb-sider-current" ellipsis>
            {currentTitle}
          </Typography.Text>
        ) : null}
      </div>

      <Input.Search
        allowClear
        placeholder="搜索菜单"
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
        className="wb-sider-search"
      />

      {treeData.length ? (
        <Tree
          showLine
          blockNode
          treeData={treeData}
          selectedKeys={selectedKey ? [selectedKey] : []}
          defaultExpandAll
          onSelect={(keys) => {
            const key = keys[0];
            if (key) onSelect(String(key));
          }}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未匹配到菜单" />
      )}
    </div>
  );
};

export default React.memo(MenuTreePanel);