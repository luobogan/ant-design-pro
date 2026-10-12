import React from 'react';
import { Button, DatePicker, Input, Picker, Radio, Switch, TextArea } from 'antd-mobile';
import { Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import BrowserControl from './BrowserControl';
import type { FieldControlBaseProps } from './fieldTypes';
import { DATE_FMT, DATETIME_FMT, fromDayjsValue, toDayjsValue } from './fieldTypes';
import { FIELD_COLOR, MOBILE_FIELD_TOKENS } from './fieldTokens';

/**
 * 手机端字段控件集（基于 ant-design-mobile 5）
 *
 * <p><b>定位</b>：本组件是 `FieldControl` 的 `variant='mobile'` 实现，props 与桌面端
 * <b>完全一致</b>（见 `fieldTypes.ts` 的 `FieldControlBaseProps`）。页面层永远只调用
 * `FieldControl`，由它按 `variant` 分发到本文件，因此新增属性只需改一处，
 * 两端编译期即强制对齐。</p>
 *
 * <p><b>为什么用 antd-mobile 而不是 antd</b>：antd 的控件是按桌面鼠标交互设计的
 * （24px 高度、13px 字号、下拉浮层位置按 PC 视口计算）。在手机上会出现：
 * 触控目标过小、聚焦时 iOS Safari 自动放大页面、下拉框溢出屏幕。
 * antd-mobile 是专为 H5 触屏设计的组件库：48px 级触控高度、滚轮式
 * `Picker`/`DatePicker` 底部弹层、`Switch` 开关、`Selector` 多选胶囊，
 * 并且自带 `:active` 按压反馈与惯性滚动，这些都是 antd 给不了的。</p>
 *
 * <p><b>与桌面端的类型映射差异</b>（值语义完全不变，仅交互形态变化）：</p>
 * <pre>
 *   text / password / textarea   → Input / Input(type=password) / TextArea
 *   number / wholeNumber         → Input(inputMode=decimal/numeric)（antd-mobile 无 InputNumber，
 *                                   Stepper 步进器不适合金额录入，故用数字键盘输入）
 *   date / datetime              → DatePicker（底部滚轮弹层，precision=day/second）
 *   select                       → Picker（底部滚轮单选）
 *   radio                        → Radio 纵排（antd-mobile 无 Radio.Group，手动管理选中）
 *   checkbox                     → Switch 开关
 *   browser                      → 复用 BrowserControl（选人/选组织弹窗逻辑只有一份）
 *   attachment                   → Upload + antd-mobile Button
 *   richtext / group / custom / label → 展示型（无交互）
 * </pre>
 *
 * <p><b>响应式</b>：本组件自身即「整行流式」布局（width:100%、minWidth:0），
 * 配合 `MobileSheetForm` 的 flexWrap 标签行使用；跨断点由 `FieldControl` 的
 * `variant='auto'` + `useIsMobileViewport()` 负责，缩放窗口实时切换。</p>
 */

/** 手机端字段控件作用域类名（用于注入局部样式） */
const MOBILE_FIELD_CLASS = 'fm-adm-field';

let stylesInjected = false;

/**
 * 注入手机端字段控件的局部样式（全局只注入一次）。
 *
 * 包含三部分：
 *  1. **antd-mobile 主题变量**：把 `--adm-color-primary` 等项目主色对齐到 antd 的
 *     `#1677ff`，否则手机端控件是 antd-mobile 默认的蓝色，与桌面端观感不一致。
 *  2. **输入框字号 16px**：iOS Safari 对 <16px 的输入框聚焦时会自动放大页面。
 *  3. **错误态红框**：antd-mobile 的 `Input` 没有 antd 那样的 `status` 属性，
 *    只能通过 CSS 覆盖 `.adm-input` 的边框色。
 */
function ensureAdmStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;
  const css = `
:root {
  --adm-color-primary: #1677ff;
  --adm-color-text: #333333;
  --adm-color-text-secondary: #666666;
  --adm-color-weak: #999999;
  --adm-color-light: #cccccc;
  --adm-color-border: #d9d9d9;
  --adm-color-box: #ffffff;
  --adm-font-size-main: 16px;
  --adm-font-size-content: 16px;
}
.${MOBILE_FIELD_CLASS} {
  width: 100%;
  min-width: 0;
  text-align: left;
}
/* 输入类：16px 规避 iOS 聚焦自动缩放；右侧留出清除图标空间 */
.${MOBILE_FIELD_CLASS} .adm-input,
.${MOBILE_FIELD_CLASS} .adm-text-area {
  font-size: 16px;
}
/* antd-mobile 的 Input 默认「无边框 + 透明背景」（它的设计依赖外层 List/Form 的分隔线），
   而本项目的手机端是白底卡片 + 无分隔线的流式布局，裸输入框会完全看不见边界。
   故在此补回输入框外观（边框/圆角/内边距/白底），高度 ≈ 42px 满足触控目标。 */
.${MOBILE_FIELD_CLASS} .adm-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px;
  border: 1px solid ${FIELD_COLOR.border};
  border-radius: 6px;
  background: #ffffff;
  font-size: 16px;
  color: ${FIELD_COLOR.value};
}
.${MOBILE_FIELD_CLASS} .adm-text-area {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px;
  border: 1px solid ${FIELD_COLOR.border};
  border-radius: 6px;
  background: #ffffff;
  font-size: 16px;
  color: ${FIELD_COLOR.value};
}
/* 清除图标右侧留位 */
.${MOBILE_FIELD_CLASS} .adm-input-clear {
  right: 8px;
}
/* 单选字号统一 16px（antd-mobile 默认 14px 偏小） */
.${MOBILE_FIELD_CLASS} .adm-radio {
  --font-size: 16px;
}
/* 开关放大到接近触控目标（antd-mobile 默认 31px 高，手机上偏小） */
.${MOBILE_FIELD_CLASS} .adm-switch {
  --height: 36px;
  --width: 64px;
}
.${MOBILE_FIELD_CLASS} .adm-input::placeholder,
.${MOBILE_FIELD_CLASS} .adm-text-area::placeholder {
  font-size: 16px;
}
/* 只读 / 禁用态底色 */
.${MOBILE_FIELD_CLASS} .adm-input[readonly],
.${MOBILE_FIELD_CLASS} .adm-input:disabled,
.${MOBILE_FIELD_CLASS} .adm-text-area:disabled {
  background: ${FIELD_COLOR.readOnlyBg};
  color: ${FIELD_COLOR.readOnlyText};
}
/* 错误态红框（Input 无 status，需覆盖边框色） */
.${MOBILE_FIELD_CLASS}--error .adm-input,
.${MOBILE_FIELD_CLASS}--error .adm-text-area,
.${MOBILE_FIELD_CLASS}--error .fm-adm-trigger {
  border-color: ${FIELD_COLOR.required} !important;
}
/* 选择器触发器：做成输入框外观，让「点一下弹滚轮」在视觉上与输入框一致 */
.${MOBILE_FIELD_CLASS} .fm-adm-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: ${MOBILE_FIELD_TOKENS.controlMinHeight}px;
  padding: 6px 12px;
  border: 1px solid ${FIELD_COLOR.border};
  border-radius: 6px;
  background: #ffffff;
  font-size: 16px;
  color: ${FIELD_COLOR.value};
  box-sizing: border-box;
}
.${MOBILE_FIELD_CLASS} .fm-adm-trigger--placeholder {
  color: ${FIELD_COLOR.placeholder};
}
.${MOBILE_FIELD_CLASS} .fm-adm-trigger--disabled {
  background: ${FIELD_COLOR.readOnlyBg};
  color: ${FIELD_COLOR.readOnlyText};
}
.${MOBILE_FIELD_CLASS} .fm-adm-trigger-arrow {
  color: ${FIELD_COLOR.placeholder};
  font-size: 12px;
  flex-shrink: 0;
}
/* 附件上传区：整行虚线框，手机上比小按钮更好点 */
.${MOBILE_FIELD_CLASS} .fm-adm-upload {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 64px;
  padding: 8px;
  border: 1px dashed ${FIELD_COLOR.border};
  border-radius: 6px;
  background: #ffffff;
}
`;
  const el = document.createElement('style');
  el.setAttribute('data-fm-adm-field', 'true');
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

/** 取值统一转字符串（antd-mobile 的 Input/TextArea 只接受 string） */
const toStr = (v: any): string => {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.join(',');
  return String(v);
};

/** 日期/日期时间：字符串 ↔ Date（antd-mobile DatePicker 的 value 是 Date | null） */
const toDateValue = (v: any): Date | null => {
  const d = toDayjsValue(v);
  return d ? d.toDate() : null;
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
  // 首次渲染时注入主题与局部样式
  ensureAdmStyles();

  /** 只读与禁用合并：手机端同样不允许交互 */
  const locked = !!disabled || !!readOnly;
  const hasError = status === 'error';
  /** 外框类名：错误态交给 CSS 覆盖边框色 */
  const wrapClass = `${MOBILE_FIELD_CLASS}${hasError ? ` ${MOBILE_FIELD_CLASS}--error` : ''}`;

  // ── 日期 / 日期时间：底部滚轮弹层 ──
  if (controlType === 'date' || controlType === 'datetime') {
    const withTime = controlType === 'datetime';
    const dateVal = toDateValue(value);
    return (
      <div className={wrapClass} style={style}>
        <DatePicker
          title={withTime ? '选择日期时间' : '选择日期'}
          precision={withTime ? 'second' : 'day'}
          value={dateVal}
          disabled={locked}
          onConfirm={(d: Date | null) => onChange?.(d ? fromDayjsValue(dayjs(d), withTime) : '')}
        >
          {(val: Date | null, actions) => (
            <div
              id={inputId}
              className={`fm-adm-trigger${!val ? ' fm-adm-trigger--placeholder' : ''}${locked ? ' fm-adm-trigger--disabled' : ''}`}
              onClick={() => !locked && actions.open()}
            >
              <span>
                {val
                  ? dayjs(val).format(withTime ? DATETIME_FMT : DATE_FMT)
                  : placeholder || (withTime ? '请选择日期时间' : '请选择日期')}
              </span>
              <span className="fm-adm-trigger-arrow">▼</span>
            </div>
          )}
        </DatePicker>
      </div>
    );
  }

  // ── 下拉选择：底部滚轮单选 ──
  if (controlType === 'select') {
    const opts = options.map((o) => ({ label: toStr(o.label), value: o.value }));
    const columns = [{ options: opts }];
    const selected = opts.find((o) => String(o.value) === String(value ?? ''));
    return (
      <div className={wrapClass} style={style}>
        <Picker
          title="请选择"
          columns={columns}
          value={value === undefined || value === null ? [] : [value]}
          disabled={locked}
          onConfirm={(v: (number | string | null)[]) => onChange?.(v[0] ?? '')}
        >
          {(items, actions) => (
            <div
              id={inputId}
              className={`fm-adm-trigger${!selected ? ' fm-adm-trigger--placeholder' : ''}${locked ? ' fm-adm-trigger--disabled' : ''}`}
              onClick={() => !locked && actions.open()}
            >
              <span>{selected ? selected.label : placeholder || '请选择'}</span>
              <span className="fm-adm-trigger-arrow">▼</span>
            </div>
          )}
        </Picker>
      </div>
    );
  }

  // ── 单选：antd-mobile 无 Radio.Group，手动管理选中（纵排更适配窄屏）──
  if (controlType === 'radio') {
    const opts = options.map((o) => ({ label: toStr(o.label), value: o.value }));
    return (
      <div className={wrapClass} style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }}>
        {opts.map((o) => (
          <Radio
            key={String(o.value)}
            block
            value={o.value}
            checked={String(o.value) === String(value ?? '')}
            disabled={locked}
            onChange={(checked) => checked && onChange?.(o.value)}
          >
            {o.label}
          </Radio>
        ))}
      </div>
    );
  }

  // ── 开关 ──
  if (controlType === 'checkbox') {
    return (
      <div
        className={wrapClass}
        style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: T.controlMinHeight, ...style }}
      >
        <Switch
          id={inputId}
          checked={!!value}
          disabled={locked}
          // 不使用 checkedText/uncheckedText：开关内部文字会与外层的「是/否」文案重复
          onChange={(checked) => onChange?.(checked)}
        />
        <span style={{ fontSize: 16, color: locked ? FIELD_COLOR.readOnlyText : FIELD_COLOR.value }}>
          {value ? '是' : '否'}
        </span>
      </div>
    );
  }

  // ── 浏览按钮：复用 BrowserControl（选人/选组织逻辑只有一份）──
  // ⚠️ 必须显式传 variant="mobile"：本组件（MobileFieldControl）只在手机端被渲染，
  //    若不传，BrowserControl 会用默认 'desktop' → 弹出 antd 的 780px 宽 Modal，
  //    在手机上溢出屏幕且表格/分页器极难点中。
  if (controlType === 'browser') {
    return (
      <div className={wrapClass}>
        <BrowserControl
          browserType={browserType}
          value={value}
          onChange={onChange}
          disabled={disabled}
          readOnly={readOnly}
          placeholder={placeholder}
          showTypeTag={false}
          variant="mobile"
          style={style}
        />
      </div>
    );
  }

  // ── 附件 ──
  if (controlType === 'attachment') {
    return (
      <div className={wrapClass} style={style}>
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
          <div className="fm-adm-upload">
            <Button size="small" fill="outline" disabled={locked} icon={<UploadOutlined />}>
              {locked ? '附件（只读）' : '点击上传'}
            </Button>
          </div>
        </Upload>
      </div>
    );
  }

  // ── 输入类 ──
  switch (controlType) {
    case 'text':
      return (
        <div className={wrapClass} style={style}>
          <Input
            id={inputId}
            value={toStr(value)}
            placeholder={placeholder || ''}
            maxLength={maxLength}
            disabled={locked}
            readOnly={locked}
            clearable
            onChange={(v) => onChange?.(v)}
          />
        </div>
      );

    case 'password':
      return (
        <div className={wrapClass} style={style}>
          <Input
            id={inputId}
            type="password"
            value={toStr(value)}
            placeholder={placeholder || ''}
            maxLength={maxLength}
            disabled={locked}
            readOnly={locked}
            onChange={(v) => onChange?.(v)}
          />
        </div>
      );

    case 'textarea':
      return (
        <div className={wrapClass} style={style}>
          <TextArea
            id={inputId}
            value={toStr(value)}
            placeholder={placeholder || ''}
            rows={rows}
            maxLength={maxLength}
            showCount
            disabled={locked}
            readOnly={locked}
            onChange={(v) => onChange?.(v)}
          />
        </div>
      );

    case 'number':
    case 'wholeNumber':
      return (
        <div className={wrapClass} style={style}>
          <Input
            id={inputId}
            // antd-mobile 无 InputNumber：用数字键盘输入。
            // Stepper 步进器只适合 ±1 场景，金额等字段用它逐次点击不现实。
            inputMode={controlType === 'wholeNumber' ? 'numeric' : 'decimal'}
            value={toStr(value)}
            placeholder={placeholder || ''}
            disabled={locked}
            readOnly={locked}
            clearable
            onChange={(v) => onChange?.(v)}
          />
        </div>
      );

    case 'richtext':
      return (
        <div
          className={wrapClass}
          style={{
            border: `1px solid ${FIELD_COLOR.border}`,
            borderRadius: 6,
            padding: '8px 12px',
            minHeight: 64,
            background: '#fff',
            color: FIELD_COLOR.value,
            fontSize: T.controlFontSize,
            lineHeight: 1.6,
            ...style,
          }}
        >
          {toStr(value) || <span style={{ color: FIELD_COLOR.placeholder }}>（富文本内容）</span>}
        </div>
      );

    case 'group':
      return (
        <fieldset
          className={wrapClass}
          style={{
            border: `1px solid ${FIELD_COLOR.border}`,
            borderRadius: 6,
            padding: '12px',
            margin: 0,
            ...style,
          }}
        >
          <legend style={{ fontWeight: 600, color: '#555', padding: '0 6px', fontSize: T.labelFontSize }}>
            {toStr(value)}
          </legend>
        </fieldset>
      );

    case 'custom':
      return (
        <span className={wrapClass} style={{ color: '#1890ff', fontWeight: 600, fontSize: T.controlFontSize, ...style }}>
          [自定义] {toStr(value)}
        </span>
      );

    case 'label':
      return (
        <span className={wrapClass} style={{ fontSize: T.controlFontSize, ...style }}>
          {toStr(value)}
        </span>
      );

    default:
      // 未知类型兜底为文本框，保证字段始终是可交互控件而非纯文本
      return (
        <div className={wrapClass} style={style}>
          <Input
            id={inputId}
            value={toStr(value)}
            placeholder={placeholder || ''}
            disabled={locked}
            readOnly={locked}
            clearable
            onChange={(v) => onChange?.(v)}
          />
        </div>
      );
  }
};

export default MobileFieldControl;