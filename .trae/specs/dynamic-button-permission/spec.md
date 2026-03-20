# 动态按钮权限实现 Spec

## Why

基于 `docs/动态按钮权限实现位置分析.md` 的分析结果，需要在 ant-design-pro 项目中实现动态按钮权限功能，以支持从后端 API 获取用户按钮权限并在前端组件中进行权限控制，与 Sword 项目的权限管理模式保持一致。

## What Changes

- **增强 `app.tsx`**: 在 `getInitialState` 中添加按钮权限获取逻辑，与用户信息并行获取
- **增强 `usePermission.ts`**: 使用 `initialState` 中的按钮数据，实现完整的权限检查逻辑
- **集成 `authority.ts`**: 使用现有的 localStorage 存储机制管理按钮权限
- **组件集成**: 在业务组件中使用 `usePermission` Hook 实现按钮权限控制

## Impact

- **Affected specs**: 
  - 用户认证流程（initialState 获取）
  - 权限检查机制（usePermission Hook）
  - 按钮权限存储（authority.ts）
  
- **Affected code**:
  - `src/app.tsx` - 应用初始化配置
  - `src/hooks/usePermission.ts` - 权限检查 Hook
  - `src/utils/authority.ts` - 权限工具函数
  - `src/pages/System/User/User.tsx` - 示例业务组件

## ADDED Requirements

### Requirement: 按钮权限全局获取
The system SHALL provide 在应用启动时通过 `getInitialState` 并行获取用户信息和按钮权限，存储到 `initialState.buttons` 和 localStorage。

#### Scenario: 应用启动加载权限
- **WHEN** 用户登录成功进入系统
- **THEN** 系统自动调用 `/api/menu/buttons` 接口获取按钮权限
- **THEN** 权限数据存储到 initialState 和 localStorage
- **THEN** 所有组件可通过 initialState 或 localStorage 访问权限数据

### Requirement: 权限检查 Hook
The system SHALL provide `usePermission` Hook，支持以下功能：
- `hasPermission(permission)`: 检查是否有指定权限
- `filterButtons(buttons)`: 过滤按钮列表
- `getPageButtons(code)`: 获取指定页面的按钮
- `hasPageButton(pageCode, buttonCode)`: 检查页面是否有指定按钮

#### Scenario: 组件权限检查
- **WHEN** 组件调用 `hasPermission('user:add')`
- **THEN** 返回布尔值表示是否有该权限
- **WHEN** 管理员用户调用任何权限检查
- **THEN** 始终返回 true（管理员豁免）

### Requirement: 页面按钮集成
The system SHALL provide 在业务组件中通过 `useEffect` 获取页面按钮并在 UI 中渲染

#### Scenario: 页面按钮渲染
- **WHEN** 页面组件加载时
- **THEN** 调用 `getPageButtons('system.user')` 获取页面按钮
- **THEN** 根据按钮的 action 属性渲染到 PageContainer.extra
- **THEN** 根据按钮的 alias 属性设置按钮样式

## MODIFIED Requirements

### Requirement: app.tsx 的 getInitialState
在 `getInitialState` 函数中添加 `fetchButtons` 函数，与 `fetchUserInfo` 并行执行：

```typescript
const [currentUser, buttons] = await Promise.all([
  fetchUserInfo(),
  fetchButtons()
]);
```

返回的 initialState 对象新增 `buttons` 属性。

### Requirement: usePermission.ts 权限判断
`usePermission` Hook 从 `useModel('@@initialState')` 获取按钮数据，实现真实的权限检查逻辑，替代当前的简化实现（始终返回 true）。

## REMOVED Requirements

无
