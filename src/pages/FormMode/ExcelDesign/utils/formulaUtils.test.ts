import { describe, expect, it } from 'vitest';
import {
  buildCustomFunctionResolver,
  collectFormulaResults,
  evaluateFormula,
  getFormulaConfig,
  getFormulaConfigs,
  resolveSheetFormulas,
} from './formulaUtils';
import { collectFieldValues, buildSubmitValues } from './collectFieldValues';
import { numberToChineseCapital, integerToChinese } from './amountChinese';

/**
 * 公式落地测试（对齐 E9 的 destfield / 触发动作 / 金额大写）
 *
 * 覆盖：
 *  ① 公式求值与错误值；
 *  ② 公式结果按目标字段（destField）进入提交载荷（E9 getFormulaNew 语义）；
 *  ③ 金额大写；
 *  ④ 明细表公式的目标字段键（dt{i}__字段）。
 */

describe('evaluateFormula（公式求值）', () => {
  const getCell = (row: number, col: number) => {
    const grid: Record<string, number> = { '0_0': 10, '1_0': 20, '2_0': 5 };
    return grid[`${row}_${col}`] ?? 0;
  };

  it('四则运算与区域求和', () => {
    expect(evaluateFormula('A1*2', getCell)).toBe(20);
    expect(evaluateFormula('SUM(A1:A3)', getCell)).toBe(35);
    expect(evaluateFormula('ROUND(A2/3,2)', getCell)).toBe(6.67);
  });

  it('错误值：除零 / 未知函数 / 名称', () => {
    expect(evaluateFormula('A1/0', getCell)).toBe('#DIV/0!');
    expect(evaluateFormula('FOO(A1)', getCell)).toBe('#NAME?');
    expect(evaluateFormula('A1+', getCell)).toBe('#ERROR!');
  });

  it('CONCAT 与 RMB（金额大写）', () => {
    expect(evaluateFormula('CONCAT("a","b")', getCell)).toBe('ab');
    expect(evaluateFormula('RMB(1234.5)', getCell)).toBe('人民币壹仟贰佰叁拾肆元伍角整');
  });

  it('字段引用语法（大括号 + 字段名）', () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: 公式里的字段引用语法
    expect(evaluateFormula('${amount}+1', getCell, (n) => (n === 'amount' ? 41 : 0))).toBe(42);
  });
});

describe('resolveSheetFormulas（整表求值 + 循环检测）', () => {
  it('公式引用公式，循环返回 #CYCLE!', () => {
    const cellData: any = {
      0: { 0: { f: '=A2*2' } },
      1: { 0: { f: '=A1+1' } },
    };
    const out: any = resolveSheetFormulas(cellData, 'sheet1', {});
    expect(out['0']['0'].v).toBe('#CYCLE!');
  });

  it('按表单值重算（坐标键命名空间）', () => {
    // 公式格在 (0,1)：=A1*3 → A1 是 (0,0) 的表单值 7 → 21
    const cellData: any = { 0: { 1: { f: '=A1*3' } } };
    const out: any = resolveSheetFormulas(cellData, 'sheet1', { sheet1__0__0: 7 });
    expect(out['0']['1'].v).toBe(21);
  });
});

