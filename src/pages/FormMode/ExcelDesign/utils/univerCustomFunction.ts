/**
 * 自定义函数 → Univer 公式引擎适配器（**设计态画布**）。
 *
 * <p>设计态画布里公式由 Univer 引擎求值；引擎不认识自定义函数名时会算成 #NAME?。
 * 故把后端 workflow_formula 的自定义函数注册进引擎，使设计态与运行态口径一致。</p>
 *
 * <p>本模块刻意**不依赖任何 API / React**，以便单测直接引入（customFunctionRuntime
 * 依赖 @/services/formmode → umi request，浏览器测试环境无法解析）。</p>
 */
import { compileCustomFunction, type CustomFormula } from './formulaUtils';

/**
 * 把 Univer 传入的「值对象」解包成 JS 原始值。
 * Univer 的公式函数参数可能是 ValueObject（{ value }），而自定义函数是用户写的 JS，
 * 直接收到对象会算错，故统一解包。
 */
const unwrapUniverValue = (v: any): any =>
  v && typeof v === 'object' && 'value' in v ? (v as any).value : v;

/** 把自定义函数的返回值规整成 Univer 可接受的结果（number / string / boolean） */
const normalizeUniverResult = (r: any): number | string | boolean => {
  const v = unwrapUniverValue(r);
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string' || typeof v === 'boolean') return v;
  return 0;
};

/**
 * 把自定义函数注册到 Univer 公式引擎。
 *
 * <p>用 FUniver 的 `registerFunction({ calculate })`：其契约是
 * `IRegisterFunctionList = [[IRegisterFunction, string, string?], ...]`（函数、名称、描述）。
 * 内部会 debounce 触发一次 `forceCalculation`，因此注册完画布里的公式会自动重算。</p>
 *
 * @param fUniver FUniver facade 实例（设计器持有 fUniverRef / window.__univerFAPI）
 * @param functions 自定义函数列表（后端 workflow_formula）
 * @returns 注销函数（dispose 全部已注册项）
 */
export const registerCustomFunctionsToUniver = (
  fUniver: any,
  functions: CustomFormula[] | undefined,
): (() => void) => {
  if (!fUniver || typeof fUniver.registerFunction !== 'function') {
    return () => {};
  }
  // 批量组装：一次 registerFunction 传入全部函数（IRegisterFunctionList 是元组数组），
  // 避免逐个注册触发 N 次强制重算，也只需一个 disposable。
  const calculate: any[] = [];
  (functions || []).forEach((f) => {
    const name = String(f?.name || '').trim();
    if (!name) return;
    const fn = compileCustomFunction(f?.fnCode || '');
    if (!fn) return; // 代码非法：跳过注册（引擎侧保持 #NAME?，与运行态一致）
    calculate.push([
      (...args: any[]) => {
        try {
          return normalizeUniverResult(fn(...args.map(unwrapUniverValue)));
        } catch {
          return 0;
        }
      },
      name,
      f?.formulaDesc || name,
    ]);
  });
  if (!calculate.length) return () => {};
  let disposable: any = null;
  try {
    disposable = fUniver.registerFunction({ calculate });
  } catch {
    // 注册失败：引擎侧保持 #NAME?，不影响设计器其它能力
    return () => {};
  }
  return () => {
    try {
      disposable?.dispose?.();
    } catch {
      // 忽略注销异常
    }
    disposable = null;
  };
};
