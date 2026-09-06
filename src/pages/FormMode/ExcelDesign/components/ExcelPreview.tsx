import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Modal, Button, Space, Typography, Form, Input, Select, DatePicker, Checkbox, Radio, InputNumber, message, Table } from 'antd';
import {
  PrinterOutlined,
  DownloadOutlined,
  CloseOutlined,
  FileTextOutlined,
  PaperClipOutlined,
  SendOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';

const { Text } = Typography;
const { TextArea } = Input;

// ──────────────────────────────────────────────
// E9 预览样式常量
// ──────────────────────────────────────────────
const E9_COLORS = {
  primary: '#1890ff',
  required: '#ff4d4f',
  label: '#666',
  value: '#333',
  sectionBg: '#fafafa',
  sectionBorder: '#e8e8e8',
  cardBorder: '#f0f0f0',
  readOnlyBg: '#f5f5f5',
  readOnlyBorder: '#e8e8e8',
} as const;

// ──────────────────────────────────────────────
// 类型定义 - 与 UniverExcelGrid 保持一致
// ──────────────────────────────────────────────

interface FieldMeta {
  fieldId?: string | number;
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  /** 单元格类型：label=静态标签文本（仅展示，不可输入），field=数据绑定字段（可输入） */
  cellType?: 'label' | 'field';
  required: boolean;
  readonly: boolean;
  /** 字段属性：1=只读 2=可编辑 3=必填（参照 ecology viewAttr） */
  fieldAttr?: number;
  defaultValue?: string;
  placeholder?: string;
  length?: number;
  tooltip?: string;
  options?: { label: string; value: string }[];
  validationRule?: any;
}

interface CellDataItem {
  v: string | number | boolean | null;
  m?: string;
  t?: number;
  s?: number;
  fieldMeta?: FieldMeta;
  tag?: string;
}

interface SheetLayoutData {
  id: string;
  name: string;
  cellData: Record<string, Record<string, CellDataItem>>;
  rowCount: number;
  colCount: number;
  rowData?: Record<string, { h: number }>;
  columnData?: Record<string, { w: number }>;
  /** 合并单元格信息：保留 Excel 网格布局（预览还原合并单元格） */
  mergedCells?: { row: number; col: number; rowSpan: number; colSpan: number }[];
}

interface WorkbookLayoutData {
  id: string;
  name?: string;
  sheetOrder: string[];
  sheets: Record<string, SheetLayoutData>;
  version: string;
}

// 单元格值 key：sheetId + 行列，保证唯一
const cellKey = (sheetId: string, row: number, col: number) => `${sheetId}__${row}__${col}`;

// 从布局数据（主表或明细表子画布）提取 sheet 列表（与 ExcelPreview 内部解析逻辑一致）
// 兼容两种形状：
//  - result/univer 形状：layout.sheets = { sheet1: {...} }（saveLayoutData() 返回值、预览写入的 layoutData）
//  - parentData 兼容形状：{ [sheetName]: result, sheetName, cellData, ... }（子画布 onLayoutChange 回调写回的
//    detailTables[idx] 即此形状，真正的 sheet 集合在 layout[sheetName].sheets 里）
const extractSheets = (layout: any): SheetLayoutData[] => {
  if (!layout) return [];
  if (layout.sheets) {
    const order = layout.sheetOrder || Object.keys(layout.sheets);
    return order.map((id: string) => layout.sheets[id]).filter(Boolean);
  }
  if (layout.sheetName && layout[layout.sheetName]?.sheets) {
    const inner = layout[layout.sheetName];
    const order = inner.sheetOrder || Object.keys(inner.sheets);
    return order.map((id: string) => inner.sheets[id]).filter(Boolean);
  }
  // 极少数老格式：顶层直接承载单 sheet 的 cellData
  if (layout.cellData) {
    return [
      {
        id: layout.sheetName || 'sheet1',
        name: layout.sheetName || 'Sheet1',
        cellData: layout.cellData,
        rowCount: layout.rowCount,
        colCount: layout.colCount,
        mergedCells: layout.mergedCells || [],
        columnData: layout.columnData || {},
        rowData: layout.rowData || {},
      } as SheetLayoutData,
    ];
  }
  return [];
};

// 判断必填项是否为空（参照 ecology：required 字段提交时校验非空）
const isEmptyValue = (fieldType: string | undefined, v: any): boolean => {
  if (fieldType === 'checkbox') return !v; // 必填复选框必须勾选
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
};

// ──────────────────────────────────────────────
// 单元格渲染：根据 fieldMeta 返回对应的 Ant Design 组件
// 作为真实表单呈现：
//   fieldAttr=1 只读  → 控件禁用
//   fieldAttr=2 可编辑 → 正常可输入
//   fieldAttr=3 必填  → 可输入 + 红色 * + 提交校验非空
// ──────────────────────────────────────────────

/**
 * 将保存的单元格样式（Univer IStyleData）映射为 React CSS。
 *
 * 关键点：Excel / Univer 的字号单位是「磅（pt）」，而 CSS 用的是 px。
 * 1pt = 4/3 px，若直接把 pt 当 px 用，预览字号会明显小于设计器中的字号，
 * 因此这里统一换算后再下发，保证预览字号与 Excel 配置一致。
 */
const cellStyleToCss = (s: any): React.CSSProperties => {
  if (!s || typeof s !== 'object') return {};
  const css: any = {};
  if (s.ff) css.fontFamily = s.ff;
  if (s.fs && s.fs > 0) css.fontSize = `${Math.round((s.fs * 4) / 3)}px`;
  if (s.cl && s.cl.rgb) css.color = s.cl.rgb;
  if (s.bg && s.bg.rgb) css.background = s.bg.rgb;
  if (s.bl) css.fontWeight = 'bold';
  if (s.it) css.fontStyle = 'italic';
  if (s.ul && s.ul.s && s.st && s.st.s) css.textDecoration = 'underline line-through';
  else if (s.ul && s.ul.s) css.textDecoration = 'underline';
  else if (s.st && s.st.s) css.textDecoration = 'line-through';
  // Univer 的 JUSTIFIED 对应 CSS 的 justify，直接小写会得到非法值
  if (s.ht) {
    const ht = String(s.ht).toLowerCase();
    css.textAlign = ht === 'justified' ? 'justify' : ht;
  }
  if (s.vt) css.verticalAlign = String(s.vt).toLowerCase();
  if (s.tb) css.whiteSpace = 'pre-wrap';
  return css;
};

const FieldCell: React.FC<{
  cell: CellDataItem;
  row: number;
  col: number;
  sheetId: string;
  value: any;
  onChange: (v: any) => void;
  error?: boolean;
  /** 预览态只读：对应 ecology 显示/监控/打印布局（layouttype 0/3/4）强制只读 */
  readOnly?: boolean;
  /** 单元格样式（Univer IStyleData），用于让控件沿用 Excel 的字体/颜色/背景 */
  cellStyle?: any;
  /** 字段属性底色（只读灰底/必填浅红底），与设计师一致，优先级高于 Excel 单元格背景色 */
  attrBg?: string;
}> = ({ cell, sheetId, row, col, value, onChange, error, readOnly, cellStyle, attrBg }) => {
  const meta = cell.fieldMeta;
  const rawValue = cell.v !== null && cell.v !== undefined ? String(cell.v) : '';
  // 字段单元格在设计器中存的是模板占位符（如 "📝 ${xm}"），表示尚未填入真实数据。
  // 预览时应按空值处理，避免把占位符当成输入框的默认值。
  const cleanRaw = rawValue.replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, '').trim();
  const displayValue = /^\$\{[^}]+\}$/.test(cleanRaw) ? '' : rawValue;

  // 纯文本/无字段元数据 → 直接显示文字
  // 注意：不要硬编码颜色/字重，否则会覆盖 Excel 单元格样式（外层 <td> 已套用 s）。
  if (!meta) {
    return <span>{displayValue || '\u00A0'}</span>;
  }

  // 标签单元格 → 静态说明文本，不渲染输入控件（与数据绑定字段区分）
  // 同样不硬编码颜色/字重，由外层 <td> 上的 Excel 单元格样式（s）决定颜色与加粗。
  if (meta.cellType === 'label') {
    return <span>{meta.fieldLabel || displayValue || '\u00A0'}</span>;
  }

  // 字段属性以 fieldAttr 为权威（参照 ecology：1=只读 2=可编辑 3=必填），兼容旧 readonly/required 布尔
  const fieldAttr = meta?.fieldAttr;
  // 预览态（readOnly）整体只读：对应 ecology 显示/监控/打印布局（layouttype 0/3/4）强制只读
  const disabled = !!readOnly || fieldAttr === 1 || meta?.readonly === true;
  // 必填校验未通过 → 控件红色边框（必填 * 与错误文案由外层 Form.Item 统一渲染）
  const status = error ? 'error' : '';

  // 沿用 Excel 单元格样式：AntD 的 Input / Select 等控件**不会继承** <td> 的 font，
  // 必须把字体/字号/字重显式下发到控件本体，否则预览里全是 AntD 默认字体，
  // 与 Excel 配置的字体不一致。
  const excelCss: any = cellStyleToCss(cellStyle);
  const excelFont: React.CSSProperties = {
    ...(excelCss.fontFamily ? { fontFamily: excelCss.fontFamily } : {}),
    ...(excelCss.fontSize ? { fontSize: excelCss.fontSize } : {}),
    ...(excelCss.fontWeight ? { fontWeight: excelCss.fontWeight } : {}),
  };

  // 字段属性底色（与设计师一致，优先级高于 Excel 单元格背景色）：
  //   1=只读 → 灰底(#f5f5f5) + 灰字 + 禁用
  //   2=可编辑 → 白底（或沿用 Excel 背景色）
  //   3=必填 → 浅红底(#fff1f0)
  const fieldStyle: React.CSSProperties = {
    width: '100%',
    background: attrBg || excelCss.background || (disabled ? E9_COLORS.readOnlyBg : '#fff'),
    ...(disabled ? { color: '#999', borderColor: E9_COLORS.readOnlyBorder } : {}),
    ...(excelCss.color && !disabled ? { color: excelCss.color } : {}),
    ...excelFont,
  };

  const commonProps = {
    disabled,
    size: 'small' as const,
    status,
    style: fieldStyle,
  };

  const body = (() => {
    switch (meta.fieldType) {
      case 'text':
        return (
          <Input
            {...commonProps}
            value={value}
            placeholder={meta.placeholder || ''}
            maxLength={meta.length || 200}
            onChange={(e) => onChange(e.target.value)}
          />
        );

      case 'textarea':
        return (
          <TextArea
            {...commonProps}
            rows={3}
            value={value}
            placeholder={meta.placeholder || ''}
            onChange={(e) => onChange(e.target.value)}
          />
        );

      case 'number':
        return (
          <InputNumber
            {...commonProps}
            step="any"
            value={value === undefined ? undefined : value}
            onChange={(v) => onChange(v)}
          />
        );

      case 'wholeNumber':
        return (
          <InputNumber
            {...commonProps}
            step={1}
            value={value === undefined ? undefined : value}
            onChange={(v) => onChange(v)}
          />
        );

      case 'date':
        return (
          <DatePicker
            {...commonProps}
            style={{ width: '100%' }}
            format="YYYY-MM-DD"
            value={value || null}
            onChange={(d) => onChange(d)}
          />
        );

      case 'datetime':
        return (
          <DatePicker
            {...commonProps}
            showTime
            style={{ width: '100%' }}
            format="YYYY-MM-DD HH:mm:ss"
            value={value || null}
            onChange={(d) => onChange(d)}
          />
        );

      case 'select':
        return (
          <Select
            {...commonProps}
            placeholder="请选择"
            value={value === undefined ? undefined : value}
            onChange={(v) => onChange(v)}
            options={(meta.options || []).map((o) => ({ label: o.label, value: o.value }))}
          />
        );

      case 'radio':
        return (
          <Radio.Group
            disabled={disabled}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            options={(meta.options || []).map((o) => ({ label: o.label, value: o.value }))}
          />
        );

      case 'checkbox':
        return <Checkbox disabled={disabled} checked={!!value} onChange={(e) => onChange(e.target.checked)}>同意</Checkbox>;

      case 'attachment':
        return (
          <Button icon={<PaperClipOutlined />} disabled size="small">
            上传附件
          </Button>
        );

      case 'richtext':
        return (
          <div
            contentEditable={false}
            style={{
              border: '1px solid #d9d9d9',
              borderRadius: 4,
              padding: '4px 8px',
              minHeight: 50,
              background: '#fff',
              color: '#333',
            }}
          >
            {displayValue || <Text type="secondary">（富文本内容）</Text>}
          </div>
        );

      case 'group':
        return (
          <fieldset
            style={{
              border: '1px solid #d9d9d9',
              borderRadius: 4,
              padding: '8px 12px',
              margin: 0,
            }}
          >
            <legend style={{ fontWeight: 600, color: '#555', padding: '0 6px' }}>
              {displayValue || meta.fieldLabel}
            </legend>
          </fieldset>
        );

      case 'custom':
        return (
          <Text strong style={{ color: '#1890ff' }}>
            [自定义] {displayValue || meta.fieldLabel}
          </Text>
        );

      default:
        // 未知字段类型兜底为普通文本框，确保字段始终渲染为可交互控件（而非纯文本）
        return (
          <Input
            {...commonProps}
            value={value}
            placeholder={meta.placeholder || ''}
            onChange={(e) => onChange(e.target.value)}
          />
        );
    }
  })();

  // 只返回控件本身：标签、必填 * 与错误提示统一由外层 Form.Item 渲染
  return <>{body}</>;
};

