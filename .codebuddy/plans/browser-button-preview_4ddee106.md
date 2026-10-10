---
name: browser-button-preview
overview: 在 TableDesign 页面实现浏览按钮类型选择时的实时预览交互，展示 Weaver E9 风格的浏览按钮表单交互效果
todos:
  - id: create-preview-component
    content: 创建 BrowserButtonPreview.tsx 组件：实现浏览按钮预览弹窗，包括模拟表单字段渲染、选择对话框、删除交互，样式参照Weaver E9标准
    status: completed
  - id: modify-main-columns
    content: 修改 TableDesign.tsx 主表操作列：当字段为浏览按钮类型时，增加预览按钮（EyeOutlined图标），点击打开BrowserButtonPreview弹窗
    status: completed
    dependencies:
      - create-preview-component
  - id: modify-detail-columns
    content: 修改 TableDesign.tsx 明细表操作列：与主表相同的预览按钮逻辑
    status: completed
    dependencies:
      - create-preview-component
  - id: integration-test
    content: 集成测试：验证主表和明细表浏览按钮预览功能，检查状态管理和样式效果
    status: completed
    dependencies:
      - modify-main-columns
      - modify-detail-columns
---

## 用户需求

针对 TableDesign 页面的"浏览按钮"功能，实现类型选择与实时预览交互。

### 支持类型

人力资源、部门、角色、岗位、项目、相关客户、文档、流程、附件、日期、时间、自定义浏览按钮、自定义树形单选/多选。

### 功能要求

1. **实时预览功能**：当用户在"类型"列选择"人力资源"等浏览按钮类型时，可在当前字段行操作区点击预览按钮，弹窗展示该浏览按钮在表单中的实际交互效果与样式。
2. **样式基准**：预览功能的前端样式需参考 D:\Weaver2020\ecology\formmode 目录下泛微E9前端代码。核心参考文件包括：

- AddMode_wev8.js（浏览按钮值的渲染逻辑，htmltype==3分支）
- AddFormModeIframe.jsp（表单DOM结构）
- modebrow_wev8.js（浏览按钮回调及e8Browser插件调用）
- ruleDesign/js/browser_wev8.js（浏览弹窗交互）
- CommonSingleBrowser.jsp（选择弹窗）
- browserBase.jsp（预览入口）

### 视觉效果

预览弹窗需展示泛微E9风格的浏览按钮字段，包括：

- 隐藏的ID输入框
- 显示选中名称的span区域（e8_showNameClass样式，包含可点击的链接式名称）
- 蓝色浏览按钮图标（类似Weaver E9的Browser按钮样式）
- 鼠标悬停时显示删除按钮（opacity过渡效果）
- 点击浏览按钮弹出模拟选择对话框，显示对应类型的示例数据列表

## 技术方案

### 技术栈

- **前端框架**：React 18 + TypeScript + Ant Design (antd)
- **状态管理**：React hooks (useState)
- **预览方式**：Ant Design Modal 弹窗 + 内联模拟渲染

### 实现策略

#### 1. 新增 BrowserButtonPreview 组件

