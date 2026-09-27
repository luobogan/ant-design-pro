/**
 * 字段类型编码与中文标签（单一来源）
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
];

/** 非浏览按钮的「类型（fieldType）」→ 中文名，按 fieldHtmlType 分组 */
const FIELD_TYPE_LABEL_MAP: Record<number, Record<number, string>> = {
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

/** 预览 / 设计器使用的控件类型（与 ExcelPreview 的渲染分支一一对应） */
export type ControlType =
  | 'text'
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
  | 'label';

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
 * 多选的浏览按钮类型：只有「多…」类才是多选。
 * 单选：人力资源(1) / 部门(2) / 分部(18) / 角色(3) / 岗位(4)
 * 多选：多人力资源(161) / 多部门(17) / 多分部(23) / 多角色(163) …
 */
const MULTI_BROWSER_TYPES: ReadonlySet<number> = new Set([
  161, 168, 17, 20, 22, 23, 163, 166, 26, 31,
]);

/** 该浏览按钮类型是否多选（对齐 ecology：带「多」字样的才可多选） */
export const isBrowserTypeMultiple = (type?: number | string): boolean => {
  const t = toNum(type, 0);
  if (t <= 0) return false;
  if (MULTI_BROWSER_TYPES.has(t)) return true;
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
    default:
      return 'text';
  }
};
