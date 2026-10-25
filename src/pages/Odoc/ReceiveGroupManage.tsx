import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, InputNumber, Modal, Select, Switch, Table, Tag, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
  odocReceiveGroupApi,
  odocReceiveUnitApi,
  type OdocReceiveGroup,
  type OdocReceiveUnit,
} from '@/services/workflow';

/**
 * 收发文公共组维护（多单位打包，供主送/抄送批量选择）。
 * 对应后端 WfOdocReceiveGroupController（/odoc/receive-group/**）。
 */
const OdocReceiveGroupManage: React.FC = () => {
  const [list, setList] = useState<OdocReceiveGroup[]>([]);
  const [units, setUnits] = useState<OdocReceiveUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [current, setCurrent] = useState<OdocReceiveGroup | null>(null);
  const [form] = Form.useForm();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await odocReceiveGroupApi.list();
      setList((res?.data as OdocReceiveGroup[]) || []);
    } catch (e: any) {
      message.error(e?.msg || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);
  const reloadUnits = useCallback(async () => {
    try {
      const res = await odocReceiveUnitApi.list();
      setUnits((res?.data as OdocReceiveUnit[]) || []);
    } catch {
      /* 单位加载失败不阻塞公共组页 */
    }
  }, []);

  useEffect(() => {
    reload();
    reloadUnits();
  }, [reload, reloadUnits]);

  const nameMap = useMemo(() => {
    const m: Record<string, string> = {};
    units.forEach((u) => {
      if (u.id != null) m[String(u.id)] = u.unitName || String(u.id);
    });
    return m;
  }, [units]);

  const openAdd = () => {
    setCurrent(null);
    form.resetFields();
    form.setFieldsValue({ enabled: true, showOrder: 0 });
    setEditOpen(true);
  };
  const openEdit = (r: OdocReceiveGroup) => {
    setCurrent(r);
    form.setFieldsValue({
      ...r,
      unitIds: r.unitIds ? r.unitIds.split(',').filter(Boolean) : [],
      enabled: r.enabled !== 0,
    });
    setEditOpen(true);
  };
  const handleSubmit = async () => {
    const v = await form.validateFields();
    setSubmitting(true);
    try {
      await odocReceiveGroupApi.save({
        id: current?.id,
        groupName: v.groupName,
        unitIds: (v.unitIds || []).join(','),
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
      await odocReceiveGroupApi.remove(id);
      message.success('已删除');
      reload();
    } catch (e: any) {
      message.error(e?.msg || '删除失败');
    }
  };

  const memberText = (ids?: string) =>
    ids ? ids.split(',').filter(Boolean).map((i) => nameMap[i] || i).join('、') : '-';

  const columns = [
    { title: '公共组名称', dataIndex: 'groupName', key: 'groupName', width: 200 },
    { title: '成员单位', key: 'members', render: (_: any, r: OdocReceiveGroup) => memberText(r.unitIds) },
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
      render: (_: any, r: OdocReceiveGroup) => (
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
          新增公共组
        </Button>
      </div>
      <Table<OdocReceiveGroup> rowKey="id" loading={loading} columns={columns} dataSource={list} pagination={false} />

      <Modal
        title={current ? '编辑公共组' : '新增公共组'}
        open={editOpen}
        onOk={handleSubmit}
        onCancel={() => setEditOpen(false)}
        confirmLoading={submitting}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="groupName" label="公共组名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="unitIds" label="成员单位">
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="选择成员单位"
              options={units.map((u) => ({ label: u.unitName, value: String(u.id) }))}
            />
          </Form.Item>
          <Form.Item name="showOrder" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="extNote" label="备注">
            <Input />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OdocReceiveGroupManage;
