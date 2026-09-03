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
  s?: number;                            // 样式索引
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
  const resolveCellFieldId = (row: number, col: number): string | null => {
    const direct = cellFieldMetaMap.current[`${row}_${col}`];
    if (direct?.fieldId) return String(direct.fieldId);
    const neighbors = [
      [row, col - 1], [row, col + 1], [row - 1, col], [row + 1, col],
    ];
    for (const [nr, nc] of neighbors) {
      if (nr < 0 || nc < 0) continue;
      const m = cellFieldMetaMap.current[`${nr}_${nc}`];
      if (m?.fieldId) return String(m.fieldId);
    }
    return null;
  };

  /** 解析某坐标对应的字段元数据（含相邻回退），供右键菜单高亮当前属性用 */
  const resolveCellMeta = (row: number, col: number): FieldMeta | null => {
    const fid = resolveCellFieldId(row, col);
    if (!fid) return null;
    const direct = cellFieldMetaMap.current[`${row}_${col}`];
    if (direct?.fieldId) return direct as FieldMeta;
    return (Object.values(cellFieldMetaMap.current).find((m: any) => String(m?.fieldId) === fid) as FieldMeta) || null;
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

          // 解析字段元数据
          if ((cell as any).fieldMeta) {
            // 存储到内存 Map（复制一份，避免直接改源数据）
            const cellKey = `${row}_${col}`;
            const loadedMeta: any = { ...(cell as any).fieldMeta };
            // 只读模板（显示/监控/打印）→ 强制 fieldAttr=1，对应 ecology resumeSheetData:808 + getCellFieldImage:3745
            if (isReadOnlyTemplate) {
              loadedMeta.fieldAttr = 1;
            }
            cellFieldMetaMap.current[cellKey] = loadedMeta;
            // 设置单元格值（按覆盖后的属性上色，确保 loadLayoutData 重载时样式一致，避免"切不回去"）
            setCellField(workbook, sheet, row, col, loadedMeta as FieldMeta);
          } else if ((cell as any).v !== undefined && (cell as any).v !== null) {
            // Facade API: FWorksheet.getRange(row, col) 返回 FRange
            const range = sheet.getRange(row, col);
            range.setValue((cell as any).v);
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
      const sheet = fWorkbook.getActiveSheet(); // FWorksheet

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
          try {
            const range = sheet.getRange(row, col);
            value = range.getValue();
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
                // 字段占位符被破坏：元数据已过期，清除并跳过该单元格
                console.log(`[Save] 单元格 (${row}, ${col}) 值不匹配，跳过: 实际值="${value}", 期望值="${getCellDisplayValue(fieldMeta)}"`);
                const cellKey = `${row}_${col}`;
                delete cellFieldMetaMap.current[cellKey];
                continue;
              }
            }
          }

          hasData = true;
          rowHasData = true;

          if (!cellData[row]) cellData[row] = {};

          cellData[row][col] = {
            v: value,
            fieldMeta: fieldMeta || undefined,
          };

          // 同时构建 SpreadJS 兼容数据表
          if (!dataTable[row]) dataTable[row] = [];
          dataTable[row][col] = value;
        }
      }

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
      console.error('保存布局数据失败:', error);
      return null;
    }
  }, [workbook, sheetName, formId, onLayoutChange, getCellFieldMeta]);

  // ──────────────────────────────────────
  // 辅助函数：将后端 fieldHtmlType/fieldType 映射为 FIELD_TYPE_META 的 key
  // ──────────────────────────────────────
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

      // ── 唯一性校验：同一个字段（按 字段ID + 标签/字段 区分）只能拖入一次 ──
      // 依据 cellFieldMetaMap 动态计算已放置的字段，因此：
      // - 清空单元格（移除字段）后自动释放，可再次拖入
      // - 刷新页面/加载布局后自动保持正确，无需额外持久化
      const dropFieldId = String(actualField.id || actualField.fieldId || '');
      const dropType = isLabel ? 'label' : 'field';
      const alreadyPlaced = Object.values(cellFieldMetaMap.current).some(
        (meta: any) => `${String(meta?.fieldId ?? '')}_${meta?.cellType}` === `${dropFieldId}_${dropType}`
      );
      if (alreadyPlaced) {
        console.log(`[handleFieldDrop] 字段已拖入，拒绝重复放置: ${dropFieldId}_${dropType}`);
        message.warning('该字段已拖入表格，不能重复拖动；如需调整请先清空原单元格');
        return;
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
            if (command?.id !== 'sheet.mutation.set-range-values') return;

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

                // 清空 = 移除（标签和字段都允许通过清空移除）
                if (newValue === null || newValue === undefined || newValue === '') {
                  console.log(`[CellChange] 单元格 (${row}, ${col}) 内容已删除，清除字段元数据`);
                  delete cellFieldMetaMap.current[cellKey];
                  // 同步布局，确保面板 usedFieldKeys 刷新（可重新拖入该字段）
                  try { saveLayoutData(); } catch (e) { console.warn('[CellChange] 同步布局失败:', e); }
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

            // 单元格被清空 = 移除（标签和字段都允许通过清空移除）
            if (current === null || current === undefined || current === '') {
              delete cellFieldMetaMap.current[key];
              // 同步布局，确保面板 usedFieldKeys 刷新（可重新拖入该字段）
              try { saveLayoutData(); } catch (e) { console.warn('[Guard] 同步布局失败:', e); }
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
        if (layoutData) {
          // 支持两种格式：
          // 1. 直接包含 cellData 的格式
          // 2. Univer 完整格式：{sheets: {sheet1: {cellData: {...}}}}
          let sheetData = layoutData;

          // 尝试按 sheetName 查找（处理大小写不匹配问题）
          if (layoutData.sheets) {
            // 优先精确匹配
            sheetData = layoutData.sheets[sheetName];
            // 如果没找到，尝试小写匹配
            if (!sheetData) {
              sheetData = layoutData.sheets[sheetName.toLowerCase()];
            }
            // 如果还没找到，尝试第一个 sheet
            if (!sheetData && layoutData.sheetOrder && layoutData.sheetOrder.length > 0) {
              sheetData = layoutData.sheets[layoutData.sheetOrder[0]];
            }
          }

          if (sheetData) {
            setTimeout(() => {
              loadLayoutData(sheetData, layoutType);
            }, 300);
          } else {
            console.log('[Layout] 未找到对应 Sheet 的数据:', { sheetName, availableSheets: layoutData.sheets ? Object.keys(layoutData.sheets) : null });
          }
        }

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
        const sheet = workbook.getActiveSheet();
        const range = sheet.getRange(row, col);
        range.setValue('');
        // 清除锁定样式，避免删除字段后残留灰底
        try {
          range.setBackgroundColor?.('#ffffff');
          range.setFontColor?.('#000000');
        } catch (e) {
          console.warn('清除单元格样式失败:', e);
        }
        const cellKey = `${row}_${col}`;
        delete cellFieldMetaMap.current[cellKey];
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
  }, [workbook, saveLayoutData, loadLayoutData, handleFieldDrop, getCellFieldMeta]);

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

    console.log('[Layout] layoutData 变化，重新加载', { sheetName, hasCellData: !!(layoutData.sheets || layoutData.cellData) });

    // 支持两种格式：
    // 1. 直接包含 cellData 的格式
    // 2. Univer 完整格式：{sheets: {sheet1: {cellData: {...}}}}
    let sheetData = layoutData;

    // 尝试按 sheetName 查找（处理大小写不匹配问题）
    if (layoutData.sheets) {
      // 优先精确匹配
      sheetData = layoutData.sheets[sheetName];
      // 如果没找到，尝试小写匹配
      if (!sheetData) {
        sheetData = layoutData.sheets[sheetName.toLowerCase()];
      }
      // 如果还没找到，尝试第一个 sheet
      if (!sheetData && layoutData.sheetOrder && layoutData.sheetOrder.length > 0) {
        sheetData = layoutData.sheets[layoutData.sheetOrder[0]];
      }
    }

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
      const direct = cellFieldMetaMap.current[`${r}_${c}`];
      if (direct) return { key: `${r}_${c}`, meta: direct };
      const neighbors = [[r, c - 1], [r, c + 1], [r - 1, c], [r + 1, c]];
      for (const [nr, nc] of neighbors) {
        if (nr < 0 || nc < 0) continue;
        const m = cellFieldMetaMap.current[`${nr}_${nc}`];
        if (m) return { key: `${nr}_${nc}`, meta: m };
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
          console.warn('[FieldAttrEvent] 选中单元格没有字段元数据:', { row, col });
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
