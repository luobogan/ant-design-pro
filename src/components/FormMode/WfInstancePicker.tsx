import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, Modal, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { getInstance, instancePicker } from '@/services/workflow';

/**
 * 「相关流程」浏览按钮（ecology 30 流程 / 31 多流程 / 32 归档流程）的运行时选择器。
 *
 * <p>值格式沿用 E9 数据格式：**id 逗号串**。数据源为 {@code GET /instance/picker}
 * （与「我的请求」同源，但不按发起人收口 → 全部可见实例）。</p>
 */

/** 实例 id → 标题 缓存（跨字段共享，避免重复请求） */
const titleCache = new Map<string, string>();

/** 兼容 R 包装：取 data；若已是裸对象则原样返回 */
const unwrap = (res: any): any => (res && res.data !== undefined ? res.data : res) || {};

/** 值（id 逗号串）→ id 数组 */
const splitIds = (v: any): string[] =>
  String(v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * 解析实例 id → 标题（用于字段回显 / 只读展示）。
 * 已解析过的 id 走缓存；取不到时降级显示 id，保证字段不会「看起来是空的」。
 */
export async function resolveInstanceNames(ids: string[]): Promise<{ id: string; name: string }[]> {
  const miss = Array.from(new Set(ids.filter((id) => id && !titleCache.has(id))));
  await Promise.all(
    miss.map(async (id) => {
      try {
        const d = unwrap(await getInstance(id));
        titleCache.set(id, d?.title || d?.processTitle || id);
      } catch {
        titleCache.set(id, id);
      }
    }),
  );
  return ids.map((id) => ({ id, name: titleCache.get(id) || id }));
}

export interface WfInstanceFieldProps {
  /** 是否多选（按浏览按钮类型语义由 BrowserControl 传入） */
  multiple?: boolean;
  value?: any;
  onChange?: (v: any) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  /** 排除的实例ID（当前实例自身，避免把自己关联给自己） */
  excludeId?: string;
}

/** 「相关流程」字段控件：只读展示已选标题，点击弹出实例选择器 */
export const WfInstanceField: React.FC<WfInstanceFieldProps> = ({
  multiple = false,
  value,
  onChange,
  disabled,
  readOnly,
  placeholder,
  excludeId,
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
    resolveInstanceNames(ids).then((r) => {
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
        placeholder={placeholder || '请选择相关流程'}
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
        <WfInstancePickerModal
          multiple={multiple}
          excludeId={excludeId}
          initialIds={ids}
          onCancel={() => setOpen(false)}
          onOk={(picked) => {
            // 选中即入缓存，避免关闭后再逐个回查标题
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

/** 实例选择弹窗：关键字检索 + 分页 + 单/多选 */
const WfInstancePickerModal: React.FC<{
  multiple?: boolean;
  excludeId?: string;
  initialIds?: string[];
  onOk: (items: PickedItem[]) => void;
  onCancel: () => void;
}> = ({ multiple = false, excludeId, initialIds = [], onOk, onCancel }) => {
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
        const res: any = await instancePicker({
          current: page,
          pageSize: 20,
          keyword: kw || undefined,
          excludeId,
        });
        const data = unwrap(res);
        const list: any[] = data?.records || [];
        setRows(list);
        setTotal(Number(data?.total) || 0);
        // 列表里已带标题，顺手缓存，回显时免回查
        list.forEach((r) => {
          const id = String(r?.id ?? '');
          if (id) titleCache.set(id, r?.title || id);
        });
      } finally {
        setLoading(false);
      }
    },
    [excludeId],
  );

  useEffect(() => {
    load('', 1);
  }, [load]);

  // 打开时把已有值回显为已选
  const initialKey = initialIds.join(',');
  useEffect(() => {
    let alive = true;
    if (!initialIds.length) return;
    resolveInstanceNames(initialIds).then((r) => {
      if (alive) setSelected(r);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey]);

  const columns: ColumnsType<any> = [
    {
      title: '流程标题',
      dataIndex: 'title',
      render: (t: any, r: any) => t || String(r?.id ?? ''),
    },
    { title: '状态', dataIndex: 'status', width: 100 },
    { title: '发起时间', dataIndex: 'startTime', width: 180 },
  ];

  return (
    <Modal open title="选择相关流程" width={800} onCancel={onCancel} onOk={() => onOk(selected)}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Input.Search
          placeholder="按流程标题搜索"
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
              setSelected(
                multiple ? [...selected.filter((s) => s.id !== item.id), item] : [item],
              );
            },
          })}
        />
      </Space>
    </Modal>
  );
};

export default WfInstanceField;
