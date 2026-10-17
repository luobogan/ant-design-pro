import React, { useCallback, useEffect, useState } from 'react';
import { Button, Form, Input, Select, Space, Table, Tabs, Tag, message } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { history } from 'umi';
import { odocTodoApi, type OdocListQuery, type OdocTodoVO, type PageResult } from '@/services/workflow';
import { useOdocListColumns } from './useListColumns';

/** 公文类型 */
const OFFICAL_TYPE: Record<number, { text: string; color: string }> = {
  1: { text: '发文', color: 'blue' },
  2: { text: '收文', color: 'green' },
  3: { text: '签报', color: 'orange' },
};

type TabKey = 'todo' | 'done' | 'myRequest';

const TAB_LABEL: Record<TabKey, string> = {
  todo: '待办处理',
  done: '已办',
  myRequest: '我的请求',
};

/**
 * 公文待办 / 已办 / 我的请求（对应后端 WfOdocTodoController）。
 * 办理/退回等动作复用通用流程页 /workflow/task/:id，不在此重造。
 */
const OdocTodoList: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('todo');
  const [query, setQuery] = useState<OdocListQuery>({ current: 1, size: 10 });
  const [page, setPage] = useState<PageResult<OdocTodoVO>>({ records: [], total: 0, current: 1, size: 10 });
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const api = tab === 'todo' ? odocTodoApi.todo : tab === 'done' ? odocTodoApi.done : odocTodoApi.myRequest;
      const data = (await api({ ...query, current: page.current, size: page.size })) as PageResult<OdocTodoVO>;
      setPage(data || { records: [], total: 0, current: 1, size: 10 });
    } catch (e: any) {
      message.error(e?.msg || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [tab, query, page.current, page.size]);

  useEffect(() => {
    reload();
  }, [reload]);

  const onSearch = (v: any) => {
    setQuery({ ...v, current: 1, size: page.size });
    setPage((p) => ({ ...p, current: 1 }));
  };

  const openTask = (record: OdocTodoVO) => {
    if (record.taskId) {
      history.push(`/workflow/task/${record.taskId}`);
    } else if (record.instanceId) {
      history.push(`/workflow/instance/${record.instanceId}`);
    }
  };

  const columns = [
    {
      title: '文号',
      dataIndex: 'issuedNum',
      key: 'issuedNum',
      width: 140,
      render: (v: string) => v || '-',
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (v: string, record: OdocTodoVO) =>
        record.taskId || record.instanceId ? (
          <a onClick={() => openTask(record)}>{v || '-'}</a>
        ) : (
          v || '-'
        ),
    },
    {
      title: '类型',
      dataIndex: 'officalType',
      key: 'officalType',
      width: 90,
      render: (v: number) =>
        v && OFFICAL_TYPE[v] ? <Tag color={OFFICAL_TYPE[v].color}>{OFFICAL_TYPE[v].text}</Tag> : '-',
    },
    { title: '密级', dataIndex: 'secretLevel', key: 'secretLevel', width: 90, render: (v: string) => v || '-' },
    { title: '紧急', dataIndex: 'urgency', key: 'urgency', width: 80, render: (v: string) => v || '-' },
    { title: '单位', dataIndex: 'issuedUnit', key: 'issuedUnit', width: 160, ellipsis: true, render: (v: string) => v || '-' },
    { title: '发起人', dataIndex: 'starter', key: 'starter', width: 90, render: (v: string) => v || '-' },
    {
      title: tab === 'done' ? '处理时间' : tab === 'todo' ? '接收时间' : '成文日期',
      key: 'time',
      width: 170,
      render: (_: any, record: OdocTodoVO) =>
        (tab === 'done' ? record.operateTime : tab === 'todo' ? record.receiveTime : record.writtenDate) || '-',
    },
    {
      title: '操作',
      key: 'op',
      width: 90,
      fixed: 'right' as const,
      render: (_: any, record: OdocTodoVO) => (
        <Button type="link" size="small" onClick={() => openTask(record)}>
          {tab === 'todo' ? '办理' : '查看'}
        </Button>
      ),
    },
  ];

  const { visibleColumns, settingNode } = useOdocListColumns('odoc_todo', columns);

  return (
    <div style={{ background: '#fff', padding: 16, borderRadius: 8 }}>
      <Tabs
        activeKey={tab}
        onChange={(k) => {
          setTab(k as TabKey);
          setQuery({ current: 1, size: page.size });
          setPage((p) => ({ ...p, current: 1 }));
        }}
        items={(['todo', 'done', 'myRequest'] as TabKey[]).map((k) => ({ key: k, label: TAB_LABEL[k] }))}
      />

      <Form layout="inline" onFinish={onSearch} style={{ marginBottom: 16 }}>
        <Form.Item name="officalType" label="公文类型">
          <Select allowClear placeholder="全部" style={{ width: 140 }}>
            <Select.Option value={1}>发文</Select.Option>
            <Select.Option value={2}>收文</Select.Option>
            <Select.Option value={3}>签报</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="title" label="标题">
          <Input allowClear placeholder="标题模糊" style={{ width: 200 }} />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
              查询
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setQuery({ current: 1, size: page.size });
                setPage((p) => ({ ...p, current: 1 }));
              }}
            >
              重置
            </Button>
          </Space>
        </Form.Item>
      </Form>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>{settingNode}</div>

      <Table<OdocTodoVO>
        rowKey={(r) => r.taskId || r.instanceId || Math.random().toString()}
        loading={loading}
        columns={visibleColumns}
        dataSource={page.records}
        scroll={{ x: 1100 }}
        pagination={{
          current: page.current,
          pageSize: page.size,
          total: page.total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (current, size) => setPage((p) => ({ ...p, current, size })),
        }}
      />
    </div>
  );
};

export default OdocTodoList;
