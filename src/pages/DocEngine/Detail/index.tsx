import React, { useCallback, useEffect, useState } from 'react';
import { history, useLocation } from 'umi';
import { Button, Card, Descriptions, Input, List, Select, Space, Table, Tabs, Tag, Upload, message } from 'antd';
import {
  getDocDetail, getDocContent, saveDocContent,
  listAttachment, uploadAttachment, deleteAttachment, listVersions,
  publishDoc, invalidateDoc, archiveDoc, reopenDoc, voidDoc,
  checkOutDoc, checkInDoc, forceCheckInDoc,
  listReply, saveReply, deleteReply, praiseInfo, togglePraise, scoreInfo, saveScore,
  type DocDetail,
} from '@/services/doc';
import RichTextEditor from '@/components/RichTextEditor';

/**
 * 内容引擎 - 文档详情页（菜单 path=/docengine/detail，经 ?docId= 进入）。
 * 把「基本信息 / 正文 / 附件 / 版本 / 操作(生命周期+签出签入)」收敛到一个 Tab 页，
 * 避免把这些操作继续堆在检索页行内。
 */
const statusMap: Record<number, { t: string; c?: string }> = {
  0: { t: '草稿' }, 1: { t: '生效', c: 'green' }, 2: { t: '生效', c: 'green' },
  3: { t: '审批中', c: 'blue' }, 4: { t: '退回', c: 'orange' }, 5: { t: '归档' },
  6: { t: '待发布', c: 'orange' }, 7: { t: '失效', c: 'red' }, 8: { t: '作废', c: 'red' },
  9: { t: '流程草稿' },
};

