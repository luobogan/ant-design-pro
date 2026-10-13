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
import BrowserControl from './BrowserControl';
import MobileFieldControl from './MobileFieldControl';
import OdocField from './OdocField';
import type { ControlType, FieldControlBaseProps, FieldOption } from './fieldTypes';
import { DATE_FMT, DATETIME_FMT, fromDayjsValue, toDayjsValue } from './fieldTypes';
import { FIELD_COLOR, resolveVariant, useIsMobileViewport } from './fieldTokens';

/**
 * 字段控件唯一渲染入口（桌面端实现 + 手机端分发）
 *
 * ⚠️ 开发规范：页面层**禁止**再自行 switch 字段类型渲染控件，一律调用本组件。
 *    新增/修改字段类型只改 `fieldTypes.ts`（编码与控件映射）与
 *    `FieldControl.tsx` / `MobileFieldControl.tsx`（两端控件实现），
 *    所有页面（Excel 预览、表单数据页、流程发起等）自动生效。
 *
 * 桌面 / 手机两端共用同一份 props 契约（`FieldControlBaseProps`），
 * 由 `variant` 决定外观：
 *   · `variant='desktop'`（默认）：紧凑控件，适配 Excel 网格单元格（可能仅 120px 宽）
 *   · `variant='mobile'`：触控友好控件（40px 高、16px 字号、开关化、纵向单选）
 *   · `variant='auto'`：按视口宽度（≤768px）自动切换，窗口缩放/旋屏实时响应
 *
 * 行为基准：对齐 `ExcelPreview.FieldCell`（原主运行态渲染器），保证改造不回归。
 * 页面层退化为「容器适配层」：
 *  · ExcelPreview  → 负责 <td> 布局 + Excel 单元格样式 + 节点权限
 *  · FieldRenderer → 负责 Form.Item 包裹 + 只读降级
 */

/** 字段控件 props：与手机端 `MobileFieldControl` 共用同一份契约 */
export type FieldControlProps = FieldControlBaseProps;
/** 选项类型（从 fieldTypes 单一来源导出，此处保留别名以兼容既有引用） */
export type { FieldOption };

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

export const FieldControl: React.FC<FieldControlProps> = (props) => {
  const {
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
    variant = 'desktop',
    instanceId,
    defId,
    fieldTitle,
  } = props;

  // 响应式：variant='auto' 时按视口宽度自动切换。
  // ⚠️ Hook 必须无条件调用（不可按条件执行），故放在 early-return 之前。
  const isMobileViewport = useIsMobileViewport();

  // 手机端：整体委托 MobileFieldControl（两端 props 一致，透传即可）
  if (resolveVariant(variant, isMobileViewport) === 'mobile') {
    return <MobileFieldControl {...props} variant="mobile" />;
  }

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
          value={toDayjsValue(value)}
          onChange={(d) => onChange?.(fromDayjsValue(d, false))}
        />
      );

    case 'datetime':
      return (
        <DatePicker
          {...commonProps}
          showTime
          style={{ width: '100%', ...style }}
          format={DATETIME_FMT}
          value={toDayjsValue(value)}
          onChange={(d) => onChange?.(fromDayjsValue(d, true))}
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
      // 手机端会把本类型渲染为 Switch 开关（见 MobileFieldControl）
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
          // 预览/表单态不在按钮后显示「人力资源/部门/岗位」类型 Tag（保持控件简洁）
          showTypeTag={false}
          // 弹窗也按 variant 走：手机端用 antd-mobile 底部弹层（选人/选组织）
          variant={resolveVariant(variant, isMobileViewport)}
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
            border: `1px solid ${FIELD_COLOR.border}`,
            borderRadius: 4,
            padding: '4px 8px',
            minHeight: 50,
            background: '#fff',
            color: FIELD_COLOR.value,
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
            border: `1px solid ${FIELD_COLOR.border}`,
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

    case 'odoc':
      // 正文字段：在线编辑 + 版本管理（OnlyOffice），value 为 docId
      return (
        <OdocField
          value={value}
          instanceId={instanceId}
          defId={defId}
          fieldTitle={fieldTitle}
          disabled={disabled}
          readOnly={readOnly}
          onChange={onChange}
        />
      );

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