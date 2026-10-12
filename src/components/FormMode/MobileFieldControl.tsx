import React from 'react';
import {
  Button,
  DatePicker,
  Input,
  InputNumber,
  Radio,
  Select,
  Space,
  Switch,
  Typography,
  Upload,
} from 'antd';
import { InboxOutlined, PaperClipOutlined, UploadOutlined } from '@ant-design/icons';
import BrowserControl from './BrowserControl';
import type { FieldControlBaseProps } from './fieldTypes';
import { DATE_FMT, DATETIME_FMT, fromDayjsValue, toDayjsValue } from './fieldTypes';
import { FIELD_COLOR, MOBILE_FIELD_TOKENS } from './fieldTokens';

/**
 * 手机端字段控件集（`FieldControl` 的 mobile 变体实现）
 *
 * <p><b>与桌面端的关系</b>：本组件的 props 与 `FieldControl` **完全一致**
 * （见 `fieldTypes.ts` 的 `FieldControlBaseProps`），二者由 `FieldControl` 按
 * `variant` 统一分发 —— 页面层永远只调用 `FieldControl`，不直接引用本文件。
 * 这样新增属性只需改一处，两端编译期即强制对齐。</p>
 *
 * <p><b>手机端与桌面端的差异（全部来自 `MOBILE_FIELD_TOKENS`，不散落魔法值）</b>：</p>
 * <pre>
 *   控件高度   桌面 24px(size=small)      手机 40px(size=middle + minHeight)
 *   取值字号   桌面 13px                  手机 16px（&lt;16px 触发 iOS 聚焦自动缩放）
 *   复选框     Checkbox(同意)             Switch 开关（整行更易点中）
 *   单选组     横排                        纵排（窄屏横排会错位）
 *   下拉       默认列表高                  加大行高，触控不误触
 *   附件       小按钮                      整行虚线上传区（点按/拖放皆可）
 * </pre>
 *
 * <p><b>响应式</b>：本组件按「整行流式」布局，宽度 100%、minWidth 0，
 * 放在 `MobileSheetForm` 的标签+控件行内自适应；跨断点切换由
 * `FieldControl` 的 `variant='auto'` + `useIsMobileViewport()` 负责。</p>
 */

/** 手机端字段控件作用域类名（用于注入局部样式，见 ensureMobileFieldStyles） */
const MOBILE_FIELD_CLASS = 'fm-mobile-field';

let stylesInjected = false;

/**
 * 注入手机端字段控件的局部样式（全局只注入一次）。
 *
 * <p><b>为什么需要</b>：本项目 antd 主题下 `.ant-input` 的边框色解析为
 * `transparent`（`1px solid rgba(0,0,0,0)`，桌面端同样如此）。桌面端表单字段有
 * 单元格灰底（#f0f0f0）衬托，控件边界仍可辨识；而手机端列表行是**白底**，
 * 白底 + 透明边框 = 控件完全不可见（实测 input 宽 237px、高 40px 但看不见）。
 * 故在此为手机端作用域补回可见边框。</p>
 *
 * <p><b>为什么用局部 CSS 而不是内联 style</b>：内联 `borderColor` 会**覆盖**
 * antd 的 hover / focus 变色，导致聚焦时没有高亮反馈；局部 CSS 保留交互态。</p>
 */
function ensureMobileFieldStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;
  const css = `
.${MOBILE_FIELD_CLASS} .ant-input,
.${MOBILE_FIELD_CLASS}.ant-input,
.${MOBILE_FIELD_CLASS} .ant-input-number,
.${MOBILE_FIELD_CLASS}.ant-input-number,
.${MOBILE_FIELD_CLASS} .ant-input-number-input,
.${MOBILE_FIELD_CLASS} textarea.ant-input {
  border-color: ${FIELD_COLOR.border};
}
.${MOBILE_FIELD_CLASS} .ant-input:hover,
.${MOBILE_FIELD_CLASS}.ant-input:hover,
.${MOBILE_FIELD_CLASS} .ant-input-number:hover,
.${MOBILE_FIELD_CLASS}.ant-input-number:hover {
  border-color: #40a9ff;
}
.${MOBILE_FIELD_CLASS} .ant-input:focus,
.${MOBILE_FIELD_CLASS}.ant-input:focus,
.${MOBILE_FIELD_CLASS} .ant-input-focused,
.${MOBILE_FIELD_CLASS} .ant-input-number-focused,
.${MOBILE_FIELD_CLASS}.ant-input-number-focused {
  border-color: #1677ff;
  box-shadow: 0 0 0 2px rgba(5, 145, 255, 0.1);
}
.${MOBILE_FIELD_CLASS} .ant-input[disabled],
.${MOBILE_FIELD_CLASS}.ant-input[disabled],
.${MOBILE_FIELD_CLASS} .ant-input-number-disabled,
.${MOBILE_FIELD_CLASS}.ant-input-number-disabled {
  background: ${FIELD_COLOR.readOnlyBg};
  border-color: ${FIELD_COLOR.readOnlyBorder};
  color: ${FIELD_COLOR.readOnlyText};
}
`;
  const el = document.createElement('style');
  el.setAttribute('data-fm-mobile-field', 'true');
  el.appendChild(document.createTextNode(css));
  document.head.appendChild(el);
}

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

