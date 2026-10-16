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
import { history } from '@umijs/max';
import { portalApi } from '@/services/portal';
import { usePageButtons } from '@/hooks/usePageButtons';
import LayoutThumb from '../components/LayoutThumb';
import type { PortalLayout, PortalPage } from '@/services/portal';

const { Text } = Typography;

/**
 * 布局模板库（对标泛微 portallayout §12.5 P2）
 * 把页面元素排列存为可复用模板；从模板一键实例化新门户页（复用导入链路）。
 */
const PortalLayoutLib: React.FC = () => {
  const { buttons } = usePageButtons('portal');
  const canManage = buttons.some((b: any) => b.code === 'portal_layout_manage');

  const [list, setList] = useState<PortalLayout[]>([]);
  const [pages, setPages] = useState<PortalPage[]>([]);
  const [loading, setLoading] = useState(true);

  /* 存为模板 */
  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveForm] = Form.useForm<{ pageId: number; layoutName: string; layoutType?: string; remark?: string }>();

  /* 从模板创建 */
  const [instOpen, setInstOpen] = useState(false);
  const [instLayout, setInstLayout] = useState<PortalLayout | null>(null);
  const [installing, setInstalling] = useState(false);
  const [instForm] = Form.useForm<{ pageCode: string; pageName?: string }>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [layoutRes, pageRes] = await Promise.all([
        portalApi.getLayoutList(),
        portalApi.getPageList(),
      ]);
      setList(layoutRes || []);
      setPages(pageRes || []);
    } catch (e) {
      console.error('[portal] 加载布局模板失败', e);
      message.error('加载失败');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    const values = await saveForm.validateFields();
    setSaving(true);
    try {
      const id = await portalApi.saveLayoutFromPage({
        pageId: values.pageId,
        layoutName: values.layoutName,
        layoutType: values.layoutType || 'cus',
        remark: values.remark,
      });
      if (id != null) {
        message.success('已存为模板');
        setSaveOpen(false);
        saveForm.resetFields();
        load();
      } else {
        message.error('保存失败：页面无可复制的元素或名称非法');
      }
    } catch (e) {
      console.error('[portal] 保存布局模板失败', e);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const openInstantiate = (record: PortalLayout) => {
    setInstLayout(record);
    instForm.resetFields();
    instForm.setFieldsValue({ pageCode: '', pageName: record.layoutName });
    setInstOpen(true);
  };

  const handleInstantiate = async () => {
    if (!instLayout) return;
    const values = await instForm.validateFields();
    setInstalling(true);
    try {
      const newId = await portalApi.instantiateLayout({
        layoutId: instLayout.id as number,
        pageCode: values.pageCode,
        pageName: values.pageName,
      });
      if (newId != null) {
        message.success('已从模板创建新页面，进入设计器');
        history.push(`/portal/design?pageId=${newId}`);
      } else {
        message.error('创建失败：模板为空或页面编码非法');
      }
    } catch (e) {
      console.error('[portal] 从模板创建页面失败', e);
      message.error('创建失败');
    } finally {
      setInstalling(false);
    }
  };

  const handleRemove = async (record: PortalLayout) => {
    try {
      const ok = await portalApi.removeLayout(record.id as number);
      if (ok) {
        message.success('已删除');
        load();
      } else {
        message.error('删除失败');
      }
    } catch (e) {
      console.error('[portal] 删除布局模板失败', e);
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: '模板名称',
      dataIndex: 'layoutName',
      key: 'layoutName',
      render: (v: string, r: PortalLayout) => (
        <Space>
          <Text strong>{v}</Text>
          {r.layoutType === 'sys' ? <Tag color="blue">内置</Tag> : <Tag>自定义</Tag>}
        </Space>
      ),
    },
    { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true },
    {
      title: '布局',
      key: 'thumb',
      width: 220,
      render: (_: any, r: PortalLayout) => <LayoutThumb elementsJson={r.elementsJson} width={180} />,
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: any, record: PortalLayout) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<RocketOutlined />} onClick={() => openInstantiate(record)}>
            从此模板创建
          </Button>
          <Popconfirm
            title="删除模板"
            description="删除后不可恢复。"
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
          布局模板库
        </Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!canManage}
            onClick={() => {
              saveForm.resetFields();
              saveForm.setFieldsValue({ layoutType: 'cus' });
              setSaveOpen(true);
            }}
          >
            存页面为模板
          </Button>
        </Space>
      </Space>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="提示"
        description="把某个门户页的元素排列存为模板；之后可从模板一键创建结构相同的新页面，进入设计器继续调整。"
      />

      <Table rowKey="id" loading={loading} columns={columns as any} dataSource={list} pagination={false} />

      {/* 存页面为模板 */}
      <Modal
        title="存页面为模板"
        open={saveOpen}
        onOk={handleSave}
        confirmLoading={saving}
        onCancel={() => setSaveOpen(false)}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={saveForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="pageId" label="来源页面" rules={[{ required: true, message: '请选择页面' }]}>
            <Select
              placeholder="选择要存为模板的门户页"
              options={pages.map((p) => ({ value: p.id as number, label: p.pageName }))}
            />
          </Form.Item>
          <Form.Item name="layoutName" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input placeholder="如：三栏仪表盘" maxLength={64} />
          </Form.Item>
          <Form.Item name="layoutType" label="模板类型">
            <Select options={[{ value: 'cus', label: '自定义' }, { value: 'sys', label: '内置' }]} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input maxLength={255} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 从模板创建 */}
      <Modal
        title={`从模板创建 · ${instLayout?.layoutName || ''}`}
        open={instOpen}
        onOk={handleInstantiate}
        confirmLoading={installing}
        onCancel={() => setInstOpen(false)}
        okText="创建并进入设计器"
        cancelText="取消"
        destroyOnHidden
      >
        <div style={{ marginTop: 12 }}>
          <LayoutThumb elementsJson={instLayout?.elementsJson} width={240} />
        </div>
        <Form form={instForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="pageCode"
            label="新页面编码"
            rules={[
              { required: true, message: '请输入页面编码' },
              { pattern: /^[a-zA-Z0-9_-]+$/, message: '仅支持字母、数字、下划线与连字符' },
            ]}
          >
            <Input placeholder="如：dash2" maxLength={64} />
          </Form.Item>
          <Form.Item name="pageName" label="新页面名称">
            <Input placeholder="留空使用模板名" maxLength={64} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PortalLayoutLib;
