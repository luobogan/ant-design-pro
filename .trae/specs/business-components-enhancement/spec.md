# BusinessComponents 权限增强与页面重构 Spec

## Why

当前 BusinessComponents 组件库已创建完成，但缺少权限控制功能。需要增强组件的权限控制能力，并选择一个业务模块进行重构试点，验证组件的实用性和开发效率提升。

## What Changes

- ✅ BusinessComponents 组件库已创建（Panel、ToolBar、SearchBox、Grid）
- 🔲 增强 `src/utils/authority.ts` 权限工具函数
- 🔲 在 Grid 和 ToolBar 组件中集成按钮权限控制
- 🔲 选择 System/User 模块进行重构试点
- 🔲 验证重构后的功能和性能

**BREAKING**: 无破坏性变更，采用渐进式改造

## Impact

- **Affected specs**: mall-feature-migration（不冲突，可并行）
- **Affected code**: 
  - `src/utils/authority.ts` - 增强权限工具
  - `src/components/BusinessComponents/Grid.tsx` - 集成权限控制
  - `src/components/BusinessComponents/ToolBar.tsx` - 集成权限控制
  - `src/pages/System/User/User.tsx` - 重构试点

## ADDED Requirements

### Requirement: 按钮权限管理
The system SHALL provide 按钮权限的获取、存储和验证功能

#### Scenario: 获取页面按钮权限
- **WHEN** 页面加载时
- **THEN** 调用 `getButton(code)` 获取当前页面的按钮权限列表
- **THEN** 返回的按钮列表包含 code、name、alias、action 等字段

#### Scenario: 检查按钮权限
- **WHEN** 用户访问页面
- **THEN** 调用 `hasButton(code)` 检查是否有指定按钮权限
- **THEN** 返回 boolean 值表示是否有权限

### Requirement: Grid 组件权限集成
The system SHALL provide 自动过滤无权限按钮的功能

#### Scenario: Grid 渲染工具栏
- **WHEN** Grid 组件渲染 ToolBar
- **THEN** 自动调用 `getButton(code)` 获取权限
- **THEN** 只显示有权限的按钮
- **THEN** 无权限的按钮完全隐藏

### Requirement: 页面重构验证
The system SHALL provide 功能完整、性能优化的用户管理页面

#### Scenario: 用户列表展示
- **WHEN** 用户访问 `/system/user` 页面
- **THEN** 显示用户列表（包含账号、姓名、状态等字段）
- **THEN** 支持分页、排序、筛选
- **THEN** 只显示有权限的操作按钮

#### Scenario: 用户搜索
- **WHEN** 用户在搜索框输入关键词并点击查询
- **THEN** 调用 `onSearch` 回调
- **THEN** 列表刷新显示搜索结果

#### Scenario: 用户操作
- **WHEN** 用户点击新增/编辑/删除按钮
- **THEN** 检查按钮权限
- **THEN** 执行对应操作（跳转、提交、删除等）

## MODIFIED Requirements

### Requirement: authority.ts 工具函数
**Complete modified requirement:**

在现有 `src/utils/authority.ts` 基础上，添加以下功能：

```typescript
// 新增按钮权限管理
export function getButtons(): any[]
export function setButtons(buttons: any[]): void
export function getButton(code: string): any[]
export function hasButton(code: string): boolean

// 新增权限存储键名
export const BUTTONS_KEY = 'sword-buttons'
```

## REMOVED Requirements

无移除功能

---

## 技术实现方案

### 1. 权限工具函数增强

```typescript
// src/utils/authority.ts
export const BUTTONS_KEY = 'sword-buttons';

export function getButtons(): any[] {
  const buttons = localStorage.getItem(BUTTONS_KEY);
  return buttons ? JSON.parse(buttons) : [];
}

export function setButtons(buttons: any[]): void {
  localStorage.setItem(BUTTONS_KEY, JSON.stringify(buttons));
}

export function getButton(code: string): any[] {
  const buttons = getButtons();
  const pageButtons = buttons.filter(btn => btn.code === code);
  return pageButtons.length > 0 ? pageButtons[0].buttons || [] : [];
}

export function hasButton(code: string): boolean {
  return getButton(code).length > 0;
}
```

### 2. Grid 组件权限集成

```typescript
// src/components/BusinessComponents/Grid.tsx
useEffect(() => {
  const buttons = getButton(code);
  setButtons(buttons);
}, [code]);

// 在 ToolBar 渲染时使用 buttons 状态
<ToolBar
  buttons={buttons}
  onClick={handleToolBarClick}
/>
```

### 3. 页面重构示例

```typescript
// src/pages/System/User/User.tsx
import { Grid } from '@/components/BusinessComponents';

const UserPage = () => {
  const handleSearch = (params: any) => {
    // 调用 API 获取数据
  };

  const handleBtnCallBack = ({ btn, keys, refresh }) => {
    // 处理按钮点击
  };

  return (
    <PageContainer title="用户管理">
      <Grid
        code="system.user"
        columns={columns}
        data={userData}
        onSearch={handleSearch}
        btnCallBack={handleBtnCallBack}
      />
    </PageContainer>
  );
};
```

---

## 验收标准

1. ✅ 权限工具函数完整实现
2. ✅ Grid 组件可以正确获取和过滤按钮权限
3. ✅ User 页面重构完成，功能正常
4. ✅ 代码审查通过
5. ✅ 性能测试通过

---

**Spec 版本:** v1.0  
**创建日期:** 2026-03-20  
**状态:** 待审批
