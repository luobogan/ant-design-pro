import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Modal, Button, Space, Typography, Table, Input, Select, DatePicker, Checkbox, Radio, InputNumber, message } from 'antd';
import {
  PrinterOutlined,
  DownloadOutlined,
  CloseOutlined,
  FileTextOutlined,
  PaperClipOutlined,
  SendOutlined,
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
}> = ({ cell, sheetId, row, col, value, onChange, error, readOnly }) => {
  const meta = cell.fieldMeta;
  const rawValue = cell.v !== null && cell.v !== undefined ? String(cell.v) : '';
  // 字段单元格在设计器中存的是模板占位符（如 "📝 ${xm}"），表示尚未填入真实数据。
  // 预览时应按空值处理，避免把占位符当成输入框的默认值。
  const cleanRaw = rawValue.replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, '').trim();
  const displayValue = /^\$\{[^}]+\}$/.test(cleanRaw) ? '' : rawValue;

  // 纯文本/无字段元数据 → 直接显示文字
  if (!meta) {
    return <span style={{ color: '#333' }}>{displayValue || '\u00A0'}</span>;
  }

  // 标签单元格 → 静态说明文本，不渲染输入控件（与数据绑定字段区分）
  if (meta.cellType === 'label') {
    return (
      <span style={{ color: '#333', fontWeight: 500 }}>
        {meta.fieldLabel || displayValue || '\u00A0'}
      </span>
    );
  }

  // 字段属性以 fieldAttr 为权威（参照 ecology：1=只读 2=可编辑 3=必填），兼容旧 readonly/required 布尔
  const fieldAttr = meta?.fieldAttr;
  // 预览态（readOnly）整体只读：对应 ecology 显示/监控/打印布局（layouttype 0/3/4）强制只读
  const disabled = !!readOnly || fieldAttr === 1 || meta?.readonly === true;
  const isRequired = fieldAttr === 3 || meta?.required === true;
  // 必填标记
  const reqLabel = isRequired ? (
    <Text type="danger" style={{ marginRight: 2 }}>*</Text>
  ) : null;
  // 必填校验未通过 → 红色边框
  const status = error ? 'error' : '';

  const errTip = error ? (
    <div style={{ color: '#ff4d4f', fontSize: 12, lineHeight: '18px' }}>该项为必填</div>
  ) : null;

  const commonProps = {
    disabled,
    size: 'small' as const,
    status,
    style: { width: '100%' },
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
        return <span>{displayValue}</span>;
    }
  })();

  return (
    <div>
      <Space size={0}>
        {reqLabel}
        {body}
      </Space>
      {errTip}
    </div>
  );
};

// ──────────────────────────────────────────────
// Sheet 预览表格组件
// ──────────────────────────────────────────────

const SheetPreviewTable: React.FC<{
  sheet: SheetLayoutData;
  formValues: Record<string, any>;
  errors: Record<string, boolean>;
  onFieldChange: (key: string, v: any) => void;
  readOnly?: boolean;
}> = ({ sheet, formValues, errors, onFieldChange, readOnly }) => {
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
        width: c === 0 ? 120 : 200,
        render: (_: any, record: any) => {
          const cell = record[`col_${c}`];
          if (!cell) return <span style={{ color: '#ccc' }}>-</span>;
          const key = cellKey(sheet.id, record._rowKey, c);
          return (
            <FieldCell
              cell={cell}
              row={record._rowKey}
              col={c}
              sheetId={sheet.id}
              value={formValues[key]}
              onChange={(v) => onFieldChange(key, v)}
              error={errors[key]}
              readOnly={readOnly}
            />
          );
        },
      });
    }

    return { rows, columns };
  }, [sheet, formValues, errors, onFieldChange]);

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
      scroll={{ x: Math.max(tableData.columns.length * 160, 600) }}
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
  /** 预览态只读：true 时所有字段控件禁用，对应 ecology 显示/监控/打印布局（layouttype 0/3/4） */
  readOnly?: boolean;
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
}) => {
  // 解析出所有 sheet 列表
  const sheets = useMemo(() => {
    if (!layoutData?.sheets) return [];
    const order = layoutData.sheetOrder || Object.keys(layoutData.sheets);
    return order.map((id) => layoutData.sheets![id]).filter(Boolean);
  }, [layoutData]);

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

  // 提交校验：遍历所有必填字段，未填写则标记错误
  const handleSubmit = () => {
    const newErrors: Record<string, boolean> = {};
    sheets.forEach((sheet) => {
      const cellData = sheet.cellData || {};
      Object.entries(cellData).forEach(([rk, rowData]) => {
        const r = parseInt(rk, 10);
        Object.entries(rowData || {}).forEach(([ck, cell]) => {
          const c = parseInt(ck, 10);
          const meta = (cell as CellDataItem).fieldMeta;
          if (!meta || meta.cellType !== 'field' || !(meta.fieldAttr === 3 || meta.required)) return;
          const key = cellKey(sheet.id, r, c);
          const v = formValues[key];
          if (isEmptyValue(meta.fieldType, v)) {
            newErrors[key] = true;
          }
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

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      width={1000}
      footer={[
        <Space key="actions">
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
              <SheetPreviewTable
                sheet={sheet}
                formValues={formValues}
                errors={errors}
                onFieldChange={handleFieldChange}
                readOnly={readOnly}
              />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

export default ExcelPreview;
