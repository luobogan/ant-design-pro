import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Card, Col, Row, Statistic, Table, Tabs, Tag, message } from 'antd';
import {
  odocReportApi,
  type OdocListQuery,
  type OdocStatisticVO,
  type OdocTodoVO,
  type PageResult,
} from '@/services/workflow';

const OFFICAL_TYPE: Record<number, string> = { 1: '发文', 2: '收文', 3: '签报' };

/**
 * 公文统计 / 流程监控（对应后端 WfOdocReportController）。
 * 监控管控动作（撤回/终止/暂停/恢复/撤销）复用通用 /instance/**。
 */
const OdocReport: React.FC = () => {
  const [stats, setStats] = useState<OdocStatisticVO[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [monitor, setMonitor] = useState<PageResult<OdocTodoVO>>({ records: [], total: 0, current: 1, size: 10 });
  const [monitorLoading, setMonitorLoading] = useState(false);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      // umi 裸 request 返回的是后端 R 信封（{code,msg,data,...}），需取 data 字段
      const res = await odocReportApi.statistics();
      if (res && res.success === false) {
        message.error(res.msg || '统计加载失败');
        return;
      }
      const data = (res?.data || []) as OdocStatisticVO[];
      setStats(data);
    } catch (e: any) {
      message.error(e?.msg || '统计加载失败');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadMonitor = useCallback(async (current = 1, size = 10) => {
    setMonitorLoading(true);
    try {
      const q: OdocListQuery = { current, size };
      // 同上：取 R 信封的 data 字段（IPage 结构），否则 .records 为 undefined
      const res = await odocReportApi.monitorList(q);
      if (res && res.success === false) {
        message.error(res.msg || '仅流程管理员可查看监控');
        setMonitor({ records: [], total: 0, current: 1, size: 10 });
        return;
      }
      const data = (res?.data || {
        records: [],
        total: 0,
        current: 1,
        size: 10,
      }) as PageResult<OdocTodoVO>;
      setMonitor(data);
    } catch (e: any) {
      message.error(e?.msg || '仅流程管理员可查看监控');
      setMonitor({ records: [], total: 0, current: 1, size: 10 });
    } finally {
      setMonitorLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const statColumns = [
    { title: '公文类型', dataIndex: 'officalType', key: 'officalType', render: (v: number) => OFFICAL_TYPE[v] || v },
    { title: '总数', dataIndex: 'total', key: 'total' },
    { title: '运行中', dataIndex: 'running', key: 'running' },
    { title: '办结', dataIndex: 'approved', key: 'approved' },
    { title: '不通过', dataIndex: 'rejected', key: 'rejected' },
    { title: '撤销', dataIndex: 'canceled', key: 'canceled' },
    { title: '暂停', dataIndex: 'suspended', key: 'suspended' },
    { title: '草稿', dataIndex: 'draft', key: 'draft' },
  ];

  const monitorColumns = [
    { title: '文号', dataIndex: 'issuedNum', key: 'issuedNum', width: 140, render: (v: string) => v || '-' },
    { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
    {
      title: '类型',
      dataIndex: 'officalType',
      key: 'officalType',
      width: 90,
      render: (v: number) => (v ? <Tag>{OFFICAL_TYPE[v] || v}</Tag> : '-'),
    },
    { title: '当前节点', dataIndex: 'currentNodeKey', key: 'currentNodeKey', width: 140, render: (v: string) => v || '-' },
    { title: '发起人', dataIndex: 'starter', key: 'starter', width: 90 },
  ];

  const totalAll = stats.reduce((s, v) => s + (v.total || 0), 0);
  const runningAll = stats.reduce((s, v) => s + (v.running || 0), 0);
  const approvedAll = stats.reduce((s, v) => s + (v.approved || 0), 0);

  return (
    <div style={{ background: 'transparent' }}>
      <Tabs
        defaultActiveKey="stat"
        items={[
          {
            key: 'stat',
            label: '公文统计',
            children: (
              <div>
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={8}>
                    <Card>
                      <Statistic title="公文总数" value={totalAll} />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card>
                      <Statistic title="在途" value={runningAll} valueStyle={{ color: '#FF7D00' }} />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card>
                      <Statistic title="已办结" value={approvedAll} valueStyle={{ color: '#00B42A' }} />
                    </Card>
                  </Col>
                </Row>
                <Card title="按公文类型">
                  <Table<OdocStatisticVO>
                    rowKey="officalType"
                    loading={statsLoading}
                    columns={statColumns}
                    dataSource={stats}
                    pagination={false}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'monitor',
            label: '在途监控',
            children: (
              <div>
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="监控仅流程管理员可见；撤回/终止/暂停/恢复/撤销等管控动作请在流程实例详情操作（复用通用 /instance/**）。"
                />
                <Card>
                  <Table<OdocTodoVO>
                    rowKey={(r) => r.instanceId || Math.random().toString()}
                    loading={monitorLoading}
                    columns={monitorColumns}
                    dataSource={monitor.records}
                    pagination={{
                      current: monitor.current,
                      pageSize: monitor.size,
                      total: monitor.total,
                      onChange: (c, s) => loadMonitor(c, s),
                    }}
                  />
                </Card>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};

export default OdocReport;
