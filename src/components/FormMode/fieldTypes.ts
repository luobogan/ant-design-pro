import type { CSSProperties } from 'react';
import type { FieldVariant } from './fieldTokens';
import dayjs from 'dayjs';
import { BROWSER_TYPE_META } from './personOrg';

/**
 * 字段类型编码与中文标签（单一来源）
 *
 * ⚠️ 开发规范：
 *  1. 本文件是**字段类型编码的唯一权威**（编码 A：1文本 2多行 3浏览按钮 4选择框
 *     5附件 6复选框 7特殊字段 8布局）。任何页面不得再自定义一套编码解释。
 *  2. 新增浏览按钮类型：改 `BROWSER_TYPE_LABEL_MAP`（标签）+ `personOrg.ts`
 *     的 `BROWSER_TYPE_META`（数据与单多选），UI 自动支持，页面无需改动。
 *  3. 页面渲染控件一律走 `FieldControl`，不得在页面内自行 switch 类型。
 *
 * 背景：预览页此前面「人力资源 / 多人力资源」等浏览按钮字段显示不出来，根因是
 * 「字段类型编码」在设计器、表设计、后端之间各有一套解释，导致 `fieldhtmltype=3`
 * （浏览按钮）被误判成下拉框，渲染成空 Select —— 看起来就是「什么都没显示」。
 *
 * 本模块把**编码 → 中文标签**、**编码 → 预览控件类型**两件事收敛到一处：
 *  - 设计器拖入字段时（UniverExcelGrid）用它决定 cellType / 控件类型
 *  - 预览页（ExcelPreview）用它把类型还原成「类型标签 + 对应控件」
 *  - 表设计（TableDesign）的「字段类型 / 类型」两列也复用同一套标签，避免显示与下拉不一致
 *
 * 编码体系以 TableDesign.tsx 的下拉项 + 后端 EcologyFormImportServiceImpl 的
 * HTML_* 常量为准（**不是** ecology 原生 fieldhtmltype 编码）：
 *   1=文本字段 2=多行文本 3=浏览按钮 4=选择框 5=附件上传 6=复选框 7=特殊字段 8=布局组件
 */

/** 字段 HTML 类型（fieldHtmlType）→ 中文名（TableDesign「字段类型」列） */
export const FIELD_HTML_TYPE_LABEL_MAP: Record<number, string> = {
  1: '文本字段',
  2: '多行文本',
  3: '浏览按钮',
  4: '选择框',
  5: '附件上传',
  6: '复选框',
  7: '特殊字段',
  8: '布局组件',
  9: '正文',
};

/**
 * 浏览按钮类型（fieldHtmlType=3 时的 fieldType，ecology 35+ 编号空间）。
 * 完整列表，与 BrowserButtonPreview 的 BROWSER_TYPE_CONFIGS 对齐。
 * 单一来源：类型列下拉、回显标签、预览页类型标签均取此表。
 */
export const BROWSER_TYPE_LABEL_MAP: Record<number, string> = {
  1: '人力资源', 161: '多人力资源', 162: '应聘人', 163: '多角色', 165: '人力资源条件', 166: '角色人员',
  167: '分权单人力资源', 168: '分权多人力资源',
  2: '部门', 17: '多部门', 18: '分部', 19: '分权单部门', 20: '分权多部门',
  21: '分权单分部', 22: '分权多分部', 23: '多分部', 25: '办公地点',
  3: '角色', 4: '岗位', 8: '项目', 16: '相关客户',
  24: '文档', 26: '多文档',
  30: '流程', 31: '多流程', 32: '归档流程',
  57: '附件', 7: '资产',
  98: '日期', 99: '时间', 100: '省份', 101: '币种', 102: '城市', 103: '区县', 104: '年份', 105: '语言',
  164: '自定义浏览按钮', 256: '自定义树形单选', 257: '自定义树形多选',
  258: '收发文单位', 259: '多收发文单位',
  260: '秘密等级', 261: '紧急程度', 262: '公文种类', 263: '主题分类', 264: '发文字号',
};

