import { describe, expect, it } from 'vitest';
import {
  filterMenuTree,
  findMenuNode,
  firstSelectableKey,
  flattenMenuTree,
  segmentOf,
  toWorkbenchTree,
} from './menuTree';
import { MODULES, getModule, resolveModuleKey } from './modules';
import type { PortalMenuNode } from '@/services/portal';
import type { WorkbenchMenuNode } from './types';

/** 后端多级菜单树样例（与门户已授权菜单结构一致） */
const BACKEND_TREE: PortalMenuNode[] = [
  {
    id: 100,
    menuName: '门户',
    routeUrl: '/portal/home',
    children: [
      { id: 101, menuName: '公告详情', routeUrl: '/portal/noticedetail', children: [] },
      { id: 102, menuName: '协同区', routeUrl: '/portal/synergy', children: [] },
      {
        id: 103,
        menuName: '内容分组',
        routeUrl: '',
        children: [
          { id: 104, menuName: '特色门户', routeUrl: '/portal/tsportal', children: [] },
          { id: 105, menuName: '机构默认首页', routeUrl: '/portal/defaultportal', children: [] },
        ],
      },
    ],
  },
];

describe('menuTree / segmentOf', () => {
  it('截取路由末段作为模块 key', () => {
    expect(segmentOf('/portal/noticedetail')).toBe('noticedetail');
  });

  it('忽略查询串、哈希与末尾斜杠', () => {
    expect(segmentOf('/portal/synergy/?tab=1')).toBe('synergy');
    expect(segmentOf('/portal/tsportal#top')).toBe('tsportal');
  });

  it('空路由返回 undefined', () => {
    expect(segmentOf(undefined)).toBeUndefined();
    expect(segmentOf('')).toBeUndefined();
  });
});

describe('menuTree / toWorkbenchTree', () => {
  const tree = toWorkbenchTree(BACKEND_TREE, resolveModuleKey);

  it('保留多级结构并补齐 key', () => {
    expect(tree).toHaveLength(1);
    expect(tree[0].key).toBe('100');
    expect(tree[0].children).toHaveLength(3);
    expect(tree[0].children?.[2].children?.map((c) => c.key)).toEqual(['104', '105']);
  });

  it('依据 routeUrl 解析出内容模块', () => {
    expect(tree[0].moduleKey).toBe('home');
    expect(tree[0].children?.[0].moduleKey).toBe('noticedetail');
    // 无 routeUrl 的分组节点不应命中模块
    expect(tree[0].children?.[2].moduleKey).toBeUndefined();
  });

  it('无 id 时生成稳定兜底 key', () => {
    const noId = toWorkbenchTree([{ menuName: 'X', routeUrl: '/portal/home' }], resolveModuleKey);
    expect(noId[0].key).toBe('wb-0');
  });

  it('容忍空输入', () => {
    expect(toWorkbenchTree(undefined, resolveModuleKey)).toEqual([]);
    expect(toWorkbenchTree([], resolveModuleKey)).toEqual([]);
  });
});

describe('menuTree / filterMenuTree', () => {
  const tree = toWorkbenchTree(BACKEND_TREE, resolveModuleKey);

  it('空关键字原样返回', () => {
    expect(filterMenuTree(tree, '')).toBe(tree);
  });

  it('仅子节点命中时保留完整祖先路径', () => {
    const hit = filterMenuTree(tree, '特色门户');
    expect(hit).toHaveLength(1);
    expect(hit[0].label).toBe('门户');
    const group = hit[0].children?.[0];
    expect(group?.label).toBe('内容分组');
    expect(group?.children?.[0].label).toBe('特色门户');
  });

  it('父节点自身命中时保留其全部子树', () => {
    const hit = filterMenuTree(tree, '门户');
    expect(hit[0].children).toHaveLength(3);
  });

  it('无匹配返回空数组', () => {
    expect(filterMenuTree(tree, '不存在的菜单')).toEqual([]);
  });
});

describe('menuTree / findMenuNode 与 firstSelectableKey', () => {
  const tree = toWorkbenchTree(BACKEND_TREE, resolveModuleKey);

  it('可递归定位任意层级节点', () => {
    expect(findMenuNode(tree, '104')?.label).toBe('特色门户');
  });

  it('key 不存在时返回 undefined', () => {
    expect(findMenuNode(tree, '999')).toBeUndefined();
  });

  it('首个可选节点为深度优先顺序中的首个可渲染模块', () => {
    expect(firstSelectableKey(tree)).toBe('100');
  });

  it('跳过无模块的分组节点', () => {
    const groupOnly: WorkbenchMenuNode[] = [
      {
        key: 'g',
        label: '分组',
        moduleKey: undefined,
        children: [{ key: 'c', label: '子', moduleKey: 'synergy', children: [] }],
      },
    ];
    expect(firstSelectableKey(groupOnly)).toBe('c');
  });

  it('flattenMenuTree 深度优先展开全部节点', () => {
    expect(flattenMenuTree(tree).map((n) => n.key)).toEqual(['100', '101', '102', '103', '104', '105']);
  });
});

describe('modules / resolveModuleKey', () => {
  it('覆盖已授权的终端门户菜单路径', () => {
    expect(resolveModuleKey('/portal/home')).toBe('home');
    expect(resolveModuleKey('/portal/noticedetail')).toBe('noticedetail');
    expect(resolveModuleKey('/portal/defaultportal')).toBe('defaultportal');
    expect(resolveModuleKey('/portal/synergy')).toBe('synergy');
    expect(resolveModuleKey('/portal/tsportal')).toBe('tsportal');
  });

  it('管理类菜单不映射任何内容模块', () => {
    expect(resolveModuleKey('/portal/setting')).toBeUndefined();
    expect(resolveModuleKey('/portal/plugin')).toBeUndefined();
  });

  it('空路由返回 undefined', () => {
    expect(resolveModuleKey(undefined)).toBeUndefined();
  });
});

describe('modules / 注册表自检', () => {
  it('模块 key 唯一', () => {
    const keys = MODULES.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('每个模块至少声明一个字段且无重名字段', () => {
    MODULES.forEach((m) => {
      expect(m.fields.length).toBeGreaterThan(0);
      const names = m.fields.map((f) => f.name);
      expect(new Set(names).size).toBe(names.length);
    });
  });

  it('select 字段必须提供选项', () => {
    MODULES.forEach((m) => {
      m.fields.filter((f) => f.type === 'select').forEach((f) => {
        expect(f.options?.length).toBeGreaterThan(0);
      });
    });
  });

  it('getModule 按 key 取定义，未知 key 返回 undefined', () => {
    expect(getModule('synergy')?.title).toBe('协同区管理');
    expect(getModule('unknown')).toBeUndefined();
    expect(getModule(undefined)).toBeUndefined();
  });
});