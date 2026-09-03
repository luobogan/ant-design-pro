# 泛微 E9 Excel 表单设计器 —— 单元格「只读 / 可编辑 / 必填」实现分析

> 分析对象：`D:\Weaver2020\ecology\formmode\exceldesign`（泛微 E9 建模引擎 Excel 布局设计器）
> 技术栈：**SpreadJS（Wijmo Spread）** + jQuery + JSP，属性以**表单隐藏域**为载体
> 本文所有结论均来自源码实读，附文件路径与行号；后端 Java 仅有 `.class` 产物，涉及内部实现处已明确标注。

---

## 0. 一句话结论

泛微的「只读 / 可编辑 / 必填」**不是单元格样式，而是字段级的状态位**：

- 属性**按「字段 ID」存储**（一个隐藏域 `input#fieldattr{fieldid}`），而非按单元格坐标；
- 单元格只负责**显示**：用 **背景图文件名**（`控件类型 + 属性值 + _wev8.png`）表达当前状态；
- 右键菜单 / 工具栏按钮 / 属性回填，三条路径全都只改这**同一个隐藏域**，天然不会不同步；
- 预览 = 提交同一份表单 → 重定向到**真实表单运行态**（SPA 卡片页），与最终运行态共用渲染代码。

---

## 1. 代码地图（先看清楚哪些是「活」的）

`excelMain.jsp:72-77` 是唯一入口，请注意：**真正的运行代码只有 4 个 JS**：

```jsp
72: <script src="/formmode/exceldesign/js/excelRightClick_wev8.js"></script>
73: <script src="/formmode/exceldesign/js/excelRightClickOperat_wev8.js"></script>
76: <script src="/formmode/exceldesign/js/baseOperate_wev8.js?v=1"></script>
77: <script src="/formmode/exceldesign/js/designOperate_wev8.js"></script>
```

| 文件 | 角色 | 与本文的关系 |
|---|---|---|
| `excelRightClick_wev8.js` | 通用 jQuery 右键菜单插件（`mac.contextMenu` / `mac.menu`） | 菜单**渲染与事件**机制 |
| `excelRightClickOperat_wev8.js` | 「设置格式」面板（数字/对齐/字体/边框/填充） | ❌ 与字段属性**无关**，易误入 |
| **`baseOperate_wev8.js`** | 设计器主逻辑（IIFE 闭包） | ✅ 菜单生成、点击分发、`setFieldPro` |
| **`designOperate_wev8.js`** | 全局函数层 | ✅ `setFieldAttr` / `getFieldAttr` / `getCellFieldImage` / 保存 / 预览 |
| `excelSet.jsp` | 设计器中枢页面 | ✅ 隐藏域容器与**回填生成** |
| `excelPreView.jsp` | 预览跳转 | ✅ 重定向到运行态 |
| `excel_fieldattr.jsp` | 「字段属性」对话框（更多属性） | 联动/公式等，非本文重点 |

> ⚠️ **重要避坑**：目录下另有 `excelBaseOperat_wev8.js`(181KB)、`excelBodyOperat_wev8.js`(62KB)，
> 它们是**从 workflow 模块拷贝的历史副本**，在本工作区**没有任何 JSP/JS 引用**（全库引用扫描结果为 0）。
> 但因其内容与设计器高度相似，搜索时极易被误导（`eDesignPublic_wev8.js:5` 已注明"此文件内容全部整合到 wfExcelHtml_wev8.js，文件弃用"）。
> 下文统一以**被引用的 `baseOperate_wev8.js` / `designOperate_wev8.js`** 为准。

---

## 2. 设计器侧：右键菜单如何工作

### 2.1 菜单容器是空壳，菜单项运行时生成

`excelMain.jsp:393`：

```jsp
<ul id="excelRightMenu" class="contextMenu menu2"></ul>
```

`<ul>` 里**一个 `<li>` 都没有**。菜单项是运行时拼 JSON 字符串，再交给插件渲染：

```js
// baseOperate_wev8.js:479-480
var menuJson = getMenuJson();
$('#excelRightMenu').mac('menu', menuJson);
```

插件 `mac.menu`（`excelRightClick_wev8.js:364-396`）递归地把 `children` 数组渲染成 `<li action="...">`；
点击时回调 `callback(action, el, pos)`，把**菜单项的 `action` 字符串**抛回业务层。

### 2.2 三个菜单项与它们的可见性门控

`baseOperate_wev8.js:2612-2649` `getMenuJson()`：

```js
2618: if(rightMenuSelectCase === "nor" && (wfinfo.layouttype == "1" || wfinfo.layouttype == "2")){  // 仅新建/编辑布局
2619:     var _menu_rem = getFieldREM();
2620:     var isfield      = (_menu_rem.split(",")[0]==="true") ? true : false;   // 普通字段
2621:     var istitlefield = (_menu_rem.split(",")[1]==="true") ? true : false;   // 标题字段
2622:     var isspecial    = (_menu_rem.split(",")[2]==="true") ? true : false;   // 特殊字段
2623:     if(isfield || istitlefield || isspecial){
2624:         menuStr += "{" +
2625:             "\"title\" : \""+SystemEnv.getHtmlNoteName(4533)+"\"," +   // 只读
2626:             "\"icon\": \"rmenuread\"," +
2627:             "\"action\": \"readonly\"" + "},";
2630:         if(isfield){          // ← 只有「普通字段」才有「可编辑」
2632:             ... SystemEnv.getHtmlNoteName(4002) ...  // 可编辑
2634:             "\"action\": \"canedit\"" ...
2637:         if(isfield || istitlefield){   // ← 特殊字段没有「必填」
2639:             ... SystemEnv.getHtmlNoteName(4534) ...  // 必填
2641:             "\"action\": \"required\"" ...
2643:         menuStr += "{\"title\" : \"\"},";   // 空 title = 分隔线
```