/** 浏览按钮类型下拉展示顺序（先人员、再组织、再其他） */
export const BROWSER_TYPE_ORDER: number[] = [
  1, 161, 162, 163, 165, 166, 167, 168,
  2, 17, 18, 19, 20, 21, 22, 23, 25,
  3, 4, 8, 16,
  24, 26,
  30, 31, 32,
  57, 7,
  98, 99, 100, 101, 102, 103, 104, 105,
  164, 256, 257,
  258, 259,
  260, 261, 262, 263, 264,
];

/** 非浏览按钮的「类型（fieldType）」→ 中文名，按 fieldHtmlType 分组 */
export const FIELD_TYPE_LABEL_MAP: Record<number, Record<number, string>> = {
  // 文本字段
  1: { 1: '单行文本', 2: '多行文本', 3: '保密字段', 4: '整数', 5: '浮点数', 6: '金额转换', 7: '金额千分位' },
  // 多行文本
  2: { 1: '多行文本' },
  // 选择框
  4: { 1: '下拉框', 2: '单选框', 3: '复选框' },
  // 附件上传
  5: { 1: '附件上传', 2: '图片上传' },
  // 复选框
  6: { 1: '复选框' },
  // 特殊字段
  7: { 1: '自定义链接', 2: '描述性文字', 3: '日期', 4: '时间' },
  // 布局组件
  8: { 14: '布局组件' },
};

/** 字段HTML类型（fieldHtmlType）下拉选项（单一来源：1文本 2多行 3浏览按钮 4选择框 5附件 6复选框 7特殊 8布局） */
export const getFieldHtmlTypeOptions = (): { value: number; label: string }[] =>
  Object.keys(FIELD_HTML_TYPE_LABEL_MAP)
    .map((k) => ({ value: Number(k), label: `${k}-${FIELD_HTML_TYPE_LABEL_MAP[Number(k)]}` }))
    .sort((a, b) => a.value - b.value);

/**
 * 「详细类型（fieldType）」下拉选项（单一来源）。
 *
 * <p>- {@code htmlType=3} 浏览按钮：选项即**浏览按钮类型**（ecology 35+ 编号空间），
 * 取 {@link BROWSER_TYPE_ORDER} + {@link BROWSER_TYPE_LABEL_MAP}，与运行时选择器同一编号空间；</p>
 * <p>- 其余 htmlType：取 {@link FIELD_TYPE_LABEL_MAP}[htmlType]。</p>
 *
 * 字段管理等页面一律走此函数，禁止再各写一套编码解释
 * （历史 bug：把 3 浏览按钮当成选择框，导致人力资源字段渲染成空 Select）。
 */
export const getFieldTypeOptions = (htmlType?: number): { value: number; label: string }[] => {
  const ht = Number(htmlType ?? 0);
  if (!ht) return [];
  if (ht === 3) {
    return BROWSER_TYPE_ORDER.map((t) => ({
      value: t,
      label: `${t}-${BROWSER_TYPE_LABEL_MAP[t] ?? '未知'}`,
    }));
  }
  const sub = FIELD_TYPE_LABEL_MAP[ht];
  if (!sub) return [];
  return Object.keys(sub)
    .map((k) => ({ value: Number(k), label: `${k}-${sub[Number(k)]}` }))
    .sort((a, b) => a.value - b.value);
};

/** 预览 / 设计器使用的控件类型（与 FieldControl 的渲染分支一一对应） */
export type ControlType =
  | 'text'
  | 'password'
  | 'textarea'
  | 'number'
  | 'wholeNumber'
  | 'date'
  | 'datetime'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'attachment'
  | 'browser'
  | 'richtext'
  | 'group'
  | 'custom'
  | 'label'
  | 'odoc';

/** 下拉 / 单选 / 复选的选项（`FieldControl` 与 `MobileFieldControl` 共用） */
export interface FieldOption {
  label: string;
  value: any;
}

/**
 * 字段控件统一 props 契约（桌面端 `FieldControl` 与手机端 `MobileFieldControl` **完全一致**）
 *
 * <p>放在本文件（字段类型单一来源）而非具体控件里，有两个目的：</p>
 * <ol>
 *   <li>两端控件共享同一份类型定义，从编译期保证「新增属性必须两端都实现」，
 *       不会出现「桌面端能传、手机端静默忽略」的不一致；</li>
 *   <li>避开 `FieldControl → MobileFieldControl` 的循环依赖：
 *       两端都只依赖本文件，`FieldControl` 单向引用 `MobileFieldControl`。</li>
 * </ol>
 *
 * <p>命名规范：布尔只读属性一律用驼峰 `readOnly`（禁用态用 `disabled`），
 * 与 antd / React 生态一致。`PersonOrgField` 历史遗留的 `readonly`（小写 o）
 * 已在该组件内做兼容映射，新代码不要沿用。</p>
 */
