import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, InputNumber, Modal, Select, Switch, Table, Tag, TreeSelect, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { odocReceiveUnitApi, type OdocReceiveUnit } from '@/services/workflow';

const COMPANY_TYPE: Record<number, string> = { 0: '内部', 1: '外部' };

/**
 * 收发文单位档案维护（层级 / 内部外部）。
 * 对应后端 WfOdocReceiveUnitController（/odoc/receive-unit/**）。
 */
const OdocReceiveUnitManage: React.FC = () => {
  const [list, setList] = useState<OdocReceiveUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [current, setCurrent] = useState<OdocReceiveUnit | null>(null);
  const [form] = Form.useForm();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await odocReceiveUnitApi.list();
      setList((res?.data as OdocReceiveUnit[]) || []);
    } catch (e: any) {
      message.error(e?.msg || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const nameMap = useMemo(() => {
    const m: Record<string, string> = {};
    list.forEach((u) => {
      if (u.id != null) m[String(u.id)] = u.unitName || String(u.id);
    });
    return m;
  }, [list]);

  const treeData = useMemo(() => buildTree(list), [list]);

  const openAdd = () => {
    setCurrent(null);
    form.resetFields();
    form.setFieldsValue({ companyType: 0, isMain: false, canStartChildRequest: false, enabled: true, showOrder: 0 });
    setEditOpen(true);
  };
  const openEdit = (r: OdocReceiveUnit) => {
    setCurrent(r);
    form.setFieldsValue({
      ...r,
      superiorId: r.superiorId != null ? String(r.superiorId) : undefined,
      isMain: r.isMain === 1,
      canStartChildRequest: r.canStartChildRequest === 1,
      enabled: r.enabled !== 0,
    });
    setEditOpen(true);
  };
  const handleSubmit = async () => {
    const v = await form.validateFields();
    setSubmitting(true);
    try {
      await odocReceiveUnitApi.save({
        id: current?.id,
        unitName: v.unitName,
        unitCode: v.unitCode,
        superiorId: v.superiorId || undefined,
        companyType: v.companyType,
        isMain: v.isMain ? 1 : 0,
        canStartChildRequest: v.canStartChildRequest ? 1 : 0,
        receiverIds: v.receiverIds,
        showOrder: v.showOrder,
        enabled: v.enabled ? 1 : 0,
        extNote: v.extNote,
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
      await odocReceiveUnitApi.remove(id);
      message.success('已删除');
      reload();
    } catch (e: any) {
      message.error(e?.msg || '删除失败');
    }
  };

  const columns = [
    { title: '单位名称', dataIndex: 'unitName', key: 'unitName' },
    { title: '代字', dataIndex: 'unitCode', key: 'unitCode', width: 100, render: (v: string) => v || '-' },
    {
      title: '上级',
      dataIndex: 'superiorId',
      key: 'superiorId',
      width: 140,
      render: (v: any) => (v != null ? nameMap[String(v)] || v : '—'),
    },
    {
      title: '类型',
      dataIndex: 'companyType',
      key: 'companyType',
      width: 80,
      render: (v: number) => <Tag color={v === 1 ? 'orange' : 'blue'}>{COMPANY_TYPE[v] ?? v}</Tag>,
    },
    { title: '主送', dataIndex: 'isMain', key: 'isMain', width: 70, render: (v: number) => (v === 1 ? '是' : '否') },
    { title: '收文员', dataIndex: 'receiverIds', key: 'receiverIds', ellipsis: true, render: (v: string) => v || '-' },
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
      render: (_: any, r: OdocReceiveUnit) => (
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
          新增单位
        </Button>
      </div>
      <Table<OdocReceiveUnit> rowKey="id" loading={loading} columns={columns} dataSource={list} pagination={false} />

      <Modal
        title={current ? '编辑单位' : '新增单位'}
        open={editOpen}
        onOk={handleSubmit}
        onCancel={() => setEditOpen(false)}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="unitName" label="单位名称" rules={[{ required: true, message: '请输入单位名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="unitCode" label="单位代字/代码">
            <Input />
          </Form.Item>
          <Form.Item name="superiorId" label="上级单位">
            <TreeSelect treeData={treeData} allowClear placeholder="留空=根级" treeDefaultExpandAll />
          </Form.Item>
          <Form.Item name="companyType" label="单位类型" rules={[{ required: true }]}>
            <Select>
              {[0, 1].map((v) => (
                <Select.Option key={v} value={v}>
                  {COMPANY_TYPE[v]}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="receiverIds" label="收文员ID（逗号分隔）">
            <Input />
          </Form.Item>
          <Form.Item name="showOrder" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="extNote" label="备注">
            <Input />
          </Form.Item>
          <Form.Item name="isMain" label="主送单位" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="canStartChildRequest" label="可发起子收文" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

/** 扁平单位 → TreeSelect 数据（按 superiorId 聚合） */
function buildTree(list: OdocReceiveUnit[]): any[] {
  const nodes = new Map<string, any>();
  (list || []).forEach((u) => {
    if (u.id != null) nodes.set(String(u.id), { value: String(u.id), title: u.unitName || String(u.id), children: [] as any[], raw: u });
  });
  const roots: any[] = [];
  nodes.forEach((n) => {
    const sup = n.raw?.superiorId != null && n.raw?.superiorId !== '' ? String(n.raw.superiorId) : '';
    if (sup && nodes.has(sup)) nodes.get(sup)?.children.push(n);
    else roots.push(n);
  });
  const prune = (arr: any[]) =>
    arr.forEach((n) => {
      if (!n.children.length) delete n.children;
      else prune(n.children);
    });
  prune(roots);
  return roots;
}

export default OdocReceiveUnitManage;
