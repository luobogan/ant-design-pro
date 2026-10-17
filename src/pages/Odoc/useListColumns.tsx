import React, { useEffect, useState } from 'react';
import { Button, Checkbox, Dropdown, message } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { odocListSetApi } from '@/services/workflow';

/**
 * 公文列表列显隐 hook（对应 E9 列表设置）。
 *
 * 按列表编码从后端加载「隐藏列 key」，据此过滤列；右上角「列设置」气泡可勾选显隐并落库。
 * 加载完成前显示全部列（避免闪空）；保存失败仅提示、不影响当前勾选状态。
 */
export function useOdocListColumns(listCode: string, columns: any[]) {
  const [hidden, setHidden] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    odocListSetApi
      .get(listCode)
      .then((res) => {
        if (!alive) return;
        const keys = res?.data?.hiddenKeys;
        setHidden(keys ? String(keys).split(',').map((s) => s.trim()).filter(Boolean) : []);
      })
      .catch(() => {
        /* 列设置加载失败用默认全显 */
      })
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [listCode]);

  const persist = (next: string[]) => {
    setHidden(next);
    odocListSetApi.save({ listCode, hiddenKeys: next.join(',') }).catch((e: any) =>
      message.error(e?.msg || '列设置保存失败'),
    );
  };

  const visibleKeys = columns.filter((c) => !hidden.includes(String(c.key))).map((c) => String(c.key));
  const visibleColumns = loaded ? columns.filter((c) => !hidden.includes(String(c.key))) : columns;

  const overlay = (
    <div
      style={{
        background: '#fff',
        padding: 12,
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,.15)',
        maxWidth: 260,
      }}
    >
      <div style={{ marginBottom: 8, color: '#999', fontSize: 12 }}>列显隐（取消勾选即隐藏）</div>
      <Checkbox.Group
        style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
        value={visibleKeys}
        onChange={(vals) =>
          persist(columns.filter((c) => !(vals as string[]).includes(String(c.key))).map((c) => String(c.key)))
        }
      >
        {columns.map((c) => (
          <Checkbox key={String(c.key)} value={String(c.key)}>
            {c.title}
          </Checkbox>
        ))}
      </Checkbox.Group>
    </div>
  );

  const settingNode = (
    <Dropdown overlay={overlay} trigger={['click']} placement="bottomRight">
      <Button icon={<SettingOutlined />} size="small">
        列设置
      </Button>
    </Dropdown>
  );

  return { visibleColumns, settingNode };
}
