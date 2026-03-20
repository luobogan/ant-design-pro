# System 和 Mall 模块系统性改造 Spec

## Why

BusinessComponents 组件库和权限控制功能已完成，需要将其推广到 System 和 Mall 两大核心模块的所有子模块，实现代码复用、权限统一、规范一致的目标，提升整体开发效率和代码质量。

## What Changes

- ✅ BusinessComponents 组件库已创建并验证
- ✅ 权限控制工具函数已完成
- 🔲 System 模块所有子模块使用 BusinessComponents 重构
- 🔲 Mall 模块所有子模块使用 BusinessComponents 重构
- 🔲 统一文件命名规范和目录结构
- 🔲 完善权限控制集成
- 🔲 性能优化和代码规范调整

**BREAKING**: 无破坏性变更，采用渐进式改造，保持向后兼容

## Impact

- **Affected specs**: 
  - business-components-enhancement ✅（已完成）
  - mall-feature-migration（不冲突）
- **Affected code**: 
  - `src/pages/System/` 下所有模块
  - `src/pages/Mall/` 下所有模块
  - `src/components/BusinessComponents/`（推广使用）
  - `src/utils/authority.ts`（全面应用）

## ADDED Requirements

### Requirement: System 模块全面改造
The system SHALL provide System 模块下所有子模块的统一架构和代码规范

#### Scenario: System/User 模块
- **WHEN** 已验证（现有 User.tsx 功能完善）
- **THEN** 作为模板推广到其他子模块

#### Scenario: System/Role 模块
- **WHEN** 访问 `/system/role` 页面
- **THEN** 使用 BusinessComponents 组件
- **THEN** 完整的 List/Add/Edit/View 功能
- **THEN** 正确的按钮权限控制

#### Scenario: System/Dept, Dict, Menu, Tenant, Client, Position 模块
- **WHEN** 访问各模块页面
- **THEN** 统一的组件架构
- **THEN** 完整的 CRUD 功能
- **THEN** 正确的权限控制

### Requirement: Mall 模块全面改造
The system SHALL provide Mall 模块下所有子模块的统一架构和代码规范

#### Scenario: Mall/Product 模块
- **WHEN** 访问 `/mall/products` 页面
- **THEN** 使用 BusinessComponents 组件（已部分完成）
- **THEN** 完善 List/Add/Edit/View 功能
- **THEN** 正确的按钮权限控制

#### Scenario: Mall/Brand, Category 模块
- **WHEN** 访问品牌/分类管理页面
- **THEN** 统一的目录结构（Brand/Category 首字母大写）
- **THEN** 统一的文件命名（Brand.tsx, Category.tsx）
- **THEN** 完整的 CRUD 功能

### Requirement: 统一规范
The system SHALL provide 统一的文件命名、目录结构和代码规范

#### Scenario: 目录结构
- **WHEN** 创建新模块
- **THEN** 遵循 `src/pages/主模块/子模块/index.tsx` 规范
- **THEN** 或 `src/pages/主模块/子模块/Module.tsx` 规范

#### Scenario: 文件命名
- **WHEN** 创建页面文件
- **THEN** 列表页：`Module.tsx` 或 `index.tsx`
- **THEN** 新增页：`ModuleAdd.tsx` 或 `add.tsx`
- **THEN** 编辑页：`ModuleEdit.tsx` 或 `edit.tsx`
- **THEN** 详情页：`ModuleView.tsx` 或 `view.tsx`

#### Scenario: 代码规范
- **WHEN** 编写代码
- **THEN** 使用 TypeScript 类型定义
- **THEN** 遵循 React 最佳实践
- **THEN** 使用 BusinessComponents 组件
- **THEN** 集成权限控制

## MODIFIED Requirements

### Requirement: 目录结构规范化
**Complete modified requirement:**

调整 Mall 模块目录结构，统一首字母大写：
- `src/pages/Mall/brand/` → `src/pages/Mall/Brand/`
- `src/pages/Mall/category/` → `src/pages/Mall/Category/`

### Requirement: 页面组件重构
**Complete modified requirement:**

所有页面使用 BusinessComponents 组件：
```typescript
import { Grid, Panel, ToolBar, SearchBox } from '@/components/BusinessComponents';

// 使用 Grid 组件
<Grid
  code="module.code"
  columns={columns}
  data={data}
  onSearch={handleSearch}
  btnCallBack={handleBtnCallBack}
/>
```

## REMOVED Requirements

无移除功能，保持向后兼容

---

## 技术实现方案

### 1. System 模块改造清单

**需要改造的模块：**
- ✅ System/User（已验证，作为模板）
- 🔲 System/Role
- 🔲 System/Dept
- 🔲 System/Dict
- 🔲 System/Menu
- 🔲 System/Tenant
- 🔲 System/Client
- 🔲 System/Position

**每个模块的改造步骤：**
1. 检查现有功能完整性
2. 引入 BusinessComponents 组件
3. 集成权限控制
4. 测试功能完整性
5. 性能优化

### 2. Mall 模块改造清单

**需要改造的模块：**
- ✅ Mall/Product（已部分完成）
- 🔲 Mall/Brand（调整目录结构）
- 🔲 Mall/Category（调整目录结构）
- 🔲 Mall/Order（如存在）
- 🔲 Mall/Coupon（如存在）

**改造重点：**
1. 统一目录命名（首字母大写）
2. 统一文件命名
3. 使用 BusinessComponents
4. 集成权限控制

### 3. 权限控制集成

```typescript
// 每个页面使用统一的 code 标识
const PAGE_CODES = {
  USER: 'system.user',
  ROLE: 'system.role',
  DEPT: 'system.dept',
  // ...
};

// Grid 组件自动获取权限
<Grid code={PAGE_CODES.USER} />
```

---

## 验收标准

1. ✅ System 模块所有子模块功能完整
2. ✅ Mall 模块所有子模块功能完整
3. ✅ 所有页面使用 BusinessComponents
4. ✅ 权限控制正常工作
5. ✅ 性能测试通过
6. ✅ 代码审查通过
7. ✅ 文档完善

---

**Spec 版本:** v1.0  
**创建日期:** 2026-03-20  
**状态:** 待审批
