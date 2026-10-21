import React, { useCallback, useEffect, useState } from 'react';
import { Button, DatePicker, Form, InputNumber, Modal, Select, Space, Table, Tag, message } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { numberApi, numberReservedApi, type OdocNumber, type OdocNumberReserved } from '@/services/workflow';

/**
 * 文号保留号维护（对应后端 /odoc/number-reserved，WfOdocController）。
 * 取号逻辑（WfOdocNumberServiceImpl.assign）会跳过当前有效的保留号，避免发出被保留的流水。
 */
const OdocNumberReservedManage: React.FC = () => {
  const [rules, setRules] = useState<OdocNumber[]>([]);
  const [ruleId, setRuleId] = useState<string | undefined>();
  const [list, setList] = useState<OdocNumberReserved[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const loadRules = useCallback(async () => {
    try {
      const res = await numberApi.rules();
      const arr = (res?.data as OdocNumber[]) || [];
      setRules(arr);
      if (!ruleId && arr.length) {
        setRuleId(arr[0].id);
      }
    } catch (e: any) {
      message.error(e?.msg || '加载文号规则失败');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reload = useCallback(async () => {
    if (!ruleId) {
      setList([]);
      return;
    }
    setLoading(true);
    try {
      const res = await numberReservedApi.list(ruleId);
      setList((res?.data as OdocNumberReserved[]) || []);
    } catch (e: any) {
      message.error(e?.msg || '加载失败');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruleId]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleReserve = async () => {
    const v = await form.validateFields();
    if (!ruleId) {
      message.warning('请先选择文号规则');
      return;
    }
    setSubmitting(true);
    try {
      const exp = v.expireTime ? v.expireTime.format('YYYY-MM-DD HH:mm:ss') : undefined;
      const res = await numberReservedApi.reserve(ruleId, v.startSerial, v.endSerial, exp);
      message.success(`已保留 ${res?.data ?? 0} 个流水号`);
      setModalOpen(false);
      form.resetFields();
      reload();
    } catch (e: any) {
      message.error(e?.msg || '保留失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRelease = async (id: any) => {
    try {
      await numberReservedApi.release(id);
      message.success('已释放');
      reload();
    } catch (e: any) {
      message.error(e?.msg || '释放失败');
    }
  };

  const columns = [
    { title: '保留流水', dataIndex: 'serial', key: 'serial', width: 120 },
    {
      title: '过期时间',
      dataIndex: 'expireTime',
      key: 'expireTime',
      render: (t: any) => (t ? t : <Tag color="green">永久保留</Tag>),
    },
    { title: '保留人', dataIndex: 'reservedBy', key: 'reservedBy', width: 140 },
    {
      title: '操作',
      key: 'act',
      width: 100,
      render: (_: any, r: OdocNumberReserved) => (
        <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleRelease(r.id)}>
          释放
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12 }} wrap>
        <span>文号规则：</span>
        <Select
          style={{ width: 280 }}
          placeholder="选择文号规则"
          value={ruleId}
          onChange={(v) => setRuleId(v)}
          options={rules.map((r) => ({ value: r.id, label: `${r.typeName}（${r.prefix}）` }))}
        />
        <Button type="primary" icon={<PlusOutlined />} disabled={!ruleId} onClick={() => setModalOpen(true)}>
          新增保留号段
        </Button>
      </Space>
      <Table
        rowKey="id"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={list}
        pagination={false}
      />

      <Modal
        title="新增保留号段"
        open={modalOpen}
        onOk={handleReserve}
        confirmLoading={submitting}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="起始流水"
            name="startSerial"
            rules={[{ required: true, message: '请输入起始流水' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder="如 1" />
          </Form.Item>
          <Form.Item
            label="结束流水"
            name="endSerial"
            rules={[{ required: true, message: '请输入结束流水' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder="如 10（含）" />
          </Form.Item>
          <Form.Item label="过期时间" name="expireTime" tooltip="留空=永久保留；过期后该号不再被跳过">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OdocNumberReservedManage;
