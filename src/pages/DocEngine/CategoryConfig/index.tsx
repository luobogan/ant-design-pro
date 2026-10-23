import React, { useCallback, useEffect, useState } from 'react';
import {
  Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tabs, message,
} from 'antd';
import {
  listCategoryTree,
  listCoder, saveCoder, deleteCoder,
  listProperty, saveProperty, deleteProperty,
  listApprove, saveApprove, deleteApprove,
  type DocSecCategory, type DocCategoryCoder, type DocCategoryProperty, type DocCategoryApprove,
} from '@/services/doc';

/**
 * 内容引擎 - 目录配置页（菜单 path=/docengine/categoryconfig）。
 * 选目录 → 配置「编号规则 / 文档属性可见性 / 审批工作流明细」三组。
 */
type Kind = 'coder' | 'property' | 'approve';

const CategoryConfig: React.FC = () => {
  const [cats, setCats] = useState<DocSecCategory[]>([]);
  const [catId, setCatId] = useState<number | string | undefined>();
  const [coders, setCoders] = useState<DocCategoryCoder[]>([]);
  const [props, setProps] = useState<DocCategoryProperty[]>([]);
  const [approves, setApproves] = useState<DocCategoryApprove[]>([]);
  const [kind, setKind] = useState<Kind>('coder');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const loadAll = useCallback(async (cid?: number | string) => {
    if (!cid) {
      setCoders([]); setProps([]); setApproves([]); return;
    }
    try {
      const [c, p, a] = await Promise.all([listCoder(cid), listProperty(cid), listApprove(cid)]);
      setCoders(c); setProps(p); setApproves(a);
    } catch (e: any) {
      message.error(e?.msg || '加载失败');
    }
  }, []);

  useEffect(() => { listCategoryTree().then(setCats); }, []);
  useEffect(() => { loadAll(catId); }, [catId, loadAll]);

  const onAdd = () => { setEditing(null); form.resetFields(); setOpen(true); };
  const onEdit = (row: any) => { setEditing(row); form.setFieldsValue(row); setOpen(true); };

  const onSubmit = async () => {
    const v = await form.validateFields();
    const payload = { ...v, id: editing?.id, categoryId: catId };
    try {
      if (kind === 'coder') await saveCoder(payload);
      else if (kind === 'property') await saveProperty(payload);
      else await saveApprove(payload);
      message.success('保存成功');
      setOpen(false);
      loadAll(catId);
    } catch (e: any) {
      message.error(e?.msg || '保存失败');
    }
  };

  const onDel = async (id: number | string) => {
    try {
      if (kind === 'coder') await deleteCoder(id);
      else if (kind === 'property') await deleteProperty(id);
      else await deleteApprove(id);
      message.success('删除成功');
      loadAll(catId);
    } catch (e: any) {
      message.error(e?.msg || '删除失败');
    }
  };

  const actionCol = {
    title: '操作', key: 'op',
    render: (_: any, row: any) => (
      <Space>
        <Button size="small" type="link" onClick={() => onEdit(row)}>编辑</Button>
        <Button size="small" type="link" danger onClick={() => onDel(row.id)}>删除</Button>
      </Space>
    ),
  };

  return (
    <Card>
      <Space style={{ marginBottom: 16 }} wrap>
        <span>目录：</span>
        <Select
          style={{ width: 260 }}
          placeholder="请选择目录"
          value={catId}
          onChange={setCatId}
          options={(cats || []).map((c) => ({ label: c.name, value: c.id }))}
          allowClear
        />
        <Button type="primary" disabled={!catId} onClick={onAdd}>新增</Button>
      </Space>

      <Tabs
        activeKey={kind}
        onChange={(k) => setKind(k as Kind)}
        items={[
          {
            key: 'coder', label: '编号规则',
            children: (
              <Table rowKey="id" size="small" dataSource={coders} pagination={false}
                columns={[
                  { title: '成员类型', dataIndex: 'memberType', render: (v: number) => (['', '固定文本', '日期', '流水号', '自定义字段'][v] ?? v) },
                  { title: '成员值', dataIndex: 'memberValue' },
                  { title: '流水号长度', dataIndex: 'seqLength' },
                  { title: '排序', dataIndex: 'orderNum' },
                  actionCol,
                ]}
              />
            ),
          },
          {
            key: 'property', label: '文档属性可见性',
            children: (
              <Table rowKey="id" size="small" dataSource={props} pagination={false}
                columns={[
                  { title: '属性字段', dataIndex: 'fieldName' },
                  { title: '可见', dataIndex: 'isView', render: (v: number) => (v === 1 ? '是' : '否') },
                  { title: '必填', dataIndex: 'isRequired', render: (v: number) => (v === 1 ? '是' : '否') },
                  { title: '显示顺序', dataIndex: 'viewIndex' },
                  actionCol,
                ]}
              />
            ),
          },
          {
            key: 'approve', label: '审批工作流明细',
            children: (
              <Table rowKey="id" size="small" dataSource={approves} pagination={false}
                columns={[
                  { title: '审批类型', dataIndex: 'approveType', render: (v: number) => (['', '生效审批', '失效审批', '批准'][v] ?? v) },
                  { title: '工作流ID', dataIndex: 'workflowId' },
                  { title: '流程字段ID', dataIndex: 'workflowFieldId' },
                  { title: '文档属性字段ID', dataIndex: 'docPropertyFieldId' },
                  actionCol,
                ]}
              />
            ),
          },
        ]}
      />

      <Modal
        open={open}
        title={editing ? '编辑' : '新增'}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          {kind === 'coder' && (
            <>
              <Form.Item name="memberType" label="成员类型" rules={[{ required: true }]}>
                <Select options={[
                  { label: '固定文本', value: 1 }, { label: '日期', value: 2 },
                  { label: '流水号', value: 3 }, { label: '自定义字段', value: 4 },
                ]} />
              </Form.Item>
              <Form.Item name="memberValue" label="成员值"><Input /></Form.Item>
              <Form.Item name="seqLength" label="流水号长度"><InputNumber min={1} /></Form.Item>
              <Form.Item name="orderNum" label="排序号"><InputNumber min={0} /></Form.Item>
            </>
          )}
          {kind === 'property' && (
            <>
              <Form.Item name="fieldName" label="属性字段名" rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="isView" label="是否可见">
                <Select options={[{ label: '是', value: 1 }, { label: '否', value: 0 }]} />
              </Form.Item>
              <Form.Item name="isRequired" label="是否必填">
                <Select options={[{ label: '是', value: 1 }, { label: '否', value: 0 }]} />
              </Form.Item>
              <Form.Item name="viewIndex" label="显示顺序"><InputNumber min={0} /></Form.Item>
            </>
          )}
          {kind === 'approve' && (
            <>
              <Form.Item name="approveType" label="审批类型" rules={[{ required: true }]}>
                <Select options={[
                  { label: '生效审批', value: 1 }, { label: '失效审批', value: 2 }, { label: '批准', value: 3 },
                ]} />
              </Form.Item>
              <Form.Item name="workflowId" label="工作流ID" rules={[{ required: true }]}><Input /></Form.Item>
              <Form.Item name="workflowFieldId" label="流程字段ID"><Input /></Form.Item>
              <Form.Item name="docPropertyFieldId" label="文档属性字段ID"><Input /></Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </Card>
  );
};

export default CategoryConfig;
