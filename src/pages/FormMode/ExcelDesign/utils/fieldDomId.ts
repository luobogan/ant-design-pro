/**
 * 预览 DOM id 命名方案（供「布局级代码块」中的 JS 直接访问与操作）。
 *
 * ── 命名规则 ──────────────────────────────────────────────
 *   id = excelp_{scope}_{kind}_{name}[_{dup}]
 *
 *   scope  作用域，由表单值 key 推导（见 parseScope）：
 *            main            主表
 *            dt{idx}_r{row}  第 idx 个明细表、第 row 行（均从 0 开始）
 *   kind    fd = 字段控件（可输入）  lb = 字段名/表头（标签格）
 *   name    fieldName（无则取 fieldLabel），经 safeIdPart 规范化
 *   dup     同一作用域内同名时依次为 _2、_3 …（保证 id 唯一）
 *
 *   例：
 *     excelp_main_fd_xm                主表「姓名」字段控件
 *     excelp_main_lb_姓名              主表「姓名」表头
 *     excelp_dt1_r0_fd_je              明细表1 第1行「金额」控件
 *     excelp_dt1_r0_lb_金额            明细表1 第1行「金额」表头
 *     excelp_main_fd_xm_2              主表内第 2 个同名字段
 *
 *   另有控件级 id（挂在真正的 input/textarea 上，便于直接取/设值）：
 *     {容器 id}__input
 *
 * ── 为什么用 keyPrefix 推导 scope ──────────────────────────
 * 预览里表单值 key 本身就是「作用域 + 单元格」：
 *   主表      {sheetId}__{row}__{col}
 *   明细表行  dt{idx}__r{n}__{sheetId}__{row}__{col}
 * 因此 renderCellNode 拿到 key 即可推出 scope，无需再透传明细表序号/行号。
 *
 * ── 挂载的元素属性 ─────────────────────────────────────────
 *   id                    规范化的唯一 id
 *   data-excelp-role      field | label
 *   data-excelp-scope     main | dt{idx}_r{row}
 *   data-excelp-field     原始字段名（未规范化，供属性选择器精确匹配）
 *   data-excelp-dt        明细表序号（仅明细表）
 *   data-excelp-row       明细表行号（仅明细表）
 *
 * 用 data-* 而非 id 做查询，可避免中文/特殊字符在 querySelector 中的转义问题。
 */

/** id 前缀，避免与页面其他元素冲突 */
export const DOM_ID_PREFIX = 'excelp';

export type FieldDomRole = 'field' | 'label';

export type FieldDomIds = {
  /** 容器 id（字段格 / 表头格外层元素，必定存在） */
  id: string;
  /** 可输入控件 id（文本类控件才有；其余类型控件内仍有 input 可查） */
  inputId: string;
  /** 作用域：main 或 dt{idx}_r{row} */
  scope: string;
  /** 明细表序号（主表为 undefined） */
  dt?: number;
  /** 明细表行号（主表为 undefined） */
  row?: number;
  /** 原始字段名（未规范化） */
  fieldName: string;
  /** 单元格类型 */
  kind: FieldDomRole;
};

/**
 * 规范化为可安全用于 HTML id 的片段：
 * 保留 Unicode 字母（含中文）/ 数字 / 下划线 / 连字符，其余（空白、点、冒号、
 * # 等在 querySelector 中敏感的字符）统一折叠为下划线。
 */
