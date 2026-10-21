import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, Modal, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { odocApi } from '@/services/workflow';

/**
 * 「相关文档」浏览按钮（ecology 24 文档 / 26 多文档）的运行时选择器。
 *
 * <p>值格式沿用 E9 数据格式：**id 逗号串**。数据源为 {@code GET /odoc/doc/picker}
 * （公文正文文档，按标题关键字检索；本工程文档存储即 odoc 公文正文）。</p>
 */

/** 文档 id → 标题 缓存（跨字段共享，避免重复请求） */
const titleCache = new Map<string, string>();

/** 兼容 R 包装：取 data；若已是裸对象则原样返回 */
const unwrap = (res: any): any => (res && res.data !== undefined ? res.data : res) || {};

/** 值（id 逗号串）→ id 数组 */
const splitIds = (v: any): string[] =>
  String(v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/** 解析文档 id → 标题（用于字段回显 / 只读展示）；取不到降级显示 id */
export async function resolveDocNames(ids: string[]): Promise<{ id: string; name: string }[]> {
  const miss = Array.from(new Set(ids.filter((id) => id && !titleCache.has(id))));
  await Promise.all(
    miss.map(async (id) => {
      try {
        const d = unwrap(await odocApi.getDoc(id));
        titleCache.set(id, d?.title || id);
      } catch {
        titleCache.set(id, id);
      }
    }),
  );
  return ids.map((id) => ({ id, name: titleCache.get(id) || id }));
}

export interface OdocDocFieldProps {
  multiple?: boolean;
  value?: any;
  onChange?: (v: any) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  /** 排除的所属实例ID（当前实例自身，避免把本文档关联给自己） */
  excludeInstanceId?: string;
}

/** 「相关文档」字段控件：只读展示已选标题，点击弹出文档选择器 */
export const OdocDocField: React.FC<OdocDocFieldProps> = ({
  multiple = false,
  value,
  onChange,
  disabled,
  readOnly,
  placeholder,
  excludeInstanceId,
}) => {
  const ids = useMemo(() => splitIds(value), [value]);
  const idsKey = ids.join(',');
  const [names, setNames] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!ids.length) {
      setNames([]);
      return;
    }
    resolveDocNames(ids).then((r) => {
      if (alive) setNames(r);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const display = names.map((n) => n.name).join('、');
  const locked = disabled || readOnly;

  return (
    <>
      <Input
        readOnly
        value={display}
        placeholder={placeholder || '请选择相关文档'}
        disabled={disabled}
        onClick={() => !locked && setOpen(true)}
        style={{ cursor: locked ? 'not-allowed' : 'pointer' }}
        suffix={
          locked ? undefined : (
            <Button
              type="link"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(true);
              }}
              style={{ padding: 0 }}
            >
              选择
            </Button>
          )
        }
      />
      {open && (
        <OdocDocPickerModal
          multiple={multiple}
          excludeInstanceId={excludeInstanceId}
          initialIds={ids}
          onCancel={() => setOpen(false)}
          onOk={(picked) => {
            picked.forEach((p) => titleCache.set(p.id, p.name));
            onChange?.(picked.map((p) => p.id).join(','));
            setOpen(false);
          }}
        />
      )}
    </>
  );
};

interface PickedItem {
  id: string;
  name: string;
}

/** 文档选择弹窗：关键字检索 + 分页 + 单/多选 */
const OdocDocPickerModal: React.FC<{
  multiple?: boolean;
  excludeInstanceId?: string;
  initialIds?: string[];
  onOk: (items: PickedItem[]) => void;
  onCancel: () => void;
}> = ({ multiple = false, excludeInstanceId, initialIds = [], onOk, onCancel }) => {
  const [keyword, setKeyword] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PickedItem[]>([]);

  const load = useCallback(
    async (kw: string, page: number) => {
      setLoading(true);
      try {
        const res: any = await odocApi.picker({
          current: page,
          pageSize: 20,
          keyword: kw || undefined,
          excludeInstanceId,
        });
        const data = unwrap(res);
        const list: any[] = data?.records || [];
        setRows(list);
        setTotal(Number(data?.total) || 0);
        list.forEach((r) => {
          const id = String(r?.id ?? '');
          if (id) titleCache.set(id, r?.title || id);
        });
      } finally {
        setLoading(false);
      }
    },
    [excludeInstanceId],
  );

  useEffect(() => {
    load('', 1);
  }, [load]);

  const initialKey = initialIds.join(',');
  useEffect(() => {
    let alive = true;
    if (!initialIds.length) return;
    resolveDocNames(initialIds).then((r) => {
      if (alive) setSelected(r);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey]);

  const columns: ColumnsType<any> = [
    {
      title: '文档标题',
      dataIndex: 'title',
      render: (t: any, r: any) => t || String(r?.id ?? ''),
    },
    { title: '所属实例', dataIndex: 'instanceId', width: 180 },
    { title: '状态', dataIndex: 'docStatus', width: 100, render: (v: any) => (v === 1 ? '正式' : v === 9 ? '草稿' : v ?? '-') },
  ];

  return (
    <Modal open title="选择相关文档" width={800} onCancel={onCancel} onOk={() => onOk(selected)}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Input.Search
          placeholder="按文档标题搜索"
          allowClear
          enterButton
          onSearch={(v) => {
            setKeyword(v);
            setCurrent(1);
            load(v, 1);
          }}
        />
        {selected.length > 0 && (
          <div>
            已选：
            {selected.map((s) => (
              <Tag
                key={s.id}
                closable
                onClose={() => setSelected(selected.filter((x) => x.id !== s.id))}
              >
                {s.name}
              </Tag>
            ))}
          </div>
        )}
        <Table
          rowKey={(r) => String(r?.id)}
          size="small"
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={{
            current,
            pageSize: 20,
            total,
            onChange: (p) => {
              setCurrent(p);
              load(keyword, p);
            },
          }}
          rowSelection={{
            type: multiple ? 'checkbox' : 'radio',
            selectedRowKeys: selected.map((s) => s.id),
            onChange: (_keys, selRows) => {
              setSelected(
                (selRows as any[]).map((r) => ({
                  id: String(r?.id),
                  name: r?.title || String(r?.id),
                })),
              );
            },
          }}
          onRow={(r) => ({
            onClick: () => {
              const item: PickedItem = { id: String(r?.id), name: r?.title || String(r?.id) };
              setSelected(multiple ? [...selected.filter((s) => s.id !== item.id), item] : [item]);
            },
          })}
        />
      </Space>
    </Modal>
  );
};

export default OdocDocField;