export interface FieldControlBaseProps {
  /** 控件类型（由 mapFieldToControlType(field) 得出） */
  controlType: ControlType;
  /** 当前值 */
  value?: any;
  /** 值变化回调 */
  onChange?: (value: any) => void;
  /** 下拉/单选/复选的选项 */
  options?: FieldOption[];
  /** 禁用（控件不可交互） */
  disabled?: boolean;
  /** 只读（预览态/打印态）：语义上等同禁用，与 disabled 合并生效 */
  readOnly?: boolean;
  /** 占位符 */
  placeholder?: string;
  /** 校验失败红框 */
  status?: '' | 'error';
  /** controlType==='browser' 时的浏览按钮类型 */
  browserType?: number;
  /** 仅 browser 有效；不传时按 isBrowserTypeMultiple 推导 */
  multiple?: boolean;
  /** 文本最大长度（默认 200） */
  maxLength?: number;
  /** textarea 行数（默认 3） */
  rows?: number;
  /** 挂到真实 input 上的 DOM id（供布局级代码块按 id 取/设值） */
  inputId?: string;
  /** 外层样式（字体/底色等，由调用方按单元格或字段属性决定） */
  style?: CSSProperties;
  /**
   * 外观变体：desktop=紧凑表格内｜mobile=触控友好整行｜auto=按视口自动。
   * 默认 'desktop'，保持既有调用行为不变。
   */
  variant?: FieldVariant;
  /**
   * 正文(doc)字段专用：流程实例ID，首次编辑时用于后端初始化正文文档。
   * 由页面层（流程表单）透传；缺失时 OdocField 仅支持「已存在正文」的查看/上传。
   */
  instanceId?: number | string;
  /** 正文(doc)字段专用：流程定义ID */
  defId?: number | string;
  /** 正文(doc)字段专用：字段标题，作为正文文档标题 */
  fieldTitle?: string;
}

/** 日期格式（桌面 / 手机端共用，保证存取格式一致） */
export const DATE_FMT = 'YYYY-MM-DD';
/** 日期时间格式 */
export const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/**
 * 表单值 → antd DatePicker 需要的 dayjs 对象。
 *
 * <p>本工程表单值一律以**字符串**形态存取，而 DatePicker 只接受 dayjs 对象；
 * 直接喂字符串会在 rc-picker 内部抛 `getUDayjs(...).isValid is not a function`，
 * 进而被 ErrorBoundary 接管（整页白屏）。空值/非法值统一给 undefined，交给控件显示空。</p>
 */
export const toDayjsValue = (v: any): any => {
  if (v === undefined || v === null || v === '') return undefined;
  const d = dayjs(v);
  return d.isValid() ? d : undefined;
};

/**
 * DatePicker 选值 → 表单的字符串形态（与 `toDayjsValue` 成对）。
 * 避免把 dayjs 对象序列化进表单快照（会变成 ISO 串，跨时区还会偏移一天）。
 */
export const fromDayjsValue = (d: any, withTime?: boolean): string | undefined =>
  d ? dayjs(d).format(withTime ? DATETIME_FMT : DATE_FMT) : undefined;

