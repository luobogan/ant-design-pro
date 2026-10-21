import { describe, expect, it } from 'vitest';
import { E9_FIELD_HTML_TYPE, E9_POSITION_HTML_TYPE, fromE9Type, toE9Type } from './fieldTypes';

/**
 * E9（泛微 ecology）原生字段类型 ↔ 自有编码 映射的验收测试。
 *
 * 对应改造计划「S0 / M1」验收标准：
 *  1. fieldhtmltype 1–9 × 子类型映射可用；
 *  2. 双向可逆（核心组合往返后 htmlType 一致）；
 *  3. 浏览按钮以「本部署实测语义」为准，禁止照搬 E9 标准字典；
 *  4. 日期/时间必须靠 dbType 与「部门」消歧；
 *  5. 无法无损表达时 lossy=true 且带 note，绝不静默丢信息。
 */
describe('E9 字段类型双向映射（fieldTypes）', () => {
  it('E9 → 自有：基础类型映射正确', () => {
    expect(fromE9Type(E9_FIELD_HTML_TYPE.TEXT, 1)?.htmlType).toBe(1);
    expect(fromE9Type(E9_FIELD_HTML_TYPE.TEXTAREA)?.htmlType).toBe(2);
    // E9 复选框(4) → 自有 6；E9 选择框(5) → 自有 4；E9 附件(6) → 自有 5
    expect(fromE9Type(E9_FIELD_HTML_TYPE.CHECKBOX)?.htmlType).toBe(6);
    expect(fromE9Type(E9_FIELD_HTML_TYPE.SELECT)?.htmlType).toBe(4);
    expect(fromE9Type(E9_FIELD_HTML_TYPE.AFFIX)?.htmlType).toBe(5);
    // 特殊字段：1=自定义链接
    expect(fromE9Type(E9_FIELD_HTML_TYPE.ESPECIAL, 1)?.type).toBe(1);
  });

  it('E9 → 自有：浏览按钮按「本部署实测」映射（禁止照搬标准字典）', () => {
    // 标准字典写 4=文档，本部署实测 4=部门
    expect(fromE9Type(3, 4)?.browserType).toBe(2);
    // 9 / 37 均为文档（前端文档选项 24）
    expect(fromE9Type(3, 9)?.browserType).toBe(24);
    expect(fromE9Type(3, 37)?.browserType).toBe(24);
    // 17 = 多人力资源(161)，而非多部门
    expect(fromE9Type(3, 17)?.browserType).toBe(161);
    // 164 = 分部(18)，而非「自定义浏览按钮」
    expect(fromE9Type(3, 164)?.browserType).toBe(18);
  });

  it('E9 → 自有：日期/时间必须靠 dbType 与「部门」消歧（TYPE=2 有歧义）', () => {
    // dbType 像日期 → 98 日期 / 99 时间
    expect(fromE9Type(3, 2, 'char(10)')?.browserType).toBe(98);
    expect(fromE9Type(3, 19, 'datetime')?.browserType).toBe(99);
    // dbType 非日期 → TYPE=2 是部门
    expect(fromE9Type(3, 2, 'varchar(100)')?.browserType).toBe(2);
    // 未传 dbType → 按日期兜底并标注 lossy（不静默）
    const ambiguous = fromE9Type(3, 2);
    expect(ambiguous?.browserType).toBe(98);
    expect(ambiguous?.lossy).toBe(true);
    expect(ambiguous?.note).toContain('dbType');
  });

  it('E9 → 自有：8 公共选择框 / 9 位置', () => {
    const pub = fromE9Type(E9_FIELD_HTML_TYPE.PUBLIC_SELECT);
    expect(pub?.htmlType).toBe(4);
    expect(pub?.type).toBe(2); // 复用「选择框 + 单选」表达
    expect(pub?.lossy).toBe(true);

    const pos = fromE9Type(E9_FIELD_HTML_TYPE.POSITION);
    expect(pos?.htmlType).toBe(E9_POSITION_HTML_TYPE); // 预留类型 10
    expect(pos?.lossy).toBe(true);
  });

  it('自有 → E9：文本子类型与降级场景', () => {
    expect(toE9Type(1, 4)?.e9FieldType).toBe(2); // 整数
    expect(toE9Type(1, 5)?.e9FieldType).toBe(3); // 浮点
    expect(toE9Type(6)?.e9HtmlType).toBe(E9_FIELD_HTML_TYPE.CHECKBOX);
    expect(toE9Type(5)?.e9HtmlType).toBe(E9_FIELD_HTML_TYPE.AFFIX);
    expect(toE9Type(3, 98, 98)?.e9FieldType).toBe(2); // 自有日期(98) → E9 日期(2)
    expect(toE9Type(3, 99, 99)?.e9FieldType).toBe(19); // 自有时间(99) → E9 时间(19)

    // 布局(8)/正文(9) 在 E9 无对应 → 降级且标注
    const layout = toE9Type(8);
    expect(layout?.lossy).toBe(true);
    expect(layout?.note).toContain('无直接对应');
  });

  it('双向可逆：核心组合往返后 htmlType 保持一致', () => {
    // 说明：浏览按钮子类型存在「多对一」（如 E9 的 2/4 均映射到自有部门 2），
    // 反向只能取代表值，故此处断言 htmlType 可逆（子类型可逆性见具体用例）。
    const cases: Array<[number, number | undefined, string | undefined]> = [
      [E9_FIELD_HTML_TYPE.TEXT, 1, undefined],
      [E9_FIELD_HTML_TYPE.TEXT, 2, undefined],
      [E9_FIELD_HTML_TYPE.TEXT, 3, undefined],
      [E9_FIELD_HTML_TYPE.TEXT, 4, undefined],
      [E9_FIELD_HTML_TYPE.TEXT, 5, undefined],
      [E9_FIELD_HTML_TYPE.TEXTAREA, undefined, undefined],
      [E9_FIELD_HTML_TYPE.BROWSER, 1, 'varchar(100)'],
      [E9_FIELD_HTML_TYPE.BROWSER, 2, 'varchar(100)'],
      [E9_FIELD_HTML_TYPE.BROWSER, 17, 'varchar(100)'],
      [E9_FIELD_HTML_TYPE.CHECKBOX, undefined, undefined],
      [E9_FIELD_HTML_TYPE.SELECT, undefined, undefined],
      [E9_FIELD_HTML_TYPE.AFFIX, undefined, undefined],
      [E9_FIELD_HTML_TYPE.ESPECIAL, 1, undefined],
    ];

    for (const [e9Ht, e9Ft, db] of cases) {
      const self = fromE9Type(e9Ht, e9Ft, db);
      expect(self, `E9(${e9Ht},${e9Ft}) 应可映射`).not.toBeNull();
      const back = toE9Type(self!.htmlType, self!.type, self!.browserType);
      expect(back?.e9HtmlType, `E9(${e9Ht},${e9Ft}) 往返后 htmlType 应一致`).toBe(e9Ht);
    }
  });

  it('未知 E9 类型返回 null（不猜测、不兜底为文本）', () => {
    expect(fromE9Type(0)).toBeNull();
    expect(fromE9Type(99)).toBeNull();
  });
});
