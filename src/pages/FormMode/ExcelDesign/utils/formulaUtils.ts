/**
 * Excel 布局公式求值（运行期 / 预览态）。
 *
 * 参考泛微 E9：公式是**前端计算**（`formulaNew_wev8.js:319,373-374` 用 eval(formulatxt)、
 * `formcalculate_wev8.js:235` 用 eval），后端只做配置持久化与结果入库。本项目同样在
 * 运行期前端求值，但**不使用 eval / new Function**（E9 的 eval 在布局脚本可控时存在注入风险），
 * 改为受限的递归下降解析器：仅支持单元格/区域/字段引用 + 白名单函数 + 四则与比较运算。
 *
 * 数据流：设计器把公式表达式写入 cellData[r][c].f（Univer 的 f），预览时本模块按
 * formValues（坐标键 `${sheetId}__${row}__${col}`）求值，把结果写回该格 v 供 HTML 表格渲染。
 * 支持公式引用公式（DFS + cache + 循环检测），字段值变化即触发重算。
 */

import { numberToChineseCapital } from './amountChinese';

export interface FormulaCell {
  v?: any;
  f?: string;
  [key: string]: any;
}

export type CellData = Record<string, Record<string, FormulaCell>>;

export type CellGetter = (row: number, col: number) => any;
export type FieldGetter = (name: string) => any;

type Token =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'id'; v: string }
  | { t: 'field'; v: string }
  | { t: 'op'; v: string }
  | { t: 'lp' | 'rp' | 'comma' | 'colon' };

const FUNCTIONS = new Set([
  'SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'ROUND', 'ABS', 'IF', 'INT', 'LEN', 'AND', 'OR',
  // E9 自定义函数库的常用等价（formcalculate_wev8.js 的 formulaNew 函数表）
  'CONCAT', 'CONCATENATE', 'MOD', 'SQRT', 'POWER', 'CEILING', 'FLOOR', 'TRIM', 'ISBLANK', 'NOT',
  // 金额大写（E9 numberChangeToChinese）
  'RMB',
]);

const ERR = {
  CYCLE: '#CYCLE!',
  DIV0: '#DIV/0!',
  VALUE: '#VALUE!',
  NAME: '#NAME?',
  NUM: '#NUM!',
  ERROR: '#ERROR!',
} as const;

const isErr = (v: any): boolean =>
  typeof v === 'string' && /^#[A-Z0-9/!?]+!?$/.test(v);

/** 列字母 → 0-based 列索引：A=0, Z=25, AA=26 */
export const columnToIndex = (letters: string): number => {
  let n = 0;
  const s = letters.toUpperCase();
  for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
  return n - 1;
};

/** 解析 A1 形式引用 → 0-based {row,col} */
export const parseCellRef = (ref: string): { row: number; col: number } | null => {
  const m = /^([A-Za-z]+)(\d+)$/.exec(ref);
  if (!m) return null;
  const col = columnToIndex(m[1]);
  const row = Number(m[2]) - 1;
  return col >= 0 && row >= 0 ? { row, col } : null;
};

const tokenize = (src: string): Token[] => {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let s = '';
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\' && i + 1 < src.length) { s += src[i + 1]; i += 2; }
        else s += src[i++];
      }
      i++;
      out.push({ t: 'str', v: s });
      continue;
    }
    if (ch === '$' && src[i + 1] === '{') {
      const end = src.indexOf('}', i + 2);
      if (end > 0) {
        out.push({ t: 'field', v: src.slice(i + 2, end).trim() });
        i = end + 1;
        continue;
      }
    }
    if (/[0-9.]/.test(ch)) {
      const m = /^\d+(\.\d+)?/.exec(src.slice(i));
      if (m) { out.push({ t: 'num', v: Number(m[0]) }); i += m[0].length; continue; }
    }
    if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
      if (m) { out.push({ t: 'id', v: m[0] }); i += m[0].length; continue; }
    }
    const two = src.slice(i, i + 2);
    if (['>=', '<=', '<>', '!='].includes(two)) { out.push({ t: 'op', v: two }); i += 2; continue; }
    if ('+-*/^()=>,<:'.includes(ch)) {
      const t: Token = ch === '(' ? { t: 'lp' }
        : ch === ')' ? { t: 'rp' }
          : ch === ',' ? { t: 'comma' }
            : ch === ':' ? { t: 'colon' }
              : { t: 'op', v: ch };
      out.push(t);
      i++;
      continue;
    }
    throw new Error(`非法字符 ${ch}`);
  }
  return out;
};

