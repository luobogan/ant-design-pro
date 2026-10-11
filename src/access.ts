/**
 * 全局权限（授权）能力 —— 基于 initialState 计算，供 `useAccess()` / `<Access>` /
 * 路由 `access:` 字段消费。
 *
 * 设计边界（与 utils/authority.ts 的分工）：
 *  · authority.ts = 认证层：token / 租户 / 验证码 / 后端下发的权限数据**缓存**（localStorage）
 *  · access.ts    = 授权层：基于 initialState 的**判定**（角色 + 按钮树）
 *    ⇒ 判定逻辑只在本文件一处，组件不再各自 import hasAuthority/hasButton。
 *
 * @see https://umijs.org/docs/max/access#access
 * */

export interface AccessButtonNode {
  code?: string;
  name?: string;
  children?: AccessButtonNode[];
  buttons?: AccessButtonNode[];
  [key: string]: any;
}

export interface AccessCurrentUser {
  access?: string;
  /** 多个角色逗号拼接，如 "流程管理员,超级管理员" */
  roleName?: string;
  roles?: string[];
  [key: string]: any;
}

export interface AccessInitialState {
  currentUser?: AccessCurrentUser;
  /** /menu/buttons 下发的按钮树（app.tsx 的 getInitialState 提供，与 authority 缓存同源） */
  buttons?: AccessButtonNode[];
}

/** 管理员角色标识 */
const ADMIN_ROLE_NAMES = ['admin', 'administrator', '超级管理员'];

/**
 * 递归查找 code 匹配的按钮节点。
 * 语义与 authority.getButton 保持一致：先匹配自身，再下钻 children。
 */
function findButtonNode(
  list: AccessButtonNode[] | undefined,
  targetCode: string,
): AccessButtonNode | null {
  for (const item of list || []) {
    if (item?.code === targetCode) return item;
    if (item?.children?.length) {
      const found = findButtonNode(item.children, targetCode);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 归一化当前用户拥有的角色标识集合。
 * 数据来源兼容三种形态：access 单值、roles 数组、roleName 逗号串。
 */
function collectRoles(currentUser: AccessCurrentUser | undefined): string[] {
  const roles: string[] = [];
  const push = (value: any) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(push);
    } else if (typeof value === 'string') {
      value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((role) => roles.push(role));
    }
  };
  push(currentUser?.access);
  push(currentUser?.roles);
  push(currentUser?.roleName);
  return Array.from(new Set(roles));
}

/**
 * 展开成声明式能力键，供路由 `access: 'can_xxx'` 直接使用：
 *  · can_<菜单code>            —— 是否拥有该菜单（如 can_dict）
 *  · can_<菜单code>_<按钮code> —— 是否拥有该菜单下的按钮（如 can_dict_dict_add）
 */
function buildDeclarativeAccess(
  nodes: AccessButtonNode[] | undefined,
  parentCode = '',
): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const node of nodes || []) {
    const code = node?.code;
    if (!code) continue;
    const key = parentCode ? `can_${parentCode}_${code}` : `can_${code}`;
    result[key] = true;
    if (node.children?.length) {
      Object.assign(result, buildDeclarativeAccess(node.children, code));
    }
  }
  return result;
}

export default function access(initialState: AccessInitialState | undefined) {
  const { currentUser, buttons } = initialState ?? {};
  const buttonTree: AccessButtonNode[] = Array.isArray(buttons) ? buttons : [];
  const roleList = collectRoles(currentUser);

  // 管理员判定（兼容 access / roles / roleName 三种数据形态）
  const canAdmin = !!currentUser && roleList.some((r) => ADMIN_ROLE_NAMES.includes(r));
  const canUser = !!currentUser;

  /** 取某菜单（页面）下的按钮列表 */
  const getPageButtons = (pageCode?: string): AccessButtonNode[] => {
    if (!pageCode) return [];
    const item = findButtonNode(buttonTree, pageCode);
    return (item?.children || item?.buttons || []) as AccessButtonNode[];
  };

  /**
   * 按钮权限判定：`hasButton('dict', 'dict_add')`。
   * 省略 buttonCode 时退化为「该菜单是否可见」。
   */
  const hasButton = (pageCode?: string, buttonCode?: string): boolean => {
    if (!pageCode) return false;
    if (!buttonCode) return !!findButtonNode(buttonTree, pageCode);
    return getPageButtons(pageCode).some((b) => b?.code === buttonCode);
  };

  /**
   * 角色权限码判定（承接原 authority.hasAuthority 的语义）：
   * 命中角色码或角色集合含 `*` 即通过，管理员恒真；未传 code 视为不限制。
   */
  const canAccess = (authorityCode?: string): boolean => {
    if (!authorityCode) return true;
    if (canAdmin) return true;
    return roleList.includes(authorityCode) || roleList.includes('*');
  };

  const result = {
    // ===== 角色级 =====
    canAdmin,
    canUser,
    canAccess,
    // ===== 按钮级（替代 authority.getButton / hasButton）=====
    hasButton,
    getPageButtons,
    /** 按钮树原始数据，供 usePageButtons 等 hook 复用 */
    buttons: buttonTree,
    roles: roleList,
    // ===== 声明式能力键：路由 access: 'can_dict' / 'can_dict_dict_add' =====
    ...buildDeclarativeAccess(buttonTree),
  };

  if (process.env.NODE_ENV !== 'production') {
    console.log('[access] 权限能力计算:', {
      canAdmin,
      canUser,
      roles: roleList,
      buttonPages: buttonTree.length,
    });
  }

  return result;
}
