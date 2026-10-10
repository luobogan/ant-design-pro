import React from 'react';
import { Input, Tag, Tooltip } from 'antd';
import { getBrowserTypeLabel, isBrowserTypeMultiple } from './fieldTypes';
import { PersonOrgField } from './PersonOrgPicker';
import { BROWSER_TYPE_META } from './personOrg';

/**
 * 浏览按钮字段统一壳（唯一入口）
 *
 * 收敛三件事，页面层不必再各自实现：
 *  1. **单/多选语义**：按 `isBrowserTypeMultiple(browserType)` 显式传给 PersonOrgField。
 *     ⚠️ PersonOrgPicker 内部是"默认多选"（multiple !== false，属业务要求，不得改动），
 *     所以这里必须显式传值，否则「人力资源 / 部门 / 岗位」等单选类型会被渲染成多选。
 *  2. **类型标签**：蓝色 Tag 显示具体类型（人力资源 / 多人力资源 / 部门 …），
 *     否则预览里就是一个"什么都看不出来"的空控件。
 *  3. **未支持类型降级**：BROWSER_TYPE_META 未登记的类型（资产/文档/流程等）退化为
 *     带类型提示的输入框，而不是直接不渲染。
 *
 * 新增浏览按钮类型只需改 `personOrg.ts` 的 BROWSER_TYPE_META 与
 * `fieldTypes.ts` 的 BROWSER_TYPE_LABEL_MAP，本组件自动支持。
 */
export interface BrowserControlProps {
  /** 浏览按钮类型（ecology 35+ 编号空间） */
  browserType?: number;
  /** 值：id 逗号串（E9 数据格式） */
  value?: any;
  onChange?: (value: any) => void;
  disabled?: boolean;
  /** 只读（设计态预览用：只展示效果，不改数据） */
  readOnly?: boolean;
  placeholder?: string;
  /** 是否显示右侧类型 Tag（默认显示） */
  showTypeTag?: boolean;
  style?: React.CSSProperties;
}

export const BrowserControl: React.FC<BrowserControlProps> = ({
  browserType,
  value,
  onChange,
  disabled,
  readOnly,
  placeholder,
  showTypeTag = true,
  style,
}) => {
  const meta = browserType != null ? BROWSER_TYPE_META[browserType] : undefined;
  const typeLabel =
    meta?.label || getBrowserTypeLabel(browserType) || '浏览按钮';

  // 未接入数据的类型 → 带类型提示的输入框（降级，保证字段始终可见可交互）
  if (!meta) {
    return (
      <Tooltip title={`浏览按钮类型 ${browserType ?? '-'}（${typeLabel}）暂未接入数据`}>
        <Input
          disabled={disabled || readOnly}
          value={value}
          placeholder={placeholder || `请选择${typeLabel}`}
          onChange={(e) => onChange?.(e.target.value)}
          style={style}
        />
      </Tooltip>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        width: '100%',
        minWidth: 0,
        ...style,
      }}
    >
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <PersonOrgField
          browserType={browserType}
          // 单选/多选按类型语义显式传入（PersonOrgPicker 默认多选，不传会全变多选）
          multiple={isBrowserTypeMultiple(browserType)}
          value={value}
          onChange={(v: any) => onChange?.(v)}
          disabled={disabled}
          readonly={readOnly}
          placeholder={placeholder || `请选择${typeLabel}`}
        />
      </div>
      {showTypeTag && (
        <Tag
          color="blue"
          title={`字段类型：${typeLabel}`}
          style={{ margin: 0, flexShrink: 0, fontSize: 11, lineHeight: '16px' }}
        >
          {typeLabel}
        </Tag>
      )}
    </div>
  );
};

export default BrowserControl;