const toNum = (v: any): number => {
  if (isErr(v)) return NaN;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const flatten = (args: any[]): any[] =>
  args.reduce<any[]>((acc, a) => acc.concat(Array.isArray(a) ? flatten(a) : [a]), []);

/** 自定义函数解析器：按函数名返回可调用实现；未定义返回 undefined（按 #NAME? 处理） */
export type CustomFunctionResolver = (name: string) => ((...args: any[]) => any) | undefined;

/**
 * 编译自定义函数的实现代码（对标 E9 workflow_formula.fncode）。
 *
 * <p>支持三种写法：`function NAME(a,b){...}` / `function(a,b){...}` / `(a,b)=>...`。
 * 代码由**表单设计者**在「自定义函数」弹框里维护（与 E9 的 eval 同构），因此必须收敛作用域：
 * 屏蔽 window / document / fetch / storage 等宿主对象，避免定义体直接触达 DOM 与网络。</p>
 *
 * <p><b>残余风险</b>：JS 无法真正沙箱（仍可经 globalThis / 构造器链绕回宿主对象）。
 * 故自定义函数被限定在「表单设计者为可信配置人」的场景，风险等级与 E9 一致；
 * 与下方「公式表达式不使用 eval」的策略分属两个面：表达式来自布局、代码来自函数库。</p>
 */
export const compileCustomFunction = (code: string): ((...args: any[]) => any) | undefined => {
  const src = String(code || '').trim();
  if (!src) return undefined;
  try {
    const factory = new Function(
      'window', 'document', 'globalThis', 'self', 'top', 'parent', 'location',
      'fetch', 'XMLHttpRequest', 'navigator', 'localStorage', 'sessionStorage',
      'indexedDB', 'WebSocket', 'Worker', 'importScripts', 'eval', 'Function',
      // ⚠️ 这里**不能**加 "use strict"：严格模式禁止 eval / arguments 作形参名，
      //    而 eval / Function 恰是必须遮蔽的对象（否则定义体可直接拿到全局构造器）。
      //    故改为「形参遮蔽 + null 原型 this」双重收敛作用域。
      `return (${src});`,
    );
    const fn = factory(
      undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined,
    );
    if (typeof fn !== 'function') return undefined;
    // this 绑到无原型对象：定义体里的 this.fetch / this.window 均不可达
    return (fn as (...args: any[]) => any).bind(Object.create(null));
  } catch {
    return undefined;
  }
};

/**
 * 由后端 workflow_formula 定义构建自定义函数解析器。
 * 同名以最后一条为准；编译失败（代码非法）的条目直接跳过（调用时按 #NAME? 处理）。
 */
export const buildCustomFunctionResolver = (
  customs?: CustomFormula[] | null,
): CustomFunctionResolver => {
  const map = new Map<string, (...args: any[]) => any>();
  (customs || []).forEach((c) => {
    const name = String(c?.name || '').trim();
    if (!name) return;
    const fn = compileCustomFunction(c?.fnCode || '');
    if (fn) map.set(name.toUpperCase(), fn);
  });
  return (name: string) => map.get(String(name || '').toUpperCase());
};

/** 递归下降解析器：comparison → additive → multiplicative → power → unary → primary */
class Parser {
  private i = 0;

  constructor(
    private toks: Token[],
    private getCell: CellGetter,
    private getField: FieldGetter,
    /** 自定义函数（后端 workflow_formula）；未内置的函数名先查这里 */
    private customFns?: CustomFunctionResolver,
  ) {}

  parse(): any {
    const v = this.comparison();
    if (this.i < this.toks.length) throw new Error('多余内容');
    return v;
  }

  private peek(): Token | undefined { return this.toks[this.i]; }
  private eat(t: Token['t'], v?: string): boolean {
    const p = this.peek();
    if (!p || p.t !== t || (v !== undefined && (p as any).v !== v)) return false;
    this.i++;
    return true;
  }

  private comparison(): any {
    let left = this.additive();
    const p = this.peek();
    if (p && p.t === 'op' && ['=', '>', '<', '>=', '<=', '<>', '!='].includes(p.v)) {
      this.i++;
      const right = this.additive();
      if (isErr(left)) return left;
      if (isErr(right)) return right;
      const a = toNum(left), b = toNum(right);
      switch (p.v) {
        case '>': return a > b;
        case '<': return a < b;
        case '>=': return a >= b;
        case '<=': return a <= b;
        case '<>': case '!=': return a !== b;
        default: return a === b;
      }
    }
    return left;
  }

  private additive(): any {
    let left = this.multiplicative();
    for (;;) {
      const p = this.peek();
      if (!p || p.t !== 'op' || (p.v !== '+' && p.v !== '-')) break;
      this.i++;
      const right = this.multiplicative();
      if (isErr(left)) { continue; }
      if (isErr(right)) { left = right; continue; }
      left = p.v === '+' ? toNum(left) + toNum(right) : toNum(left) - toNum(right);
    }
    return left;
  }

  private multiplicative(): any {
    let left = this.power();
    for (;;) {
      const p = this.peek();
      if (!p || p.t !== 'op' || (p.v !== '*' && p.v !== '/')) break;
      this.i++;
      const right = this.power();
      if (isErr(left)) { continue; }
      if (isErr(right)) { left = right; continue; }
      const b = toNum(right);
      if (p.v === '/' && b === 0) { left = ERR.DIV0; continue; }
      left = p.v === '*' ? toNum(left) * b : toNum(left) / b;
    }
    return left;
  }

  private power(): any {
    let left = this.unary();
    const p = this.peek();
    if (p && p.t === 'op' && p.v === '^') {
      this.i++;
      const right = this.power();
      if (isErr(left)) return left;
      if (isErr(right)) return right;
      return toNum(left) ** toNum(right);
    }
    return left;
  }

  private unary(): any {
    const p = this.peek();
    if (p && p.t === 'op' && (p.v === '-' || p.v === '+')) {
      this.i++;
      const v = this.unary();
      if (isErr(v)) return v;
      return p.v === '-' ? -toNum(v) : toNum(v);
    }
    return this.primary();
  }

  private primary(): any {
    const p = this.peek();
    if (!p) throw new Error('表达式不完整');
    if (p.t === 'num') { this.i++; return p.v; }
    if (p.t === 'str') { this.i++; return p.v; }
    if (p.t === 'field') { this.i++; return this.getField(p.v) ?? 0; }
    if (p.t === 'lp') {
      this.i++;
      const v = this.comparison();
      if (!this.eat('rp')) throw new Error('缺少右括号');
      return v;
    }
    if (p.t === 'id') {
      this.i++;
      const upper = p.v.toUpperCase();
      // 函数调用
      if (this.peek()?.t === 'lp') {
        const known = FUNCTIONS.has(upper);
        // 自定义函数（workflow_formula）：内置表里没有、但函数库里有 → 走自定义实现
        const custom = known ? undefined : this.customFns?.(upper);
        this.i++;
        const args: any[] = [];
        if (!this.eat('rp')) {
          do {
            // 区域引用 A1:B3 必须在消耗参数 token **之前**判定：
            // 否则起点 A1 已被 comparison() 解析成单元格值，只剩函数名 token 可用，
            // 会把 parseCellRef('SUM') 判为非法 → #NAME?（此前 SUM(A2:A3) 不计算的根因）。
            const start = this.peek();
            const maybeColon = this.toks[this.i + 1];
            const end = this.toks[this.i + 2];
            if (start?.t === 'id' && maybeColon?.t === 'colon' && end?.t === 'id') {
              this.i += 3;
              const from = parseCellRef(start.v);
              const to = parseCellRef(end.v);
              if (from && to) {
                const cells: any[] = [];
                for (let r = Math.min(from.row, to.row); r <= Math.max(from.row, to.row); r++) {
                  for (let c = Math.min(from.col, to.col); c <= Math.max(from.col, to.col); c++) {
                    cells.push(this.getCell(r, c));
                  }
                }
                args.push(cells);
              } else {
                args.push(ERR.NAME);
              }
            } else {
              args.push(this.comparison());
            }
          } while (this.eat('comma'));
          if (!this.eat('rp')) throw new Error('缺少右括号');
        }
        // 自定义函数：参数原样传入（不做 flatten，区域引用需保持数组形态）
        if (custom) {
          try {
            const r = custom(...args);
            return r === undefined || r === null ? 0 : r;
          } catch {
            return ERR.ERROR;
          }
        }
        // 未知函数：参数已正常消耗，返回 #NAME? 而不是被 parse() 判为「多余内容」→ #ERROR!
        if (!known) return ERR.NAME;
        return applyFunction(upper, args);
      }
      // 单元格引用
      const ref = parseCellRef(p.v);
      if (ref) return this.getCell(ref.row, ref.col);
      if (upper === 'TRUE') return 1;
      if (upper === 'FALSE') return 0;
      return ERR.NAME;
    }
    throw new Error('无法解析的表达式');
  }
}

const applyFunction = (name: string, args: any[]): any => {
  const flat = flatten(args);
  const nums = flat.filter((v) => !isErr(v) && v !== '' && v !== null && v !== undefined).map(toNum);
  switch (name) {
    case 'SUM': return nums.reduce((a, b) => a + b, 0);
    case 'AVERAGE': return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    case 'MIN': return nums.length ? Math.min(...nums) : 0;
    case 'MAX': return nums.length ? Math.max(...nums) : 0;
    case 'COUNT': return nums.length;
    case 'ROUND': {
      const x = toNum(flat[0]);
      const d = flat.length > 1 ? Math.trunc(toNum(flat[1])) : 0;
      const f = 10 ** d;
      return Math.round(x * f) / f;
    }
    case 'ABS': return Math.abs(toNum(flat[0]));
    case 'INT': return Math.trunc(toNum(flat[0]));
    case 'LEN': return String(flat[0] ?? '').length;
    case 'IF': return toNum(flat[0]) !== 0 ? (flat[1] ?? '') : (flat[2] ?? '');
    case 'AND': return flat.every((v) => toNum(v) !== 0) ? 1 : 0;
    case 'OR': return flat.some((v) => toNum(v) !== 0) ? 1 : 0;
    case 'NOT': return toNum(flat[0]) === 0 ? 1 : 0;
    case 'CONCAT':
    case 'CONCATENATE':
      return flat.map((v) => (v === null || v === undefined ? '' : String(v))).join('');
    case 'MOD': {
      const b = toNum(flat[1]);
      if (b === 0) return ERR.DIV0;
      return toNum(flat[0]) % b;
    }
    case 'SQRT': {
      const x = toNum(flat[0]);
      if (x < 0) return ERR.NUM;
      return Math.sqrt(x);
    }
    case 'POWER': return toNum(flat[0]) ** toNum(flat[1]);
    case 'CEILING': return Math.ceil(toNum(flat[0]) * 1e8) / 1e8;
    case 'FLOOR': return Math.floor(toNum(flat[0]) * 1e8) / 1e8;
    case 'TRIM': return String(flat[0] ?? '').trim();
    case 'ISBLANK': {
      const v = flat[0];
      return v === undefined || v === null || v === '' ? 1 : 0;
    }
    // 金额大写（E9 numberChangeToChinese）
    case 'RMB': return numberToChineseCapital(flat[0]);
    default: return ERR.NAME;
  }
};

/** 求单个公式表达式；出错返回 Excel 风格错误串，不抛异常到渲染层 */
export const evaluateFormula = (
  expression: string,
  getCell: CellGetter,
  getField: FieldGetter = () => 0,
  customFns?: CustomFunctionResolver,
): any => {
  const src = String(expression || '').trim().replace(/^=/, '');
  if (!src) return '';
  try {
    return new Parser(tokenize(src), getCell, getField, customFns).parse();
  } catch {
    return ERR.ERROR;
  }
};

export const isFormulaValue = (v: any): boolean =>
  typeof v === 'string' && /^\s*=/.test(v);

/**
 * 公式格配置（与布局 JSON 同名落库，字段级）。
 *
 * <p>对齐 E9 `workflow_formula_htmllayout` 的 `destcell`（公式结果写入的目标字段）与
 * 「公式触发动作」（焦点/失焦/单击/双击/移入/移出/值改变）：</p>
 * <ul>
 *   <li>{@code destField} 公式结果写入的字段名（E9 destfield）；</li>
 *   <li>{@code trigger} 触发时机；</li>
 *   <li>{@code chinese} 结果是否以金额大写显示。</li>
 * </ul>
 */
export interface FormulaConfig {
  /** 公式名称（对齐 E9 workflow_formula_htmllayout.name） */
  name?: string;
  /** 公式描述（对齐 E9 formuladesc） */
  desc?: string;
  destField?: string;
  trigger?: FormulaTrigger;
  chinese?: boolean;
  /**
   * 本条公式的表达式（E9 一格多公式）。
   *
   * <p>主公式（列表第 1 条）的表达式存放在单元格的 {@code cellData.f}（Univer 公式），
   * 这里只在**附加公式**（第 2 条起）里冗余保存表达式，便于一条 Cell 同时承载多条公式。</p>
   */
  expr?: string;
}

/**
 * 读取单元格的公式配置列表（对齐 E9「公式列表」：一格可配多条公式）。
 *
 * <p>兼容两种落库形态：</p>
 * <ul>
 *   <li>新形态：{@code cell.formulaCfgs} 数组（含主条，index 0 为主公式）；</li>
 *   <li>旧形态：{@code cell.formulaCfg} 单条（历史数据，视为唯一一条）。</li>
 * </ul>
 */
export const getFormulaConfigs = (cell: any): FormulaConfig[] => {
  if (!cell || typeof cell !== 'object') return [];
  const list = (cell as any).formulaCfgs;
  if (Array.isArray(list) && list.length) {
    return list.filter(Boolean).map((x: any) => ({ ...x }));
  }
  const single = (cell as any).formulaCfg;
  if (single && typeof single === 'object') return [{ ...single }];
  return [];
};

/** 函数分类（对齐 E9 workflow_formula_type）：供公式弹框右侧函数面板分类/搜索 */
export interface FormulaFunctionDef {
  name: string;
  group: string;
  desc: string;
}

/** 自定义函数（对齐 E9 workflow_formula 表） */
export interface CustomFormula {
  id?: number;
  /** 函数名（公式中引用的名称，如 MYFUNC） */
  name: string;
  /** 函数描述 */
  formulaDesc?: string;
  /** 分类（公式面板分组名） */
  category: string;
  /** 函数实现（JS 代码 / 公式规则） */
  fnCode: string;
  /** 作用域：空=全局，或具体表单ID */
  formScope?: string | null;
  /** 状态（1正常 0禁用） */
  status?: number;
}

export const FORMULA_FUNCTION_GROUPS: { group: string; label: string; items: FormulaFunctionDef[] }[] = [
  { group: 'common', label: '常用函数', items: [
    { name: 'SUM', group: 'common', desc: '求和：SUM(A1:A10)' },
    { name: 'AVERAGE', group: 'common', desc: '平均值：AVERAGE(A1:A10)' },
    { name: 'IF', group: 'common', desc: '条件判断：IF(A1>0, 1, 0)' },
    { name: 'COUNT', group: 'common', desc: '计数：COUNT(A1:A10)' },
    { name: 'MAX', group: 'common', desc: '最大值：MAX(A1:A10)' },
    { name: 'MIN', group: 'common', desc: '最小值：MIN(A1:A10)' },
    { name: 'ROUND', group: 'common', desc: '四舍五入：ROUND(A1, 2)' },
  ] },
  { group: 'math', label: '数学与三角函数', items: [
    { name: 'ABS', group: 'math', desc: '绝对值：ABS(A1)' },
    { name: 'INT', group: 'math', desc: '取整：INT(A1)' },
    { name: 'MOD', group: 'math', desc: '取余：MOD(A1, B1)' },
    { name: 'SQRT', group: 'math', desc: '平方根：SQRT(A1)' },
    { name: 'POWER', group: 'math', desc: '幂：POWER(A1, 2)' },
    { name: 'CEILING', group: 'math', desc: '向上取整：CEILING(A1)' },
    { name: 'FLOOR', group: 'math', desc: '向下取整：FLOOR(A1)' },
  ] },
  { group: 'text', label: '文本', items: [
    { name: 'CONCAT', group: 'text', desc: '拼接文本：CONCAT(A1, B1)' },
    { name: 'CONCATENATE', group: 'text', desc: '拼接文本：CONCATENATE(A1, B1)' },
    { name: 'LEN', group: 'text', desc: '文本长度：LEN(A1)' },
    { name: 'TRIM', group: 'text', desc: '去首尾空格：TRIM(A1)' },
  ] },
  { group: 'logic', label: '逻辑', items: [
    { name: 'AND', group: 'logic', desc: '逻辑与：AND(A1>0, B1>0)' },
    { name: 'OR', group: 'logic', desc: '逻辑或：OR(A1>0, B1>0)' },
    { name: 'NOT', group: 'logic', desc: '逻辑非：NOT(A1>0)' },
    { name: 'ISBLANK', group: 'logic', desc: '是否为空：ISBLANK(A1)' },
  ] },
  { group: 'finance', label: '财务', items: [
    { name: 'RMB', group: 'finance', desc: '金额大写：RMB(A1)' },
  ] },
];

/** 公式弹框保存前校验：返回错误文案，null 表示通过（对齐 E9 formulaStores.checkFormula 的核心规则） */
export const validateFormulaExpression = (expr: string): string | null => {
  const src = String(expr || '').trim();
  if (!src) return '公式内容不能为空';
  if (!src.startsWith('=')) return '公式必须以 = 开头';
  let depth = 0;
  for (const ch of src) {
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth < 0) return '括号不匹配：多了一个右括号';
    }
  }
  if (depth !== 0) return `括号不匹配：缺少 ${depth} 个右括号`;
  return null;
};

