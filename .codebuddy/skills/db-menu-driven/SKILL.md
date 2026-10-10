---
name: db-menu-driven
description: 数据库菜单驱动（blade_menu）的新增、修改与排障。当需要在 SpringBlade + ant-design-pro 项目中新增菜单页或「只加载不显示」的组件型页面、配置 blade_menu 的 category/isComponent/isOpen/path、或排查「页面 404 / 按钮组件加载失败 / 组件页误显示在侧边栏 / 组件路径推不出来」时使用。
---

# 数据库菜单驱动（blade_menu）

本项目的菜单、路由、页面组件**全部由后端 `blade_menu` 表驱动**：前端不写死路由表，而是
在 `patchClientRoutes` 阶段读后端数据动态注册路由并推导组件路径。

## 一、三类菜单的判定（决定前端如何处理）

| 类型 | 判定条件 | 路由注册 | 左侧菜单 | 典型用途 |
|------|---------|---------|---------|---------|
| **普通菜单** | `category=1` | ✅ 注册布局内路由（带 `name`） | ✅ **显示** | 列表页、工作台等导航页 |
| **组件型菜单** | `category=2 && isComponent=1 && path` | ✅ 注册（`hideInMenu:true`） | ❌ **只加载不显示** | 设计器、独立表单页 |
| **权限按钮** | `category=2 && isComponent=0` | ❌ 不注册 | ❌ 不显示 | 仅权限码 `hasPerm(code)` |

组件型菜单再按 `isOpen` 分两种加载形态：

| `isOpen` | 形态 | 说明 |
|----------|------|------|
| `2` | **顶层独立页** | 挂顶层 + `layout:false`，**不套 ProLayout**（无侧边栏/头部） |
| `0` / `1` | **布局内页** | 套 ProLayout 外壳，但不进左侧菜单 |

> ⚠️ 状态必须自洽：`category=1` 的菜单 `isComponent` 应为 `0`；若出现
> `category=1 + isComponent=1`，前端两个分支都不认它，语义矛盾（实测存在过此类脏数据）。

## 二、新增菜单的标准流程

1. **定类型**：是导航页（普通菜单）还是只加载的页面（组件型菜单）？要不要脱离布局（独立页）？
2. **定 path**：见下方命名规范
3. **建组件文件**：`src/pages/{Module}/{Page}/{Component}.tsx`，命名见下方约定
4. **写菜单数据**：`POST /api/blade-system/menu/submit`（用 `scripts/menu_api.cjs`）
5. **实测验证**：用浏览器打开该 URL，确认不再 404（详见排障手册）

## 三、path 与组件文件命名规范（关键）

path 形如 `/{模块}/{页面目录}/{组件名}`，前端推导链：

```
菜单 path（库里值）
  ↓ 取原始分段（不能用 formatRoutePath，它会整条转小写）
moduleSeg    = toPascalCase(第1段)        → 模块目录
dirPascal    = toPascalCase(第2段)        → 页面目录（复合词靠分词词典还原）
componentName= toPascalCase(末段)         → 组件文件名（用于常规与旧命名候选）
rawPage      = 原始末段                    → 组件文件名（用于精准大小写候选）
```

**约定**：

- **目录段**：小写即可（`exceldesign`、`workflowdesign`、`formmanage`）——`toPascalCase`
  是智能分词实现，能还原复合词（详见 `references/menu-fields.md` 的词典说明）
- **组件段**：**保留原始 PascalCase**（`ExcelDesign`、`ExcelPreviewPage`）——全小写复合词
  可能无法还原，原始形态由 `rawPage` 候选兜底
- **组件文件名**：
  - 与末段同名：`ExcelDesign.tsx`、`ExcelPreviewPage.tsx`、`Start.tsx`
  - `aae` = **Add And Edit**（新增与编辑复用同一表单页）→ `{页面目录名}Aae.tsx`
    （`ProductAae.tsx`、`FormManageAae.tsx`）
  - `add` = 纯新增 → `{页面目录名}Add.tsx`（`ProductAdd.tsx`）

## 四、关键约束（血泪教训，改动前必读）

1. **禁止自己拼多级插值模板字符串做动态 import**
   `import(\`./pages/${a}/${b}/${c}.tsx\`)` 会被 utoopack 判定
   `Cannot find module as expression is too dynamic` 而**全部失败**（无论文件名对错）。
   必须复用 `app.tsx` 的 `buildComponentLoaders`（菜单页分支同款，实测可用）。
2. **组件型菜单分支不能提前 return**
   组件型菜单之下可能挂着子组件页（如 `exceldesign` → `excel_preview_page`）。
   若在该分支直接 `return`，嵌套组件页永远注册不了 → 404。需走按钮收集后再早退。
3. **按钮组件页路由依赖 localStorage 的按钮缓存**
   `render()` 阶段必须**无条件**拉取按钮数据落盘；只在缓存为空时才拉，会让后端的
   path 修正被旧缓存永久卡住。
4. **ProLayout 是 route 模式**：左侧菜单数据源是 `clientRoutes` 而非 `menu.request`。
   组件页必须显式 `hideInMenu: true`，否则带 `name` 的路由会被渲染进侧边栏。
   顶部导航 `TopNavMenu` 需单独 `filter(category !== 2)`。
5. **不要靠前端别名表打补丁**：复合词优先补 `toPascalCase` 的 `commonWords` 词典；
   `PAGE_DIR_ALIAS` 仅在补词典会误伤其它路径时才登记。

## 五、排障与工具

- 症状→原因→修复的完整对照表：`references/troubleshooting.md`
- 字段语义、词典、现有菜单清单：`references/menu-fields.md`
- 查/改菜单数据：`scripts/menu_api.cjs`

**排查第一原则**：不要靠猜。用 Playwright 打开目标 URL 抓控制台真实错误
（路由是否注册、import 的真实报错），一次定位。靠推断改代码会越改越乱。
