import React from 'react';
import type { FieldDefinition } from '@/services/formmode';
import FieldControl from '@/components/FormMode/FieldControl';
import {
  mapFieldToControlType,
  resolveBrowserType,
  type ControlType,
} from '@/components/FormMode/fieldTypes';
import type { FieldVariant } from '@/components/FormMode/fieldTokens';
import { PersonOrgValueText } from '@/components/FormMode/PersonOrgPicker';

interface FieldRendererProps {
  field: FieldDefinition;
  value?: any;
  onChange?: (value: any) => void;
  disabled?: boolean;
  /** 只读（命名规范：驼峰 readOnly，与 FieldControl / BrowserControl / PersonOrgField 一致） */
  readOnly?: boolean;
  /** 外观变体：默认 'auto'（本组件用于**页面级**容器——数据详情/新增/编辑、流程测试，
   *  布局是整行流式而非 Excel 的 120px 窄单元格），故按视口自动切换：
   *  宽屏仍走紧凑桌面控件（行为不变），≤768px 自动换手机端触控控件。
   *  若调用方处于窄单元格场景（如 Excel 网格内），请显式传 'desktop'。 */
  variant?: FieldVariant;
  /** @deprecated 历史命名（小写 o），仅为兼容既有调用保留，新代码请用 `readOnly` */
  readonly?: boolean;
  /** 流程实例ID（正文字段首次初始化依赖；无则只能查看/上传已存在正文） */
  instanceId?: any;
  /** 流程定义ID */
  defId?: any;
}

/**
 * 字段渲染组件（容器适配层）
 *
 * ★ 本组件**不再自行 switch 字段类型**：类型 → 控件的映射统一走
 *   `fieldTypes.mapFieldToControlType`（权威编码 A）+ 共享控件 `FieldControl`。
 *   本组件只负责两件页面特有的事：只读态降级展示、placeholder 文案。
 *
 * ⚠️ 编码修正（本组件此前按另一套编码解读字段，导致同一字段在不同页面渲染成不同控件）：
 *   后端 `FieldDefinition.fieldHtmlType` 返回的是编码 A（与 TableDesign 下拉项、
 *   EcologyFormImportServiceImpl 的 HTML_* 常量一致）：
 *     1文本 2多行文本 3浏览按钮 4选择框 5附件上传 6复选框 7特殊字段 8布局组件
 *   此前本组件误按 2浏览/3选择/4附件/5特殊/8下拉/9树形 解读，
 *   结果「人力资源/部门」等浏览按钮字段被渲染成空下拉框 —— 与 Excel 预览页表现不一致。
 *
 * 行为变化（因编码对齐所致，属修正）：
 *   · 选择框 type=3（复选框）由 `Checkbox.Group`（数组）统一为 `checkbox`（单布尔），与 Excel 预览一致
 *   · 时间由 `TimePicker`（HH:mm:ss）统一为 `datetime`（YYYY-MM-DD HH:mm:ss）
 *   · 整数/小数、保密字段此前退化成普通 Input，现已按类型正确渲染
 */
const FieldRenderer: React.FC<FieldRendererProps> = (props) => {
  const { field, value, onChange, disabled = false, variant = 'auto', instanceId, defId } = props;
  // 兼容历史小写 readonly，新代码统一用 readOnly
  const readOnly = props.readOnly ?? props.readonly ?? false;
  const controlType: ControlType = mapFieldToControlType(field);
  const browserType = resolveBrowserType(field);
  const { fieldLabel, fieldLen, options } = field;

  // 只读态：不渲染可编辑控件，浏览按钮需把 id 串反查为名称
  if (readOnly) {
    if (controlType === 'browser') {
      return <PersonOrgValueText browserType={browserType} value={value} />;
    }
    return <span>{value ?? '-'}</span>;
  }

  return (
    <FieldControl
      controlType={controlType}
      value={value}
      onChange={onChange}
      options={options?.map((o) => ({ value: o.value, label: o.label }))}
      disabled={disabled}
      browserType={browserType}
      maxLength={fieldLen || 200}
      placeholder={
        controlType === 'browser' || controlType === 'select' || controlType === 'radio'
          ? `请选择${fieldLabel}`
          : `请输入${fieldLabel}`
      }
      // 桌面 / 手机端由共享控件按 variant 分发，页面层无需关心控件细节
      variant={variant}
      instanceId={instanceId}
      defId={defId}
      fieldTitle={fieldLabel}
    />
  );
};

export default FieldRenderer;