/** 公式触发时机（对齐 E9 的 7 种触发动作 + 载入时） */
export type FormulaTrigger =
  | 'change' // 值改变 / 载入时（全量重算已覆盖）
  | 'focus'
  | 'blur'
  | 'click'
  | 'dblclick'
  | 'mouseenter'
  | 'mouseleave';

/** 触发时机 → DOM 事件名（渲染层据此挂事件） */
export const FORMULA_TRIGGER_EVENT: Record<FormulaTrigger, string> = {
  change: '',
  focus: 'focus',
  blur: 'blur',
  click: 'click',
  dblclick: 'dblclick',
  mouseenter: 'mouseenter',
  mouseleave: 'mouseleave',
};

/** 触发时机下拉项（设计器属性面板 / 插入弹窗共用） */
export const FORMULA_TRIGGER_OPTIONS: { label: string; value: FormulaTrigger }[] = [
  { label: '值改变 / 载入时（全量重算）', value: 'change' },
  { label: '获得焦点', value: 'focus' },
  { label: '失去焦点', value: 'blur' },
  { label: '单击', value: 'click' },
  { label: '双击', value: 'dblclick' },
  { label: '移入', value: 'mouseenter' },
  { label: '移出', value: 'mouseleave' },
];

/**
 * 读取单元格的公式配置（缺省 → 空对象）。
 *
 * <p>优先取公式列表首条（主公式）；旧数据只有 {@code cell.formulaCfg} 时等价于单条列表。</p>
 */
