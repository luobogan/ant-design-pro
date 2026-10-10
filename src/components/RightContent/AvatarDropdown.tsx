import {
  LogoutOutlined,
  SettingOutlined,
  SkinOutlined,
} from '@ant-design/icons';
import { history, useModel } from '@umijs/max';
import type { MenuProps } from 'antd';
import { Spin } from 'antd';
import React, { startTransition } from 'react';
import { outLogin } from '@/services/ant-design-pro/api';
import { clearAuthority, getButton, hasButton } from '@/utils/authority';
import HeaderDropdown from '../HeaderDropdown';

type GlobalHeaderRightProps = {
  children?: React.ReactNode;
};

// 用户下拉菜单：根据按钮权限「个人设置」(account_setting) 决定是否显示该项。
// 权限来自 /menu/buttons（登录后写入 localStorage 的 sword-buttons），无授权则隐藏。

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

  // 顶部未读红点已统一收敛到「消息铃铛」（MessageBell，未读+流程通知），
  // 头像不再挂任何角标：此前的 monitorCount 待办数语义易与未读混淆（产品决策移除）。
  // 待办数量以「待办事宜」页面为准。
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

  if (!initialState || !currentUser) {
    return <Spin size="small" />;
  }

  // 「个人设置」下拉项按按钮权限 account_setting 显隐：无权限则隐藏。
  const accountSettingPerm = hasButton(
    getButton('account_settings'),
    'account_setting',
  );
  const menuItems: MenuProps['items'] = [];
  if (accountSettingPerm) {
    menuItems.push({
      key: 'settings',
      icon: <SettingOutlined />,
      label: '个人设置',
    });
  }
  menuItems.push({
    key: 'theme',
    icon: <SkinOutlined />,
    label: '主题设置',
  });
  menuItems.push({ type: 'divider' as const });
  menuItems.push({
    key: 'logout',
    icon: <LogoutOutlined />,
    label: '退出登录',
  });

  return (
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
  );
};
