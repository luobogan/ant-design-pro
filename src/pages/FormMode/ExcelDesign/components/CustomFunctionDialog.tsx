import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Modal,
  Table,
  Button,
  Space,
  Input,
  Select,
  Popconfirm,
  message,
  Empty,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { customFormulaApi } from '@/services/formmode';
import type { CustomFormula } from '../utils/formulaUtils';

/** 函数分类（与公式面板内置分组保持一致，另含「自定义函数」默认分组） */
const CATEGORIES = ['常用函数', '数学与三角函数', '文本', '逻辑', '财务', '自定义函数'];

interface Props {
  open: boolean;
  /** 表单ID（可选，新建时作为作用域；不传则为全局） */
  formId?: string;
  onClose: () => void;
  /** 保存/删除成功后通知父级刷新公式面板 */
  onSaved?: () => void;
}

/**
 * 自定义函数管理弹框（对标泛微E9「新建自定义函数」）
 * - 列表：展示已定义函数，支持编辑 / 删除
 * - 新建 / 编辑：子弹窗（750×600），填写 名称 / 描述 / 分类 / JS 代码
 */
export default function CustomFunctionDialog({ open, formId, onClose, onSaved }: Props) {
  const [list, setList] = useState<CustomFormula[]>([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<CustomFormula | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await customFormulaApi.list(formId);
      setList(Array.isArray(data) ? data : []);
    } catch {
      message.warning('加载自定义函数失败');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const openCreate = () => {
    setEditing({ name: '', category: '自定义函数', formulaDesc: '', fnCode: '' });
    setEditOpen(true);
  };

  const openEdit = (rec: CustomFormula) => {
    setEditing({ ...rec });
    setEditOpen(true);
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    try {
      await customFormulaApi.remove(id);
      message.success('已删除');
      load();
      onSaved?.();
    } catch {
      message.error('删除失败');
    }
  };

  const handleSaveEdit = async () => {
    const f = editing;
    if (!f) return;
    if (!/^[A-Z][A-Z0-9_]*$/.test(f.name.trim())) {
      message.warning('函数名需为大写字母/数字/下划线，且以字母开头（如 MYFUNC）');
      return;
    }
    if (!f.fnCode?.trim()) {
      message.warning('请填写函数实现（JS 代码）');
      return;
    }
    try {
      await customFormulaApi.save(
        { ...f, name: f.name.trim(), formulaDesc: f.formulaDesc || '', category: f.category || '自定义函数' },
        formId,
      );
      message.success('已保存');
      setEditOpen(false);
      load();
      onSaved?.();
    } catch {
      message.error('保存失败');
    }
  };

  const columns: ColumnsType<CustomFormula> = useMemo(
    () => [
      {
        title: '函数名',
        dataIndex: 'name',
        width: 160,
        render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code>,
      },
      {
        title: '分类',
        dataIndex: 'category',
        width: 130,
        render: (v: string) => <Tag>{v || '自定义函数'}</Tag>,
      },
      {
        title: '描述',
        dataIndex: 'formulaDesc',
        ellipsis: true,
        render: (v: string) => v || <span style={{ color: '#bbb' }}>—</span>,
      },
      {
        title: '操作',
        width: 130,
        render: (_: any, rec: CustomFormula) => (
          <Space size={4}>
            <Button type="link" size="small" onClick={() => openEdit(rec)}>
              编辑
            </Button>
            <Popconfirm title="确认删除该自定义函数？" onConfirm={() => handleDelete(rec.id)}>
              <Button type="link" size="small" danger>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <Modal
        title="自定义函数"
        open={open}
        onCancel={onClose}
        footer={null}
        width={720}
        destroyOnHidden
      >
        <Space style={{ marginBottom: 8 }}>
          <Button type="primary" onClick={openCreate}>
            新建函数
          </Button>
          <span style={{ color: '#999', fontSize: 12 }}>
            自定义函数可在「插入公式」弹框的函数面板中，像内置函数一样被引用（如 MYFUNC(A1)）
          </span>
        </Space>
        <Table<CustomFormula>
          rowKey={(r) => String(r.id ?? r.name)}
          size="small"
          loading={loading}
          columns={columns}
          dataSource={list}
          pagination={false}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无自定义函数" /> }}
        />
      </Modal>

      <Modal
        title={editing?.id ? '编辑自定义函数' : '新建自定义函数'}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        width={750}
        okText="保存"
        onOk={handleSaveEdit}
        destroyOnHidden
        bodyStyle={{ minHeight: 460 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
              函数名称（公式中引用，如 <code>MYFUNC</code>）
            </div>
            <Input
              value={editing?.name}
              disabled={!!editing?.id}
              placeholder="MYFUNC"
              onChange={(e) => setEditing((p) => ({ ...(p as CustomFormula), name: e.target.value.toUpperCase() }))}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>函数描述</div>
            <Input
              value={editing?.formulaDesc}
              placeholder="例如：计算含税金额"
              onChange={(e) => setEditing((p) => ({ ...(p as CustomFormula), formulaDesc: e.target.value }))}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>分类（公式面板分组）</div>
            <Select
              style={{ width: '100%' }}
              value={editing?.category}
              onChange={(v) => setEditing((p) => ({ ...(p as CustomFormula), category: v }))}
              options={CATEGORIES.map((c) => ({ label: c, value: c }))}
              showSearch
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
              函数实现（JS 代码 / 公式规则）
            </div>
            <Input.TextArea
              value={editing?.fnCode}
              autoSize={{ minRows: 10, maxRows: 16 }}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
              placeholder={'function MYFUNC(a, b) {\n  return a + b;\n}'}
              onChange={(e) => setEditing((p) => ({ ...(p as CustomFormula), fnCode: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