export const getFormulaConfig = (cell: any): FormulaConfig => {
  if (!cell || typeof cell !== 'object') return {};
  const list = getFormulaConfigs(cell);
  return list[0] || {};
};

/** 是否为公式格（有表达式或值以 = 开头） */
export const isFormulaCell = (cell: any): boolean => {
  if (!cell) return false;
  const f = String(cell.f || '').trim();
  if (f) return true;
  return isFormulaValue(cell.v);
};

/**
 * 对整张 sheet 求值：把所有公式格（cell.f，或 v 以 = 开头的旧数据）的 v 替换为计算结果。
 * 返回**新的 cellData**（不改原布局对象），供 ExcelPreview 的 sheets useMemo 使用。
 * 公式可引用其它公式格（DFS），循环引用返回 #CYCLE!。
 *
 * @param keyPrefix 表单值命名空间前缀（主表 ''；明细行 'dt1__r0__'）
 */
export const resolveSheetFormulas = (
  cellData: CellData,
  sheetId: string,
  formValues: Record<string, any> = {},
  keyPrefix = '',
  customFns?: CustomFunctionResolver,
): CellData => {
  const formulas = new Map<string, string>();
  Object.entries(cellData || {}).forEach(([rk, row]) => {
    Object.entries(row || {}).forEach(([ck, cell]) => {
      const f = String(cell?.f || '').trim();
      const expr = f || (isFormulaValue(cell?.v) ? String(cell.v).trim() : '');
      if (expr) formulas.set(`${rk}_${ck}`, expr);
    });
  });
  if (!formulas.size) return cellData;

  const cache = new Map<string, any>();
  const visiting = new Set<string>();

  // 字段名 → 坐标：让 `${字段名}` 引用能定位到布局中的字段格（E9 公式用字段名引用）
  const coordByField = new Map<string, string>();
  Object.entries(cellData || {}).forEach(([rk, row]) => {
    Object.entries(row || {}).forEach(([ck, cell]) => {
      const fn = (cell as any)?.fieldMeta?.fieldName;
      if (fn && !coordByField.has(String(fn))) coordByField.set(String(fn), `${rk}_${ck}`);
    });
  });

  const cellValue = (r: number, c: number): any => {
    // 运行期表单值优先（字段控件当前值），其次布局里的静态值
    const fv = formValues[`${keyPrefix}${sheetId}__${r}__${c}`];
    if (fv !== undefined && fv !== null && fv !== '') return fv;
    return cellData[String(r)]?.[String(c)]?.v ?? 0;
  };

  const evalCell = (r: number, c: number): any => {
    const key = `${r}_${c}`;
    const expr = formulas.get(key);
    if (!expr) return cellValue(r, c);
    if (cache.has(key)) return cache.get(key);
    if (visiting.has(key)) return ERR.CYCLE;
    visiting.add(key);
    const result = evaluateFormula(
      expr,
      (rr, cc) => evalCell(rr, cc),
      (name) => {
        // ① 字段名键（提交载荷口径）
        const direct = formValues[name];
        if (direct !== undefined && direct !== null && direct !== '') return direct;
        // ② 布局中该字段所在格的当前值
        const coord = coordByField.get(name);
        if (coord) {
          const [rk, ck] = coord.split('_');
          return evalCell(Number(rk), Number(ck));
        }
        return 0;
      },
      customFns,
    );
    visiting.delete(key);
    cache.set(key, result);
    return result;
  };

  const next: CellData = {};
  Object.entries(cellData || {}).forEach(([rk, row]) => {
    next[rk] = { ...row };
  });
  formulas.forEach((expr, key) => {
    const [rk, ck] = key.split('_');
    const r = Number(rk), c = Number(ck);
    const result = evalCell(r, c);
    next[rk] = next[rk] || {};
    next[rk][ck] = {
      ...(next[rk][ck] || {}),
      f: expr,
      v: result === '' ? ' ' : result,
    };
  });
  return next;
};