describe('自定义函数（workflow_formula）', () => {
  const getCell = (row: number, col: number) => {
    const grid: Record<string, number> = { '0_0': 10, '1_0': 20, '2_0': 5 };
    return grid[`${row}_${col}`] ?? 0;
  };

  it('自定义函数参与公式求值（function 写法）', () => {
    const fns = buildCustomFunctionResolver([
      { name: 'MYFUNC', category: '自定义函数', fnCode: 'function MYFUNC(a,b){return a+b;}' },
    ]);
    expect(evaluateFormula('MYFUNC(A1,A2)', getCell, () => 0, fns)).toBe(30);
  });

  it('箭头函数写法同样支持', () => {
    const fns = buildCustomFunctionResolver([
      { name: 'MUL', category: '自定义函数', fnCode: '(a,b) => a*b' },
    ]);
    expect(evaluateFormula('MUL(A1,A2)', getCell, () => 0, fns)).toBe(200);
  });

  it('未注册 / 代码非法 → #NAME?（不抛异常）', () => {
    const fns = buildCustomFunctionResolver([
      { name: 'BAD', category: '自定义函数', fnCode: 'function BAD( {' },
    ]);
    expect(evaluateFormula('BAD(A1)', getCell, () => 0, fns)).toBe('#NAME?');
    expect(evaluateFormula('NOPE(A1)', getCell, () => 0, fns)).toBe('#NAME?');
  });

  it('自定义函数可用于整表求值', () => {
    const fns = buildCustomFunctionResolver([
      { name: 'TAX', category: '自定义函数', fnCode: 'function TAX(a){return Math.round(a*0.13);}' },
    ]);
    const cellData: any = { 0: { 0: { v: '', f: '=TAX(100)' } } };
    const out: any = resolveSheetFormulas(cellData, 'sheet1', {}, '', fns);
    expect(out['0']['0'].v).toBe(13);
  });

  it('自定义函数结果按 destField 进入提交载荷', () => {
    const fns = buildCustomFunctionResolver([
      { name: 'DOUBLE', category: '自定义函数', fnCode: 'function DOUBLE(a){return a*2;}' },
    ]);
    const layoutData: any = {
      sheets: {
        sheet1: {
          id: 'sheet1',
          cellData: {
            0: {
              0: { v: '', fieldMeta: { cellType: 'field', fieldName: 'qty' } },
              1: { v: '', f: '=DOUBLE(A1)', formulaCfg: { destField: 'total' } },
            },
          },
        },
      },
    };
    expect(collectFormulaResults(layoutData, { sheet1__0__0: 21 }, fns).total).toBe(42);
  });
});

describe('collectFormulaResults / collectFieldValues（公式结果进入提交载荷）', () => {
  // 主表 sheet1：
  //   (0,0)=amount 字段；(0,1)=total 公式 =A1*2，目标字段 total
  const layoutData: any = {
    sheets: {
      sheet1: {
        id: 'sheet1',
        cellData: {
          0: {
            0: { v: '', fieldMeta: { cellType: 'field', fieldName: 'amount' } },
            1: { v: '', f: '=A1*2', formulaCfg: { destField: 'total' } },
          },
        },
      },
    },
  };

  it('公式结果按目标字段名写入载荷', () => {
    const values = { sheet1__0__0: 25 };
    const formulaValues = collectFormulaResults(layoutData, values);
    expect(formulaValues.total).toBe(50);

    const payload = buildSubmitValues(layoutData, values);
    expect(payload.amount).toBe(25);
    expect(payload.total).toBe(50);
  });

  it('collectFieldValues 也带出公式结果（审批态提交路径）', () => {
    const out = collectFieldValues(layoutData, { sheet1__0__0: 8 });
    expect(out.amount).toBe(8);
    expect(out.total).toBe(16);
  });

  it('明细表公式目标字段带 dt{i}__ 前缀', () => {
    const layout: any = {
      sheets: { sheet1: { id: 'sheet1', cellData: {} } },
      detailTables: {
        1: {
          sheets: {
            dtsheet: {
              id: 'dtsheet',
              cellData: {
                0: {
                  0: { v: '', fieldMeta: { cellType: 'field', fieldName: 'qty' } },
                  1: { v: '', f: '=A1*3', formulaCfg: { destField: 'sum' } },
                },
              },
            },
          },
        },
      },
    };
    const out = collectFormulaResults(layout, { 'dt1__r0__dtsheet__0__0': 7 });
    const detailKey = 'dt1__sum';
    expect(out[detailKey]).toBe(21);
  });
});

describe('金额大写', () => {
  it('整数部分', () => {
    expect(integerToChinese(0)).toBe('零');
    expect(integerToChinese(1)).toBe('壹');
    expect(integerToChinese(10)).toBe('壹拾');
    expect(integerToChinese(105)).toBe('壹佰零伍');
    expect(integerToChinese(100000001)).toBe('壹亿零壹');
  });

  it('带角分与整', () => {
    expect(numberToChineseCapital(1234.5)).toBe('人民币壹仟贰佰叁拾肆元伍角整');
    expect(numberToChineseCapital(100)).toBe('人民币壹佰元整');
    expect(numberToChineseCapital(0.06)).toBe('人民币零元零陆分');
    expect(numberToChineseCapital(-1)).toBe('负人民币壹元整');
  });
});

