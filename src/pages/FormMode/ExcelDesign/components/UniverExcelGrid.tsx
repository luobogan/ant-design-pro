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

// 导入语言包
import DesignZhCN from '@univerjs/design/locale/zh-CN';
import UIZhCN from '@univerjs/ui/locale/zh-CN';
import DocsUIZhCN from '@univerjs/docs-ui/locale/zh-CN';
import SheetsZhCN from '@univerjs/sheets/locale/zh-CN';
import SheetsUIZhCN from '@univerjs/sheets-ui/locale/zh-CN';
import SheetsFormulaUIZhCN from '@univerjs/sheets-formula-ui/locale/zh-CN';
import SheetsNumfmtUIZhCN from '@univerjs/sheets-numfmt-ui/lib/es/locale/zh-CN';
import SheetsDataValidationZhCN from '@univerjs/sheets-data-validation/locale/zh-CN';

// 导入样式（注意顺序：design -> ui -> 其他）
import '@univerjs/design/lib/index.css';
import '@univerjs/ui/lib/index.css';
import '@univerjs/docs-ui/lib/index.css';
import '@univerjs/sheets-ui/lib/index.css';
import '@univerjs/sheets-formula-ui/lib/index.css';
import '@univerjs/sheets-numfmt-ui/lib/index.css';

// ──────────────────────────────────────────────
// 字段类型常量 - 与 FieldPalette 保持一致
// 参照迁移文档 §6.2 数据验证类型映射
// ──────────────────────────────────────────────
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
}

