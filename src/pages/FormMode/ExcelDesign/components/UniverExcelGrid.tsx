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
  required: boolean;
  readonly: boolean;
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
}

const UniverExcelGrid: React.FC<UniverExcelGridProps> = ({
  sheetName,
  layoutData,
  onLayoutChange,
  formId,
  pendingField,
  hoveredField,
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

  // 标记是否正在放置字段（避免放置后立即触发重新加载）
  const isPlacingFieldRef = useRef(false);

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
      const iconMap: Record<string, string> = {
        text: '📝',      // 单行文本
        textarea: '',  // 多行文本
        number: '🔢',    // 数字
        wholeNumber: '🔢', // 整数
        date: '📅',      // 日期
        datetime: '',  // 日期时间
        select: '🔽',    // 下拉框
        checkbox: '☑️',   // 复选框
        radio: '',     // 单选框
        attachment: '📎', // 附件
        richtext: '📝',  // 富文本
        group: '📦',     // 分组框
        custom: '⚙️',    // 自定义
      };
      const fieldIcon = iconMap[fieldMeta.fieldType] || '📝';
      const displayValue = `${fieldIcon} ${fieldMeta.fieldLabel || fieldMeta.fieldName || fieldMeta.defaultValue}`;
      range.setValue(displayValue);

      // 2. 存储字段元数据到内存 Map（FRange 没有 setNote 方法）
      const cellKey = `${row}_${col}`;
      const metaWithVersion = {
        ...fieldMeta,
        __version: '1.0' as const,
        __timestamp: Date.now(),
      };
      cellFieldMetaMap.current[cellKey] = metaWithVersion as any;

      // 3. 设置单元格样式（临时禁用，等待确认正确 API）
      // TODO: 确认 Univer FRange 的正确样式设置方法
      // const style = buildCellStyle(fieldMeta);
      // if (Object.keys(style).length > 0) {
      //   range.setStyle(style);
      // }

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
  const loadLayoutData = useCallback((data: any) => {
    if (!workbook) return;

    try {
      // 关键修复：加载新数据前先清空旧的元数据，避免删除的单元格数据残留
      console.log('[LoadLayout] 清空旧的单元格元数据');
      cellFieldMetaMap.current = {};

      // workbook 是 FWorkbook (Facade)
      const fWorkbook: any = workbook;
      const sheet = fWorkbook.getActiveSheet(); // 返回 FWorksheet

      // 关键修复：清空表格中所有单元格的内容（遍历固定范围）
      console.log('[LoadLayout] 清空表格所有单元格内容');
      for (let row = 0; row < 50; row++) {
        for (let col = 0; col < 26; col++) {
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
            // 存储到内存 Map
            const cellKey = `${row}_${col}`;
            cellFieldMetaMap.current[cellKey] = (cell as any).fieldMeta;
            // 设置单元格值
            setCellField(workbook, sheet, row, col, (cell as any).fieldMeta as FieldMeta);
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
    }
  }, [workbook, setCellField]);

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

      // 临时方案：使用固定范围（等待确认获取行列数的正确 API）
      // TODO: 确认 Univer FWorksheet 获取行列数的正确方法
      const maxRow = 50;
      const maxCol = 26;

      const cellData: Record<string, Record<string, CellDataItem>> = {};
      const dataTable: any[][] = [];
      let hasData = false;

      for (let row = 0; row < maxRow; row++) {
        let rowHasData = false;
        for (let col = 0; col < maxCol; col++) {
          // Facade API: FWorksheet.getRange(row, col) 返回 FRange
          const range = sheet.getRange(row, col);
          const value = range.getValue();

          // 跳过空值单元格
          if (value === null || value === undefined || value === '') continue;

          // 获取字段元数据（从内存 Map）
          const fieldMeta = getCellFieldMeta(row, col);

          // 关键验证：如果有元数据，检查元数据中的值是否与单元格值匹配
          // 注意：单元格值可能带有图标前缀，需要去除图标后再比较
          if (fieldMeta) {
            const metaValue = fieldMeta.fieldLabel || fieldMeta.fieldName || fieldMeta.defaultValue || '';
            // 去除单元格值中的图标前缀（图标通常是 emoji，占 1-2 个字符）
            const cellValueStr = String(value);
            const cleanCellValue = cellValueStr.replace(/^[\u{1F300}-\u{1F9FF}]\s*/u, '').trim();
            if (cleanCellValue !== String(metaValue) && cellValueStr !== String(metaValue)) {
              console.log(`[Save] 单元格 (${row}, ${col}) 值不匹配，跳过: 实际值="${value}", 元数据值="${metaValue}"`);
              // 值不匹配，说明元数据已过期，清除它
              const cellKey = `${row}_${col}`;
              delete cellFieldMetaMap.current[cellKey];
              continue;
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
        console.log('没有数据需要保存');
        return null;
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

      // 解析正确的 fieldType（后端字段需要映射，静态字段直接使用 type）
      const resolvedType: FieldType =
        actualField.type === 'formField' || actualField.fieldHtmlType
          ? mapToFieldType(actualField)
          : (actualField.type as FieldType);

      // 构造完整的字段元数据
      const fieldMeta: FieldMeta = {
        fieldId: String(actualField.id || actualField.fieldId || ''),
        fieldName: actualField.fieldName || '',
        fieldLabel: actualField.fieldLabel || actualField.label || '',
        fieldType: resolvedType,
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
  // 策略：使用 FWorksheet.getColumnWidth() / getRowHeight() 从 Facade API
  // 获取实际列宽/行高进行计算，无需硬编码
  // ──────────────────────────────────────
  const getCellFromMouseEvent = useCallback((clientX: number, clientY: number): { row: number; col: number } => {
    console.log('[getCellFromMouseEvent] 开始执行', { clientX, clientY });

    // 优先使用 Facade API 的 hitTest 方法（最精准）
    const fWorkbook: any = workbook;
    const sheet = fWorkbook?.getActiveSheet?.();

    console.log('[getCellFromMouseEvent] sheet 检查:', {
      hasSheet: !!sheet,
      hasHitTest: typeof sheet?.hitTest === 'function',
      sheetType: typeof sheet
    });

    if (sheet && typeof sheet.hitTest === 'function') {
      try {
        const result = sheet.hitTest(clientX, clientY);
        if (result && typeof result.row === 'number' && typeof result.column === 'number') {
          console.log('[getCellFromMouseEvent] hitTest 成功:', { row: result.row, col: result.column });
          return { row: result.row, col: result.column };
        }
      } catch (e) {
        console.warn('[getCellFromMouseEvent] hitTest 失败，降级到坐标计算:', e);
      }
    }

    // 降级方案：使用坐标计算（原有逻辑）
    const DEFAULT_COL_WIDTH = 73;
    const DEFAULT_ROW_HEIGHT = 24;

    // 获取 canvas 元素位置，用于计算相对坐标
    const canvasEl = containerRef.current?.querySelector('canvas');
    const canvasRect = canvasEl?.getBoundingClientRect();

    if (!canvasRect) {
      // 无 canvas 时降级：直接用 container 位置
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { row: 0, col: 0 };
      const relativeX = clientX - rect.left;
      const relativeY = clientY - rect.top;
      const col = Math.floor(relativeX / DEFAULT_COL_WIDTH);
      const row = Math.floor(relativeY / DEFAULT_ROW_HEIGHT);
      return { row: Math.max(0, row), col: Math.max(0, col) };
    }

    // 计算鼠标在 canvas 内的相对位置
    const relX = clientX - canvasRect.left;
    const relY = clientY - canvasRect.top;

    console.log('[getCellFromMouseEvent] Canvas:', {
      left: canvasRect.left.toFixed(0), top: canvasRect.top.toFixed(0),
      width: canvasRect.width.toFixed(0), height: canvasRect.height.toFixed(0),
    });
    console.log('[getCellFromMouseEvent] 坐标:', { relX: relX.toFixed(1), relY: relY.toFixed(1) });

    // 从 Facade API 获取实际列宽遍历计算列
    let accumulatedX = 0;
    let col = 0;
    for (let c = 0; c < 100; c++) {
      let w: number;
      if (sheet && typeof sheet.getColumnWidth === 'function') {
        w = sheet.getColumnWidth(c);
      } else {
        w = DEFAULT_COL_WIDTH;
      }
      // getColumnWidth 可能返回 0 或 undefined，用默认值兜底
      if (!w || w <= 0) w = DEFAULT_COL_WIDTH;
      accumulatedX += w;
      if (relX < accumulatedX) {
        col = c;
        break;
      }
    }

    // 从 Facade API 获取实际行高遍历计算行
    let accumulatedY = 0;
    let row = 0;
    for (let r = 0; r < 200; r++) {
      let h: number;
      if (sheet && typeof sheet.getRowHeight === 'function') {
        h = sheet.getRowHeight(r);
      } else {
        h = DEFAULT_ROW_HEIGHT;
      }
      if (!h || h <= 0) h = DEFAULT_ROW_HEIGHT;
      accumulatedY += h;
      if (relY < accumulatedY) {
        row = r;
        break;
      }
    }

    console.log('[getCellFromMouseEvent] 降级计算结果:', { row, col });
    return { row: Math.max(0, row), col: Math.max(0, col) };
  }, [workbook]);

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
          valueChangeDisposer = fWorkbook.onCellValueChange?.(
            (cell: any, oldValue: any, newValue: any) => {
              const row = cell?.row;
              const col = cell?.col;
              console.log(`[CellChange] 单元格值变化: (${row}, ${col}) ${oldValue} → ${newValue}`);

              // 关键修复：如果单元格值被删除（空），清除 cellFieldMetaMap 中的元数据
              if ((newValue === null || newValue === undefined || newValue === '') &&
                  (oldValue !== null && oldValue !== undefined && oldValue !== '')) {
                const cellKey = `${row}_${col}`;
                if (cellFieldMetaMap.current[cellKey]) {
                  console.log(`[CellChange] 单元格 (${row}, ${col}) 内容已删除，清除字段元数据`);
                  delete cellFieldMetaMap.current[cellKey];
                }
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
            }
          );
        } catch (e) {
          console.warn('[Univer Init] 添加值变化事件失败:', e);
        }

        // 添加选区变化事件（使用 FWorkbook）
        // 用于检测拖拽操作完成后的选区变化
        let lastSelection: any = null;
        let selectionDisposer: (() => void) | undefined;
        try {
          selectionDisposer = fWorkbook.onSelectionChange?.(
            (selection: any) => {
              if (!selection) return;

              // 检测选区变化（拖拽后选区会变化）
              const selStr = JSON.stringify(selection);
              const lastStr = lastSelection ? JSON.stringify(lastSelection) : '';
              if (selStr !== lastStr) {
                // 检查是否有待放置的字段
                const pending = (window as any).__pendingField || pendingField;
                if (pending) {
                  console.log(`[Drag] 选区变化:`, selection, `待放置字段:`, pending?.fieldLabel || pending?.label || pending?.fieldName || '未知');
                }
                lastSelection = selection;
              }
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
              loadLayoutData(sheetData);
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
        const cellKey = `${row}_${col}`;
        const fieldMeta = cellFieldMetaMap.current[cellKey];
        if (fieldMeta) {
          // 更新字段元数据中的属性
          fieldMeta.fieldAttr = attrValue;
          fieldMeta.required = attrValue === 3;
          fieldMeta.readonly = attrValue === 1;

          // 更新单元格样式（根据属性值设置背景色）
          const sheet = workbook.getActiveSheet();
          const range = sheet.getRange(row, col);

          // 根据属性值设置不同的背景色
          if (attrValue === 1) {
            // 只读 - 灰色背景
            range.setBackground('#f5f5f5');
          } else if (attrValue === 2) {
            // 可编辑 - 白色背景
            range.setBackground('#ffffff');
          } else if (attrValue === 3) {
            // 必填 - 浅红色背景
            range.setBackground('#fff1f0');
          }

          console.log(`[setFieldAttr] 设置字段属性: row=${row}, col=${col}, attr=${attrValue}`);
        }
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
        const cellKey = `${row}_${col}`;
        delete cellFieldMetaMap.current[cellKey];
      };

      (window as any).univerExcelGrid = {
        saveLayoutData,
        loadLayoutData,
        handleFieldDrop,
        getCellFieldMeta,
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
        loadLayoutData(sheetData);
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
  // 监听 univer 右键菜单字段属性变更事件（来自 univer 核心的 field-attr.command.ts）
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleFieldAttrChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.attr === undefined) return;

      // 获取当前选中单元格
      const workbook = workbookRef.current;
      if (!workbook) return;

      try {
        const sheet = workbook.getActiveSheet();
        const selection = sheet.getSelection();
        if (!selection) return;
        const currentCell = selection.getCurrentCell();
        if (!currentCell) return;

        const row = currentCell.actualRow;
        const col = currentCell.actualColumn;
        const cellKey = `${row}_${col}`;
        const fieldMeta = cellFieldMetaMap.current[cellKey];

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
        const selection = sheet.getSelection();
        if (!selection) return;
        const currentCell = selection.getCurrentCell();
        if (!currentCell) return;
        const row = currentCell.actualRow;
        const col = currentCell.actualColumn;
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
  }, []);

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
