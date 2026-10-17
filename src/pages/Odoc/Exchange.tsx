import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Form, Input, Modal, Select, Space, Switch, Table, Tabs, Tag, message } from 'antd';
import { PlusOutlined, SendOutlined } from '@ant-design/icons';
import {
  odocExchangeApi,
  type OdocExchangeInner,
  type OdocExchangeSetting,
  type PageResult,
} from '@/services/workflow';

const DIRECTION: Record<number, string> = { 1: '发出', 2: '接收' };
const EX_STATUS: Record<number, { text: string; color: string }> = {
  0: { text: '待接收', color: 'orange' },
  1: { text: '已接收', color: 'green' },
  2: { text: '已退回', color: 'red' },
};

/**
 * 公文交换（对应后端 WfOdocExchangeController）。
 */
const OdocExchange: React.FC = () => {
  const [direction, setDirection] = useState<number>(1);
  const [page, setPage] = useState<PageResult<OdocExchangeInner>>({ records: [], total: 0, current: 1, size: 10 });
  const [loading, setLoading] = useState(false);

  const [sendOpen, setSendOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const [available, setAvailable] = useState<boolean>(false);
  const [settings, setSettings] = useState<OdocExchangeSetting[]>([]);
  const [setOpen, setSetOpen] = useState(false);
  const [setForm] = Form.useForm();
  const [extForm] = Form.useForm();

  const loadInner = useCallback(async (current = 1, size = 10) => {
    setLoading(true);
    try {
      const res = await odocExchangeApi.innerList({ direction, current, size });
      const data = (res?.data || { records: [], total: 0, current: 1, size: 10 }) as PageResult<OdocExchangeInner>;
      setPage(data);
    } catch (e: any) {
      message.error(e?.msg || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [direction]);

  const loadExternal = useCallback(async () => {
    try {
      const [availRes, listRes] = await Promise.all([odocExchangeApi.externalAvailable(), odocExchangeApi.listSetting()]);
      setAvailable(!!availRes?.data);
      setSettings((listRes?.data as OdocExchangeSetting[]) || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadInner();
  }, [loadInner]);
  useEffect(() => {
    loadExternal();
  }, [loadExternal]);

  const handleSend = async () => {
    const v = await form.validateFields();
    const targetUnits = String(v.targetUnits || '')
      .split(/[,，\n]/)
      .map((s: string) => s.trim())
      .filter(Boolean);
    if (targetUnits.length === 0) {
      message.warning('请填写至少一个目标机构');
      return;
    }
    setSubmitting(true);
    try {
      await odocExchangeApi.innerSend({ instanceId: v.instanceId, targetUnits, remark: v.remark });
      message.success('已发送');
      setSendOpen(false);
      form.resetFields();
      loadInner();
    } catch (e: any) {
      message.error(e?.msg || '发送失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceive = async (id: any) => {
    try {
      await odocExchangeApi.innerReceive(id);
      message.success('已标记接收');
      loadInner();
    } catch (e: any) {
      message.error(e?.msg || '操作失败');
    }
  };

  const saveSetting = async () => {
    const v = await setForm.validateFields();
    try {
      await odocExchangeApi.saveSetting(v);
      message.success('已保存');
      setSetOpen(false);
      setForm.resetFields();
      loadExternal();
    } catch (e: any) {
      message.error(e?.msg || '保存失败');
    }
  };

  const sendExternal = async () => {
    const v = await extForm.validateFields();
    try {
      await odocExchangeApi.externalSend(v.platformCode, v.instanceId);
      message.success('已发送到外部平台');
    } catch (e: any) {
      message.error(e?.msg || '发送失败');
    }
  };

  const innerColumns = [
    { title: '公文标识', dataIndex: 'documentIdentifier', key: 'documentIdentifier', width: 200 },
    { title: '对方机构', dataIndex: 'targetUnit', key: 'targetUnit', width: 160 },
    { title: '文号', dataIndex: 'issuedNum', key: 'issuedNum', width: 140, render: (v: string) => v || '-' },
    { title: '单位', dataIndex: 'issuedUnit', key: 'issuedUnit', ellipsis: true, render: (v: string) => v || '-' },
    {
      title: '状态',
      dataIndex: 'exchangeStatus',
      key: 'exchangeStatus',
      width: 100,
      render: (v: number) => (EX_STATUS[v] ? <Tag color={EX_STATUS[v].color}>{EX_STATUS[v].text}</Tag> : '-'),
    },
    { title: '时间', dataIndex: 'createTime', key: 'createTime', width: 170 },
    {
      title: '操作',
      key: 'op',
      width: 100,
      render: (_: any, r: OdocExchangeInner) =>
        r.direction === 2 && r.exchangeStatus === 0 ? (
          <Button type="link" size="small" onClick={() => handleReceive(r.id)}>
            标记接收
          </Button>
        ) : null,
    },
  ];

  return (
    <div style={{ background: '#fff', padding: 16, borderRadius: 8 }}>
      <Tabs
        items={[
          {
            key: 'inner',
            label: '内部交换',
            children: (
              <>
                <Space style={{ marginBottom: 12 }}>
                  <Select value={direction} style={{ width: 120 }} onChange={(v) => { setDirection(v); }}>
                    <Select.Option value={1}>发出</Select.Option>
                    <Select.Option value={2}>接收</Select.Option>
                  </Select>
                  <Button type="primary" icon={<SendOutlined />} onClick={() => setSendOpen(true)}>
                    发送公文
                  </Button>
                </Space>
                <Table<OdocExchangeInner>
                  rowKey="id"
                  loading={loading}
                  columns={innerColumns}
                  dataSource={page.records}
                  pagination={{
                    current: page.current,
                    pageSize: page.size,
                    total: page.total,
                    onChange: (c, s) => loadInner(c, s),
                  }}
                />
              </>
            ),
          },
          {
            key: 'external',
            label: '外部交换',
            children: (
              <>
                {!available && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="外部交换尚未接入（IOdocExchangeClient 适配器未配置），发送将不可用。"
                  />
                )}
                <Space style={{ marginBottom: 12 }}>
                  <Button icon={<PlusOutlined />} onClick={() => setSetOpen(true)}>
                    新增平台
                  </Button>
                </Space>
                <Table<OdocExchangeSetting>
                  rowKey="id"
                  dataSource={settings}
                  pagination={false}
                  style={{ marginBottom: 16 }}
                  columns={[
                    { title: '编码', dataIndex: 'platformCode', key: 'platformCode' },
                    { title: '名称', dataIndex: 'platformName', key: 'platformName' },
                    { title: '方式', dataIndex: 'type', key: 'type', render: (v: string) => v || '-' },
                    { title: '地址', dataIndex: 'endpoint', key: 'endpoint', ellipsis: true },
                    {
                      title: '启用',
                      dataIndex: 'enabled',
                      key: 'enabled',
                      render: (v: number) => <Tag color={v === 1 ? 'green' : 'default'}>{v === 1 ? '启用' : '停用'}</Tag>,
                    },
                  ]}
                />
                <Form form={extForm} layout="inline" onFinish={sendExternal}>
                  <Form.Item name="platformCode" label="平台编码" rules={[{ required: true }]}>
                    <Input placeholder="platformCode" style={{ width: 160 }} />
                  </Form.Item>
                  <Form.Item name="instanceId" label="实例ID" rules={[{ required: true }]}>
                    <Input placeholder="instanceId" style={{ width: 200 }} />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" disabled={!available}>
                      发送
                    </Button>
                  </Form.Item>
                </Form>
              </>
            ),
          },
        ]}
      />

      <Modal title="发送公文" open={sendOpen} onOk={handleSend} onCancel={() => setSendOpen(false)} confirmLoading={submitting} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="instanceId" label="流程实例ID" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="targetUnits" label="目标机构" rules={[{ required: true }]} extra="多个用逗号/换行分隔">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="新增外部平台" open={setOpen} onOk={saveSetting} onCancel={() => setSetOpen(false)} destroyOnClose>
        <Form form={setForm} layout="vertical">
          <Form.Item name="platformCode" label="平台编码" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="platformName" label="平台名称">
            <Input />
          </Form.Item>
          <Form.Item name="type" label="交换方式" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="ws">WebService</Select.Option>
              <Select.Option value="ftp">FTP</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="endpoint" label="服务地址">
            <Input placeholder="ws endpoint 或 ftp host:port" />
          </Form.Item>
          <Form.Item name="appKey" label="appKey">
            <Input />
          </Form.Item>
          <Form.Item name="appSecret" label="appSecret">
            <Input.Password />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked" initialValue={false}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OdocExchange;
