import React, { useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { TableProps } from 'antd';
import dayjs from 'dayjs';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { PortalRepository } from './repository';
import { tableFields, visibleFields } from './modules';
import type { FieldDef, ModuleDef, PortalRecord } from './types';

const { Text } = Typography;

/** 内联编辑态：create=新增，edit=编辑 */
type EditState = { mode: 'create' | 'edit'; id?: number } | null;

const EMPTY_FILTERS: Record<string, any> = {};

/**
 * 右侧内容面板：数据详情 + 内联表单 + 查询/增删改，全部在页面内完成。
 * 刻意不使用 Modal / Drawer / Popconfirm —— 删除采用行内二次确认。
 */
const ResourcePanel: React.FC<{ module: ModuleDef }> = ({ module }) => {
  const [form] = Form.useForm<Record<string, any>>();
  const repo = useMemo(() => new PortalRepository(module.key, module.seed), [module.key, module.seed]);

  const [keyword, setKeyword] = useState('');
  const [filters, setFilters] = useState<Record<string, any>>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<{ keyword: string; filters: Record<string, any> }>({
    keyword: '',
    filters: EMPTY_FILTERS,
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editing, setEditing] = useState<EditState>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);

  const formFields = useMemo(() => visibleFields(module, 'form'), [module]);
  const queryFields = useMemo(
    () => visibleFields(module, 'query').filter((f) => f.type === 'select'),
    [module],
  );
  const cols = useMemo(() => tableFields(module), [module]);
  const switchField = useMemo(() => module.fields.find((f) => f.type === 'switch'), [module]);

  // 仓储为内存态，直接读取以保证增删改后即时反映
  const result = repo.list({ keyword: applied.keyword, filters: applied.filters, page, pageSize });
  const allRows = repo.list({ page: 1, pageSize: Number.MAX_SAFE_INTEGER }).list;
  const detailRow = detailId != null ? repo.get(detailId) : undefined;

  /** 表单值 -> 记录值（日期归一化、开关归一化为 1/0） */
  const fromFormValues = (values: Record<string, any>): Record<string, any> => {
    const out: Record<string, any> = {};
    formFields.forEach((f) => {
      const v = values[f.name];
      if (f.type === 'date') out[f.name] = v ? dayjs(v).format('YYYY-MM-DD') : '';
      else if (f.type === 'switch') out[f.name] = v ? 1 : 0;
      else out[f.name] = v === undefined || v === null ? '' : v;
    });
    return out;
  };

  /** 记录值 -> 表单值 */
  const toFormValues = (row?: PortalRecord): Record<string, any> => {
    const out: Record<string, any> = {};
    formFields.forEach((f) => {
      if (f.type === 'date') {
        const raw = row?.[f.name];
        out[f.name] = raw ? dayjs(raw) : undefined;
      } else if (f.type === 'switch') {
        out[f.name] = row ? Number(row[f.name]) === 1 : Number(f.initialValue ?? 0) === 1;
      } else {
        out[f.name] = row ? row[f.name] : f.initialValue;
      }
    });
    return out;
  };

  const renderControl = (f: FieldDef) => {
    switch (f.type) {
      case 'textarea':
        return <Input.TextArea rows={3} placeholder={f.placeholder ?? `请输入${f.label}`} />;
      case 'number':
        return <InputNumber style={{ width: '100%' }} />;
      case 'select':
        return <Select allowClear options={f.options} placeholder={f.placeholder ?? `请选择${f.label}`} />;
      case 'date':
        return <DatePicker style={{ width: '100%' }} />;
      case 'switch':
        return <Switch />;
      default:
        return <Input allowClear placeholder={f.placeholder ?? `请输入${f.label}`} />;
    }
  };

  const renderCell = (f: FieldDef, v: any, row: PortalRecord) => {
    if (f.render) return f.render(v, row);
    switch (f.type) {
      case 'switch':
        return <Switch size="small" checked={Number(v) === 1} disabled />;
      case 'tag':
        return v ? <Tag color="blue">{String(v)}</Tag> : '-';
      case 'date':
        return v ? String(v) : '-';
      case 'textarea':
        return (
          <Text ellipsis={{ tooltip: String(v ?? '') }} style={{ maxWidth: 240 }}>
            {String(v ?? '-')}
          </Text>
        );
      default:
        return v === undefined || v === null || v === '' ? '-' : String(v);
    }
  };

  const startCreate = () => {
    form.resetFields();
    form.setFieldsValue(toFormValues());
    setDetailId(null);
    setConfirmId(null);
    setEditing({ mode: 'create' });
  };

  const startEdit = (row: PortalRecord) => {
    form.resetFields();
    form.setFieldsValue(toFormValues(row));
    setConfirmId(null);
    setEditing({ mode: 'edit', id: row.id });
  };

  const handleSave = async () => {
    let values: Record<string, any>;
    try {
      values = await form.validateFields();
    } catch {
      return; // 校验失败：提示已由 Form 逐项展示
    }
    const payload = fromFormValues(values);
    if (editing?.mode === 'edit' && editing.id != null) {
      const updated = repo.update(editing.id, payload);
      if (updated) {
        message.success('已保存修改');
        setEditing(null);
        setDetailId(updated.id);
      } else {
        message.error('保存失败：记录不存在');
      }
    } else {
      const created = repo.create(payload);
      message.success('已新增');
      setEditing(null);
      setDetailId(created.id);
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    form.resetFields();
  };

  const doRemove = (id: number) => {
    const ok = repo.remove(id);
    setConfirmId(null);
    if (detailId === id) setDetailId(null);
    if (editing?.id === id) cancelEdit();
    if (ok) message.success('已删除');
    else message.error('删除失败：记录不存在');
  };

  const applyQuery = () => {
    setApplied({ keyword, filters });
    setPage(1);
  };

  const resetQuery = () => {
    setKeyword('');
    setFilters(EMPTY_FILTERS);
    setApplied({ keyword: '', filters: EMPTY_FILTERS });
    setPage(1);
  };

  const renderActions = (row: PortalRecord) => {
    if (confirmId === row.id) {
      return (
        <Space size={4}>
          <Button size="small" type="primary" danger onClick={() => doRemove(row.id)}>
            确认删除
          </Button>
          <Button size="small" onClick={() => setConfirmId(null)}>
            取消
          </Button>
        </Space>
      );
    }
    return (
      <Space size={4}>
        <Button size="small" type="link" onClick={() => setDetailId(row.id)}>
          详情
        </Button>
        {!module.readOnly ? (
          <>
            <Button size="small" icon={<EditOutlined />} onClick={() => startEdit(row)}>
              编辑
            </Button>
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setConfirmId(row.id)}>
              删除
            </Button>
          </>
        ) : null}
      </Space>
    );
  };

  const columns: NonNullable<TableProps<PortalRecord>['columns']> = [
    ...cols.map((f) => ({
      title: f.label,
      dataIndex: f.name,
      key: f.name,
      render: (v: any, row: PortalRecord) => renderCell(f, v, row),
    })),
    {
      title: '操作',
      key: '__action',
      width: 200,
      render: (_: any, row: PortalRecord) => renderActions(row),
    },
  ];

  return (
    <div className="wb-panel">
      {/* 上方：模块信息与统计 */}
      <Card size="small" className="wb-card">
        <div className="wb-panel-head">
          <div>
            <Text strong style={{ fontSize: 16 }}>
              {module.title}
            </Text>
            {module.subtitle ? (
              <div>
                <Text type="secondary">{module.subtitle}</Text>
              </div>
            ) : null}
          </div>
          <Space size="large">
            <Statistic title="记录总数" value={allRows.length} styles={{ content: { fontSize: 18 } }} />
            {switchField ? (
              <Statistic
                title="已启用"
                value={allRows.filter((r) => Number(r[switchField.name]) === 1).length}
                styles={{ content: { fontSize: 18 } }}
              />
            ) : null}
          </Space>
        </div>
      </Card>

      {/* 详情：内联展示，不弹窗 */}
      {detailRow ? (
        <Card
          size="small"
          className="wb-card"
          title="记录详情"
          extra={
            <Button size="small" onClick={() => setDetailId(null)}>
              关闭详情
            </Button>
          }
        >
          <Descriptions bordered size="small" column={3}>
            {module.fields.map((f) => (
              <Descriptions.Item key={f.name} label={f.label}>
                {renderCell(f, detailRow[f.name], detailRow)}
              </Descriptions.Item>
            ))}
          </Descriptions>
        </Card>
      ) : null}

      {/* 内联表单：常驻挂载（保证 setFieldsValue 生效），仅在新增/编辑时展示 */}
      {!module.readOnly ? (
        <Card
          size="small"
          className="wb-card"
          style={{ display: editing ? 'block' : 'none' }}
          title={editing?.mode === 'edit' ? `编辑：${module.title}` : `新增：${module.title}`}
          extra={
            <Space>
              <Button type="primary" size="small" onClick={handleSave}>
                保存
              </Button>
              <Button size="small" onClick={cancelEdit}>
                取消
              </Button>
            </Space>
          }
        >
          <Form form={form} layout="vertical">
            <Row gutter={16}>
              {formFields.map((f) => (
                <Col span={f.span ?? 12} key={f.name}>
                  <Form.Item
                    name={f.name}
                    label={f.label}
                    valuePropName={f.type === 'switch' ? 'checked' : undefined}
                    rules={f.required ? [{ required: true, message: `请填写${f.label}` }] : undefined}
                  >
                    {renderControl(f)}
                  </Form.Item>
                </Col>
              ))}
            </Row>
          </Form>
        </Card>
      ) : null}

      {/* 查询 + 列表 + 操作入口 */}
      <Card size="small" className="wb-card" title={`${module.title}列表`}>
        <Space wrap className="wb-toolbar">
          <Input
            allowClear
            style={{ width: 220 }}
            prefix={<SearchOutlined />}
            placeholder="关键字查询"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={applyQuery}
          />
          {queryFields.map((f) => (
            <Select
              key={f.name}
              allowClear
              style={{ width: 160 }}
              placeholder={f.label}
              options={f.options}
              value={filters[f.name]}
              onChange={(v) => setFilters((prev) => ({ ...prev, [f.name]: v }))}
            />
          ))}
          <Button type="primary" onClick={applyQuery}>
            查询
          </Button>
          <Button onClick={resetQuery}>重置</Button>
          <Button icon={<ReloadOutlined />} onClick={resetQuery}>
            刷新
          </Button>
          {!module.readOnly ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={startCreate}>
              新增
            </Button>
          ) : null}
        </Space>

        <Table<PortalRecord>
          rowKey="id"
          size="small"
          className="wb-table"
          columns={columns}
          dataSource={result.list}
          scroll={{ x: 'max-content' }}
          onRow={(row) => ({ onClick: () => setDetailId(row.id), style: { cursor: 'pointer' } })}
          pagination={{
            current: result.page,
            pageSize: result.pageSize,
            total: result.total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
      </Card>
    </div>
  );
};

export default ResourcePanel;