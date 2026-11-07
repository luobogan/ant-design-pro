import { describe, expect, it } from 'vitest';
import {
  TAB_STYLE_PRESETS,
  buildTabPatch,
  parseTabConfig,
  parseTabRowRanges,
  serializeTabRows,
  tabStyleToCss,
} from './elementSchema';

/**
 * 标签页配置测试（对齐 E9 tabpage_wev8.js 的 sysStyle style-1~style-6 与标签页增删排序）
 */
describe('parseTabConfig（标签页配置解析）', () => {
  it('解析名称 / 行区间 / 默认页 / 样式', () => {
    const cfg = parseTabConfig({
      tabs: '基本信息,扩展信息',
      tabRows: '1-10,11-20',
      defaultTab: 1,
      styleid: -3,
    });
    expect(cfg.names).toEqual(['基本信息', '扩展信息']);
    expect(cfg.pages[0].startRow).toBe(0);
    expect(cfg.pages[0].endRow).toBe(9);
    expect(cfg.pages[1].startRow).toBe(10);
    expect(cfg.defaultIndex).toBe(1);
    expect(cfg.styleId).toBe(-3);
  });

  it('边界兜底：空名 / 越序区间 / defaultTab 越界', () => {
    const cfg = parseTabConfig({ tabs: 'A,,B', tabRows: '10-1,', defaultTab: 9 });
    expect(cfg.names).toEqual(['A', 'B']);
    // 倒序区间自动纠正
    expect(cfg.pages[0].startRow).toBe(0);
    expect(cfg.pages[0].endRow).toBe(9);
    // 缺省区间 → 该页显示全部行
    expect(cfg.pages[1].startRow).toBe(-Infinity);
    // defaultTab 越界 → clamp
    expect(cfg.defaultIndex).toBe(1);
  });
});

describe('行区间读写（增删排序随页搬移）', () => {
  it('解析与序列化互逆', () => {
    const ranges = parseTabRowRanges({ tabRows: '1-10,11-20' }, 2);
    expect(ranges[0]).toEqual({ start: 1, end: 10 });
    expect(ranges[1]).toEqual({ start: 11, end: 20 });
    expect(serializeTabRows(ranges)).toBe('1-10,11-20');
  });

  it('未设置的页保留空位', () => {
    const ranges = parseTabRowRanges({ tabRows: '1-10,' }, 2);
    expect(ranges[1]).toEqual({ start: null, end: null });
    expect(serializeTabRows(ranges)).toBe('1-10,');
  });

  it('buildTabPatch 同步名称与区间', () => {
    const patch = buildTabPatch({
      names: ['A', 'B'],
      ranges: [{ start: 1, end: 5 }, { start: 6, end: 9 }],
      defaultIndex: 0,
      styleId: -2,
    });
    expect(patch.tabs).toBe('A,B');
    expect(patch.tabRows).toBe('1-5,6-9');
    expect(patch.defaultTab).toBe(0);
    expect(patch.styleid).toBe(-2);
  });
});

describe('tabStyleToCss（E9 内置 6 套样式 + 自定义）', () => {
  it('内置样式 6 套且 id 与 E9 一致（-1 ~ -6）', () => {
    expect(TAB_STYLE_PRESETS.map((p) => p.id)).toEqual([-1, -2, -3, -4, -5, -6]);
  });

  it('选中态与未选中态背景不同', () => {
    const cfg = parseTabConfig({ tabs: 'A', styleid: -1 });
    const sel = tabStyleToCss(cfg, true) as any;
    const unsel = tabStyleToCss(cfg, false) as any;
    expect(sel.background).not.toBe(unsel.background);
    expect(sel.color).toBe('#fff');
  });

  it('自定义样式覆盖内置', () => {
    const cfg = parseTabConfig({
      tabs: 'A',
      styleid: 0,
      selBg: '#123456',
      selColor: '#abcdef',
      tabFontSize: 16,
    });
    const sel = tabStyleToCss(cfg, true) as any;
    expect(sel.background).toBe('#123456');
    expect(sel.color).toBe('#abcdef');
    expect(sel.fontSize).toBe('16px');
  });
});
