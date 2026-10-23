import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Popconfirm, Table, message } from 'antd';
import { listRecycle, restoreDoc, purgeDoc, type DocRecycleItem } from '@/services/doc';
import CategoryTree, { syncCatToUrl } from '../components/CategoryTree';

/**
 * 内容引擎 - 回收站页（菜单 code=docengine_recycle, path=/docengine/recycle）。
 * 后端 @PreAuth(HAS_ROLE_DOC) 门禁（修 DET-P0-1）。
 */
const DocRecycle: React.FC = () => {
  const [list, setList] = useState<DocRecycleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [secCategoryId, setSecCategoryId] = useState<number | string | undefined>(
    () => new URLSearchParams(window.location.search).get('cat') || undefined,
  );

  const reload = useCallback(async (catId = secCategoryId) => {
    setLoading(true);
    try {
      setList(await listRecycle(catId));
    } catch (e: any) {
      message.error(e?.msg || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [secCategoryId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const onTreeSelect = (id?: number | string) => {
    setSecCategoryId(id);
    syncCatToUrl(id);
    reload(id);
  };

  const columns = [
    { title: '文档ID', dataIndex: 'docId' },
    { title: '删除人', dataIndex: 'deleteUser' },
    { title: '删除时间', dataIndex: 'deleteTime' },
    {
      title: '操作',
      width: 180,
      render: (_: any, r: DocRecycleItem) => (
        <>
          <Popconfirm
            title="确认恢复该文档？"
            onConfirm={async () => {
              try {
                await restoreDoc(r.docId as number | string);
                message.success('已恢复');
                reload();
              } catch (e: any) {
                message.error(e?.msg || '失败');
              }
            }}
          >
            <Button type="link" size="small">
              恢复
            </Button>
          </Popconfirm>
          <Popconfirm
            title="彻底删除不可恢复，确认？"
            onConfirm={async () => {
              try {
                await purgeDoc(r.docId as number | string);
                message.success('已彻底删除');
                reload();
              } catch (e: any) {
                message.error(e?.msg || '失败');
              }
            }}
          >
            <Button type="link" size="small" danger>
              彻底删除
            </Button>
          </Popconfirm>
        </>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <Card size="small" title="目录" style={{ width: 240, flex: '0 0 240px' }}>
        <CategoryTree selectedId={secCategoryId} onSelect={onTreeSelect} height={520} />
      </Card>
      <div style={{ flex: 1 }}>
        <Table rowKey="id" loading={loading} dataSource={list} columns={columns} />
      </div>
    </div>
  );
};

export default DocRecycle;
