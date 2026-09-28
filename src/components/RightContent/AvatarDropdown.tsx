import {
  LogoutOutlined,
  SettingOutlined,
  SkinOutlined,
} from '@ant-design/icons';
import { history, useModel } from '@umijs/max';
import type { MenuProps } from 'antd';
import { Badge, Spin } from 'antd';
import React, { startTransition, useEffect, useState } from 'react';
import { outLogin } from '@/services/ant-design-pro/api';
import { clearAuthority } from '@/utils/authority';
import { monitorCount } from '@/services/workflow';
import { pickPayload } from '@/utils/utils';
import HeaderDropdown from '../HeaderDropdown';

type GlobalHeaderRightProps = {
  children?: React.ReactNode;
};

const menuItems: MenuProps['items'] = [
  {
    key: 'settings',
    icon: <SettingOutlined />,
    label: '个人设置',
  },
  {
    key: 'theme',
    icon: <SkinOutlined />,
    label: '主题设置',
  },
  {
    type: 'divider' as const,
  },
  {
    key: 'logout',
    icon: <LogoutOutlined />,
    label: '退出登录',
  },
];

const loginOut = async () => {
  try {
    await outLogin();
  } catch {
    // 后端退出失败也不影响前端退出：本地登录态必须清掉，否则刷新后用旧 token 又会自动登录
  }
  // ⚠️ 关键：真正清除本地登录态（sword-token / 权限 / 用户信息 / 菜单按钮缓存等）。
  // 旧实现只调用了后端 /api/blade-auth/logout，没清 localStorage，
  // 于是刷新后 getInitialState 仍用旧 token 拉到用户信息 → 「自动登录」回来了。
  clearAuthority();
  const { search, pathname } = window.location;
  const urlParams = new URL(window.location.href).searchParams;
  const searchParams = new URLSearchParams({
    redirect: pathname + search,
  });
  const redirect = urlParams.get('redirect');
  if (window.location.pathname !== '/user/login' && !redirect) {
    history.replace({
      pathname: '/user/login',
      search: searchParams.toString(),
    });
  }
};

export const AvatarDropdown: React.FC<GlobalHeaderRightProps> = ({
  children,
}) => {
  const { initialState, setInitialState } = useModel('@@initialState');

  // 顶栏待办角标计数。
  // 注意：hooks 必须无条件调用，不能放在下面的早退分支（return <Spin/>）之后！
  // 否则 initialState / currentUser 由「有值」变成「无值」时（如退出登录、拉取失败），
  // 后续渲染调用的 hooks 会比上一次少，React 直接抛
  // "Rendered fewer hooks than expected"。
  const [todoCount, setTodoCount] = useState(0);
  const currentUser = initialState?.currentUser;

  const onMenuClick: MenuProps['onClick'] = (event) => {
    const { key } = event;
    if (key === 'logout') {
      startTransition(() => {
        setInitialState((s) => ({ ...s, currentUser: undefined }));
      });
      loginOut();
      return;
    }
    if (key === 'theme') {
      setInitialState((s) => ({ ...s, settingDrawerOpen: true }));
      return;
    }
    history.push(`/account/${key}`);
  };

  useEffect(() => {
    if (!currentUser?.userid) return;
    let alive = true;
    monitorCount(currentUser.userid)
      .then((res: any) => {
        if (!alive) return;
        const m = pickPayload(res) || {};
        const c =
          typeof m.todo === 'number'
            ? m.todo
            : Object.values(m).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
        setTodoCount(c);
      })
      .catch(() => {
        if (alive) setTodoCount(0);
      });
    return () => {
      alive = false;
    };
  }, [currentUser?.userid]);

  if (!initialState || !currentUser) {
    return <Spin size="small" />;
  }

  return (
    <Badge count={todoCount} size="small" offset={[-2, 2]}>
      <HeaderDropdown
        placement="bottomRight"
        menu={{
          selectedKeys: [],
          onClick: onMenuClick,
          items: menuItems,
        }}
        arrow
      >
        {children}
      </HeaderDropdown>
    </Badge>
  );
};
