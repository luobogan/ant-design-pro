/**
 * @see https://umijs.org/docs/max/access#access
 * */
export default function access(
  initialState: { currentUser?: API.CurrentUser } | undefined,
) {
  const { currentUser } = initialState ?? {};

  // 检查是否为管理员权限（兼容中文和英文角色名）
  const isAdmin =
    currentUser &&
    (currentUser.access === 'admin' ||
      currentUser.access === 'administrator' ||
      currentUser.roleName === '超级管理员' ||
      currentUser.roleName === 'administrator');

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
