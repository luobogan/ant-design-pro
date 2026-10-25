import React, { useCallback, useEffect, useState } from 'react';
import { Button, Form, Input, InputNumber, Modal, Switch, Table, Tabs, Tag, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { odocDictApi, type OdocDict } from '@/services/workflow';

/** 公文规范字典分类（对应后端 dict_type） */
const DICT_TYPES: { key: string; label: string }[] = [
  { key: 'secret_level', label: '秘密等级' },
  { key: 'urgency', label: '紧急程度' },
  { key: 'doc_type', label: '种类（文种）' },
  { key: 'topic_type', label: '主题分类' },
  { key: 'org_abbr', label: '机构代字' },
];

/**
 * 公文规范字典维护（秘密等级/紧急程度/种类/主题分类/机构代字）。
 * 对应后端 WfOdocDictController（/odoc/dict/**）。
 */
const OdocDictManage: React.FC = () => {
  const [dictType, setDictType] = useState<string>('secret_level');
  const [list, setList] = useState<OdocDict[]>([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [current, setCurrent] = useState<OdocDict | null>(null);
  const [form] = Form.useForm();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await odocDictApi.list(dictType);
      setList((res?.data as OdocDict[]) || []);
    } catch (e: any) {
      message.error(e?.msg || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [dictType]);

  useEffect(() => {
    reload();
  }, [reload]);

  const openAdd = () => {
    setCurrent(null);
    form.resetFields();
    form.setFieldsValue({ dictType, enabled: true, isDefault: false, showOrder: 0 });
    setEditOpen(true);
  };
  const openEdit = (r: OdocDict) => {
    setCurrent(r);
    form.setFieldsValue({ ...r, enabled: r.enabled !== 0, isDefault: r.isDefault === 1 });
    setEditOpen(true);
  };
  const handleSubmit = async () => {
    const v = await form.validateFields();
    setSubmitting(true);
    try {
      await odocDictApi.save({
        id: current?.id,
        dictType,
        code: v.code,
        name: v.name,
        alias: v.alias,
        showOrder: v.showOrder,
        extColor: v.extColor,
        extNote: v.extNote,
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
      await odocDictApi.remove(id);
      message.success('已删除');
      reload();
    } catch (e: any) {
      message.error(e?.msg || '删除失败');
    }
  };

  const columns = [
    { title: '编码', dataIndex: 'code', key: 'code', width: 120 },
    { title: '名称', dataIndex: 'name', key: 'name', width: 140 },
    { title: '别名/英文', dataIndex: 'alias', key: 'alias', width: 120, render: (v: string) => v || '-' },
    { title: '排序', dataIndex: 'showOrder', key: 'showOrder', width: 70 },
    { title: '着色', dataIndex: 'extColor', key: 'extColor', width: 90, render: (v: string) => v || '-' },
    { title: '备注', dataIndex: 'extNote', key: 'extNote', ellipsis: true, render: (v: string) => v || '-' },
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
      render: (_: any, r: OdocDict) => (
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
      <Tabs
        activeKey={dictType}
        onChange={setDictType}
        items={DICT_TYPES.map((t) => ({ key: t.key, label: t.label }))}
      />
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
          新增字典项
        </Button>
      </div>
      <Table<OdocDict> rowKey="id" loading={loading} columns={columns} dataSource={list} pagination={false} />

      <Modal
        title={current ? '编辑字典项' : '新增字典项'}
        open={editOpen}
        onOk={handleSubmit}
        onCancel={() => setEditOpen(false)}
        confirmLoading={submitting}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="编码" rules={[{ required: true, message: '请输入编码' }]}>
            <Input disabled={!!current} placeholder="类型内唯一（编辑不可改）" />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="alias" label="别名/英文名">
            <Input />
          </Form.Item>
          <Form.Item name="showOrder" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="extColor" label="着色（紧急/密级用）">
            <Input placeholder="如 #FF7D00" />
          </Form.Item>
          <Form.Item name="extNote" label="备注">
            <Input />
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

export default OdocDictManage;