在 `D:\workproject\springbladeandreact\ant-design-pro\src\pages\FormMode\TableDesign\components\` 下创建 `BrowserButtonPreview.tsx` 组件。

**功能职责**：

- 接收字段配置（fieldLabel, browserType等）作为 props
- 渲染模拟的浏览按钮表单字段，完全参照 Weaver E9 的 DOM 结构：
- 隐藏 input：`<input id="field_preview" type="hidden" />`
- 名称显示区域：`<span id="field_previewspan" class="e8_showNameClass">...</span>`
- 浏览按钮触发元素：`<span class="e8_os"><a class="Browser" onclick="...">...</a></span>`
- 模拟"选择"交互：弹出选择对话框，展示该类型对应的示例数据列表
- 模拟"删除"交互：点击删除按钮清除选中值

**核心设计**：

- 使用 Ant Design Modal 作为外层容器
- 内部使用内联样式模拟 Weaver E9 的 CSS 样式
- 采用浅蓝色主题色(#0072C6)作为浏览按钮主色
- 用 Table 组件模拟选择对话框中的示例数据列表

#### 2. 浏览器类型预览数据映射

| typeId | 类型名称 | 预览模拟数据 |
| --- | --- | --- |
| 1 | 人力资源 | 员工姓名列表(张三、李四、王五等) |
| 2 | 部门 | 部门名称列表(技术部、市场部、财务部等) |
| 3 | 角色 | 角色列表(管理员、普通用户、审计等) |
| 4 | 岗位 | 岗位列表(开发工程师、测试工程师等) |
| 8 | 项目 | 项目列表(OA系统、ERP系统等) |
| 16 | 相关客户 | 客户列表(腾讯、阿里、华为等) |
| 24 | 文档 | 文档列表(需求文档、设计文档等) |
| 30 | 流程 | 流程列表(请假流程、报销流程等) |
| 57 | 附件 | 附件列表(合同.pdf、报告.docx等) |
| 98 | 日期 | 日期选择 |
| 99 | 时间 | 时间选择 |
| 164 | 自定义浏览按钮 | 自定义选择列表 |
| 256 | 自定义树形单选 | 树形数据 |
| 257 | 自定义树形多选 | 树形数据(可多选) |


#### 3. TableDesign.tsx 集成

**修改操作列**：在主表和明细表的"操作"列中，当字段的 fieldHtmlType === 3 时，增加一个"预览"按钮（使用 EyeOutlined 图标）。

**状态管理**：添加 `browserPreviewVisible` 和 `browserPreviewField` 状态，用于控制预览弹窗的显示。

**数据流**：

1. 用户点击预览按钮
2. 读取当前字段的 fieldType 值
3. 打开 BrowserButtonPreview Modal，传入对应的浏览器类型参数
4. 用户可在预览弹窗中模拟选择/删除交互
5. 关闭弹窗后不影响实际字段配置

#### 4. 样式实现

由于无法直接复用 Weaver E9 的 CSS 文件，将通过内联样式和 CSS-in-JS 方式模拟：

- `.e8_showNameClass`：内联显示，带浅灰色背景和圆角
- `.e8_delClass`：右上角悬浮显示的删除按钮
- `Browser` 按钮：蓝色按钮带图标
- `.e8_os`：包裹浏览按钮和显示区域的容器

### 性能考虑

- 预览弹窗使用懒渲染（Modal destroyOnClose）
- 预览数据使用静态模拟数据，无需网络请求
- 预览状态独立，不影响主表字段的编辑操作

### 文件结构

```
ant-design-pro/src/pages/FormMode/TableDesign/
├── TableDesign.tsx              # [MODIFY] 主页面，集成预览功能
├── components/
│   └── BrowserButtonPreview.tsx # [NEW] 浏览按钮预览组件
```

### 实现步骤

1. 创建 `BrowserButtonPreview.tsx` 组件（含模拟选择对话框）
2. 修改 `TableDesign.tsx` - 添加预览状态和预览回调
3. 修改 `TableDesign.tsx` - 在主表操作列添加预览按钮
4. 修改 `TableDesign.tsx` - 在明细表操作列添加预览按钮
5. 验证与调试

## 代理扩展

### Skill

- **ant-design-react**: 使用 Ant Design 的 Modal、Button、Table、Input、Space、Tooltip 等组件构建预览UI
- **frontend-design**: 用于设计预览界面的样式和交互效果，确保视觉效果对标泛微E9标准

### SubAgent

- **code-explorer**: 已用于探索 D:\Weaver2020\ecology 目录下的前端代码，获取浏览按钮DOM结构和交互逻辑

### MCP

- **Playwright MCP Server**: 可用于开发完成后进行浏览器自动化测试，验证预览弹窗的交互效果