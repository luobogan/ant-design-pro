import React, { useEffect, useMemo, useState } from 'react';
import { Select, Spin } from 'antd';
import type { SelectProps } from 'antd/es/select';
import {
  BROWSER_TYPE_META,
  PersonOrgItem,
  itemsOfCategory,
  loadPersonOrgData,
} from './personOrg';

interface BrowserSelectProps extends Omit<SelectProps<any>, 'onSearch' | 'onChange'> {
  /** 浏览框类型（对应泛微的 browserType，E9 35+ 编号空间） */
  browserType: number;
  /** 值（单选取 id 字符串，多选为 id 数组） */
  value?: any;
  /** 值变化回调 */
  onChange?: (value: any) => void;
  /** 是否多选（不传则按类型元信息，E9 浏览按钮默认多选） */
  multiple?: boolean;
  /** 占位符 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 浏览框下拉选择组件（Select 形态；弹窗形态见 {@link PersonOrgPicker}）。
 *
 * 数据源已接入统一「人员与组织」数据层（blade-system 真实数据，本地检索），
 * 覆盖：人员(1/161/166/167/168)、部门(2/17/19/20)、分部(18/21/22/23)、角色(3/163)、岗位(4)。
 * 其余 ecology 浏览按钮类型（资产/客户/文档等）暂未实现，会给出提示。
 */
const BrowserSelect: React.FC<BrowserSelectProps> = ({
  browserType,
  value,
  onChange,
  multiple,
  placeholder = '请选择',
  disabled = false,
  ...restProps
}) => {
  const meta = BROWSER_TYPE_META[browserType];
  const [items, setItems] = useState<PersonOrgItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    if (!meta) {
      setItems([]);
      return;
    }
    let alive = true;
    setLoading(true);
    loadPersonOrgData()
      .then((data) => {
        if (!alive) return;
        setItems(itemsOfCategory(data, meta.category));
      })
      .catch(() => alive && setItems([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [browserType]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(kw) ||
        (i.code || '').toLowerCase().includes(kw) ||
        (i.desc || '').toLowerCase().includes(kw),
    );
  }, [items, keyword]);

  if (!meta) {
    return <Select disabled placeholder="该浏览框类型暂未实现" />;
  }

  return (
    <Select
      value={value}
      onChange={onChange}
      mode={multiple ?? meta.multiple ? 'multiple' : undefined}
      placeholder={placeholder}
      disabled={disabled}
      showSearch
      filterOption={false}
      onSearch={setKeyword}
      notFoundContent={loading ? <Spin size="small" /> : '暂无数据'}
      options={filtered.map((i) => ({
        value: i.id,
        label: i.name,
        title: i.desc ? `${i.name}（${i.desc}）` : i.name,
      }))}
      {...restProps}
    />
  );
};

export default BrowserSelect;
