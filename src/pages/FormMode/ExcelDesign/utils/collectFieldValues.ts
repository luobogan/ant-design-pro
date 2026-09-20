/**
 * Excel 布局表单值 → 「字段名 → 值」映射。
 *
 * <p>为什么需要它：Excel 布局表单（ExcelPreview）内部的值 key 是**单元格坐标**
 * （主表 `{sheetId}__{row}__{col}`，明细表行 `dt{idx}__r{n}__{sheetId}__{row}__{col}`），
 * 而流程引擎的出口条件 UEL（如 `${amount > 1000}`）、节点字段权限、后端必填矩阵
 * 用的都是**字段名**。两个命名空间必须打通，否则「填了表单却走不到对应分支」。</p>
 *
 * <p>产出规则（与后端 `WfTestServiceImpl` 的必填校验口径一致——它按
 * `cellKey 命中 或 字段名命中` 双重判定）：</p>
 * <ul>
 *   <li>主表字段 → 直接用字段名做 key：`{ amount: 100 }`；</li>
 *   <li>明细表字段 → 带表号前缀：`{ 'dt1__amount': 100 }`（多行时取首个非空行）；</li>
 *   <li>空值（''/null/undefined）不产出，避免把已有快照值覆盖成空。</li>
 * </ul>
 *
 * <p>调用方通常把「原始坐标键值」与「本函数产出」合并后一起下发：坐标键供 Excel 布局
 * 回显（initialValues 按坐标读），字段名供引擎变量/网关条件使用。</p>
 */

type AnyObj = Record<string, any>;

/** 只认「输入格」：cellType 为空（老布局）或 =field；标签/元素/明细标记格不承载值 */
const isFieldMeta = (meta: any): boolean => {
  if (!meta || !meta.fieldName) return false;
  const t = meta.cellType;
  return t == null || t === '' || t === 'field';
};

/** 坐标键解析：主表 `sheet__r__c`；明细表行 `dt{idx}__r{n}__sheet__r__c` */
const CELL_KEY_RE = /^(?:dt(\d+)__r(\d+)__)?(.+?)__(\d+)__(\d+)$/;

/** 布局里所有「坐标 → 字段名（+明细表号）」索引 */
const buildMetaIndex = (layoutData: any): Map<string, { fieldName: string; dtIdx?: number }> => {
  const index = new Map<string, { fieldName: string; dtIdx?: number }>();
  const scan = (layout: any, dtIdx?: number) => {
    const sheets = layout?.sheets;
    if (!sheets) return;
    const order: string[] = layout.sheetOrder || Object.keys(sheets);
    order.forEach((sid) => {
      const sheet = sheets[sid];
      if (!sheet) return;
      const cellData = sheet.cellData || {};
      Object.entries(cellData).forEach(([rk, rowData]) => {
        Object.entries((rowData as AnyObj) || {}).forEach(([ck, cell]) => {
          const meta = (cell as any)?.fieldMeta;
          if (!isFieldMeta(meta)) return;
          const loc = `${sheet.id ?? sid}__${rk}__${ck}`;
          if (!index.has(loc)) {
            index.set(loc, { fieldName: String(meta.fieldName), dtIdx });
          }
        });
      });
    });
  };
  scan(layoutData);
  const detailTables = layoutData?.detailTables || {};
  Object.keys(detailTables).forEach((k) => {
    const idx = Number(k);
    scan(detailTables[k], Number.isFinite(idx) ? idx : undefined);
  });
  return index;
};

/** 是否为空值（空串 / null / undefined；0 与 false 视为有值） */
const isBlank = (v: any): boolean => v === undefined || v === null || v === '';

export function collectFieldValues(layoutData: any, values: AnyObj): AnyObj {
  const out: AnyObj = {};
  if (!layoutData || !values) return out;
  const index = buildMetaIndex(layoutData);
  if (index.size === 0) return out;
  Object.keys(values).forEach((key) => {
    const m = CELL_KEY_RE.exec(key);
    if (!m) return;
    const cellKey = m[3] + '__' + m[4] + '__' + m[5];
    const hit = index.get(cellKey);
    if (!hit) return;
    const v = values[key];
    if (isBlank(v)) return;
    const outKey = hit.dtIdx != null ? `dt${hit.dtIdx}__${hit.fieldName}` : hit.fieldName;
    // 首个非空值生效（明细表多行时不会被后续行覆盖）
    if (isBlank(out[outKey])) out[outKey] = v;
  });
  return out;
}

/**
 * 反向补齐：把「字段名键」的值填到对应「坐标键」上，供 Excel 布局回显。
 *
 * <p>历史数据里两种键都可能存在：旧办理页（FieldRenderer）与测试页顶部场景表单
 * 写的是字段名键；Excel 布局路径写的是坐标键。ExcelPreview 的 initialValues 按坐标读，
 * 故这里把字段名键补成坐标键（坐标键已有值时以坐标键为准，不覆盖）。</p>
 */
export function expandInitialValues(layoutData: any, data: AnyObj): AnyObj {
  if (!layoutData || !data) return data || {};
  const out: AnyObj = { ...data };
  const fill = (layout: any, dtIdx?: number) => {
    const sheets = layout?.sheets;
    if (!sheets) return;
    (layout.sheetOrder || Object.keys(sheets)).forEach((sid: string) => {
      const sheet = sheets[sid];
      const cellData = sheet?.cellData || {};
      Object.entries(cellData).forEach(([r, rowData]) => {
        Object.entries((rowData as AnyObj) || {}).forEach(([c, cell]) => {
          const meta = (cell as any)?.fieldMeta;
          if (!isFieldMeta(meta)) return;
          const fieldName = String(meta.fieldName);
          const byName = dtIdx != null ? data[`dt${dtIdx}__${fieldName}`] : data[fieldName];
          if (isBlank(byName)) return;
          const cellKey = `${sheet.id ?? sid}__${r}__${c}`;
          if (isBlank(out[cellKey])) out[cellKey] = byName;
        });
      });
    });
  };
  fill(layoutData);
  const detailTables = layoutData.detailTables || {};
  Object.keys(detailTables).forEach((k) => {
    const idx = Number(k);
    const sub = detailTables[k];
    const sheets = sub?.sheets;
    if (!sheets) return;
    (sub.sheetOrder || Object.keys(sheets)).forEach((sid: string) => {
      const sheet = sheets[sid];
      const cellData = sheet?.cellData || {};
      Object.entries(cellData).forEach(([r, rowData]) => {
        Object.entries((rowData as AnyObj) || {}).forEach(([c, cell]) => {
          const meta = (cell as any)?.fieldMeta;
          if (!isFieldMeta(meta)) return;
          const byName = data[`dt${idx}__${meta.fieldName}`];
          if (isBlank(byName)) return;
          // 明细表：字段名键只对应首行（row 0）
          const cellKey = `dt${idx}__r0__${sheet.id ?? sid}__${r}__${c}`;
          if (isBlank(out[cellKey])) out[cellKey] = byName;
        });
      });
    });
  });
  return out;
}

export default collectFieldValues;
