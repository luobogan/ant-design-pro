# 字段控件体系（FormMode Field Controls）

> 全项目**唯一**的字段控件渲染层。页面层禁止自行 `switch` 字段类型。
>
> **技术栈**：桌面端 = antd 6；手机端 = [ant-design-mobile 5](https://ant-design-mobile.antgroup.com/zh/guide/quick-start)。
> 两端共用同一份 props 契约，由 `FieldControl` 的 `variant` 分发。

## 1. 分层架构

```
页面 / 容器层（负责布局、权限、校验外壳）
  ExcelPreview.FieldCell        Excel 网格 <td> + 单元格样式 + 节点权限
  FormView.FieldRenderer        数据详情/新增/编辑页：只读降级 + placeholder 文案（默认 auto）
  TableDesign.BrowserTypePreview 表设计页：类型预览
        │  都只调用 FieldControl，不感知具体控件、不感知 antd / antd-mobile
        ▼
统一入口 FieldControl（按 variant 分发）
  ├── variant='desktop'（默认）→ 本文件内的 antd 实现（size=small，适配 120px 窄单元格）
  ├── variant='mobile'         → MobileFieldControl（antd-mobile：滚轮选择 / Switch / 触控尺寸）
  └── variant='auto'           → useIsMobileViewport() 视口 ≤768px 自动选 mobile
        │
        ▼
子控件 BrowserControl（浏览按钮：单/多选语义 + 类型标签 + 降级）→ PersonOrgField（选人/选组织）
```

**单一来源**

| 关注点 | 唯一来源 | 说明 |
| --- | --- | --- |
| 字段类型编码 → 中文标签 | `fieldTypes.ts` | `FIELD_HTML_TYPE_LABEL_MAP` / `BROWSER_TYPE_LABEL_MAP` |
| 字段类型编码 → 控件类型 | `fieldTypes.ts` | `mapFieldToControlType()` |
| 两端统一 props 契约 | `fieldTypes.ts` | `FieldControlBaseProps` |
| 控件实现 | `FieldControl.tsx`（桌面）/ `MobileFieldControl.tsx`（手机） | 新增类型改这两个文件 |
| 选人/选组织数据与选中逻辑 | `PersonOrgPicker.tsx` | 两端共用同一份 state，只切 UI |
| 浏览按钮类型元信息 | `personOrg.ts` | `BROWSER_TYPE_META`（含单/多选） |
| 颜色 / 字号 / 触控尺寸 | `fieldTokens.ts` | 禁止在页面或控件里写魔法值 |

## 2. 命名规范

- 只读属性统一驼峰 **`readOnly`**（禁用态用 `disabled`，二者合并生效）。
  历史遗留的 `readonly`（小写 o）仅在 `PersonOrgField` / `FieldRenderer` 上保留 `@deprecated` 别名兼容，**新代码不要沿用**。
- 字段类型枚举统一为 `ControlType`（camelCase 字符串），不出现第二套编码解释。
- 日期值统一以**字符串**存取（`YYYY-MM-DD` / `YYYY-MM-DD HH:mm:ss`），由 `fieldTypes.ts` 的
  `toDayjsValue` / `fromDayjsValue` 与 antd `DatePicker` 互转。
  ⚠️ 不可把 dayjs 对象塞进表单值：会在 rc-picker 内部抛错并被 ErrorBoundary 接管成白屏。

## 3. 属性说明

### `FieldControlProps`（= `fieldControlBaseProps`，桌面/手机完全一致）

| 属性 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `controlType` | `ControlType` | 必填 | 控件类型，由 `mapFieldToControlType(field)` 得出 |
| `value` | `any` | - | 当前值 |
| `onChange` | `(v:any)=>void` | - | 值变化回调 |
| `options` | `FieldOption[]` | `[]` | 下拉/单选/复选选项，`{label,value}` |
| `disabled` | `boolean` | - | 禁用 |
| `readOnly` | `boolean` | - | 只读（预览态/打印态），与 `disabled` 等价 |
| `placeholder` | `string` | - | 占位符 |
| `status` | `'' \| 'error'` | - | 校验失败红框 |
| `browserType` | `number` | - | 仅 `browser`：E9 浏览按钮类型编号 |
| `multiple` | `boolean` | - | 仅 `browser`；不传按 `isBrowserTypeMultiple()` 推导 |
| `maxLength` | `number` | `200` | 文本最大长度 |
| `rows` | `number` | `3`(桌面)/`4`(手机) | textarea 行数 |
| `inputId` | `string` | - | 挂到真实 input 的 DOM id，供布局级代码块取/设值 |
| `style` | `CSSProperties` | - | 外层样式（承载 Excel 单元格底色/字体），**优先级最高** |
| `variant` | `'desktop'\|'mobile'\|'auto'` | `'desktop'` | 外观变体，见下 |

### `BrowserControlProps`

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `browserType` | `number` | E9 编号（1 人力资源 / 2 部门 / 3 角色 / 4 岗位 / 18 分部 …） |
| `value` / `onChange` | `any` / fn | 值（E9 为 id 逗号串） |
| `disabled` / `readOnly` | `boolean` | 禁用 / 只读 |
| `multiple` | `boolean` | 覆盖单/多选（默认按类型语义） |
| `showTypeTag` | `boolean` | 是否显示「人力资源/部门…」类型标签，默认 `true` |

### `FieldVariant`

| 值 | 行为 |
| --- | --- |
| `'desktop'` | 紧凑控件（`size=small`，13px），适配 Excel 网格窄单元格 |
| `'mobile'` | 触控友好控件（40px 高、16px 字号、复选框→开关、单选纵排、整行附件上传区） |
| `'auto'` | 视口宽度 ≤768px 时按 `mobile` 渲染，否则 `desktop`；**窗口缩放/旋屏实时响应** |

## 4. 两端渲染对照

手机端基于 **ant-design-mobile 5**（`MobileFieldControl.tsx`）实现，与桌面端（antd）**类型映射一致、值语义完全一致**，仅交互形态适配触屏：

| `controlType` | 桌面（antd） | 手机（antd-mobile） |
| --- | --- | --- |
| `text` | `Input` | `Input`（16px、带边框圆角、`clearable`） |
| `password` | `Input.Password` | `Input type="password"` |
| `textarea` | `Input.TextArea` | `TextArea`（`showCount`） |
| `number` / `wholeNumber` | `InputNumber` | `Input inputMode="decimal"/"numeric"`（antd-mobile 无 InputNumber；`Stepper` 步进器不适合金额录入） |
| `date` / `datetime` | `DatePicker` 下拉 | `DatePicker` **底部滚轮弹层**（`precision="day"/"second"`） |
| `select` | `Select` 下拉 | `Picker` **底部滚轮单选** |
| `radio` | `Radio.Group` 横排 | `Radio` **纵排**（antd-mobile 无 `Radio.Group`，手动管理选中） |
| `checkbox` | `Checkbox`（"同意"） | **`Switch` 开关** |
| `browser` | `BrowserControl` | 复用 `BrowserControl`，弹窗切为 **antd-mobile 底部弹层** |
| `attachment` | `Upload` + 小按钮 | `Upload` + **整行虚线上传区** |
| `richtext` / `group` / `custom` / `label` | 展示型，无交互 | 同左（字号放大） |
| 未知类型 | 兜底 `Input` | 兜底 `Input` |

**值语义不变**（重要）：`checkbox` 仍是单布尔；`browser` 仍是 id 逗号串；`date` 仍是 `YYYY-MM-DD`、`datetime` 仍是 `YYYY-MM-DD HH:mm:ss`。换组件库不会导致已存数据读取不到。

### 4.1 antd-mobile 主题对齐

antd-mobile 通过 CSS 变量定制主题，`MobileFieldControl` 首次渲染时注入一次（`data-fm-adm-field` 标记，全局只注入一次）：

```css
:root {
  --adm-color-primary: #1677ff;   /* 对齐 antd 主色，否则手机端是 adm 默认蓝 */
  --adm-color-text: #333333;
  --adm-color-border: #d9d9d9;
  ...
}
```

同时补回 antd-mobile 刻意「不画」的输入框边框（见 4.2）。

### 4.2 为什么要给 `.adm-input` 补边框

antd-mobile 的 `Input` 默认**无边框 + 透明背景**——它的设计依赖外层 `List`/`Form` 的分隔线来界定输入区域。而本项目手机端是白底卡片 + 无分隔线的流式布局，裸输入框会**完全看不见边界**（实测 `.adm-input` 计算样式为 `border: 0px solid rgba(0,0,0,0.88)`、`background: transparent`）。

因此 `MobileFieldControl` 在作用域内补回：`border:1px solid #d9d9d9; border-radius:6px; padding:8px 12px; background:#fff`，高度约 **44px**，满足触控目标。

同理：`.adm-switch` 放大到 36px（默认 31px 偏小）、`.adm-radio` 字号设为 16px（默认 14px 偏小）。

### 4.3 错误态

antd-mobile 的 `Input` **没有** antd 的 `status` 属性，只能通过 CSS 覆盖边框色：

```css
.fm-adm-field--error .adm-input,
.fm-adm-field--error .adm-text-area,
.fm-adm-field--error .fm-adm-trigger { border-color: #ff4d4f !important; }
```

### 4.4 日期/下拉触发器

`DatePicker` 与 `Picker` 都是**弹层**组件（不渲染输入框），通过 `children` render-prop 拿到 `actions.open()` 自制触发器，并做成与输入框一致的外观（`.fm-adm-trigger`：40px 高、边框、圆角、右侧 ▼ 箭头）。

⚠️ `inputId` 在该场景挂在**触发器 div**上（而非真实 input，因为 antd-mobile 的 Picker 没有原生 input）。布局级代码块用 `getElementById` 仍可定位，但 `getElementById(id).value` 取不到值——需要读文本或改用 `window.ExcelPreview.get/set`（字段名方式）。

## 4.5 浏览按钮弹窗（人力资源 / 部门 / 分部 / 角色 / 岗位）

`browser` 类型字段的选人/选组织弹窗同样按 `variant` 双端切换，**数据加载、搜索防抖、分页、选中集合、名称反查全部共用同一套 state**（都在 `PersonOrgPicker` 组件内），仅 UI 形态不同——保证同一字段在两端选出**完全相同**的结果。

| | 桌面端（antd） | 手机端（antd-mobile） |
| --- | --- | --- |
| 容器 | `Modal` 780px 居中 | `Popup position="bottom"`（82vh）+ `NavBar` |
| 部门分类 | 左侧 200px `Tree` | `Selector` 横向胶囊（全部 + 一级部门），深层部门用搜索定位 |
| 列表 | `Table` + 分页器 | `CheckList` + 「加载更多」（分页器在触屏上极难点中） |
| 搜索 | `Input` + prefix 图标 | `SearchBar` |
| 已选区 | 底部 `Tag` 列表 | 固定底部、可逐项移除 |
| 空提示 | antd `Empty` | antd-mobile `Empty` |
| 校验提示 | antd `message` | antd-mobile `Toast` |

**值语义不变**：值仍是 **id 逗号串**（如 `"123,456"`），显示名由 `resolveItemNames` 反查；多选/单选由 `isBrowserTypeMultiple(browserType)` 决定。

**variant 透传链**（新增 `browser` 相关属性时两端都要走这条链）：

```
FieldControl(variant)            → 'mobile' 时整体转交 MobileFieldControl
  └─ MobileFieldControl          → 手机端实现，browser 分支显式传 variant="mobile"
       └─ BrowserControl(variant) → 透传给 PersonOrgField
            └─ PersonOrgField(variant) → 按端调整触发器尺寸/按钮文案
                 └─ PersonOrgPicker(variant) → isMobile 分支返回手机 UI，否则桌面 UI
```

⚠️ `MobileFieldControl` 的 browser 分支**必须显式传 `variant="mobile"`**：该组件只在手机端被渲染，若不传，`BrowserControl` 会用默认 `'desktop'`，弹出 780px 宽的 antd Modal（在手机上溢出屏幕）。

## 5. 使用示例

### 5.1 桌面端（默认）

```tsx
import FieldControl from '@/components/FormMode/FieldControl';
import { mapFieldToControlType, resolveBrowserType } from '@/components/FormMode/fieldTypes';

<FieldControl
  controlType={mapFieldToControlType(field)}   // 'text' | 'browser' | 'date' | ...
  browserType={resolveBrowserType(field)}
  value={value}
  onChange={setValue}
  options={field.options?.map(o => ({ label: o.label, value: o.value }))}
  maxLength={field.fieldLen || 200}
  readOnly={isPreview}
  status={error ? 'error' : ''}
/>
```

### 5.2 强制手机端（antd-mobile 控件）

```tsx
<FieldControl controlType="text" value={v} onChange={setV} variant="mobile" />
```

### 5.3 响应式（推荐：同一份代码适配两端）

```tsx
<FieldControl controlType="select" options={opts} value={v} onChange={setV} variant="auto" />
```

`variant='auto'` 时，组件内部用 `useIsMobileViewport()`（`matchMedia` + `useSyncExternalStore`）
订阅断点变化，**跨断点自动重渲染**，无需刷新页面。宽屏走 antd 紧凑控件，≤768px 走
antd-mobile 触屏控件。

### 5.4 只读态与校验红框

```tsx
<FieldControl controlType="browser" browserType={1} readOnly value={value} />
// 值语义统一：checkbox 为单布尔；browser 为 id 逗号串；date 为 'YYYY-MM-DD'
```

### 5.5 页面级容器用 `FieldRenderer`（已默认 auto）

```tsx
// 表单数据详情/新增/编辑、流程测试页 —— 无需传 variant，默认随视口切换
<FieldRenderer field={field} value={v} onChange={setV} readOnly />
```

### 5.6 新增一种字段类型

1. `fieldTypes.ts`：加进 `ControlType` 联合类型 + `mapFieldToControlType()` 的映射分支；
2. `FieldControl.tsx`（antd）与 `MobileFieldControl.tsx`（antd-mobile）：**两端都要**加
   `case`（props 类型共用 `FieldControlBaseProps`，TS 会在只改一端时提示）；
3. 若涉新浏览按钮类型：再改 `personOrg.ts` 的 `BROWSER_TYPE_META` + `fieldTypes.ts` 的
   `BROWSER_TYPE_LABEL_MAP`，UI 自动支持；
4. 需要新尺寸/配色时，只在 `fieldTokens.ts` 增加令牌，不在控件里写魔法值；
5. antd-mobile 特有主题色改 `MobileFieldControl.tsx` 的 `ensureAdmStyles()`。

## 6. 设计令牌速查（`fieldTokens.ts`）

| 令牌 | 桌面（antd） | 手机（antd-mobile） | 依据 |
| --- | --- | --- | --- |
| 控件高度 | 24px（`size=small`） | 输入框 ≈44px / 触发器 40px / 开关 36px | 触控目标 ≥40px |
| `controlFontSize` | 13 | **16** | <16px 时 iOS Safari 聚焦输入框会自动放大页面 |
| `labelFontSize` | 13 | 14 | 可读性 |
| `radioDirection` | 横向 | 纵向 | 窄屏横排会换行错位 |

配色统一取 `FIELD_COLOR`：`label/value/border/required/readOnlyBg/readOnlyBorder/readOnlyText/requiredBg/sectionBg/cardBorder/gridLine`。

## 7. 注意事项

- 手机端**不会**自动切换：`ExcelPreview` 顶部的「自动/PC/手机」切换器决定用哪种布局；
  `MobileSheetForm`（手机列表化布局）内部已固定传 `variant='mobile'`。
- `attrBg`（`fieldAttr`：1 只读灰底 / 3 必填浅红底）由调用方计算并经 `style` 传入，
  优先级高于控件自身背景，见 `fieldTokens.attrBackground()`。
- `ExcelPreview` 的 Excel 单元格样式（背景/字体/边框）也通过 `style` 下发；
  AntD 控件**不继承 `<td>` 的 font**，需显式下发字体/字号/字重（已在容器层处理）。