const DocDetailPage: React.FC = () => {
  const location = useLocation();
  const docId = new URLSearchParams(location.search).get('docId') || undefined;

  const [detail, setDetail] = useState<DocDetail | null>(null);
  const [content, setContent] = useState('');
  const [attaches, setAttaches] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [replies, setReplies] = useState<any[]>([]);
  const [praise, setPraise] = useState<{ count?: number; praised?: boolean }>({});
  const [score, setScore] = useState<{ avg?: number; count?: number; myScore?: number | null }>({});
  const [replyText, setReplyText] = useState('');
  const [myScore, setMyScore] = useState<number | undefined>();

  const loadAll = useCallback(async (id?: string) => {
    if (!id) return;
    try {
      const [d, c, a, v, rp, pi, si] = await Promise.all([
        getDocDetail(id), getDocContent(id), listAttachment(id), listVersions(id),
        listReply(id), praiseInfo(id), scoreInfo(id),
      ]);
      setDetail(d); setContent(c || ''); setAttaches(a); setVersions(v);
      setReplies(rp); setPraise(pi); setScore(si); setMyScore(si?.myScore ?? undefined);
    } catch (e: any) {
      message.error(e?.msg || '加载失败');
    }
  }, []);

  useEffect(() => { loadAll(docId); }, [docId, loadAll]);

  const run = async (fn: () => Promise<any>, ok: string) => {
    try { await fn(); message.success(`${ok}成功`); loadAll(docId); }
    catch (e: any) { message.error(e?.msg || `${ok}失败`); }
  };

  const onSaveContent = () => docId ? run(() => saveDocContent(docId, content), '正文保存') : undefined;
  const onUpload = async (file: File) => {
    if (docId) {
      try { await uploadAttachment(docId, file, 2); message.success('上传成功'); loadAll(docId); }
      catch (e: any) { message.error(e?.msg || '上传失败'); }
    }
    return false;
  };
  const onDelAttach = (id: any) => run(() => deleteAttachment(id), '附件删除');

  const onSendReply = async () => {
    if (!docId || !replyText.trim()) return;
    try {
      await saveReply(docId, replyText.trim());
      setReplyText('');
      message.success('回复成功');
      loadAll(docId);
    } catch (e: any) {
      message.error(e?.msg || '回复失败');
    }
  };

  const onDelReply = (id: any) => run(() => deleteReply(id), '回复删除');

  const onTogglePraise = async () => {
    if (!docId) return;
    try {
      const now = await togglePraise(docId);
      message.success(now ? '已点赞' : '已取消赞');
      setPraise(await praiseInfo(docId));
    } catch (e: any) {
      message.error(e?.msg || '操作失败');
    }
  };

  const onSubmitScore = async () => {
    if (!docId || !myScore) return;
    try {
      await saveScore(docId, myScore);
      message.success('评分成功');
      setScore(await scoreInfo(docId));
    } catch (e: any) {
      message.error(e?.msg || '评分失败');
    }
  };

  if (!docId) {
    return <Card>请在「文档检索」页点击某条文档的「详情」进入本页。</Card>;
  }

  const s = detail?.docStatus ?? 0;

  return (
    <Card title={detail?.docSubject || '文档详情'}>
      {detail && (
        <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="文档ID">{String(detail.id)}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusMap[s]?.c}>{statusMap[s]?.t ?? s}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="版次">{String(detail.docEdition ?? '-')}</Descriptions.Item>
          <Descriptions.Item label="签出状态">
            {detail.checkOutStatus === 1 ? '已签出' : '未签出'}
          </Descriptions.Item>
          <Descriptions.Item label="创建人">{String(detail.createUser ?? '-')}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{detail.createTime || '-'}</Descriptions.Item>
        </Descriptions>
      )}

      <Tabs
        items={[
          {
            key: 'content', label: '正文',
            children: (
              <>
                <RichTextEditor value={content} onChange={setContent} height={360} placeholder="请输入正文..." docId={docId} />
                <Button type="primary" style={{ marginTop: 8 }} onClick={onSaveContent}>保存正文</Button>
              </>
            ),
          },
          {
            key: 'attach', label: '附件',
            children: (
              <>
                <Upload beforeUpload={onUpload} showUploadList={false}>
                  <Button style={{ marginBottom: 12 }}>上传附件</Button>
                </Upload>
                <Table rowKey="id" size="small" dataSource={attaches} pagination={false}
                  columns={[
                    { title: '文件名', dataIndex: 'fileName' },
                    {
                      title: '版本', key: 'ver', width: 90,
                      render: (_: any, r: any) => {
                        // 上传的附件无版本链(versionId 为空)；WPS 在线编辑保存产生 versionId 递增的版本流水
                        if (r.versionId == null) {
                          return <Tag color="blue">附件</Tag>;
                        }
                        // 版本流水号：比当前 versionId 小的个数 + 1（v1 最早 → vN 最新）
                        const rank =
                          attaches.filter((a: any) => a.versionId != null && Number(a.versionId) < Number(r.versionId)).length + 1;
                        const isCur = String(r.fileId ?? r.id) === String(detail?.mainFileId);
                        return <Tag color={isCur ? 'green' : undefined}>v{rank}</Tag>;
                      },
                    },
                    { title: '大小(字节)', dataIndex: 'fileSize' },
                    { title: '操作', key: 'op', render: (_: any, r: any) => (
                      <Space>
                        <Button
                          size="small"
                          type="link"
                          onClick={() =>
                            history.push(
                              `/docengine/editor?docId=${docId}&fileId=${r.fileId ?? r.id}&mode=view&editor=auto`,
                            )
                          }
                        >
                          打开预览
                        </Button>
                        <Button size="small" type="link" danger onClick={() => onDelAttach(r.id)}>删除</Button>
                      </Space>
                    ) },
                  ]}
                />
              </>
            ),
          },
          {
            key: 'version', label: '版本',
            children: (
              <Table rowKey="id" size="small" dataSource={versions} pagination={false}
                columns={[
                  { title: '版本ID', dataIndex: 'versionId' },
                  { title: '文件名', dataIndex: 'fileName' },
                  { title: '大小(字节)', dataIndex: 'fileSize' },
                  { title: '版本说明', dataIndex: 'versionDetail' },
                ]}
              />
            ),
          },
          {
            key: 'interact', label: '交互',
            children: (
              <>
                <Space style={{ marginBottom: 12 }} wrap>
                  <Button onClick={onTogglePraise}>
                    {praise.praised ? '已赞' : '点赞'}（{praise.count ?? 0}）
                  </Button>
                  <span>评分：</span>
                  <Select
                    style={{ width: 90 }}
                    value={myScore}
                    onChange={setMyScore}
                    options={[1, 2, 3, 4, 5].map((v) => ({ label: `${v} 分`, value: v }))}
                    placeholder="选择"
                  />
                  <Button onClick={onSubmitScore}>提交评分</Button>
                  <span>平均 {score.avg ?? 0}（{score.count ?? 0} 人）</span>
                </Space>
                <Input.TextArea
                  rows={2}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="写下回复…"
                  style={{ marginBottom: 8 }}
                />
                <Button type="primary" style={{ marginBottom: 12 }} onClick={onSendReply}>发表回复</Button>
                <List
                  size="small"
                  dataSource={replies}
                  renderItem={(r: any) => (
                    <List.Item
                      actions={[
                        <Button key="d" size="small" type="link" danger onClick={() => onDelReply(r.id)}>删除</Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={<span>{r.userId}</span>}
                        description={r.content}
                      />
                    </List.Item>
                  )}
                />
              </>
            ),
          },
          {
            key: 'op', label: '操作',
            children: (
              <Space wrap>
                {[0, 1, 2, 4, 6].includes(s) && <Button onClick={() => run(() => publishDoc(docId), '发布')}>发布</Button>}
                {[1, 2, 5].includes(s) && <Button onClick={() => run(() => invalidateDoc(docId), '失效')}>失效</Button>}
                {[1, 2, 7].includes(s) && <Button onClick={() => run(() => archiveDoc(docId), '归档')}>归档</Button>}
                {[5, 7, 8].includes(s) && <Button onClick={() => run(() => reopenDoc(docId), '重新打开')}>重新打开</Button>}
                {[0, 1, 2, 4, 6].includes(s) && <Button danger onClick={() => run(() => voidDoc(docId), '作废')}>作废</Button>}
                <Button onClick={() => run(() => checkOutDoc(docId), '签出')}>签出</Button>
                <Button onClick={() => run(() => checkInDoc(docId), '签入')}>签入</Button>
                <Button onClick={() => run(() => forceCheckInDoc(docId), '强制签入')}>强制签入</Button>
              </Space>
            ),
          },
        ]}
      />
    </Card>
  );
};

export default DocDetailPage;
