import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PortalMenuNode } from '@/services/portal';

const mocks = vi.hoisted(() => ({
  getSystemMenuTree: vi.fn(),
  getMenuTree: vi.fn(),
}));

vi.mock('@/services/portal', () => ({
  portalApi: {
    getSystemMenuTree: mocks.getSystemMenuTree,
    getMenuTree: mocks.getMenuTree,
  },
}));

import PortalWorkbench from './index';

/** 与门户已授权菜单一致的多级菜单树 */
const BACKEND_TREE: PortalMenuNode[] = [
  {
    id: 100,
    menuName: '门户',
    routeUrl: '/portal/home',
    children: [
      { id: 101, menuName: '公告详情', routeUrl: '/portal/noticedetail', children: [] },
      { id: 102, menuName: '协同区', routeUrl: '/portal/synergy', children: [] },
    ],
  },
];

/** 断言页面未使用任何弹窗/模态框承载内容或操作 */
const expectNoModal = () => {
  expect(document.querySelector('.ant-modal')).toBeNull();
  expect(document.querySelector('.ant-drawer')).toBeNull();
  expect(document.querySelector('.ant-popconfirm')).toBeNull();
};

beforeEach(() => {
  localStorage.clear();
  mocks.getSystemMenuTree.mockReset();
  mocks.getMenuTree.mockReset();
  mocks.getSystemMenuTree.mockResolvedValue(BACKEND_TREE);
  mocks.getMenuTree.mockResolvedValue([]);
});

describe('门户工作台 / 冒烟', () => {
  it('渲染左右分栏：左侧菜单树 + 右侧内容', async () => {
    render(<PortalWorkbench />);

    expect(await screen.findByText('功能菜单')).toBeInTheDocument();
    expect(await screen.findByText('公告详情')).toBeInTheDocument();

    // 默认选中第一个可渲染模块（门户 -> 门户概览）
    expect(await screen.findByText('门户概览列表')).toBeInTheDocument();
    expectNoModal();
  });

  it('点击左侧菜单联动切换右侧内容', async () => {
    render(<PortalWorkbench />);
    await screen.findByText('门户概览列表');

    fireEvent.click(screen.getByText('协同区'));

    await waitFor(() => {
      expect(screen.getByText('协同区管理列表')).toBeInTheDocument();
    });
    expect(screen.queryByText('门户概览列表')).not.toBeInTheDocument();
    expectNoModal();
  });

  it('右侧内联表单承载新增入口，不弹窗', async () => {
    render(<PortalWorkbench />);
    await screen.findByText('门户概览列表');

    fireEvent.click(screen.getByText('公告详情'));
    await screen.findByText('公告管理列表');

    fireEvent.click(screen.getByRole('button', { name: /新增/ }));

    expect(await screen.findByText('新增：公告管理')).toBeInTheDocument();
    expect(screen.getByLabelText('公告标题')).toBeInTheDocument();
    expectNoModal();
  });

  it('行内删除采用二次确认，而非弹窗', async () => {
    render(<PortalWorkbench />);
    await screen.findByText('门户概览列表');

    fireEvent.click(screen.getByText('公告详情'));
    await screen.findByText('公告管理列表');

    expect(await screen.findByText('系统维护窗口说明')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /删除/ })[0]);

    expect(await screen.findByRole('button', { name: '确认删除' })).toBeInTheDocument();
    expectNoModal();
  });

  it('只读模块不提供新增入口', async () => {
    render(<PortalWorkbench />);
    await screen.findByText('门户概览列表');
    expect(screen.queryByRole('button', { name: /新增/ })).not.toBeInTheDocument();
  });

  it('菜单接口异常时降级为内置菜单且仍可联动', async () => {
    mocks.getSystemMenuTree.mockRejectedValue(new Error('network down'));
    mocks.getMenuTree.mockRejectedValue(new Error('network down'));

    render(<PortalWorkbench />);

    expect(
      await screen.findByText('门户菜单接口暂不可用，当前展示内置菜单结构。'),
    ).toBeInTheDocument();
    expect(await screen.findByText('门户概览列表')).toBeInTheDocument();

    fireEvent.click(screen.getByText('公告管理'));
    await waitFor(() => {
      expect(screen.getByText('新增：公告管理')).toBeInTheDocument();
    });
    expectNoModal();
  });
});