describe('getFormulaConfig（公式格配置读取）', () => {
  it('缺省返回空对象', () => {
    expect(getFormulaConfig(undefined)).toEqual({});
    expect(getFormulaConfig({ v: 1 })).toEqual({});
  });

  it('读取目标字段与触发时机', () => {
    const cfg = getFormulaConfig({ f: '=A1', formulaCfg: { destField: 'total', trigger: 'blur' } });
    expect(cfg.destField).toBe('total');
    expect(cfg.trigger).toBe('blur');
  });
});

describe('getFormulaConfigs（公式列表：一格多公式）', () => {
  it('无公式时返回空数组', () => {
    expect(getFormulaConfigs(undefined)).toEqual([]);
    expect(getFormulaConfigs({ v: 1 })).toEqual([]);
    expect(getFormulaConfigs({ formulaCfgs: [] })).toEqual([]);
  });

  it('旧形态 formulaCfg 视为唯一一条', () => {
    const list = getFormulaConfigs({ formulaCfg: { destField: 'total' } });
    expect(list).toHaveLength(1);
    expect(list[0].destField).toBe('total');
  });

  it('新形态 formulaCfgs 优先，返回全量列表', () => {
    const list = getFormulaConfigs({
      f: '=A1*2',
      formulaCfgs: [
        { expr: '=A1*2', destField: 'total' },
        { expr: '=A1+1', destField: 'bonus' },
      ],
      formulaCfg: { destField: 'total' },
    });
    expect(list).toHaveLength(2);
    expect(list[1].destField).toBe('bonus');
    expect(list[1].expr).toBe('=A1+1');
  });

  it('getFormulaConfig 取列表首条（主公式）', () => {
    const cfg = getFormulaConfig({
      f: '=A1*2',
      formulaCfgs: [
        { expr: '=A1*2', destField: 'total' },
        { expr: '=A1+1', destField: 'bonus' },
      ],
    });
    expect(cfg.destField).toBe('total');
  });
});

describe('一格多公式：附加公式结果进入提交载荷', () => {
  // (0,0)=amount 字段；(0,1) 主公式 =A1*2 → total；同格附加公式 =A1+1 → bonus
  const layoutData: any = {
    sheets: {
      sheet1: {
        id: 'sheet1',
        cellData: {
          0: {
            0: { v: '', fieldMeta: { cellType: 'field', fieldName: 'amount' } },
            1: {
              v: '',
              f: '=A1*2',
              formulaCfgs: [
                { expr: '=A1*2', destField: 'total' },
                { expr: '=A1+1', destField: 'bonus' },
              ],
              formulaCfg: { destField: 'total' },
            },
          },
        },
      },
    },
  };

  it('主公式与附加公式分别写入各自目标字段', () => {
    const out = collectFormulaResults(layoutData, { sheet1__0__0: 10 });
    expect(out.total).toBe(20);
    expect(out.bonus).toBe(11);
  });

  it('buildSubmitValues 同时带出主公式与附加公式结果', () => {
    const payload = buildSubmitValues(layoutData, { sheet1__0__0: 6 });
    expect(payload.amount).toBe(6);
    expect(payload.total).toBe(12);
    expect(payload.bonus).toBe(7);
  });

  it('附加公式支持字段名引用（回退到布局中字段格的值）', () => {
    const layout: any = {
      sheets: {
        sheet1: {
          id: 'sheet1',
          cellData: {
            0: {
              0: { v: 8, fieldMeta: { cellType: 'field', fieldName: 'amount' } },
              1: {
                v: '',
                f: '=A1*2',
                formulaCfgs: [
                  { expr: '=A1*2', destField: 'total' },
                  // biome-ignore lint/suspicious/noTemplateCurlyInString: 公式里的字段引用语法（${字段名}）
                  { expr: '=${amount}*10', destField: 'tenfold' },
                ],
              },
            },
          },
        },
      },
    };
    const out = collectFormulaResults(layout, {});
    expect(out.total).toBe(16);
    expect(out.tenfold).toBe(80);
  });
});
