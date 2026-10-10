# 菜单/组件页排障手册（实证结论）

## 排查第一原则

**不要靠推断改代码**——本次曾因连续推断改动导致"越改越乱"。正确做法：
用 Playwright 打开目标 URL，抓控制台真实错误，一次定位。
关键日志：`patchClientRoutes: 路由清单`、`xxx 是否注册 = true/false`、
`按钮组件候选导入失败 [...]`（含真实 error）。

## 症状 → 原因 → 修复

### 1. `Cannot find module as expression is too dynamic`

- **原因**：自己写的多级插值模板 `import(\`./pages/${a}/${b}/${c}.tsx\`)`
  被 utoopack 拒绝解析；**与文件名对错无关**，所有候选全挂
- **对照实证**：菜单页分支 `buildComponentLoaders` 内同款模板可用
  （`/system/workflow` 实测正常渲染）
- **修复**：复用 `buildComponentLoaders(module, page, rawPage, midDirs)`，不要另写模板

### 2. 页面 404，但控制台显示 `是否注册 = true`

- **原因**：路由已注册，但组件加载失败 → 渲染兜底 404 组件
- **排查**：看 `按钮组件候选导入失败` 的真实 error（是"模块不存在"还是"打包器错误"）
- 常见子原因：组件名大小写推导错误、路径段用错

### 3. 页面 404，路由清单里根本没这个 path

- **原因**：路由未注册。按以下顺序查：
  1. 该页 `category`/`isComponent` 是否对上（`category=2 && isComponent=1 && path`）
  2. 是否**嵌套组件页**（父节点是组件型菜单）→ 组件型菜单分支是否提前 return 跳过收集
  3. localStorage 按钮缓存是否过期（后端的 path 修正被旧缓存卡住）
- **修复**：对应为修正状态 / 让组件型菜单走按钮收集 / render 阶段无条件刷新按钮缓存

### 4. `ExcelPreviewPage` 被推成 `ExcelpreViewPage`

- **原因**：`toPascalCase` 词典里 `View` 排在 `Preview` 前，把 `preview` 拆成 `pre+View`
- **修复**：`buildComponentLoaders` 的 `rawPage` 传**原始末段**（保留 PascalCase），
  由 rawPage 候选命中；不要用 toPascalCase 结果作为唯一文件名

### 5. 复合词目录推不出来（如 `Workflowdesign` vs `WorkflowDesign`）

- **先确认**：`toPascalCase` 是智能分词版，多数复合词**本来就能推导**
  （`workflowdesign→WorkflowDesign`、`formmanage→FormManage`）
- 若确实推不出：优先补 `commonWords` 词典，而非登记 `PAGE_DIR_ALIAS`
- **注意**：`PAGE_DIR_ALIAS` 的 key 是 `模块/目录` 的小写形式

### 6. 组件页显示在左侧菜单/顶部导航

- **左侧**：ProLayout 是 route 模式，菜单数据源是 `clientRoutes`；
  组件页路由必须 `hideInMenu: true`（`menu.request` 不在消费链上，过滤它无效）
- **顶部**：`TopNavMenu` 需单独 `filter(node.category !== 2)`

### 7. 后端改了 path 但前端不生效

- **原因**：按钮组件页路由读 localStorage 的 `sword-buttons` 缓存；
  只在缓存为空时才拉取 → 旧值永久卡住
- **修复**：`render()` 阶段**无条件**拉取按钮数据落盘（在 `oldRender()` 触发路由注册之前）

### 8. `Duplicated key '/xxx'` 菜单 key 冲突

- **原因**：两条菜单记录的 `path` 完全相同（如两条 `/formmode`）
- **修复**：改其中一条的 path（需同步前端跳转 URL 的引用）

## 工具陷阱（重要）

**search_content 的 count 模式对多模式组合（`A|B|C`）会误报 0 结果**——
本次因此两次误判"代码被回滚/修改丢失"。
核对代码是否存在时，**逐条单独查询**（content 模式），不要用组合 count。

## 验证清单（改完后）

1. 目标 URL 不再 404（Playwright 实测，页面渲染出业务内容）
2. 控制台无 `Cannot find module` / `全部候选未命中`
3. 左侧菜单**不出现**该组件页
4. 普通菜单页仍正常（回归）
