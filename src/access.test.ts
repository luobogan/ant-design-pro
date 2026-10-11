import { describe, expect, it } from 'vitest';
import access from './access';

describe('access', () => {
  it('should return canAdmin true when user has admin access', () => {
    const initialState = {
      currentUser: {
        userid: '1',
        name: 'Admin User',
        avatar: 'https://example.com/avatar.png',
        access: 'admin',
      },
    };

    const result = access(initialState);

    expect(result.canAdmin).toBe(true);
  });

  it('should return canAdmin false when user has non-admin access', () => {
    const initialState = {
      currentUser: {
        userid: '2',
        name: 'Regular User',
        avatar: 'https://example.com/avatar.png',
        access: 'user',
      },
    };

    const result = access(initialState);

    expect(result.canAdmin).toBe(false);
  });

  it('should return canAdmin false when user access is undefined', () => {
    const initialState = {
      currentUser: {
        userid: '3',
        name: 'Guest User',
        avatar: 'https://example.com/avatar.png',
      },
    };

    const result = access(initialState);

    expect(result.canAdmin).toBe(false);
  });

  it('should return canAdmin false when currentUser is undefined', () => {
    const initialState = {
      currentUser: undefined,
    };

    const result = access(initialState);

    expect(result.canAdmin).toBeFalsy();
  });

  it('should return canAdmin false when initialState is undefined', () => {
    const result = access(undefined);

    expect(result.canAdmin).toBeFalsy();
  });

  // ==================== 角色归一化 ====================
  it('should treat roleName csv as multiple roles', () => {
    const result = access({
      currentUser: { userid: '4', roleName: '流程管理员,超级管理员' },
      buttons: [],
    });

    expect(result.canAdmin).toBe(true);
    expect(result.roles).toContain('流程管理员');
  });

  it('should return canAdmin true when roles contains administrator', () => {
    const result = access({
      currentUser: { userid: '5', roles: ['administrator'] },
      buttons: [],
    });

    expect(result.canAdmin).toBe(true);
  });

  // ==================== canAccess（原 hasAuthority 语义）====================
  it('canAccess should pass for matched role and admin, reject unknown role', () => {
    const matched = access({ currentUser: { userid: '6', roles: ['流程管理员'] }, buttons: [] });
    expect(matched.canAccess('流程管理员')).toBe(true);
    expect(matched.canAccess('系统管理员')).toBe(false);

    // 管理员恒真
    const admin = access({ currentUser: { userid: '7', roles: ['admin'] }, buttons: [] });
    expect(admin.canAccess('任意权限码')).toBe(true);

    // 未传 code 视为不限制
    expect(matched.canAccess()).toBe(true);
  });

  it('canAccess should pass when roles contains wildcard *', () => {
    const result = access({ currentUser: { userid: '8', roles: ['*'] }, buttons: [] });

    expect(result.canAccess('anything')).toBe(true);
  });

  // ==================== 按钮级能力 ====================
  const buttonTree = [
    {
      code: 'dict',
      name: '字典',
      children: [
        { code: 'dict_add', name: '新增' },
        { code: 'dict_remove', name: '删除' },
      ],
    },
    {
      code: 'account_settings',
      name: '个人设置',
      children: [{ code: 'account_setting', name: '个人设置' }],
    },
  ];

  it('getPageButtons should return children of matched menu code', () => {
    const result = access({ currentUser: { userid: '9' }, buttons: buttonTree });

    expect(result.getPageButtons('dict').map((b) => b.code)).toEqual([
      'dict_add',
      'dict_remove',
    ]);
    expect(result.getPageButtons('not_exists')).toEqual([]);
    expect(result.getPageButtons()).toEqual([]);
  });

  it('hasButton should support both pageCode+buttonCode and page-only forms', () => {
    const result = access({ currentUser: { userid: '10' }, buttons: buttonTree });

    expect(result.hasButton('dict', 'dict_add')).toBe(true);
    expect(result.hasButton('dict', 'dict_edit')).toBe(false);
    expect(result.hasButton('dict')).toBe(true);
    expect(result.hasButton('not_exists')).toBe(false);
  });

  it('hasButton should support nested menu nodes (recursive lookup)', () => {
    const nested = [
      {
        code: 'system',
        children: [{ code: 'group', children: [{ code: 'group_add' }] }],
      },
    ];
    const result = access({ currentUser: { userid: '11' }, buttons: nested });

    expect(result.hasButton('group', 'group_add')).toBe(true);
  });

  it('should expose declarative can_* keys for route access field', () => {
    const result = access({ currentUser: { userid: '12' }, buttons: buttonTree });

    expect(result.can_dict).toBe(true);
    expect(result.can_dict_dict_add).toBe(true);
    expect(result.can_dict_dict_edit).toBeUndefined();
  });

  it('should return empty button capabilities when initialState has no buttons', () => {
    const result = access({ currentUser: { userid: '13' } });

    expect(result.buttons).toEqual([]);
    expect(result.hasButton('dict', 'dict_add')).toBe(false);
    expect(result.can_dict).toBeUndefined();
  });
});
