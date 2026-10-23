import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Input, Modal, Table, Tag, Upload, message } from 'antd';
import { history } from 'umi';
import { searchDocPage, publishDoc, invalidateDoc, archiveDoc, reopenDoc, voidDoc, getDocContent, saveDocContent, checkOutDoc, checkInDoc, listAttachment, uploadAttachment, deleteAttachment, type DocDetail } from '@/services/doc';
import CategoryTree, { syncCatToUrl } from '../components/CategoryTree';

/**
 * 内容引擎 - 文档检索页（菜单 code=docengine_search, path=/docengine/search）。
 * 分页 + 标题关键字；DataScope 分部隔离后端兜底。
 */
const DocSearch: React.FC = () => {
  const [list, setList] = useState<DocDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [size, setSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [secCategoryId, setSecCategoryId] = useState<number | string | undefined>(
    () => new URLSearchParams(window.location.search).get('cat') || undefined,
  );
  const [contentOpen, setContentOpen] = useState(false);
  const [contentId, setContentId] = useState<number | string | undefined>();
  const [contentText, setContentText] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachDocId, setAttachDocId] = useState<number | string | undefined>();
  const [attaches, setAttaches] = useState<any[]>([]);

  const load = useCallback(
    async (page = current, ps = size, kw = keyword, catId = secCategoryId) => {
      setLoading(true);
      try {
        const { list: l, total: t } = await searchDocPage({
          current: page,
          size: ps,
          keyword: kw || undefined,
          secCategoryId: catId,
        });
        setList(l || []);
        setTotal(t || 0);
      } catch (e: any) {
        message.error(e?.msg || '加载失败');
      } finally {
        setLoading(false);
      }
    },
    [current, size, keyword, secCategoryId],
  );

  // 打开页面即加载第一页（此前只有点「搜索」才查，导致初始空列表）
  useEffect(() => {
    load(1, size, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearch = () => {
    setCurrent(1);
    load(1, size, keyword);
  };

  const onAction = async (action: string, id: number | string, label: string) => {
    try {
      if (action === 'publish') await publishDoc(id);
      else if (action === 'invalidate') await invalidateDoc(id);
      else if (action === 'archive') await archiveDoc(id);
      else if (action === 'reopen') await reopenDoc(id);
      else if (action === 'void') await voidDoc(id);
      message.success(`${label}成功`);
      load(current, size, keyword);
    } catch (e: any) {
      message.error(e?.msg || `${label}失败`);
    }
  };

  const openContent = async (id: number | string) => {
    try {
      const c = await getDocContent(id);
      setContentId(id);
      setContentText(c || '');
      setContentOpen(true);
    } catch (e: any) {
      message.error(e?.msg || '正文加载失败');
    }
  };

  const onSaveContent = async () => {
    if (!contentId) return;
    try {
      await saveDocContent(contentId, contentText);
      message.success('正文保存成功');
      setContentOpen(false);
    } catch (e: any) {
      message.error(e?.msg || '正文保存失败');
    }
  };

  const onCheckOut = async (id: number | string, label: string) => {
    try {
      await checkOutDoc(id);
      message.success(`${label}成功`);
      load(current, size, keyword);
    } catch (e: any) {
      message.error(e?.msg || `${label}失败`);
    }
  };

  const onCheckIn = async (id: number | string, label: string) => {
    try {
      await checkInDoc(id);
      message.success(`${label}成功`);
      load(current, size, keyword);
    } catch (e: any) {
      message.error(e?.msg || `${label}失败`);
    }
  };

  const openAttach = async (id: number | string) => {
    try {
      setAttachDocId(id);
      setAttaches(await listAttachment(id));
      setAttachOpen(true);
    } catch (e: any) {
      message.error(e?.msg || '附件加载失败');
    }
  };

  const onUploadAttach = async (file: File) => {
    if (!attachDocId) return false;
    try {
      await uploadAttachment(attachDocId, file, 2);
      message.success('上传成功');
      setAttaches(await listAttachment(attachDocId));
    } catch (e: any) {
      message.error(e?.msg || '上传失败');
    }
    return false; // 阻止 antd 默认上传行为
  };

  const onDeleteAttach = async (id: number | string) => {
    try {
      await deleteAttachment(id);
      message.success('删除成功');
      if (attachDocId) setAttaches(await listAttachment(attachDocId));
    } catch (e: any) {
      message.error(e?.msg || '删除失败');
    }
  };

  const statusMap: Record<number, { t: string; c?: string }> = {
    0: { t: '草稿' },
    1: { t: '生效', c: 'green' },
    2: { t: '生效', c: 'green' },
    3: { t: '审批中', c: 'blue' },
    5: { t: '归档' },
    6: { t: '待发布', c: 'orange' },
    7: { t: '失效', c: 'red' },
    9: { t: '流程草稿' },
  };

  const columns = [
    { title: '标题', dataIndex: 'docSubject' },
    {
      title: '状态',
      dataIndex: 'docStatus',
      render: (v: number) => {
        const s = statusMap[v] || { t: String(v) };
        return <Tag color={s.c}>{s.t}</Tag>;
      },
    },
    { title: '版次', dataIndex: 'docEdition' },
    { title: '创建人', dataIndex: 'createUser' },
    { title: '创建时间', dataIndex: 'createTime' },
    {
      title: '操作',
      key: 'op',
      render: (_: any, row: DocDetail) => {
        const s = row.docStatus ?? 0;
        const id = row.id!;
        return (
          <span>
            {[0, 1, 2, 4, 6].includes(s) && (
              <Button size="small" type="link" onClick={() => onAction('publish', id, '发布')}>发布</Button>
            )}
            {[1, 2, 5].includes(s) && (
              <Button size="small" type="link" onClick={() => onAction('invalidate', id, '失效')}>失效</Button>
            )}
            {[1, 2, 7].includes(s) && (
              <Button size="small" type="link" onClick={() => onAction('archive', id, '归档')}>归档</Button>
            )}
            {[5, 7, 8].includes(s) && (
              <Button size="small" type="link" onClick={() => onAction('reopen', id, '重新打开')}>重新打开</Button>
            )}
            {[0, 1, 2, 4, 6].includes(s) && (
              <Button size="small" type="link" danger onClick={() => onAction('void', id, '作废')}>作废</Button>
            )}
            <Button size="small" type="link" onClick={() => history.push(`/docengine/detail?docId=${id}`)}>详情</Button>
            <Button size="small" type="link" onClick={() => openContent(id)}>正文</Button>
            <Button size="small" type="link" onClick={() => openAttach(id)}>附件</Button>
            {row.checkOutStatus === 1 ? (
              <Button size="small" type="link" onClick={() => onCheckIn(id, '签入')}>签入</Button>
            ) : (
              <Button size="small" type="link" onClick={() => onCheckOut(id, '签出')}>签出</Button>
            )}
          </span>
        );
      },
    },
  ];

  const onTreeSelect = (id?: number | string) => {
    setSecCategoryId(id);
    setCurrent(1);
    syncCatToUrl(id);
    load(1, size, keyword, id);
  };

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <Card size="small" title="目录" style={{ width: 240, flex: '0 0 240px' }}>
        <CategoryTree selectedId={secCategoryId} onSelect={onTreeSelect} height={520} />
      </Card>
      <Card style={{ flex: 1 }}>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Input
          placeholder="标题关键字"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={onSearch}
          style={{ width: 240 }}
          allowClear
        />
        <Button type="primary" onClick={onSearch}>
          搜索
        </Button>
      </div>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={list}
        columns={columns}
        pagination={{
          current,
          pageSize: size,
          total,
          showSizeChanger: true,
          onChange: (p, ps) => {
            setCurrent(p);
            setSize(ps);
            load(p, ps, keyword);
          },
        }}
      />

      <Modal
        open={contentOpen}
        title="文档正文"
        onCancel={() => setContentOpen(false)}
        onOk={onSaveContent}
        width={720}
        destroyOnClose
      >
        <Input.TextArea
          rows={14}
          value={contentText}
          onChange={(e) => setContentText(e.target.value)}
          placeholder="正文 HTML 内容"
        />
      </Modal>

      <Modal
        open={attachOpen}
        title="文档附件"
        onCancel={() => setAttachOpen(false)}
        footer={null}
        width={720}
        destroyOnClose
      >
        <Upload beforeUpload={onUploadAttach} showUploadList={false}>
          <Button style={{ marginBottom: 12 }}>上传附件</Button>
        </Upload>
        <Table
          rowKey="id"
          size="small"
          dataSource={attaches}
          pagination={false}
          columns={[
            { title: '文件名', dataIndex: 'fileName' },
            { title: '大小(字节)', dataIndex: 'fileSize' },
            {
              title: '操作', key: 'op',
              render: (_: any, r: any) => (
                <Button size="small" type="link" danger onClick={() => onDeleteAttach(r.id)}>删除</Button>
              ),
            },
          ]}
        />
      </Modal>
    </Card>
    </div>
  );
};

export default DocSearch;
