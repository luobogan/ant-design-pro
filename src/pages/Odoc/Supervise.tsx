import React, { useCallback, useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Select, Space, Table, Tabs, Tag, DatePicker, message } from 'antd';
import { BellOutlined, PlusOutlined } from '@ant-design/icons';
import {
  odocSuperviseApi,
  type OdocSuperviseQuery,
  type OdocSuperviseVO,
  type PageResult,
} from '@/services/workflow';

const OFFICAL_TYPE: Record<number, string> = { 1: '发文', 2: '收文', 3: '签报' };
const STATUS: Record<number, { text: string; color: string }> = {
  0: { text: '督办中', color: 'orange' },
  1: { text: '已办结', color: 'green' },
  2: { text: '已取消', color: 'default' },
};

/**
 * 公文督办（对应后端 WfOdocSuperviseController）。
 */
const OdocSupervise: React.FC = () => {
  const [superviseType, setSuperviseType] = useState<number>(0);
  const [query, setQuery] = useState<OdocSuperviseQuery>({ current: 1, size: 10 });
  const [page, setPage] = useState<PageResult<OdocSuperviseVO>>({ records: [], total: 0, current: 1, size: 10 });
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState<number>(0);
  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await odocSuperviseApi.list({
        ...query,
        superviseType,
        current: page.current,
        size: page.size,
      });
      const data = (res?.data || { records: [], total: 0, current: 1, size: 10 }) as PageResult<OdocSuperviseVO>;
      setPage(data);
    } catch (e: any) {
      message.error(e?.msg || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [query, superviseType, page.current, page.size]);

  const reloadCount = useCallback(async () => {
    try {
      const cRes = await odocSuperviseApi.count({ superviseType });
      setCount((cRes?.data as number) ?? 0);
    } catch {
      /* 角标失败忽略 */
    }
  }, [superviseType]);

  useEffect(() => {
    reload();
  }, [reload]);
  useEffect(() => {
    reloadCount();
  }, [reloadCount]);

  const handleAdd = async () => {
    const v = await form.validateFields();
    setSubmitting(true);
    try {
      await odocSuperviseApi.add({
        instanceId: v.instanceId,
        deadline: v.deadline ? v.deadline.format('YYYY-MM-DD HH:mm:ss') : undefined,
        remark: v.remark,
      });
      message.success('已发起督办');
      setAddOpen(false);
      form.resetFields();
      reload();
      reloadCount();
    } catch (e: any) {
      message.error(e?.msg || '发起失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemind = async (id: any) => {
    try {
      await odocSuperviseApi.remind(id);
      message.success('已提醒');
      reload();
    } catch (e: any) {
      message.error(e?.msg || '提醒失败');
    }
  };

  const columns = [
    { title: '文号', dataIndex: 'issuedNum', key: 'issuedNum', width: 140, render: (v: string) => v || '-' },
    { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true, render: (v: string) => v || '-' },
    {
      title: '类型',
      dataIndex: 'officalType',
      key: 'officalType',
      width: 80,
      render: (v: number) => (v ? <Tag>{OFFICAL_TYPE[v] || v}</Tag> : '-'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: number) => (STATUS[v] ? <Tag color={STATUS[v].color}>{STATUS[v].text}</Tag> : '-'),
    },
    { title: '期限', dataIndex: 'deadline', key: 'deadline', width: 170, render: (v: string) => v || '-' },
    { title: '发起时间', dataIndex: 'createTime', key: 'createTime', width: 170, render: (v: string) => v || '-' },
    {
      title: '操作',
      key: 'op',
      width: 90,
      render: (_: any, r: OdocSuperviseVO) =>
        r.status === 0 ? (
          <Button type="link" size="small" icon={<BellOutlined />} onClick={() => handleRemind(r.id)}>
            提醒
          </Button>
        ) : null,
    },
  ];

  return (
    <div style={{ background: '#fff', padding: 16, borderRadius: 8 }}>
      <Tabs
        activeKey={String(superviseType)}
        onChange={(k) => {
          setSuperviseType(Number(k));
          setQuery({ current: 1, size: page.size });
          setPage((p) => ({ ...p, current: 1 }));
        }}
        items={[
          { key: '0', label: `我发起的督办（${count}）` },
          { key: '1', label: '我被督办' },
        ]}
      />

      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          allowClear
          placeholder="公文类型"
          style={{ width: 140 }}
          onChange={(v) => setQuery((q) => ({ ...q, officalType: v, current: 1 }))}
        >
          <Select.Option value={1}>发文</Select.Option>
          <Select.Option value={2}>收文</Select.Option>
          <Select.Option value={3}>签报</Select.Option>
        </Select>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
          发起督办
        </Button>
      </Space>

      <Table<OdocSuperviseVO>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={page.records}
        pagination={{
          current: page.current,
          pageSize: page.size,
          total: page.total,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (current, size) => setPage((p) => ({ ...p, current, size })),
        }}
      />

      <Modal
        title="发起督办"
        open={addOpen}
        onOk={handleAdd}
        onCancel={() => setAddOpen(false)}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="instanceId" label="流程实例ID" rules={[{ required: true, message: '请输入实例ID' }]}>
            <Input placeholder="在途公文实例ID" />
          </Form.Item>
          <Form.Item name="deadline" label="督办期限">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="remark" label="督办说明">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OdocSupervise;
