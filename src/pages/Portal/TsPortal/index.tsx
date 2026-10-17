import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tabs, Tag, Typography, message } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { portalApi } from '@/services/portal';
import { usePageButtons } from '@/hooks/usePageButtons';
import type { PortalGridLayout, PortalGridLayoutSaveData, PortalPageShare } from '@/services/portal';
import PortalShareEditor, { type ShareItem } from '../components/PortalShareEditor';

const { Text } = Typography;

/** 布局类型选项（对标 hp_grid_layout layout_type） */
const LAYOUT_TYPES = [
  { value: 'theme', label: '登录后门户' },
  { value: 'login', label: '登录前门户' },
];

/**
 * 特色门户（门户网格布局，对标泛微 tsportal §16.2）
 * 后端：/grid-layout/{list,submit,remove,set-use,set-default-entrance,share/list,share/set}
 * 命名澄清：泛微前端标签为「特色门户」，后端实为门户网格布局 hp_grid_layout；
 * 无定时切换逻辑（定时只属于登录皮肤）。layout_default_entrance 同类型内唯一。
 */
const PortalTsPortal: React.FC = () => {
  const { buttons } = usePageButtons('portal');
  const canManage = buttons.some((b: any) => b.code === 'portal_ts_portal_manage');

  const [list, setList] = useState<PortalGridLayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PortalGridLayout | null>(null);
  const [activeTab, setActiveTab] = useState('theme');
  const [form] = Form.useForm<PortalGridLayoutSaveData>();

  /* 使用限制（共享） */
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<PortalGridLayout | null>(null);
  const [shareAll, setShareAll] = useState(false);
  const [shareItems, setShareItems] = useState<ShareItem[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSaving, setShareSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await portalApi.getGridLayoutList();
      setList(data || []);
    } catch (e) {
      console.error('[portal] 加载特色门户布局失败', e);
      message.error('加载特色门户布局失败');
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
    form.setFieldsValue({ layoutType: activeTab, layoutUse: 1, layoutDefaultEntrance: 0 });
    setModalOpen(true);
  };

  const openEdit = (row: PortalGridLayout) => {
    setEditing(row);
    form.setFieldsValue({
      id: row.id,
      layoutType: row.layoutType,
      layoutName: row.layoutName,
      layoutTitle: row.layoutTitle,
      layoutConfig: row.layoutConfig,
      layoutBackground: row.layoutBackground,
      layoutUse: row.layoutUse ?? 0,
      layoutDefaultEntrance: row.layoutDefaultEntrance ?? 0,
      remark: row.remark,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const ok = await portalApi.submitGridLayout(values);
      if (ok) {
        message.success(editing ? '已保存' : '已创建');
        setModalOpen(false);
        load();
      } else {
        message.error('保存失败（同类型下布局名称不可重复）');
      }
    } catch (e) {
      console.error('[portal] 保存特色门户布局失败', e);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id?: number) => {
    if (id == null) return;
    try {
      const ok = await portalApi.removeGridLayout(id);
      if (ok) {
        message.success('已删除');
        load();
      } else {
        message.error('删除失败（默认入口不可删，请先取消默认）');
      }
    } catch (e) {
      console.error('[portal] 删除特色门户布局失败', e);
      message.error('删除失败');
    }
  };

  const handleSetUse = async (row: PortalGridLayout, use: boolean) => {
    if (row.id == null) return;
    try {
      const ok = await portalApi.setGridLayoutUse(row.id, use);
      if (ok) {
        message.success(use ? '已启用' : '已停用');
        load();
      } else {
        message.error('操作失败');
      }
    } catch (e) {
      console.error('[portal] 切换特色门户启用状态失败', e);
      message.error('操作失败');
    }
  };

  const handleSetDefault = async (id?: number) => {
    if (id == null) return;
    try {
      const ok = await portalApi.setGridLayoutDefaultEntrance(id);
      if (ok) {
        message.success('已设为默认入口');
        load();
      } else {
        message.error('设置失败');
      }
    } catch (e) {
      console.error('[portal] 设置默认入口失败', e);
      message.error('设置失败');
    }
  };

  const openShare = async (row: PortalGridLayout) => {
    if (row.id == null) return;
    setShareTarget(row);
    setShareOpen(true);
    setShareLoading(true);
    try {
      const shares = (await portalApi.getGridLayoutShareList(row.id)) || [];
      applyShares(shares);
    } catch (e) {
      console.error('[portal] 加载特色门户使用限制失败', e);
      message.error('加载使用限制失败');
    } finally {
      setShareLoading(false);
    }
  };

  const applyShares = (shares: PortalPageShare[]) => {
    const all = shares.some((s) => s.shareType === 1);
    const items: ShareItem[] = shares
      .filter((s) => s.shareType !== 1 && s.shareId != null)
      .map((s) => ({ shareType: s.shareType as number, shareId: s.shareId as number }));
    setShareAll(all);
    setShareItems(items);
  };

  const handleShareSave = async () => {
    if (shareTarget?.id == null) return;
    setShareSaving(true);
    try {
      const shares: PortalPageShare[] = shareAll
        ? [{ shareType: 1, shareId: 0 }]
        : shareItems.map((i) => ({ shareType: i.shareType, shareId: i.shareId }));
      const ok = await portalApi.saveGridLayoutShare(shareTarget.id, shares);
      if (ok) {
        message.success('已保存使用限制');
        setShareOpen(false);
      } else {
        message.error('保存失败');
      }
    } catch (e) {
      console.error('[portal] 保存特色门户使用限制失败', e);
      message.error('保存失败');
    } finally {
      setShareSaving(false);
    }
  };

  const columns = [
    { title: '布局名称', dataIndex: 'layoutName', key: 'layoutName' },
    { title: '标题', dataIndex: 'layoutTitle', key: 'layoutTitle', render: (v: string) => v || <Text type="secondary">-</Text> },
    {
      title: '类型',
      dataIndex: 'layoutType',
      key: 'layoutType',
      width: 120,
      render: (v: string) =>
        v === 'login' ? <Tag color="orange">登录前门户</Tag> : <Tag color="blue">登录后门户</Tag>,
    },
    {
      title: '状态',
      key: 'status',
      width: 150,
      render: (_: any, row: PortalGridLayout) => (
        <Space size={4}>
          {row.layoutUse === 1 ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>}
          {row.layoutDefaultEntrance === 1 && <Tag color="gold">默认入口</Tag>}
        </Space>
      ),
    },
    { title: '版本', dataIndex: 'layoutVersion', key: 'layoutVersion', width: 70 },
    {
      title: '背景',
      dataIndex: 'layoutBackground',
      key: 'layoutBackground',
      render: (v: string) => (v ? <Text code ellipsis style={{ maxWidth: 140 }}>{v}</Text> : <Text type="secondary">-</Text>),
    },
    {
      title: '操作',
      key: 'op',
      width: 260,
      render: (_: any, row: PortalGridLayout) => (
        <Space size={4} wrap>
          <Button type="link" size="small" onClick={() => openEdit(row)} disabled={!canManage}>
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => handleSetUse(row, row.layoutUse !== 1)}
            disabled={!canManage}
          >
            {row.layoutUse === 1 ? '停用' : '启用'}
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => handleSetDefault(row.id)}
            disabled={!canManage || row.layoutDefaultEntrance === 1}
          >
            设默认入口
          </Button>
          <Button type="link" size="small" onClick={() => openShare(row)} disabled={!canManage}>
            使用限制
          </Button>
          <Popconfirm title="确认删除该布局？" onConfirm={() => handleRemove(row.id)} disabled={!canManage}>
            <Button type="link" size="small" danger disabled={!canManage}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      {!canManage && (
        <Alert type="info" showIcon style={{ marginBottom: 12 }} message="只读模式：需要「特色门户」按钮权限才能维护" />
      )}
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} disabled={!canManage}>
          新建布局
        </Button>
        <Button icon={<ReloadOutlined />} onClick={load}>
          刷新
        </Button>
      </Space>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={LAYOUT_TYPES.map((t) => ({
          key: t.value,
          label: t.label,
          children: (
            <Table
              rowKey="id"
              loading={loading}
              dataSource={list.filter((l) => l.layoutType === t.value)}
              columns={columns as any}
              pagination={false}
              size="middle"
            />
          ),
        }))}
      />

      <Modal
        title={editing ? '编辑网格布局' : '新建网格布局'}
        open={modalOpen}
        onOk={handleSubmit}
        confirmLoading={saving}
        onCancel={() => setModalOpen(false)}
        destroyOnHidden
        width={640}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="布局类型" name="layoutType" rules={[{ required: true, message: '请选择布局类型' }]}>
            <Select options={LAYOUT_TYPES} />
          </Form.Item>
          <Form.Item label="布局名称" name="layoutName" rules={[{ required: true, message: '请输入布局名称' }]}>
            <Input placeholder="同类型内唯一" maxLength={128} />
          </Form.Item>
          <Form.Item label="布局标题" name="layoutTitle">
            <Input placeholder="展示用标题" maxLength={255} />
          </Form.Item>
          <Form.Item label="背景配置" name="layoutBackground">
            <Input placeholder="背景色（如 #F5F7FA）或背景图URL" maxLength={512} />
          </Form.Item>
          <Form.Item
            label="网格布局配置JSON"
            name="layoutConfig"
            extra="五区元素清单（top/bottom/left/right/middle），保存后版本号自动 +1"
          >
            <Input.TextArea
              rows={6}
              placeholder='{"top":[],"bottom":[],"left":[],"right":[],"middle":[]}'
            />
          </Form.Item>
          <Form.Item label="启用" name="layoutUse" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="设为默认入口" name="layoutDefaultEntrance" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input maxLength={255} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`使用限制 - ${shareTarget?.layoutName || ''}`}
        open={shareOpen}
        onOk={handleShareSave}
        confirmLoading={shareSaving}
        onCancel={() => setShareOpen(false)}
        destroyOnHidden
      >
        {shareLoading ? (
          <div style={{ padding: 24, textAlign: 'center' }}>加载中...</div>
        ) : (
          <PortalShareEditor all={shareAll} onAllChange={setShareAll} items={shareItems} onItemsChange={setShareItems} />
        )}
      </Modal>
    </div>
  );
};

export default PortalTsPortal;
