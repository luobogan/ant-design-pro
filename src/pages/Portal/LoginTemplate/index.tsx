import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Form, Input, Modal, Popconfirm, Space, Switch, Table, Tag, Typography, message } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { portalApi } from '@/services/portal';
import { usePageButtons } from '@/hooks/usePageButtons';
import type { PortalLoginTemplate, PortalLoginTemplateSaveData } from '@/services/portal';

const { Text } = Typography;

/**
 * 登录前门户皮肤管理（对标泛微 SystemLoginTemplate §16.1）
 * 后端：/login-template/list|submit|set-current|remove；登录页经 /login-template/current 免鉴权拉取。
 */
const PortalLoginTemplateManage: React.FC = () => {
  const { buttons } = usePageButtons('portal');
  const canManage = buttons.some((b: any) => b.code === 'portal_login_template_manage');

  const [list, setList] = useState<PortalLoginTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PortalLoginTemplate | null>(null);
  const [form] = Form.useForm<PortalLoginTemplateSaveData>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await portalApi.getLoginTemplateList();
      setList(data || []);
    } catch (e) {
      console.error('[portal] 加载登录皮肤失败', e);
      message.error('加载登录皮肤失败');
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
    form.setFieldsValue({ templateType: 'default', openTimer: false });
    setModalOpen(true);
  };

  const openEdit = (record: PortalLoginTemplate) => {
    setEditing(record);
    // 详情(config 各 JSON)不在列表返回，保存时以表单为准；此处仅回填名称/类型/定时
    form.setFieldsValue({
      templateId: record.id,
      templateName: record.templateName,
      templateType: record.templateType,
      openTimer: record.openTimer === 1,
      timerStart: record.timerStart,
      timerEnd: record.timerEnd,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const id = await portalApi.submitLoginTemplate({
        templateId: editing?.id,
        templateName: values.templateName,
        templateType: values.templateType,
        backgroundConfig: values.backgroundConfig,
        logoConfig: values.logoConfig,
        formConfig: values.formConfig,
        qrcodeConfig: values.qrcodeConfig,
        copyrightConfig: values.copyrightConfig,
        openTimer: values.openTimer ? 1 : 0,
        timerStart: values.timerStart,
        timerEnd: values.timerEnd,
      });
      if (id != null) {
        message.success(editing ? '已更新' : '已创建');
        setModalOpen(false);
        load();
      } else {
        message.error('保存失败：模板名称可能重复');
      }
    } catch (e) {
      console.error('[portal] 保存登录皮肤失败', e);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSetCurrent = async (record: PortalLoginTemplate) => {
    try {
      const ok = await portalApi.setCurrentLoginTemplate(record.id as number);
      if (ok) {
        message.success(`「${record.templateName}」已设为当前登录皮肤`);
        load();
      } else {
        message.error('设置失败');
      }
    } catch (e) {
      console.error('[portal] 设置当前登录皮肤失败', e);
      message.error('设置失败');
    }
  };

  const handleRemove = async (record: PortalLoginTemplate) => {
    try {
      const ok = await portalApi.removeLoginTemplate(record.id as number);
      if (ok) {
        message.success('已删除');
        load();
      } else {
        message.error('删除失败：当前启用中的皮肤不可删');
      }
    } catch (e) {
      console.error('[portal] 删除登录皮肤失败', e);
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: '模板名称',
      dataIndex: 'templateName',
      key: 'templateName',
      render: (v: string, r: PortalLoginTemplate) => (
        <Space>
          <Text strong>{v}</Text>
          {r.isCurrent === 1 && <Tag color="blue">当前启用</Tag>}
          {r.openTimer === 1 && <Tag color="orange">定时</Tag>}
        </Space>
      ),
    },
    { title: '类型', dataIndex: 'templateType', key: 'templateType', width: 120 },
    {
      title: '定时区间',
      key: 'timer',
      render: (_: any, r: PortalLoginTemplate) =>
        r.openTimer === 1 ? `${r.timerStart || ''} ~ ${r.timerEnd || ''}` : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_: any, record: PortalLoginTemplate) => (
        <Space size={4}>
          {record.isCurrent !== 1 && (
            <Button type="link" size="small" disabled={!canManage} onClick={() => handleSetCurrent(record)}>
              设为当前
            </Button>
          )}
          <Button type="link" size="small" disabled={!canManage} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="删除登录皮肤"
            description="当前启用中的皮肤不可删。"
            okText="删除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={() => handleRemove(record)}
          >
            <Button type="link" size="small" danger disabled={!canManage || record.isCurrent === 1}>
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
          登录页皮肤
        </Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} disabled={!canManage} onClick={openCreate}>
            新建皮肤
          </Button>
        </Space>
      </Space>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="提示"
        description="登录页（未登录）按「当前启用」皮肤渲染背景/Logo/版权；开启定时后，在设定时间段内自动优先生效。"
      />

      <Table rowKey="id" loading={loading} columns={columns as any} dataSource={list} pagination={false} />

      <Modal
        title={editing ? '编辑登录皮肤' : '新建登录皮肤'}
        open={modalOpen}
        onOk={handleSubmit}
        confirmLoading={saving}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="templateName" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input placeholder="如：默认登录皮肤" maxLength={64} />
          </Form.Item>
          <Form.Item name="templateType" label="类型标识">
            <Input placeholder="default" maxLength={64} />
          </Form.Item>

          <Form.Item label="背景">
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name={['backgroundConfig', 'bgColor']} noStyle>
                <Input type="color" style={{ width: 60 }} />
              </Form.Item>
              <Form.Item name={['backgroundConfig', 'bgImage']} noStyle>
                <Input placeholder="背景图 URL（可选）" />
              </Form.Item>
            </Space.Compact>
          </Form.Item>

          <Form.Item label="Logo 与标题">
            <Form.Item name={['logoConfig', 'logoUrl']} noStyle>
              <Input placeholder="Logo URL（可选）" style={{ marginBottom: 8 }} />
            </Form.Item>
            <Form.Item name={['logoConfig', 'title']} noStyle>
              <Input placeholder="系统标题，如 SpringBlade" />
            </Form.Item>
          </Form.Item>

          <Form.Item name={['copyrightConfig', 'text']} label="版权文字">
            <Input placeholder="Copyright © SpringBlade" maxLength={255} />
          </Form.Item>

          <Form.Item label="登录卡片">
            <Form.Item name={['formConfig', 'title']} noStyle>
              <Input placeholder="卡片标题，如 流程引擎系统" style={{ marginBottom: 8 }} />
            </Form.Item>
            <Form.Item name={['formConfig', 'subtitle']} noStyle>
              <Input placeholder="卡片副标题，如 登录以进入工作台" />
            </Form.Item>
          </Form.Item>

          <Form.Item label="二维码（可选）">
            <Form.Item name={['qrcodeConfig', 'qrcodeUrl']} noStyle>
              <Input placeholder="二维码图片 URL" style={{ marginBottom: 8 }} />
            </Form.Item>
            <Form.Item name={['qrcodeConfig', 'caption']} noStyle>
              <Input placeholder="二维码说明，如 扫码下载 APP" />
            </Form.Item>
          </Form.Item>

          <Form.Item name="openTimer" label="定时切换" valuePropName="checked" extra="开启后在设定时间段内此皮肤优先生效">
            <Switch checkedChildren="开" unCheckedChildren="关" />
          </Form.Item>
          <Form.Item name="timerStart" label="定时开始">
            <Input placeholder="2026-10-01 00:00:00" maxLength={32} />
          </Form.Item>
          <Form.Item name="timerEnd" label="定时结束">
            <Input placeholder="2026-11-01 00:00:00" maxLength={32} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PortalLoginTemplateManage;
