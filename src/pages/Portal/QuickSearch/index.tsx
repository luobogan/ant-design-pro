import { useCallback, useEffect, useState } from 'react';
import { Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography, message } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { portalApi } from '@/services/portal';
import { usePageButtons } from '@/hooks/usePageButtons';
import type { PortalQuickSearch, PortalQuickSearchSaveData, PortalPageShare } from '@/services/portal';
import PortalShareEditor, { type ShareItem } from '../components/PortalShareEditor';

const { Text } = Typography;

/**
 * 快捷搜索管理（对标泛微 quicksearchmanage §14.2 H）
 * 后端：/quick-search/list、/quick-search/submit、/quick-search/remove、
 *       /quick-search/share/list、/quick-search/share/set
 * 总开关在「门户应用设置 → quickSearchEnabled」（blade_portal_setting）。
 */
const PortalQuickSearch: React.FC = () => {
  const { buttons } = usePageButtons('portal');
  const canManage = buttons.some((b: any) => b.code === 'portal_quick_search_manage');

  const [list, setList] = useState<PortalQuickSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PortalQuickSearch | null>(null);
  const [form] = Form.useForm<PortalQuickSearchSaveData>();

  /* 使用限制（共享） */
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<PortalQuickSearch | null>(null);
  const [shareAll, setShareAll] = useState(false);
  const [shareItems, setShareItems] = useState<ShareItem[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSaving, setShareSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await portalApi.getQuickSearchList();
      setList(data || []);
    } catch (e) {
      console.error('[portal] 加载快捷搜索失败', e);
      message.error('加载快捷搜索失败');
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
    form.setFieldsValue({ module: 'workflow', linkMode: 1, isUse: 1, orderNum: (list.length + 1) * 10 });
    setModalOpen(true);
  };

  const openEdit = (row: PortalQuickSearch) => {
    setEditing(row);
    form.setFieldsValue({
      id: row.id,
      module: row.module,
      type: row.type,
      customName: row.customName,
      icon: row.icon,
      url: row.url,
      linkMode: row.linkMode ?? 1,
      isUse: row.isUse ?? 1,
      orderNum: row.orderNum ?? 0,
      remark: row.remark,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const ok = await portalApi.submitQuickSearch(values);
      if (ok) {
        message.success(editing ? '已保存' : '已创建');
        setModalOpen(false);
        load();
      } else {
        message.error('保存失败（同模块下类型标识不可重复）');
      }
    } catch (e) {
      console.error('[portal] 保存快捷搜索失败', e);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id?: number) => {
    if (id == null) return;
    try {
      const ok = await portalApi.removeQuickSearch(id);
      if (ok) {
        message.success('已删除');
        load();
      } else {
        message.error('删除失败（系统内置类型不可删）');
      }
    } catch (e) {
      console.error('[portal] 删除快捷搜索失败', e);
      message.error('删除失败');
    }
  };

  const openShare = async (row: PortalQuickSearch) => {
    if (row.id == null) return;
    setShareTarget(row);
    setShareOpen(true);
    setShareLoading(true);
    try {
      const shares = (await portalApi.getQuickSearchShareList(row.id)) || [];
      applyShares(shares);
    } catch (e) {
      console.error('[portal] 加载快捷搜索使用限制失败', e);
      message.error('加载使用限制失败');
    } finally {
      setShareLoading(false);
    }
  };

  /** 后端共享行 → 编辑器状态（全员单列；其余按 shareType 映射） */
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
      const ok = await portalApi.saveQuickSearchShare(shareTarget.id, shares);
      if (ok) {
        message.success('已保存使用限制');
        setShareOpen(false);
      } else {
        message.error('保存失败');
      }
    } catch (e) {
      console.error('[portal] 保存快捷搜索使用限制失败', e);
      message.error('保存失败');
    } finally {
      setShareSaving(false);
    }
  };

  const columns = [
    { title: '排序', dataIndex: 'orderNum', key: 'orderNum', width: 70 },
    { title: '显示名', dataIndex: 'customName', key: 'customName' },
    { title: '模块', dataIndex: 'module', key: 'module', width: 110 },
    { title: '类型标识', dataIndex: 'type', key: 'type', width: 120 },
    {
      title: '图标',
      dataIndex: 'icon',
      key: 'icon',
      width: 90,
      render: (v: string) => v || <Text type="secondary">-</Text>,
    },
    {
      title: '链接',
      dataIndex: 'url',
      key: 'url',
      render: (v: string, row: PortalQuickSearch) =>
        v ? (
          <span>
            {v}
            {row.linkMode === 2 && (
              <Tag color="orange" style={{ marginLeft: 8 }}>
                外部
              </Tag>
            )}
          </span>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: '状态',
      dataIndex: 'isUse',
      key: 'isUse',
      width: 90,
      render: (v: number, row: PortalQuickSearch) =>
        v === 1 ? (
          <Tag color="green">启用</Tag>
        ) : (
          <Tag>
            停用
            {row.isSys === 1 ? '（内置）' : ''}
          </Tag>
        ),
    },
    {
      title: '操作',
      key: 'op',
      width: 170,
      render: (_: any, row: PortalQuickSearch) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => openShare(row)} disabled={!canManage}>
            使用限制
          </Button>
          <Button type="link" size="small" onClick={() => openEdit(row)} disabled={!canManage}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除该搜索类型？"
            onConfirm={() => handleRemove(row.id)}
            disabled={!canManage || row.isSys === 1}
          >
            <Button type="link" size="small" danger disabled={!canManage || row.isSys === 1}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} disabled={!canManage}>
          新建搜索类型
        </Button>
        <Button icon={<ReloadOutlined />} onClick={load}>
          刷新
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={list}
        columns={columns as any}
        pagination={false}
        size="middle"
      />

      <Modal
        title={editing ? '编辑搜索类型' : '新建搜索类型'}
        open={modalOpen}
        onOk={handleSubmit}
        confirmLoading={saving}
        onCancel={() => setModalOpen(false)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item label="所属模块" name="module" rules={[{ required: true, message: '请输入所属模块' }]}>
            <Input placeholder="如 workflow/doc/notice" maxLength={64} />
          </Form.Item>
          <Form.Item
            label="类型标识"
            name="type"
            rules={[{ required: true, message: '请输入类型标识（模块内唯一）' }]}
          >
            <Input placeholder="模块内唯一，如 todo" maxLength={64} disabled={editing?.isSys === 1} />
          </Form.Item>
          <Form.Item label="显示名" name="customName" rules={[{ required: true, message: '请输入显示名' }]}>
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item label="图标" name="icon">
            <Input placeholder="antd 图标名或图片URL" maxLength={255} />
          </Form.Item>
          <Form.Item label="跳转地址" name="url">
            <Input placeholder="站内路由或外部URL" maxLength={512} />
          </Form.Item>
          <Form.Item label="链接模式" name="linkMode">
            <Select
              options={[
                { value: 1, label: '站内路由' },
                { value: 2, label: '外部链接' },
              ]}
            />
          </Form.Item>
          <Form.Item label="排序号" name="orderNum">
            <InputNumber min={0} max={9999} style={{ width: 160 }} />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input maxLength={255} />
          </Form.Item>
          <Form.Item label="启用" name="isUse" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`使用限制 - ${shareTarget?.customName || ''}`}
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

export default PortalQuickSearch;
