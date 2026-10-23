import React, { useCallback, useEffect, useState } from 'react';
import { Card, Col, Row, Select, Space, Statistic, Table, Tabs, message } from 'antd';
import { statOverview, statCount, type StatRow } from '@/services/doc';

/**
 * 内容引擎 - 统计页（菜单 path=/docengine/stat）。
 *
 * 对齐 E9「阅读量/著作/目录/部门/分部」5 类统计，但按「维度」参数化收口为一套
 * （原 5 套结构完全重复，此处避免重复维护）。
 */
const dimLabel: Record<string, string> = {
  author: '按创建人',
  category: '按目录',
  division: '按分部',
  time: '按日期',
};

const DocStat: React.FC = () => {
  const [ov, setOv] = useState<{ total?: number; draft?: number; effective?: number; recycled?: number }>({});
  const [dim, setDim] = useState<string>('author');
  const [rows, setRows] = useState<StatRow[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRows = useCallback(async (d: string) => {
    setLoading(true);
    try { setRows(await statCount(d)); }
    catch (e: any) { message.error(e?.msg || '统计加载失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { statOverview().then(setOv).catch(() => {}); }, []);
  useEffect(() => { loadRows(dim); }, [dim, loadRows]);

  return (
    <Card title="文档统计">
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="文档总数" value={ov.total ?? 0} /></Card></Col>
        <Col span={6}><Card><Statistic title="草稿" value={ov.draft ?? 0} /></Card></Col>
        <Col span={6}><Card><Statistic title="生效" value={ov.effective ?? 0} /></Card></Col>
        <Col span={6}><Card><Statistic title="回收站" value={ov.recycled ?? 0} /></Card></Col>
      </Row>

      <Tabs
        activeKey={dim}
        onChange={(k) => setDim(k)}
        items={Object.keys(dimLabel).map((d) => ({
          key: d, label: dimLabel[d],
          children: (
            <>
              <Space style={{ marginBottom: 12 }}>
                <span>统计维度：</span>
                <Select
                  style={{ width: 160 }}
                  value={dim}
                  onChange={setDim}
                  options={Object.keys(dimLabel).map((k) => ({ label: dimLabel[k], value: k }))}
                />
              </Space>
              <Table
                rowKey={(r: StatRow) => String(r.name ?? Math.random())}
                size="small"
                loading={loading}
                dataSource={rows}
                pagination={false}
                columns={[
                  { title: dimLabel[dim]?.replace('按', '') || '分组', dataIndex: 'name', render: (v: any) => String(v ?? '-') },
                  { title: '文档数', dataIndex: 'cnt' },
                ]}
              />
            </>
          ),
        }))}
      />
    </Card>
  );
};

export default DocStat;
