# 字段控件体系（FormMode Field Controls）

> 全项目**唯一**的字段控件渲染层。页面层禁止自行 `switch` 字段类型。

## 1. 分层架构

```
页面 / 容器层（负责布局、权限、校验外壳）
  ExcelPreview.FieldCell        Excel 网格 <td> + 单元格样式 + 节点权限
  FormView.FieldRenderer        数据详情页：只读降级 + placeholder 文案
  TableDesign.BrowserTypePreview 表设计页：类型预览
        │  都只调用 FieldControl，不感知具体控件
        ▼
统一入口 FieldControl（按 variant 分发）
  ├── variant='desktop'（默认）→ 本文件内的桌面实现（size=small，适配 120px 窄单元格）
  ├── variant='mobile'         → MobileFieldControl（40px 高 / 16px 字号 / 开关化 / 纵向单选）
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

| `controlType` | 桌面 | 手机 |
| --- | --- | --- |
| `text` / `password` | `Input` / `Input.Password` | 同左（字号 16px） |
| `textarea` | `Input.TextArea` | 同左（默认 4 行） |
| `number` / `wholeNumber` | `InputNumber` | 同左 |
| `date` / `datetime` | `DatePicker` | 同左（格式一致） |
| `select` | `Select` | `Select` + 加大 `listItemHeight/listHeight` 防误触 |
| `radio` | `Radio.Group` 横排 | `Radio.Group` **纵排** |
| `checkbox` | `Checkbox`（"同意"） | **`Switch` 开关** + 是/否 文案 |
| `browser` | `BrowserControl` | 复用 `BrowserControl`（选人逻辑只有一份） |
| `attachment` | 小按钮 `Upload` | 整行虚线上传区 |
| `richtext` / `group` / `custom` / `label` | 展示型，无交互 | 同左（字号放大） |
| 未知类型 | 兜底 `Input` | 兜底 `Input` |

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

### 5.2 强制手机端（如移动端 H5 容器内）

```tsx
<FieldControl controlType="text" value={v} onChange={setV} variant="mobile" />
```

### 5.3 响应式（推荐：同一份代码适配两端）

```tsx
<FieldControl controlType="select" options={opts} value={v} onChange={setV} variant="auto" />
```

`variant='auto'` 时，组件内部用 `useIsMobileViewport()`（`matchMedia` + `useSyncExternalStore`）
订阅断点变化，**跨断点自动重渲染**，无需刷新页面。

### 5.4 只读态与校验红框

```tsx
<FieldControl controlType="browser" browserType={1} readOnly value={value} />
// 值语义统一：checkbox 为单布尔；browser 为 id 逗号串；date 为 'YYYY-MM-DD'
```

### 5.5 新增一种字段类型

1. `fieldTypes.ts`：加进 `ControlType` 联合类型 + `mapFieldToControlType()` 的映射分支；
2. `FieldControl.tsx` 与 `MobileFieldControl.tsx`：**两端都要**加 `case`（props 类型共用，
   TS 会在你只改一端时提示缺少分支）；
3. 若涉新浏览按钮类型：再改 `personOrg.ts` 的 `BROWSER_TYPE_META` + `fieldTypes.ts` 的
   `BROWSER_TYPE_LABEL_MAP`，UI 自动支持；
4. 需要新尺寸/配色时，只在 `fieldTokens.ts` 增加令牌，不在控件里写魔法值。

## 6. 设计令牌速查（`fieldTokens.ts`）

| 令牌 | 桌面 | 手机 | 依据 |
| --- | --- | --- | --- |
| `controlSize` | `small`(24px) | `middle` + `minHeight:40px` | 40px 更易点中 |
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