// ──────────────────────────────────────────────
// Sheet 预览「表单」组件 — 对齐泛微 E9 ExcelDesign 预览格式
//
// 参照 ecology：src4js/pc4mobx/cube/src/components/excel-layout/
// E9 以 <table className="excelMainTable"> 渲染 Excel 布局：
//   - <colgroup> 列宽 + <tbody> 每行 <tr>（高度=行高）
//   - 每格 <td>（携带 rowSpan/colSpan 还原合并单元格）
//   - 单元格内容：标签(etype=2)→文本；字段(etype=3)→控件；静态文本→文本
// 本组件等比还原该网格结构（保留 Excel 行列与合并单元格），而非把字段拍平成横向表单。
// ──────────────────────────────────────────────

// 渲染单元格内容：标签文本 / 字段控件 / 静态文本
const renderCellNode = (
  cell: CellDataItem,
  key: string,
  sheetId: string,
  formValues: Record<string, any>,
  errors: Record<string, boolean>,
  onFieldChange: (k: string, v: any) => void,
  readOnly: boolean,
  requiredStar: boolean,
  attrBg?: string,
): React.ReactNode => {
  const meta = cell.fieldMeta;
  const rawValue = cell.v !== null && cell.v !== undefined ? String(cell.v) : '';
  const cleanRaw = rawValue.replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, '').trim();
  const displayValue = /^\$\{[^}]+\}$/.test(cleanRaw) ? '' : rawValue;

  // 纯文本 / 无字段元数据
  if (!meta) {
    return <span>{displayValue || ' '}</span>;
  }
  // 明细表标记格 → 蓝色徽标（设计器中点击可打开对应明细表的独立画布；
  // 预览中此处仅作占位标识，真正的明细表布局在下方「明细表N」嵌套区块渲染，
  // 以保证主表 + 明细表完整预览且数据关联可见）
  if (meta.cellType === 'detailTableMarker') {
    const dtIdx = meta.detailTable ?? '';
    const label = meta.fieldLabel || `明细表${dtIdx}`;
    return (
      <span
        style={{
          display: 'inline-block',
          background: '#0958d9',
          color: '#fff',
          fontWeight: 600,
          borderRadius: 4,
          padding: '1px 8px',
          fontSize: 12,
        }}
      >
        {label}
      </span>
    );
  }
  // 标签单元格 → 静态说明文本（必填 * 由 requiredStar 控制，E9 风格 * 在标签后）
  if (meta.cellType === 'label') {
    return (
      <span>
        {meta.fieldLabel || displayValue || ' '}
        {requiredStar && <span style={{ color: E9_COLORS.required, marginLeft: 2 }}>*</span>}
      </span>
    );
  }
  // 字段单元格 → 渲染控件（必填校验红色边框由 FieldCell 处理）
  const err = !!errors[key];
  return (
    <FieldCell
      cell={cell}
      row={0}
      col={0}
      sheetId={sheetId}
      value={formValues[key]}
      onChange={(v) => onFieldChange(key, v)}
      error={err}
      readOnly={readOnly}
      cellStyle={cell.s}
      attrBg={attrBg}
    />
  );
};