三个 action 名（**记住这三个，它们是全链路的钥匙**）：

| 菜单项 | action | 传入值 | 出现条件 |
|---|---|---|---|
| 只读 | `readonly` | `1` | 任意字段格 |
| 可编辑 | `canedit` | `2` | **仅**普通字段（`isfield`） |
| 必填 | `required` | `3` | 普通字段 或 标题字段 |

标题取自国际化标签 `SystemEnv.getHtmlNoteName(4533 / 4002 / 4534)`，图标 class 为 `rmenuread / rmenuedit / rmenurequired`。

**门控函数 `getFieldREM()`**（`baseOperate_wev8.js:3857-3892`）逐个遍历选区单元格，读单元格自定义属性 `dataobj.ecs["row,col"]`：

```js
3874: if(dataobj.ecs[ar+","+ac].etype === celltype.FCONTENT){        // 必须是「字段内容格」
3875:     if(dataobj.ecs[ar+","+ac].efieldid+"" === "-1")
3876:         istitlefield = true;                                    // -1 = 标题字段
3877:     else if(dataobj.ecs[ar+","+ac].efieldid+"" === "-4")
3878:         isspecial = true;                                       // -4 = 签字意见(特殊)
3879:     else{
3880:         var _fieldtype = $("a[_flag="+celltype.FCONTENT+"][_fieldid="+...efieldid+"]")...val();
3881:         if(_fieldtype==="7" || _fieldtype==="9") isspecial = true;   // 某些特殊类型
3883:         else isfield = true;
3884:     }
3891: return isfield+","+istitlefield+","+isspecial;   // 返回 "true,false,false" 形式
```

**只有 `etype === FCONTENT`（字段内容格）才有这三个菜单项**——字段名格（`FNAME`）不参与属性设置。

### 2.3 点击分发：菜单 → `setFieldPro(n)`

`baseOperate_wev8.js:484-535` 是菜单回调，509-527 行就是三个分支：

```js
509: }else if(action === "readonly"){
511:     jQuery(".excelHeadContent").find("[name=canwrite]").removeClass("shortBtnHover");
512:     jQuery(".excelHeadContent").find("[name=required]").removeClass("shortBtnHover");
513:     jQuery(".excelHeadContent").find("[name=justread]").addClass("shortBtnHover");
514:     setFieldPro(1);
515: }else if(action === "canedit"){
517:     ... [name=justread] .. [name=required] .removeClass("shortBtnHover")
519:     ... [name=canwrite] .addClass("shortBtnHover");
520:     setFieldPro(2);
521: }else if(action === "required"){
523:     ... [name=justread] .. [name=canwrite] .removeClass("shortBtnHover")
525:     ... [name=required] .addClass("shortBtnHover");
526:     setFieldPro(3);
```

注意：**每次点击都会同时同步顶部工具栏三个按钮的高亮态**（`justread` / `canwrite` / `required`），
保证「右键菜单」与「工具栏按钮」永远互斥且一致。

---

## 3. 核心：`setFieldPro` —— 只改一处状态 + 只换一张背景图

`baseOperate_wev8.js:2134-2159`：

```js
2134: function setFieldPro(fieldattr){                       // 1=只读 2=可编辑 3=必填
2135:     var dataobj = getCurrentDataObj();
2136:     if (dataobj.ecs === undefined || ""===dataobj.ecs) return;   // 无自定义属性则直接返回
2138:     var sheet = getCurrentSheet();
2139:     var sels = sheet.getSelections();                   // 支持多选区批量
2140:     sheet.isPaintSuspended(true);                       // 暂停重绘，避免逐格闪烁
2141:     for (var n = 0; n < sels.length; n++){
2142:         var sel = getActualCellRange(sels[n], sheet.getRowCount(), sheet.getColumnCount());
2143:         for (var i = 0; i < sel.rowCount; i++){
2144:             for (var j = 0; j < sel.colCount; j++){
2145:                 var r = i + sel.row, c = j + sel.col;
2147:                 if(!dataobj.ecs[r+","+c]) continue;                       // 无属性的格跳过
2148:                 if(dataobj.ecs[r+","+c].etype === celltype.FCONTENT){     // 只处理字段内容格
2149:                     var efiledid = parseInt(dataobj.ecs[r+","+c].efieldid);
2150:                     setFieldAttr(efiledid, fieldattr);                    // ① 写状态（按字段ID）
2151:                     var imgsrc = getCellFieldImage(dataobj.ecs[r+","+c], fieldattr);
2152:                     sheet.getCell(r,c,...).backgroundImage(imgsrc);        // ② 换背景图
2153:                     sheet.getCell(r,c,...).backgroundImageLayout($.wijmo.wijspread.ImageLayout.None);
2154:                 }
2155:             }}}
2158:     sheet.isPaintSuspended(false);                      // 恢复重绘
2159: }
```

