import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Card, Empty, Spin, Typography } from 'antd';
import { portalApi } from '@/services/portal';
import type { PortalMenuNode } from '@/services/portal';
import MenuTreePanel from './MenuTreePanel';
import ResourcePanel from './ResourcePanel';
import { MODULES, getModule, resolveModuleKey } from './modules';
import { filterMenuTree, findMenuNode, firstSelectableKey, toWorkbenchTree } from './menuTree';
import type { WorkbenchMenuNode } from './types';
import './style.css';

/**
 * 后端菜单不可用时的兜底菜单树：与已授权的终端门户菜单保持一致，
 * 保证页面在任何环境下都能渲染出完整的多级菜单与内容联动。
 */
const FALLBACK_TREE: WorkbenchMenuNode[] = [
  {
    key: 'fb-portal',
    label: '门户',
    icon: 'home',
    routeUrl: '/portal/home',
    moduleKey: 'home',
    children: MODULES.filter((m) => m.key !== 'home').map((m) => ({
      key: `fb-${m.key}`,
      label: m.title,
      routeUrl: m.matchPaths?.[0] ?? `/portal/${m.key}`,
      moduleKey: m.key,
      children: [],
    })),
  },
];

/**
 * 门户工作台：左侧固定多级菜单树 + 右侧内容区。
 * 菜单与内容一一联动，所有增删改查均在右侧页面内完成，不使用任何弹窗/模态框。
 */
const PortalWorkbench: React.FC = () => {
  const [rawTree, setRawTree] = useState<WorkbenchMenuNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | undefined>();
  const [degraded, setDegraded] = useState(false);

  const loadTree = useCallback(async () => {
    setLoading(true);
    let nodes: PortalMenuNode[] = [];
    let usedFallback = true;
    try {
      nodes = (await portalApi.getSystemMenuTree('front')) || [];
      if (nodes.length) usedFallback = false;
    } catch {
      try {
        nodes = (await portalApi.getMenuTree('front')) || [];
        if (nodes.length) usedFallback = false;
      } catch {
        nodes = [];
      }
    }
    const tree = toWorkbenchTree(nodes, resolveModuleKey);
    setRawTree(tree.length ? tree : FALLBACK_TREE);
    setDegraded(usedFallback);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const filteredTree = useMemo(() => filterMenuTree(rawTree, keyword), [rawTree, keyword]);
  const selectedNode = useMemo(
    () => (selectedKey ? findMenuNode(filteredTree, selectedKey) : undefined),
    [filteredTree, selectedKey],
  );

  // 选中项失效（切换模块或搜索过滤后）时回落到首个可用模块
  useEffect(() => {
    if (!filteredTree.length) return;
    if (selectedKey && findMenuNode(filteredTree, selectedKey)) return;
    setSelectedKey(firstSelectableKey(filteredTree));
  }, [filteredTree, selectedKey]);

  const currentModule = getModule(selectedNode?.moduleKey);

  return (
    <div className="wb">
      <div className="wb-sider">
        <MenuTreePanel
          tree={filteredTree}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          keyword={keyword}
          onKeywordChange={setKeyword}
          currentTitle={currentModule?.title}
        />
      </div>

      <div className="wb-main">
        {loading ? (
          <Card size="small">
            <div className="wb-loading">
              <Spin description="正在加载门户菜单..." />
            </div>
          </Card>
        ) : (
          <>
            {degraded ? (
              <Alert
                className="wb-card"
                type="warning"
                showIcon
                title="门户菜单接口暂不可用，当前展示内置菜单结构。"
              />
            ) : null}

            {currentModule ? (
              <ResourcePanel key={currentModule.key} module={currentModule} />
            ) : (
              <Card size="small">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <Typography.Text type="secondary">请从左侧菜单中选择具体功能</Typography.Text>
                  }
                />
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PortalWorkbench;