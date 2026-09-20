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
    // Local logout has already cleared user state; redirect should still proceed.
  }
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

  if (!initialState) {
    return <Spin size="small" />;
  }

  const { currentUser } = initialState;

  if (!currentUser) {
    return <Spin size="small" />;
  }

  // 顶栏待办角标：拉当前用户待办计数
  const [todoCount, setTodoCount] = useState(0);
  useEffect(() => {
    if (!currentUser?.userid) return;
    monitorCount(currentUser.userid)
      .then((res: any) => {
        const m = pickPayload(res) || {};
        const c =
          typeof m.todo === 'number'
            ? m.todo
            : Object.values(m).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
        setTodoCount(c);
      })
      .catch(() => setTodoCount(0));
  }, [currentUser?.userid]);

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