/**
 * 求单个公式格的当前值（供「触发动作」用：焦点/失焦/单击… 触发时立即算一次）。
 */
export const evaluateFormulaCell = (
  cellData: CellData,
  sheetId: string,
  row: number,
  col: number,
  formValues: Record<string, any> = {},
  keyPrefix = '',
  customFns?: CustomFunctionResolver,
): any => {
  const resolved = resolveSheetFormulas(cellData, sheetId, formValues, keyPrefix, customFns);
  const v = resolved?.[String(row)]?.[String(col)]?.v;
  return v === undefined ? 0 : v;
};

/**
 * 收集「公式结果 → 目标字段」的映射（对齐 E9 `getFormulaNew` 把 destfield 并入可保存字段）。
 *
 * <p>E9 的做法：查 `workflow_formula_htmllayout` 的 `destcell`（如 `["main.34403"]`），
 * 把 destcell 里的字段 id 并入「可保存字段清单」，再由后端把公式结果写进该字段。
 * 本项目等价物：布局 `cellData[r][c].formulaCfg.destField`（字段名），
 * 计算结果按字段名写入提交载荷 / 业务表列。</p>
 *
 * @param layoutData 布局（主表 + detailTables）
 * @param values     当前表单值（坐标键命名空间）
 * @returns 目标字段名 → 公式计算结果
 */