三个设计要点：

1. **批量**：遍历所有选区，一次可改多个字段格；`isPaintSuspended` 包裹避免闪烁。
2. **过滤**：只对 `etype === FCONTENT` 的格生效，其余静默跳过。
3. **两件事**：① 写状态（按 **fieldid**）② 换背景图（按 **单元格**）——状态是字段级的，显示是单元格级的。

---

## 4. 持久化：状态存在隐藏域里，按「字段 ID」而非坐标

`designOperate_wev8.js:4458-4463`：

```js
4458: function setFieldAttr(fieldid, fieldattr){
4459:     if(isDetail === "on")
4460:         $("#fieldattr"+fieldid, parentWin_Main.document).val(fieldattr);   // 明细表：写到主窗口
4461:     else
4462:         $("#fieldattr"+fieldid).val(fieldattr);                            // 主表：写当前窗口
4463: }
```

读取（`designOperate_wev8.js:4536-4545`），**注释里写明了四态枚举**：

```js
4536: /**
4537:  * 获取隐藏域字段属性（0:不显示,1:显示,2:可编辑,3:必填）
4538:  */
4539: function getFieldAttr(fieldid){
4540:     if(isDetail === "on")
4541:         return $("#fieldattr"+fieldid, parentWin_Main.document).val();
4542:     else
4543:         return $("#fieldattr"+fieldid).val();
4544: }
```

### 状态编码（权威定义）

| 值 | 含义 | 备注 |
|---|---|---|
| `0` | 不显示 | 字段不在模板中 |
| `1` | 只读（显示） | 即菜单「只读」 |
| `2` | 可编辑 | 即菜单「可编辑」 |
| `3` | 必填 | 即菜单「必填」 |

### 隐藏域从哪来？（回填链路）

`excelSet.jsp` 在服务端拼好隐藏域。`ExcelLayoutManager.getFieldAttr4LEF(layoutid)` 读出属性表
（`excelSet.jsp:78-92` 得到 `fieldAttr_hs`，key 为 `fieldAttr{fieldid}`），再拼 HTML：

```jsp
<!-- excelSet.jsp:118  主表字段 -->
<input type="hidden" id="fieldattr{fieldid}" fieldname="{标签}" nodetype="-1"
       name="fieldattr{fieldid}" value="{attr}">

<!-- excelSet.jsp:151  明细字段 -->
<input type="hidden" id="fieldattr{fieldid}" fieldname="{标签}" nodetype="{groupid}"
       name="fieldattr{fieldid}" value="{attr}">
```

- `nodetype="-1"` → 主表字段；`nodetype="{groupid}"` → 第 N 个明细表字段；
- 它们塞进 `excelSet.jsp:382` 的 `<div id="hiddenAttrDiv" style="display:none">`，
  与 `modeid / formid / layoutid / layouttype` 等一起构成 `#LayoutForm`。

> 💡 **`nodetype` 在保存时会被用到**（见 §5.1），这是主表/明细表走不同清理分支的依据。

---

## 5. 视觉呈现：背景图文件名即状态

`designOperate_wev8.js:3732-3762` `getCellFieldImage()`：

```js
3732: function getCellFieldImage(cellobj, fieldattr){
3735:     var efieldid = parseInt(cellobj.efieldid);
3736:     if(typeof fieldattr == "undefined")
3737:         fieldattr = getFieldAttr(efieldid);            // 未传则回读隐藏域
3738:     if(fieldattr == 0){
3739:         bgimage = "/formmode/exceldesign/image/controls/fieldNotShow_wev8.png";   // 不显示
3740:     }else{
3741:         if(efieldid == -4)                             // 签字意见字段恒只读
3742:             return ".../textarea1_wev8.png";
3743:         if(efieldid == -1 && fieldattr == 2)           // 标题字段「可编辑」按「必填」显示
3744:             fieldattr = 3;
3745:         if(wfinfo.layouttype == "0" || "3" || "4")     // 显示/监控/打印布局 → 统一置灰
3746:             fieldattr = 1;
3747:         if(cellobj.efieldtype===controltype.LINK || cellobj.efieldtype===controltype.POSITION)
3748:             fieldattr = 1;                             // 链接/位置控件恒只读
3749:         if(!!cellobj.financial){                       // 财务类特殊图标
3751:             bgimage = ".../finance"+fieldattr+"_wev8.png";
3753:             ... financeUpper_wev8.png / thousands_wev8.png
3757:         bgimage = "/formmode/exceldesign/image/controls/"+cellobj.efieldtype+fieldattr+"_wev8.png";
3759:     }
3762:     return bgimage;
```

**规则极其朴素：图片文件名 = 控件类型 + 属性值**。已核实图标资源真实存在：

```
formmode/exceldesign/image/controls/text1_wev8.png   ← 文本框 + 只读
formmode/exceldesign/image/controls/text2_wev8.png   ← 文本框 + 可编辑
formmode/exceldesign/image/controls/text3_wev8.png   ← 文本框 + 必填
```

并且有若干**业务强制规则**（3741-3748）：签字意见恒只读、标题字段的可编辑降级为必填、
**显示/监控/打印布局统一按只读(1)渲染**、链接/位置控件恒只读。

