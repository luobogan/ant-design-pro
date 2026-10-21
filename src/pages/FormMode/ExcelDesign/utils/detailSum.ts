/**
 * 明细表「序号列 / 列合计」纯计算逻辑
 *
 * <p>从 {@code ExcelPreview.tsx} 抽出为纯函数，目的是**可单测**——
 * 设计器主体是 Univer canvas（无 DOM 单元格），Playwright 无法直接操作格子，
 * 因此这两个算法必须用单元测试验证。</p>
 *
 * <p>对齐泛微 E9：</p>
 * <ul>
 *   <li>序号列 = etype 22（serialNum）</li>
 *   <li>合计字段 = etype 19（sumValue），合计标签 = etype 18（sumName）</li>
 * </ul>
 */

/**
 * 从「表单值 key」解析明细行号（**1 起**）。
 *
 * <p>key 命名空间：{@code dt{idx}__r{n}__{sheetId}__{row}__{col}}（明细行），
 * 主表 key 无 {@code r{n}__} 段，返回 undefined。</p>
 *
 * @example rowNoFromKey('dt1__r0__sheet1__0__2') === 1
 * @example rowNoFromKey('sheet1__0__2') === undefined
 */
export const rowNoFromKey = (key?: string): number | undefined => {
  if (!key) return undefined;
  // 必须命中「明细命名空间」：dt{idx}__r{n}__，避免主表 key（如字段名/位置含 r 数字）被误判
  const m = /^dt\d+__r(\d+)__/.exec(key);
  return m ? Number(m[1]) + 1 : undefined;
};

/**
 * 构建「位置(row_col) → 字段名」映射。
 *
 * <p>明细子画布通常只有一个 sheet；若跨 sheet 出现同行同列，后写覆盖先写
 * （冲突概率极低，且仅影响合计归类）。</p>
 */
const buildPosFieldMap = (dtSheets: any[]): Record<string, string> => {
  const posField: Record<string, string> = {};
  (dtSheets || []).forEach((sheet: any) => {
    Object.entries(sheet?.cellData || {}).forEach(([rk, row]: any) => {
      Object.entries(row || {}).forEach(([ck, c]: any) => {
        const fn = (c as any)?.fieldMeta?.fieldName;
        if (fn) posField[`${rk}_${ck}`] = fn;
      });
    });
  });
  return posField;
};

/**
 * 计算明细表**列合计**：{@code fieldName → 合计值}。
 *
 * <p>算法：借布局「位置(row_col)→字段名」反查，遍历该明细命名空间
 * （{@code prefix} = {@code dt{idx}__}）下前 {@code rowCount} 行的值，
 * 仅累加可解析为有限数值的项（空串 / null / 非数值跳过）。</p>
 *
 * <p>说明：E9 的「赋主字段」(maincal) 在此基础上再把合计写回主表字段，
 * 属后续增强（需后端保存链路配合），此处只负责「算」。</p>
 *
 * @param dtSheets  明细子画布布局（含 cellData）
 * @param formValues 表单值（key 为完整命名空间）
 * @param rowCount  当前明细行数
 * @param prefix    该明细的 key 前缀（如 'dt1__'）
 */
export const computeDetailSums = (
  dtSheets: any[],
  formValues: Record<string, any>,
  rowCount: number,
  prefix: string,
): Record<string, number> => {
  const sums: Record<string, number> = {};
  const posField = buildPosFieldMap(dtSheets);
  if (Object.keys(posField).length === 0) return sums;

  const values = formValues || {};
  for (let n = 0; n < rowCount; n++) {
    const rp = `${prefix}r${n}__`;
    Object.keys(values).forEach((k) => {
      if (!k.startsWith(rp)) return;
      // ⚠️ 值 key 的 row/col 之间是「双下划线」分隔：{sheetId}__{row}__{col}
      const m = /__(\d+)__(\d+)$/.exec(k.slice(rp.length));
      if (!m) return;
      const fn = posField[`${m[1]}_${m[2]}`];
      if (!fn) return;
      const raw = values[k];
      if (raw === '' || raw == null) return;
      const num = Number(raw);
      if (Number.isFinite(num)) sums[fn] = (sums[fn] ?? 0) + num;
    });
  }
  return sums;
};