export const collectFormulaResults = (
  layoutData: any,
  values: Record<string, any>,
  customFns?: CustomFunctionResolver,
): Record<string, any> => {
  const out: Record<string, any> = {};
  if (!layoutData) return out;

  const scan = (layout: any, keyPrefix: string, outKeyPrefix: string) => {
    const sheets = layout?.sheets;
    if (!sheets) return;
    const order: string[] = layout.sheetOrder || Object.keys(sheets);
    order.forEach((sid) => {
      const sheet = sheets[sid];
      if (!sheet) return;
      const sheetId = String(sheet.id ?? sid);
      const cellData: CellData = (sheet.cellData || {}) as CellData;
      // 找出「带目标字段」的公式格
      const targets: { r: number; c: number; dest: string }[] = [];
      // 找出「附加公式」（同格第 2 条起）：表达式冗余在配置里，需单独求值
      const extraTargets: { r: number; c: number; cfg: FormulaConfig }[] = [];
      Object.entries(cellData).forEach(([rk, row]) => {
        Object.entries(row || {}).forEach(([ck, cell]) => {
          const dest = getFormulaConfig(cell).destField;
          if (dest && isFormulaCell(cell)) {
            targets.push({ r: Number(rk), c: Number(ck), dest: String(dest) });
          }
          const list = getFormulaConfigs(cell);
          list.slice(1).forEach((cfg) => {
            if (!cfg?.expr || !cfg?.destField) return;
            extraTargets.push({ r: Number(rk), c: Number(ck), cfg });
          });
        });
      });
      if (!targets.length && !extraTargets.length) return;
      const resolved = resolveSheetFormulas(cellData, sheetId, values || {}, keyPrefix, customFns);
      // 字段名 → 坐标：附加公式用 ${字段名} 引用时，需要定位到布局里该字段所在格
      const coordByField = new Map<string, string>();
      Object.entries(cellData || {}).forEach(([rk, row]) => {
        Object.entries(row || {}).forEach(([ck, cell]) => {
          const fn = (cell as any)?.fieldMeta?.fieldName;
          if (fn && !coordByField.has(String(fn))) coordByField.set(String(fn), `${rk}_${ck}`);
        });
      });
      targets.forEach(({ r, c, dest }) => {
        const v = resolved?.[String(r)]?.[String(c)]?.v;
        if (v === undefined || v === null) return;
        const key = `${outKeyPrefix}${dest}`;
        if (out[key] === undefined) out[key] = v;
      });
      // 附加公式：在**已求值**的表上再算一次（引用其它公式格时能取到其结果）
      extraTargets.forEach(({ cfg }) => {
        const expr = String(cfg.expr || '').trim();
        if (!expr) return;
        const cellGetter: CellGetter = (rr, cc) => {
          const fv = values?.[`${keyPrefix}${sheetId}__${rr}__${cc}`];
          if (fv !== undefined && fv !== null && fv !== '') return fv;
          return resolved?.[String(rr)]?.[String(cc)]?.v ?? 0;
        };
        const fieldGetter: FieldGetter = (name) => {
          const direct = values?.[name];
          if (direct !== undefined && direct !== null && direct !== '') return direct;
          // 回退到布局中该字段所在格的当前值（与 resolveSheetFormulas 口径一致）
          const coord = coordByField.get(name);
          if (coord) {
            const [rk, ck] = coord.split('_');
            return resolved?.[rk]?.[ck]?.v ?? 0;
          }
          return 0;
        };
        let v: any;
        try {
          v = evaluateFormula(expr, cellGetter, fieldGetter, customFns);
        } catch {
          return;
        }
        if (v === undefined || v === null) return;
        const key = `${outKeyPrefix}${cfg.destField}`;
        if (out[key] === undefined) out[key] = v;
      });
    });
  };

  scan(layoutData, '', '');
  const detailTables = layoutData?.detailTables || {};
  Object.keys(detailTables).forEach((k) => {
    const idx = Number(k);
    const sub = detailTables[k];
    if (!sub) return;
    // 明细表：按第 1 行（r0）取值，与 collectFieldValues「首个非空行生效」口径一致
    scan(sub, `dt${idx}__r0__`, `dt${idx}__`);
  });
  // 页签内容表（E9 etables.tab_N → layout.tabTables[tabId]）：
  // 页签复用主表字段 → 目标字段名同样不加前缀；值命名空间用页签前缀隔离。
  const tabTables = layoutData?.tabTables || {};
  Object.keys(tabTables).forEach((tabId) => {
    const sub = tabTables[tabId];
    if (!sub) return;
    scan(sub, `${tabId}__`, '');
  });
  return out;
};