> 📌 也就是说：**泛微不用背景色区分三种状态，而用「控件图标 + 状态后缀」的位图**。
> 图标由设计切好，前端只做字符串拼接。

---

## 6. 工具栏与菜单的双向同步

选中单元格时，把当前字段的属性回显到工具栏（`baseOperate_wev8.js:3842-3852`）：

```js
3842: function setFieldAttrHover(fieldid){
3844:     var fieldattr = getFieldAttr(fieldid);
3845:     if(fieldattr+"" === "1")      fieldPanel.find("[name='justread']").addClass("shortBtnHover");
3847:     else if(fieldattr+"" === "2") fieldPanel.find("[name='canwrite']").addClass("shortBtnHover");
3849:     else if(fieldattr+"" === "3") fieldPanel.find("[name='required']").addClass("shortBtnHover");
3850: }
```

**方向**：菜单点击 → 写隐藏域 → 同步按钮（§2.3）；选中单元格 → 读隐藏域 → 高亮按钮（本函数）。
两条路都只经过 `getFieldAttr/setFieldAttr`，因此**不会不同步**。

---

## 7. 保存：提交整个表单，并先做一次「清理」

`designOperate_wev8.js:4590-4625` `saveLayout()`：

```js
4590: function saveLayout(){
4592:     // 将模板中不存在的字段属性全部置为不显示
4593:     jQuery("#hiddenAttrDiv").find("[id^=fieldattr]").each(function(){
4594:         var nodetype = parseInt($(this).attr("nodetype"));
4595:         if($(this).val() !== "0"){
4596:             if(nodetype === -1){                       // 主表：看该字段是否还有内容格
4597:                 if($(this).attr("havefcontent") != "1")
4598:                     $(this).val("0");                 // 模板里已无此字段 → 置 0（不显示）
4599:             }else{                                     // 明细：从缓存的 datajson 判断
4600:                 var detail_symbol = "detail_"+(nodetype+1);
4601:                 if(globalData.hasCache(detail_symbol)){
4603:                     var field_str = "\"etype\":\"3\",\"field\":\""+ id.replace("fieldattr","") +"\"";
4605:                     if(detail_datajson_str.search(field_str) == -1 && ...search(field_str1) == -1)
4606:                         $(this).val("0");
4607:                 }else{
4608:                     $(this).val("0");                 // 明细表没打开过 → 置 0
4609:                 }
4610:             }
4611:         }
4612:     });
4623:     $("#LayoutForm").attr("action","excelLayoutSave.jsp?operation=saveExcel")
                        .attr("target","_self").attr("enctype","multipart/form-data");
4624:     $("#LayoutForm").submit();
4625: }
```

**这一步是「设计态脏数据」的兜底**：字段被从模板里删掉后，其 `fieldattr` 隐藏域往往还在，
保存前统一把「模板中已不存在」的字段置 `0`，避免残留状态。
判据是 `havefcontent` 属性（该字段是否还保有 FCONTENT 内容格），由 §4 的 `setFieldAttrHave` 维护。

后端入口 `excelLayoutSave.jsp:47`：

```java
layoutid = ExcelLayoutManager.doSaveExcelInfo();
```

> 该 Java 类在本工作区**只有 `.class`**（`classbean/`），无源码，其内部落库细节未能实读。
> 但从周边 SQL 可确定布局本体落在 **`modehtmllayout`** 表：
> `excelExport.jsp:63` `select layoutname,scriptstr from modehtmllayout where id=?`
> `excelImportOperation.jsp:116` `update modehtmllayout set scriptstr=? where id=?`
> `showModule.jsp:27` 以 `version = 2` 区分 Excel 布局（`scriptstr` 存布局 JSON）。

---

## 8. 预览：不是另写一套渲染，而是跳到真实运行态

### 8.1 预览只是换个 form action

`designOperate_wev8.js:4627-4633`：

```js
4627: /**
4628:  * 表单预览功能
4629:  */
4630: function preViewLayout(){
4631:     $("#LayoutForm").attr("action","excelPreView.jsp").attr("target","_blank");
4632:     $("#LayoutForm").submit();
4633: }
```

**与保存完全对称**：同一个 `#LayoutForm`（含全部 `fieldattr{fieldid}` 隐藏域、datajson、pluginjson），
只是 `action` 从 `excelLayoutSave.jsp` 换成 `excelPreView.jsp`，并 `target="_blank"` 开新窗口。

### 8.2 `excelPreView.jsp` 只做重定向

`excelPreView.jsp:13-18`：

```jsp
13: if(isecme == 1){
14:     response.sendRedirect("/spa/cube/index.html#/main/cube/card?type=..&feaid=..&isecme=1&layoutid=..&modeId=-1&categoryid=..");
15: }else{
17:     response.sendRedirect("/spa/cube/index.html#/main/cube/card?isPreview=1&hidetop=1&modeId=..&formId=..&type=..&layoutid=..");
18: }
19: return;
```

**关键认知**：预览页本身**不做任何渲染**，它把 `modeId / formId / type(布局类型) / layoutid` 拼成 URL，
重定向到 E9 的 SPA 卡片页 `/spa/cube/index.html#/main/cube/card`，仅多带两个标记：
- `isPreview=1` —— 预览模式（不落库）
- `hidetop=1` —— 隐藏顶部栏

👉 **预览 = 真实表单运行态**。预览所见即最终用户所见，不存在"预览一套、运行另一套"的偏差。

