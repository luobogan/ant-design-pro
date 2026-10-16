import React, { useEffect, useState } from 'react';
import {
  Card,
  Col,
  Row,
  Select,
  Statistic,
  Table,
  Tag,
  message,
} from 'antd';
import { Column } from '@ant-design/plots';
import { portalApi } from '@/services/portal';
import type { PortalPage, PortalPageStatVO } from '@/services/portal/typings';

/**
 * 门户访问分析
 * - 访问趋势：最近 N 天每日 PV（@ant-design/plots Column）
 * - 热门门户页：本租户访问量 Top 10
 * 数据来自 /page/stats/daily、/page/stats/top（按 view_count 维度，需页面维护权限）
 */
const PortalStats: React.FC = () => {
  const [days, setDays] = useState<number>(30);
  const [daily, setDaily] = useState<PortalPageStatVO[]>([]);
  const [top, setTop] = useState<PortalPage[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [d, t] = await Promise.all([portalApi.getPageViewDaily(days), portalApi.getPageViewTop(10)]);
      setDaily(d || []);
      setTop(t || []);
    } catch (e: any) {
      message.error(e?.msg || '加载访问统计失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const total = daily.reduce((s, x) => s + (x.viewCount || 0), 0);
  const peak = daily.reduce((m, x) => ((x.viewCount || 0) > m ? x.viewCount || 0 : m), 0);
  const uvTotal = daily.reduce((s, x) => s + (x.uv || 0), 0);

  const trend = daily.flatMap((d) => [
    { date: d.statDate, metric: 'PV', value: d.viewCount || 0 },
    { date: d.statDate, metric: 'UV', value: d.uv || 0 },
  ]);

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Statistic title={`近 ${days} 天总访问(PV)`} value={total} />
          </Col>
          <Col>
            <Statistic title="单日峰值" value={peak} />
          </Col>
          <Col>
            <Statistic title="独立访客(UV)" value={uvTotal} />
          </Col>
          <Col flex="auto" />
          <Col>
            <Select value={days} onChange={setDays} style={{ width: 160 }}>
              <Select.Option value={7}>最近 7 天</Select.Option>
              <Select.Option value={30}>最近 30 天</Select.Option>
              <Select.Option value={90}>最近 90 天</Select.Option>
            </Select>
          </Col>
        </Row>
      </Card>

      <Row gutter={16}>
        <Col span={16}>
          <Card title="访问趋势（每日 PV / UV）" loading={loading} bodyStyle={{ padding: 8 }}>
            <Column
              data={trend}
              xField="date"
              yField="value"
              colorField="metric"
              columnWidthRatio={0.6}
              height={320}
              autoFit
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="热门门户页 Top 10" loading={loading}>
            <Table<PortalPage>
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={top}
              columns={[
                {
                  title: '#',
                  width: 44,
                  render: (_: unknown, __: PortalPage, i: number) => i + 1,
                },
                { title: '名称', dataIndex: 'pageName' },
                {
                  title: '类型',
                  width: 84,
                  render: (r: PortalPage) =>
                    r.pageType === 0 ? (
                      <Tag color="orange">登录前</Tag>
                    ) : (
                      <Tag color="blue">登录后</Tag>
                    ),
                },
                {
                  title: '访问',
                  width: 88,
                  dataIndex: 'viewCount',
                  render: (v: number) => (v && v > 0 ? v.toLocaleString() : 0),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default PortalStats;