export const MobileFieldControl: React.FC<FieldControlBaseProps> = ({
  controlType,
  value,
  onChange,
  options = [],
  disabled,
  readOnly,
  placeholder,
  status,
  browserType,
  maxLength = 200,
  rows = 4,
  inputId,
  style,
}) => {
  const T = MOBILE_FIELD_TOKENS;
  // 首次渲染时注入手机端作用域样式（补回透明边框，保证白底上控件可见）
  ensureMobileFieldStyles();
  /** 只读与禁用合并：手机端同样不允许交互 */
  const locked = !!disabled || !!readOnly;

  /**
   * 统一的手机端控件外框样式：
   * - fontSize 16px：iOS Safari 对 <16px 输入框聚焦会自动放大页面
   * - minWidth 0：置于 flex 容器内可正确收缩，不撑破标签列
   * - minHeight 40：保证触控目标足够大
   * 外部传入的 style 优先级最高（用于承载 Excel 单元格底色/字体等）
   */
  const box: React.CSSProperties = {
    width: '100%',
    minWidth: 0,
    minHeight: T.controlMinHeight,
    fontSize: T.controlFontSize,
    ...(locked ? { background: FIELD_COLOR.readOnlyBg, color: FIELD_COLOR.readOnlyText } : { background: '#fff' }),
    ...style,
  };

  const commonProps = {
    id: inputId,
    className: MOBILE_FIELD_CLASS,
    disabled: locked,
    size: T.controlSize,
    status,
    style: box,
  };

  const antOptions = options.map((o) => ({ label: o.label, value: o.value }));

  switch (controlType) {
    // ── 输入类 ──
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

    // ── 日期选择 ──（格式与桌面端保持一致，保证存取不漂移）
    case 'date':
      return (
        <DatePicker
          {...commonProps}
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
          format={DATETIME_FMT}
          value={toDayjsValue(value)}
          onChange={(d) => onChange?.(fromDayjsValue(d, true))}
        />
      );

    // ── 选择器 ──
    case 'select':
      return (
        <Select
          {...commonProps}
          placeholder={placeholder || '请选择'}
          value={value === undefined ? undefined : value}
          onChange={(v) => onChange?.(v)}
          options={antOptions}
          // 加大下拉项行高与浮层高度，避免手指误触相邻项
          listItemHeight={48}
          listHeight={264}
        />
      );

    case 'radio':
      // 纵向排列：窄屏下横向排列会因换行导致选项与标签错位
      return (
        <Radio.Group
          disabled={locked}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        >
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {antOptions.map((o) => (
              <Radio key={String(o.value)} value={o.value} style={{ fontSize: T.controlFontSize }}>
                {o.label}
              </Radio>
            ))}
          </Space>
        </Radio.Group>
      );

    case 'checkbox':
      // 手机端用 Switch（开关）：整行可点，比 Checkbox 更适合触屏。
      // 值语义与桌面端保持一致：布尔 true/false。
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: T.controlMinHeight }}>
          <Switch
            id={inputId}
            disabled={locked}
            checked={!!value}
            onChange={(checked) => onChange?.(checked)}
          />
          <span style={{ fontSize: T.controlFontSize, color: locked ? FIELD_COLOR.readOnlyText : FIELD_COLOR.value }}>
            {value ? '是' : '否'}
          </span>
        </div>
      );

    // ── 浏览按钮（复用桌面端 BrowserControl，保证选人/选组织逻辑只有一份）──
    case 'browser':
      return (
        <div className={MOBILE_FIELD_CLASS}>
          <BrowserControl
            browserType={browserType}
            value={value}
            onChange={onChange}
            disabled={disabled}
            readOnly={readOnly}
            placeholder={placeholder}
            showTypeTag={false}
            style={box}
          />
        </div>
      );

    // ── 附件 ──（整行虚线上传区，手机端更好点）
    case 'attachment':
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              minHeight: 64,
              padding: 8,
              border: `1px dashed ${locked ? FIELD_COLOR.readOnlyBorder : FIELD_COLOR.border}`,
              borderRadius: 4,
              background: locked ? FIELD_COLOR.readOnlyBg : '#fff',
              color: locked ? FIELD_COLOR.readOnlyText : FIELD_COLOR.label,
              fontSize: 14,
            }}
          >
            <InboxOutlined style={{ fontSize: 22 }} />
            <span>{locked ? '附件（只读）' : '点击或拖拽上传'}</span>
          </div>
        </Upload>
      );

    // ── 展示类（无交互）──
    case 'richtext':
      return (
        <div
          contentEditable={false}
          style={{
            border: `1px solid ${FIELD_COLOR.border}`,
            borderRadius: 4,
            padding: '8px 12px',
            minHeight: 64,
            background: '#fff',
            color: FIELD_COLOR.value,
            fontSize: T.controlFontSize,
            lineHeight: 1.6,
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
            padding: '12px',
            margin: 0,
            ...style,
          }}
        >
          <legend style={{ fontWeight: 600, color: '#555', padding: '0 6px', fontSize: T.labelFontSize }}>
            {value || ''}
          </legend>
        </fieldset>
      );

    case 'custom':
      return (
        <Typography.Text strong style={{ color: '#1890ff', fontSize: T.controlFontSize, ...style }}>
          [自定义] {value || ''}
        </Typography.Text>
      );

    case 'label':
      // 纯文本说明：不渲染输入控件
      return <span style={{ fontSize: T.controlFontSize, ...style }}>{value || ''}</span>;

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

/** 只读态附件按钮（外部无上传能力时降级展示，保持图标语义一致） */
export const MobileAttachmentFallback: React.FC = () => (
  <Button icon={<PaperClipOutlined />} disabled size="middle">
    附件
  </Button>
);

/** 上传入口图标（保持附件按钮图标统一） */
export const MobileUploadIcon = <UploadOutlined />;

export default MobileFieldControl;