const SheetPreviewForm: React.FC<{
  sheet: SheetLayoutData;
  formValues: Record<string, any>;
  errors: Record<string, boolean>;
  onFieldChange: (key: string, v: any) => void;
  readOnly?: boolean;
  /** 表单值 key 前缀：主表传空，明细表子画布传 'dt{idx}__'，避免命名空间冲突 */
  keyPrefix?: string;
  /** 内联嵌套明细表：idx → 子画布布局；传入后，主表中含 detailTableMarker 标记的行会在其下方
   *  直接渲染对应明细表块（数据关联位置可见，对齐 ecology 明细表紧贴标记渲染的行为）。
   *  仅主表画布传入；明细表子画布自身不再二次内联。 */
  inlineDetailTables?: Record<number, any>;
}> = ({ sheet, formValues, errors, onFieldChange, readOnly, keyPrefix, inlineDetailTables }) => {
  const model = useMemo(() => {
    const cellData = sheet.cellData || {};
    const mergedCells = sheet.mergedCells || [];

    // 收集有值格子，并计算实际占用行列范围（含合并单元格覆盖区域）
    const localGrid: Record<number, Record<number, CellDataItem>> = {};
    let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;
    Object.entries(cellData).forEach(([rk, rowData]) => {
      const r = parseInt(rk, 10);
      if (isNaN(r)) return;
      localGrid[r] = localGrid[r] || {};
      Object.entries(rowData || {}).forEach(([ck, c]) => {
        const col = parseInt(ck, 10);
        if (isNaN(col)) return;
        localGrid[r][col] = c as CellDataItem;
        if (r < minRow) minRow = r;
        if (r > maxRow) maxRow = r;
        if (col < minCol) minCol = col;
        if (col > maxCol) maxCol = col;
      });
    });

    // 合并单元格：原点映射 + 被覆盖格集合（用于还原 Excel 网格合并）
    const cov = new Set<string>();
    const mMap = new Map<string, { rowSpan: number; colSpan: number }>();
    mergedCells.forEach((m) => {
      mMap.set(`${m.row}_${m.col}`, { rowSpan: m.rowSpan, colSpan: m.colSpan });
      for (let dr = 0; dr < m.rowSpan; dr++) {
        for (let dc = 0; dc < m.colSpan; dc++) {
          if (dr === 0 && dc === 0) continue;
          const rr = m.row + dr, cc = m.col + dc;
          cov.add(`${rr}_${cc}`);
          if (rr > maxRow) maxRow = rr;
          if (cc > maxCol) maxCol = cc;
        }
      }
    });

    const r0 = isFinite(minRow) ? minRow : 0;
    const r1 = maxRow >= minRow ? maxRow : (sheet.rowCount || 1) - 1;
    const c0 = isFinite(minCol) ? minCol : 0;
    const c1 = maxCol >= minCol ? maxCol : (sheet.colCount || 1) - 1;

    // 必填标签集合：必填字段左侧相邻（标签格）追加红色 *（E9 风格 * 在标签后）
    const reqLabels = new Set<string>();
    Object.entries(localGrid).forEach(([rk, rowData]) => {
      const r = parseInt(rk, 10);
      Object.entries(rowData || {}).forEach(([ck, c]) => {
        const col = parseInt(ck, 10);
        const meta = (c as CellDataItem).fieldMeta;
        const isReq = meta && meta.cellType === 'field' && (meta.fieldAttr === 3 || meta.required);
        if (isReq) {
          const left = localGrid[r]?.[col - 1];
          if (left && left.fieldMeta?.cellType === 'label') reqLabels.add(`${r}_${col - 1}`);
        }
      });
    });

    // 列宽 / 行高
    const columnData = sheet.columnData || {};
    const rowDataMap = sheet.rowData || {};
    const cw: (number | undefined)[] = [];
    const rh: (number | undefined)[] = [];
    for (let c = c0; c <= c1; c++) {
      const w = columnData[String(c)]?.w;
      cw.push(w && w > 0 ? w : undefined);
    }
    for (let r = r0; r <= r1; r++) {
      const h = rowDataMap[String(r)]?.h;
      rh.push(h && h > 0 ? h : undefined);
    }

    return {
      grid: localGrid,
      rowCount: r1 - r0 + 1,
      colCount: c1 - c0 + 1,
      startRow: r0,
      startCol: c0,
      covered: cov,
      mergeMap: mMap,
      requiredLabels: reqLabels,
      colWidths: cw,
      rowHeights: rh,
    };
  }, [sheet]);

  if (model.rowCount <= 0 || model.colCount <= 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Text type="secondary">工作表 "{sheet.name}" 暂无数据</Text>
      </div>
    );
  }

  // ── 对齐 E9 excelMainTable：以 <table> 还原 Excel 网格布局（行列 + 合并单元格）──
  // 卡片容器横向可滚动：大屏表格 width:100% 自适应铺满；窄屏（手机）minWidth 生效，整表按设计列宽横向滚动而非被压扁。
  const tableMinWidth = model.colWidths.reduce((a: number, w: any) => a + (Number(w) || 60), 0);
  return (
    <div style={{ background: '#fff', border: `1px solid ${E9_COLORS.cardBorder}`, borderRadius: 8, overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch' }}>
      <table
        className="excelMainTable"
        style={{ borderCollapse: 'collapse', width: '100%', minWidth: tableMinWidth, tableLayout: 'fixed', background: '#fff' }}
      >
        <colgroup>
          {model.colWidths.map((w, i) => (
            <col key={i} style={{ width: w ? `${w}px` : undefined }} />
          ))}
        </colgroup>
        <tbody>
          {Array.from({ length: model.rowCount }).map((_, ri) => {
            const r = model.startRow + ri;
            return (
              <tr key={r} style={{ height: model.rowHeights[ri] ? `${model.rowHeights[ri]}px` : undefined }}>
                {Array.from({ length: model.colCount }).map((_, ci) => {
                  const c = model.startCol + ci;
                  const key = `${r}_${c}`;
                  if (model.covered.has(key)) return null; // 被合并单元格覆盖，跳过
                  const merge = model.mergeMap.get(key);
                  const cell = model.grid[r]?.[c];

                  // 标记行：仅渲染标记格（全宽），同行其它列跳过，避免与 colSpan 冲突导致表格错乱
                  let markerCol = -1;
                  const rowCells = model.grid[r];
                  if (rowCells) {
                    for (const [ck, cc] of Object.entries(rowCells)) {
                      if ((cc as CellDataItem).fieldMeta?.cellType === 'detailTableMarker') { markerCol = Number(ck); break; }
                    }
                  }
                  if (markerCol >= 0 && c !== markerCol) return null;

                  // 明细表标记格：预览中不显示「明细表X」设计标记，仅内联渲染对应明细表的内容块
                  // （数据关联位置可见，对齐 ecology 明细表紧贴标记渲染；明细表标题由 DetailBlock 统一控制）
                  if (cell?.fieldMeta?.cellType === 'detailTableMarker') {
                    const dtIdx = Number(cell.fieldMeta.detailTable);
                    const dtLayout = inlineDetailTables?.[dtIdx];
                    return (
                      <td
                        key={c}
                        colSpan={model.colCount}
                        style={{
                          border: 'none',
                          padding: 0,
                          background: 'transparent',
                          verticalAlign: 'top',
                        }}
                      >
                        {dtLayout && (
                          <DetailBlock
                            layout={dtLayout}
                            prefix={`dt${dtIdx}__`}
                            formValues={formValues}
                            errors={errors}
                            onFieldChange={onFieldChange}
                            readOnly={!!readOnly}
                          />
                        )}
                      </td>
                    );
                  }
                  const isLabel = cell?.fieldMeta?.cellType === 'label';
                  const isField = cell?.fieldMeta?.cellType === 'field';
                  const cellAttr = isField ? cell?.fieldMeta?.fieldAttr : undefined;
                  const isBig = !!merge && (merge.colSpan > 1 || merge.rowSpan > 1);
                  // 文本对齐：标签右对齐（贴近字段）；跨列静态文本居中（标题/分组）；其余左对齐
                  let align: 'left' | 'right' | 'center' = 'left';
                  if (isLabel) align = 'right';
                  else if (!isField && isBig) align = 'center';

                  // 字段属性底色（与设计师一致，优先级高于 Excel 单元格背景色）：
                  //   1=只读 → 灰底(#f5f5f5) + 灰字   2=可编辑 → 白底   3=必填 → 浅红底(#fff1f0)
                  const excelCellCss = cellStyleToCss(cell?.s);
                  let tdBackground = excelCellCss.background || '#fff';
                  let tdColor = excelCellCss.color || '#333';
                  let attrBg: string | undefined;
                  if (cellAttr === 1) { tdBackground = '#f5f5f5'; tdColor = '#999'; attrBg = '#f5f5f5'; }
                  else if (cellAttr === 3) { tdBackground = '#fff1f0'; attrBg = '#fff1f0'; }

                  return (
                    <td
                      key={c}
                      rowSpan={merge?.rowSpan}
                      colSpan={merge?.colSpan}
                      style={{
                        border: `1px solid ${E9_COLORS.readOnlyBorder}`,
                        padding: '4px 8px',
                        verticalAlign: 'middle',
                        textAlign: align,
                        fontSize: 13,
                        ...excelCellCss,
                        background: tdBackground,
                        color: tdColor,
                        overflow: 'hidden',
                      }}
                    >
                      {cell
                        ? renderCellNode(
                            cell,
                            keyPrefix ? `${keyPrefix}${cellKey(sheet.id, r, c)}` : cellKey(sheet.id, r, c),
                            sheet.id,
                            formValues,
                            errors,
                            onFieldChange,
                            readOnly as boolean,
                            model.requiredLabels.has(key),
                            attrBg,
                          )
                        : ' '}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// 明细表嵌套块：渲染单个明细表子画布布局（多 sheet 竖向堆叠）。
// 主表标记格内联嵌套、与主表底部兜底（无标记的孤儿明细表）共用此组件；表单值 key 带 keyPrefix 命名空间。
// 预览中不显示「明细表N」标题（设计标记），仅渲染明细表字段内容。
const DetailBlock: React.FC<{
  layout: any;
  prefix: string;
  formValues: Record<string, any>;
  errors: Record<string, boolean>;
  onFieldChange: (k: string, v: any) => void;
  readOnly?: boolean;
}> = ({ layout, prefix, formValues, errors, onFieldChange, readOnly }) => {
  const dtSheets = extractSheets(layout);
  return (
    <div
      style={{
        marginTop: 8,
        background: '#fff',
        border: `1px solid ${E9_COLORS.cardBorder}`,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: 12 }}>
        {dtSheets.length === 0 ? (
          <Text type="secondary">暂无布局</Text>
        ) : (
          dtSheets.map((sheet, i) => (
            <SheetPreviewForm
              key={sheet.id || i}
              sheet={sheet}
              formValues={formValues}
              errors={errors}
              onFieldChange={onFieldChange}
              readOnly={readOnly}
              keyPrefix={prefix}
            />
          ))
        )}
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────
// 主预览弹窗组件
// ──────────────────────────────────────────────

interface ExcelPreviewProps {
  /** 布局数据（来自 UniverExcelGrid.saveLayoutData()） */
  layoutData: WorkbookLayoutData | null;
  /** 是否显示预览弹窗 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 预览标题 */
  title?: string;
  /** 预览态只读：true 时所有字段控件禁用，对应 ecology 显示/监控/打印布局（layouttype 0/3/4） */
  readOnly?: boolean;
  /**
   * 独立页面模式：true 时不套 Modal，直接全屏渲染表单内容。
   * 用于「新标签页预览」，对齐 ecology excelPreView 打开独立预览页的行为。
   */
  standalone?: boolean;
}

/**
 * Excel 设计器 - React 预览组件
 *
 * 使用 Ant Design 原生组件（Input、Select、DatePicker 等）直接渲染布局数据，
 * 不生成 HTML 字符串，保持与设计器一致的 React 技术栈。
 *
 * 对应 Ecology excelPreView.jsp 的功能，并作为真实表单呈现：
 *   - readonly（fieldAttr=1）字段禁用输入
 *   - required（fieldAttr=3）字段显示红色 * 并在提交时校验非空
 *   - editable（fieldAttr=2）字段正常可输入
 */
const ExcelPreview: React.FC<ExcelPreviewProps> = ({
  layoutData,
  open,
  onClose,
  title = '表单预览',
  readOnly = false,
  standalone = false,
}) => {
  // 解析出所有 sheet 列表
  const sheets = useMemo(() => {
    if (!layoutData?.sheets) return [];
    const order = layoutData.sheetOrder || Object.keys(layoutData.sheets);
    return order.map((id) => layoutData.sheets![id]).filter(Boolean);
  }, [layoutData]);

  // 解析各明细表子画布布局（detailTables[idx]），按序号升序；
  // 用于在预览中渲染「嵌套明细表」，与主表标记（detailTableMarker）一一对应，保证数据关联可见。
  // keyPrefix 用于隔离各明细表与主表的表单值命名空间，避免 sheetId 相同导致冲突。
  const detailBlocks = useMemo(() => {
    const dt = (layoutData as any)?.detailTables;
    if (!dt) return [];
    return Object.keys(dt)
      .map((k) => Number(k))
      .filter((idx) => dt[idx] && extractSheets(dt[idx]).length > 0)
      .sort((a, b) => a - b)
      .map((idx) => ({ idx, layout: dt[idx], prefix: `dt${idx}__` }));
  }, [layoutData]);

  // 主表中存在标记（detailTableMarker）的明细表序号集合：这些明细表改为标记格内联嵌套，
  // 不再在底部统一渲染（避免重复）；仅「无标记的孤儿明细表」保留底部兜底。
  const markerIdxSet = useMemo(() => {
    const s = new Set<number>();
    sheets.forEach((sheet) => {
      const cd = sheet.cellData || {};
      Object.values(cd).forEach((row) => {
        Object.values(row || {}).forEach((c: any) => {
          const meta = c?.fieldMeta;
          if (meta?.cellType === 'detailTableMarker' && meta.detailTable != null) s.add(Number(meta.detailTable));
        });
      });
    });
    return s;
  }, [sheets]);

  // 内联嵌套用的明细表布局映射（仅含有标记的序号）
  const detailLayoutMap = useMemo(() => {
    const m: Record<number, any> = {};
    detailBlocks.forEach((b) => { if (markerIdxSet.has(b.idx)) m[b.idx] = b.layout; });
    return m;
  }, [detailBlocks, markerIdxSet]);

  // 表单受控值 & 必填校验错误
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // 弹窗打开时重置
  useEffect(() => {
    if (open) {
      setFormValues({});
      setErrors({});
    }
  }, [open]);

  // 字段值变化：同步 state 并清除该字段的错误标记
  const handleFieldChange = useCallback((key: string, v: any) => {
    setFormValues((prev) => ({ ...prev, [key]: v }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: false } : prev));
  }, []);

  // 提交校验：遍历所有必填字段（含各明细表子画布），未填写则标记错误
  const handleSubmit = () => {
    const newErrors: Record<string, boolean> = {};
    // 主表 + 各明细表统一遍历，明细字段 key 带各自 keyPrefix 命名空间
    const blocks: { sheets: SheetLayoutData[]; prefix: string }[] = [
      { sheets, prefix: '' },
      ...detailBlocks.map((b) => ({ sheets: extractSheets(b.layout), prefix: b.prefix })),
    ];
    blocks.forEach(({ sheets: blockSheets, prefix }) => {
      blockSheets.forEach((sheet) => {
        const cellData = sheet.cellData || {};
        Object.entries(cellData).forEach(([rk, rowData]) => {
          const r = parseInt(rk, 10);
          Object.entries(rowData || {}).forEach(([ck, cell]) => {
            const c = parseInt(ck, 10);
            const meta = (cell as CellDataItem).fieldMeta;
            if (!meta || meta.cellType !== 'field' || !(meta.fieldAttr === 3 || meta.required)) return;
            const key = `${prefix}${cellKey(sheet.id, r, c)}`;
            const v = formValues[key];
            if (isEmptyValue(meta.fieldType, v)) {
              newErrors[key] = true;
            }
          });
        });
      });
    });

    setErrors(newErrors);
    const cnt = Object.keys(newErrors).length;
    if (cnt > 0) {
      message.error(`有 ${cnt} 个必填项未填写，请检查标红字段`);
    } else {
      message.success('校验通过，所有必填项均已填写');
    }
  };

  // 导出布局 JSON
  const handleDownload = () => {
    if (!layoutData) return;
    const blob = new Blob([JSON.stringify(layoutData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `layout-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 打印
  const handlePrint = () => {
    window.print();
  };

  // 预览主体（空态 / 工作表列表）：弹窗与独立页面共用
  const content = !layoutData ? (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <FileTextOutlined style={{ fontSize: 48, color: '#ccc', marginBottom: 16 }} />
      <div>
        <Text type="secondary">暂无布局数据，请先在设计器中编辑并保存</Text>
      </div>
    </div>
  ) : sheets.length === 0 && detailBlocks.length === 0 ? (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <Text type="warning">布局数据中没有工作表</Text>
    </div>
  ) : (
    <div className="excel-preview-react-container">
      {sheets.map((sheet, idx) => (
        <div key={sheet.id || idx} style={{ marginBottom: idx < sheets.length - 1 || detailBlocks.length > 0 ? 24 : 0 }}>
          <SheetPreviewForm
            sheet={sheet}
            formValues={formValues}
            errors={errors}
            onFieldChange={handleFieldChange}
            readOnly={readOnly}
            inlineDetailTables={detailLayoutMap}
          />
        </div>
      ))}
      {/* 底部兜底：仅渲染「无主表标记的孤儿明细表」；有标记的明细表已在对应标记格内联嵌套（数据关联位置可见） */}
      {detailBlocks.filter((b) => !markerIdxSet.has(b.idx)).map((b) => {
        const dtSheets = extractSheets(b.layout);
        return (
          <div
            key={`dt-${b.idx}`}
            style={{
              marginTop: 24,
              background: '#fff',
              border: `1px solid ${E9_COLORS.cardBorder}`,
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: 12 }}>
              {dtSheets.map((sheet, i) => (
                <SheetPreviewForm
                  key={sheet.id || i}
                  sheet={sheet}
                  formValues={formValues}
                  errors={errors}
                  onFieldChange={handleFieldChange}
                  readOnly={readOnly}
                  keyPrefix={b.prefix}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  // 操作按钮：弹窗里作为 footer，独立页面里作为顶部工具栏
  const actions = (
    <Space>
      <Button icon={<SendOutlined />} type="primary" onClick={handleSubmit}>
        提交校验
      </Button>
      <Button icon={<PrinterOutlined />} onClick={handlePrint}>
        打印
      </Button>
      <Button icon={<DownloadOutlined />} onClick={handleDownload}>
        导出JSON
      </Button>
      <Button icon={<CloseOutlined />} onClick={onClose}>
        {standalone ? '关闭页面' : '关闭'}
      </Button>
    </Space>
  );

  // 独立页面模式：不套 Modal，全屏渲染（用于新标签页预览，避免打开空白页签）
  // 默认支持手机端适配：窄屏减少内边距、头部操作区自动换行，配合表格卡片横向滚动。
  if (standalone) {
    return (
      <>
        <style>{`
          .excel-preview-page { width: 100%; box-sizing: border-box; }
          .excel-preview-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
          @media (max-width: 768px) {
            .excel-preview-page { padding: 8px !important; }
            .excel-preview-header { margin-bottom: 8px !important; }
            .excel-preview-header .ant-space { width: 100%; }
            .excel-preview-header .ant-space-item:last-child { margin-left: auto; }
          }
        `}</style>
        <div className="excel-preview-page" style={{ minHeight: '100vh', background: '#f0f2f5', padding: 24, boxSizing: 'border-box' }}>
          <div
            className="excel-preview-header"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
              background: '#fff',
              padding: '12px 16px',
              borderRadius: 8,
            }}
          >
            <Typography.Title level={4} style={{ margin: 0 }}>
              {title}
            </Typography.Title>
            {actions}
          </div>
          {content}
        </div>
      </>
    );
  }

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      width={1000}
      footer={actions}
      destroyOnHidden
      styles={{
        body: {
          padding: '0',
          height: 'calc(100vh - 130px)',
          overflow: 'auto',
          background: '#f0f2f5',
        },
      }}
    >
      {content}
    </Modal>
  );
};

export default ExcelPreview;
