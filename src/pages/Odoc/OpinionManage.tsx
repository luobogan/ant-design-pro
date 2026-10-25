import React, { useCallback, useEffect, useState } from 'react';
import { Button, Form, Input, InputNumber, Modal, Switch, Table, Tag, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { odocOpinionApi, type OdocOpinion } from '@/services/workflow';

/**
 * 公文意见模板维护（常用批示语 / 签字意见模板）。
 * 对应后端 WfOdocOpinionController（/odoc/opinion/**）。
 */
const OdocOpinionManage: React.FC = () => {
  const [list, setList] = useState<OdocOpinion[]>([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [current, setCurrent] = useState<OdocOpinion | null>(null);
  const [form] = Form.useForm();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await odocOpinionApi.list();
      setList((res?.data as OdocOpinion[]) || []);
    } catch (e: any) {
      message.error(e?.msg || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const openAdd = () => {
    setCurrent(null);
    form.resetFields();
    form.setFieldsValue({ enabled: true, isDefault: false, showOrder: 0 });
    setEditOpen(true);
  };
  const openEdit = (r: OdocOpinion) => {
    setCurrent(r);
    form.setFieldsValue({ ...r, enabled: r.enabled !== 0, isDefault: r.isDefault === 1 });
    setEditOpen(true);
  };
  const handleSubmit = async () => {
    const v = await form.validateFields();
    setSubmitting(true);
    try {
      await odocOpinionApi.save({
        id: current?.id,
        defId: v.defId || undefined,
        phraseShort: v.phraseShort,
        phrase: v.phrase,
        showOrder: v.showOrder,
        enabled: v.enabled ? 1 : 0,
        isDefault: v.isDefault ? 1 : 0,
      });
      message.success('已保存');
      setEditOpen(false);
      reload();
    } catch (e: any) {
      message.error(e?.msg || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };
  const handleRemove = async (id: any) => {
    try {
      await odocOpinionApi.remove(id);
      message.success('已删除');
      reload();
    } catch (e: any) {
      message.error(e?.msg || '删除失败');
    }
  };

  const columns = [
    { title: '标题', dataIndex: 'phraseShort', key: 'phraseShort', width: 140, render: (v: string) => v || '-' },
    { title: '意见内容', dataIndex: 'phrase', key: 'phrase', ellipsis: true },
    {
      title: '范围',
      dataIndex: 'defId',
      key: 'defId',
      width: 120,
      render: (v: any) => (v ? <Tag color="blue">流程 {v}</Tag> : <Tag color="green">全局</Tag>),
    },
    { title: '排序', dataIndex: 'showOrder', key: 'showOrder', width: 70 },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (v: number) => <Tag color={v === 1 ? 'green' : 'default'}>{v === 1 ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作',
      key: 'op',
      width: 120,
      render: (_: any, r: OdocOpinion) => (
        <>
          <Button type="link" size="small" onClick={() => openEdit(r)}>
            编辑
          </Button>
          <Button type="link" size="small" danger onClick={() => handleRemove(r.id)}>
            删除
          </Button>
        </>
      ),
    },
  ];

  return (
    <div style={{ background: '#fff', padding: 16, borderRadius: 8 }}>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
          新增意见模板
        </Button>
      </div>
      <Table<OdocOpinion> rowKey="id" loading={loading} columns={columns} dataSource={list} pagination={false} />

      <Modal
        title={current ? '编辑意见模板' : '新增意见模板'}
        open={editOpen}
        onOk={handleSubmit}
        onCancel={() => setEditOpen(false)}
        confirmLoading={submitting}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="phraseShort" label="标题/常用语名">
            <Input placeholder="如：同意" />
          </Form.Item>
          <Form.Item name="phrase" label="意见内容" rules={[{ required: true, message: '请输入意见内容' }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="defId" label="归属流程定义ID（留空=全局公共）">
            <Input placeholder="留空对所有流程生效" />
          </Form.Item>
          <Form.Item name="showOrder" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="isDefault" label="默认项" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OdocOpinionManage;
