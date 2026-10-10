---
name: form-excel-designer
overview: 基于泛微 E9 的 weaver.workflow.exceldesign 模块，在 SpringBlade 后端和 Ant Design Pro 前端实现 Excel 风格的可视化表单设计器，支持字段自由拖拽、多 Tab 页签、字段分组框，并使用 XML 格式存储表单布局（兼容泛微 E9 格式）。
design:
  architecture:
    framework: react
  styleKeywords:
    - Modern
    - Clean
    - Enterprise
    - Spreadsheet-like
  fontSystem:
    fontFamily: PingFang SC
    heading:
      size: 24px
      weight: 600
    subheading:
      size: 16px
      weight: 500
    body:
      size: 14px
      weight: 400
  colorSystem:
    primary:
      - "#1890ff"
      - "#40a9ff"
      - "#096dd9"
    background:
      - "#ffffff"
      - "#f0f2f5"
    text:
      - "#000000"
      - "#333333"
      - "#666666"
    functional:
      - "#52c41a"
      - "#ff4d4f"
      - "#faad14"
todos:
  - id: create-form-layout-table
    content: 创建form_layout数据库表，存储采用JSON格式进行数据存储，确保与E9系统的实际格式保持一致
    status: completed
  - id: create-form-layout-entity
    content: 创建FormLayout实体类，对应form_layout表
    status: completed
    dependencies:
      - create-form-layout-table
  - id: create-form-layout-mapper
    content: 创建FormLayoutMapper，提供数据库访问
    status: completed
    dependencies:
      - create-form-layout-entity
  - id: create-form-layout-service
    content: 创建IFormLayoutService和FormLayoutServiceImpl，实现XML解析和生成逻辑
    status: completed
    dependencies:
      - create-form-layout-mapper
  - id: create-form-layout-controller
    content: 创建FormLayoutController，提供RESTful API
    status: completed
    dependencies:
      - create-form-layout-service
  - id: create-excel-design-page
    content: 创建ExcelDesign前端主页面，集成Excel表格、字段面板、属性配置面板
    status: completed
    dependencies:
      - create-form-layout-controller
  - id: implement-excel-grid
    content: 实现ExcelGrid组件，模拟Excel单元格，支持字段拖拽放置
    status: completed
    dependencies:
      - create-excel-design-page
  - id: implement-field-palette
    content: 实现FieldPalette组件，显示可拖拽的字段类型
    status: completed
    dependencies:
      - create-excel-design-page
  - id: implement-tab-manager
    content: 实现TabManager组件，支持多Tab页签布局管理
    status: completed
    dependencies:
      - create-excel-design-page
  - id: implement-group-box
    content: 实现GroupBox组件，支持字段分组框
    status: completed
    dependencies:
      - create-excel-design-page
  - id: integrate-frontend-backend
    content: 集成前后端API，实现表单布局的保存、读取、删除功能
    status: completed
    dependencies:
      - implement-xml-storage
---

## 用户需求

基于泛微E9表单建模功能分析报告，在SpringBlade后端与ant-design-pro前端项目中，开发表单设计器与工作流引擎的深度集成功能。重点实现 `weaver.workflow.exceldesign` 模块中的新表单Excel设计器。

## 产品概述

开发Excel电子表格风格的表单设计器，支持字段自由拖拽排列、字段分组框（Group Box）、多Tab页签布局等高级布局方式。前端使用 **Univer** Excel组件，后端提供完整的API支持表单模板的保存、读取及JSON格式结构解析（**兼容泛微E9实际格式**）。

## 核心功能

1. **Excel风格表单设计器**：使用Univer组件，字段可自由拖拽到单元格，支持单元格合并、行列调整
2. **字段分组框（Group Box）**：支持将相关字段放在一个分组框内，分组框可拖拽调整位置和大小
3. **多Tab页签布局**：支持多个Tab页签，每个Tab可独立设计表单布局
4. **JSON格式表单布局存储**：兼容泛微E9实际格式（不是XML），支持表单布局的保存与解析
5. **前后端API对接**：前端设计器与后端工作流引擎数据结构的深度集成

## 技术栈