> ⚠️ 注意：该 JSP 内**无 session/缓存写入**，纯 `redirect` 后 `return`。
> 因此预览加载的是**按 `layoutid` 从后端读取的已保存布局**；未保存的改动不会出现在预览中。
> （这一点由代码直接推断，未做运行时验证。）

### 8.3 运行态如何消费「只读/可编辑/必填」

运行态（如 `formmode/view/AddFormModeIframe.jsp`）在字段 DOM 上挂 `isMustInput` 属性并据此判定
（`AddFormModeIframe.jsp:1705-1712`）：

```js
1705: var isMustInput = jQuery("#"+inputname).attr("isMustInput");
1706: if(isMustInput){
1707:     if(isMustInput=="2"){       // 必填
1708:         ismand = 1;
1709:     }else if(isMustInput=="1"){ // 可编辑
1710:         ismand = 0;
1711:     }
1712: }
```

- `isMustInput="1"` → 可编辑（`ismand=0`）
- `isMustInput="2"` → 必填（`ismand=1`）
- 只读 → 渲染为不可录入的展示形态（不挂可编辑态）

`ismand` 随后传给具体控件渲染/校验函数（如 `1714: onFlownoShowDate(spanname, inputname, ismand)`）。
`isMustInput` 由 `<brow:browser ... isMustInput="2">` 之类的 JSP 标签输出，
其值由后端按布局字段属性解析后注入（Java 侧在本工作区仅有 `.class`，未实读）。

### 8.4 ⚠️ 务必区分：布局静态属性 vs 字段属性联动

这是阅读泛微代码时**最容易混淆**的一点——两套完全不同的东西，用了相近的命名：

| | 布局静态属性（本文主题） | 字段属性联动 |
|---|---|---|
| 设置位置 | Excel 设计器右键菜单 / 工具栏 | 表单「字段属性联动」配置 |
| 载体 | `input#fieldattr{fieldid}` 隐藏域 | **`modefieldattr` 表** |
| 内容 | 单个数字 `0/1/2/3` | `attrcontent`（加密的触发公式，如 `doFieldMath("$10072$+$10073$")`）+ `fieldid/layoutid/caltype/transtype` |
| 运行时 | 渲染时注入 `isMustInput` | `FieldAttrManager` + `FieldAttrAjax.jsp` 动态改属性 |
| 编码 | `0不显示/1只读/2可编辑/3必填` | `1=编辑, 2=必填, 3=只读`（`AddFormModeIframe.jsp:2584/2751/2962`）⚠️ **值含义不同！** |

两者在运行态**叠加**：静态属性是基线，联动可在运行时覆盖它
（`AddFormModeIframe.jsp:2173` `fieldattr==4` 表示"恢复原显示属性"，即回退到静态基线）。

---

## 9. 全链路总览

```
【设计态】
excelSet.jsp:118/151  服务端拼 <input id="fieldattr{fieldid}" value="{0|1|2|3}" nodetype="-1|groupid">
        │                    ▲ getFieldAttr4LEF(layoutid) 读取
        ▼
hiddenAttrDiv (#LayoutForm)
        │
        ├─ 右键菜单 ── getMenuJson() ─→ action: readonly(1) / canedit(2) / required(3)
        │       └─ callback ─→ setFieldPro(n) ─┬─→ setFieldAttr(fieldid, n)  ─→ 改隐藏域 value
        │                                      └─→ getCellFieldImage()       ─→ 换背景图 xxx{n}_wev8.png
        └─ 工具栏按钮 justread/canwrite/required ──→ setFieldAttrHover() 读隐藏域回显高亮

【保存】     saveLayout()  ── 清理「模板中已不存在」的字段(置0) ──→ excelLayoutSave.jsp
                                                                    └─ ExcelLayoutManager.doSaveExcelInfo() → modehtmllayout

【预览】     preViewLayout() ── 同一 #LayoutForm ──→ excelPreView.jsp
                                                     └─ redirect → /spa/cube/index.html#/main/cube/card?isPreview=1...
                                                                   └─ 真实运行态渲染（isMustInput: 1可编辑/2必填）
```

---

## 10. 可借鉴的设计要点（对比我们当前的 Univer 实现）

结合本项目 `UniverExcelGrid.tsx` 正在做的同款功能，泛微这套实现有三点尤其值得对齐：

### 10.1 ⭐ 属性按「字段 ID」存，而不是按「单元格坐标」

泛微把状态挂在 `fieldattr{fieldid}` 上，**一个字段一个状态位**；单元格只是它的若干显示位置之一。

我们当前实现是 `cellFieldMetaMap[`${row}_${col}`]`，**按坐标存**。这带来一类结构性风险：
一旦右击取到的坐标与写入坐标不一致（选区漂移、`hitTest` 用了不同实例、菜单点击时鼠标偏移等），
就会「查不到字段元数据 → 点击无反应」——这正是近期排查的那个坑。

**建议**：改为主键 `fieldId → { fieldAttr, cells: [{row,col}...] }`（或至少以 fieldId 为权威、坐标为索引），
属性读写一律走 fieldId，坐标只用于定位显示。同一字段在多个格显示时也能天然保持一致。

### 10.2 视觉用「背景图/图标」而非背景色，且集中在一个函数里算

