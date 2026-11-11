/**
 * 字段面板：分组与搜索（设计器左侧「字段面板」）
 *
 * 纯逻辑模块：**不依赖 React / 后端 / 字段类型映射表**（components/FormMode/fieldTypes
 * 依赖 dayjs → node stream，无法在浏览器测试环境 import），因此：
 *   · 类型分组标题在本模块内按编码口径维护（编码口径见 fieldTypes 顶部注释）；
 *   · 「具体类型名」（如 人力资源 / 多人力资源）通过 `typeLabel` 回调由调用方注入，
 *     保证搜索能按类型名命中，同时保持本模块可单测。
 */

/** 字段面板分组方式 */
export type FieldGroupMode = 'table' | 'type' | 'usage';

export const FIELD_GROUP_MODE_OPTIONS: { label: string; value: FieldGroupMode }[] = [
  { label: '按明细表', value: 'table' },
  { label: '按类型', value: 'type' },
  { label: '按使用状态', value: 'usage' },
];

/** 分组结果 */
export interface FieldGroup<T = any> {
  /** 分组唯一标识（用于折叠状态记录） */
  key: string;
  /** 分组标题（带数量） */
  title: string;
  /** 分组内的字段 */
  fields: T[];
}

/**
 * 字段类型分组（fieldHtmlType → 组名）。
 * 编码口径：1文本 2多行 3浏览按钮 4选择框 5附件 6复选框 7特殊 8布局（与 fieldTypes 一致）。
 */
const TYPE_GROUPS: { htmlType: number; title: string }[] = [
  { htmlType: 1, title: '文本字段' },
  { htmlType: 2, title: '多行文本' },
  { htmlType: 3, title: '浏览按钮' },
  { htmlType: 4, title: '选择框' },
  { htmlType: 5, title: '附件上传' },
  { htmlType: 6, title: '复选框' },
  { htmlType: 7, title: '特殊字段' },
  { htmlType: 8, title: '布局组件' },
];

const toNum = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** 字段显示名（多来源兜底，与设计器各处口径一致） */
export const getFieldDisplayName = (field: any): string =>
  String(field?.fieldName || field?.fieldDbName || field?.name || field?.columnName || '');

/** 字段显示标签（多来源兜底） */
export const getFieldDisplayLabel = (field: any): string =>
  String(field?.fieldLabel || field?.label || getFieldDisplayName(field) || '未命名字段');

/** 字段所属类型组（未知类型归入「其它字段」） */
export const getFieldTypeGroup = (field: any): { key: string; title: string } => {
  const ht = toNum(field?.fieldHtmlType ?? field?.fieldhtmltype);
  const hit = TYPE_GROUPS.find((g) => g.htmlType === ht);
  return hit ? { key: `type-${hit.htmlType}`, title: hit.title } : { key: 'type-other', title: '其它字段' };
};

/** 按类型分组（保持 TYPE_GROUPS 顺序，未知类型排最后） */
export const groupFieldsByType = <T extends any>(fields: T[]): FieldGroup<T>[] => {
  const map = new Map<string, FieldGroup<T>>();
  const order: string[] = [];
  (fields || []).forEach((f) => {
    const g = getFieldTypeGroup(f);
    if (!map.has(g.key)) {
      map.set(g.key, { key: g.key, title: g.title, fields: [] });
      order.push(g.key);
    }
    map.get(g.key)?.fields.push(f);
  });
  return order.map((k) => map.get(k) as FieldGroup<T>);
};

/** 按使用状态分组：已放置 / 未放置 */
export const groupFieldsByUsage = <T extends any>(
  fields: T[],
  isUsed: (f: T) => boolean,
): FieldGroup<T>[] => {
  const used: T[] = [];
  const unused: T[] = [];
  (fields || []).forEach((f) => {
    if (isUsed(f)) used.push(f);
    else unused.push(f);
  });
  const out: FieldGroup<T>[] = [];
  if (used.length) out.push({ key: 'usage-used', title: `已放置 (${used.length})`, fields: used });
  if (unused.length) out.push({ key: 'usage-unused', title: `未放置 (${unused.length})`, fields: unused });
  return out;
};

/** 按明细表分组（当前作用域内通常只有一组；保留多组能力以兼容「主表 + 明细表」同显） */
export const groupFieldsByTable = <T extends any>(
  fields: T[],
  tableTitle: (f: T) => string,
): FieldGroup<T>[] => {
  const map = new Map<string, FieldGroup<T>>();
  const order: string[] = [];
  (fields || []).forEach((f) => {
    const title = tableTitle(f) || '主表字段';
    if (!map.has(title)) {
      map.set(title, { key: `table-${title}`, title, fields: [] });
      order.push(title);
    }
    map.get(title)?.fields.push(f);
  });
  return order.map((t) => map.get(t) as FieldGroup<T>);
};

/** 字段可搜索文本（标签 / 字段名 / 描述 / 占位符 / 类型名） */
export const buildFieldSearchText = (field: any, typeLabel?: (f: any) => string): string => {
  const parts: any[] = [
    field?.fieldLabel,
    field?.label,
    field?.fieldName,
    field?.fieldDbName,
    field?.description,
    field?.placeholder,
    typeLabel ? typeLabel(field) : '',
    getFieldTypeGroup(field).title,
  ];
  return parts
    .filter((p) => p !== undefined && p !== null && String(p).trim() !== '')
    .map((p) => String(p))
    .join(' ')
    .toLowerCase();
};

/**
 * 搜索匹配：
 *   · 关键词 trim + 大小写不敏感；
 *   · 空格分隔的多个关键词按「AND」命中（同时包含才算匹配）；
 *   · 命中范围：标签 / 字段名 / 描述 / 占位符 / 类型名。
 */
export const matchFieldKeyword = (field: any, keyword: string, typeLabel?: (f: any) => string): boolean => {
  const kw = String(keyword || '').trim().toLowerCase();
  if (!kw) return true;
  const tokens = kw.split(/\s+/).filter(Boolean);
  const text = buildFieldSearchText(field, typeLabel);
  return tokens.every((t) => text.includes(t));
};

/** 按关键词过滤字段 */
export const filterFieldsByKeyword = <T extends any>(
  fields: T[],
  keyword: string,
  typeLabel?: (f: any) => string,
): T[] => (fields || []).filter((f) => matchFieldKeyword(f, keyword, typeLabel));