- **后端**: Spring Boot 3.5.9、Spring Cloud 2025.0.1、MyBatis Plus 3.5.19、MySQL 8.0+
- **前端**: React 18、TypeScript、Ant Design Pro、@univerjs（Excel组件）、@dnd-kit（拖拽）、Umi Max
- **数据处理**: JSON处理（兼容泛微E9格式）
- **其他**: Redis（缓存）、Nacos（配置中心）

## 实现方案

### 后端实现方案

#### 1. 数据库设计

新增 `form_layout` 表存储表单布局（**JSON格式**，兼容泛微E9）：

```sql
CREATE TABLE IF NOT EXISTS `form_layout` (
    `id`            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '布局ID',
    `form_id`       BIGINT       NOT NULL COMMENT '表单ID（关联workflow_bill）',
    `layout_name`   VARCHAR(200) DEFAULT NULL COMMENT '布局名称',
    `layout_json`   LONGTEXT     DEFAULT NULL COMMENT '布局JSON（兼容泛微E9格式）',
    `layout_config`  TEXT         DEFAULT NULL COMMENT '布局配置JSON',
    `status`         INT          DEFAULT 1 COMMENT '状态：1启用 0禁用',
    `tenant_id`      VARCHAR(32)  DEFAULT '000000' COMMENT '租户ID',
    `create_time`    DATETIME     DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time`    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '修改时间',
    PRIMARY KEY (`id`),
    KEY `idx_form_id` (`form_id`),
    KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='表单布局';
