import React, { useCallback, useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Table, Tabs, Tag, message } from 'antd';
import { history } from 'umi';
import { centerRank, centerLatest, centerRecommend, centerMine, type RankRow } from '@/services/doc';

/**
 * 内容引擎 - 知识中心页（菜单 path=/docengine/center）。
 * 排行榜（按点赞）/ 最近文档 / 推荐阅读（按评分）/ 我的文档数。
 */
const statusMap: Record<number, { t: string; c?: string }> = {
  0: { t: '草稿' }, 1: { t: '生效', c: 'green' }, 2: { t: '生效', c: 'green' },
  3: { t: '审批中', c: 'blue' }, 4: { t: '退回', c: 'orange' }, 5: { t: '归档' },
  6: { t: '待发布', c: 'orange' }, 7: { t: '失效', c: 'red' }, 8: { t: '作废', c: 'red' },
  9: { t: '流程草稿' },
};

const DocCenter: React.FC = () => {
  const [rank, setRank] = useState<RankRow[]>([]);
  const [latest, setLatest] = useState<any[]>([]);
  const [recommend, setRecommend] = useState<RankRow[]>([]);
  const [mine, setMine] = useState<{ total?: number; draft?: number; effective?: number }>({});

  const loadAll = useCallback(async () => {
    try {
      const [rk, lt, rc, mn] = await Promise.all([
        centerRank(10), centerLatest(10), centerRecommend(10), centerMine(),
      ]);
      setRank(rk); setLatest(lt); setRecommend(rc); setMine(mn);
    } catch (e: any) {
      message.error(e?.msg || '加载失败');
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const rankCols = [
    { title: '文档', dataIndex: 'docSubject' },
    { title: '点赞数', dataIndex: 'cnt' },
    { title: '操作', key: 'op', render: (_: any, r: RankRow) => (
      <a onClick={() => r.docId && history.push(`/docengine/detail?docId=${r.docId}`)}>查看</a>
    ) },
  ];
  const recCols = [
    { title: '文档', dataIndex: 'docSubject' },
    { title: '平均分', dataIndex: 'avg', render: (v: any) => (typeof v === 'number' ? v.toFixed(2) : v) },
    { title: '评分人数', dataIndex: 'cnt' },
  ];
  const latestCols = [
    { title: '标题', dataIndex: 'docSubject' },
    { title: '状态', dataIndex: 'docStatus', render: (v: number) => (
      <Tag color={statusMap[v]?.c}>{statusMap[v]?.t ?? v}</Tag>
    ) },
    { title: '操作', key: 'op', render: (_: any, r: any) => (
      <a onClick={() => r.id && history.push(`/docengine/detail?docId=${r.id}`)}>查看</a>
    ) },
  ];

  return (
    <Card title="知识中心">
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}><Card><Statistic title="我的文档" value={mine.total ?? 0} /></Card></Col>
        <Col span={8}><Card><Statistic title="草稿" value={mine.draft ?? 0} /></Card></Col>
        <Col span={8}><Card><Statistic title="生效" value={mine.effective ?? 0} /></Card></Col>
      </Row>

      <Tabs
        items={[
          { key: 'latest', label: '最近文档', children: (
            <Table rowKey="id" size="small" dataSource={latest} columns={latestCols} pagination={false} />
          ) },
          { key: 'rank', label: '排行榜(点赞)', children: (
            <Table rowKey="docId" size="small" dataSource={rank} columns={rankCols} pagination={false} />
          ) },
          { key: 'recommend', label: '推荐阅读(评分)', children: (
            <Table rowKey="docId" size="small" dataSource={recommend} columns={recCols} pagination={false} />
          ) },
        ]}
      />
    </Card>
  );
};

export default DocCenter;
