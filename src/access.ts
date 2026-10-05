/**
 * @see https://umijs.org/docs/max/access#access
 * */
export default function access(
  initialState: { currentUser?: API.CurrentUser } | undefined,
) {
  const { currentUser } = initialState ?? {};

  // 检查是否为管理员权限（兼容中文和英文角色名）
  // roleName 为多个角色逗号拼接的字符串（如 "流程管理员,超级管理员"），故用 includes 而非严格相等
  const roleName = currentUser?.roleName;
  const isAdmin =
    !!currentUser &&
    (currentUser.access === 'admin' ||
      currentUser.access === 'administrator' ||
      (typeof roleName === 'string' &&
        (roleName.includes('超级管理员') || roleName.includes('administrator'))) ||
      (Array.isArray((currentUser as any)?.roles) &&
        (currentUser as any).roles.some(
          (r: string) => r === 'admin' || r === 'administrator' || r === '超级管理员',
        )));

  console.log('access.ts - 检查权限:', {
    currentUser: currentUser,
    hasCurrentUser: !!currentUser,
    access: currentUser?.access,
    roleName: currentUser?.roleName,
    canAdmin: isAdmin,
    canUser: !!currentUser,
  });

  return {
    canAdmin: isAdmin,
    canUser: !!currentUser,
  };
}
