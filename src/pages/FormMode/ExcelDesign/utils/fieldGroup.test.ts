import { describe, expect, it } from 'vitest';
import {
  filterFieldsByKeyword,
  getFieldDisplayLabel,
  getFieldDisplayName,
  getFieldTypeGroup,
  groupFieldsByTable,
  groupFieldsByType,
  groupFieldsByUsage,
  matchFieldKeyword,
} from './fieldGroup';

/**
 * 字段面板分组与搜索测试
 *
 * 覆盖：
 *  ① 显示名兜底（多属性名来源）；
 *  ② 类型分组（已知 / 未知类型、顺序稳定）；
 *  ③ 使用状态分组（已放置 / 未放置）；
 *  ④ 明细表分组；
 *  ⑤ 搜索（大小写不敏感、多关键词 AND、命中类型名）。
 */
const fields = [
  { id: '1', fieldName: 'amount', fieldLabel: '借款金额', fieldHtmlType: 1, fieldType: 1 },
  { id: '2', fieldName: 'apply_date', fieldLabel: '申请日期', fieldHtmlType: 7, fieldType: 3 },
  { id: '3', fieldName: 'dept', fieldLabel: '申请部门', fieldHtmlType: 3, fieldType: 2 },
  { id: '4', fieldName: 'kind', fieldLabel: '费用类型', fieldHtmlType: 4, fieldType: 1 },
];

describe('字段显示名兜底', () => {
  it('名称：fieldName → fieldDbName → name → columnName', () => {
    expect(getFieldDisplayName({ fieldName: 'a' })).toBe('a');
    expect(getFieldDisplayName({ fieldDbName: 'b' })).toBe('b');
    expect(getFieldDisplayName({ name: 'c' })).toBe('c');
    expect(getFieldDisplayName({ columnName: 'd' })).toBe('d');
    expect(getFieldDisplayName({})).toBe('');
  });

  it('标签：fieldLabel → label → 名称 → 未命名字段', () => {
    expect(getFieldDisplayLabel({ fieldLabel: '标签' })).toBe('标签');
    expect(getFieldDisplayLabel({ label: '别名' })).toBe('别名');
    expect(getFieldDisplayLabel({ fieldName: 'x' })).toBe('x');
    expect(getFieldDisplayLabel({})).toBe('未命名字段');
  });
});

describe('类型分组', () => {
  it('按 fieldHtmlType 归组，未知类型归入「其它字段」', () => {
    expect(getFieldTypeGroup({ fieldHtmlType: 1 }).title).toBe('文本字段');
    expect(getFieldTypeGroup({ fieldHtmlType: 3 }).title).toBe('浏览按钮');
    expect(getFieldTypeGroup({ fieldHtmlType: 99 }).title).toBe('其它字段');
    expect(getFieldTypeGroup({}).title).toBe('其它字段');
  });

  it('分组结果按类型顺序排列并带数量', () => {
    const groups = groupFieldsByType(fields);
    expect(groups.map((g) => g.title)).toEqual(['文本字段', '特殊字段', '浏览按钮', '选择框']);
    expect(groups[0].fields.map((f: any) => f.fieldName)).toEqual(['amount']);
    expect(groups[2].fields.map((f: any) => f.fieldName)).toEqual(['dept']);
  });

  it('空数组返回空分组', () => {
    expect(groupFieldsByType([])).toEqual([]);
  });
});

describe('使用状态分组', () => {
  it('已放置 / 未放置各成一组，标题带数量', () => {
    const groups = groupFieldsByUsage(fields, (f: any) => f.id === '1' || f.id === '3');
    expect(groups.map((g) => g.title)).toEqual(['已放置 (2)', '未放置 (2)']);
    expect(groups[0].fields.map((f: any) => f.id)).toEqual(['1', '3']);
  });

  it('全部已放置时不产生「未放置」组', () => {
    const groups = groupFieldsByUsage(fields, () => true);
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe('已放置 (4)');
  });
});

describe('明细表分组', () => {
  it('按表标题分组', () => {
    const groups = groupFieldsByTable(fields, (f: any) =>
      f.fieldHtmlType === 3 ? '明细表1' : '主表字段',
    );
    expect(groups.map((g) => g.title)).toEqual(['主表字段', '明细表1']);
    expect(groups[1].fields).toHaveLength(1);
  });
});

describe('字段搜索', () => {
  it('空关键词 → 全部匹配', () => {
    expect(matchFieldKeyword(fields[0], '')).toBe(true);
    expect(matchFieldKeyword(fields[0], '   ')).toBe(true);
  });

  it('大小写不敏感', () => {
    expect(matchFieldKeyword(fields[0], 'AMOUNT')).toBe(true);
    expect(matchFieldKeyword(fields[0], 'amount')).toBe(true);
  });

  it('多关键词按 AND 命中（空格分隔）', () => {
    expect(matchFieldKeyword(fields[0], '借款 金额')).toBe(true);
    expect(matchFieldKeyword(fields[0], '借款 部门')).toBe(false);
  });

  it('命中描述与类型名', () => {
    const withDesc = [{ ...fields[0], description: '单位：元' }];
    expect(matchFieldKeyword(withDesc[0], '单位')).toBe(true);
    // 类型名由调用方注入（fieldTypes 依赖 node 端模块，无法在浏览器测试环境 import）
    const typeLabel = (f: any) => (f.fieldHtmlType === 3 ? '部门' : '');
    expect(matchFieldKeyword(fields[2], '部门', typeLabel)).toBe(true);
    expect(matchFieldKeyword(fields[0], '部门', typeLabel)).toBe(false);
  });

  it('字段属性缺失时不抛异常（不再出现 undefined.includes）', () => {
    expect(matchFieldKeyword({ id: 'x' }, '任意')).toBe(false);
    expect(matchFieldKeyword({}, '')).toBe(true);
  });

  it('filterFieldsByKeyword 返回命中字段', () => {
    const out = filterFieldsByKeyword(fields, '金额');
    expect(out).toHaveLength(1);
    expect(out[0].fieldName).toBe('amount');
    expect(filterFieldsByKeyword(fields, '')).toHaveLength(4);
  });
});
