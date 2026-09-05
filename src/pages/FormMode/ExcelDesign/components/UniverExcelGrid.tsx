import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, App, Button, Spin } from 'antd';
import { useDrop } from 'react-dnd';
import { Univer, LocaleType, UniverInstanceType, mergeLocales } from '@univerjs/core';
import { UniverRenderEnginePlugin } from '@univerjs/engine-render';
import { UniverFormulaEnginePlugin } from '@univerjs/engine-formula';
import { UniverUIPlugin } from '@univerjs/ui';
import { UniverSheetsPlugin } from '@univerjs/sheets';
import { UniverSheetsUIPlugin } from '@univerjs/sheets-ui';
import { UniverDocsPlugin } from '@univerjs/docs';
import { UniverDocsUIPlugin } from '@univerjs/docs-ui';
import { UniverSheetsFormulaPlugin } from '@univerjs/sheets-formula';
import { UniverSheetsFormulaUIPlugin } from '@univerjs/sheets-formula-ui';
import { UniverSheetsNumfmtPlugin } from '@univerjs/sheets-numfmt';
import { UniverSheetsNumfmtUIPlugin } from '@univerjs/sheets-numfmt-ui';
import { UniverSheetsDataValidationPlugin } from '@univerjs/sheets-data-validation';

// 关键：导入 sheets facade 侧效应，为 FUniver 添加 createWorkbook 等方法
// 必须在导入 FUniver 之前执行
import '@univerjs/sheets/facade';

// 导入 FUniver 类（Facade API 的入口）
// FUniver 需要通过 FUniver.newAPI(univer) 来创建实例，不能直接 new FUniver()
import { FUniver } from '@univerjs/core/facade';

// 关键：导入 sheets-ui facade 侧效应，为 FWorksheet 添加 hitTest 等方法
// 这行代码会执行 FWorksheet.extend(FWorksheetUIMixin)，将 hitTest 方法添加到 FWorksheet 原型上
import '@univerjs/sheets-ui/facade';

// 手动确保 FWorksheet 原型上有 hitTest 方法
// 解决模块实例不一致的问题
// 注意：FWorksheetUIMixin 是内部类，不能直接导入
// 正确的方法是导入 @univerjs/sheets-ui/facade 模块（副作用导入），它会自动执行 FWorksheet.extend(FWorksheetUIMixin)
import { FWorksheet } from '@univerjs/sheets/facade';
import '@univerjs/sheets-ui/facade';

// 在运行时手动调用 extend（如果上面的副作用导入没有生效）
try {
  // 动态导入以触发副作用
  require('@univerjs/sheets-ui/facade');
} catch (e) {
  console.warn('[Init] 无法导入 @univerjs/sheets-ui/facade:', e);
}

// 导入语言包
import DesignZhCN from '@univerjs/design/locale/zh-CN';
import UIZhCN from '@univerjs/ui/locale/zh-CN';
import DocsUIZhCN from '@univerjs/docs-ui/locale/zh-CN';
import SheetsZhCN from '@univerjs/sheets/locale/zh-CN';
import SheetsUIZhCN from '@univerjs/sheets-ui/locale/zh-CN';
import SheetsFormulaUIZhCN from '@univerjs/sheets-formula-ui/locale/zh-CN';
import SheetsNumfmtUIZhCN from '@univerjs/sheets-numfmt-ui/locale/zh-CN';
import SheetsDataValidationZhCN from '@univerjs/sheets-data-validation/locale/zh-CN';

// 导入样式（注意顺序：design -> ui -> 其他）
import '@univerjs/design/lib/index.css';
import '@univerjs/ui/lib/index.css';
import '@univerjs/docs-ui/lib/index.css';
import '@univerjs/sheets-ui/lib/index.css';
import '@univerjs/sheets-formula-ui/lib/index.css';
import '@univerjs/sheets-numfmt-ui/lib/index.css';

/**
 * 将保存的单元格样式（IStyleData）应用到 range。
 * 逐个属性还原，单属性失败不影响整表加载。覆盖：字体(ff/fs/cl)、粗体/斜体/下划线/删除线(bl/it/ul/st)、
 * 背景(bg)、水平/垂直对齐(ht/vt)、自动换行(tb)。
 * 注：边框(bd)结构较复杂，此处不还原（网格线由 Univer 自带，避免误设破坏布局）。
 */
const applyCellStyle = (range: any, style: any) => {
  if (!range || !style || typeof style !== 'object') return;
  const safe = (fn: () => void) => {
    try { fn(); } catch { /* 单个样式属性失败不影响整体加载 */ }
  };
  if (style.bl !== undefined && style.bl !== null) safe(() => range.setFontWeight(style.bl ? 'bold' : 'normal'));
  if (style.it !== undefined && style.it !== null) safe(() => range.setFontStyle(style.it ? 'italic' : 'normal'));
  if (style.ul && style.ul.s) safe(() => range.setFontLine('underline'));
  else if (style.ul !== undefined) safe(() => range.setFontLine('none'));
  if (style.st && style.st.s) safe(() => range.setFontLine('line-through'));
  if (style.ff) safe(() => range.setFontFamily(style.ff));
  if (style.fs) safe(() => range.setFontSize(style.fs));
  if (style.cl && style.cl.rgb) safe(() => range.setFontColor(style.cl.rgb));
  if (style.bg && style.bg.rgb) safe(() => range.setBackgroundColor(style.bg.rgb));
  if (style.ht) safe(() => range.setHorizontalAlignment(style.ht));
  if (style.vt) safe(() => range.setVerticalAlignment(style.vt));
  if (typeof style.tb !== 'undefined') safe(() => range.setWrap(!!style.tb));
};

// ──────────────────────────────────────
// 字段类型常量 - 与 FieldPalette 保持一致
// 参照迁移文档 §6.2 数据验证类型映射
// ──────────────────────────────────────
const FIELD_TYPE_META = {
  label:     { label: '标签',     category: '静态文本', validationType: null },
  text:      { label: '单行文本', category: '基础字段', validationType: 'textLength', maxLength: 200 },
  textarea:  { label: '多行文本', category: '文本字段', validationType: 'textLength', maxLength: 4000 },
  number:    { label: '数字',     category: '基础字段', validationType: 'decimal' },
  wholeNumber: { label: '整数',   category: '基础字段', validationType: 'wholeNumber' },
  date:      { label: '日期',     category: '基础字段', validationType: 'date' },
  datetime:  { label: '日期时间', category: '基础字段', validationType: 'date' },
  select:    { label: '下拉框',   category: '选择字段', validationType: 'list' },
  checkbox:  { label: '复选框',   category: '选择字段', validationType: 'checkbox' },
  radio:     { label: '单选框',   category: '选择字段', validationType: 'list' },
  attachment:{ label: '附件',     category: '高级字段', validationType: null },
  richtext:  { label: '富文本',   category: '文本字段', validationType: 'textLength', maxLength: 65535 },
  group:     { label: '分组框',   category: '布局字段', validationType: null },
  custom:    { label: '自定义',   category: '高级字段', validationType: 'custom' },
} as const;

type FieldType = keyof typeof FIELD_TYPE_META;

/**
 * 字段元数据接口 - 对应 PropertyPanel 所有配置项
 * 参照迁移文档 §4.3 单元格操作 API 映射 + §6 数据验证
 */
interface FieldMeta {
  fieldId?: string | number;
  fieldName: string;
  fieldLabel: string;
  fieldType: FieldType;
  /** 单元格类型：label=静态标签文本（仅展示，不可输入），field=数据绑定字段（可输入） */
  cellType?: 'label' | 'field';
  required: boolean;
  readonly: boolean;
  /** 字段属性：1=只读 2=可编辑 3=必填（参照 ecology fieldAttrMap） */
  fieldAttr?: number;
  defaultValue?: string;
  placeholder?: string;
  length?: number;
  tooltip?: string;
  /** 下拉/单选选项列表 */
  options?: { label: string; value: string }[];
  /** 验证规则（扩展字段）- 参照迁移文档 §6.1 */
  validationRule?: {
    type: string;
    operator?: string;
    formula1?: string;
    formula2?: string;
    allowBlank?: boolean;
    showInputMessage?: boolean;
    inputMessage?: string;
    showErrorMessage?: boolean;
    errorMessage?: string;
    errorTitle?: string;
    };
    }

    /** 字段类型 → 单元格图标前缀（仅设计器内可视化用） */
    const FIELD_ICON_MAP: Record<string, string> = {
    label: '',
    text: '📝',
    textarea: '',
    number: '🔢',
    wholeNumber: '🔢',
    date: '📅',
    datetime: '',
    select: '🔽',
    checkbox: '☑️',
    radio: '',
    attachment: '📎',
    richtext: '📝',
    group: '📦',
    custom: '⚙️',
    };

    /** 受保护（锁定）单元格的视觉样式：灰底 + 灰字，表示不可手动编辑 */
    const LOCKED_CELL_BG = '#f0f0f0';
    const LOCKED_CELL_FONT = '#8c8c8c';

    /**
     * 字段单元格视觉样式（唯一决策点，参照 ecology getCellFieldImage）
     * 背景色由 fieldAttr 唯一决定，label 标签格不应用背景色：
     *   1=只读 → 灰底灰字   2=可编辑 → 白底黑字   3=必填 → 浅红底黑字
     *   setCellField 与 setFieldAttr 共用此函数，避免两处上色逻辑不一致导致"切不回去"。
     */
    const applyFieldAttrStyle = (range: any, meta: FieldMeta) => {
      if (!range || !meta || meta.cellType !== 'field') return;
      let bg = LOCKED_CELL_BG;
      let font = LOCKED_CELL_FONT;
      if (meta.fieldAttr === 1) {
        bg = '#f5f5f5'; font = '#999999';
      } else if (meta.fieldAttr === 2) {
        bg = '#ffffff'; font = '#000000';
      } else if (meta.fieldAttr === 3) {
        bg = '#fff1f0'; font = '#000000';
      }
      try {
        range.setBackground(bg);
        range.setFontColor(font);
      } catch (e) {
        console.warn('[applyFieldAttrStyle] 设置样式失败', e);
      }
    };

    /**
    * 计算单元格的期望显示值（设计器写入单元格的内容）
    * - 标签(cellType=label)：标签文字，静态说明文本
    * - 字段(cellType=field)：图标 + ${字段名} 占位符，标记数据绑定
    */
    const getCellDisplayValue = (meta: FieldMeta): string => {
    if (meta.cellType === 'label') {
      return meta.fieldLabel || meta.fieldName || '';
    }
    const typeIcon = FIELD_ICON_MAP[meta.fieldType] ?? '📝';
    // 字段属性图标（参照 ecology viewAttr）：1=只读🔒 3=必填⚠️；2=可编辑不额外加图标
    const attrIcon = meta.fieldAttr === 1 ? '🔒' : meta.fieldAttr === 3 ? '⚠️' : '';
    const iconPart = [attrIcon, typeIcon].filter(Boolean).join(' ');
    const placeholder = `\${${meta.fieldName}}`;
    return iconPart ? `${iconPart} ${placeholder}` : placeholder;
    };

    /** 剥离单元格值中的图标前缀（覆盖全部象形符号，含 ☑️、⚙️） */
    const stripFieldIcon = (value: string): string =>
    value.replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, '').trim();

    /**
    * 判断单元格当前值是否与字段元数据匹配
    * （用于保存校验与防篡改拦截：被改成其他内容即视为不匹配）
    */
    const isCellValueMatchMeta = (value: unknown, meta: FieldMeta): boolean => {
    const actual = String(value ?? '');
    const expected = getCellDisplayValue(meta);
    return actual === expected || stripFieldIcon(actual) === stripFieldIcon(expected);
    };

/**
 * 单元格数据结构 - 参照迁移文档 §9 JSON 序列化格式
 * 支持 SpreadJS 兼容格式 + Univer 原生格式
 */
interface CellDataItem {
  v: string | number | boolean | null;  // 单元格显示值
  m?: string;                            // 原始值（SpreadJS 兼容）
  t?: number;                            // 单元格类型标记
  s?: any;                               // 单元格样式（IStyleData，含字体/背景/对齐/边框等）
  fieldMeta?: FieldMeta;                 // 字段元数据
  tag?: string;                          // 自定义标签
}

/**
 * 工作表布局数据结构 - 参照迁移文档 §9.1
 * Univer JSON 格式
 */
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

/**
 * 工作簿布局数据结构 - 参照迁移文档 §9.1
 */
interface WorkbookLayoutData {
  id: string;
  name?: string;
  sheetOrder: string[];
  sheets: Record<string, SheetLayoutData>;
  version: string;
  // SpreadJS 兼容字段（§9.2）
  spreadCompat?: {
    version?: string;
    data?: { dataTable: any[][] };
  };
}

interface UniverExcelGridProps {
  sheetName: string;
  layoutData: any;
  onLayoutChange: (data: any) => void;
  formId?: string;
  /** 待放置字段（从 FieldPalette 选中） */
  pendingField?: any;
  /** 悬停字段（从 FieldPalette hover）→ 高亮对应单元格 */
  hoveredField?: any;
  /**
   * 布局模板类型（参照 ecology layouttype）：
   *   1=新建 / 2=编辑 → 可编辑模板（字段属性按字段设置生效）
   *   0=显示 / 3=监控 / 4=打印 → 只读模板（加载时所有字段强制只读，对应 ecology resumeSheetData:808）
   * 不传则回退读 data.layoutType，再无则视为可编辑模板。
   */
  layoutType?: number | string;
  /** 直接声明只读（如预览态），优先级高于 layoutType */
  readOnly?: boolean;
}

