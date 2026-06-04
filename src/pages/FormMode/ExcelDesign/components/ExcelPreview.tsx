import React, { useMemo } from 'react';
import { Modal, Button, Space, Typography, Table, Input, Select, DatePicker, Checkbox, Radio, InputNumber } from 'antd';
import {
  PrinterOutlined,
  DownloadOutlined,
  CloseOutlined,
  FileTextOutlined,
  PaperClipOutlined,
} from '@ant-design/icons';

const { Text } = Typography;
const { TextArea } = Input;

// ──────────────────────────────────────────────
// 类型定义 - 与 UniverExcelGrid 保持一致
// ──────────────────────────────────────────────

interface FieldMeta {
  fieldId?: string | number;
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  required: boolean;
  readonly: boolean;
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
}

interface WorkbookLayoutData {
  id: string;
  name?: string;
  sheetOrder: string[];
  sheets: Record<string, SheetLayoutData>;
  version: string;
}

// ──────────────────────────────────────────────
// 单元格渲染：根据 fieldMeta 返回对应的 Ant Design 组件
// ──────────────────────────────────────────────

const FieldCell: React.FC<{
  cell: CellDataItem;
  row: number;
  col: number;
}> = ({ cell, row, col }) => {
  const meta = cell.fieldMeta;
  const displayValue = cell.v !== null && cell.v !== undefined ? String(cell.v) : '';

  // 纯文本/无字段元数据 → 直接显示文字
  if (!meta) {
    return <span style={{ color: '#333' }}>{displayValue || '\u00A0'}</span>;
  }

  const commonProps = {
    disabled: true,          // 预览模式全部禁用
    size: 'small' as const,
    style: { width: '100%' },
  };

  // 必填标记
  const reqLabel = meta.required ? (
    <Text type="danger" style={{ marginRight: 2 }}>*</Text>
  ) : null;

  switch (meta.fieldType) {
    case 'text':
      return (
        <Space size={0}>
          {reqLabel}
          <Input {...commonProps} placeholder={meta.placeholder || ''} maxLength={meta.length || 200} defaultValue={displayValue} />
        </Space>
      );

    case 'textarea':
      return (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          {reqLabel}
          <TextArea {...commonProps} rows={3} placeholder={meta.placeholder || ''} defaultValue={displayValue} />
        </Space>
      );

    case 'number':
      return (
        <Space size={0}>
          {reqLabel}
          <InputNumber {...commonProps} step="any" defaultValue={parseFloat(displayValue) || undefined} />
        </Space>
      );

    case 'wholeNumber':
      return (
        <Space size={0}>
          {reqLabel}
          <InputNumber {...commonProps} step={1} defaultValue={parseInt(displayValue, 10) || undefined} />
        </Space>
      );

    case 'date':
      return (
        <Space size={0}>
          {reqLabel}
          <DatePicker {...commonProps} style={{ width: '100%' }} format="YYYY-MM-DD" />
        </Space>
      );

    case 'datetime':
      return (
        <Space size={0}>
          {reqLabel}
          <DatePicker {...commonProps} showTime format="YYYY-MM-DD HH:mm:ss" />
        </Space>
      );

    case 'select':
      return (
        <Space size={0}>
          {reqLabel}
          <Select {...commonProps} placeholder="请选择" options={[
            ...(meta.options || []).map(o => ({ label: o.label, value: o.value })),
          ]} defaultValue={undefined} />
        </Space>
      );

    case 'radio':
      return (
        <Space size={0}>
          {reqLabel}
          <Radio.Group disabled options={(meta.options || []).map(o => ({
            label: o.label,
            value: o.value,
          }))} defaultValue={meta.options?.[0]?.value} />
        </Space>
      );

    case 'checkbox':
      return <Checkbox disabled defaultChecked={!!cell.v}>同意</Checkbox>;

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
      return <span>{displayValue}</span>;
  }
};

// ──────────────────────────────────────────────
// Sheet 预览表格组件
// ──────────────────────────────────────────────