泛微 `getCellFieldImage(cellobj, fieldattr)` 是**唯一的视觉决策点**，业务强制规则（签字意见恒只读、
标题字段可编辑降级为必填、显示/监控/打印布局统一置灰）全部收敛在这 30 行内。

建议我们也把「字段格长什么样」收敛到单个纯函数 `getFieldCellStyle(fieldMeta, fieldAttr)`，
避免在 `setCellField` / `setFieldAttr` / `loadLayoutData` 三处各写一份上色逻辑导致"切不回去"。

### 10.3 保存前统一清理「已删除字段」的残留状态

泛微 `saveLayout()` 在提交前把模板中已不存在的字段统一置 `0`，避免脏状态堆积。
我们的 `saveLayoutData` 目前是在遍历中按 `isCellValueMatchMeta` 决定是否删除元数据——
思路相近，但可考虑集中成一个显式 `cleanup()` 步骤，便于排查。

### 10.4 预览直接复用运行态

预览不做第二套渲染，只跳转到真实表单页面（带 `isPreview=1`）。
这保证了「设计所见 = 运行所得」，也省掉一整套预览组件的维护成本。
若我们后续做预览，建议同样走「加载已保存布局 + 运行态组件 + preview 标记」的路子。

---

## 11. 保存 / 加载 JSON 结构与「字段元数据失效」处理（深挖）

§1–§9 已讲清**设计态**如何把「只读/可编辑/必填」写进隐藏域。本节补齐**存盘 JSON 长什么样**、**加载时如何还原**、以及**「单元格没有字段元数据」在 e-cology 里到底怎么处理**——这三点直接关系到我们 SpringBlade 侧 `layoutData` 的建模与加载对齐。

### 11.1 元数据「双通道」模型（最关键的存储事实）

「只读/可编辑/必填」状态**和**「单元格绑定哪个字段」是**两条独立的存储通道**，靠 `fieldId` 关联：

| 内容 | 存储位置 | 粒度 |
|---|---|---|
| 单元格绑定哪个字段（含 etype/efieldtype/formula/attrs…） | `datajson` 的 `ec[]` 数组（随模板提交） | **单元格级**（`"行,列"` 为键） |
| 只读 / 可编辑 / 必填（0/1/2/3） | 隐藏域 `input#fieldattr{fieldid}` → 落 `ExcelLayoutManager` 属性表 | **字段级**（再叠加 `nodetype`） |

> ⚠️ **`ec[]` 的每一项里没有 `fieldattr` 字段**。也就是说「属性是挂在字段上的，不是挂在单元格上的」。
> 还原时，单元格只提供 `field`（字段 ID），属性值要从另一条通道（隐藏域）按 `fieldId` 取。
> 这与 §0 的结论一致，但再次强调：加载逻辑必须「由 cell 找到 fieldId → 再查 field 的属性」两步 join。

### 11.2 保存：datajson 结构（`joinSingleCellStr`）

`excelSet.jsp:408-413` 三个载体：`#pluginjson`（SpreadJS 画布 JSON）、`#scripts`，外加 `<div id="hiddenAttrDiv">` 里成批的 `#fieldattr{id}` 隐藏域（§4）。

`designOperate_wev8.js:230` `joinSingleCellStr(sheet, id_x, id_y, ecObj, etype)` 是拼接**单个单元格** JSON 的唯一入口：

```js
230: function joinSingleCellStr(sheet, id_x, id_y, ecObj, etype){
233:     ecs2Json += "\"id\":\""+id_x+","+id_y+"\",";          // "行,列"
238:     ecs2Json += "\"etype\":\""+(!!etype ? etype : 0)+"\",";  // 单元格类型（已转成数字）
240:     if(etype === "2"||"3"||"4"||"5"||"6"||"11"||"18"||"19"){ // 字段类
242:         ecs2Json += "\"field\":\""+ecObj.efieldid+"\",";       // 字段 ID
244:         if(!!ecObj.efieldtype) ecs2Json += "\"fieldtype\":\""+ecObj.efieldtype+"\","; // 控件类型
246:     }else if(etype === "7"){ ecs2Json += "\"detail\":\""+ecObj.edetail+"\","; // 明细表
250:     }else if(etype === "12"){ ... tab ... }                    // 标签页
252:     }else if(etype === "15"||"16"||"17"){ ... jsonparam ... } // 门户/iframe/扫码
257:     if(ecObj.attrs && !isEmptyObject(ecObj.attrs)) ecs2Json += "\"attrs\""+JSON.stringify(ecObj.attrs)+",";
260:     if(etype === "3" && ecObj.enumbric){ ... "\"format\":{...}" ... }  // 数值格式（仅字段内容格）
272:     if(etype === "3" && ecObj.formula) ecs2Json += "\"formula\":\""+ecObj.formula+"\","; // 公式
287:     ecs2Json += "\"font\":{"+parseCellStyleStr(_style)+"},";     // 字体/缩进/背景色（从画布读）
```

