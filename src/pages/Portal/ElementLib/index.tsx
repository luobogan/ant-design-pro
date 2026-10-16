import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { PlusOutlined, ReloadOutlined, RocketOutlined } from '@ant-design/icons';
import { portalApi, ELEMENT_TYPE_META } from '@/services/portal';
import { usePageButtons } from '@/hooks/usePageButtons';
import type {
  ElementType,
  PortalElementLib,
  PortalElementLibSaveData,
  PortalPage,
  PortalPageBrief,
} from '@/services/portal';

const { Text } = Typography;

/**
 * 门户独立元素库（对标 hpBaseElement / HPELEMENTTEMPLATE，§12.5 P3）
 * 元素定义入库可复用；页面元素记 lib_id 引用；封存后不可新引、既有引用继续有效；被引用时禁止删除。
 */
const PortalElementLibManage: React.FC = () => {
  const { buttons } = usePageButtons('portal');
  const canManage = buttons.some((b: any) => b.code === 'portal_element_lib_manage');

  const [list, setList] = useState<PortalElementLib[]>([]);
  const [pages, setPages] = useState<PortalPage[]>([]);
  const [loading, setLoading] = useState(true);

  /* 新建/编辑 */
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<PortalElementLib | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<PortalElementLibSaveData>();

  /* 引用页面 */
  const [refOpen, setRefOpen] = useState(false);
  const [refLib, setRefLib] = useState<PortalElementLib | null>(null);
  const [refs, setRefs] = useState<PortalPageBrief[]>([]);
  const [refLoading, setRefLoading] = useState(false);

  /* 实例化到页面 */
  const [instOpen, setInstOpen] = useState(false);
  const [instLib, setInstLib] = useState<PortalElementLib | null>(null);
  const [installing, setInstalling] = useState(false);
  const [instForm] = Form.useForm<{ pageId: number; rowNo?: number; colSpan?: number }>();

  /* 预览 */
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLib, setPreviewLib] = useState<PortalElementLib | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [libRes, pageRes] = await Promise.all([
        portalApi.getElementLibList(),
        portalApi.getPageList(),
      ]);
      setList(libRes || []);
      setPages(pageRes || []);
    } catch (e) {
      console.error('[portal] 加载元素库失败', e);
      message.error('加载失败');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setEditOpen(true);
  };

  const openEdit = (record: PortalElementLib) => {
    setEditing(record);
    form.setFieldsValue({
      libId: record.id,
      elementType: record.elementType,
      elementName: record.elementName,
      configJson: record.configJson,
      styleJson: record.styleJson,
      remark: record.remark,
    });
    setEditOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const id = await portalApi.submitElementLib({
        libId: editing?.id,
        elementType: values.elementType,
        elementName: values.elementName,
        configJson: values.configJson,
        styleJson: values.styleJson,
        remark: values.remark,
      });
      if (id != null) {
        message.success(editing ? '已更新' : '已创建');
        setEditOpen(false);
        load();
      } else {
        message.error('保存失败：请检查类型与名称');
      }
    } catch (e) {
      console.error('[portal] 保存库元素失败', e);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (record: PortalElementLib) => {
    const archived = record.status !== 0;
    try {
      const ok = await portalApi.archiveElementLib(record.id as number, archived);
      if (ok) {
        message.success(archived ? '已封存' : '已解封');
        load();
      } else {
        message.error('操作失败');
      }
    } catch (e) {
      console.error('[portal] 封存库元素失败', e);
      message.error('操作失败');
    }
  };

  const handleRemove = async (record: PortalElementLib) => {
    try {
      const ok = await portalApi.removeElementLib(record.id as number);
      if (ok) {
        message.success('已删除');
        load();
      } else {
        message.error('删除失败：该库元素已被页面引用');
      }
    } catch (e) {
      console.error('[portal] 删除库元素失败', e);
      message.error('删除失败');
    }
  };

  const openReferences = async (record: PortalElementLib) => {
    setRefLib(record);
    setRefOpen(true);
    setRefLoading(true);
    try {
      setRefs((await portalApi.getElementLibReferences(record.id as number)) || []);
    } catch (e) {
      console.error('[portal] 加载引用页面失败', e);
      message.error('加载失败');
      setRefs([]);
    } finally {
      setRefLoading(false);
    }
  };

  const openInstantiate = (record: PortalElementLib) => {
    setInstLib(record);
    instForm.resetFields();
    instForm.setFieldsValue({ rowNo: 1, colSpan: 12 });
    setInstOpen(true);
  };

  const openPreview = (record: PortalElementLib) => {
    setPreviewLib(record);
    setPreviewOpen(true);
  };

  const handleInstantiate = async () => {
    if (!instLib) return;
    const values = await instForm.validateFields();
    setInstalling(true);
    try {
      const id = await portalApi.instantiateElementLib({
        libId: instLib.id as number,
        pageId: values.pageId,
        rowNo: values.rowNo || 1,
        colSpan: values.colSpan || 12,
      });
      if (id != null) {
        message.success('已添加到目标页面');
        setInstOpen(false);
      } else {
        message.error('添加失败：库元素已封存或参数非法');
      }
    } catch (e) {
      console.error('[portal] 实例化库元素失败', e);
      message.error('添加失败');
    } finally {
      setInstalling(false);
    }
  };

  const columns = [
    {
      title: '元素名称',
      dataIndex: 'elementName',
      key: 'elementName',
      render: (v: string, r: PortalElementLib) => (
        <Space>
          <Text strong>{v}</Text>
          {r.status === 0 ? <Tag color="orange">已封存</Tag> : <Tag color="blue">正常</Tag>}
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'elementType',
      key: 'elementType',
      width: 120,
      render: (v: string) => ELEMENT_TYPE_META[v as ElementType]?.label || v,
    },
    { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true },
    {
      title: '操作',
      key: 'actions',
      width: 300,
      render: (_: any, record: PortalElementLib) => (
        <Space size={4} wrap>
          <Button type="link" size="small" onClick={() => openPreview(record)}>
            预览
          </Button>
          <Button type="link" size="small" icon={<RocketOutlined />} onClick={() => openInstantiate(record)}>
            实例化到页面
          </Button>
          <Button type="link" size="small" onClick={() => openReferences(record)}>
            引用页面
          </Button>
          <Button type="link" size="small" disabled={!canManage} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Button type="link" size="small" disabled={!canManage} onClick={() => handleArchive(record)}>
            {record.status === 0 ? '解封' : '封存'}
          </Button>
          <Popconfirm
            title="删除库元素"
            description="已被页面引用的库元素不可删除。"
            okText="删除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={() => handleRemove(record)}
          >
            <Button type="link" size="small" danger disabled={!canManage}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          门户元素库
        </Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} disabled={!canManage} onClick={openCreate}>
            新建库元素
          </Button>
        </Space>
      </Space>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="提示"
        description="库元素可被多个页面「实例化」引用；封存后不可再新引，既有引用继续有效；被引用时不可删除。"
      />

      <Table rowKey="id" loading={loading} columns={columns as any} dataSource={list} pagination={false} />

      {/* 新建/编辑 */}
      <Modal
        title={editing ? '编辑库元素' : '新建库元素'}
        open={editOpen}
        onOk={handleSubmit}
        confirmLoading={saving}
        onCancel={() => setEditOpen(false)}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="elementType" label="元素类型" rules={[{ required: true, message: '请选择元素类型' }]}>
            <Select
              options={Object.keys(ELEMENT_TYPE_META).map((t) => ({
                value: t,
                label: ELEMENT_TYPE_META[t as ElementType]?.label || t,
              }))}
            />
          </Form.Item>
          <Form.Item name="elementName" label="元素名称" rules={[{ required: true, message: '请输入元素名称' }]}>
            <Input placeholder="如：常用快捷入口" maxLength={64} />
          </Form.Item>
          <Form.Item name="configJson" label="配置 JSON" extra="如 links：{&quot;links&quot;:[{&quot;name&quot;:&quot;xx&quot;,&quot;url&quot;:&quot;/xx&quot;}]}；rich：{&quot;html&quot;:&quot;...&quot;}">
            <Input.TextArea rows={5} placeholder='{"perPage":8}' />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input maxLength={255} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 引用页面 */}
      <Modal
        title={`引用页面 · ${refLib?.elementName || ''}`}
        open={refOpen}
        onCancel={() => setRefOpen(false)}
        footer={<Button onClick={() => setRefOpen(false)}>关闭</Button>}
        destroyOnHidden
      >
        {refLoading ? (
          <div style={{ padding: 24, textAlign: 'center' }}>加载中…</div>
        ) : refs.length === 0 ? (
          <Text type="secondary">暂无页面引用该库元素</Text>
        ) : (
          <Space size={[8, 8]} wrap>
            {refs.map((p) => (
              <Tag key={p.id} color="blue">
                {p.pageName}（{p.pageCode}）
              </Tag>
            ))}
          </Space>
        )}
      </Modal>

      {/* 实例化到页面 */}
      <Modal
        title={`实例化到页面 · ${instLib?.elementName || ''}`}
        open={instOpen}
        onOk={handleInstantiate}
        confirmLoading={installing}
        onCancel={() => setInstOpen(false)}
        okText="添加"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={instForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="pageId" label="目标页面" rules={[{ required: true, message: '请选择目标页面' }]}>
            <Select
              placeholder="选择要加入的门户页"
              options={pages.map((p) => ({ value: p.id as number, label: p.pageName }))}
            />
          </Form.Item>
          <Form.Item name="rowNo" label="行号" initialValue={1}>
            <Input type="number" min={1} />
          </Form.Item>
          <Form.Item name="colSpan" label="宽度" initialValue={12}>
            <Select
              options={[
                { value: 6, label: '1/4 宽' },
                { value: 8, label: '1/3 宽' },
                { value: 12, label: '1/2 宽' },
                { value: 16, label: '2/3 宽' },
                { value: 24, label: '通栏' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 预览（按元素类型渲染配置内容） */}
      <Modal
        title={`预览 · ${previewLib?.elementName || ''}`}
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={<Button onClick={() => setPreviewOpen(false)}>关闭</Button>}
        destroyOnHidden
      >
        {(() => {
          let cfg: Record<string, any> = {};
          try {
            cfg = JSON.parse(previewLib?.configJson || '{}') || {};
          } catch {
            cfg = {};
          }
          const type = previewLib?.elementType;
          const meta = ELEMENT_TYPE_META[type as ElementType];
          if (type === 'links') {
            const links = Array.isArray(cfg.links) ? cfg.links : [];
            return links.length ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {links.map((l: any, i: number) => (
                  <div
                    key={i}
                    style={{ textAlign: 'center', padding: '10px 4px', border: '1px solid #f0f0f0', borderRadius: 8 }}
                  >
                    <div style={{ fontSize: 20 }}>{l.icon || '🔗'}</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>{l.name}</div>
                  </div>
                ))}
              </div>
            ) : (
              <Text type="secondary">未配置入口</Text>
            );
          }
          if (type === 'rich') {
            return (
              <div
                style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12, minHeight: 80 }}
                // 富文本为管理员在元素库中维护的受信内容
                dangerouslySetInnerHTML={{ __html: cfg.html || '' }}
              />
            );
          }
          if (type === 'chart') {
            const data = Array.isArray(cfg.data) ? cfg.data : [];
            const xf = cfg.xField || 'x';
            const yf = cfg.yField || 'y';
            return (
              <div>
                <Space wrap>
                  <Tag color="geekblue">类型：{cfg.chartType || 'column'}</Tag>
                  <Tag>
                    字段：{xf} / {yf}
                  </Tag>
                  <Tag>{data.length} 条数据</Tag>
                </Space>
                {data.length > 0 && (
                  <table style={{ width: '100%', marginTop: 8, borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', borderBottom: '1px solid #f0f0f0', padding: '4px 0' }}>{xf}</th>
                        <th style={{ textAlign: 'left', borderBottom: '1px solid #f0f0f0', padding: '4px 0' }}>{yf}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.slice(0, 8).map((d: any, i: number) => (
                        <tr key={i}>
                          <td>{String(d?.[xf] ?? '')}</td>
                          <td>{String(d?.[yf] ?? '')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          }
          return (
            <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>
              <div style={{ fontSize: 28 }}>{meta?.icon || '🧩'}</div>
              <div style={{ marginTop: 8 }}>{meta?.label || type} 类型元素在门户中按实时数据渲染</div>
              {cfg.perPage ? (
                <Tag style={{ marginTop: 8 }}>显示条数：{cfg.perPage}</Tag>
              ) : null}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};

export default PortalElementLibManage;
