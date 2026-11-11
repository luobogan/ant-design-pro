import { describe, expect, it } from 'vitest';
import { registerCustomFunctionsToUniver } from './univerCustomFunction';
import type { CustomFormula } from './formulaUtils';

/**
 * 模拟 Univer 的 FUniver facade：只实现本适配器用到的 registerFunction 契约。
 * 真实契约（来自 @univerjs/sheets-formula 的 FUniverSheetsFormulaMixin）：
 *   registerFunction(config: { calculate: IRegisterFunctionList }): IDisposable
 *   其中 IRegisterFunctionList = [[IRegisterFunction, string, string?], ...]
 */
const createFakeUniver = () => {
  const registered: Array<{ fn: (...args: any[]) => any; name: string; desc?: string }> = [];
  let disposed = 0;
  const fUniver = {
    registerFunction: (config: any) => {
      (config?.calculate || []).forEach(([fn, name, desc]: any) => {
        registered.push({ fn, name, desc });
      });
      return {
        dispose: () => {
          disposed++;
        },
      };
    },
  };
  return { fUniver, registered, getDisposed: () => disposed };
};

const list = (items: Partial<CustomFormula>[]): CustomFormula[] =>
  items.map((x) => ({
    name: x.name || '',
    category: x.category || '自定义函数',
    fnCode: x.fnCode || '',
    formulaDesc: x.formulaDesc,
  }));

describe('registerCustomFunctionsToUniver（设计态注册到 Univer 引擎）', () => {
  it('按 [fn, name, desc] 三元组注册，函数名与描述正确', () => {
    const { fUniver, registered } = createFakeUniver();
    registerCustomFunctionsToUniver(
      fUniver,
      list([{ name: 'MYFUNC', fnCode: 'function MYFUNC(a,b){return a+b;}', formulaDesc: '求和' }]),
    );
    expect(registered.length).toBe(1);
    expect(registered[0].name).toBe('MYFUNC');
    expect(registered[0].desc).toBe('求和');
  });

  it('注册后的函数可被引擎调用并返回计算结果', () => {
    const { fUniver, registered } = createFakeUniver();
    registerCustomFunctionsToUniver(
      fUniver,
      list([{ name: 'MYFUNC', fnCode: 'function MYFUNC(a,b){return a+b;}' }]),
    );
    expect(registered[0].fn(3, 4)).toBe(7);
  });

  it('函数名大写化匹配（引擎按大写名查找）', () => {
    const { fUniver, registered } = createFakeUniver();
    registerCustomFunctionsToUniver(
      fUniver,
      list([{ name: 'myfunc', fnCode: 'function myfunc(a){return a*2;}' }]),
    );
    expect(registered[0].name).toBe('myfunc');
    expect(registered[0].fn(5)).toBe(10);
  });

  it('代码非法 → 跳过注册（引擎侧保持 #NAME?，与运行态一致）', () => {
    const { fUniver, registered } = createFakeUniver();
    registerCustomFunctionsToUniver(
      fUniver,
      list([
        { name: 'BAD', fnCode: 'function BAD( {' },
        { name: 'GOOD', fnCode: 'function GOOD(){return 1;}' },
      ]),
    );
    expect(registered.map((r) => r.name)).toEqual(['GOOD']);
  });

  it('返回值规整：null/undefined → 0，非法值 → 0，非有限数 → 0', () => {
    const { fUniver, registered } = createFakeUniver();
    registerCustomFunctionsToUniver(
      fUniver,
      list([
        { name: 'RET_NULL', fnCode: 'function RET_NULL(){return null;}' },
        { name: 'RET_NAN', fnCode: 'function RET_NAN(){return NaN;}' },
        { name: 'RET_OBJ', fnCode: 'function RET_OBJ(){return {a:1};}' },
        { name: 'RET_BOOL', fnCode: 'function RET_BOOL(){return true;}' },
      ]),
    );
    const byName = Object.fromEntries(registered.map((r) => [r.name, r.fn]));
    expect(byName.RET_NULL()).toBe(0);
    expect(byName.RET_NAN()).toBe(0);
    expect(byName.RET_OBJ()).toBe(0);
    expect(byName.RET_BOOL()).toBe(true);
  });

  it('函数抛异常 → 返回 0（不打断引擎求值）', () => {
    const { fUniver, registered } = createFakeUniver();
    registerCustomFunctionsToUniver(
      fUniver,
      list([{ name: 'THROW', fnCode: 'function THROW(){throw new Error("x");}' }]),
    );
    expect(registered[0].fn()).toBe(0);
  });

  it('无 fUniver / 无函数列表 → 安全返回空注销函数', () => {
    const dispose = registerCustomFunctionsToUniver(null, list([{ name: 'X', fnCode: 'function X(){}' }]));
    expect(() => dispose()).not.toThrow();
    const { fUniver, registered } = createFakeUniver();
    const dispose2 = registerCustomFunctionsToUniver(fUniver, undefined);
    expect(registered.length).toBe(0);
    expect(() => dispose2()).not.toThrow();
  });

  it('批量注册：一次 registerFunction 传入全部函数（只触发一次强制重算）', () => {
    const { fUniver, registered, getDisposed } = createFakeUniver();
    const dispose = registerCustomFunctionsToUniver(
      fUniver,
      list([{ name: 'A', fnCode: 'function A(){}' }, { name: 'B', fnCode: 'function B(){}' }]),
    );
    expect(registered.map((r) => r.name)).toEqual(['A', 'B']);
    dispose();
    // 批量注册 → 只有 1 个 disposable
    expect(getDisposed()).toBe(1);
  });
});