```

**注意**：泛微E9实际存储格式为JSON（在 `workflow_nodehtmllayout` 表的 `datajson` 字段），结构如下：

```
{
  "eformdesign": {
    "etables": { /* 表格配置 */ },
    "formula": { /* 公式配置 */ }
  }
}
```

#### 2. 实体类设计

- `FormLayout.java`：对应 `form_layout` 表
- `FormLayoutJson.java`：JSON解析/生成的辅助类（兼容泛微E9格式）

#### 3. 服务层设计

- `IFormLayoutService`：提供表单布局的保存、读取、解析、删除等方法
- `FormLayoutServiceImpl`：实现JSON解析和生成逻辑，兼容泛微E9格式

#### 4. 控制器设计

- `FormLayoutController`：提供RESTful API
- `POST /api/blade-formmode/form-layout/save`：保存表单布局
- `GET /api/blade-formmode/form-layout/{formId}`：读取表单布局
- `POST /api/blade-formmode/form-layout/parse-json`：解析JSON布局
- `DELETE /api/blade-formmode/form-layout/{id}`：删除表单布局

### 前端实现方案

#### 1. Univer Excel设计器组件设计

- `ExcelDesign/index.tsx`：主页面，包含Univer表格、字段面板、属性配置面板
- `UniverGrid.tsx`：Univer表格组件，使用 `@univerjs/presets` 或 `@univerjs/core` + 插件
- `FieldPalette.tsx`：字段面板，显示可拖拽的字段类型
- `TabManager.tsx`：Tab页签管理组件
- `GroupBox.tsx`：分组框组件，支持拖拽调整位置和大小

#### 2. 拖拽实现

使用 `@dnd-kit` 实现字段拖拽：

- `DndContext`：拖拽上下文
- `Draggable`：可拖拽字段
- `Droppable`：可放置区域（Univer单元格、分组框）

#### 3. JSON格式布局存储

- 前端将布局配置转换为JSON格式（兼容泛微E9）
- 后端接收JSON并存储到 `form_layout` 表
- 前端加载时从后端读取JSON并解析为布局配置

#### 4. 前后端API对接

- 新增 `formLayoutApi.ts` 服务，调用后端API
- 设计器保存时调用 `formLayoutApi.save()`
- 设计器加载时调用 `formLayoutApi.getByFormId()`

## 实现细节

### 后端实现细节

#### 1. JSON格式设计（兼容泛微E9）

```
{
  "eformdesign": {
    "etables": {
      "Sheet1": {
        "data": { /* 单元格数据 */ },
        "styles": { /* 样式 */ },
        "mergedCells": [ /* 合并单元格 */ ]
      }
    },
    "formula": { /* 公式配置 */ },
    "tabs": [ /* Tab页签配置 */ ],
    "groupBoxes": [ /* 分组框配置 */ ]
  }
}
```

#### 2. JSON解析和生成

- 使用Java原生JSON库（如FastJSON、Jackson）解析JSON
- `FormLayoutJsonParser`：解析JSON为布局配置对象
- `FormLayoutJsonGenerator`：将布局配置对象生成为JSON

### 前端实现细节

#### 1. Univer表格实现

- 使用 `@univerjs/presets` 快速启动（推荐）
- 或使用 `@univerjs/core` + 插件模式（精细控制）
- Univer API映射（从SpreadJS迁移）：
- `new GC.Spread.Sheets.Workbook(container)` → `createUniver()` + `UniverSheetsCorePreset()`
- `spread.getActiveSheet()` → `univerAPI.getActiveWorkbook().getActiveSheet()`
- `sheet.getCell(r, c)` → `sheet.getRange(r, c, 1, 1)`

#### 2. 拖拽逻辑

- 字段面板中的字段可拖拽到Univer单元格
- 分组框可拖拽调整位置和大小
- 字段在单元格内可拖拽调整位置

#### 3. Tab页签管理

- 支持新增、删除、重命名Tab
- 每个Tab独立存储布局配置
- Tab切换时加载对应布局

## 性能优化

1. **后端**：JSON解析缓存，避免重复解析
2. **前端**：拖拽操作使用防抖，减少API调用
3. **数据库**：`form_id` 索引优化查询性能

## 安全考虑

1. JSON解析防止恶意数据注入
2. 后端API权限控制
3. 前端输入验证

## 设计风格

采用现代简洁风格，结合Ant Design Pro的企业级设计语言，提供专业、易用的表单设计器界面。

## 页面规划

### 1. Excel设计器主页面（ExcelDesign）

- **顶部工具栏**：保存、预览、导入、导出、撤销、重做
- **左侧字段面板**：显示可拖拽的字段类型（文本、数字、日期、下拉框等）
- **中间Univer表格区域**：可视化表单布局设计区域，支持单元格、分组框、Tab页签
- **右侧属性配置面板**：配置选中字段或组件的属性

### 2. 字段面板（FieldPalette）

- 按字段类型分组显示
- 支持搜索字段类型
- 字段类型图标+名称显示

### 3. Univer表格（UniverGrid）

- 真正的Excel界面，显示行列号
- 支持单元格选中、合并
- 字段拖拽到单元格后显示字段标签
- 分组框可拖拽调整位置和大小

### 4. Tab页签管理（TabManager）

- 支持多个Tab页签
- 每个Tab可独立设计
- 支持新增、删除、重命名Tab

### 5. 分组框（GroupBox）

- 可拖拽调整位置和大小
- 分组框内可放置字段
- 支持嵌套分组框

## 交互设计

1. **字段拖拽**：从字段面板拖拽字段到Univer单元格
2. **分组框拖拽**：从组件面板拖拽分组框到Univer表格
3. **选中高亮**：选中字段或组件时高亮显示
4. **属性配置**：右侧属性面板实时更新选中元素的属性
5. **撤销/重做**：支持操作撤销和重做

## 响应式设计

- 桌面端优先设计
- 支持窗口大小调整时自动适应

## Agent Extensions

### Skill

- **ant-design-react**：用于构建React UI组件，支持Ant Design的60+组件（Button、Form、Table、Select、Modal、Message），设计令牌，TypeScript支持，和ConfigProvider主题定制。在实现Excel设计器前端页面时使用。

- **frontend-design**：用于创建独特、生产级的前端界面，具有高质量的设计。在实现Excel设计器的UI/UX设计时使用。

- **java-microservices**：用于消息平台开发。在实现后端微服务架构时使用。

### MCP

- **Firecrawl MCP Server**：用于网页抓取和搜索。在需要参考泛微E9的Excel设计器实现时，可以使用此工具搜索相关文档。

### SubAgent

- **code-explorer**：用于搜索代码库，探索现有实现，确保新实现与现有代码库的一致性。在制定详细实施计划时使用。