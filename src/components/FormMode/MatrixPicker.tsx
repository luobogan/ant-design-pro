import React, { useEffect, useMemo, useState } from 'react';
import { Input, Modal, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import * as matrixApi from '@/pages/System/Matrix/service';

/**
 * 通用「组织矩阵」选择弹窗。
 *
 * <p>对齐 PersonOrgPicker 的使用方式：value 为 id 逗号串，onOk 返回 ids + items。
 * 供授权对象选择、权限配置等场景统一复用，避免各页面手写矩阵下拉。</p>
 */
export interface MatrixPickerProps {
  open: boolean;
  /** 是否多选，默认 true */
  multiple?: boolean;
  /** 当前值，id 逗号串 */
  value?: string;
  title?: string;
  onOk: (ids: string[], items: any[]) => void;
  onCancel: () => void;
}

const MatrixPicker: React.FC<MatrixPickerProps> = ({
  open,
  multiple = true,
  value,
  title = '选择矩阵',
  onOk,
  onCancel,
}) => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setSelected((value || '').split(',').filter(Boolean));
    setKeyword('');
    let cancelled = false;
    setLoading(true);
    matrixApi.list()
      .then((res: any) => {
        const arr = Array.isArray(res) ? res : res?.data;
        if (!cancelled && Array.isArray(arr)) setRows(arr);
      })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, value]);

  const filteredRows = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter((m) => String(m.matrixName || '').toLowerCase().includes(kw)
      || String(m.matrixDesc || '').toLowerCase().includes(kw));
  }, [rows, keyword]);

  const columns: ColumnsType<any> = [
    { title: '矩阵名称', dataIndex: 'matrixName', width: 220 },
    { title: '说明', dataIndex: 'matrixDesc', ellipsis: true },
    {
      title: '类型',
      dataIndex: 'isSystem',
      width: 120,
      render: (v) => (
        <Tag color={Number(v) === 0 ? 'blue' : 'default'}>
          {Number(v) === 0 ? '自定义矩阵' : Number(v) === 1 ? '分部系统矩阵' : Number(v) === 2 ? '部门系统矩阵' : '系统矩阵'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v) => <Tag color={Number(v) === 0 ? 'default' : 'success'}>{Number(v) === 0 ? '停用' : '启用'}</Tag>,
    },
  ];

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={() => {
        const items = rows.filter((m) => selected.includes(String(m.id)));
        onOk(selected, items);
      }}
      okText="确定"
      cancelText="取消"
      width={820}
      destroyOnHidden
    >
      <Input.Search
        allowClear
        style={{ width: 280, marginBottom: 12 }}
        placeholder="搜索矩阵名称/说明"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
      />
      <Table
        rowKey={(r) => String(r.id)}
        size="small"
        loading={loading}
        columns={columns}
        dataSource={filteredRows}
        pagination={{ pageSize: 8, showSizeChanger: false }}
        rowSelection={{
          selectedRowKeys: selected,
          onChange: (keys) => setSelected(keys.map(String)),
          getCheckboxProps: () => ({ disabled: false }),
        }}
      />
    </Modal>
  );
};

export default MatrixPicker;