const UniverExcelGrid: React.FC<UniverExcelGridProps> = ({
  sheetName,
  layoutData,
  onLayoutChange,
  formId,
  pendingField,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const univerRef = useRef<Univer | null>(null);
  const workbookRef = useRef<any>(null);
  const [workbook, setWorkbook] = useState<any>(null);
  const [initialized, setInitialized] = useState<boolean>(false);
  const [initError, setInitError] = useState<string>('');
  const sheetRef = useRef<any>(null);
  const { message } = App.useApp();

  // ──────────────────────────────────────────────
  // 拖放处理
  // ──────────────────────────────────────────────
  const [{ isOver }, dropRef] = useDrop(() => ({
    accept: 'FIELD',
    drop: (item: any, monitor) => {
      if (monitor.didDrop()) return;
      // 使用 workbookRef.current 检查（同步），而不是 workbook 状态（异步）
      if (!workbookRef.current) {
        message.warning('Excel 表格尚未初始化完成，请稍后再试');
        return;
      }
      message.info(`字段 "${item.label || item.type}" 已拖放到 ${sheetName}`);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
    }),
  }), [workbookRef.current]);

  // ──────────────────────────────────────────────
  // 字段类型 → 数据验证规则映射
  // 参照迁移文档 §6.2 验证类型映射表
  // ──────────────────────────────────────────────
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

  // ──────────────────────────────────────────────
  // 字段类型 → 单元格样式映射
  // 参照迁移文档 §8 样式系统迁移
  // ──────────────────────────────────────────────
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

  // ──────────────────────────────────────────────
  // 设置数据验证
  // 参照迁移文档 §6.1 数据验证迁移代码
  // ──────────────────────────────────────────────
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

  // ──────────────────────────────────────────────
  // 设置单元格字段元数据 + 样式 + 验证
  // ──────────────────────────────────────────────
  const setCellField = useCallback((
    sheet: any,
    row: number,
    col: number,
    fieldMeta: FieldMeta,
  ) => {
    try {
      const range = sheet.getRange(row, col, 1, 1);

      // 1. 设置显示值（优先使用字段标签，否则使用默认值）
      const displayValue = fieldMeta.defaultValue || fieldMeta.fieldLabel || fieldMeta.fieldName;
      range.setValue(displayValue);

      // 2. 附加字段元数据（JSON 字符串存为 note）
      const metaStr = JSON.stringify({
        ...fieldMeta,
        __version: '1.0',
        __timestamp: Date.now(),
      });
      range.setNote(metaStr);

      // 3. 设置单元格样式
      const style = buildCellStyle(fieldMeta);
      if (Object.keys(style).length > 0) {
        range.setStyle(style);
      }

      // 4. 设置数据验证规则
      const rule = buildValidationRule(fieldMeta);
      if (rule) {
        setDataValidation(sheet, row, col, rule);
      }

      return true;
    } catch (e) {
      console.error('设置单元格字段失败:', e);
      return false;
    }
  }, [buildCellStyle, buildValidationRule, setDataValidation]);

  // ──────────────────────────────────────────────
  // 解析单元格中的字段元数据
  // ──────────────────────────────────────────────
  const getCellFieldMeta = useCallback((sheet: any, row: number, col: number): FieldMeta | null => {
    try {
      const range = sheet.getRange(row, col, 1, 1);
      const note = range.getNote();
      if (note) {
        const parsed = JSON.parse(note);
        if (parsed && parsed.__version) return parsed as FieldMeta;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // ──────────────────────────────────────────────
  // 加载布局数据（支持双格式解析）
  // 参照迁移文档 §9.1 - Univer JSON 格式 + §9.2 - SpreadJS 兼容格式
  // ──────────────────────────────────────────────
  const loadLayoutData = useCallback((data: any) => {
    if (!workbook) return;

    try {
      const sheet = workbook.getActiveSheet();

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
          if (cell.fieldMeta) {
            setCellField(sheet, row, col, cell.fieldMeta as FieldMeta);
          } else if (cell.v !== undefined && cell.v !== null) {
            const range = sheet.getRange(row, col, 1, 1);
            range.setValue(cell.v);
            if (cell.tag) {
              range.setNote(cell.tag);
            }
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
              const range = sheet.getRange(row, col, 1, 1);
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

  // ──────────────────────────────────────────────
  // 保存布局数据（Univer JSON 格式 + SpreadJS 兼容格式）
  // 参照迁移文档 §9.1 - Univer JSON 格式 + §9.2 转换工具
  // ──────────────────────────────────────────────
  const saveLayoutData = useCallback(() => {
    if (!workbook) return null;

    try {
      const sheet = workbook.getActiveSheet();
      const maxRow = Math.min(sheet.getRowCount(), 50);
      const maxCol = Math.min(sheet.getColumnCount(), 26);
      const cellData: Record<string, Record<string, CellDataItem>> = {};
      const dataTable: any[][] = [];
      let hasData = false;

      for (let row = 0; row < maxRow; row++) {
        let rowHasData = false;
        for (let col = 0; col < maxCol; col++) {
          const range = sheet.getRange(row, col, 1, 1);
          const value = range.getValue();
          const note = range.getNote();

          if (value === null || value === undefined || value === '') continue;
          hasData = true;
          rowHasData = true;

          if (!cellData[row]) cellData[row] = {};

          let fieldMeta: FieldMeta | null = null;
          if (note) {
            try {
              const parsed = JSON.parse(note);
              if (parsed.__version || parsed.fieldType) {
                fieldMeta = parsed as FieldMeta;
              }
            } catch { /* ignore parse error */ }
          }

          cellData[row][col] = {
            v: value,
            fieldMeta: fieldMeta || undefined,
            tag: fieldMeta ? note : undefined,
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
  }, [workbook, sheetName, formId, onLayoutChange]);

  // ──────────────────────────────────────────────
  // 将字段放置到指定单元格
  // ──────────────────────────────────────────────
  const handleFieldDrop = useCallback((field: any, row: number, col: number) => {
    if (!workbook) return;

    try {
      const sheet = workbook.getActiveSheet();
      sheetRef.current = sheet;

      // 构造完整的字段元数据
      const fieldMeta: FieldMeta = {
        fieldId: field.id || field.fieldId || field.type,
        fieldName: field.fieldName || field.type,
        fieldLabel: field.label || field.fieldLabel || field.type,
        fieldType: field.type as FieldType,
        required: field.required || false,
        readonly: field.readonly || false,
        defaultValue: field.defaultValue || '',
        placeholder: field.placeholder || '',
        length: field.length || (FIELD_TYPE_META[field.type as FieldType] as any)?.maxLength,
        tooltip: field.tooltip || '',
        options: field.options || [],
      };

      // 写入字段元数据到单元格
      setCellField(sheet, row, col, fieldMeta);

      message.success(
        `字段 "${fieldMeta.fieldLabel}" 已放置到单元格 (${row + 1}, ${String.fromCharCode(65 + col)})`
      );

      // 自动触发保存（saveLayoutData 已定义在上方，确保可访问）
      const data = saveLayoutData();
      if (data) {
        onLayoutChange(data);
      }
    } catch (error) {
      console.error('放置字段失败:', error);
      message.error('放置字段失败');
    }
  }, [workbook, setCellField, saveLayoutData, onLayoutChange]);

  // ──────────────────────────────────────────────
  // 初始化 Univer
  // 参照迁移文档 §4.1 工作簿初始化对比
  // 使用递归 RAF 等待 containerRef.current 就绪，避免 ref 未绑定就初始化
  // ──────────────────────────────────────────────
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

        // Step 14: 创建工作簿
        console.log('[Univer Init] Step 14: 创建 sheet 工作簿...');
        let workbookInstance: any;
        try {
          workbookInstance = univer.createUnit(UniverInstanceType.UNIVER_SHEET, {
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
          console.log('[Univer Init] Step 14 OK: 工作簿创建成功');
        } catch (e) {
          console.error('[Univer Init] Step 14 失败: createUnit 抛出异常:', e);
          throw e;
        }

        workbookRef.current = workbookInstance;
        setWorkbook(workbookInstance);
        univerRef.current = univer;
        setInitialized(true);
        setInitError('');

        // 获取活动工作表
        const sheet = workbookInstance.getActiveSheet();
        sheetRef.current = sheet;

        // 参照迁移文档 §7.2 事件绑定
        // 添加值变化事件
        const valueChangeDisposer = workbookInstance.onCellValueChange?.(
          (cell: any, oldValue: any, newValue: any) => {
            console.log(`[§7 Event] 单元格值变化: (${cell?.row}, ${cell?.col}) ${oldValue} → ${newValue}`);
          }
        );

        // 添加选区变化事件
        const selectionDisposer = workbookInstance.onSelectionChange?.(
          (selection: any) => {
            if (!selection) return;
            // 检查是否有待放置的字段
            const pending = (window as any).__pendingField || pendingField;
            if (pending) {
              // 自动放置字段到当前选中单元格
              console.log(`[§7 Event] 选区变化:`, selection, `待放置字段:`, pending?.label);
            }
          }
        );

        // 加载布局数据
        if (layoutData && layoutData[sheetName]) {
          setTimeout(() => {
            loadLayoutData(layoutData[sheetName]);
          }, 300);
        }

        // 保存清理函数引用，在 useEffect cleanup 时使用
        (attemptInit as any).cleanup = () => {
          if (valueChangeDisposer) valueChangeDisposer();
          if (selectionDisposer) selectionDisposer();
          if (univerRef.current) {
            try { univerRef.current.dispose(); } catch (e) { console.error('清理失败:', e); }
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
  // 暴露接口给父组件（通过 window 桥接）
  // ──────────────────────────────────────────────
  useEffect(() => {
    if (workbook) {
      (window as any).univerExcelGrid = {
        saveLayoutData,
        loadLayoutData,
        handleFieldDrop,
        getWorkbook: () => workbook,
        getActiveSheet: () => workbook.getActiveSheet(),
        getWorkbookId: () => workbookRef.current?.getUnitId?.(),
      };
    }
  }, [workbook, saveLayoutData, loadLayoutData, handleFieldDrop]);

  // ──────────────────────────────────────────────
  // 渲染
  // 注意：containerRef 的 div 必须始终渲染，否则 ref 回调永远不会触发，
  // 导致递归 RAF 永远等不到 containerRef.current，一直卡在"加载中"。
  // 加载/错误状态用遮罩层叠加显示，不替换 container div。
  // ──────────────────────────────────────────────
  return (
    <Card
      title={
        <span style={{ fontSize: 13 }}>
          📋 工作表: {sheetName}
          {pendingField && (
            <span style={{ marginLeft: 12, color: '#1890ff', fontSize: 12 }}>
              待放置: {pendingField.label || pendingField.type}
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
        }}
      />
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
