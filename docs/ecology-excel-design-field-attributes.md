# Ecology Excel 设计器字段属性分析

## 概述

Ecology Excel 设计器中，字段具有三种属性状态：**只读**、**可编辑**、**必填**。这些属性通过 UI 按钮操作控制，并存储在隐藏域中，同时通过不同的背景图标在单元格中展示。

## 字段属性值定义

| 属性值 | 含义   | 说明                    |
|--------|--------|------------------------|
| 0      | 不显示 | 字段不显示             |
| 1      | 只读   | 字段显示但不可编辑     |
| 2      | 可编辑 | 字段显示且可编辑       |
| 3      | 必填   | 字段显示且必须填写     |

## UI 按钮结构

位于 `excelOperatHead.jsp` 中的字段属性按钮区域：

```html
<div name="justread" class="operatDiv shortBtn_disabled bigBtn">
    <img src=".../readonly_wev8.png" border="0"/>
</div>
<div name="canwrite" class="operatDiv shortBtn_disabled bigBtn">
    <img src=".../canwrite_wev8.png" border="0"/>
</div>
<div name="required" class="operatDiv shortBtn_disabled bigBtn">
    <img src=".../required_wev8.png" border="0"/>
</div>
<div name="onlyshow" class="operatDiv shortBtn_disabled bigBtn">
    <img src=".../onlyshow_wev8.png" border="0"/>
</div>
```

### 按钮样式类

- `shortBtn_disabled`: 禁用状态（灰色，不可点击）
- `shortBtn`: 启用状态
- `shortBtnHover`: 选中状态（高亮显示）

## 核心实现代码

### 1. 按钮点击事件 (`baseOperate_wev8.js` 第 270-310 行)

```javascript
//只读
operatpanel.find("[name=justread]").click(function () {
    if($(this).is(".shortBtn_disabled")) return ;
    operatpanel.find("[name=canwrite]").removeClass("shortBtnHover");
    operatpanel.find("[name=required]").removeClass("shortBtnHover");
    $(this).addClass("shortBtnHover");
    setFieldPro(1);
    controlFieldOnlyShowDisabled(true);
});

//编辑
operatpanel.find("[name=canwrite]").click(function () {
    if($(this).is(".shortBtn_disabled")) return ;
    operatpanel.find("[name=justread]").removeClass("shortBtnHover");
    operatpanel.find("[name=required]").removeClass("shortBtnHover");
    $(this).addClass("shortBtnHover");
    setFieldPro(2);
    controlFieldOnlyShowDisabled(false);
});

//必填
operatpanel.find("[name=required]").click(function () {
    if($(this).is(".shortBtn_disabled")) return ;
    operatpanel.find("[name=justread]").removeClass("shortBtnHover");
    operatpanel.find("[name=canwrite]").removeClass("shortBtnHover");
    $(this).addClass("shortBtnHover");
    setFieldPro(3);
    controlFieldOnlyShowDisabled(false);
});
```

### 2. 设置字段属性函数 (`designOperate_wev8.js` 第 4385 行)

```javascript
/**
 * 设置字段属性（0:不显示,1:显示,2:可编辑,3:必填）
 */
function setFieldAttr(fieldid, fieldattr){
    if(isDetail === "on")
        $("#fieldattr"+fieldid, parentWin_Main.document).val(fieldattr);
    else
        $("#fieldattr"+fieldid).val(fieldattr);
}
```

### 3. 核心设置函数 (`baseOperate_wev8.js` 第 2230 行)

```javascript
function setFieldPro(fieldattr){
    var dataobj = getCurrentDataObj();
    if (dataobj.ecs === undefined || "" === dataobj.ecs) return;

    var nodetype = $("#nodetype").val();
    var sheet = getCurrentSheet();
    var sels = sheet.getSelections();
    sheet.isPaintSuspended(true);

    for (var n = 0; n < sels.length; n++) {
        var sel = getActualCellRange(sels[n], sheet.getRowCount(), sheet.getColumnCount());
        for (var i = 0; i < sel.rowCount; i++) {
            for (var j = 0; j < sel.colCount; j++) {
                var r = i + sel.row;
                var c = j + sel.col;
                if(!dataobj.ecs[r+","+c]) continue;

                if(dataobj.ecs[r+","+c].etype === celltype.FCONTENT){
                    var newFieldAttr = fieldattr;
                    var efiledid = parseInt(dataobj.ecs[r+","+c].efieldid);
                    var efieldtype = dataobj.ecs[r+","+c].efieldtype+"";

                    // 特殊字段处理
                    if((efiledid == "-10" && nodetype != "0" && (fieldattr == "3" || fieldattr == "2"))) {
                        continue; // 只有创建节点才能将密级设置为必填
                    }
                    if((efiledid == "-10" && fieldattr == "2")) {
                        newFieldAttr = "3"; // 密级字段编辑时自动变为必填
                    }
                    if(efieldtype == 'position' && fieldattr == '3') {
                        newFieldAttr = '2'; // 位置字段没有必填状态
                    }

                    // 设置属性值到隐藏域
                    setFieldAttr(efiledid, newFieldAttr);

                    // 更新单元格背景图片
                    var imgsrc = getCellFieldImage(dataobj.ecs[r+","+c], newFieldAttr);
                    sheet.getCell(r,c,$.wijmo.wijspread.SheetArea.viewport).backgroundImage(imgsrc);
                    sheet.getCell(r,c,$.wijmo.wijspread.SheetArea.viewport).backgroundImageLayout($.wijmo.wijspread.ImageLayout.None);
                }
            }
        }
    }
    sheet.isPaintSuspended(false);
}
```

