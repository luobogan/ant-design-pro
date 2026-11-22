import React, { useEffect, useState } from 'react';
import { Button, Select, Space } from 'antd';
import { PersonOrgPicker } from './PersonOrgPicker';
import { resolveItemNames, type PersonOrgCategory } from './personOrg';
import * as matrixApi from '@/pages/System/Matrix/service';

/**
 * 建模权限统一「授权对象」模型。
 *
 * <p>objtype 规范：1角色 2部门 3岗位 4人员 5分部 7矩阵。</p>
 * <p>标准主体统一走 PersonOrgPicker；矩阵暂无通用浏览按钮，沿用矩阵 API 下拉。</p>
 */
export const AUTH_OBJECT_TYPE_OPTIONS = [
  { value: 1, label: '角色' },
  { value: 2, label: '部门' },
  { value: 3, label: '岗位' },
  { value: 4, label: '人员' },
  { value: 5, label: '分部' },
  { value: 7, label: '矩阵' },
];

export const AUTH_OBJECT_CATEGORY: Record<number, PersonOrgCategory> = {
  1: 'role',
  2: 'dept',
  3: 'post',
  4: 'hrm',
  5: 'branch',
};

export const AUTH_OBJECT_PLACEHOLDER: Record<number, string> = {
  1: '选择角色',
  2: '选择部门',
  3: '选择岗位',
  4: '选择人员',
  5: '选择分部',
  7: '选择矩阵',
};

/** 通用授权对象类型下拉（避免各业务页重复写 objtype options） */
export interface AuthObjectTypeSelectProps {
  value?: number | string;
  disabled?: boolean;
  size?: 'small' | 'middle' | 'large';
  style?: React.CSSProperties;
  onChange: (value: number) => void;
}

export const AuthObjectTypeSelect: React.FC<AuthObjectTypeSelectProps> = ({
  value,
  disabled,
  size = 'small',
  style,
  onChange,
}) => (
  <Select
    size={size}
    style={{ width: 120, ...style }}
    value={value == null ? undefined : Number(value)}
    options={AUTH_OBJECT_TYPE_OPTIONS}
    disabled={disabled}
    onChange={(v) => onChange(Number(v))}
  />
);

export interface AuthObjectPickerProps {
  objtype: number | string;
  /** 单选传单个值；多选传数组 */
  value?: number | string | Array<number | string>;
  /** 是否多选授权对象 */
  multiple?: boolean;
  disabled?: boolean;
  placeholder?: string;
  size?: 'small' | 'middle' | 'large';
  style?: React.CSSProperties;
  /** multiple=false 返回单值；multiple=true 返回数组 */
  onChange: (value?: number | number[]) => void;
}

const toIds = (value: AuthObjectPickerProps['value']): number[] => {
  if (value == null || value === '') return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr.map((v) => Number(v)).filter((v) => Number.isFinite(v));
};

const AuthObjectPicker: React.FC<AuthObjectPickerProps> = ({
  objtype,
  value,
  multiple = false,
  disabled,
  placeholder,
  size = 'small',
  style,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const [displayNames, setDisplayNames] = useState<string[]>([]);
  const [matrixOptions, setMatrixOptions] = useState<Array<{ value: number; label: string }>>([]);

  const type = Number(objtype);
  const category = AUTH_OBJECT_CATEGORY[type];
  const isMatrix = type === 7;
  const ids = toIds(value);
  const text = placeholder || AUTH_OBJECT_PLACEHOLDER[type] || '选择授权对象';

  useEffect(() => {
    if (!ids.length || isMatrix || !category) {
      setDisplayNames([]);
      return;
    }
    let cancelled = false;
    resolveItemNames(category, ids.map(String))
      .then((items) => {
        if (cancelled) return;
        setDisplayNames(items.map((i) => String(i.name || i.id)));
      })
      .catch(() => { if (!cancelled) setDisplayNames(ids.map(String)); });
    return () => { cancelled = true; };
  }, [ids.join(','), category, isMatrix]);

  useEffect(() => {
    if (!isMatrix) return;
    let cancelled = false;
    matrixApi.list()
      .then((res: any) => {
        const arr = Array.isArray(res) ? res : res?.data;
        if (!cancelled && Array.isArray(arr)) {
          setMatrixOptions(arr.map((m: any) => ({
            value: Number(m.id),
            label: m.matrixName || m.name || String(m.id),
          })));
        }
      })
      .catch(() => { if (!cancelled) setMatrixOptions([]); });
    return () => { cancelled = true; };
  }, [isMatrix]);

  if (isMatrix) {
    return (
      <Select
        mode={multiple ? 'multiple' : undefined}
        showSearch
        optionFilterProp="label"
        style={{ width: multiple ? 260 : 180, ...style }}
        size={size}
        value={multiple ? ids : (ids[0] ?? undefined)}
        options={matrixOptions}
        placeholder={text}
        disabled={disabled}
        allowClear
        maxTagCount="responsive"
        onChange={(v: any) => {
          if (multiple) {
            const next = (Array.isArray(v) ? v : []).map(Number);
            setDisplayNames(next.map((id) => matrixOptions.find((o) => o.value === id)?.label || String(id)));
            onChange(next);
          } else {
            onChange(v == null ? undefined : Number(v));
          }
        }}
      />
    );
  }

  if (!category) {
    return <span style={{ color: '#999' }}>暂不支持的对象类型</span>;
  }

  const buttonText = displayNames.length
    ? (displayNames.length > 2 ? `已选 ${displayNames.length} 个` : displayNames.join('、'))
    : text;

  return (
    <Space size={4}>
      <Button size={size} disabled={disabled} style={style} onClick={() => setOpen(true)}>
        {buttonText}
      </Button>
      <PersonOrgPicker
        open={open}
        category={category}
        multiple={multiple}
        value={ids.join(',')}
        title={text}
        onCancel={() => setOpen(false)}
        onOk={(selectedIds, items) => {
          setOpen(false);
          const next = (selectedIds || []).filter(Boolean).map(Number);
          setDisplayNames((items || []).map((i) => String(i.name || i.id)));
          if (multiple) onChange(next);
          else onChange(next[0]);
        }}
      />
    </Space>
  );
};

export default AuthObjectPicker;
