import React, { useEffect, useState } from 'react';
import { Tree, Input } from 'antd';
import { history } from 'umi';
import { listCategoryTree, type DocSecCategory } from '@/services/doc';

type TreeNode = { key: string; title: string; children?: TreeNode[] };

function buildTree(list: DocSecCategory[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  list.forEach((c) => {
    map.set(String(c.id), { key: String(c.id), title: c.name || '', children: [] });
  });
  const roots: TreeNode[] = [];
  list.forEach((c) => {
    const node = map.get(String(c.id))!;
    const pid = c.parentId === 0 || c.parentId == null ? null : String(c.parentId);
    if (pid && map.has(pid)) {
      map.get(pid)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function collectKeys(nodes: TreeNode[], acc: string[] = []): string[] {
  nodes.forEach((n) => {
    acc.push(n.key);
    if (n.children) collectKeys(n.children, acc);
  });
  return acc;
}

// 命中节点自身或任一后代命中时保留（搜索时过滤树）
function filterTreeData(nodes: TreeNode[], val: string): TreeNode[] {
  const lower = val.toLowerCase();
  const rec = (ns: TreeNode[]): TreeNode[] => {
    const out: TreeNode[] = [];
    ns.forEach((n) => {
      const selfMatch = (n.title || '').toLowerCase().includes(lower);
      const kids = n.children ? rec(n.children) : [];
      if (selfMatch) out.push({ ...n, children: n.children });
      else if (kids.length) out.push({ ...n, children: kids });
    });
    return out;
  };
  return rec(nodes);
}

interface Props {
  selectedId?: number | string | undefined;
  onSelect?: (id?: number | string) => void;
  height?: number | string;
}

/**
 * 内容引擎 - 左侧目录树（复用于 category / search / recycle）。
 * 顶部搜索框过滤节点；根节点「全部目录」选中时回调 undefined，表示不过滤。
 */
const CategoryTree: React.FC<Props> = ({ selectedId, onSelect, height }) => {
  const [fullData, setFullData] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>(['__all__']);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const list = await listCategoryTree();
        const root = { key: '__all__', title: '全部目录', children: buildTree(list || []) };
        setFullData([root]);
        setExpandedKeys(collectKeys([root]));
      } catch (e) {
        const root = { key: '__all__', title: '全部目录', children: [] };
        setFullData([root]);
        setExpandedKeys(['__all__']);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const displayData = searchValue ? filterTreeData(fullData, searchValue) : fullData;

  // 搜索时展开全部以露出命中节点
  useEffect(() => {
    if (searchValue) setExpandedKeys(collectKeys(displayData));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  const selKey = selectedId ? String(selectedId) : '__all__';

  return (
    <div>
      <Input.Search
        allowClear
        placeholder="搜索目录"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        style={{ marginBottom: 8 }}
      />
      <Tree
        showLine
        blockNode
        treeData={displayData}
        loading={loading}
        selectedKeys={[selKey]}
        expandedKeys={expandedKeys}
        onExpand={(keys) => setExpandedKeys(keys)}
        onSelect={(keys) => {
          const k = keys[0] as string;
          onSelect?.(k && k !== '__all__' ? k : undefined);
        }}
        style={{ height, overflow: 'auto' }}
      />
    </div>
  );
};

export default CategoryTree;

/**
 * 将选中的目录同步到 URL ?cat=，便于刷新保持选中。
 * 用 search 参数（而非 query 对象），兼容当前 umi history 版本。
 */
export function syncCatToUrl(id?: number | string) {
  try {
    const search = new URLSearchParams(history.location.search);
    if (id) search.set('cat', String(id));
    else search.delete('cat');
    const qs = search.toString();
    history.replace({
      pathname: history.location.pathname,
      search: qs ? `?${qs}` : '',
    });
  } catch (e) {
    /* 忽略 URL 同步异常，不影响筛选 */
  }
}
