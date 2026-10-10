import React from 'react';
import {
  Button,
  Checkbox,
  DatePicker,
  Input,
  InputNumber,
  Radio,
  Select,
  Typography,
  Upload,
} from 'antd';
import { PaperClipOutlined, UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import BrowserControl from './BrowserControl';
import type { ControlType } from './fieldTypes';

/**
 * 字段控件唯一渲染入口
 *
 * ⚠️ 开发规范：页面层**禁止**再自行 switch 字段类型渲染控件，一律调用本组件。
 *    新增/修改字段类型只改 `fieldTypes.ts`（编码与控件映射）与本文件（控件实现），
 *    所有页面（Excel 预览、表单数据页、流程发起等）自动生效。
 *
 * 行为基准：对齐 `ExcelPreview.FieldCell`（原主运行态渲染器），保证改造不回归。
 * 页面层退化为「容器适配层」：
 *  · ExcelPreview  → 负责 <td> 布局 + Excel 单元格样式 + 节点权限
 *  · FieldRenderer → 负责 Form.Item 包裹 + 只读降级
 */
export interface FieldOption {
  value: any;
  label: string;
}

export interface FieldControlProps {
  /** 控件类型（由 mapFieldToControlType(field) 得出） */
  controlType: ControlType;
  value?: any;
  onChange?: (value: any) => void;
  /** 下拉/单选/复选的选项 */
  options?: FieldOption[];
  disabled?: boolean;
  /** 只读（预览态/打印态）：控件禁用，不做编辑交互 */
  readOnly?: boolean;
  placeholder?: string;
  /** 校验失败红框 */
  status?: '' | 'error';
  /** controlType==='browser' 时的浏览按钮类型 */
  browserType?: number;
  /** 仅 browser 有效；不传时按 isBrowserTypeMultiple 推导 */
  multiple?: boolean;
  /** 文本最大长度（默认 200） */
  maxLength?: number;
  /** textarea 行数（默认 3） */
  rows?: number;
  /** 挂到真实 input 上的 DOM id（供代码块取/设值） */
  inputId?: string;
  style?: React.CSSProperties;
}

const DATE_FMT = 'YYYY-MM-DD';
const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/** 字符串 → dayjs（非法值返回 undefined，避免 DatePicker 报 Invalid Date） */
const toDayjs = (v: any): any => {
  if (v === null || v === undefined || v === '') return undefined;
  const d = dayjs(v);
  return d.isValid() ? d : undefined;
};

/** dayjs → 字符串（日期或日期时间） */
const fromDayjs = (d: any, withTime = false): string | undefined => {
  if (!d) return undefined;
  return dayjs(d).format(withTime ? DATETIME_FMT : DATE_FMT);
};

/** 附件值归一化：兼容数组（UploadFile[]）与字符串（url / 名称） */
const normalizeFileList = (value: any): any[] => {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value;
  return [
    {
      uid: '-1',
      name: String(value).split('/').pop() || String(value),
      status: 'done',
      url: String(value),
    },
  ];
};

export const FieldControl: React.FC<FieldControlProps> = ({
  controlType,
  value,
  onChange,
  options = [],
  disabled,
  readOnly,
  placeholder,
  status,
  browserType,
  multiple,
  maxLength = 200,
  rows = 3,
  inputId,
  style,
}) => {
  // 只读/禁用统一：readOnly 与 disabled 等价（控件不可交互）
  const locked = !!disabled || !!readOnly;
  const commonProps = {
    id: inputId,
    disabled: locked,
    size: 'small' as const,
    status,
    style,
  };
  const antOptions = options.map((o) => ({ label: o.label, value: o.value }));

  switch (controlType) {
    case 'text':
      return (
        <Input
          {...commonProps}
          value={value}
          placeholder={placeholder || ''}
          maxLength={maxLength}
          onChange={(e) => onChange?.(e.target.value)}
        />
      );

    case 'password':
      // 保密字段（文本字段 type=3）：后端唯一以掩码形式存储的字段类型
      return (
        <Input.Password
          {...commonProps}
          value={value}
          placeholder={placeholder || ''}
          maxLength={maxLength}
          onChange={(e) => onChange?.(e.target.value)}
        />
      );

    case 'textarea':
      return (
        <Input.TextArea
          {...commonProps}
          rows={rows}
          value={value}
          placeholder={placeholder || ''}
          onChange={(e) => onChange?.(e.target.value)}
        />
      );

    case 'number':
      return (
        <InputNumber
          {...commonProps}
          step="any"
          value={value === undefined ? undefined : value}
          onChange={(v) => onChange?.(v)}
        />
      );

    case 'wholeNumber':
      return (
        <InputNumber
          {...commonProps}
          step={1}
          value={value === undefined ? undefined : value}
          onChange={(v) => onChange?.(v)}
        />
      );

    case 'date':
      return (
        <DatePicker
          {...commonProps}
          style={{ width: '100%', ...style }}
          format={DATE_FMT}
          value={toDayjs(value)}
          onChange={(d) => onChange?.(fromDayjs(d, false))}
        />
      );

    case 'datetime':
      return (
        <DatePicker
          {...commonProps}
          showTime
          style={{ width: '100%', ...style }}
          format={DATETIME_FMT}
          value={toDayjs(value)}
          onChange={(d) => onChange?.(fromDayjs(d, true))}
        />
      );

    case 'select':
      return (
        <Select
          {...commonProps}
          placeholder={placeholder || '请选择'}
          value={value === undefined ? undefined : value}
          onChange={(v) => onChange?.(v)}
          options={antOptions}
        />
      );

    case 'radio':
      return (
        <Radio.Group
          disabled={locked}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          options={antOptions}
        />
      );

    case 'checkbox':
      // 统一语义：**单个布尔**（对齐 ecology 复选框字段 htmlType=6，值 1/0）
      return (
        <Checkbox
          disabled={locked}
          checked={!!value}
          onChange={(e) => onChange?.(e.target.checked)}
        >
          同意
        </Checkbox>
      );

    case 'browser':
      return (
        <BrowserControl
          browserType={browserType}
          value={value}
          onChange={onChange}
          disabled={disabled}
          readOnly={readOnly}
          placeholder={placeholder}
          multiple={multiple}
          style={style}
        />
      );

    case 'attachment':
      // 统一为真上传：readOnly/打印态下禁用按钮但保留文件列表展示
      // （原 ExcelPreview 是"永远 disabled 的假按钮"，此处统一为同一组件用 readOnly 区分）
      return (
        <Upload
          disabled={locked}
          fileList={normalizeFileList(value)}
          onChange={({ fileList }) =>
            onChange?.(
              fileList
                .filter((f) => f.status === 'done' || f.status === 'success')
                .map((f) => ({
                  uid: f.uid,
                  name: f.name,
                  url: (f as any).url ?? (f as any).response?.url,
                })),
            )
          }
        >
          {!locked && (
            <Button icon={<UploadOutlined />} size="small">
              上传附件
            </Button>
          )}
          {locked && (
            <Button icon={<PaperClipOutlined />} disabled size="small">
              附件
            </Button>
          )}
        </Upload>
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
            ...style,
          }}
        >
          {value || <Typography.Text type="secondary">（富文本内容）</Typography.Text>}
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
            ...style,
          }}
        >
          <legend style={{ fontWeight: 600, color: '#555', padding: '0 6px' }}>
            {value || ''}
          </legend>
        </fieldset>
      );

    case 'custom':
      return (
        <Typography.Text strong style={{ color: '#1890ff', ...style }}>
          [自定义] {value || ''}
        </Typography.Text>
      );

    case 'label':
      // 纯文本说明：不渲染输入控件
      return <span style={style}>{value || ''}</span>;

    default:
      // 未知类型兜底为文本框，保证字段始终是可交互控件而非纯文本
      return (
        <Input
          {...commonProps}
          value={value}
          placeholder={placeholder || ''}
          onChange={(e) => onChange?.(e.target.value)}
        />
      );
  }
};

export default FieldControl;
