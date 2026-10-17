import React, { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Empty, Input, Modal, Radio, Spin, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { numberApi, odocDictApi } from '@/services/workflow';
import { BROWSER_TYPE_META } from './personOrg';

interface BrowseItem {
  id: string;
  name: string;
  code?: string;
}

/**
 * 公文「字典 / 文号」浏览按钮字段（对齐 E9 浏览按钮，数据源为公文字典/文号规则）。
 *
 * 覆盖 browserType：260 秘密等级 / 261 紧急程度 / 262 公文类型 / 263 主题分类（按 dictType 取
 * `wf_odoc_dict`）、264 发文字号（取 `wf_odoc_number` 文号规则）。
 *
 * 值格式：存**名称**（秘密/紧急的 code=中文名，与 checkSecretLevel 按名判密级、镜像 urgency 兼容）；
 * 多选用逗号串。人员/组织类（258/259 等）仍走 PersonOrgField，不在此组件。
 */
export const DictNumberField: React.FC<{
  browserType: number;
  value?: string;
  onChange: (v: string) => void;
  multiple?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  /** 是否显示右侧类型 Tag（默认显示） */
  showTypeTag?: boolean;
}> = ({
  browserType,
  value,
  onChange,
  multiple,
  disabled,
  readOnly,
  placeholder,
  showTypeTag = true,
}) => {
  const meta = BROWSER_TYPE_META[browserType];
  const [open, setOpen] = useState(false);
  const label = meta?.label || '浏览';
  const names = value ? value.split(',').filter(Boolean) : [];
  const inactive = disabled || readOnly;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', minWidth: 0 }}>
      <div
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          padding: '4px 8px',
          minHeight: 30,
          lineHeight: '20px',
          background: inactive ? '#f5f5f5' : '#fff',
          color: names.length ? undefined : '#bfbfbf',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={names.join('，')}
      >
        {names.length ? names.join('，') : placeholder || `请选择${label}`}
      </div>
      <Button size="small" disabled={inactive} onClick={() => setOpen(true)}>
        浏览…
      </Button>
      {showTypeTag && (
        <Tag color="blue" title={`字段类型：${label}`} style={{ margin: 0, flexShrink: 0, fontSize: 11 }}>
          {label}
        </Tag>
      )}
      {open && (
        <DictNumberPicker
          browserType={browserType}
          multiple={multiple}
          value={value}
          onOk={(v) => {
            onChange(v);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </div>
  );
};

const DictNumberPicker: React.FC<{
  browserType: number;
  multiple?: boolean;
  value?: string;
  onOk: (v: string) => void;
  onCancel: () => void;
}> = ({ browserType, multiple, value, onOk, onCancel }) => {
  const meta = BROWSER_TYPE_META[browserType];
  const isNumber = meta?.browse === 'number';
  const label = meta?.label || '浏览';
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<BrowseItem[]>([]);
  const [kw, setKw] = useState('');
  const [sel, setSel] = useState<string[]>(value ? value.split(',').filter(Boolean) : []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const req = isNumber ? numberApi.rules() : odocDictApi.list(meta?.dictType || '');
    Promise.resolve(req)
      .then((res: any) => {
        if (!alive) return;
        const data = res?.data || [];
        const list: BrowseItem[] = isNumber
          ? data.map((n: any) => ({ id: String(n.id), name: n.typeName || String(n.id), code: n.prefix }))
          : data.map((d: any) => ({ id: String(d.id), name: d.name || String(d.id), code: d.code }));
        setItems(list);
      })
      .catch(() => {
        /* 加载失败留空 */
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [isNumber, meta?.dictType]);

  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase();
    if (!k) return items;
    return items.filter(
      (i) => i.name.toLowerCase().includes(k) || (i.code || '').toLowerCase().includes(k),
    );
  }, [items, kw]);

  const renderLabel = (i: BrowseItem) =>
    i.code && i.code !== i.name ? `${i.name}（${i.code}）` : i.name;

  return (
    <Modal
      title={`选择${label}`}
      open
      onOk={() => onOk(sel.join(','))}
      onCancel={onCancel}
      width={520}
      okButtonDisabled={sel.length === 0}
    >
      <Input
        prefix={<SearchOutlined />}
        placeholder={`搜索${label}`}
        value={kw}
        onChange={(e) => setKw(e.target.value)}
        allowClear
        style={{ marginBottom: 8 }}
      />
      <Spin spinning={loading}>
        <div style={{ maxHeight: 360, overflow: 'auto' }}>
          {filtered.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
          ) : multiple ? (
            <Checkbox.Group
              style={{ width: '100%' }}
              value={sel}
              onChange={(v) => setSel(v as string[])}
            >
              {filtered.map((i) => (
                <div key={i.id} style={{ padding: '4px 0' }}>
                  <Checkbox value={i.name}>{renderLabel(i)}</Checkbox>
                </div>
              ))}
            </Checkbox.Group>
          ) : (
            <Radio.Group style={{ width: '100%' }} value={sel[0]} onChange={(e) => setSel([e.target.value])}>
              {filtered.map((i) => (
                <div key={i.id} style={{ padding: '4px 0' }}>
                  <Radio value={i.name}>{renderLabel(i)}</Radio>
                </div>
              ))}
            </Radio.Group>
          )}
        </div>
      </Spin>
    </Modal>
  );
};

export default DictNumberField;
