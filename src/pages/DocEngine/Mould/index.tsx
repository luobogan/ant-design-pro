import React, { useCallback, useEffect, useState } from 'react';
import { Button, Form, Input, InputNumber, Modal, Popconfirm, Table, Tag, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { listMould, saveMould, deleteMould, type DocMould } from '@/services/doc';

/**
 * 内容引擎 - 模板管理页（菜单 code=docengine_mould, path=/docengine/mould）。
 * 批量删除走后端参数化 in (?)（修 DOC-P0-5）。
 */
const DocMouldPage: React.FC = () => {
  const [list, setList] = useState<DocMould[]>([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [current, setCurrent] = useState<DocMould | null>(null);
  const [form] = Form.useForm();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setList(await listMould());
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
    form.setFieldsValue({ mouldType: 0, isDefault: 0 });
    setEditOpen(true);
  };
  const openEdit = (r: DocMould) => {
    setCurrent(r);
    form.setFieldsValue({ ...r });
    setEditOpen(true);
  };
  const handleSubmit = async () => {
    const v = await form.validateFields();
    try {
      await saveMould({ ...(current || {}), ...v });
      message.success('保存成功');
      setEditOpen(false);
      reload();
    } catch (e: any) {
      message.error(e?.msg || '保存失败');
    }
  };
  const onDelete = async (ids: (number | string)[]) => {
    try {
      await deleteMould(ids);
      message.success('已删除');
      reload();
    } catch (e: any) {
      message.error(e?.msg || '删除失败');
    }
  };

  const typeMap: Record<number, string> = { 0: 'HTML', 2: 'WORD', 3: 'EXCEL', 4: 'WPS' };
  const columns = [
    { title: '模板名', dataIndex: 'mouldName' },
    { title: '类型', dataIndex: 'mouldType', render: (v: number) => <Tag>{typeMap[v] ?? v}</Tag> },
    { title: '默认', dataIndex: 'isDefault', render: (v: number) => (v === 1 ? '是' : '否') },
    {
      title: '操作',
      width: 140,
      render: (_: any, r: DocMould) => (
        <>
          <Button type="link" size="small" onClick={() => openEdit(r)}>
            编辑
          </Button>
          <Popconfirm title="确认删除该模板？" onConfirm={() => onDelete([r.id as number | string])}>
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
          新建模板
        </Button>
      </div>
      <Table rowKey="id" loading={loading} dataSource={list} columns={columns} pagination={false} />
      <Modal
        title={current ? '编辑模板' : '新建模板'}
        open={editOpen}
        onOk={handleSubmit}
        onCancel={() => setEditOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="mouldName" label="模板名" rules={[{ required: true, message: '请输入模板名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="mouldType" label="类型(0HTML 2WORD 3EXCEL 4WPS)">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isDefault" label="是否默认(0/1)">
            <InputNumber min={0} max={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DocMouldPage;
