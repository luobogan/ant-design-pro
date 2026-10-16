import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography, message } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { portalApi } from '@/services/portal';
import { usePageButtons } from '@/hooks/usePageButtons';
import type { PortalPlugin, PortalPluginSaveData } from '@/services/portal';

const { Text } = Typography;

/** 插件类型选项（对标 hppluginsetting.pType） */
const PLUGIN_TYPES = [
  { value: 'js', label: 'JS 脚本' },
  { value: 'css', label: 'CSS 样式' },
  { value: 'component', label: '组件' },
];

/**
 * 插件管理（对标泛微 pluginmanage §14.2 G，hppluginsetting）
 * 后端：/plugin/list、/plugin/submit、/plugin/remove
 * 登记插件（pid/文件路径/启用/排序/类型），供门户运行时按需加载。
 */
const PortalPluginManage: React.FC = () => {
  const { buttons } = usePageButtons('portal');
  const canManage = buttons.some((b: any) => b.code === 'portal_plugin_manage');

  const [list, setList] = useState<PortalPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PortalPlugin | null>(null);
  const [form] = Form.useForm<PortalPluginSaveData>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await portalApi.getPluginList();
      setList(data || []);
    } catch (e) {
      console.error('[portal] 加载插件列表失败', e);
      message.error('加载插件列表失败');
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
    form.setFieldsValue({ isUse: 1, orderNum: (list.length + 1) * 10, pType: 'js' });
    setModalOpen(true);
  };

  const openEdit = (row: PortalPlugin) => {
    setEditing(row);
    form.setFieldsValue({
      id: row.id,
      pid: row.pid,
      pluginDesc: row.pluginDesc,
      filePath: row.filePath,
      isUse: row.isUse ?? 1,
      orderNum: row.orderNum ?? 0,
      pType: row.pType ?? 'js',
      remark: row.remark,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const ok = await portalApi.submitPlugin(values);
      if (ok) {
        message.success(editing ? '已保存' : '已登记');
        setModalOpen(false);
        load();
      } else {
        message.error('保存失败（插件标识不可重复）');
      }
    } catch (e) {
      console.error('[portal] 保存插件失败', e);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id?: number) => {
    if (id == null) return;
    try {
      const ok = await portalApi.removePlugin(id);
      if (ok) {
        message.success('已删除');
        load();
      } else {
        message.error('删除失败');
      }
    } catch (e) {
      console.error('[portal] 删除插件失败', e);
      message.error('删除失败');
    }
  };

  const columns = [
    { title: '排序', dataIndex: 'orderNum', key: 'orderNum', width: 70 },
    { title: '插件标识', dataIndex: 'pid', key: 'pid' },
    { title: '描述', dataIndex: 'pluginDesc', key: 'pluginDesc' },
    {
      title: '类型',
      dataIndex: 'pType',
      key: 'pType',
      width: 100,
      render: (v: string) => PLUGIN_TYPES.find((t) => t.value === v)?.label || v || '-',
    },
    {
      title: '文件路径',
      dataIndex: 'filePath',
      key: 'filePath',
      render: (v: string) =>
        v ? <Text code>{v}</Text> : <Text type="secondary">-</Text>,
    },
    {
      title: '状态',
      dataIndex: 'isUse',
      key: 'isUse',
      width: 90,
      render: (v: number) => (v === 1 ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>),
    },
    {
      title: '操作',
      key: 'op',
      width: 140,
      render: (_: any, row: PortalPlugin) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => openEdit(row)} disabled={!canManage}>
            编辑
          </Button>
          <Popconfirm title="确认删除该插件登记？" onConfirm={() => handleRemove(row.id)} disabled={!canManage}>
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
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="只读模式：需要「插件管理」按钮权限才能登记/编辑插件"
        />
      )}
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} disabled={!canManage}>
          登记插件
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
        title={editing ? '编辑插件' : '登记插件'}
        open={modalOpen}
        onOk={handleSubmit}
        confirmLoading={saving}
        onCancel={() => setModalOpen(false)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item label="插件标识（pid）" name="pid" rules={[{ required: true, message: '请输入插件标识' }]}>
            <Input placeholder="租户内唯一，如 portal-plugin-weather" maxLength={128} />
          </Form.Item>
          <Form.Item label="插件描述" name="pluginDesc">
            <Input maxLength={255} />
          </Form.Item>
          <Form.Item label="文件路径" name="filePath">
            <Input placeholder="JS/CSS 资源地址，如 /spa/portal/plugins/xxx.js" maxLength={512} />
          </Form.Item>
          <Form.Item label="插件类型" name="pType">
            <Select options={PLUGIN_TYPES} />
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
    </div>
  );
};

export default PortalPluginManage;