### 4. 获取字段属性 (`designOperate_wev8.js` 第 4470 行)

```javascript
/**
 * 获取隐藏域字段属性（0:不显示,1:显示,2:可编辑,3:必填）
 */
function getFieldAttr(fieldid){
    if(isDetail === "on"){
        return $("#fieldattr"+fieldid, parentWin_Main.document).val();
    }else{
        return $("#fieldattr"+fieldid).val();
    }
}
```

## 单元格图标系统

### 图标命名规则

每个字段类型有 3 种状态的图标，命名格式：`{efieldtype}{属性值}_wev8.png`

| 字段类型 | 只读 (1)     | 可编辑 (2)     | 必填 (3)       |
|----------|--------------|----------------|----------------|
| text     | text1_wev8.png | text2_wev8.png | text3_wev8.png |
| textarea | textarea1_wev8.png | textarea2_wev8.png | textarea3_wev8.png |
| date     | date1_wev8.png | date2_wev8.png | date3_wev8.png |
| select   | select1_wev8.png | select2_wev8.png | select3_wev8.png |
| checkbox | checkbox1_wev8.png | checkbox2_wev8.png | checkbox3_wev8.png |
| radio    | radio1_wev8.png | radio2_wev8.png | radio3_wev8.png |
| browser  | browser1_wev8.png | browser2_wev8.png | browser3_wev8.png |
| affix    | affix1_wev8.png | affix2_wev8.png | affix3_wev8.png |
| position | position1_wev8.png | position2_wev8.png | position3_wev8.png |
| link     | link1_wev8.png | link2_wev8.png | link3_wev8.png |
| time     | time1_wev8.png | time2_wev8.png | time3_wev8.png |
| thousands | thousands1_wev8.png | thousands2_wev8.png | thousands3_wev8.png |

### 获取图标函数 (`designOperate_wev8.js` 第 3564 行)

```javascript
function getCellFieldImage(cellobj, fieldattr){
    var bgimage = "";
    try{
        var efieldid = parseInt(cellobj.efieldid);
        if(typeof fieldattr == "undefined")
            fieldattr = getFieldAttr(efieldid);

        if(fieldattr == 0){
            bgimage = "/workflow/exceldesign/image/controls/fieldNotShow_wev8.png";
        } else {
            // 特殊字段处理
            if(efieldid == -4)   // 签字意见字段只读
                return "/workflow/exceldesign/image/controls/textarea1_wev8.png";
            if(efieldid == -9)  // 打印次数字段只读
                return "/workflow/exceldesign/image/controls/text1_wev8.png";
            if(efieldid == -1 && fieldattr == 2)  // 标题字段可编辑则必填
                fieldattr = 3;

            // 打印和归档图片置灰
            if(wfinfo.layouttype === "1" || wfinfo.nodetype === "3")
                fieldattr = 1;

            if(cellobj.efieldtype === controltype.LINK)
                fieldattr = 1;

            // 财务相关字段
            if(!!cellobj.financial){
                if(cellobj.financial.indexOf("2-") > -1)
                    bgimage = "/workflow/exceldesign/image/controls/finance"+fieldattr+"_wev8.png";
                else if(cellobj.financial == "3")
                    bgimage = "/workflow/exceldesign/image/controls/financeUpper_wev8.png";
                else if(cellobj.financial == "4")
                    bgimage = "/workflow/exceldesign/image/controls/thousands_wev8.png";
            } else {
                // 普通字段：类型 + 属性值 + _wev8.png
                bgimage = "/workflow/exceldesign/image/controls/"+cellobj.efieldtype+fieldattr+"_wev8.png";
            }
        }
    } catch(e){}
    return bgimage;
}
```

## 按钮状态初始化

根据选中的单元格状态，初始化字段属性按钮的高亮状态 (`baseOperate_wev8.js` 第 3860 行):