export const safeIdPart = (raw: string): string => {
  const s = String(raw ?? '').trim();
  if (!s) return 'noname';
  const out = s
    .replace(/\s+/g, '_')
    .replace(/[^\p{L}\p{N}_-]/gu, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
  return out || 'noname';
};

/**
 * 从表单值 key 解析作用域：
 *   dt{idx}__r{n}__… → { scope: 'dt{idx}_r{n}', dt: idx, row: n }
 *   其余             → { scope: 'main' }
 */
export const parseScope = (valueKey: string): { scope: string; dt?: number; row?: number } => {
  const m = /^dt(\d+)__r(\d+)__/.exec(valueKey || '');
  if (m) return { scope: `dt${m[1]}_r${m[2]}`, dt: Number(m[1]), row: Number(m[2]) };
  return { scope: 'main' };
};

/** 字段名优先，其次表头文字（表头格的 fieldName 通常为空） */
const baseName = (meta: any): string => String(meta?.fieldName || meta?.fieldLabel || '').trim();

/** 单元格 DOM id 组；非字段/表头格返回 null */
export const buildFieldDomIds = (meta: any, valueKey: string, dupSuffix = ''): FieldDomIds | null => {
  if (!meta) return null;
  const kind: FieldDomRole = meta.cellType === 'label' ? 'label' : 'field';
  const name = baseName(meta);
  if (!name) return null;
  const { scope, dt, row } = parseScope(valueKey);
  const kindTag = kind === 'label' ? 'lb' : 'fd';
  const id = `${DOM_ID_PREFIX}_${scope}_${kindTag}_${safeIdPart(name)}${dupSuffix}`;
  return { id, inputId: `${id}__input`, scope, dt, row, fieldName: name, kind };
};

/** 生成挂在元素上的 data-* 属性（供 querySelector 精确匹配） */
export const domDataProps = (ids: FieldDomIds): Record<string, any> => ({
  'data-excelp-role': ids.kind,
  'data-excelp-scope': ids.scope,
  'data-excelp-field': ids.fieldName,
  ...(ids.dt !== undefined ? { 'data-excelp-dt': ids.dt } : {}),
  ...(ids.row !== undefined ? { 'data-excelp-row': ids.row } : {}),
});

/**
 * 为一个 sheet 内所有「字段格 / 表头格」预生成 DOM id。
 * 返回：表单值 key → id 组（renderCellNode 用同一个 key 查询，天然对齐）。
 * 同一「作用域 + 类型 + 名称」重复出现时追加 _2、_3 … 保证 id 全局唯一。
 */
export const buildDomIdMap = (sheet: any, keyPrefix?: string): Record<string, FieldDomIds> => {
  const map: Record<string, FieldDomIds> = {};
  const used = new Map<string, number>();
  const cellData = sheet?.cellData || {};
  Object.keys(cellData).forEach((r) => {
    Object.keys(cellData[r] || {}).forEach((c) => {
      const meta = cellData[r]?.[c]?.fieldMeta;
      if (!meta) return;
      if (meta.cellType !== 'field' && meta.cellType !== 'label') return;
      const valueKey = `${keyPrefix ?? ''}${sheet.id ?? ''}__${r}__${c}`;
      if (!baseName(meta)) return;
      const { scope } = parseScope(valueKey);
      const baseKey = `${scope}|${meta.cellType}|${baseName(meta)}`;
      const n = (used.get(baseKey) ?? 0) + 1;
      used.set(baseKey, n);
      const ids = buildFieldDomIds(meta, valueKey, n > 1 ? `_${n}` : '');
      if (ids) map[valueKey] = ids;
    });
  });
  return map;
};

// ──────────────────────────────────────────────
// 代码块可用的全局访问器：window.ExcelPreview
// ──────────────────────────────────────────────
export type FieldQuery = {
  /** 明细表序号（从 0 开始）；不传表示主表 */
  dt?: number;
  /** 明细表行号（从 0 开始），默认 0 */
  row?: number;
};

const attrEscape = (v: string) => String(v).replace(/["\\]/g, '\\$&');

const scopeOf = (opts?: FieldQuery) =>
  opts?.dt != null ? `dt${opts.dt}_r${opts.row ?? 0}` : 'main';

const sel = (role: FieldDomRole, name: string, opts?: FieldQuery) =>
  `[data-excelp-role="${role}"][data-excelp-scope="${scopeOf(opts)}"][data-excelp-field="${attrEscape(name)}"]`;

/** React 受控组件：必须用原生 setter 赋值再派发事件，否则 onChange 不触发 */
const setNativeValue = (el: any, value: any) => {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  desc?.set?.call(el, value == null ? '' : String(value));
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
};

/** 在容器内定位真正的可输入控件 */
const findControl = (wrap: Element | null): any =>
  wrap ? wrap.querySelector('input:not([type="hidden"]), textarea') : null;

/**
 * 安装 window.ExcelPreview（预览挂载时调用，返回清理函数）。
 * 代码块中即可：
 *   ExcelPreview.get('xm')            // 读主表「xm」字段值
 *   ExcelPreview.set('xm', '张三')     // 写值（会触发 React onChange）
 *   ExcelPreview.set('je', 100, { dt: 0, row: 0 })
 *   ExcelPreview.labelEl('姓名').style.display = 'none'
 *   ExcelPreview.list({ dt: 0, row: 0 })
 */
export const installFieldDomApi = (): (() => void) => {
  const api = {
    /** 字段控件容器 */
    wrap: (name: string, opts?: FieldQuery) => document.querySelector(sel('field', name, opts)),
    /** 表头 / 字段名元素 */
    labelEl: (name: string, opts?: FieldQuery) => document.querySelector(sel('label', name, opts)),
    /** 可输入控件（input / textarea） */
    control: (name: string, opts?: FieldQuery) => findControl(api.wrap(name, opts)),
    /** 读值 */
    get: (name: string, opts?: FieldQuery) => {
      const c = api.control(name, opts);
      return c ? (c as any).value : undefined;
    },
    /** 写值（触发 React onChange；Select/Radio 等复合控件请用原生事件另行处理） */
    set: (name: string, value: any, opts?: FieldQuery) => {
      const c = api.control(name, opts);
      if (!c) return false;
      setNativeValue(c, value);
      return true;
    },
    /** 列出该作用域下所有字段（name / 是否可输入 / 元素） */
    list: (opts?: FieldQuery) =>
      Array.from(
        document.querySelectorAll(`[data-excelp-role="field"][data-excelp-scope="${scopeOf(opts)}"]`),
      ).map((el) => ({
        name: el.getAttribute('data-excelp-field') || '',
        wrap: el,
        control: findControl(el),
        value: (findControl(el) || {}).value,
      })),
    /** 明细表当前行数（按 r{n} 作用域统计） */
    rowCount: (dt: number) =>
      new Set(
        Array.from(document.querySelectorAll(`[data-excelp-dt="${dt}"]`)).map((el) =>
          el.getAttribute('data-excelp-row'),
        ),
      ).size,
  };
  (window as any).ExcelPreview = api;
  return () => {
    delete (window as any).ExcelPreview;
  };
};
