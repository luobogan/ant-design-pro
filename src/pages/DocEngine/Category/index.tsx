import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, Modal, Select, Table, Tag, message } from 'antd';
import CategoryTree, { syncCatToUrl } from '../components/CategoryTree';
import { PlusOutlined } from '@ant-design/icons';
import {
  listCategoryTree,
  submitCategory,
  removeCategory,
  type DocSecCategory,
} from '@/services/doc';

/**
 * 内容引擎 - 目录管理页（对齐《落地规范》§4）。
 *
 * 菜单：blade_menu code=docengine_category, path=/docengine/category（category=1 普通菜单）。
 * 权限：菜单/按钮级由 access.ts 按钮树控制；后端 @PreAuth + DataScope 兜底。
 * 写操作用 POST/DELETE（守 G1）；数据经 @/services/doc 服务层。
 */
const DocCategory: React.FC = () => {
  const [list, setList] = useState<DocSecCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [current, setCurrent] = useState<DocSecCategory | null>(null);
  const [form] = Form.useForm();
  const [selectedCat, setSelectedCat] = useState<number | string | undefined>(
    () => new URLSearchParams(window.location.search).get('cat') || undefined,
  );

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listCategoryTree();
      setList(data || []);
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
    form.setFieldsValue({ parentId: 0, maxUploadFileSize: 5, nodownload: 0, editionIsOpen: 0 });
    setEditOpen(true);
  };

  const openEdit = (r: DocSecCategory) => {
    setCurrent(r);
    form.setFieldsValue({ ...r });
    setEditOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      await submitCategory({ ...(current || {}), ...values });
      message.success('保存成功');
      setEditOpen(false);
      reload();
    } catch (e: any) {
      message.error(e?.msg || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (r: DocSecCategory) => {
    Modal.confirm({
      title: `确认删除目录「${r.name}」？`,
      content: '存在下级目录将禁止删除',
      onOk: async () => {
        try {
          await removeCategory(r.id as number | string);
          message.success('已删除');
          reload();
        } catch (e: any) {
          message.error(e?.msg || '删除失败');
        }
      },
    });
  };

  const yesNo = [
    { value: 0, label: '否' },
    { value: 1, label: '是' },
  ];

  const columns = [
    { title: '目录名', dataIndex: 'name' },
    { title: '上级ID', dataIndex: 'parentId' },
    { title: '编号前缀', dataIndex: 'coder' },
    { title: '上传限制(MB)', dataIndex: 'maxUploadFileSize' },
    {
      title: '禁下载',
      dataIndex: 'nodownload',
      render: (v: number) => (v === 1 ? <Tag color="red">是</Tag> : <Tag>否</Tag>),
    },
    {
      title: '版本管理',
      dataIndex: 'editionIsOpen',
      render: (v: number) => (v === 1 ? '开' : '关'),
    },
    {
      title: '操作',
      width: 140,
      render: (_: any, r: DocSecCategory) => (
        <>
          <Button type="link" size="small" onClick={() => openEdit(r)}>
            编辑
          </Button>
          <Button type="link" size="small" danger onClick={() => handleDelete(r)}>
            删除
          </Button>
        </>
      ),
    },
  ];

  const filtered = useMemo(() => {
    if (!selectedCat) return list;
    const childMap = new Map<string, string[]>();
    list.forEach((c) => {
      const pid = c.parentId === 0 || c.parentId == null ? '0' : String(c.parentId);
      if (!childMap.has(pid)) childMap.set(pid, []);
      childMap.get(pid)!.push(String(c.id));
    });
    const ids = new Set<string>();
    const stack = [String(selectedCat)];
    while (stack.length) {
      const cur = stack.pop()!;
      ids.add(cur);
      (childMap.get(cur) || []).forEach((c) => stack.push(c));
    }
    return list.filter((c) => ids.has(String(c.id)));
  }, [list, selectedCat]);

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <Card size="small" title="目录树" style={{ width: 240, flex: '0 0 240px' }}>
        <CategoryTree
          selectedId={selectedCat}
          onSelect={(id) => {
            setSelectedCat(id);
            syncCatToUrl(id);
          }}
          height={520}
        />
      </Card>
      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            新建目录
          </Button>
        </div>
        <Table rowKey="id" loading={loading} dataSource={filtered} columns={columns} pagination={false} />
        <Modal
        title={current ? '编辑目录' : '新建目录'}
        open={editOpen}
        onOk={handleSubmit}
        confirmLoading={submitting}
        onCancel={() => setEditOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="目录名"
            rules={[{ required: true, message: '请输入目录名' }]}
          >
            <Input placeholder="目录名" />
          </Form.Item>
          <Form.Item name="parentId" label="上级目录ID" initialValue={0}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="coder" label="编号前缀">
            <Input placeholder="编号前缀" />
          </Form.Item>
          <Form.Item name="maxUploadFileSize" label="上传大小限制(MB)">
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item name="nodownload" label="禁止下载">
            <Select options={yesNo} />
          </Form.Item>
          <Form.Item name="editionIsOpen" label="开启版本管理">
            <Select options={yesNo} />
          </Form.Item>
        </Form>
      </Modal>
      </div>
    </div>
  );
};

export default DocCategory;