```javascript
if(isSingle){
    if(dataobj.ecs[row+","+col] && dataobj.ecs[row+","+col].etype === celltype.FCONTENT){
        var fieldid = dataobj.ecs[row+","+col].efieldid;
        var fieldattr = getFieldAttr(fieldid);

        if(fieldattr === "1"){
            fieldPanel.find("[name='justread']").addClass("shortBtnHover");
        } else if(fieldattr === "2"){
            fieldPanel.find("[name='canwrite']").addClass("shortBtnHover");
        } else if(fieldattr === "3"){
            fieldPanel.find("[name='required']").addClass("shortBtnHover");
        }

        // 只有可编辑或必填字段才能设置"禁止手工编辑"
        if(fieldattr === "2" || fieldattr === "3"){
            fieldPanel.find("[name='onlyshow']").removeClass("shortBtn_disabled").addClass("shortBtn");
            var fieldonlyshowattr = getFieldOnlyShowAttr(fieldid);
            if(fieldonlyshowattr === "1")
                fieldPanel.find("[name='onlyshow']").addClass("shortBtnHover");
        }
    }
}
```

## 禁止手工编辑（OnlyShow）功能

除了基本的只读/编辑/必填外，还有"禁止手工编辑"功能 (`baseOperate_wev8.js` 第 2284 行):

```javascript
function setFieldOnlyShow(setVal){
    if(!isChooseSingleCell()) return;

    var cellid = getSelectedCellid();
    var row = cellid.row;
    var col = cellid.col;
    var dataobj = getCurrentDataObj();

    if(dataobj.ecs[row+","+col] && dataobj.ecs[row+","+col].etype === celltype.FCONTENT) {
        var fieldid = dataobj.ecs[row + "," + col].efieldid;
        if(typeof setVal === "undefined"){
            var cur = getFieldOnlyShowAttr(fieldid);
            setVal = cur === "1" ? 0 : 1; // 切换状态
        }

        if(isDetail === "on"){
            jQuery("#fieldonlyshow"+fieldid, parentWin_Main.document).val(setVal);
        } else {
            jQuery("#fieldonlyshow"+fieldid).val(setVal);
        }

        var headObj = jQuery(".excelHeadContent").find(".s_filed").find("[name=onlyshow]");
        if(setVal === 1)
            headObj.addClass("shortBtnHover");
        else
            headObj.removeClass("shortBtnHover");
    }
}
```

## 数据存储结构

### 隐藏域字段

```html
<!-- 主表字段属性 -->
<input type="hidden" id="fieldattr{fieldid}" value="1" />
<input type="hidden" id="fieldonlyshow{fieldid}" value="0" />

<!-- 明细表字段属性 -->
<input type="hidden" id="fieldattr{fieldid}" value="1" />
```

### 单元格自定义属性 (ecs)

```javascript
dataobj.ecs = {
    "0,0": {
        etype: celltype.FCONTENT,  // 字段内容类型
        efieldid: 123,             // 字段ID
        efieldtype: "text"         // 字段类型
    }
};
```

## 右键菜单集成

字段属性操作也集成在右键菜单中 (`baseOperate_wev8.js` 第 2778 行):

```javascript
// 右键菜单构建
if(action === "readonly"){
    // 只读
    jQuery(".excelHeadContent").find("[name=required]").removeClass("shortBtnHover");
} else if(action === "canwrite"){
    // 可编辑
    jQuery(".excelHeadContent").find("[name=required]").removeClass("shortBtnHover");
} else if(action === "required"){
    // 必填
    jQuery(".excelHeadContent").find("[name=required]").addClass("shortBtnHover");
}
```

## 特殊字段处理规则

1. **签字意见字段 (-4)**: 只能只读
2. **打印次数字段 (-9)**: 只能只读
3. **密级字段 (-10)**:
   - 只有创建节点才能设置为必填或可编辑
   - 设置为可编辑时自动变为必填
4. **位置字段 (position)**: 没有必填状态，可编辑时使用可编辑图标
5. **标题字段 (-1)**: 设置为可编辑时自动变为必填

## 与 ant-design-pro 的实现对比

| 特性         | Ecology                     | ant-design-pro                    |
|--------------|----------------------------|-----------------------------------|
| 属性存储     | 隐藏域 `fieldattr{fieldid}` | FieldMeta 对象                    |
| 图标系统     | 背景图片叠加                | emoji 图标前缀或背景图片           |
| 状态值       | 0-3                        | 可自定义（通常 0-3 或 boolean）   |
| UI 操作      | 工具栏按钮 + 右键菜单       | 侧边栏属性面板                    |
| 保存方式     | 随表单一起提交              | 通过 API 保存                     |
