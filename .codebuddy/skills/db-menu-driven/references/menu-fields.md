# blade_menu 字段语义与推导词典

## 一、核心字段

| 字段 | 含义 | 取值与影响 |
|------|------|-----------|
| `code` | 菜单/按钮编号 | 权限判断用 `hasPerm(code)`，与 path 无关 |
| `name` | 显示名 | 菜单项文字；组件页路由也带 name（靠 `hideInMenu` 隐藏） |
| `path` | 路由路径 | 决定前端推导的模块/目录/组件文件名 |
| `category` | 1=菜单，2=按钮 | 组件型页面要求 `category=2` |
| `isComponent` | 是否组件页 | `1` = 组件型页面（路由载体）；`0` = 纯权限按钮 |
| `isOpen` | 打开方式 | `2` = 顶层独立页（不套布局）；`0/1` = 布局内页 |
| `parentId` | 父节点 | **组件页挂在谁下面，决定它能否被收集到**（见嵌套组件页） |
| `componentType` | `bundled` / 远程 | `bundled` = 前端代码内的组件 |
| `source` | 图标名 | 菜单图标（antd 图标名） |

## 二、toPascalCase 的智能分词词典

`app.tsx` 的 `toPascalCase` 实现（**不是简单首字母大写**）：

```ts
const commonWords = ['Form','Mode','Manage','Data','View','Field','Edit','Add','List',
  'Detail','System','Mall','Product','Category','User','Role','Menu','Exception',
  'Table','Design','Tenant','Package','Preview','Page'];
let result = str.toLowerCase();
commonWords.forEach(word => result = result.replace(new RegExp(word.toLowerCase(),'g'), word));
return result.charAt(0).toUpperCase() + result.slice(1);
```

**特性与陷阱**：

- 能还原复合词：`workflowdesign→WorkflowDesign`、`exceldesign→ExcelDesign`、
  `formmanage→FormManage`、`fieldmanage→FieldManage`、`tabledesign→TableDesign`、
  `tenantpackage→TenantPackage`
- **替换无词边界，且按数组顺序**：短词会破坏长词。例如 `Preview` 与 `View` 同时在词典时，
  `View` 靠前会把 `preview` 拆成 `pre+View` → `ExcelpreViewPage` ✗
  → 此类名字必须靠「原始末段（rawPage）」候选命中
- 新增目录/组件名若含词典外的复合词，**优先补 `commonWords`**，而不是登记 `PAGE_DIR_ALIAS`

## 三、现有组件型菜单清单（参考样本）

| code | path | isOpen | 组件文件 |
|------|------|--------|---------|
| workflow_create_start | `/workflow/create/start` | 2 独立页 | `Workflow/Create/Start.tsx` |
| workflow_design | `/formmode/workflowdesign` | 0 布局内 | `FormMode/WorkflowDesign/WorkflowDesign.tsx` |
| exceldesign | `/formmode/exceldesign/ExcelDesign` | 1 布局内 | `FormMode/ExcelDesign/ExcelDesign.tsx` |
| excel_preview_page | `/formmode/exceldesign/ExcelPreviewPage` | 2 独立页 | `FormMode/ExcelDesign/ExcelPreviewPage.tsx` |
| formmanage_aae | `/formmode/formmanage/aae` | 1 布局内 | `FormMode/FormManage/FormManageAae.tsx` |
| fieldmanage_aae | `/formmode/fieldmanage/aae` | 1 布局内 | `FormMode/FieldManage/FieldManageAae.tsx` |
| product_add | `/mall/product/add` | 1 布局内 | `Mall/Product/ProductAdd.tsx` |
| product_aae | `/mall/product/aae` | 1 布局内 | `Mall/Product/ProductAae.tsx` |
| dept_aae | `/system/dept/aae` | 1 布局内 | `System/Dept/DeptAae.tsx` |

## 四、组件页「挂在哪」决定能否注册（嵌套组件页）

按钮组件页由 `collectComponentButtonRoutes` 按 `parentId` 收集：

- 挂在**普通菜单**（`category=1`）下 → ✅ 正常收集
- 挂在**组件型菜单**（`category=2`）下 → ⚠️ 属于「嵌套组件页」
  （`exceldesign` → `excel_preview_page`）。若组件型菜单分支提前 `return` 跳过按钮收集，
  这类页面**永远注册不了** → 直接 404

## 五、数据流总览

```
/menu/routes（菜单树）→ render() → extraRoutes → loopMenuItem
    ├─ category=1 → 注册布局内菜单路由（显示在左侧菜单）
    └─ category=2+isComponent=1 → 跳过自身菜单页路由，但**仍收集其下按钮组件页**

/menu/buttons（按钮树）→ localStorage[sword-buttons]
    └─ 按 parentId 收集组件页 → 注册路由（hideInMenu:true）
        ↑ render() 每次无条件刷新此缓存

左侧菜单 = ProLayout route 模式（clientRoutes）→ hideInMenu 剔除组件页
顶部导航 = TopNavMenu → filter(category !== 2)
```