const UniverExcelGrid: React.FC<UniverExcelGridProps> = ({
  sheetName,
  layoutData,
  onLayoutChange,
  formId,
  pendingField,
  hoveredField,
  layoutType,
  readOnly,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const univerRef = useRef<any>(null);
  const workbookRef = useRef<any>(null);
  const [workbook, setWorkbook] = useState<any>(null);
  const [initialized, setInitialized] = useState<boolean>(false);
  const [initError, setInitError] = useState<string>('');
  const sheetRef = useRef<any>(null);
  const { message } = App.useApp();

  // ──────────────────────────────────────
  // 字段悬停高亮状态
  // ──────────────────────────────────────
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);
  const [hoverStyle, setHoverStyle] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [hoverVisible, setHoverVisible] = useState(false);
  const hoverTimerRef = useRef<any>(null);

  // 监听 hoveredField 变化 → 找到对应单元格 → 计算位置
  useEffect(() => {
    // 清除之前的定时器
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }

    if (!hoveredField || !workbook) {
      // 鼠标离开字段 → 先触发 opacity 过渡隐藏，等待过渡完成后再移除 DOM
      // 这样 CSS transition 才能播放淡出动画
      setHoverStyle((prev) => prev ? { ...prev } : null); // 保持位置不变
      hoverTimerRef.current = setTimeout(() => {
        setHoverVisible(false);
        setHoveredCell(null);
      }, 350); // 等待过渡完成（0.3s + 50ms 余量）
      return;
    }

    // 搜索 cellFieldMetaMap 找到匹配的单元格
    const fieldId = hoveredField.id;
    let foundCell: { row: number; col: number } | null = null;

    for (const [cellKey, meta] of Object.entries(cellFieldMetaMap.current)) {
      const metaFieldId = (meta as any).fieldId || (meta as any).id;
      if (metaFieldId === fieldId || metaFieldId === String(fieldId)) {
        const [r, c] = cellKey.split('_').map(Number);
        if (!isNaN(r) && !isNaN(c)) {
          foundCell = { row: r, col: c };
          break;
        }
      }
    }

    if (foundCell) {
      setHoveredCell(foundCell);
      // 计算位置在下一帧（等 hoveredCell 更新）
    } else {
      setHoveredCell(null);
      // 先触发淡出过渡
      hoverTimerRef.current = setTimeout(() => {
        setHoverVisible(false);
      }, 350);
    }
  }, [hoveredField, workbook]);

  // 当 hoveredCell 变化时，计算位置
  useEffect(() => {
    if (!hoveredCell || !workbook) {
      return;
    }

    try {
      const fWorkbook: any = workbook;
      const sheet = fWorkbook.getActiveSheet();
      if (!sheet) return;

      const { row, col } = hoveredCell;

      // 使用 getCellRect 获取单元格的像素位置（相对于 canvas/sheet 内容区）
      // 这是最精准的方式，由 Univer Skeleton 计算，考虑了滚动、缩放、合并单元格等所有因素
      let rect = null;
      if (typeof (sheet as any).getCellRect === 'function') {
        rect = (sheet as any).getCellRect(row, col);
      }

      if (!rect) {
        console.warn('[Hover] getCellRect 不可用，使用降级方案');
        // 降级：使用累加计算（不可靠，仅作兜底）
        let left = 0;
        for (let c = 0; c < col; c++) {
          let w = typeof sheet.getColumnWidth === 'function' ? sheet.getColumnWidth(c) : 73;
          if (!w || w <= 0) w = 73;
          left += w;
        }
        let top = 0;
        for (let r = 0; r < row; r++) {
          let h = typeof sheet.getRowHeight === 'function' ? sheet.getRowHeight(r) : 24;
          if (!h || h <= 0) h = 24;
          top += h;
        }
        const width = (typeof sheet.getColumnWidth === 'function' ? sheet.getColumnWidth(col) : 73) || 73;
        const height = (typeof sheet.getRowHeight === 'function' ? sheet.getRowHeight(row) : 24) || 24;
        rect = { left, top, width, height };
      }

      // getCellRect 返回的是相对于 sheet 内容区（左上角）的像素坐标
      // 高亮框是绝对定位在 container 中的，需要加上 sheet 内容区在 container 内的偏移
      // 这个偏移 = canvas 元素在 container 内的偏移（即行头宽度 + 列头高度）
      const canvasEl = containerRef.current?.querySelector('canvas');
      let offsetX = 0;
      let offsetY = 0;
      if (canvasEl) {
        const canvasRect = canvasEl.getBoundingClientRect();
        const containerRect = containerRef.current!.getBoundingClientRect();
        // canvas 相对于 viewport 的偏移 减去 container 相对于 viewport 的偏移
        offsetX = canvasRect.left - containerRect.left + (containerRef.current?.scrollLeft || 0);
        offsetY = canvasRect.top - containerRect.top + (containerRef.current?.scrollTop || 0);
      }

      const newStyle = {
        left: rect.left + offsetX,
        top: rect.top + offsetY,
        width: rect.width,
        height: rect.height,
      };
      setHoverStyle(newStyle);

      // 调试：输出高亮框位置
      console.log('[Hover] 高亮框位置:', {
        row, col,
        rect,
        offsetX: offsetX.toFixed(1),
        offsetY: offsetY.toFixed(1),
        finalLeft: newStyle.left.toFixed(1),
        finalTop: newStyle.top.toFixed(1),
        hoverVisible,
      });

      // 如果是新位置（从 null 或不同位置过来），先瞬间移到新位置再显示
      if (!hoverVisible) {
        setHoverVisible(true);
      }
    } catch (e) {
      console.warn('[Hover] 计算单元格位置失败:', e);
    }
  }, [hoveredCell, workbook, hoverVisible]);

  // ──────────────────────────────────────
  // 字段类型 → 数据验证规则映射
  // 参照迁移文档 §6.2 验证类型映射表
  // ──────────────────────────────────────
  const buildValidationRule = useCallback((fieldMeta: FieldMeta) => {
    const { fieldType, required, options } = fieldMeta;
    const meta = FIELD_TYPE_META[fieldType as FieldType];
    if (!meta || !meta.validationType) return null;

    switch (meta.validationType) {
      // SpreadJS: CellValidationType.list → Univer: DataValidationType.LIST (§6.2)
      case 'list':
        return {
          type: 'list',
          formula1: options?.map(o => o.label).join(',') || '',
          allowBlank: !required,
          showErrorMessage: true,
          errorMessage: `请从列表中选择有效值`,
          errorTitle: '输入无效',
        };
      // SpreadJS: CellValidationType.decimal → Univer: DataValidationType.DECIMAL (§6.2)
      case 'decimal':
        return {
          type: 'decimal',
          allowBlank: !required,
          showErrorMessage: true,
          errorMessage: '请输入有效数字',
          errorTitle: '输入无效',
        };
      // SpreadJS: CellValidationType.wholeNumber → Univer: DataValidationType.WHOLE_NUMBER (§6.2)
      case 'wholeNumber':
        return {
          type: 'wholeNumber',
          operator: 'between',
          formula1: '0',
          formula2: '999999999',
          allowBlank: !required,
          showErrorMessage: true,
          errorMessage: '请输入有效整数',
          errorTitle: '输入无效',
        };
      // SpreadJS: CellValidationType.textLength → Univer: DataValidationType.TEXT_LENGTH (§6.2)
      case 'textLength':
        return {
          type: 'textLength',
          operator: 'lessThanOrEqual',
          formula1: String(fieldMeta.length || meta.maxLength || 200),
          allowBlank: !required,
          showErrorMessage: true,
          errorMessage: `输入内容不能超过 ${fieldMeta.length || meta.maxLength || 200} 个字符`,
          errorTitle: '输入无效',
        };
      // SpreadJS: CellValidationType.dateTime → Univer: DataValidationType.DATE (§6.2)
      case 'date':
        return {
          type: 'date',
          allowBlank: !required,
          showErrorMessage: true,
          errorMessage: '请输入有效日期（格式：YYYY-MM-DD）',
          errorTitle: '输入无效',
        };
      // SpreadJS: CellValidationType.custom → Univer: DataValidationType.FORMULA (§6.2)
      case 'custom':
        return {
          type: 'custom',
          formula1: fieldMeta.validationRule?.formula1 || '',
          allowBlank: !required,
          showErrorMessage: true,
          errorMessage: fieldMeta.validationRule?.errorMessage || '输入不符合自定义规则',
          errorTitle: fieldMeta.validationRule?.errorTitle || '输入无效',
        };
      case 'checkbox':
        return null; // 复选框无需验证
      default:
        return null;
    }
  }, []);

  // ──────────────────────────────────────
  // 字段类型 → 单元格样式映射
  // 参照迁移文档 §8 样式系统迁移
  // ──────────────────────────────────────
  const buildCellStyle = useCallback((fieldMeta: FieldMeta): any => {
    const style: any = {};
    const { fieldType, required, readonly } = fieldMeta;

    // 参照 §8: SpreadJS style → Univer TextStyle 映射

    // 必填字段 - 左侧红色标记
    if (required) {
      style.borderLeft = { style: 'medium', color: '#ff4d4f' };
    }

    // 只读字段 - 灰色背景 + 浅色文字
    if (readonly) {
      style.backgroundColor = '#f5f5f5';
      style.color = '#999';
    }

    // 文本类字段 - 左对齐
    if (fieldType === 'text' || fieldType === 'textarea' || fieldType === 'richtext') {
      style.horizontalAlignment = 0; // LEFT
    }

    // 数字/整数/日期/日期时间 - 右对齐
    if (fieldType === 'number' || fieldType === 'wholeNumber' || fieldType === 'date' || fieldType === 'datetime') {
      style.horizontalAlignment = 1; // RIGHT
    }

    // 选择类字段（下拉框/单选框）- 居中
    if (fieldType === 'select' || fieldType === 'radio') {
      style.horizontalAlignment = 2; // CENTER
    }

    // 日期类型 - 使用特定格式
    if (fieldType === 'date') {
      style.format = 'yyyy-MM-dd';
    }
    if (fieldType === 'datetime') {
      style.format = 'yyyy-MM-dd HH:mm:ss';
    }

    // 数字类型 - 保留两位小数
    if (fieldType === 'number') {
      style.format = '#,##0.##';
    }

    // 分组框 - 粗体 + 背景色
    if (fieldType === 'group') {
      style.fontWeight = 'bold';
      style.backgroundColor = '#fafafa';
      style.borderBottom = { style: 'thin', color: '#d9d9d9' };
    }

    return style;
  }, []);

  // ──────────────────────────────────────
  // 设置数据验证
  // 参照迁移文档 §6.1 数据验证迁移代码
  // ──────────────────────────────────────
  const setDataValidation = useCallback((sheet: any, row: number, col: number, rule: any) => {
    if (!rule) return;
    try {
      // 参照 §6.1: sheet.getDataValidations().add(range, dataValidation)
      const colChar = String.fromCharCode(65 + col);
      const rangeStr = `${colChar}${row + 1}:${colChar}${row + 1}`;

      if (sheet.getDataValidations) {
        sheet.getDataValidations().add(rangeStr, rule);
      } else {
        console.warn('当前 Univer 版本不支持 getDataValidations API');
      }
    } catch (e) {
      console.warn('设置数据验证失败:', e);
    }
  }, []);

  // ──────────────────────────────────────
  // 设置单元格字段元数据 + 样式 + 验证
  // 使用 Facade API: FWorksheet.getRange() 返回 FRange
  // 注意：FRange 没有 setNote 方法，字段元数据通过单独的 Map 存储
  // ──────────────────────────────────────
  const cellFieldMetaMap = useRef<Record<string, FieldMeta>>({});

  /**
   * 解析某坐标对应的字段 ID —— 字段属性按 fieldId 关联（参照 ecology：属性按字段ID存储，非按坐标）。
   * 优先取本格；若本格无元数据（如右键/选中落在「标签格」，而元数据挂在「字段输入格」），
   * 则回退到相邻格（上/下/左/右），覆盖「标签在字段左侧」的常规布局，确保总能定位到字段。
   */
  /**
   * 从多来源解析单元格字段元数据（含相邻回退）：
   *   1) 内存 cellFieldMetaMap（当前会话最实时）
   *   2) 持久化 layoutDataRef（刷新后 Map 可能因时序被清空，但布局已加载、含 fieldMeta）
   * 命中 layoutData 时同步回写 Map，避免后续操作再次查不到。
   * 这是「刷新后右键只读/可编辑/必填切不了」「属性高亮失效」的根治：
   * setFieldAttr / resolveCellFieldId 不再单点依赖易失的 Map。
   */
  /**
   * 第三层兜底：从表格实际内容反解字段元数据。
   * 当内存 Map 与持久化布局都为空（元数据丢失/未落库），但只要字段仍画在表上
   * （字段格含 `${fieldName}` 占位符），即可扫描整表重建该字段的元数据（字段格 + 相邻标签格），
   * 回写 Map，使「只读/可编辑/必填」切换仍能生效。属自愈机制：切换后保存即把元数据重新落库。
   */
  const rebuildFieldMetaFromSheet = (fieldName: string, sheet: any, hitRow: number, hitCol: number): { key: string; meta: any } | null => {
    // 优先用持久化布局里该 fieldName 的真实元数据（含正确 fieldId/fieldType/校验规则）
    let baseMeta: any = null;
    try {
      const sd = layoutDataRef.current ? resolveSheetData(layoutDataRef.current) : null;
      const cd = sd?.cellData;
      if (cd) {
        for (const rd of Object.values(cd) as any[]) {
          for (const cell of Object.values(rd || {}) as any[]) {
            const fm = (cell as any)?.fieldMeta;
            if (fm?.fieldName === fieldName) { baseMeta = fm; break; }
          }
          if (baseMeta) break;
        }
      }
    } catch { /* ignore */ }

    const maxRows = typeof sheet.getMaxRows === 'function' ? Math.min(sheet.getMaxRows(), 200) : 50;
    const maxCols = typeof sheet.getMaxColumns === 'function' ? Math.min(sheet.getMaxColumns(), 50) : 26;
    let hitKey: string | null = null;
    const found: Array<[string, any]> = [];

    for (let r = 0; r < maxRows; r++) {
      for (let c = 0; c < maxCols; c++) {
        let v = '';
        try { v = String(sheet.getRange(r, c).getValue() ?? ''); } catch { continue; }
        if (!v.includes('${' + fieldName + '}')) continue;
        const cellKey = `${r}_${c}`;
        let fieldAttr = 2;
        if (v.includes('🔒')) fieldAttr = 1; else if (v.includes('⚠️')) fieldAttr = 3;
        const meta: any = {
          ...(baseMeta || {}),
          fieldId: baseMeta?.fieldId ?? fieldName,
          fieldName,
          cellType: 'field',
          fieldAttr,
          readonly: fieldAttr === 1,
          required: fieldAttr === 3,
        };
        cellFieldMetaMap.current[cellKey] = meta;
        found.push([cellKey, meta]);
        if (r === hitRow && c === hitCol) hitKey = cellKey;
        // 相邻标签格（左一格）：无占位符的纯文本即视为该字段标签
        if (c - 1 >= 0) {
          const lk = `${r}_${c - 1}`;
          if (!cellFieldMetaMap.current[lk]) {
            let lv = '';
            try { lv = String(sheet.getRange(r, c - 1).getValue() ?? ''); } catch { lv = ''; }
            if (lv && !lv.includes('${')) {
              cellFieldMetaMap.current[lk] = {
                ...(baseMeta || {}),
                fieldId: baseMeta?.fieldId ?? fieldName,
                fieldName,
                cellType: 'label',
                fieldLabel: lv,
                fieldAttr,
                readonly: fieldAttr === 1,
                required: fieldAttr === 3,
              };
            }
          }
        }
      }
    }

    if (!found.length) return null;
    const finalKey = hitKey ?? found[0][0];
    return { key: finalKey, meta: cellFieldMetaMap.current[finalKey] };
  };

  const lookupCellMeta = (row: number, col: number): { key: string; meta: any } | null => {
    // 候选窗口：本格 + 相邻(±1) + 扩展(±3列/±1行)。
    // 右击常落在字段右缘外侧（实测偏移 2 列：字段在 (1,1)、命中 (1,3)），
    // 仅查相邻 4 格够不到，必须扩大窗口并按距离优先取最近字段。
    const R = 1, C = 3;
    const candidates: Array<[number, number]> = [];
    for (let dr = -R; dr <= R; dr++) {
      for (let dc = -C; dc <= C; dc++) {
        const r = row + dr, c = col + dc;
        if (r >= 0 && c >= 0) candidates.push([r, c]);
      }
    }
    candidates.sort(
      (a, b) =>
        Math.abs(a[0] - row) + Math.abs(a[1] - col) - (Math.abs(b[0] - row) + Math.abs(b[1] - col)),
    );

    // 1) 内存 Map（当前会话最实时）
    for (const [r, c] of candidates) {
      const m = cellFieldMetaMap.current[`${r}_${c}`];
      if (m?.fieldId) return { key: `${r}_${c}`, meta: m };
    }

    // 2) 持久化布局兜底（刷新后 Map 可能为空，但 layoutData 已加载、含 fieldMeta）
    const data = layoutDataRef.current;
    const sheetData = data ? resolveSheetData(data) : null;
    const cellData = sheetData?.cellData;
    if (cellData) {
      for (const [r, c] of candidates) {
        const cell = cellData[r]?.[c] || cellData[String(r)]?.[String(c)];
        const fm = cell?.fieldMeta;
        if (fm?.fieldId) {
          const key = `${r}_${c}`;
          cellFieldMetaMap.current[key] = fm; // 同步回 Map
          return { key, meta: fm };
        }
      }
    }

    // 3) 单元格实际内容兜底：只要字段仍画在表上（字段格含 ${fieldName} 占位符），
    //    扫描整表重建该字段元数据（字段格 + 相邻标签格）并写回 Map，确保属性切换必能生效。
    const sheet3 = workbookRef.current?.getActiveSheet?.();
    if (sheet3) {
      let targetName: string | null = null;
      for (const [r, c] of candidates) {
        try {
          const v = String(sheet3.getRange(r, c).getValue() ?? '');
          const mm = v.match(/\$\{([^}]+)\}/);
          if (mm) { targetName = mm[1]; break; }
        } catch { /* ignore */ }
      }
      if (targetName) {
        const rebuilt = rebuildFieldMetaFromSheet(targetName, sheet3, row, col);
        if (rebuilt) return rebuilt;
      }
    }
    return null;
  };

  const resolveCellFieldId = (row: number, col: number): string | null => {
    const r = lookupCellMeta(row, col);
    return r ? String(r.meta.fieldId) : null;
  };

  /** 解析某坐标对应的字段元数据（含相邻回退 + 布局兜底），供右键菜单高亮当前属性用 */
  const resolveCellMeta = (row: number, col: number): FieldMeta | null => {
    const r = lookupCellMeta(row, col);
    if (!r) return null;
    const direct = cellFieldMetaMap.current[`${row}_${col}`];
    if (direct?.fieldId) return direct as FieldMeta;
    return (Object.values(cellFieldMetaMap.current).find(
      (m: any) => String(m?.fieldId) === String(r.meta.fieldId)
    ) as FieldMeta) || (r.meta as FieldMeta) || null;
  };

  // 标记是否正在放置字段（避免放置后立即触发重新加载）
  const isPlacingFieldRef = useRef(false);
  // 标记是否正在回滚被篡改的字段单元格（避免回滚操作再次触发变更事件导致递归）
  const isRestoringRef = useRef(false);
  // 标记是否正在加载布局（程序自身批量写入单元格，不应触发保护回滚与自动保存）
  const isLoadingRef = useRef(false);

  // 右键命中格子缓存：右键那一刻锁定光标所在格。
  // 右键菜单统一使用 Univer 原生菜单（改过的 src/univer-lib 产物里注册了
  // 只读/可编辑/必填/字段属性/清空 等菜单项，点击派发 univer-field-attr-change 等事件），
  // 这些事件回调若改读 selection.getCurrentCell() 会拿到右键前的旧选区，
  // 导致坐标错位、查不到字段元数据，所以这里统一复用右键那一刻锁定的命中格。
  const rightClickCellRef = useRef<{ row: number; col: number } | null>(null);

  // 右键那一刻的鼠标位置（client 坐标）。菜单项回调里鼠标已移到菜单上，
  // 所以必须缓存右键瞬间的位置，供「按像素矩形吸附到字段格」兜底使用。
  const rightClickPosRef = useRef<{ x: number; y: number } | null>(null);

  // 实时鼠标位置缓存：作为右键命中格缺失时的兜底，用与「字段落点」相同的坐标解析反算格子。
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);

  // 保持最新的 onLayoutChange（供 setFieldAttr 持久化，避免闭包捕获旧值）
  const onLayoutChangeRef = useRef(onLayoutChange);
  onLayoutChangeRef.current = onLayoutChange;

  // 最近一次选区的激活单元格（复制/剪切/粘贴时定位源/目标格用）
  const lastSelectionCellRef = useRef<{ row: number; col: number } | null>(null);
  // 复制/剪切时暂存的字段元数据（含源格坐标），粘贴时据此跟随或去重
  const clipboardFieldMetaRef = useRef<{ row: number; col: number; meta: any } | null>(null);
  // FUniver 外观实例（持有 onBeforeCopy/onBeforePaste/onCopy/onPaste 钩子）
  const fUniverRef = useRef<any>(null);

  // 保持最新的 layoutData：Univer 初始化等「只跑一次」的闭包里若直接读 layoutData，
  // 会捕获到初始的空对象 {}，导致用空数据加载布局（见下方 hasLayoutContent 说明）。
  const layoutDataRef = useRef(layoutData);
  layoutDataRef.current = layoutData;

  /**
   * 判断布局数据是否含实际内容，用于区分两种「空」：
   *   - 尚未加载的初始 {}（无 sheets / cellData / dataTable）→ 不能加载
   *   - 用户清空后保存的空布局（有 sheets 或 cellData 键，值为 {}）→ 需要加载以清空表格
   * ⚠️ 必须用空布局调用 loadLayoutData 才是清空，用「未加载」的 {} 调用则是误清空。
   */
  const hasLayoutContent = (data: any): boolean =>
    !!data && !!(data.sheets || data.cellData || data.data?.dataTable);

  /**
   * 从布局数据中解析目标工作表数据（兼容两种形状 + sheet 名大小写差异）：
   *   1) { sheets: { sheet1: { cellData } } } —— saveLayoutData 返回的 result
   *   2) { cellData, ... }                    —— saveLayoutData 内部回调的 parentData
   */
  const resolveSheetData = (data: any): any | null => {
    if (!data) return null;
    if (data.sheets) {
      const keys = Object.keys(data.sheets);
      return (
        data.sheets[sheetName] ||
        data.sheets[sheetName.toLowerCase()] ||
        (data.sheetOrder?.length ? data.sheets[data.sheetOrder[0]] : undefined) ||
        (keys.length ? data.sheets[keys[0]] : undefined) ||
        null
      );
    }
    return data;
  };

  /**
   * 收集布局数据中已放置的字段标识，用于唯一性校验兜底：
   * 刷新页面后内存 Map 依赖 loadLayoutData 重建，若加载时序异常导致 Map 为空，
   * 仅靠内存判断会让同一字段被重复拖入。
   *
   * 同时按 fieldId 与 fieldName 收集两套 key（格式均为 `${标识}_${cellType}`）：
   * fieldName 是数据绑定的真实身份（占位符为 `${fieldName}`），
   * 当 id 缺失、或拖入时与保存时取的 id 字段不一致时，用 fieldName 仍能正确识别同一字段。
   */
  const collectPlacedFields = (data: any): { byId: Set<string>; byName: Set<string> } => {
    const byId = new Set<string>();
    const byName = new Set<string>();
    if (!data) return { byId, byName };
    const scan = (cellData: any) => {
      Object.values(cellData || {}).forEach((rowData: any) => {
        Object.values(rowData || {}).forEach((cell: any) => {
          const meta = (cell as any)?.fieldMeta;
          if (!meta) return;
          if (meta.fieldId) byId.add(`${String(meta.fieldId)}_${meta.cellType}`);
          if (meta.fieldName) byName.add(`${String(meta.fieldName)}_${meta.cellType}`);
        });
      });
    };
    if (data.sheets) {
      Object.values(data.sheets).forEach((s: any) => scan((s as any)?.cellData));
    } else {
      scan(data.cellData);
    }
    return { byId, byName };
  };

  const setCellField = useCallback((
    workbook: any,  // FWorkbook (Facade)
    sheet: any,    // FWorksheet (Facade)
    row: number,
    col: number,
    fieldMeta: FieldMeta,
  ) => {
    try {
      // Facade API: FWorksheet.getRange(row, col) 返回 FRange
      const range = sheet.getRange(row, col);

      // 1. 设置显示值（字段标签 + 字段名，带图标）
      // 根据字段类型添加图标前缀（参考 ecology excel 设计器）
      // 区分标签与字段：
      // - 标签(cellType=label)：写入标签文字，作为静态说明文本
      // - 字段(cellType=field)：写入 ${字段名} 占位符，标记数据绑定
      const displayValue = getCellDisplayValue(fieldMeta);
      range.setValue(displayValue);

      // 2. 存储字段元数据到内存 Map（FRange 没有 setNote 方法）
      const cellKey = `${row}_${col}`;
      const metaWithVersion = {
        ...fieldMeta,
        __version: '1.0' as const,
        __timestamp: Date.now(),
      };
      cellFieldMetaMap.current[cellKey] = metaWithVersion as any;

      // 3. 字段占位符的视觉样式按 fieldAttr 区分（统一交由 applyFieldAttrStyle 处理，与 setFieldAttr 一致）
      //    标签保持默认样式（它是说明文字，applyFieldAttrStyle 内部对非 field 格直接跳过）
      //    注意：loadLayoutData 重载时也会走到这里，必须按 fieldAttr 上色，否则"切不回去"。
      if (fieldMeta.cellType === 'field') {
        try {
          applyFieldAttrStyle(range, fieldMeta);
        } catch (styleErr) {
          console.warn('设置字段单元格样式失败:', styleErr);
        }
      }

      // 4. 设置数据验证规则（临时禁用，等待确认正确 API）
      // TODO: 确认 Univer 数据验证的正确 API
      // const rule = buildValidationRule(fieldMeta);
      // if (rule) {
      //   setDataValidation(sheet, row, col, rule);
      // }

      return true;
    } catch (e) {
      console.error('设置单元格字段失败:', e);
      return false;
    }
  }, [buildCellStyle, buildValidationRule, setDataValidation]);

  // ──────────────────────────────────────
  // 获取单元格字段元数据（从内存 Map 读取）
  // ──────────────────────────────────────
  const getCellFieldMeta = useCallback((row: number, col: number): FieldMeta | null => {
    const cellKey = `${row}_${col}`;
    const meta = cellFieldMetaMap.current[cellKey];
    return meta || null;
  }, []);

  // ──────────────────────────────────────
  // 加载布局数据（支持双格式解析）
  // 使用 Facade API (FWorkbook/FWorksheet/FRange)
  // 参照迁移文档 §9.1 - Univer JSON 格式 + §9.2 - SpreadJS 兼容格式
  // ──────────────────────────────────────
  const loadLayoutData = useCallback((data: any, layoutTypeArg?: number | string) => {
    if (!workbook) return;

    // 标记正在加载：期间的批量写入是程序自身行为，不应触发保护回滚与自动保存
    isLoadingRef.current = true;
    // 模板类型覆盖只读（参照 ecology resumeSheetData:808：显示/监控/打印布局统一置灰只读）
    // layoutType 取值：1=新建 2=编辑（可编辑模板）；0=显示 3=监控 4=打印（只读模板）
    const lt = layoutTypeArg ?? data?.layoutType ?? layoutType;
    const isReadOnlyTemplate = !!readOnly || [0, 3, 4].includes(Number(lt));
    try {
      // 关键修复：加载新数据前先清空旧的元数据，避免删除的单元格数据残留
      console.log('[LoadLayout] 清空旧的单元格元数据');
      cellFieldMetaMap.current = {};

      // workbook 是 FWorkbook (Facade)
      const fWorkbook: any = workbook;
      const sheet = fWorkbook.getActiveSheet(); // 返回 FWorksheet

      // 关键修复：清空表格中所有单元格的内容
      // 同样动态取行列数，避免硬编码越界（Range is out of bounds）
      console.log('[LoadLayout] 清空表格所有单元格内容');
      const clearMaxRows = typeof sheet.getMaxRows === 'function' ? Math.min(sheet.getMaxRows(), 200) : 50;
      const clearMaxCols = typeof sheet.getMaxColumns === 'function' ? Math.min(sheet.getMaxColumns(), 50) : 26;
      for (let row = 0; row < clearMaxRows; row++) {
        for (let col = 0; col < clearMaxCols; col++) {
          const range = sheet.getRange(row, col);
          range.setValue('');
        }
      }

      // 解析 cellData（支持 Univer 格式 cellData: { row: { col: { v, s, fieldMeta } } }）
      const cellData: Record<string, Record<string, CellDataItem>> = data.cellData || {};
      let cellCount = 0;

      Object.entries(cellData).forEach(([rowKey, rowData]) => {
        const row = parseInt(rowKey, 10);
        if (isNaN(row)) return;
        Object.entries(rowData || {}).forEach(([colKey, cell]) => {
          const col = parseInt(colKey, 10);
          if (isNaN(col)) return;
          cellCount++;

          const cellKey = `${row}_${col}`;
          // Facade API: FWorksheet.getRange(row, col) 返回 FRange
          let range: any = null;
          try { range = sheet.getRange(row, col); } catch { /* 越界忽略 */ }

          // 解析字段元数据
          const loadedMeta: any = (cell as any).fieldMeta ? { ...(cell as any).fieldMeta } : null;
          const isFieldCell = loadedMeta?.cellType === 'field';

          if (loadedMeta) {
            // 只读模板（显示/监控/打印）→ 强制 fieldAttr=1，对应 ecology resumeSheetData:808 + getCellFieldImage:3745
            if (isReadOnlyTemplate) {
              loadedMeta.fieldAttr = 1;
            }
            cellFieldMetaMap.current[cellKey] = loadedMeta;
            // 设置单元格值（按覆盖后的属性上色，确保 loadLayoutData 重载时样式一致，避免"切不回去"）
            setCellField(workbook, sheet, row, col, loadedMeta as FieldMeta);
          } else if ((cell as any).v !== undefined && (cell as any).v !== null) {
            if (range) range.setValue((cell as any).v);
            else sheet.getRange(row, col).setValue((cell as any).v);
          }

          // 还原 Excel 单元格样式（字体/对齐/颜色/背景等）
          // ⚠️ 字段占位符格的「背景色」由 fieldAttr 唯一决定（只读灰 / 可编辑白 / 必填浅红）。
          // 这里若连带还原 s.bg，会把 setCellField 刚上的属性底色覆盖掉，
          // 表现就是"只读/可编辑/必填切了没效果"。因此字段格跳过背景还原。
          if (range && (cell as any).s) {
            const restoredStyle = { ...(cell as any).s };
            if (isFieldCell) delete restoredStyle.bg;
            applyCellStyle(range, restoredStyle);
          }

          // 属性底色最后应用（唯一决策点），确保 fieldAttr 视觉一定生效
          if (range && isFieldCell) {
            applyFieldAttrStyle(range, loadedMeta as FieldMeta);
          }
        });
      });

      // 如果 cellData 为空，尝试解析 SpreadJS 兼容格式 (§9.2)
      // data.dataTable?: any[][] - 二维数组格式
      if (cellCount === 0 && data.data?.dataTable) {
        const dataTable = data.data.dataTable;
        for (let row = 0; row < dataTable.length; row++) {
          for (let col = 0; col < (dataTable[row]?.length || 0); col++) {
            const cellValue = dataTable[row][col];
            if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
              // Facade API: getRange(row, col) 返回 FRange
              const range = sheet.getRange(row, col);
              range.setValue(cellValue);
              cellCount++;
            }
          }
        }
      }

      // 还原列宽与行高（与保存对应，确保 Excel 布局尺寸保留）
      if (data.columnData) {
        Object.entries(data.columnData).forEach(([c, d]: [string, any]) => {
          try { sheet.setColumnWidth(Number(c), d.w); } catch { /* 越界忽略 */ }
        });
      }
      if (data.rowData) {
        Object.entries(data.rowData).forEach(([r, d]: [string, any]) => {
          try { sheet.setRowHeight(Number(r), d.h); } catch { /* 越界忽略 */ }
        });
      }

      // 还原合并单元格（参照 §9 网格布局还原）
      // 关键修复：saveLayoutData 已把 mergedCells 捕获进 sheets.sheet1.mergedCells，
      // 但加载侧此前从不重应用合并 → 每次保存/刷新/重载后合并全部丢失，
      // 合并格内的文字因此错位或消失（合并后文字只在主格左上角显示，合并没了文字就「散」到非主格或看不见）。
      // 这里在「值已还原」之后重设合并，合并主格（左上角）已持有正确文字，合并后即正常显示。
      if (data.mergedCells && Array.isArray(data.mergedCells) && data.mergedCells.length) {
        // 先清除工作表中残留的旧合并：清空单元格值时并不会清除合并关系，
        // 不清理直接重应用同名合并可能冲突，或残留已不在布局里的旧合并。
        try {
          const existing = (typeof (sheet as any).getMergeData === 'function' ? (sheet as any).getMergeData() : []) || [];
          if (existing.length) {
            existing.forEach((m: any) => {
              try { if (typeof m.breakApart === 'function') m.breakApart(); } catch { /* 忽略单个 */ }
            });
          }
        } catch (e) {
          console.warn('[LoadLayout] 清除旧合并失败(可忽略):', e);
        }
        let mergeCount = 0;
        data.mergedCells.forEach((m: any) => {
          const rs = Number(m.rowSpan ?? 1);
          const cs = Number(m.colSpan ?? 1);
          if (!m || rs <= 1 && cs <= 1) return; // 非合并格跳过
          const startRow = Number(m.row);
          const startCol = Number(m.col);
          const endRow = startRow + rs - 1;
          const endCol = startCol + cs - 1;
          if (isNaN(startRow) || isNaN(startCol) || endRow < startRow || endCol < startCol) return;
          try {
            // 关键兜底：重新合并(defaultMerge)会清除非主格、只保留主格值。
            // 为避免「值还原时旧合并尚在 / breakApart 清掉了主格值」导致主格为空、文字消失，
            // 这里在 breakApart 之后、merge 之前，从已保存 cellData 显式把合并区域内第一个有值的
            // 单元格内容写回主格(左上角)。与 Univer「只保留主格值」语义一致，确保文字不丢。
            let regionValue: any = null;
            let regionStyle: any = null;
            for (let dr = 0; dr < rs && regionValue === null; dr++) {
              for (let dc = 0; dc < cs; dc++) {
                const c = cellData[startRow + dr]?.[startCol + dc];
                if (c && c.v !== null && c.v !== undefined && c.v !== '') {
                  regionValue = c.v;
                  regionStyle = c.s;
                  break;
                }
              }
            }
            if (regionValue !== null) {
              try { sheet.getRange(startRow, startCol).setValue(regionValue); } catch { /* 忽略单格写入失败 */ }
            }
            // defaultMerge=true：只保留左上角(主格)的值，文字已在主格
            sheet.getRange(startRow, startCol, rs, cs).merge({ defaultMerge: true });
            // 诊断：合并后核对主格值是否还在（排查"合并后文字消失"）
            try {
              const afterVal = sheet.getRange(startRow, startCol).getValue();
              if (regionValue !== null && (afterVal === null || afterVal === undefined || afterVal === '')) {
                console.warn('[LoadLayout] 合并后主格值丢失:', { startRow, startCol, regionValue, afterVal });
              }
            } catch { /* 忽略 */ }
            mergeCount++;
          } catch (e) {
            console.warn('[LoadLayout] 还原合并单元格失败:', startRow, startCol, rs, cs, e);
          }
        });
        if (mergeCount > 0) console.log(`[LoadLayout] 还原合并单元格 ${mergeCount} 个`);
      }

      if (cellCount > 0) {
        message.success(`布局数据加载成功（${cellCount} 个单元格）`);
      }
    } catch (error) {
      console.error('加载布局数据失败:', error);
      message.error('加载布局数据失败');
    } finally {
      isLoadingRef.current = false;
    }
  }, [workbook, setCellField, layoutType, readOnly]);

  // ──────────────────────────────────────
  // 保存布局数据（Univer JSON 格式 + SpreadJS 兼容格式）
  // 使用 Facade API (FWorkbook/FWorksheet/FRange)
  // 参照迁移文档 §9.1 - Univer JSON 格式 + §9.2 转换工具
  // ──────────────────────────────────────
  const saveLayoutData = useCallback(() => {
    if (!workbook) return null;

    try {
      // workbook 是 FWorkbook (Facade)
      const fWorkbook: any = workbook;
      // 防御：实例可能在 HMR/卸载后被销毁，此时 getActiveSheet() 会抛
      // InjectorAlreadyDisposedError。静默跳过保存，不打错误日志（否则开发期告警刷屏）。
      let sheet: any;
      try {
        sheet = fWorkbook.getActiveSheet(); // FWorksheet
      } catch (disposedErr) {
        console.warn('[Save] Univer 实例已销毁，跳过保存:', (disposedErr as Error)?.message);
        return null;
      }
      if (!sheet) return null;

      console.log('[Save] 保存前 Map keys =', Object.keys(cellFieldMetaMap.current));

      // 动态获取工作表实际行列数：硬编码范围会在工作表行列数不足时抛
      // "Range is out of bounds"（例如实际 22 列却访问第 23 列）
      const sheetMaxRows = typeof sheet.getMaxRows === 'function' ? sheet.getMaxRows() : 50;
      const sheetMaxCols = typeof sheet.getMaxColumns === 'function' ? sheet.getMaxColumns() : 26;
      const maxRow = Math.min(sheetMaxRows, 200);
      const maxCol = Math.min(sheetMaxCols, 50);

      const cellData: Record<string, Record<string, CellDataItem>> = {};
      const dataTable: any[][] = [];
      let hasData = false;

      for (let row = 0; row < maxRow; row++) {
        let rowHasData = false;
        for (let col = 0; col < maxCol; col++) {
          // Facade API: FWorksheet.getRange(row, col) 返回 FRange
          // 单个单元格越界不应中断整个保存过程
          let value: any;
          let cellStyle: any = null;
          try {
            const range = sheet.getRange(row, col);
            value = range.getValue();
            // 捕获单元格样式（composed，含字体/背景/对齐等，用于保存后还原 Excel 样式）
            cellStyle = range.getCellStyleData();
          } catch (rangeErr) {
            console.warn(`[Save] 读取单元格 (${row}, ${col}) 失败，跳过:`, rangeErr);
            continue;
          }

          // 跳过空值单元格
          if (value === null || value === undefined || value === '') continue;

          // 获取字段元数据（从内存 Map）
          const fieldMeta = getCellFieldMeta(row, col);

          // 关键验证：如果有元数据，检查元数据中的值是否与单元格值匹配
          // 注意：单元格值可能带有图标前缀，需要去除图标后再比较
          if (fieldMeta) {
            // 期望值由 getCellDisplayValue 统一决定（标签→标签文字，字段→${字段名} 占位符）
            if (!isCellValueMatchMeta(value, fieldMeta)) {
              if (fieldMeta.cellType === 'label') {
                // 标签允许修改文字：同步更新 fieldLabel（fieldMeta 是内存 Map 的引用），
                // 保持标签身份并正常保存，避免被当作过期元数据删除
                fieldMeta.fieldLabel = String(value ?? '');
              } else {
                // 字段占位符被破坏 → 按「字段禁止手动改文本」的约定还原正确显示值，并保留元数据。
                // ⚠️ 不能删除元数据：一旦删除，该字段会从 cellFieldMetaMap 与保存结果中消失，
                // 下一次 loadLayoutData 重载后元数据丢失，导致：
                //   1) 唯一性校验失效 → 同一个字段可以被重复拖入
                //   2) 右键「只读/可编辑/必填」因 resolveCellFieldId 查不到字段而失效
                const expected = getCellDisplayValue(fieldMeta);
                console.log(`[Save] 单元格 (${row}, ${col}) 值不匹配，还原为期望值: 实际值="${value}", 期望值="${expected}"`);
                try {
                  sheet.getRange(row, col).setValue(expected);
                } catch (e) {
                  console.warn('[Save] 还原字段显示值失败:', e);
                }
                value = expected;
              }
            }
          }

          hasData = true;
          rowHasData = true;

          if (!cellData[row]) cellData[row] = {};

          cellData[row][col] = {
            v: value,
            s: cellStyle || undefined,
            fieldMeta: fieldMeta || undefined,
          };

          // 同时构建 SpreadJS 兼容数据表
          if (!dataTable[row]) dataTable[row] = [];
          dataTable[row][col] = value;
        }
      }

      // 捕获合并单元格信息（用于预览保留 Excel 网格布局，还原合并单元格）
      let mergedCells: { row: number; col: number; rowSpan: number; colSpan: number }[] = [];
      try {
        const mergeRanges: any[] = typeof (sheet as any).getMergeData === 'function' ? (sheet as any).getMergeData() : [];
        mergedCells = mergeRanges
          .map((m: any) => {
            const r = typeof m.getRange === 'function' ? m.getRange() : (m._range || m);
            return {
              row: r.startRow,
              col: r.startColumn,
              rowSpan: r.endRow - r.startRow + 1,
              colSpan: r.endColumn - r.startColumn + 1,
            };
          })
          .filter((m: any) => m.rowSpan > 1 || m.colSpan > 1);
      } catch (e) {
        console.warn('[Save] 读取合并单元格失败:', e);
      }

      // 合并单元格值归一化：确保「主格(左上角)」持有该合并区域的值与字段元数据。
      // Univer 合并语义是「只保留主格值」，但某些合并路径(如 facade merge)不会把值移到主格；
      // 若主格为空、值落在非主格，重载重新合并(defaultMerge)后将以主格(空)显示 → 文字消失。
      // 这里在保存数据层把区域内第一个有值的单元格值归一到主格，杜绝文字丢失（与 Univer「保留主格值」语义一致）。
      // 关键修复：元数据 fieldMeta 必须随值一起归一到主格！否则重加载后：
      //   - 字段值显示在主格，但 cellFieldMetaMap 把 meta 挂在非主格坐标；
      //   - 右键 hitTest 返回主格坐标 → tier-1/2 都查不到 meta → 只读/可编辑/必填切不动。
      // 这正对应「做了合并/位置变化后偶尔切不动」的成因。
      mergedCells.forEach((m: any) => {
        const sr = m.row;
        const sc = m.col;
        const primaryCell = cellData[sr]?.[sc];
        const primaryHasValue =
          primaryCell && primaryCell.v !== null && primaryCell.v !== undefined && primaryCell.v !== '';
        if (primaryHasValue) return;
        for (let dr = 0; dr < m.rowSpan; dr++) {
          for (let dc = 0; dc < m.colSpan; dc++) {
            const rr = sr + dr;
            const cc = sc + dc;
            const c = cellData[rr]?.[cc];
            if (c && c.v !== null && c.v !== undefined && c.v !== '') {
              const sourceMeta = c.fieldMeta ?? primaryCell?.fieldMeta;
              if (!cellData[sr]) cellData[sr] = {};
              cellData[sr][sc] = {
                ...(primaryCell || { s: c.s }),
                v: c.v,
                ...(sourceMeta ? { fieldMeta: sourceMeta } : {}),
              };
              // 非主格的元数据随值移走，避免残留旧 meta（导致 map 里出现与可见值错位的重复坐标）
              if (sourceMeta && c.fieldMeta) delete c.fieldMeta;
              return; // 只取第一个，与 Univer「保留主格值」一致
            }
          }
        }
      });

      // 诊断：确认每个合并的主格(左上角)值已落到 cellData，用于排查"合并后文字消失"
      if (mergedCells.length) {
        console.log('[Save] 合并主格值核对:', mergedCells.map((m: any) => ({
          row: m.row,
          col: m.col,
          rowSpan: m.rowSpan,
          colSpan: m.colSpan,
          primaryValue: cellData[m.row]?.[m.col]?.v,
        })));
      }

      // 捕获列宽与行高（保留 Excel 布局尺寸，避免保存后列宽/行高丢失）
      const columnData: Record<string, { w: number }> = {};
      const rowData: Record<string, { h: number }> = {};
      for (let c = 0; c < maxCol; c++) {
        try {
          const w = sheet.getColumnWidth(c);
          if (w && w > 0) columnData[c] = { w };
        } catch { /* 读取列宽失败忽略 */ }
      }
      for (let r = 0; r < maxRow; r++) {
        try {
          const h = sheet.getRowHeight(r);
          if (h && h > 0) rowData[r] = { h };
        } catch { /* 读取行高失败忽略 */ }
      }

      // 诊断：本次保存实际写入了多少个 fieldMeta（确认字段元数据是否真的进了持久化 JSON）
      let savedFieldMetaCount = 0;
      Object.values(cellData).forEach((rowData: any) => {
        Object.values(rowData || {}).forEach((cell: any) => {
          if (cell?.fieldMeta) savedFieldMetaCount++;
        });
      });
      console.log('[Save] 写入的 fieldMeta 数量 =', savedFieldMetaCount, 'Map 剩余 keys =', Object.keys(cellFieldMetaMap.current).length);

      if (!hasData) {
        // 关键修复：清空后仍需返回空布局并同步，否则
        // 1) 保存按钮因返回 null 而无法持久化清空结果（问题：清空后保存不了）
        // 2) 面板 usedFieldKeys 仍含已清空字段 → 无法重新拖入（问题：清空后不能重拖）
        console.log('[Save] 没有数据，返回空布局以同步清空状态');
        const emptyResult: any = {
          id: 'wb-' + (formId || sheetName) + '-' + Date.now(),
          sheetOrder: ['sheet1'],
          version: 'univer-v2',
          sheets: {
            sheet1: {
              id: 'sheet1',
              name: sheetName,
              cellData: {},
              rowCount: maxRow,
              colCount: maxCol,
              mergedCells: [],
              columnData: {},
              rowData: {},
            },
          },
          sheetName,
          cellData: {},
          rowCount: maxRow,
          colCount: maxCol,
          spreadCompat: { version: '11.1.0', data: { dataTable: [] } },
        };
        onLayoutChange(emptyResult);
        return emptyResult;
      }

      // 构建 Univer 格式结果（参照 §9.1）
      const univerFormat: WorkbookLayoutData = {
        id: 'wb-' + (formId || sheetName) + '-' + Date.now(),
        sheetOrder: ['sheet1'],
        version: 'univer-v2',
        sheets: {
          sheet1: {
            id: 'sheet1',
            name: sheetName,
            cellData,
            rowCount: maxRow,
            colCount: maxCol,
            mergedCells,
            columnData,
            rowData,
          },
        },
      };

      // 构建 SpreaJS 兼容结果（参照 §9.2）
      const result = {
        ...univerFormat,
        sheetName,
        // SpreadJS 兼容格式
        spreadCompat: {
          version: '11.1.0',
          data: { dataTable },
        },
      };

      // 通知父组件
      const parentData = {
        [sheetName]: result,
        sheetName,
        cellData,
        rowCount: maxRow,
        colCount: maxCol,
        version: 'univer-v2',
        spreadCompat: result.spreadCompat,
      };

      onLayoutChange(parentData);
      return result;
    } catch (error) {
      const msg = (error as Error)?.message || '';
      // 实例已销毁（HMR/卸载后的异步保存回调）属预期，静默跳过
      if (msg.includes('InjectorAlreadyDisposed') || msg.toLowerCase().includes('disposed')) {
        console.warn('[Save] Univer 实例已销毁，保存跳过:', msg);
        return null;
      }
      console.error('保存布局数据失败:', error);
      return null;
    }
  }, [workbook, sheetName, formId, onLayoutChange, getCellFieldMeta]);

  // ──────────────────────────────────────
  // 整字段移除：一个字段由「标签格 + 字段占位符格」两格组成，
  // 在 usedFieldKeys 中各自独立计数（${fieldId}_label / ${fieldId}_field）。
  // 清空/删除任意一格时，必须同时清掉另一格并移除两处元数据，
  // 否则面板 usedFieldKeys 仍残留另一格的 key，该字段无法完整重新拖拽。
  // 三个入口共用：onCommandExecuted 清空、防篡改守护定时器、右键「清空」菜单。
  // ──────────────────────────────────────
  const removeFieldCompletely = useCallback((fieldId: string, fieldName?: string) => {
    if (!workbook) return;
    const targetId = String(fieldId ?? '');
    const targetName = String(fieldName ?? '');
    if (!targetId && !targetName) return;

    const sheet: any = (workbook as any).getActiveSheet?.();
    const matchedKeys: string[] = [];
    Object.entries(cellFieldMetaMap.current).forEach(([key, meta]) => {
      if (!meta) return;
      const sameId = targetId && String((meta as any).fieldId ?? '') === targetId;
      const sameName = targetName && String((meta as any).fieldName ?? '') === targetName;
      if (sameId || sameName) matchedKeys.push(key);
    });
    if (matchedKeys.length === 0) return;

    // 程序化清空另一格：标记为回滚态，避免防篡改/守护定时器递归还原或重复保存
    isRestoringRef.current = true;
    try {
      matchedKeys.forEach((key) => {
        const [r, c] = key.split('_').map(Number);
        try { sheet?.getRange?.(r, c)?.setValue?.(''); } catch { /* 忽略单格失败 */ }
        delete cellFieldMetaMap.current[key];
      });
    } finally {
      setTimeout(() => { isRestoringRef.current = false; }, 0);
    }
    // 同步布局：usedFieldKeys 由 layoutData.cellData 推导，cellData 不再含该字段 meta → 可重新拖入
    try { saveLayoutData(); } catch (e) { console.warn('[removeField] 同步布局失败:', e); }
  }, [workbook, saveLayoutData]);

  // ──────────────────────────────────────
  // 辅助函数：将后端 fieldHtmlType/fieldType 映射为 FIELD_TYPE_META 的 key
  // ──────────────────────────────────────
  // ──────────────────────────────────────
  // 整行/整列 插入或删除时的元数据坐标重排
  // 一个字段占两格（同行相邻：标签格 + 字段占位符格），cellFieldMetaMap 以固定 `row_col` 为键。
  // 行列结构性变更后：
  //  - 删除：落入删除区间的字段整字段移除（释放 usedFieldKeys，可重新拖拽）；其余字段按平移量上/左移并重排键
  //  - 插入：全部字段按平移量下/右移并重排键（无移除），避免坐标错位导致切属性/命中失效（同类「位置变化」问题）
  // 命令 id：sheet.command.remove-row / remove-col / insert-row / insert-col
  // params.range：删行→startRow/endRow；删列→startColumn/endColumn
  // ──────────────────────────────────────
  const handleRowColStructural = useCallback((commandId: string, params: any) => {
    const range = params?.range;
    if (!range) return;
    const isRow = commandId === 'sheet.command.remove-row' || commandId === 'sheet.command.insert-row';
    const isRemove = commandId === 'sheet.command.remove-row' || commandId === 'sheet.command.remove-col';
    const start = isRow ? range.startRow : range.startColumn;
    const end = isRow ? range.endRow : range.endColumn;
    if (start == null || end == null || end < start) return;
    const count = end - start + 1;
    // delta：删除→坐标 -count（向上/左）；插入→坐标 +count（向下/右）
    const delta = isRemove ? -count : count;

    const sheet: any = (workbook as any).getActiveSheet?.();

    // 删除模式：收集落入删除区间的字段 key（整字段移除，含其相邻那格）
    const doomedKeys = new Set<string>();
    if (isRemove) {
      Object.entries(cellFieldMetaMap.current).forEach(([key, meta]) => {
        if (!meta) return;
        const [r, c] = key.split('_').map(Number);
        const pos = isRow ? r : c;
        if (pos >= start && pos <= end) doomedKeys.add(key);
      });
    }

    // 重建 map：删除 doomed 字段两格；存活字段按 delta 平移重排键
    const newMap: Record<string, any> = {};
    const survivorsToClear: Array<{ r: number; c: number }> = []; // doomed 字段里落在区间外、需清值的那格（如删列时只剩另一列的那格）
    Object.entries(cellFieldMetaMap.current).forEach(([key, meta]) => {
      if (!meta) return;
      const [r, c] = key.split('_').map(Number);
      if (doomedKeys.has(key)) {
        const pos = isRow ? r : c;
        if (pos < start || pos > end) survivorsToClear.push({ r, c });
        return;
      }
      const nr = isRow ? r + delta : r;
      const nc = isRow ? c : c + delta;
      newMap[`${nr}_${nc}`] = meta;
    });
    cellFieldMetaMap.current = newMap;

    // 删列场景：同字段存活那格仍在表里，清掉其占位符值（行删除时同字段两格都在删除行内，无残留）
    if (isRemove && survivorsToClear.length) {
      isRestoringRef.current = true;
      try {
        survivorsToClear.forEach(({ r, c }) => {
          try { sheet?.getRange?.(r, c)?.setValue?.(''); } catch { /* 忽略单格失败 */ }
        });
      } finally {
        setTimeout(() => { isRestoringRef.current = false; }, 0);
      }
    }

    // 同步布局：删除的行/列已不在 sheet，存活字段按新坐标落库；usedFieldKeys 释放被删字段 → 可重新拖入
    try { saveLayoutData(); } catch (e) { console.warn('[RowColStructural] 同步布局失败:', e); }
  }, [workbook, saveLayoutData]);

  const mapToFieldType = (field: any): FieldType => {
    const htmlType = field.fieldHtmlType || 1;
    const type = field.fieldType || 1;
    // fieldhtmltype=1 文本字段：type=1 单行文本，type=2 多行文本
    if (htmlType === 1) return type === 2 ? 'textarea' : 'text';
    // fieldhtmltype=2 浏览按钮 → text
    if (htmlType === 2) return 'text';
    // fieldhtmltype=3/8 选择框/下拉框
    if (htmlType === 3 || htmlType === 8) return 'select';
    // fieldhtmltype=4 附件
    if (htmlType === 4) return 'attachment';
    // fieldhtmltype=5 特殊字段：type=1 日期，type=2 日期时间
    if (htmlType === 5) return type === 2 ? 'datetime' : 'date';
    // fieldhtmltype=6 复选框
    if (htmlType === 6) return 'checkbox';
    // fieldhtmltype=9 树形选择 → select
    if (htmlType === 9) return 'select';
    return 'text';
  };

  // ──────────────────────────────────────
  // 将字段放置到指定单元格
  // 使用 Facade API (FWorkbook/FWorksheet/FRange)
  // 参照迁移文档 §5.3 字段绑定（setTag → setNote）
  // ──────────────────────────────────────
  const handleFieldDrop = useCallback((field: any, row: number, col: number) => {
    if (!workbook) return;

    try {
      // 优先使用 window.__pendingField，它包含完整的字段信息
      const actualField = (window as any).__pendingField || field;

      console.log('[handleFieldDrop] 字段信息:', {
        fromParam: field,
        fromWindow: (window as any).__pendingField,
        actualField,
      });

      const fWorkbook: any = workbook;
      const sheet = fWorkbook.getActiveSheet();
      sheetRef.current = sheet;

      // 区分标签与字段（FieldPalette 拖动时写入 type：formLabel=标签 / formField=字段）
      const isLabel = actualField.type === 'formLabel';

      // ── 唯一性校验：同一个字段（按 字段ID/字段名 + 标签/字段 区分）只能拖入一次 ──
      // 依据 cellFieldMetaMap 动态计算已放置的字段，因此：
      // - 清空单元格（移除字段）后自动释放，可再次拖入
      // - 刷新页面/加载布局后自动保持正确，无需额外持久化
      //
      // 身份标识同时用 fieldId 与 fieldName 两套：fieldName 是数据绑定的真实身份
      // （占位符为 ${fieldName}），当 id 字段缺失或前后取值不一致时仍能正确识别同一字段。
      const fieldIdOf = (f: any) =>
        String(f?.id ?? f?.fieldId ?? f?.fieldid ?? f?.field_code ?? '');
      const dropFieldId = fieldIdOf(actualField);
      const dropName = String(actualField.fieldName || actualField.name || '');
      const dropLabel = String(actualField.fieldLabel || actualField.label || '');
      const dropType = isLabel ? 'label' : 'field';
      const dropIdKey = `${dropFieldId}_${dropType}`;
      const dropNameKey = `${dropName}_${dropType}`;

      // 内存 Map 已放置的标识集合（id / name 两套）
      const mapEntries = Object.values(cellFieldMetaMap.current) as any[];
      const placedInMapById = mapEntries.some(
        (meta) => `${String(meta?.fieldId ?? '')}_${meta?.cellType}` === dropIdKey
      );
      const placedInMapByName = !!dropName && mapEntries.some(
        (meta) => meta?.cellType === dropType && String(meta?.fieldName ?? '') === dropName
      );

      // 兜底：刷新页面后内存 Map 需等 loadLayoutData 重建，可能因时序异常为空；
      // 此时查一次持久化布局数据（同时覆盖 id / name）。
      const layoutFields = collectPlacedFields(layoutDataRef.current);
      const placedInLayoutById = layoutFields.byId.has(dropIdKey);
      const placedInLayoutByName = !!dropName && layoutFields.byName.has(dropNameKey);

      // 3) 兜底之二：直接扫描当前 Excel 表格，看是否已存在该字段的占位符 / 标签文字。
      //    刷新页面后，loadLayoutData 可能因时序把 cellFieldMetaMap 清空，但字段仍真实画在表格里
      //    （只剩显示值、丢了元数据）。此时前两种校验都查不到，会出现"重复拖入未被拦截"。
      //    直接扫表格单元格的值最可靠：字段占位符为 ${fieldName}，标签为标签文字。
      let placedInSheet = false;
      let zombieCell: { r: number; c: number } | null = null;
      if (dropName) {
        try {
          const maxR = typeof sheet.getMaxRows === 'function' ? Math.min(sheet.getMaxRows(), 200) : 50;
          const maxC = typeof sheet.getMaxColumns === 'function' ? Math.min(sheet.getMaxColumns(), 50) : 26;
          for (let r = 0; r < maxR && !placedInSheet; r++) {
            for (let c = 0; c < maxC; c++) {
              let v: any;
              try { v = sheet.getRange(r, c).getValue(); } catch { continue; }
              if (v == null || v === '') continue;
              const sv = String(v);
              const hit =
                (dropType === 'field' && sv.includes('${' + dropName + '}')) ||
                (dropType === 'label' &&
                  ((dropName && sv.includes(dropName)) || (dropLabel && sv.includes(dropLabel))));
              if (hit) { placedInSheet = true; zombieCell = { r, c }; break; }
            }
          }
        } catch (scanErr) {
          console.warn('[DropCheck] 扫描表格失败:', scanErr);
        }
      }

      // 真正"已放置"= 内存 Map 或持久化布局里有完整元数据（id / name 两套）。
      // 仅 placedInSheet 命中（表格残留占位符值、但无元数据）属于刷新后常见的"僵尸格"，
      // 不应拒绝，而应允许重新绑定元数据（否则会出现"值在了却永远查不到元数据"的死循环）。
      const properlyPlaced =
        placedInMapById || placedInMapByName || placedInLayoutById || placedInLayoutByName;

      // ── 诊断日志：定位"重复拖入未被拦截"的根因 ──
      console.log('[DropCheck] 校验', {
        dropIdKey,
        dropNameKey,
        actualFieldType: actualField?.type,
        actualFieldId: actualField?.id,
        actualFieldFieldId: actualField?.fieldId,
        actualFieldName: actualField?.fieldName,
        mapEntries: mapEntries.map((m) => `${String(m?.fieldId)}|${String(m?.fieldName)}|${m?.cellType}`),
        layoutById: Array.from(layoutFields.byId),
        layoutByName: Array.from(layoutFields.byName),
        layoutShape: layoutDataRef.current ? Object.keys(layoutDataRef.current) : null,
        placedInSheet,
        zombieCell,
        result: { properlyPlaced, placedInSheet },
      });

      // 有完整元数据的真实重复 → 拒绝
      if (properlyPlaced) {
        console.log(`[handleFieldDrop] 字段已拖入，拒绝重复放置: ${dropIdKey}`);
        message.warning('该字段已拖入表格，不能重复拖动；如需调整请先清空原单元格');
        return;
      }

      // 僵尸格（仅残留值、无元数据）：重新绑定。若残留值位于其他单元格，先清空以免重复。
      if (placedInSheet && zombieCell && (zombieCell.r !== row || zombieCell.c !== col)) {
        try {
          const zr = sheet.getRange(zombieCell.r, zombieCell.c);
          if (zr && typeof zr.setValue === 'function') zr.setValue('');
          console.log(`[handleFieldDrop] 清空僵尸占位符格 (${zombieCell.r}, ${zombieCell.c}) 以重新绑定`);
        } catch (clearErr) {
          console.warn('[handleFieldDrop] 清空僵尸格失败:', clearErr);
        }
      }

      // 解析正确的 fieldType：
      // - 标签 → 固定为 label（静态文本，不参与数据绑定）
      // - 字段 → 后端字段需映射 fieldHtmlType，静态字段直接使用 type
      const resolvedType: FieldType = isLabel
        ? 'label'
        : (actualField.type === 'formField' || actualField.fieldHtmlType
            ? mapToFieldType(actualField)
            : (actualField.type as FieldType));

      // 构造完整的字段元数据
      const fieldMeta: FieldMeta = {
        fieldId: String(actualField.id || actualField.fieldId || ''),
        fieldName: actualField.fieldName || '',
        fieldLabel: actualField.fieldLabel || actualField.label || '',
        fieldType: resolvedType,
        cellType: isLabel ? 'label' : 'field',
        required: actualField.required || false,
        readonly: actualField.readonly || false,
        defaultValue: actualField.defaultValue || '',
        placeholder: actualField.placeholder || '',
        length: actualField.length || (FIELD_TYPE_META[resolvedType] as any)?.maxLength,
        tooltip: actualField.tooltip || '',
        options: actualField.options || [],
      };

      // 写入字段元数据到单元格
      console.log('[handleFieldDrop] 准备放置字段:', {
        fieldLabel: fieldMeta.fieldLabel,
        row,
        col,
        cellKey: `${row}_${col}`,
      });

      // 标记正在放置字段，避免触发重新加载
      isPlacingFieldRef.current = true;
      setCellField(workbook, sheet, row, col, fieldMeta);

      message.success(
        `字段 "${fieldMeta.fieldLabel}" 已放置到单元格 (${row + 1}, ${String.fromCharCode(65 + col)})`
      );

      // 自动触发保存
      const data = saveLayoutData();
      if (data) {
        onLayoutChange(data);
      }

      // 延迟重置标记，确保 layoutData 变化已被处理
      setTimeout(() => {
        isPlacingFieldRef.current = false;
      }, 200);
    } catch (error) {
      console.error('放置字段失败:', error);
      message.error('放置字段失败');
      isPlacingFieldRef.current = false;
    }
  }, [workbook, setCellField, saveLayoutData, onLayoutChange]);

  // ──────────────────────────────────────
  // 获取鼠标位置对应的单元格坐标
  //
  // 首选 FWorksheet.hitTest()：内部走 skeleton.getCellByOffset()，是 Univer 自己
  // 判定「点到了哪一格」的同一套逻辑，已正确处理滚动、缩放、表头偏移、合并单元格，
  // 是「像素 → 单元格」唯一可靠的实现，落点与右键必须共用它。
  //
  // 兜底才用「列宽/行高累加」：不含表头偏移、不考虑滚动与缩放（本文件 350 行注释
  // 亦标注该方案"不可靠，仅作兜底"），只在 hitTest 不可用（skeleton 未就绪）时顶替。
  // ──────────────────────────────────────
  const getCellFromMouseEvent = useCallback((clientX: number, clientY: number): { row: number; col: number } => {
    const sheet: any = workbookRef.current?.getActiveSheet?.() ?? (workbook as any)?.getActiveSheet?.();

    // 1) hitTest：最精准，与 Univer 自身点击选区判定同源
    if (sheet && typeof sheet.hitTest === 'function') {
      try {
        const hit = sheet.hitTest(clientX, clientY);
        if (hit && Number.isFinite(hit.row) && Number.isFinite(hit.column) && hit.row >= 0 && hit.column >= 0) {
          console.log('[getCellFromMouseEvent] hitTest:', { row: hit.row, col: hit.column });
          return { row: hit.row, col: hit.column };
        }
      } catch (e) {
        console.warn('[getCellFromMouseEvent] hitTest 失败，降级:', e);
      }
    }

    // 2) 兜底：按列宽/行高累加（精度差）
    const canvasEl = containerRef.current?.querySelector('canvas');
    const canvasRect = canvasEl?.getBoundingClientRect();
    if (!sheet || !canvasRect) {
      console.warn('[getCellFromMouseEvent] sheet 或 canvas 缺失，返回 (0,0)');
      return { row: 0, col: 0 };
    }

    const x = clientX - canvasRect.left;
    const y = clientY - canvasRect.top;

    const DEFAULT_COL_WIDTH = 73;
    const DEFAULT_ROW_HEIGHT = 24;

    // 列：按列宽累加
    let col = 0;
    let accX = 0;
    for (let c = 0; c < 200; c++) {
      let w = typeof sheet.getColumnWidth === 'function' ? sheet.getColumnWidth(c) : 0;
      if (!w || w <= 0) w = DEFAULT_COL_WIDTH;
      accX += w;
      if (x < accX) { col = c; break; }
    }

    // 行：按行高累加
    let row = 0;
    let accY = 0;
    for (let r = 0; r < 1000; r++) {
      let h = typeof sheet.getRowHeight === 'function' ? sheet.getRowHeight(r) : 0;
      if (!h || h <= 0) h = DEFAULT_ROW_HEIGHT;
      accY += h;
      if (y < accY) { row = r; break; }
    }

    console.log('[getCellFromMouseEvent] 累加兜底:', { x: x.toFixed(1), y: y.toFixed(1), row, col });
    return { row: Math.max(0, row), col: Math.max(0, col) };
  }, [workbook]);

  // ──────────────────────────────────────
  // 按像素矩形吸附到「挂了字段元数据的格子」
  //
  // 当索引约定出现偏差（历史数据、或落点/读取用过不同约定）导致按索引查不到元数据时，
  // 用几何位置兜底：取右键那一刻的鼠标点，找 getCellRect 包含该点的字段格。
  // getCellRect 由 Univer Skeleton 计算，已含滚动/缩放/表头偏移（见本文件 349-350 行），
  // 与索引约定无关，因此可稳定命中用户实际看到的那一格。
  // ──────────────────────────────────────
  const findFieldCellByPosition = useCallback((): { row: number; col: number } | null => {
    const pos = rightClickPosRef.current;
    if (!pos) return null;
    const sheet: any = workbookRef.current?.getActiveSheet?.();
    const canvasEl = containerRef.current?.querySelector('canvas');
    const canvasRect = canvasEl?.getBoundingClientRect();
    if (!sheet || !canvasRect || typeof sheet.getCellRect !== 'function') return null;

    const x = pos.x - canvasRect.left;
    const y = pos.y - canvasRect.top;

    for (const key of Object.keys(cellFieldMetaMap.current)) {
      const [r, c] = key.split('_').map(Number);
      if (!Number.isFinite(r) || !Number.isFinite(c)) continue;
      let rect: any = null;
      try { rect = sheet.getCellRect(r, c); } catch { continue; }
      if (!rect) continue;
      const inside = x >= rect.left && x <= rect.left + rect.width
        && y >= rect.top && y <= rect.top + rect.height;
      if (inside) {
        console.log('[rectSnap] 像素吸附命中字段格:', { key, x: Math.round(x), y: Math.round(y), rect });
        return { row: r, col: c };
      }
    }
    return null;
  }, []);

  // ──────────────────────────────────────
  // 拖放处理（必须放在 handleFieldDrop 之后，否则无法访问）
  // 使用 Facade API (workbook)
  // 参照迁移文档 §5.3 字段绑定
  // ──────────────────────────────────────
  const [{ isOver, canDrop }, dropRef] = useDrop(() => ({
    accept: 'FIELD',
    canDrop: (item, monitor) => {
      console.log('[useDrop][CanDrop] 检查是否可放置', { item });
      return true; // 始终允许放置
    },
    hover: (item, monitor) => {
      // 注意：不能在 hover 中调用 monitor.canDrop()，否则会导致无限递归
      console.log('[useDrop][Hover] 拖拽悬停', { isOver: monitor.isOver() });
    },
    drop: (item: any, monitor) => {
      console.log('[useDrop][Drop] 回调触发', { item, isOver: monitor.isOver(), canDrop: monitor.canDrop() });

      if (monitor.didDrop()) {
        console.log('[useDrop][Drop] 已被子组件处理，跳过');
        return;
      }

      if (!workbook) {
        message.warning('Excel 表格尚未初始化完成，请稍后再试');
        return;
      }

      try {
        let row = 0;
        let col = 0;
        let source = '默认(0,0)';

        // 方案1：使用 hitTest（最精准）
        const clientOffset = monitor.getClientOffset();
        console.log('[useDrop][Drop] clientOffset:', clientOffset);

        if (clientOffset) {
          const { row: r, col: c } = getCellFromMouseEvent(clientOffset.x, clientOffset.y);
          row = r;
          col = c;
          source = `hitTest(${row},${col})`;
          console.log('[useDrop][Drop] 使用 hitTest 结果:', { row, col });
        } else {
          console.warn('[useDrop][Drop] clientOffset 为空，使用默认值');
        }

        console.log(`[useDrop][Drop] 放置来源: ${source}`);
        handleFieldDrop(item, row, col);
      } catch (e) {
        console.error('[useDrop][Drop] 处理放置失败:', e);
        handleFieldDrop(item, 0, 0);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
  }), [workbook, handleFieldDrop, getCellFromMouseEvent]);

  // ──────────────────────────────────────
  // 初始化 Univer
  // 参照迁移文档 §4.1 工作簿初始化对比
  // 使用递归 RAF 等待 containerRef.current 就绪，避免 ref 未绑定就初始化
  // 关键：通过 import '@univerjs/sheets/facade' 启用 Facade API
  // ──────────────────────────────────────
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) {
      return;
    }

    let rafId = 0;
    let stopped = false;

    const attemptInit = () => {
      if (stopped) return;

      // 如果 containerRef.current 尚未绑定，等待下一帧重试
      if (!containerRef.current) {
        rafId = requestAnimationFrame(attemptInit);
        return;
      }

      // containerRef.current 已就绪，开始初始化
      initRef.current = true;

      try {
        // Step 1: 创建 Univer 实例
        console.log('[Univer Init] Step 1: 创建 Univer 实例...');
        let univer: Univer;
        try {
          univer = new Univer({
            locale: LocaleType.ZH_CN,
            locales: {
              [LocaleType.ZH_CN]: mergeLocales(
                DesignZhCN,
                UIZhCN,
                DocsUIZhCN,
                SheetsZhCN,
                SheetsUIZhCN,
                SheetsFormulaUIZhCN,
                SheetsNumfmtUIZhCN,
                SheetsDataValidationZhCN,
              ),
            },
          });
          console.log('[Univer Init] Step 1 OK: Univer 实例创建成功');
        } catch (e) {
          console.error('[Univer Init] Step 1 失败: new Univer() 抛出异常:', e);
          throw e;
        }

        // Step 2: 注册 UniverRenderEnginePlugin
        console.log('[Univer Init] Step 2: 注册 UniverRenderEnginePlugin...');
        try {
          univer.registerPlugin(UniverRenderEnginePlugin);
          console.log('[Univer Init] Step 2 OK');
        } catch (e) {
          console.error('[Univer Init] Step 2 失败: UniverRenderEnginePlugin 注册失败:', e);
          throw e;
        }

        // Step 3: 注册 UniverFormulaEnginePlugin
        console.log('[Univer Init] Step 3: 注册 UniverFormulaEnginePlugin...');
        try {
          univer.registerPlugin(UniverFormulaEnginePlugin);
          console.log('[Univer Init] Step 3 OK');
        } catch (e) {
          console.error('[Univer Init] Step 3 失败: UniverFormulaEnginePlugin 注册失败:', e);
          throw e;
        }

        // Step 4: 注册 UniverUIPlugin（依赖前两个插件）
        console.log('[Univer Init] Step 4: 注册 UniverUIPlugin...');
        try {
          univer.registerPlugin(UniverUIPlugin, { container: containerRef.current });
          console.log('[Univer Init] Step 4 OK');
        } catch (e) {
          console.error('[Univer Init] Step 4 失败: UniverUIPlugin 注册失败:', e);
          throw e;
        }

        // Step 5: 注册 UniverDocsPlugin
        console.log('[Univer Init] Step 5: 注册 UniverDocsPlugin...');
        try {
          univer.registerPlugin(UniverDocsPlugin);
          console.log('[Univer Init] Step 5 OK');
        } catch (e) {
          console.error('[Univer Init] Step 5 失败: UniverDocsPlugin 注册失败:', e);
          throw e;
        }

        // Step 6: 注册 UniverDocsUIPlugin
        console.log('[Univer Init] Step 6: 注册 UniverDocsUIPlugin...');
        try {
          univer.registerPlugin(UniverDocsUIPlugin);
          console.log('[Univer Init] Step 6 OK');
        } catch (e) {
          console.error('[Univer Init] Step 6 失败: UniverDocsUIPlugin 注册失败:', e);
          throw e;
        }

        // Step 7: 注册 UniverSheetsPlugin
        console.log('[Univer Init] Step 7: 注册 UniverSheetsPlugin...');
        try {
          univer.registerPlugin(UniverSheetsPlugin);
          console.log('[Univer Init] Step 7 OK');
        } catch (e) {
          console.error('[Univer Init] Step 7 失败: UniverSheetsPlugin 注册失败:', e);
          throw e;
        }

        // Step 8: 注册 UniverSheetsUIPlugin
        console.log('[Univer Init] Step 8: 注册 UniverSheetsUIPlugin...');
        try {
          univer.registerPlugin(UniverSheetsUIPlugin);
          console.log('[Univer Init] Step 8 OK');
        } catch (e) {
          console.error('[Univer Init] Step 8 失败: UniverSheetsUIPlugin 注册失败:', e);
          throw e;
        }

        // Step 9: 注册 UniverSheetsFormulaPlugin
        console.log('[Univer Init] Step 9: 注册 UniverSheetsFormulaPlugin...');
        try {
          univer.registerPlugin(UniverSheetsFormulaPlugin);
          console.log('[Univer Init] Step 9 OK');
        } catch (e) {
          console.error('[Univer Init] Step 9 失败: UniverSheetsFormulaPlugin 注册失败:', e);
          throw e;
        }

        // Step 10: 注册 UniverSheetsFormulaUIPlugin
        console.log('[Univer Init] Step 10: 注册 UniverSheetsFormulaUIPlugin...');
        try {
          univer.registerPlugin(UniverSheetsFormulaUIPlugin);
          console.log('[Univer Init] Step 10 OK');
        } catch (e) {
          console.error('[Univer Init] Step 10 失败: UniverSheetsFormulaUIPlugin 注册失败:', e);
          throw e;
        }

        // Step 11: 注册 UniverSheetsNumfmtPlugin
        console.log('[Univer Init] Step 11: 注册 UniverSheetsNumfmtPlugin...');
        try {
          univer.registerPlugin(UniverSheetsNumfmtPlugin);
          console.log('[Univer Init] Step 11 OK');
        } catch (e) {
          console.error('[Univer Init] Step 11 失败: UniverSheetsNumfmtPlugin 注册失败:', e);
          throw e;
        }

        // Step 12: 注册 UniverSheetsNumfmtUIPlugin
        console.log('[Univer Init] Step 12: 注册 UniverSheetsNumfmtUIPlugin...');
        try {
          univer.registerPlugin(UniverSheetsNumfmtUIPlugin);
          console.log('[Univer Init] Step 12 OK');
        } catch (e) {
          console.error('[Univer Init] Step 12 失败: UniverSheetsNumfmtUIPlugin 注册失败:', e);
          throw e;
        }

        // Step 13: 注册 UniverSheetsDataValidationPlugin
        console.log('[Univer Init] Step 13: 注册 UniverSheetsDataValidationPlugin...');
        try {
          univer.registerPlugin(UniverSheetsDataValidationPlugin);
          console.log('[Univer Init] Step 13 OK');
        } catch (e) {
          console.error('[Univer Init] Step 13 失败: UniverSheetsDataValidationPlugin 注册失败:', e);
          throw e;
        }

        // Step 14: 创建 FUniver 外观 API 包装实例，然后创建工作簿
        // 关键：FUniver 是外观 API 的入口，需要通过 FUniver.newAPI(univer) 创建
        console.log('[Univer Init] Step 14: 创建 FUniver 外观 API 实例...');
        let fUniver: any;
        let fWorkbook: any;
        try {
          // 使用 FUniver.newAPI() 创建外观 API 包装实例
          // 参数可以是 Univer 实例或 Injector 实例
          // 注意：由于本地 univer 源码与 node_modules 版本类型不匹配，需要使用类型断言
          fUniver = FUniver.newAPI(univer as any);
          console.log('[Univer Init] Step 14a OK: FUniver 实例创建成功');

          // 使用 FUniver 的 createWorkbook 方法创建 FWorkbook
          // 返回 FWorkbook (Facade)，其 getActiveSheet() 返回 FWorksheet
          // FWorksheet.getRange() 返回 FRange，有 setValue/setNote/setStyle 方法
          fWorkbook = fUniver.createWorkbook({
            id: 'wb-' + (formId || sheetName) + '-' + Date.now(),
            name: sheetName,
            sheetOrder: ['sheet1'],
            sheets: {
              sheet1: {
                id: 'sheet1',
                name: sheetName,
                rowCount: 100,
                columnCount: 26,
                cellData: {},
                rowData: {
                  0: { h: 30 },
                },
                columnData: {
                  0: { w: 120 },
                  1: { w: 120 },
                  2: { w: 150 },
                  3: { w: 200 },
                  4: { w: 200 },
                  5: { w: 120 },
                },
              },
            },
          });
          console.log('[Univer Init] Step 14b OK: FWorkbook 创建成功');
        } catch (e) {
          console.error('[Univer Init] Step 14 失败:', e);
          throw e;
        }

        // 保存 Facade 引用
        workbookRef.current = fWorkbook;
        univerRef.current = univer;
        fUniverRef.current = fUniver;
        setWorkbook(fWorkbook); // fWorkbook 是 FWorkbook (Facade)
        setInitialized(true);
        setInitError('');

        // 暴露 FUniver 实例到 window 桥接，供 ExcelDesign 订阅 Event.Drop 等事件
        // 确保外部组件能通过 window.__univerFAPI 访问 FUniver Facade API
        (window as any).__univerFAPI = fUniver;
        console.log('[Univer Init] ✅ FUniver 实例已暴露到 window.__univerFAPI');

        // 获取活动工作表（FWorksheet）
        const sheet = fWorkbook.getActiveSheet();
        sheetRef.current = sheet;

        // 调试：检查 sheet 对象是否有 hitTest 方法
        console.log('[Univer Init] Sheet 类型:', sheet?.constructor?.name);
        console.log('[Univer Init] Sheet.hitTest 类型:', typeof sheet?.hitTest);
        if (sheet) {
          const allMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(sheet));
          console.log('[Univer Init] Sheet 所有方法:', allMethods.filter(m => !m.startsWith('_')));
        }

        // 参照迁移文档 §7.2 事件绑定
        // 添加值变化事件（使用 FWorkbook）
        // 当单元格内容变更时触发，包括：手动编辑、拖拽移动（MoveRangeCommand）等
        let changeTimer: any = null;
        let valueChangeDisposer: (() => void) | undefined;
        try {
          // 注意：Facade 没有 onCellValueChange，需通过命令事件监听单元格值变更
          // 命令 id 为 'sheet.mutation.set-range-values'
          // params: { unitId, subUnitId, cellValue: { [row]: { [col]: { v } } } }
          valueChangeDisposer = fWorkbook.onCommandExecuted?.((command: any) => {
            // 整行/整列 插入或删除：结构性变更，需重排元数据坐标（删除还会释放被删字段供重拖）
            const cmdId = command?.id;
            if (
              cmdId === 'sheet.command.remove-row' || cmdId === 'sheet.command.remove-col' ||
              cmdId === 'sheet.command.insert-row' || cmdId === 'sheet.command.insert-col'
            ) {
              handleRowColStructural(cmdId, command?.params);
              return;
            }
            if (cmdId !== 'sheet.mutation.set-range-values') return;

            const params = command.params || {};
            const cellValue = params.cellValue;
            if (!cellValue) return;

            // 仅处理当前活动工作表，避免跨表误判
            const activeSheetId = fWorkbook.getActiveSheet?.()?.getSheetId?.();
            if (params.subUnitId && activeSheetId && params.subUnitId !== activeSheetId) return;

            // 程序自身的批量写入（放置字段/加载布局/回滚）不参与保护与自动保存
            if (isPlacingFieldRef.current || isRestoringRef.current || isLoadingRef.current) return;

            const tamperedCells: Array<{ row: number; col: number; meta: FieldMeta }> = [];

            Object.entries(cellValue).forEach(([rowKey, rowData]: [string, any]) => {
              const row = Number(rowKey);
              if (Number.isNaN(row) || !rowData) return;

              Object.entries(rowData).forEach(([colKey, cellData]: [string, any]) => {
                const col = Number(colKey);
                if (Number.isNaN(col)) return;

                const cellKey = `${row}_${col}`;
                const meta = cellFieldMetaMap.current[cellKey];
                if (!meta) return;

                const newValue = cellData?.v;

                // 清空 = 移除：字段占位符格清空 → 整字段移除（标签+输入一起释放，可完整重拖）；
                //          标签格清空 → 仅释放标签，字段输入保留（用户可能只是想改标签文字）
                if (newValue === null || newValue === undefined || newValue === '') {
                  if ((meta as any).cellType === 'field') {
                    console.log(`[CellChange] 字段占位符 (${row}, ${col}) 已删除，整字段移除`);
                    removeFieldCompletely((meta as any).fieldId, (meta as any).fieldName);
                  } else {
                    console.log(`[CellChange] 标签格 (${row}, ${col}) 已清空，仅释放标签`);
                    delete cellFieldMetaMap.current[cellKey];
                    try { saveLayoutData(); } catch (e) { console.warn('[CellChange] 同步布局失败:', e); }
                  }
                  return;
                }

                // 仅保护数据绑定字段；标签允许自由修改文字
                if (meta.cellType !== 'field') return;

                // 字段单元格由设计器管理：被改成其他内容则记录，稍后统一还原
                if (!isCellValueMatchMeta(newValue, meta)) {
                  console.log(`[CellChange] 单元格 (${row}, ${col}) 为设计器字段单元格，禁止手动修改，将自动还原`);
                  tamperedCells.push({ row, col, meta });
                }
              });
            });

            // 统一还原被篡改的单元格（放在循环外，避免回滚触发的递归）
            if (tamperedCells.length > 0) {
              isRestoringRef.current = true;
              try {
                const restoreSheet = fWorkbook.getActiveSheet?.() || sheetRef.current;
                tamperedCells.forEach(({ row, col, meta }) => {
                  restoreSheet?.getRange?.(row, col)?.setValue?.(getCellDisplayValue(meta));
                });
              } catch (restoreErr) {
                console.warn('[CellChange] 还原字段单元格失败:', restoreErr);
              }
              message.warning('该单元格由设计器管理，不可手动修改；如需移除请清空单元格');
              // 异步复位标志，确保还原操作引发的命令事件已被处理
              setTimeout(() => { isRestoringRef.current = false; }, 0);
              return; // 内容被篡改，不触发保存
            }

            // 延迟触发保存（防抖），等待拖拽操作完全结束
            if (changeTimer) clearTimeout(changeTimer);
            changeTimer = setTimeout(() => {
              // 拖拽可能导致字段元数据位置变化，需要重新保存布局
              const data = saveLayoutData();
              if (data) {
                console.log('[CellChange] 自动保存布局数据');
                onLayoutChange(data);
              }
            }, 500);
          });
        } catch (e) {
          console.warn('[Univer Init] 添加值变化事件失败:', e);
        }

        // ── 防篡改兜底：定时校验受保护的单元格 ──
        // 说明：Univer Facade 事件覆盖不全（编辑单元格可能不走 SetRangeValuesMutation），
        // 因此不依赖事件，改为定期扫描：只要字段/标签单元格的值不符合预期就还原。
        const guardTimer: any = setInterval(() => {
          if (isPlacingFieldRef.current || isRestoringRef.current || isLoadingRef.current) return;

          const guardSheet = fWorkbook.getActiveSheet?.();
          if (!guardSheet) return;

          const keys = Object.keys(cellFieldMetaMap.current);
          if (keys.length === 0) return;

          const tamperedCells: Array<{ row: number; col: number; meta: FieldMeta }> = [];

          keys.forEach((key) => {
            const [rowStr, colStr] = key.split('_');
            const row = Number(rowStr);
            const col = Number(colStr);
            if (Number.isNaN(row) || Number.isNaN(col)) return;

            const meta = cellFieldMetaMap.current[key];
            if (!meta) return;

            let current: any;
            try {
              current = guardSheet.getRange?.(row, col)?.getValue?.();
            } catch {
              return;
            }

            // 单元格被清空 = 移除（与 onCommandExecuted 语义一致：字段格整移除，标签格仅释放）
            if (current === null || current === undefined || current === '') {
              if ((meta as any).cellType === 'field') {
                console.log(`[Guard] 字段占位符 (${row}, ${col}) 已清空，整字段移除`);
                removeFieldCompletely((meta as any).fieldId, (meta as any).fieldName);
              } else {
                console.log(`[Guard] 标签格 (${row}, ${col}) 已清空，仅释放标签`);
                delete cellFieldMetaMap.current[key];
                try { saveLayoutData(); } catch (e) { console.warn('[Guard] 同步布局失败:', e); }
              }
              return;
            }

            // 仅保护数据绑定字段；标签允许自由修改文字
            if (meta.cellType !== 'field') return;

            if (!isCellValueMatchMeta(current, meta)) {
              tamperedCells.push({ row, col, meta });
            }
          });

          if (tamperedCells.length === 0) return;

          console.log('[Guard] 检测到设计器单元格被修改，自动还原:', tamperedCells.map(c => `${c.row}_${c.col}`));
          isRestoringRef.current = true;
          try {
            tamperedCells.forEach(({ row, col, meta }) => {
              guardSheet.getRange?.(row, col)?.setValue?.(getCellDisplayValue(meta));
            });
          } catch (restoreErr) {
            console.warn('[Guard] 还原字段单元格失败:', restoreErr);
          }
          message.warning('该单元格由设计器管理，不可手动修改；如需移除请清空单元格');
          setTimeout(() => { isRestoringRef.current = false; }, 0);
        }, 800);

        // 添加选区变化事件（使用 FWorkbook）
        // 用于检测拖拽操作完成后的选区变化，并广播选中单元格是否含字段元数据
        let selectionDisposer: (() => void) | undefined;
        try {
          selectionDisposer = fWorkbook.onSelectionChange?.(
            (selection: any) => {
              if (!selection) return;
              // 提取当前激活单元格坐标（兼容数组 / 对象多种事件形态）
              const selArr = Array.isArray(selection) ? selection : (selection.selection || [selection]);
              const cur = selArr[0];
              const row = cur?.actualRow ?? cur?.row ?? cur?.startRow;
              const col = cur?.actualColumn ?? cur?.col ?? cur?.startColumn;
              if (row == null || col == null) return;
              lastSelectionCellRef.current = { row, col };
              // 按字段 ID 定位（标签格回退到相邻字段格，与右键菜单逻辑一致）
              const hasField = !!resolveCellFieldId(row, col);
              const meta = hasField ? resolveCellMeta(row, col) : null;
              // 广播选中状态：无字段元数据 → 父组件禁用属性按钮（参照 ecology controlOperLimits 的禁用行为，不弹提示）
              window.dispatchEvent(new CustomEvent('univer-cell-selected', {
                detail: { row, col, hasField, fieldAttr: meta?.fieldAttr ?? null },
              }));
            }
          );
        } catch (e) {
          console.warn('[Univer Init] 添加选区变化事件失败:', e);
        }

        // 监听 Univer 内部事件：选区拖拽移动结束（由 MoveRangeRenderController 触发）
        // 注意：此事件独立于 react-dnd，是 Univer 内置的单元格拖拽功能
        // 通过检测连续的值变化来判断拖拽移动是否完成
        console.log('[Drag] ✅ 单元格拖拽功能已启用（Univer 内置功能）');
        console.log('[Drag] 支持的操作: 选中单元格 → 拖拽边框移动到新位置');
        console.log('[Drag] 视觉反馈: 半透明蓝色填充 + 亮色边框预览');

        // 加载布局数据
        // ⚠️ 两处关键修正（修复「保存后刷新页面，同一字段仍可重复拖入」）：
        // 1) 在定时器「触发时」通过 layoutDataRef 读取最新数据：本 effect 依赖只有 [sheetName]，
        //    直接读 layoutData 会捕获到初始的空 {}（真实布局是异步从后端取回的）。
        // 2) 空布局绝不能调用 loadLayoutData：它会先清空 cellFieldMetaMap 再清空整表。
        //    本处延时 300ms，晚于主 effect（100ms）的真实数据加载，
        //    一旦用空数据执行，就会把刚恢复的字段元数据全部抹掉，
        //    表现为刷新后「同一字段可重复拖入」且「只读/可编辑/必填」失效。
        setTimeout(() => {
          const latest = layoutDataRef.current;
          if (!hasLayoutContent(latest)) {
            console.log('[Layout] 初始化时布局数据尚未加载，跳过（避免抹掉已恢复的字段元数据）');
            return;
          }
          const sheetData = resolveSheetData(latest);
          if (sheetData) {
            loadLayoutData(sheetData, layoutType);
          } else {
            console.log('[Layout] 未找到对应 Sheet 的数据:', {
              sheetName,
              availableSheets: latest?.sheets ? Object.keys(latest.sheets) : null,
            });
          }
        }, 300);

        // 调试：输出 canvas 尺寸（确认手动计算方案的基础数据）
        setTimeout(() => {
          const canvasEl = containerRef.current?.querySelector('canvas');
          const canvasRect = canvasEl?.getBoundingClientRect();
          console.log('[Univer Init] Canvas 尺寸:', canvasRect ? {
            width: canvasRect.width.toFixed(0), height: canvasRect.height.toFixed(0),
            left: canvasRect.left.toFixed(0), top: canvasRect.top.toFixed(0),
          } : '无 canvas');
        }, 500);

        // 保存清理函数引用，在 useEffect cleanup 时使用
        (attemptInit as any).cleanup = () => {
          if (valueChangeDisposer && typeof valueChangeDisposer === 'function') valueChangeDisposer();
          if (selectionDisposer && typeof selectionDisposer === 'function') selectionDisposer();
          if (changeTimer) clearTimeout(changeTimer);
          if (guardTimer) clearInterval(guardTimer);
          if (univerRef.current) {
            try { (univerRef.current as any).dispose(); } catch (e) { console.error('清理失败:', e); }
          }
        };
      } catch (error) {
        console.error('Univer初始化失败:', error);
        const errMsg = (error as Error).message;
        setInitError(errMsg || '未知错误');
        if (errMsg?.includes('Expect') && errMsg?.includes('dependency')) {
          const depMatch = errMsg.match(/for id "([^"]+)"/);
          console.error('DI依赖缺失:', depMatch?.[1] || '未知');
          message.error(`Univer依赖缺失: "${depMatch?.[1] || '未知'}"`);
        } else {
          message.error('Univer表格初始化失败：' + errMsg);
        }
      }
    };

    // 启动递归 RAF 等待 containerRef.current
    rafId = requestAnimationFrame(attemptInit);

    // useEffect cleanup：取消待执行的 RAF 并执行资源清理
    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      initRef.current = false;
      if ((attemptInit as any).cleanup) {
        (attemptInit as any).cleanup();
      }
    };
  }, [sheetName]);

  // ──────────────────────────────────────────────
  // 复制 / 剪切 / 粘贴：字段元数据跟随与防重复
  // - 复制字段 → 粘贴会产生重复绑定 → 清除目标值并提示「字段不能复制」
  // - 剪切字段 → 粘贴后字段元数据跟随到新位置（避免绑定丢失）
  // 说明：Univer 的 beforeCommandExecuted 仅通知、无法取消，故在粘贴侧拦截处理；
  //       复制/剪切前用 onBeforePaste 暂存源字段元数据，粘贴后用 onPaste 处理目标。
  // ──────────────────────────────────────────────
  useEffect(() => {
    if (!initialized || !fUniverRef.current) return;
    const fUniver = fUniverRef.current;

    // 取当前激活单元格坐标（优先实时选区，回退到最近缓存）
    const getPrimaryCell = (): { row: number; col: number } | null => {
      try {
        const sheet: any = workbookRef.current?.getActiveSheet?.();
        const sel: any = sheet?.getSelection?.();
        const arr = Array.isArray(sel) ? sel : (sel?.selection || [sel]);
        const cur = arr?.[0];
        const row = cur?.actualRow ?? cur?.row ?? cur?.startRow;
        const col = cur?.actualColumn ?? cur?.col ?? cur?.startColumn;
        if (row != null && col != null) return { row, col };
      } catch { /* ignore */ }
      return lastSelectionCellRef.current;
    };

    // 供 Univer 原生菜单判定「当前格是否为字段占位符格」→ 用于把「复制」菜单项置灰。
    // Univer 侧实现：univer/packages/sheets-ui/src/menu/menu.ts 的 getExcelDesignFieldCellDisable$
    (window as any).__excelDesignIsFieldCell = (row: number, col: number) => {
      try {
        const meta = getCellFieldMeta(row, col);
        if (meta) return meta.cellType === 'field';
        // 兜底：刷新后 Map 可能为空，改按值判断（字段占位符形如 "📝 ${field_1}"）
        const sheet: any = workbookRef.current?.getActiveSheet?.();
        const v = sheet?.getRange?.(row, col)?.getValue?.();
        return typeof v === 'string' && v.includes('${');
      } catch {
        return false;
      }
    };

    // 复制/剪切前：若源格是字段，暂存其元数据（含源坐标）
    const captureSourceFieldMeta = () => {
      // 每次粘贴前先清空：避免「上次复制了字段但没粘贴，本次复制的是普通单元格」时误用过期元数据
      clipboardFieldMetaRef.current = null;
      const sel = getPrimaryCell();
      if (!sel) return;
      let meta = getCellFieldMeta(sel.row, sel.col);
      if (!meta) {
        // 兜底：刷新后 Map 可能为空，但值残留 → 从 ${fieldName} 还原最小元数据
        try {
          const sheet: any = workbookRef.current?.getActiveSheet?.();
          const v = sheet?.getRange?.(sel.row, sel.col)?.getValue?.();
          if (v && String(v).includes('${')) {
            const name = (String(v).match(/\$\{([^}]+)\}/) || [])[1];
            if (name) meta = { fieldName: name, cellType: 'field', fieldAttr: 0 } as any;
          }
        } catch { /* ignore */ }
      }
      if (meta) clipboardFieldMetaRef.current = { row: sel.row, col: sel.col, meta };
    };

    // 粘贴后：依据源是否仍保留值判断剪切/复制
    const handlePasteFieldMeta = () => {
      const clip = clipboardFieldMetaRef.current;
      clipboardFieldMetaRef.current = null;
      if (!clip) return; // 普通粘贴，无需处理
      const dest = getPrimaryCell();
      if (!dest) return;
      const sheet: any = workbookRef.current?.getActiveSheet?.();
      if (!sheet) return;
      const srcKey = `${clip.row}_${clip.col}`;
      const destKey = `${dest.row}_${dest.col}`;
      if (srcKey === destKey) return; // 原地粘贴

      let srcValue: any = '';
      try { srcValue = sheet.getRange(clip.row, clip.col)?.getValue?.() ?? ''; } catch { /* ignore */ }
      const isCut = srcValue == null || srcValue === '';

      if (isCut) {
        // 剪切：元数据跟随到新位置（标签格 / 字段占位符格都跟随，保证绑定不丢）
        delete cellFieldMetaMap.current[srcKey];
        cellFieldMetaMap.current[destKey] = clip.meta;
        try {
          setCellField(workbookRef.current, sheet, dest.row, dest.col, clip.meta);
        } catch (e) {
          console.warn('[Clipboard] 重新绑定字段元数据失败:', e);
        }
        message.success('字段已移动到新位置');
        try {
          const data = saveLayoutData();
          if (data) onLayoutChangeRef.current?.(data);
        } catch (e) { console.warn('[Clipboard] 同步布局失败:', e); }
      } else if (clip.meta.cellType === 'field') {
        // 复制「字段占位符格」→ 会产生重复字段绑定 → 禁止，清除目标值
        try { sheet.getRange(dest.row, dest.col)?.setValue?.(''); } catch { /* ignore */ }
        message.warning('字段不能复制，已清除粘贴内容');
      }
      // 复制「标签格」：允许，作为普通文本粘贴（不写入元数据，不产生重复绑定）
    };

    // 诊断：粘贴菜单项受 Univer 的 disabled$ 控制（剪贴板不支持且无内部缓存 → 灰；或缺编辑权限 → 灰）
    const supportClipboard =
      typeof navigator.clipboard !== 'undefined' &&
      typeof navigator.clipboard.readText !== 'undefined';
    console.log('[Clipboard] supportClipboard =', supportClipboard,
      '(false 说明非 localhost/https，navigator.clipboard 不可用，粘贴依赖 Univer 内部 copyId)');

    // 复制命令是否真的执行：若未打印说明 copy() 提前 return（无选区或 copyContent 为空），
    // 内部 copyId 不会被写入 → 粘贴按钮会一直置灰。
    const d0 = fUniver.onCopy?.(() => {
      console.log('[Clipboard] CopyCommand 已执行（内部 copyId 应已写入）');
    });

    const d1 = fUniver.onBeforePaste?.(captureSourceFieldMeta);
    const d2 = fUniver.onPaste?.(handlePasteFieldMeta);
    return () => {
      d0?.dispose?.();
      d1?.dispose?.();
      d2?.dispose?.();
      delete (window as any).__excelDesignIsFieldCell;
    };
  }, [initialized, getCellFieldMeta, setCellField, saveLayoutData]);

  // 暴露接口给父组件（通过 window 桥接）
  // 使用 Facade API (FWorkbook/FWorksheet)
  // ──────────────────────────────────────
  useEffect(() => {
    if (workbook) {
      // 设置字段属性（参照 ecology excel 设计器）
      const setFieldAttr = (row: number, col: number, attrValue: number) => {
        const sheet = workbook.getActiveSheet();
        if (!sheet) return;

        // 按字段 ID 定位（参照 ecology：属性按字段ID存储，label 与 field 同步生效）
        const fieldId = resolveCellFieldId(row, col);
        if (!fieldId) {
          console.warn('[setFieldAttr] 未找到字段，row=' + row + ', col=' + col);
          return;
        }

        // 刷新后 Map 可能只有部分单元格（甚至为空）：从持久化布局补全该 fieldId 的全部单元格，
        // 否则只更新 Map 里已有的那一格，label/field 双格不同步、保存也会丢字段元数据。
        const lData = layoutDataRef.current;
        const lSheet = lData ? resolveSheetData(lData) : null;
        const lCellData = lSheet?.cellData;
        if (lCellData) {
          Object.entries(lCellData).forEach(([rk, rd]: any) => {
            const r = Number(rk);
            Object.entries(rd || {}).forEach(([ck, cell]: any) => {
              const fm = (cell as any)?.fieldMeta;
              if (fm && String(fm.fieldId) === fieldId) {
                cellFieldMetaMap.current[`${r}_${Number(ck)}`] = fm;
              }
            });
          });
        }

        // 遍历所有同 fieldId 的单元格，统一更新属性并刷新显示/样式
        Object.entries(cellFieldMetaMap.current).forEach(([key, meta]) => {
          if (!meta || String(meta.fieldId) !== fieldId) return;
          meta.fieldAttr = attrValue;
          meta.required = attrValue === 3;
          meta.readonly = attrValue === 1;
          const [r, c] = key.split('_').map(Number);
          try {
            const range = sheet.getRange(r, c);
            // 字段前面的图标随 fieldAttr 切换（只读🔒 / 必填⚠️，可编辑沿用类型图标）
            range.setValue(getCellDisplayValue(meta));
            applyFieldAttrStyle(range, meta);
          } catch (e) {
            console.warn('[setFieldAttr] 更新单元格失败:', e);
          }
        });

        // 立即持久化布局，确保字段属性被保存
        try {
          const data = saveLayoutData();
          if (data) onLayoutChangeRef.current?.(data);
        } catch (e) {
          console.warn('[setFieldAttr] 自动保存失败:', e);
        }

        console.log(`[setFieldAttr] 设置字段属性: fieldId=${fieldId}, attr=${attrValue}`);
        // 通知设计器同步工具栏高亮状态（只读/可编辑/必填）
        window.dispatchEvent(new CustomEvent('univer-field-attr-applied', { detail: { attr: attrValue } }));
      };

      // 获取当前选中单元格
      const getSelection = () => {
        try {
          const sheet = workbook.getActiveSheet();
          const selection = sheet.getSelection();
          if (!selection) return null;
          const currentCell = selection.getCurrentCell();
          if (!currentCell) return null;
          return {
            row: currentCell.actualRow,
            col: currentCell.actualColumn,
          };
        } catch (e) {
          console.warn('[getSelection] 获取选中单元格失败:', e);
        }
        return null;
      };

      // 清空单元格
      const clearCell = (row: number, col: number) => {
        const sheet: any = (workbook as any).getActiveSheet?.();
        // 右键清空命中字段格：占位符 → 整字段移除（两格一起释放，可完整重拖）；标签 → 仅释放标签
        const meta = cellFieldMetaMap.current[`${row}_${col}`];
        const metaId = meta && (meta as any).fieldId !== undefined && (meta as any).fieldId !== null
          ? String((meta as any).fieldId)
          : '';
        if (meta && metaId) {
          if ((meta as any).cellType === 'field') {
            removeFieldCompletely(metaId, (meta as any).fieldName);
          } else {
            delete cellFieldMetaMap.current[`${row}_${col}`];
            const range = sheet?.getRange?.(row, col);
            if (range) {
              range.setValue?.('');
              try { range.setBackgroundColor?.('#ffffff'); range.setFontColor?.('#000000'); } catch { /* ignore */ }
            }
            try { saveLayoutData(); } catch (e) { console.warn('[clearCell] 同步布局失败:', e); }
          }
          return;
        }
        // 普通单元格：仅清空本格
        const range = sheet?.getRange?.(row, col);
        if (range) {
          range.setValue?.('');
          // 清除锁定样式，避免删除字段后残留灰底
          try {
            range.setBackgroundColor?.('#ffffff');
            range.setFontColor?.('#000000');
          } catch (e) {
            console.warn('清除单元格样式失败:', e);
          }
        }
        delete cellFieldMetaMap.current[`${row}_${col}`];
        // 同步布局：saveLayoutData 内部会 onLayoutChange（含清空场景），
        // 确保面板 usedFieldKeys 刷新（可重新拖入）且清空结果可被保存
        try {
          saveLayoutData();
        } catch (e) {
          console.warn('[clearCell] 同步布局失败:', e);
        }
      };

      (window as any).univerExcelGrid = {
        saveLayoutData,
        loadLayoutData,
        handleFieldDrop,
        getCellFieldMeta,
        getContextCell: () => rightClickCellRef.current,  // 右键命中的单元格（工具栏无选区时回退用）
        getWorkbook: () => workbook,  // 返回 FWorkbook
        getActiveSheet: () => (workbook as any).getActiveSheet(),  // 返回 FWorksheet
        getWorkbookId: () => workbookRef.current?.getUnitId?.(),
        setFieldAttr,  // 设置字段属性
        getSelection,  // 获取选中单元格
        clearCell,     // 清空单元格
      };
    }
  }, [workbook, saveLayoutData, loadLayoutData, handleFieldDrop, getCellFieldMeta, removeFieldCompletely]);

  // ──────────────────────────────────────
  // 监听 layoutData 变化，重新加载布局数据
  // ──────────────────────────────────────
  useEffect(() => {
    if (!workbook || !layoutData) return;

    // 如果正在放置字段，跳过重新加载，避免清空刚放置的内容
    if (isPlacingFieldRef.current) {
      console.log('[Layout] 正在放置字段，跳过重新加载');
      return;
    }

    // 未加载的空 {} 不触发加载：loadLayoutData 会先清空 cellFieldMetaMap 再清空整表，
    // 用「尚未加载」的空对象执行会把已恢复的字段元数据抹掉。
    if (!hasLayoutContent(layoutData)) {
      console.log('[Layout] 布局数据为空（尚未加载），跳过重新加载');
      return;
    }

    console.log('[Layout] layoutData 变化，重新加载', { sheetName, hasCellData: !!(layoutData.sheets || layoutData.cellData) });

    // 支持两种格式（解析逻辑与 Univer 初始化处共用 resolveSheetData）
    const sheetData = resolveSheetData(layoutData);

    if (sheetData) {
      // 使用微延迟确保表格已渲染
      setTimeout(() => {
        loadLayoutData(sheetData, layoutType);
        console.log('[Layout] reload 后 Map keys =', Object.keys(cellFieldMetaMap.current));
      }, 100);
    } else {
      console.log('[Layout] 未找到对应 Sheet 的数据:', { sheetName, availableSheets: layoutData.sheets ? Object.keys(layoutData.sheets) : null });
    }
  }, [layoutData, workbook, sheetName, loadLayoutData]);

  // 组件卸载时清理 hover 定时器
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────
  // 持续记录鼠标实时位置 + 在右键那一刻（光标精确落在字段格上）用 hitTest 锁定命中格
  // 右键菜单统一走 Univer 原生菜单，这里只在 window 捕获阶段先一步锁定命中格，
  // 避免点击菜单项时鼠标已下移、导致反算偏到其它格子。
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    const handleContextMenuCapture = (e: MouseEvent) => {
      // 只处理落在 Univer 容器内的右键，避免页面其它区域的右键污染命中格缓存
      const targetEl = e.target as any;
      const inside = !!(containerRef.current && e.target instanceof Node && containerRef.current.contains(e.target));
      console.log('[CtxMenu] 捕获到右键事件:', {
        inside,
        targetTag: targetEl?.tagName,
        targetClass: typeof targetEl?.className === 'string' ? targetEl.className.slice(0, 60) : targetEl?.className,
        clientX: e.clientX,
        clientY: e.clientY,
        oldRef: rightClickCellRef.current,
      });
      // 位置始终记录（不受容器判定影响），保证「像素吸附」几何兜底始终有可用的右键点
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      rightClickPosRef.current = { x: e.clientX, y: e.clientY };
      if (!inside) return;

      // ── 诊断：右键时把坐标/尺寸/各定位结果全部打出，用于一次性定死映射关系 ──
      try {
        const sheet: any = workbookRef.current?.getActiveSheet?.();
        const canvasEl = containerRef.current?.querySelector('canvas');
        const canvasRect = canvasEl?.getBoundingClientRect();
        if (sheet && canvasRect) {
          const rx = e.clientX - canvasRect.left;
          const ry = e.clientY - canvasRect.top;
          const widths = [0, 1, 2, 3].map((c) => { try { return sheet.getColumnWidth?.(c); } catch { return null; } });
          const heights = [0, 1, 2, 3, 4].map((r) => { try { return sheet.getRowHeight?.(r); } catch { return null; } });
          let hit: any = null;
          try { hit = sheet.hitTest?.(e.clientX, e.clientY); } catch { /* ignore */ }

          // 已知挂了元数据的字段格，逐个给出像素矩形，用来判断点击落在哪一格
          const fieldKeys = Object.keys(cellFieldMetaMap.current);
          const rects: Record<string, any> = {};
          const vals: Record<string, any> = {};
          for (const key of fieldKeys.slice(0, 6).concat(['1_1', '1_0'])) {
            const [r, c] = key.split('_').map(Number);
            if (!Number.isFinite(r) || !Number.isFinite(c)) continue;
            try { rects[key] = sheet.getCellRect?.(r, c); } catch { /* ignore */ }
            try { vals[key] = sheet.getRange?.(r, c, 1, 1)?.getValue?.(); } catch { /* ignore */ }
          }

          const handCalc = getCellFromMouseEvent(e.clientX, e.clientY);
          const round = (n: any) => (typeof n === 'number' ? Math.round(n * 10) / 10 : n);
          console.log('[CtxMenuDiag]', JSON.stringify({
            client: { x: e.clientX, y: e.clientY },
            canvas: { left: round(canvasRect.left), top: round(canvasRect.top) },
            rel: { x: round(rx), y: round(ry) },
            widths: widths.map(round),
            heights: heights.map(round),
            handCalc,
            hitTest: hit ? { row: hit.row, col: hit.column } : null,
            rects,
            vals,
            fieldKeys,
          }));
        }
      } catch (diagErr) {
        console.warn('[CtxMenuDiag] 诊断失败:', diagErr);
      }

      // 命中格：hitTest 成功即采用（与 Univer 自身判定同源，最可靠）；
      // hitTest 拿不到时，仅在点击确实落在容器内才用 getCellFromMouseEvent 的累加兜底，
      // 避免页面其它区域的右键把缓存污染成无意义的格子。
      // 另：不能用 window.__univerFAPI，它可能是 HMR 残留的另一个 Univer 实例。
      let cell: { row: number; col: number } | null = null;
      try {
        const sheetHit: any = workbookRef.current?.getActiveSheet?.();
        const hit = sheetHit && typeof sheetHit.hitTest === 'function' ? sheetHit.hitTest(e.clientX, e.clientY) : null;
        if (hit && Number.isFinite(hit.row) && Number.isFinite(hit.column) && hit.row >= 0 && hit.column >= 0) {
          cell = { row: hit.row, col: hit.column };
        }
      } catch { /* ignore */ }
      if (!cell) {
        try { cell = getCellFromMouseEvent(e.clientX, e.clientY) as any; } catch { /* ignore */ }
      }
      if (cell && cell.row >= 0 && cell.col >= 0) {
        rightClickCellRef.current = { row: cell.row, col: cell.col };
        console.log('[CtxMenu] 右键命中格:', { x: e.clientX, y: e.clientY, row: cell.row, col: cell.col });
      }
    };
    window.addEventListener('mousemove', handleMouseMove, true);
    window.addEventListener('contextmenu', handleContextMenuCapture, true);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove, true);
      window.removeEventListener('contextmenu', handleContextMenuCapture, true);
    };
  }, [getCellFromMouseEvent]);

  // ─────────────────────────────────────────────────────────────────
  // 监听 univer 右键菜单字段属性变更事件（来自 univer 核心的 field-attr.command.ts）
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    // 解析某坐标「附近」的字段元数据：先本格，再上下左右相邻格。
    //
    // 必须带相邻回退的原因：设计上一个字段占两格（前一格=标签，后一格=字段占位符），
    // 而元数据挂在标签格上（实测 fieldKeys=['1_0']，但字段值 🔒📝${field_1} 在 (1,1)）。
    // setFieldAttr 内部正是用 resolveCellFieldId（含相邻回退）按 fieldId 定位、
    // 并让 label 与 field 同步生效；因此这里的门限判断必须同样带相邻回退，
    // 否则右键字段格会被误判为「没有元数据」，setFieldAttr 永远得不到调用。
    const findMetaNear = (r: number, c: number): { key: string; meta: any } | null => {
      // 窗口：本格 + 相邻(±1) + 扩展(±3列/±1行)，按到点击点距离优先。
      // 右击常落在字段右缘外侧（实测偏移 2 列：字段在 (1,1)、命中 (1,3)），
      // 仅查相邻 4 格够不到，必须扩大窗口；并在 Map 为空时回退到持久化 layoutData。
      const R = 1, C = 3;
      const cand: Array<[number, number]> = [];
      for (let dr = -R; dr <= R; dr++) {
        for (let dc = -C; dc <= C; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr >= 0 && cc >= 0) cand.push([rr, cc]);
        }
      }
      cand.sort(
        (a, b) =>
          Math.abs(a[0] - r) + Math.abs(a[1] - c) - (Math.abs(b[0] - r) + Math.abs(b[1] - c)),
      );

      // 1) 内存 Map（当前会话最实时）
      for (const [rr, cc] of cand) {
        const m = cellFieldMetaMap.current[`${rr}_${cc}`];
        if (m) return { key: `${rr}_${cc}`, meta: m };
      }
      // 2) 持久化布局兜底（刷新后 Map 可能为空，但 layoutData 已加载、含 fieldMeta）
      const data = layoutDataRef.current;
      const sd = data ? resolveSheetData(data) : null;
      const cd = sd?.cellData;
      if (cd) {
        for (const [rr, cc] of cand) {
          const cell = cd[rr]?.[cc] || cd[String(rr)]?.[String(cc)];
          const fm = (cell as any)?.fieldMeta;
          if (fm) {
            cellFieldMetaMap.current[`${rr}_${cc}`] = fm; // 同步回 Map
            return { key: `${rr}_${cc}`, meta: fm };
          }
        }
      }

      // 3) 单元格实际内容兜底：字段仍画在表上（含 ${fieldName} 占位符）即反解重建，
      //    确保即使 Map 与 layoutData 都为空，属性切换也能命中并生效（与 lookupCellMeta 一致）。
      const sheet3 = workbookRef.current?.getActiveSheet?.();
      if (sheet3) {
        let targetName: string | null = null;
        for (const [rr, cc] of cand) {
          try {
            const v = String(sheet3.getRange(rr, cc).getValue() ?? '');
            const mm = v.match(/\$\{([^}]+)\}/);
            if (mm) { targetName = mm[1]; break; }
          } catch { /* ignore */ }
        }
        if (targetName) {
          const rebuilt = rebuildFieldMetaFromSheet(targetName, sheet3, r, c);
          if (rebuilt) return rebuilt;
        }
      }
      return null;
    };

    const handleFieldAttrChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.attr === undefined) return;

      // 获取当前选中单元格
      const workbook = workbookRef.current;
      if (!workbook) return;

      try {
        // 反算目标格子坐标：收集全部候选，取第一个「确实挂了字段元数据」的坐标。
        // 旧实现只要第一个候选非负就直接使用，即使该格根本没有元数据也不再回退，
        // 一旦坐标偏离（如右击不移动选区、取到旧格）就永远查不到字段，
        // 表现为「只读切不回可编辑 / 必填」。
        const sheet = workbook.getActiveSheet();
        const candidates: { row: number; col: number; src: string }[] = [];

        // 1) 右键命中缓存（右键那一刻锁定，最可靠）
        const rc = rightClickCellRef.current;
        if (rc && rc.row >= 0 && rc.col >= 0) {
          candidates.push({ row: rc.row, col: rc.col, src: 'rightClickCellRef' });
        }
        // 2) 当前活动选区（次选：右击不移动选区，可能是旧格）
        // 注：不再用「实时鼠标位置」反算——点击菜单项时鼠标已移到菜单上，
        // 反算出来的格子是菜单遮挡处的格子，会误伤其它字段。
        const currentCell = sheet?.getSelection?.()?.getCurrentCell?.();
        if (currentCell) {
          candidates.push({ row: currentCell.actualRow, col: currentCell.actualColumn, src: 'selection' });
        }

        let row = candidates[0]?.row ?? -1;
        let col = candidates[0]?.col ?? -1;
        let src = candidates[0]?.src ?? 'none';
        let fieldMeta: FieldMeta | null = null;
        for (const c of candidates) {
          const found = findMetaNear(c.row, c.col);
          if (found) {
            // 作用坐标仍用「右键命中的那一格」：setFieldAttr 内部会按 fieldId
            // 找出标签格与字段格，让二者同步生效（resolveCellFieldId 亦含相邻回退）。
            row = c.row;
            col = c.col;
            src = found.key === `${c.row}_${c.col}` ? c.src : `${c.src}+near(${found.key})`;
            fieldMeta = found.meta as FieldMeta;

            // 元数据补齐：若本格其实是「字段占位符」（形如 🔒 📝 ${field_1}）却没有元数据，
            // 而相邻格（标签格）挂了同一字段，则把元数据克隆到本格并标记为 field。
            // 否则 setFieldAttr 只会更新有元数据的格子，本格的图标/样式不会变，
            // 表现为「切了只读/可编辑/必填但没效果」。
            if (found.key !== `${c.row}_${c.col}`) {
              try {
                const cellVal = String(sheet?.getRange?.(c.row, c.col, 1, 1)?.getValue?.() ?? '');
                if (cellVal.includes('${')) {
                  cellFieldMetaMap.current[`${c.row}_${c.col}`] = {
                    ...(found.meta as any),
                    cellType: 'field',
                  };
                  console.log('[FieldAttrEvent] 已补齐字段格元数据:', `${c.row}_${c.col}`, '来源相邻格', found.key);
                }
              } catch { /* ignore */ }
            }
            break;
          }
        }

        // 3) 兜底：按像素矩形吸附到字段格
        //    索引约定若与写入时不一致（历史数据/约定漂移），按索引就永远查不到元数据，
        //    此时改用几何位置判定：右键那一刻的点落在哪个字段格的矩形内。
        if (!fieldMeta) {
          const snapped = findFieldCellByPosition();
          if (snapped) {
            const m = cellFieldMetaMap.current[`${snapped.row}_${snapped.col}`];
            if (m) {
              row = snapped.row;
              col = snapped.col;
              src = 'rectSnap';
              fieldMeta = m as FieldMeta;
            }
          }
        }

        const cellKey = `${row}_${col}`;
        console.log('[FieldAttrEvent] 查找前 Map keys =', Object.keys(cellFieldMetaMap.current), '目标', cellKey, '来源', src, '候选', candidates);

        if (fieldMeta) {
          // 通过 window 桥接调用 setFieldAttr（如果有暴露）
          const gridApi = (window as any).univerExcelGrid;
          if (gridApi && gridApi.setFieldAttr) {
            gridApi.setFieldAttr(row, col, detail.attr);
            console.log(`[FieldAttrEvent] 通过 univer 菜单设置字段属性: row=${row}, col=${col}, attr=${detail.attr}`);
          }
        } else {
          // 诊断：持久化布局里到底有没有 fieldMeta（区分"坐标偏差"还是"元数据根本没落库"）
          let layoutFieldCount = 0;
          try {
            const sd = layoutDataRef.current ? resolveSheetData(layoutDataRef.current) : null;
            const cd = sd?.cellData;
            if (cd) {
              Object.entries(cd).forEach(([, rd]: any) => {
                Object.entries(rd || {}).forEach(([, cell]: any) => {
                  if ((cell as any)?.fieldMeta) layoutFieldCount++;
                });
              });
            }
          } catch { /* ignore */ }
          console.warn('[FieldAttrEvent] 选中单元格没有字段元数据:', { row, col, layoutFieldCount });
        }
      } catch (e) {
        console.warn('[FieldAttrEvent] 处理字段属性变更失败:', e);
      }
    };

    window.addEventListener('univer-field-attr-change', handleFieldAttrChange);

    // 清空单元格事件
    const handleCellClear = () => {
      const workbook = workbookRef.current;
      if (!workbook) return;
      try {
        const sheet = workbook.getActiveSheet();
        // 与字段属性一致：优先用右键那一刻锁定的命中格 rightClickCellRef，其次活动选区。
        // 不用「实时鼠标位置」反算：点击菜单项时鼠标已移到菜单上，会反算出菜单遮挡处的格子。
        let row = -1;
        let col = -1;
        const rc = rightClickCellRef.current;
        if (rc && rc.row >= 0 && rc.col >= 0) {
          row = rc.row;
          col = rc.col;
        }
        if (row < 0 || col < 0) {
          const selection = sheet?.getSelection?.();
          if (!selection) return;
          const currentCell = selection.getCurrentCell();
          if (!currentCell) return;
          row = currentCell.actualRow;
          col = currentCell.actualColumn;
        }
        // 与字段属性一致：附近（本格 + 相邻格）查不到元数据时，才用像素吸附兜底
        if (!findMetaNear(row, col)) {
          const snapped = findFieldCellByPosition();
          if (snapped) {
            row = snapped.row;
            col = snapped.col;
          }
        }
        const gridApi = (window as any).univerExcelGrid;
        if (gridApi && gridApi.clearCell) {
          gridApi.clearCell(row, col);
          console.log(`[CellClearEvent] 通过 univer 菜单清空单元格: row=${row}, col=${col}`);
        }
      } catch (e) {
        console.warn('[CellClearEvent] 清空单元格失败:', e);
      }
    };
    window.addEventListener('univer-cell-clear', handleCellClear);

    return () => {
      window.removeEventListener('univer-field-attr-change', handleFieldAttrChange);
      window.removeEventListener('univer-cell-clear', handleCellClear);
    };
  }, [getCellFromMouseEvent, findFieldCellByPosition]);

  // ─────────────────────────────────────────────────────────────────
  // ★★★ 全局 window 级别原生 drop 监听器（终极兜底方案）★★★
  // 独立于任何组件状态，确保在整个页面生命周期内都能捕获 drop 事件。
  // 即使 workbook 未就绪也会注册，只是不处理而已。
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    console.log('[GlobalDrop] 注册全局 window drop 监听器');

    let dragCount = 0;

    const handleGlobalDragOver = (e: DragEvent) => {
      // 检查是否有待放置的字段
      const pending = (window as any).__pendingField;
      if (pending) {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'copy';
      }
    };

    const handleGlobalDrop = (e: DragEvent) => {
      dragCount++;
      console.log(`[GlobalDrop][${dragCount}] drop 事件触发`, {
        hasDataTransfer: !!e.dataTransfer,
        types: e.dataTransfer ? Array.from(e.dataTransfer.types) : [],
        clientX: e.clientX,
        clientY: e.clientY,
        target: e.target?.tagName || 'unknown',
      });

      // 如果没有待放置字段，直接返回
      const pendingField = (window as any).__pendingField;
      if (!pendingField) {
        console.log('[GlobalDrop] 无待放置字段，跳过');
        return;
      }

      console.log('[GlobalDrop] 检测到待放置字段:', pendingField.fieldLabel || pendingField.fieldName);

      // 只有当 workbook 就绪时才处理
      if (!workbook) {
        console.log('[GlobalDrop] workbook 未就绪，跳过处理');
        return;
      }

      // 获取字段数据
      let fieldData: any = pendingField;

      // 计算单元格坐标
      const { row, col } = getCellFromMouseEvent(e.clientX, e.clientY);
      console.log(`[GlobalDrop] 计算单元格: (${row}, ${col})`);

      // 执行放置
      if (row >= 0 && col >= 0) {
        console.log('[GlobalDrop] 执行 handleFieldDrop');
        handleFieldDrop(fieldData, row, col);
        e.preventDefault();
      }
    };

    window.addEventListener('dragover', handleGlobalDragOver, false);
    window.addEventListener('drop', handleGlobalDrop, false);
    console.log('[GlobalDrop] ✅ 全局监听器已注册');

    return () => {
      window.removeEventListener('dragover', handleGlobalDragOver, false);
      window.removeEventListener('drop', handleGlobalDrop, false);
      console.log('[GlobalDrop] 监听器已移除');
    };
  }, [workbook, handleFieldDrop, getCellFromMouseEvent]);

  // ─────────────────────────────────────────────────────────────────
  // ★★★ 容器级别原生 drop 监听器（兜底方案）★★★
  // 绕过 react-dnd 和 Univer Event.Drop 两条路径。
  // 注册到 container 元素上，确保能捕获到 drop 事件。
  // 注意：必须同时监听 dragover 并阻止默认行为，否则 drop 事件不会触发。
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    // ★★★ 调试：确认 useEffect 被执行 ★★★
    console.log('[NativeDrop] useEffect 执行, workbook:', !!workbook);

    if (!workbook || !containerRef.current) {
      console.log('[NativeDrop] workbook 或 container 未就绪，跳过注册');
      return;
    }

    const container = containerRef.current;
    let dragCount = 0;

    // 必须阻止 dragover 的默认行为，否则 drop 事件不会触发
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleNativeDrop = (e: DragEvent) => {
      // ★★★ 调试：记录所有 drop 事件 ★★★
      console.log('[NativeDrop] drop 事件触发', {
        hasDataTransfer: !!e.dataTransfer,
        types: e.dataTransfer ? Array.from(e.dataTransfer.types) : [],
        clientX: e.clientX,
        clientY: e.clientY,
        target: e.target?.tagName || 'unknown',
      });

      if (!e.dataTransfer) return; // 不是拖拽事件，忽略

      dragCount++;
      const eventId = dragCount;

      // Step 1: 获取字段数据
      const pendingField = (window as any).__pendingField;
      let fieldData: any = null;

      if (pendingField) {
        fieldData = pendingField;
      }

      if (!fieldData && e.dataTransfer) {
        try {
          const jsonStr = e.dataTransfer.getData('application/json');
          if (jsonStr) {
            fieldData = JSON.parse(jsonStr);
          }
        } catch { /* ignore */ }
      }

      if (!fieldData) return;

      // Step 2: 获取鼠标坐标 → 转换为单元格坐标
      const { row, col } = getCellFromMouseEvent(e.clientX, e.clientY);
      console.log(`[NativeDrop][${eventId}] drop at (${e.clientX},${e.clientY}) → cell(${row},${col}), field=${fieldData.fieldLabel || fieldData.fieldName}`);

      // Step 3: 执行字段放置
      if (row >= 0 && col >= 0) {
        handleFieldDrop(fieldData, row, col);
        e.preventDefault();
        e.stopPropagation();
      }
    };

    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('drop', handleNativeDrop);
    console.log('[NativeDrop] container drop 监听器已注册');

    return () => {
      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('drop', handleNativeDrop);
    };
  }, [workbook, handleFieldDrop, getCellFromMouseEvent, containerRef.current]);

  // ─────────────────────────────────────────────────────────────────
  // ★★★ 核心：拖拽时禁用 Univer canvas 的 pointer-events ★★★
  //
  // 问题根因：Univer 内部渲染的 <canvas> 元素覆盖在 container 之上，
  //          canvas 会拦截所有鼠标/拖放事件（dragenter/dragover/drop），
  //          导致 react-dnd 的 useDrop 和原生 drop 监听器都无法收到事件。
  //
  // 解决方案：监听容器上的 dragenter/dragleave/drop/dragend 事件，
  //           在拖拽进行中将 container 内所有 canvas 的 pointer-events 设为 none，
  //           让事件穿透到下层的 drop target。拖拽结束后恢复。
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    /** 将 container 内所有 canvas 的 pointer-events 设为 none */
    const disableCanvasPointerEvents = () => {
      const canvases = container.querySelectorAll('canvas');
      canvases.forEach((c) => {
        (c as HTMLElement).style.pointerEvents = 'none';
      });
    };

    /** 恢复 container 内所有 canvas 的 pointer-events */
    const restoreCanvasPointerEvents = () => {
      const canvases = container.querySelectorAll('canvas');
      canvases.forEach((c) => {
        (c as HTMLElement).style.pointerEvents = '';
      });
    };

    let isDragOver = false;

    const handleDragEnter = (e: DragEvent) => {
      // 只响应外部拖入（从 FieldPalette 拖来的字段）
      const pending = (window as any).__pendingField;
      if (!pending) return;

      e.preventDefault();
      e.stopPropagation();
      if (!isDragOver) {
        isDragOver = true;
        disableCanvasPointerEvents();
        console.log('[CanvasBypass] 拖拽进入 Univer 区域，已禁用 canvas pointer-events');
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      // 只有真正离开 container 时才恢复（避免子元素触发的 dragleave 误判）
      const relatedTarget = e.relatedTarget as Node | null;
      if (container.contains(relatedTarget)) return;

      if (isDragOver) {
        isDragOver = false;
        restoreCanvasPointerEvents();
        console.log('[CanvasBypass] 拖拽离开 Univer 区域，已恢复 canvas pointer-events');
      }
    };

    const handleDragEnd = () => {
      if (isDragOver) {
        isDragOver = false;
        restoreCanvasPointerEvents();
        console.log('[CanvasBypass] 拖拽结束，已恢复 canvas pointer-events');
      }
    };

    const handleDrop = (e: DragEvent) => {
      if (isDragOver) {
        isDragOver = false;
        // 延迟一帧恢复，确保 drop 事件处理完成
        requestAnimationFrame(() => restoreCanvasPointerEvents());
        console.log('[CanvasBypass] drop 完成，已恢复 canvas pointer-events');
      }
    };

    container.addEventListener('dragenter', handleDragEnter);
    container.addEventListener('dragleave', handleDragLeave);
    container.addEventListener('dragend', handleDragEnd);
    container.addEventListener('drop', handleDrop);

    // 全局 dragend 兜底：防止拖拽在 container 外结束导致未恢复
    window.addEventListener('dragend', handleDragEnd);

    console.log('[CanvasBypass] canvas pointer-events 穿透逻辑已注册');

    return () => {
      container.removeEventListener('dragenter', handleDragEnter);
      container.removeEventListener('dragleave', handleDragLeave);
      container.removeEventListener('dragend', handleDragEnd);
      container.removeEventListener('drop', handleDrop);
      window.removeEventListener('dragend', handleDragEnd);
      restoreCanvasPointerEvents();
    };
  }, [containerRef.current]);

  // ──────────────────────────────────────
  // 渲染
  // 注意：containerRef 的 div 必须始终渲染，否则 ref 回调永远不会触发，
  // 导致递归 RAF 永远等不到 containerRef.current，一直卡在"加载中"。
  // 加载/错误状态用遮罩层叠加显示，不替换 container div。
  // ──────────────────────────────────────
  return (
    <Card
      title={
        <span style={{ fontSize: 13 }}>
          📋 工作表: {sheetName}
          {pendingField && (
            <span style={{ marginLeft: 12, color: '#1890ff', fontSize: 12 }}>
              待放置: {pendingField.fieldLabel || pendingField.label || pendingField.fieldName || pendingField.type}
            </span>
          )}
        </span>
      }
      size="small"
      styles={{ body: { padding: 0, position: 'relative' } }}
      extra={[
        <Button key="save" size="small" type="primary" onClick={saveLayoutData}>
          保存
        </Button>,
      ]}
    >
      {/* 始终渲染 container，确保 ref 回调能触发 */}
      <div
        ref={(el) => {
          containerRef.current = el;
          if (el) {
            (dropRef as any)(el);
          }
        }}
        style={{
          width: '100%',
          height: 600,
          border: '1px solid #d9d9d9',
          backgroundColor: isOver ? '#e6f7ff' : '#fff',
          transition: 'background-color 0.2s',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 字段悬停高亮边框 - 绝对定位在 canvas 上方，含 8px 内边距 */}
        {hoverVisible && hoverStyle && (
          <div
            style={{
              position: 'absolute',
              // 内边距 8px：边框略微大于单元格，视觉上更舒适
              left: hoverStyle.left - 8,
              top: hoverStyle.top - 8,
              width: hoverStyle.width + 16,
              height: hoverStyle.height + 16,
              border: '2px solid #007bff',
              borderRadius: 2,
              pointerEvents: 'none',
              zIndex: 5,
              boxSizing: 'border-box',
              outline: 'none',
              // 过渡效果：平滑移动和大小变化（0.3s ease，符合 0.3-0.5s 要求）
              transition: [
                'left 0.3s ease',
                'top 0.3s ease',
                'width 0.3s ease',
                'height 0.3s ease',
                'opacity 0.3s ease',
                'border-color 0.3s ease',
              ].join(', '),
              // Chrome/Safari/Edge (WebKit) 前缀
              WebkitTransition: [
                'left 0.3s ease',
                'top 0.3s ease',
                'width 0.3s ease',
                'height 0.3s ease',
                'opacity 0.3s ease',
              ].join(', '),
              // Firefox (Moz) 前缀
              MozTransition: [
                'left 0.3s ease',
                'top 0.3s ease',
                'width 0.3s ease',
                'height 0.3s ease',
                'opacity 0.3s ease',
              ].join(', '),
              // IE/Edge 旧版 (ms) 前缀
              msTransition: [
                'left 0.3s ease',
                'top 0.3s ease',
                'width 0.3s ease',
                'height 0.3s ease',
                'opacity 0.3s ease',
              ].join(', '),
              opacity: 1,
              // box-shadow 增强视觉深度
              boxShadow: '0 0 6px rgba(0, 123, 255, 0.3), 0 0 2px rgba(0, 123, 255, 0.2)',
            }}
          />
        )}
      </div>

      {/* 加载中遮罩 */}
      {!initialized && !initError && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.8)',
            zIndex: 10,
          }}
        >
          <Spin size="large" description="正在加载 Excel 表格..." />
        </div>
      )}
      {/* 错误遮罩 */}
      {initError && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.9)',
            zIndex: 10,
            color: '#ff4d4f',
          }}
        >
          <p>Excel 初始化失败</p>
          <p style={{ fontSize: 12, color: '#999' }}>{initError}</p>
          <Button type="primary" onClick={() => { setInitError(''); window.location.reload(); }}>
            重新加载
          </Button>
        </div>
      )}
    </Card>
  );
};

export default UniverExcelGrid;