- 顶层按 `symbol` 区分：`emaintable` / `detail_N`，含 `rowheads`/`colheads`/`rowattrs`/`colattrs`/`floatingObjectArray`/`backgroundImage`/`ec[]`；
- 明细表额外写 `edtitleinrow`/`edtailinrow`/`edlockedcol`/`seniorset`；
- **`etype` 数字枚举**（`transformerEtype`, `designOperate_wev8.js:3267`）：

  | 数字 | 含义 | 备注 |
  |---|---|---|
  | `1` | 文本 | |
  | `2` | 字段名（FNAME） | 显示标签，不含属性 |
  | `3` | 字段内容（FCONTENT） | **唯一承载「只读/可编辑/必填」的单元格类型** |
  | `4` | 节点名 | |
  | `5` | 流转意见 | |
  | `6` | 图片 | |
  | `7` | 明细表 | |
  | `12/13/15/16/17` | 标签页 / 多内容 / 门户元素 / iframe / 扫码 | |

> 字段名格 `etype=2(FNAME)` 与字段内容格 `etype=3(FCONTENT)` 是**一对**：FNAME 只显示标签、不参与属性设置（§2.2 的 `getFieldREM` 也只对 `FCONTENT` 生效）。这对应我们「标签格 + 字段格」的布局。

### 11.3 加载还原：`resumeCell` / `resumeSheetData`

`designOperate_wev8.js:710` `resumeCell(symbol, cell_obj)` 把 `ec[]` 一项还原回内存缓存 `ecs`：

```js
710: function resumeCell(symbol, cell_obj){
711:     var etype = reverseTransformerEtype(cell_obj.etype);
746:     var cell = {};
747:     cell.etype = etype;  cell.id = cell_obj.id;
750:     if(!isEmptyObject(cell_obj.field))   cell.efieldid   = cell_obj.field;     // ② 绑定字段 ID
752:     if(!isEmptyObject(cell_obj.fieldtype)) cell.efieldtype = cell_obj.fieldtype;
766:     if(!isEmptyObject(cell_obj.attrs))   cell.attrs      = cell_obj.attrs;
770:     setCellProperties(bxid, etype, cell, symbol);          // 写回 ecs 缓存
}
```

`designOperate_wev8.js:776` `resumeSheetData(symbol, excelDiv)` 在画布恢复后，遍历 `ecs` 重绘字段格（含属性背景图）。**真正的「字段元数据缺失」处理就在这里**：

```js
800: if(etype === celltype.FNAME || etype === celltype.FCONTENT || ...){
801:     if(judgeFieldExist(efieldid)){                         // ① 字段在当前表单里还存在吗？
803:         sheet.getCell(r,c,...).value(getFieldName(efieldid));
804:         if(etype === celltype.FCONTENT){
807:             var fieldattr = parseInt(getFieldAttr(efieldid));   // ③ 字段级属性（另一条通道）
808:             if(wfinfo.layouttype == "0" || "3" || "4")  fieldattr = 1;   // ④ 显示/监控/打印 → 强制只读
811:             var bgimage = getCellFieldImage(ecs[cellid], fieldattr);     // ⑤ 见 §5
812:             sheet.getCell(r,c,...).backgroundImage(bgimage);
813:         }
816:     }else{                                                // ② 不存在 → 静默清空该格
817:         baseOperate.cleanCellTextFace(sheet, ecs[cellid], r, c);
818:     }
819: }
```

要点：

1. **`judgeFieldExist(efieldid)`** 判断字段是否还在（换表单 / 模板导入时字段 ID 可能失效）；
2. **不存在 → `cleanCellTextFace` 静默清空内容与属性**，不报错、不弹提示（这正是 e-cology 对「单元格没有字段元数据」的处理——它不提示，而是清理）；
3. 属性来自 `getFieldAttr(efieldid)`（隐藏域，§4），**不是**从 `ec[]` 取；
4. **模板类型覆盖**：`layouttype` 为显示(0)/监控(3)/打印(4) 时，无条件把属性压成 `1`（只读），图片变灰（与 §5 的 `getCellFieldImage` 规则一致）。

### 11.4 选中单元格的判定门控（活跃版）：`controlOperLimits`

§6 已讲「选中 → `setFieldAttrHover` 回显高亮」。这里补上**「没有字段时禁用按钮」**的入口，它也是判断「单元格能否设属性」的门控：

`baseOperate_wev8.js:662` 单元格点击事件：

```js
662: sheet.bind($.wijmo.wijspread.Events.CellClick, function(event, data){
663:     spreadCellClick();      // 改变相关样式选中状态、相关操作权限
664: });
```

```js
3530: function spreadCellClick(){
3532:     var cellid = getSelectedCellid();
3538:     controlOperLimits(row, col);    // 控制字段属性栏 / 插入栏
3539: }

3633: function controlOperLimits(row, col){
3638:     fieldPanel.find("[name=justread],[name=canwrite],[name=required]")
3639:         .removeClass("shortBtn").removeClass("shortBtnHover").addClass("shortBtn_disabled"); // 先全部禁用
3640:     fieldPanel.find("[name=fieldpro],[name=morepro]")
3641:         .removeClass("shortBtn").addClass("shortBtn_disabled");
3643:     if(wfinfo.layouttype == "1" || wfinfo.layouttype == "2"){   // 仅「新建/编辑」布局可设属性
3644:         var _menu_rem = getFieldREM();                            // 见 §2.2：查 ecs[行,列].etype===FCONTENT
3648:         if(isfield || istitlefield || isspecial){                // 命中字段才解禁
3649:             fieldPanel.find("[name=justread]")...removeClass("shortBtn_disabled").addClass("shortBtn");
3651:             if(isfield)  fieldPanel.find("[name=canwrite]")...;
3653:             if(isfield || istitlefield) fieldPanel.find("[name=required]")...;
3654:         }
3656:     }
```