const SheetPreviewTable: React.FC<{ sheet: SheetLayoutData }> = ({ sheet }) => {
  const tableData = useMemo(() => {
    const cellData = sheet.cellData || {};
    const rows: any[] = [];
    let maxCol = 0;

    // 收集所有单元格
    Object.entries(cellData).forEach(([rowKey, rowData]) => {
      const row = parseInt(rowKey, 10);
      if (isNaN(row)) return;

      const rowRecord: any = { _rowKey: row };
      let hasData = false;

      Object.entries(rowData || {}).forEach(([colKey, cell]) => {
        const col = parseInt(colKey, 10);
        if (isNaN(col)) return;
        maxCol = Math.max(maxCol, col);

        if (cell.v !== null && cell.v !== undefined && cell.v !== '') {
          hasData = true;
          rowRecord[`col_${col}`] = cell;
          rowRecord[`_col_${col}_meta`] = cell.fieldMeta;
        }
      });

      if (hasData) rows.push(rowRecord);
    });

    // 按 row 排序
    rows.sort((a, b) => a._rowKey - b._rowKey);

    // 构建列定义（只生成有数据的列）
    const columns: any[] = [];
    for (let c = 0; c <= maxCol; c++) {
      columns.push({
        title: String.fromCharCode(65 + c),
        dataIndex: `col_${c}`,
        key: `col_${c}`,
        width: c === 0 ? 120 : 160,
        render: (_: any, record: any) => {
          const cell = record[`col_${c}`];
          if (!cell) return <span style={{ color: '#ccc' }}>-</span>;
          return <FieldCell cell={cell} row={record._rowKey} col={c} />;
        },
      });
    }

    return { rows, columns };
  }, [sheet]);

  if (tableData.rows.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Text type="secondary">工作表 "{sheet.name}" 暂无数据</Text>
      </div>
    );
  }

  return (
    <Table
      dataSource={tableData.rows}
      columns={tableData.columns}
      pagination={false}
      bordered
      size="small"
      rowKey="_rowKey"
      title={() => (
        <Text strong style={{ color: '#1890ff', fontSize: 14 }}>
          <FileTextOutlined style={{ marginRight: 6 }} />
          {sheet.name}
        </Text>
      )}
      scroll={{ x: Math.max(tableData.columns.length * 140, 600) }}
    />
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
}

/**
 * Excel 设计器 - React 预览组件
 *
 * 使用 Ant Design 原生组件（Input、Select、DatePicker 等）直接渲染布局数据，
 * 不生成 HTML 字符串，保持与设计器一致的 React 技术栈。
 *
 * 对应 Ecology excelPreView.jsp 的功能：
 *   - 将设计好的模板以表单形式展示
 *   - 所有控件为只读状态
 *   - 支持打印和导出
 */
const ExcelPreview: React.FC<ExcelPreviewProps> = ({
  layoutData,
  open,
  onClose,
  title = '表单预览',
}) => {
  // 解析出所有 sheet 列表
  const sheets = useMemo(() => {
    if (!layoutData?.sheets) return [];
    const order = layoutData.sheetOrder || Object.keys(layoutData.sheets);
    return order.map(id => layoutData.sheets![id]).filter(Boolean);
  }, [layoutData]);

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

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      width={1000}
      footer={[
        <Space key="actions">
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>
            打印
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleDownload}>
            导出JSON
          </Button>
          <Button icon={<CloseOutlined />} onClick={onClose}>
            关闭
          </Button>
        </Space>,
      ]}
      destroyOnHidden
      styles={{
        body: {
          padding: '16px 24px',
          height: 'calc(100vh - 130px)',
          overflow: 'auto',
          background: '#f5f5f5',
        },
      }}
    >
      {!layoutData ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <FileTextOutlined style={{ fontSize: 48, color: '#ccc', marginBottom: 16 }} />
          <div>
            <Text type="secondary">暂无布局数据，请先在设计器中编辑并保存</Text>
          </div>
        </div>
      ) : sheets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Text type="warning">布局数据中没有工作表</Text>
        </div>
      ) : (
        <div className="excel-preview-react-container">
          {sheets.map((sheet, idx) => (
            <div key={sheet.id || idx} style={{ marginBottom: idx < sheets.length - 1 ? 24 : 0 }}>
              <SheetPreviewTable sheet={sheet} />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

export default ExcelPreview;
