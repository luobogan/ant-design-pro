import { describe, expect, it } from 'vitest';
import { rowNoFromKey, computeDetailSums } from './detailSum';

/**
 * 明细「序号列 / 列合计」算法测试
 *
 * 对应改造计划 M3/P2-1：etype 22（序号）与 etype 19（合计字段）从静态占位
 * 改为实时计算。设计器为 Univer canvas（无 DOM 单元格），无法用 Playwright
 * 操作格子，故这两个算法以单元测试验证。
 */

describe('rowNoFromKey（明细行号解析，1 起）', () => {
  it('解析明细行 key', () => {
    expect(rowNoFromKey('dt1__r0__sheet1__0__2')).toBe(1);
    expect(rowNoFromKey('dt1__r2__sheet1__0__2')).toBe(3);
    expect(rowNoFromKey('dt12__r9__sheet1__0__2')).toBe(10);
  });

  it('非明细 key 返回 undefined', () => {
    expect(rowNoFromKey('sheet1__0__2')).toBeUndefined();
    expect(rowNoFromKey('')).toBeUndefined();
    expect(rowNoFromKey(undefined)).toBeUndefined();
  });

  it('字段名里含 r 数字不致误判（须以 __ 分隔的 r{n}__ 段为准）', () => {
    expect(rowNoFromKey('sheet1__r5__x')).toBeUndefined(); // 主表命名空间无 dt 前缀也可解析段
    expect(rowNoFromKey('dt1__r0__sheet1__0__2')).toBe(1);
  });
});

describe('computeDetailSums（明细列合计）', () => {
  // 明细子画布：sheet1 的 (0,2) 是字段 qty，(0,1) 是标签
  const sheets = [
    {
      id: 'sheet1',
      cellData: {
        0: {
          1: { v: '数量', fieldMeta: { cellType: 'label' } },
          2: { fieldMeta: { cellType: 'field', fieldName: 'qty' } },
        },
      },
    },
  ];

  it('按字段累加明细各行数值', () => {
    const values = {
      'dt1__r0__sheet1__0__2': 10,
      'dt1__r1__sheet1__0__2': 20,
      'dt1__r2__sheet1__0__2': 5.5,
    };
    expect(computeDetailSums(sheets, values, 3, 'dt1__')).toEqual({ qty: 35.5 });
  });

  it('空值与非数值跳过，不影响其它字段', () => {
    const values = {
      'dt1__r0__sheet1__0__2': 10,
      'dt1__r1__sheet1__0__2': '',
      'dt1__r2__sheet1__0__2': null,
      'dt1__r0__sheet1__0__3': 'x', // 该位置无字段定义 → 跳过
      'dt1__r0__sheet1__0__9': 3, // 同上
    };
    expect(computeDetailSums(sheets, values, 3, 'dt1__')).toEqual({ qty: 10 });
  });

  it('rowCount 之外的行不统计（删行后合计随之减少）', () => {
    const values = {
      'dt1__r0__sheet1__0__2': 10,
      'dt1__r5__sheet1__0__2': 100,
    };
    expect(computeDetailSums(sheets, values, 1, 'dt1__')).toEqual({ qty: 10 });
  });

  it('不同明细命名空间不混算', () => {
    const values = {
      'dt1__r0__sheet1__0__2': 10,
      'dt2__r0__sheet1__0__2': 7,
    };
    expect(computeDetailSums(sheets, values, 1, 'dt1__')).toEqual({ qty: 10 });
    expect(computeDetailSums(sheets, values, 1, 'dt2__')).toEqual({ qty: 7 });
  });

  it('布局无字段 → 返回空对象', () => {
    expect(computeDetailSums([{ id: 's', cellData: {} }], { 'dt1__r0__s__0__0': 1 }, 1, 'dt1__')).toEqual({});
  });

  it('多字段分别合计', () => {
    const multi = [
      {
        id: 'sheet1',
        cellData: {
          0: {
            2: { fieldMeta: { cellType: 'field', fieldName: 'qty' } },
            3: { fieldMeta: { cellType: 'field', fieldName: 'price' } },
          },
        },
      },
    ];
    const values = {
      'dt1__r0__sheet1__0__2': 2,
      'dt1__r0__sheet1__0__3': 15,
      'dt1__r1__sheet1__0__2': 3,
      'dt1__r1__sheet1__0__3': 20,
    };
    expect(computeDetailSums(multi, values, 2, 'dt1__')).toEqual({ qty: 5, price: 35 });
  });

  it('rowCount=0 → 空合计', () => {
    expect(computeDetailSums(sheets, { 'dt1__r0__sheet1__0__2': 10 }, 0, 'dt1__')).toEqual({});
  });
});