const toNum = (v: any, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * 浏览按钮类型编号：
 * `browType`（ecology 35+ 编号空间，优先级最高）> `fieldType`（fieldHtmlType=3 时即浏览按钮类型）。
 */
export const resolveBrowserType = (field: any): number | undefined => {
  if (!field) return undefined;
  const bt = toNum(field.browType ?? field.browtype ?? field.browserType, 0);
  if (bt > 0) return bt;
  const ft = toNum(field.fieldType ?? field.fieldtype, 0);
  if (ft > 0 && toNum(field.fieldHtmlType ?? field.fieldhtmltype, 0) === 3) return ft;
  return undefined;
};

/** 浏览按钮类型 → 中文名（如 1 → 人力资源、161 → 多人力资源）；未知返回 undefined */
export const getBrowserTypeLabel = (type?: number | string): string | undefined => {
  const t = toNum(type, 0);
  return t > 0 ? BROWSER_TYPE_LABEL_MAP[t] : undefined;
};

/**
 * 该浏览按钮类型是否多选。
 *
 * ⚠️ 单一来源：以 `personOrg.ts` 的 `BROWSER_TYPE_META.multiple` 为准（唯一登记表）。
 *    此前本文件另有一份 `MULTI_BROWSER_TYPES` 集合，与 META 双份维护、容易漂移
 *    （如 163 多角色只在 META 里标了 true，靠「标签含多」才兜住）。
 *    未登记的类型（资产/文档/流程等）仍按 ecology 惯例：标签含「多」即多选。
 *
 * 单选代表：人力资源(1) / 部门(2) / 分部(18) / 角色(3) / 岗位(4)
 * 多选代表：多人力资源(161) / 多部门(17) / 多分部(23) / 多角色(163) …
 */
export const isBrowserTypeMultiple = (type?: number | string): boolean => {
  const t = toNum(type, 0);
  if (t <= 0) return false;
  const meta = BROWSER_TYPE_META[t];
  if (meta) return meta.multiple;
  const label = BROWSER_TYPE_LABEL_MAP[t];
  return !!label && label.includes('多');
};

/**
 * 「字段类型 + 类型」→ 中文名（对应 TableDesign 的「类型」列回显）。
 * 例如 (3, 1) → 人力资源、(3, 161) → 多人力资源、(4, 1) → 下拉框。
 */
export const getFieldTypeLabel = (htmlType?: number | string, type?: number | string): string => {
  const ht = toNum(htmlType, 0);
  const t = toNum(type, 0);
  if (!ht) return '请选择';
  if (ht === 3) return getBrowserTypeLabel(t) || `浏览按钮(${t || '-'})`;
  const sub = FIELD_TYPE_LABEL_MAP[ht];
  if (sub && sub[t]) return sub[t];
  return FIELD_HTML_TYPE_LABEL_MAP[ht] || `未知类型(${ht}-${t})`;
};

/**
 * 用后端字段定义回填布局中「类型信息缺失」的单元格元数据（修复历史布局）。
 *
 * 旧版本拖入字段时只存了控件类型（且把 fieldHtmlType=3 浏览按钮误判成下拉框），
 * 没有保存 fieldHtmlType / browserType，于是已保存的布局在预览里
 * 「人力资源 / 多人力资源」等字段只显示一个空下拉框 —— 看上去就是类型信息全丢了。
 *
 * 判定条件：`fieldMeta.fieldHtmlType` 缺失即视为旧数据，此时以后端字段定义为准接管类型信息；
 * 新数据（含 fieldHtmlType）一律不动，避免覆盖用户在属性面板里手动改过的类型。
 */
export function backfillLayoutFieldMeta(layout: any, fields: any[]): any {
  if (!layout || !Array.isArray(fields) || fields.length === 0) return layout;

  const byName = new Map<string, any>();
  const byId = new Map<string, any>();
  fields.forEach((f) => {
    if (!f) return;
    if (f.fieldName != null && f.fieldName !== '') byName.set(String(f.fieldName), f);
    if (f.id != null) byId.set(String(f.id), f);
  });
  if (byName.size === 0 && byId.size === 0) return layout;

  const walkSheets = (sheets: any) => {
    Object.values(sheets || {}).forEach((sheet: any) => {
      const cellData = (sheet as any)?.cellData;
      if (!cellData) return;
      Object.values(cellData).forEach((row: any) => {
        Object.values(row || {}).forEach((cell: any) => {
          const meta = (cell as any)?.fieldMeta;
          if (!meta || meta.cellType !== 'field') return;
          if (Number(meta.fieldHtmlType ?? 0) > 0) return; // 新数据：已有完整类型信息
          const def =
            (meta.fieldId != null ? byId.get(String(meta.fieldId)) : undefined) ||
            byName.get(String(meta.fieldName || ''));
          if (!def) return;
          meta.fieldHtmlType = Number(def.fieldHtmlType ?? def.fieldhtmltype ?? 0) || undefined;
          meta.fieldTypeNum = Number(def.fieldType ?? def.fieldtype ?? 0) || undefined;
          meta.browserType = resolveBrowserType(def);
          meta.fieldType = mapFieldToControlType(def);
        });
      });
    });
  };

  if (layout.sheets) walkSheets(layout.sheets);
  Object.values(layout.detailTables || {}).forEach((dt: any) => {
    if (!dt) return;
    if (dt.sheets) walkSheets(dt.sheets);
    else if (dt.sheetName && dt[dt.sheetName]?.sheets) walkSheets(dt[dt.sheetName].sheets);
    else if (dt.cellData) walkSheets({ sheet: dt });
  });
  return layout;
}

/**
 * 后端字段定义 → 预览控件类型。
 *
 * 关键修正：**浏览按钮（fieldHtmlType=3）必须映射为 `browser`**，
 * 早前按 ecology 原生编码把 3 当成「选择框」，于是人力资源/多人力资源字段被渲染成
 * 无选项的空 Select —— 预览里表现为「类型信息完全没有显示」。
 */
export const mapFieldToControlType = (field: any): ControlType => {
  if (!field) return 'text';
  const htmlType = toNum(field.fieldHtmlType ?? field.fieldhtmltype, 1) || 1;
  const type = toNum(field.fieldType ?? field.fieldtype, 1);

  switch (htmlType) {
    case 1: // 文本字段
      if (type === 2) return 'textarea';
      if (type === 3) return 'password'; // 保密字段
      if (type === 4 || type === 7) return 'wholeNumber';
      if (type === 5 || type === 6) return 'number';
      return 'text';
    case 2: // 多行文本
      return 'textarea';
    case 3: // 浏览按钮（人力资源 / 多人力资源 / 部门 / 角色 …）
      // 日期/时间在 ecology 里同样以「浏览按钮」表达，导入后编号为 98/99，还原成日期控件
      if (type === 98) return 'date';
      if (type === 99) return 'datetime';
      return 'browser';
    case 4: // 选择框
      if (type === 2) return 'radio';
      if (type === 3) return 'checkbox';
      return 'select';
    case 5: // 附件上传
      return 'attachment';
    case 6: // 复选框
      return 'checkbox';
    case 7: // 特殊字段
      if (type === 1) return 'custom';
      if (type === 3) return 'date';
      if (type === 4) return 'datetime';
      return 'text';
    case 8: // 布局组件
      return 'group';
    case 9: // 正文（在线编辑 + 版本管理，OnlyOffice）
      return 'odoc';
    default:
      return 'text';
  }
};

// ============================================================
// E9（泛微 ecology）原生字段类型 ↔ 本项目自有编码 · 双向映射层
// ============================================================
/**
 * 为什么需要这一层
 *
 * 本项目自有编码（1–9，见 `FIELD_HTML_TYPE_LABEL_MAP`）与泛微 E9 原生
 * `fieldhtmltype`（**全集 1–9**，`FieldValue.java` 仅特判 3/4/5/6、其余走 else）
 * **不是同一套编码**，且语义存在错位：
 *
 *  - E9 `8 = 公共选择框(radio)`、`9 = 位置` —— 自有 8/9 却是「布局组件 / 正文」；
 *  - E9 日期/时间用「浏览按钮 3 + fieldType 2/19」表达，本项目用「3 + 98/99」；
 *  - 自有「正文(9) / 布局(8)」在 E9 无直接对应（布局属单元格 etype，正文≈富文本）。
 *
 * 因此**严禁按数字直接等同**。本模块把两套编码的互转收敛到一处（对齐文件头
 * 「单一来源」规范），供：Ecology 表单导入（E9→自有）、导出/对接（自有→E9）、
 * 以及后续通用字段类型服务使用。
 *
 * 设计约束：
 *  1. 纯映射、无副作用，不改动既有 1–9 语义与 `mapFieldToControlType` 行为；
 *  2. 无法无损表达时返回 `lossy: true` 并附 `note`，由调用方决定降级策略，
 *     绝不静默丢信息；
 *  3. E9 `9 位置` 在本项目暂无渲染控件，映射落到「预留类型 10」（见
 *     `E9_POSITION_HTML_TYPE`），渲染支持随后续迭代补齐，不阻塞映射落地。
 */

/** E9 原生 fieldhtmltype 全集（1–9） */
export const E9_FIELD_HTML_TYPE = {
  /** 单行文本（按 fieldType 细分：1文本 2整数 3浮点 4金额转换 5金额千分位） */
  TEXT: 1,
  /** 多行文本（可 isHtmlEditor 富文本） */
  TEXTAREA: 2,
  /** 浏览框（按 fieldType 二次分派：1/17人、2日期、19时间、4/57部门、164分部…） */
  BROWSER: 3,
  /** 复选框（值=1 显示 √） */
  CHECKBOX: 4,
  /** 选择框 select */
  SELECT: 5,
  /** 附件上传 */
  AFFIX: 6,
  /** 特殊字段（fieldType：1 自定义链接 / 其它 描述性文字） */
  ESPECIAL: 7,
  /** 公共选择框 radio */
  PUBLIC_SELECT: 8,
  /** 位置 */
  POSITION: 9,
} as const;

/**
 * E9「位置(9)」在本项目对应的预留自有编码。
 * 当前仅登记映射关系（保证双向可逆），渲染控件待后续迭代补齐。
 */
export const E9_POSITION_HTML_TYPE = 10;

/** 映射结果：E9 侧（`toE9Type` 的返回） */
export interface E9SideMapping {
  /** E9 原生 fieldhtmltype（1–9） */
  e9HtmlType: number;
  /** E9 原生 fieldType（子类型 / 浏览按钮类型） */
  e9FieldType?: number;
  /** E9 浏览按钮类型（e9HtmlType===3 时有效） */
  e9BrowserType?: number;
  /** 存在语义降级时为 true，详见 note；绝不静默丢信息 */
  lossy?: boolean;
  /** 降级/特殊说明 */
  note?: string;
}

/** 映射结果：自有侧（`fromE9Type` 的返回） */
export interface SelfTypeMapping {
  /** 自有编码体系下的 fieldHtmlType（1–9，见 FIELD_HTML_TYPE_LABEL_MAP） */
  htmlType: number;
  /** 自有编码体系下的 fieldType（子类型） */
  type?: number;
  /** 浏览按钮类型（htmlType===3 时有效） */
  browserType?: number;
  /** 存在语义降级时为 true，详见 note */
  lossy?: boolean;
  /** 降级/特殊说明 */
  note?: string;
}

/**
 * 自有编码 → E9 原生编码。
 *
 * @param htmlType     自有 fieldHtmlType（1–9）
 * @param type         自有 fieldType（子类型），可选
 * @param browserType  浏览按钮类型（htmlType===3 时优先使用），可选
 */
export const toE9Type = (
  htmlType?: number | string,
  type?: number | string,
  browserType?: number | string,
): E9SideMapping | null => {
  const ht = Number(htmlType ?? 0) || 0;
  const t = Number(type ?? 0) || 0;
  const bt = Number(browserType ?? 0) || 0;

  switch (ht) {
    case 1: // 文本字段（自有：1单行 2多行 3保密 4整数 5浮点 6金额转换 7金额千分位）
      if (t === 2) return { e9HtmlType: E9_FIELD_HTML_TYPE.TEXTAREA, e9FieldType: 1 };
      if (t === 3)
        return {
          e9HtmlType: E9_FIELD_HTML_TYPE.TEXT,
          e9FieldType: 1,
          lossy: true,
          note: 'E9 无「保密字段」子类型，降级为单行文本；加密需由字段加密能力承载',
        };
      // 4整数→2、5浮点→3、6金额转换→4、7金额千分位→5、默认(1单行)→1
      return {
        e9HtmlType: E9_FIELD_HTML_TYPE.TEXT,
        e9FieldType: t === 4 ? 2 : t === 5 ? 3 : t === 6 ? 4 : t === 7 ? 5 : 1,
      };
    case 2: // 多行文本
      return { e9HtmlType: E9_FIELD_HTML_TYPE.TEXTAREA, e9FieldType: 1 };
    case 3: {
      // 浏览按钮：本项目 98/99 为日期/时间，E9 用 2/19
      const e9Browser = bt || t;
      if (e9Browser === 98) return { e9HtmlType: E9_FIELD_HTML_TYPE.BROWSER, e9FieldType: 2, e9BrowserType: 2 };
      if (e9Browser === 99) return { e9HtmlType: E9_FIELD_HTML_TYPE.BROWSER, e9FieldType: 19, e9BrowserType: 19 };
      return {
        e9HtmlType: E9_FIELD_HTML_TYPE.BROWSER,
        e9FieldType: e9Browser || 1,
        e9BrowserType: e9Browser || 1,
      };
    }
    case 4: // 选择框：1下拉 2单选 3复选
      if (t === 2) return { e9HtmlType: E9_FIELD_HTML_TYPE.PUBLIC_SELECT, e9FieldType: 1 }; // 单选≈公共选择框
      if (t === 3)
        return {
          e9HtmlType: E9_FIELD_HTML_TYPE.CHECKBOX,
          lossy: true,
          note: '多选下拉在 E9 无直接对应，降级为复选框',
        };
      return { e9HtmlType: E9_FIELD_HTML_TYPE.SELECT, e9FieldType: 1 };
    case 5: // 附件上传
      return { e9HtmlType: E9_FIELD_HTML_TYPE.AFFIX, e9FieldType: t === 2 ? 2 : 1 };
    case 6: // 复选框
      return { e9HtmlType: E9_FIELD_HTML_TYPE.CHECKBOX };
    case 7: // 特殊字段：1链接 2描述 3日期 4时间
      if (t === 3) return { e9HtmlType: E9_FIELD_HTML_TYPE.BROWSER, e9FieldType: 2, e9BrowserType: 2 };
      if (t === 4) return { e9HtmlType: E9_FIELD_HTML_TYPE.BROWSER, e9FieldType: 19, e9BrowserType: 19 };
      return { e9HtmlType: E9_FIELD_HTML_TYPE.ESPECIAL, e9FieldType: t === 1 ? 1 : 2 };
    case E9_POSITION_HTML_TYPE: // 预留：位置
      return { e9HtmlType: E9_FIELD_HTML_TYPE.POSITION };
    default:
      // 8 布局组件、9 正文：E9 无直接对应
      return {
        e9HtmlType: E9_FIELD_HTML_TYPE.TEXT,
        lossy: true,
        note: `自有类型 ${ht}（布局/正文）在 E9 无直接对应，降级为单行文本`,
      };
  }
};

/**
 * E9 原生编码 → 自有编码。
 *
 * @param e9HtmlType  E9 fieldhtmltype（1–9）
 * @param e9FieldType E9 fieldType（子类型），可选
 */
/**
 * 判断 E9 侧数据库类型是否像「日期/时间」。
 *
 * 对齐后端 `EcologyFormImportServiceImpl#isDateLike`。必要性：E9 中「部门」与
 * 「日期」同为 TYPE=2，只能靠 dbType 区分，否则会把部门误判成日期。
 */
const isE9DateLike = (dbType?: string): boolean => {
  if (!dbType) return false;
  const r = String(dbType).toLowerCase().replace(/\s+/g, '');
  if (r.includes('date') || r.includes('datetime') || r.includes('smalldatetime')) return true;
  const m = /char\((\d+)\)/.exec(r);
  if (m) {
    const len = Number(m[1]);
    return len >= 8 && len <= 11;
  }
  return false;
};

/**
 * E9 浏览按钮 TYPE → 本项目浏览按钮类型（**实测映射表**）。
 *
 * ⚠️ 必须与后端 `EcologyFormImportServiceImpl#mapBrowserType` 保持一致：
 * 该部署实测语义与 E9 标准字典**不同**（字典 4=文档，实测 4=部门；9/37=文档；
 * 17=多人力资源而非多部门；164=分部而非「自定义浏览按钮」），
 * 因此**禁止照搬标准字典**，一律以实测为准。
 */
const E9_BROWSER_TYPE_MAP: Record<number, number> = {
  1: 1,    // 人员 → 人力资源
  2: 2,    // 组织 → 部门（非日期场景；日期场景走 dbType 分支）
  3: 3,    // 角色
  4: 2,    // 部门（本库 经办部门/报销部门 均用 4）
  7: 8,    // 项目
  8: 7,    // 资产
  9: 24,   // 文档（相关文档/正文/合同文件）
  12: 1,   // 集成 → 无对应项，兜底人力资源
  16: 30,  // 相关客户/流程 → 流程
  17: 161, // 多人力资源（本部署 TYPE=17 表示多人力资源，非多部门）
  18: 18,  // 分部
  19: 19,  // 分权单部门（日期型 19 走上方时间分支）
  20: 20,
  21: 21,
  22: 22,
  23: 23,
  37: 24,  // 文档（自定义：合同文档/PDF 正文）
  164: 18, // 分部（本部署，非「自定义浏览按钮」）
};

export const fromE9Type = (
  e9HtmlType?: number | string,
  e9FieldType?: number | string,
  /** E9 侧数据库类型串（如 char(10)/datetime），用于区分「日期 vs 部门」（二者 TYPE 均为 2） */
  e9DbType?: string,
): SelfTypeMapping | null => {
  const e9 = Number(e9HtmlType ?? 0) || 0;
  const ft = Number(e9FieldType ?? 0) || 0;

  switch (e9) {
    case E9_FIELD_HTML_TYPE.TEXT: // 1 单行文本
      // E9：1文本 2整数 3浮点 4金额转换 5金额千分位
      return { htmlType: 1, type: ft === 2 ? 4 : ft === 3 ? 5 : ft === 4 ? 6 : ft === 5 ? 7 : 1 };
    case E9_FIELD_HTML_TYPE.TEXTAREA: // 2 多行文本
      return { htmlType: 2, type: 1 };
    case E9_FIELD_HTML_TYPE.BROWSER: {
      // 1) 日期/时间优先按 dbType 判定（TYPE=2→日期；TYPE=3/19→时间）
      if (isE9DateLike(e9DbType)) {
        if (ft === 2) return { htmlType: 3, type: 98, browserType: 98 };
        if (ft === 3 || ft === 19) return { htmlType: 3, type: 99, browserType: 99 };
      }
      // 2) 未传 dbType：按 E9 标准语义兜底并标注歧义（调用方应尽量传 dbType）
      if (ft === 2 && e9DbType == null) {
        return {
          htmlType: 3,
          type: 98,
          browserType: 98,
          lossy: true,
          note: '未传 dbType，TYPE=2 按「日期」处理；若实际为部门请传 dbType 消歧',
        };
      }
      if (ft === 19 && e9DbType == null) {
        return {
          htmlType: 3,
          type: 99,
          browserType: 99,
          lossy: true,
          note: '未传 dbType，TYPE=19 按「时间」处理；若实际为分权单部门请传 dbType 消歧',
        };
      }
      const mapped = E9_BROWSER_TYPE_MAP[ft];
      const browserType = mapped ?? (ft || 1);
      return {
        htmlType: 3,
        type: browserType,
        browserType,
        lossy: mapped == null && ft > 0,
        note: mapped == null && ft > 0 ? `未知浏览按钮类型 ${ft}，按原值兜底` : undefined,
      };
    }
    case E9_FIELD_HTML_TYPE.CHECKBOX: // 4 复选框
      return { htmlType: 6, type: 1 };
    case E9_FIELD_HTML_TYPE.SELECT: // 5 选择框
      return { htmlType: 4, type: 1 };
    case E9_FIELD_HTML_TYPE.AFFIX: // 6 附件
      return { htmlType: 5, type: 1 };
    case E9_FIELD_HTML_TYPE.ESPECIAL: // 7 特殊字段
      return { htmlType: 7, type: ft === 1 ? 1 : 2 };
    case E9_FIELD_HTML_TYPE.PUBLIC_SELECT: // 8 公共选择框(radio) → 复用自有「选择框+单选」
      return { htmlType: 4, type: 2, lossy: true, note: 'E9 公共选择框复用自有「选择框(4)+单选(2)」表达' };
    case E9_FIELD_HTML_TYPE.POSITION: // 9 位置 → 预留自有类型 10
      return {
        htmlType: E9_POSITION_HTML_TYPE,
        lossy: true,
        note: 'E9 位置字段在本项目暂无渲染控件，映射至预留类型 10，渲染待补齐',
      };
    default:
      return null;
  }
};
