---
name: TableDesign字段类型规范化
overview: 将 TableDesign 页面的主表和明细表字段类型配置修改为图示样式，严格对标泛微E9标准。
todos:
  - id: update-main-columns
    content: 修改主表 columns：更新字段类型选项、新增类型列、数据库类型改为只读、文本长度条件显示
    status: pending
  - id: update-detail-columns
    content: 修改明细表 detailColumns：同步主表的修改
    status: pending
    dependencies:
      - update-main-columns
  - id: update-helper-functions
    content: 更新辅助函数：完善 getFieldTypeLabel 和 getDbTypeByFieldType 以支持所有泛微E9类型
    status: pending
---

## 用户需求

修改 `http://192.168.1.5:8000/formmode/tabledesign` 页面的字段类型配置，使其与提供的图片样式和泛微E9表单建模字段属性配置详解文档保持一致。

## 具体要求

1. **字段类型列**：下拉选择框，选项为泛微E9标准（文本字段、浏览按钮、选择框、附件上传、特殊字段、复选框等）
2. **类型列**：根据"字段类型"动态变化的下拉选择（如浏览按钮→人力资源、部门等）
3. **文本长度列**：仅在文本字段（htmltype=1）时显示输入框
4. **数据库类型列**：改为只读显示，根据字段类型自动计算

## 涉及文件

- 主文件：`D:\workproject\springbladeandreact\ant-design-pro\src\pages\FormMode\TableDesign\TableDesign.tsx`
- 需要修改主表 `columns` 和明细表 `detailColumns` 的字段类型配置

## 技术方案

### 修改策略

1. **字段类型（fieldHtmlType）列**：更新 Select 选项为泛微E9标准值

- 1-文本字段、2-浏览按钮、3-选择框、4-附件上传、5-特殊字段、6-复选框、8-下拉选择框、9-树形选择

2. **类型（fieldType）列**：新增动态列，根据 fieldHtmlType 渲染不同的选项

- htmltype=1: 单行文本(1)、多行文本(2)、保密字段(3)
- htmltype=2: 人力资源(1)、部门(2)、角色(3)、资产(4)、客户(5)、项目(6)、文档(7)、流程(8)、自定义浏览框(9)
- htmltype=3: 单选框(1)、多选框(2)、下拉框(3)、单选下拉框(4)、多选下拉框(5)
- htmltype=4: 附件上传(1)、图片上传(2)
- htmltype=5: 日期(1)、时间(2)、说明(3)、分割线(4)、关联字段(5)
- htmltype=6: 复选框(1)
- htmltype=8: 下拉选择框(1)
- htmltype=9: 树形选择(1)

3. **数据库类型列**：改为只读显示，移除 onChange 事件

4. **文本长度列**：改为条件渲染，仅在 fieldHtmlType=1 时显示

### 修改范围

- 主表 `columns` 数组（第927-1126行）
- 明细表 `detailColumns` 数组（第1141-1327行）