> 与 §2.2 右键菜单的门控**同源**（`getFieldREM` + `layouttype==1||2`）。两路结论一致：
> **无字段元数据的单元格 → `justread/canwrite/required` 全部 `shortBtn_disabled`，系统不赋予任何属性**。
> 这进一步印证：e-cology 对「裸单元格」的态度是「禁用 + 静默」，从不弹「没有字段元数据」之类的提示。

### 11.5 命名陷阱：两个同名 `fieldattr` 不是一回事

`excel_fieldattr.jsp` 文件名含 `fieldattr`，但其页面里的 `<textarea id="fieldattr">` **存的是 SQL 属性公式**，与「只读/可编辑/必填」毫无关系：

```jsp
<!-- excel_fieldattr.jsp:438  注意：这是 SQL 联动公式，不是属性状态 -->
<textarea id="fieldattr" name="fieldattr" rows="7" ...>
```

其 `Ok()`（:176-227）把 `doFieldSQL / doFieldMath / doFieldDate / doFieldMap` 公式写入
`LayoutEditFrameObj.getElementById("fieldsql"+fieldid)`，**不是** `fieldattr{fieldid}` 隐藏域。
而真正的属性状态隐藏域是 `excelSet.jsp:118/151`（§4）里的 `input#fieldattr{fieldid}`，value 仅 `0/1/2/3`。
阅读时务必区分，二者只是恰好叫了同一个名字。

### 11.6 对 SpringBlade 的额外对齐建议（补充 §10）

基于本节「双通道 + 加载失效清理 + 模板类型覆盖」，在 §10.1–10.4 之外补充三点：

1. **加载时补「字段元数据失效静默清理」**：我们 `loadLayoutData` 解析 `layoutData.cellData` 还原 `cellFieldMetaMap` 时，若某格引用的 `fieldId` 已不在当前字段列表（换表单/数据漂移），应**仿 `cleanCellTextFace` 静默清空该格**，而不是保留悬空 meta 或报错。这是 e-cology 有、我们目前缺的一条健壮性逻辑。
2. **补「模板类型覆盖只读」**：预览/显示/打印态应强制 `fieldAttr=1`。可集中在 §10.2 提议的 `getFieldCellStyle` 里，用 `layoutType` 参数压成只读（对应 `resumeSheetData:808` + `getCellFieldImage:3745`）。
3. **「选中单元格没有字段元数据」提示改为禁用**：e-cology 对应行为是禁用按钮 + 静默（§11.4）。我们目前弹提示，建议对齐为「禁用属性按钮，不高亮」——既符合用户心智，也避免阻断其他操作。

---

## 附：本文引用的关键位置速查

| 关注点 | 位置 |
|---|---|
| 菜单容器 | `excelMain.jsp:393` |
| 菜单项生成 | `baseOperate_wev8.js:2612-2649` |
| 菜单可见性门控 | `baseOperate_wev8.js:3857-3892` |
| 菜单点击分发 | `baseOperate_wev8.js:484-535`（三分支 509-527） |
| 核心切换 | `baseOperate_wev8.js:2134-2159` `setFieldPro` |
| 写状态 | `designOperate_wev8.js:4458-4463` `setFieldAttr` |
| 读状态 | `designOperate_wev8.js:4536-4545` `getFieldAttr`（枚举注释） |
| 视觉决策 | `designOperate_wev8.js:3732-3762` `getCellFieldImage` |
| 工具栏回显 | `baseOperate_wev8.js:3842-3852` |
| 隐藏域生成（回填） | `excelSet.jsp:118`（主表）/ `:151`（明细） |
| 隐藏域容器 | `excelSet.jsp:382` `#hiddenAttrDiv` |
| 保存 | `designOperate_wev8.js:4590-4625` → `excelLayoutSave.jsp:47` |
| 预览 | `designOperate_wev8.js:4630-4633` → `excelPreView.jsp:13-18` |
| 运行态判定 | `formmode/view/AddFormModeIframe.jsp:1705-1712` |
| 布局存储表 | `modehtmllayout`（`version=2` 为 Excel 布局，`scriptstr` 存布局数据） |
| 联动存储表 | `modefieldattr`（`attrcontent` 为加密公式） |
| 保存 JSON 拼接 | `designOperate_wev8.js:230` `joinSingleCellStr` |
| etype 数字枚举 | `designOperate_wev8.js:3267` `transformerEtype` |
| 加载还原单格 | `designOperate_wev8.js:710` `resumeCell` |
| 加载重绘字段格 | `designOperate_wev8.js:776` `resumeSheetData`（含 `judgeFieldExist`/模板覆盖） |
| 字段缺失清理 | `designOperate_wev8.js:816` → `baseOperate_wev8.js` `cleanCellTextFace` |
| 选中门控（禁用） | `baseOperate_wev8.js:662`→`3530`→`3633` `controlOperLimits` |
| 隐藏域容器/载体 | `excelSet.jsp:408-413`（`#pluginjson`/`#scripts`/隐藏域） |
| SQL 属性对话框（同名陷阱） | `excel_fieldattr.jsp:438` `#fieldattr` textarea（存 `doFieldSQL/Math/...`） |
