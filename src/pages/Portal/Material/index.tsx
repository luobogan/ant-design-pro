import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Form, Image, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tabs, Tag, Typography, message } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { portalApi } from '@/services/portal';
import { usePageButtons } from '@/hooks/usePageButtons';
import type { PortalMaterial, PortalMaterialSaveData, PortalNewsTemplate, PortalNewsTemplateSaveData } from '@/services/portal';

const { Text } = Typography;

/** 素材类型选项 */
const MATERIAL_TYPES = [
  { value: 'image', label: '图片' },
  { value: 'file', label: '文件' },
];

/** 新闻模板类型选项（对标 PAGENEWSTEMPLATE inner/outer） */
const NEWS_TEMPLATE_TYPES = [
  { value: 'inner', label: '内部新闻' },
  { value: 'outer', label: '外部新闻' },
];

/**
 * 门户素材库（对标泛微 materiallib §15.4 C2 + newstemplate §15.4 C1）
 * - 图片素材：目录/文件元数据维护（文件本体走资源服务，登记 fileUrl）
 * - 新闻模板：内部/外部两类排版模板，支持默认模板
 */
const PortalMaterial: React.FC = () => {
  const { buttons } = usePageButtons('portal');
  const canManage = buttons.some((b: any) => b.code === 'portal_material_manage');

  /* ==================== 素材 ==================== */
  const [materials, setMaterials] = useState<PortalMaterial[]>([]);
  const [dirs, setDirs] = useState<string[]>([]);
  const [dirFilter, setDirFilter] = useState<string | undefined>();
  const [mLoading, setMLoading] = useState(true);
  const [mModal, setMModal] = useState(false);
  const [mEditing, setMEditing] = useState<PortalMaterial | null>(null);
  const [mSaving, setMSaving] = useState(false);
  const [mForm] = Form.useForm<PortalMaterialSaveData>();

  /* ==================== 新闻模板 ==================== */
  const [newsTemplates, setNewsTemplates] = useState<PortalNewsTemplate[]>([]);
  const [nLoading, setNLoading] = useState(true);
  const [nModal, setNModal] = useState(false);
  const [nEditing, setNEditing] = useState<PortalNewsTemplate | null>(null);
  const [nSaving, setNSaving] = useState(false);
  const [nForm] = Form.useForm<PortalNewsTemplateSaveData>();

  const loadMaterials = useCallback(async (dir?: string) => {
    setMLoading(true);
    try {
      setMaterials((await portalApi.getMaterialList(dir)) || []);
    } catch (e) {
      console.error('[portal] 加载素材失败', e);
      message.error('加载素材失败');
    } finally {
      setMLoading(false);
    }
  }, []);

  const loadDirs = useCallback(async () => {
    try {
      setDirs((await portalApi.getMaterialDirs()) || []);
    } catch (e) {
      console.error('[portal] 加载素材目录失败', e);
    }
  }, []);

  const loadNewsTemplates = useCallback(async () => {
    setNLoading(true);
    try {
      setNewsTemplates((await portalApi.getNewsTemplateList()) || []);
    } catch (e) {
      console.error('[portal] 加载新闻模板失败', e);
      message.error('加载新闻模板失败');
    } finally {
      setNLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMaterials(dirFilter);
    loadDirs();
    loadNewsTemplates();
  }, [loadMaterials, loadDirs, loadNewsTemplates, dirFilter]);

  /* ==================== 素材操作 ==================== */

  const openMCreate = () => {
    setMEditing(null);
    mForm.resetFields();
    mForm.setFieldsValue({ dirName: dirFilter || '默认目录', materialType: 'image' });
    setMModal(true);
  };

  const openMEdit = (row: PortalMaterial) => {
    setMEditing(row);
    mForm.setFieldsValue({
      id: row.id,
      dirName: row.dirName,
      materialName: row.materialName,
      materialType: row.materialType,
      fileUrl: row.fileUrl,
      fileSize: row.fileSize,
      mimeType: row.mimeType,
      remark: row.remark,
    });
    setMModal(true);
  };

  const submitM = async () => {
    const values = await mForm.validateFields();
    setMSaving(true);
    try {
      const ok = await portalApi.submitMaterial(values);
      if (ok) {
        message.success('已保存');
        setMModal(false);
        loadMaterials(dirFilter);
        loadDirs();
      } else {
        message.error('保存失败');
      }
    } catch (e) {
      console.error('[portal] 保存素材失败', e);
      message.error('保存失败');
    } finally {
      setMSaving(false);
    }
  };

  const removeM = async (id?: number) => {
    if (id == null) return;
    try {
      if (await portalApi.removeMaterial(id)) {
        message.success('已删除');
        loadMaterials(dirFilter);
      } else {
        message.error('删除失败');
      }
    } catch (e) {
      console.error('[portal] 删除素材失败', e);
      message.error('删除失败');
    }
  };

  /* ==================== 新闻模板操作 ==================== */

  const openNCreate = () => {
    setNEditing(null);
    nForm.resetFields();
    nForm.setFieldsValue({ templateType: 'inner', isDefault: false });
    setNModal(true);
  };

  const openNEdit = (row: PortalNewsTemplate) => {
    setNEditing(row);
    nForm.setFieldsValue({
      id: row.id,
      templateName: row.templateName,
      templateType: row.templateType,
      layoutHtml: row.layoutHtml,
      isDefault: row.isDefault === 1,
      remark: row.remark,
    });
    setNModal(true);
  };

  const submitN = async () => {
    const values = await nForm.validateFields();
    setNSaving(true);
    try {
      const ok = await portalApi.submitNewsTemplate({ ...values, isDefault: values.isDefault ? 1 : 0 });
      if (ok) {
        message.success('已保存');
        setNModal(false);
        loadNewsTemplates();
      } else {
        message.error('保存失败（模板名不可重复）');
      }
    } catch (e) {
      console.error('[portal] 保存新闻模板失败', e);
      message.error('保存失败');
    } finally {
      setNSaving(false);
    }
  };

  const removeN = async (id?: number) => {
    if (id == null) return;
    try {
      if (await portalApi.removeNewsTemplate(id)) {
        message.success('已删除');
        loadNewsTemplates();
      } else {
        message.error('删除失败');
      }
    } catch (e) {
      console.error('[portal] 删除新闻模板失败', e);
      message.error('删除失败');
    }
  };

  const setDefaultN = async (id?: number) => {
    if (id == null) return;
    try {
      if (await portalApi.setDefaultNewsTemplate(id)) {
        message.success('已设为默认');
        loadNewsTemplates();
      } else {
        message.error('设置失败');
      }
    } catch (e) {
      console.error('[portal] 设置默认新闻模板失败', e);
      message.error('设置失败');
    }
  };

  const mColumns = [
    {
      title: '预览',
      dataIndex: 'fileUrl',
      key: 'fileUrl',
      width: 90,
      render: (v: string, row: PortalMaterial) =>
        row.materialType === 'image' && v ? <Image src={v} width={56} height={40} style={{ objectFit: 'cover', borderRadius: 4 }} /> : <Text type="secondary">-</Text>,
    },
    { title: '素材名称', dataIndex: 'materialName', key: 'materialName' },
    { title: '目录', dataIndex: 'dirName', key: 'dirName', width: 130 },
    {
      title: '类型',
      dataIndex: 'materialType',
      key: 'materialType',
      width: 80,
      render: (v: string) => MATERIAL_TYPES.find((t) => t.value === v)?.label || v,
    },
    {
      title: '地址',
      dataIndex: 'fileUrl',
      key: 'url',
      render: (v: string) => (v ? <Text code ellipsis style={{ maxWidth: 260 }}>{v}</Text> : <Text type="secondary">-</Text>),
    },
    {
      title: '大小',
      dataIndex: 'fileSize',
      key: 'fileSize',
      width: 100,
      render: (v: number) => (v ? `${(v / 1024).toFixed(1)} KB` : '-'),
    },
    {
      title: '操作',
      key: 'op',
      width: 140,
      render: (_: any, row: PortalMaterial) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => openMEdit(row)} disabled={!canManage}>
            编辑
          </Button>
          <Popconfirm title="确认删除该素材？" onConfirm={() => removeM(row.id)} disabled={!canManage}>
            <Button type="link" size="small" danger disabled={!canManage}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const nColumns = [
    { title: '模板名称', dataIndex: 'templateName', key: 'templateName' },
    {
      title: '类型',
      dataIndex: 'templateType',
      key: 'templateType',
      width: 110,
      render: (v: string) =>
        v === 'outer' ? <Tag color="orange">外部新闻</Tag> : <Tag color="blue">内部新闻</Tag>,
    },
    {
      title: '默认',
      dataIndex: 'isDefault',
      key: 'isDefault',
      width: 70,
      render: (v: number) => (v === 1 ? <Tag color="green">默认</Tag> : '-'),
    },
    {
      title: '版式',
      dataIndex: 'layoutHtml',
      key: 'layoutHtml',
      render: (v: string) =>
        v ? <Text code ellipsis style={{ maxWidth: 300 }}>{v}</Text> : <Text type="secondary">-</Text>,
    },
    {
      title: '操作',
      key: 'op',
      width: 210,
      render: (_: any, row: PortalNewsTemplate) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => openNEdit(row)} disabled={!canManage}>
            编辑
          </Button>
          <Button type="link" size="small" onClick={() => setDefaultN(row.id)} disabled={!canManage || row.isDefault === 1}>
            设默认
          </Button>
          <Popconfirm title="确认删除该新闻模板？" onConfirm={() => removeN(row.id)} disabled={!canManage}>
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
        <Alert type="info" showIcon style={{ marginBottom: 12 }} message="只读模式：需要「门户素材库」按钮权限才能维护" />
      )}
      <Tabs
        defaultActiveKey="material"
        items={[
          {
            key: 'material',
            label: '图片素材',
            children: (
              <>
                <Space style={{ marginBottom: 12 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={openMCreate} disabled={!canManage}>
                    登记素材
                  </Button>
                  <Button icon={<ReloadOutlined />} onClick={() => loadMaterials(dirFilter)}>
                    刷新
                  </Button>
                  <Select
                    allowClear
                    placeholder="按目录过滤"
                    style={{ width: 180 }}
                    value={dirFilter}
                    onChange={setDirFilter}
                    options={dirs.map((d) => ({ value: d, label: d }))}
                  />
                </Space>
                <Table rowKey="id" loading={mLoading} dataSource={materials} columns={mColumns as any} pagination={false} size="middle" />
              </>
            ),
          },
          {
            key: 'news',
            label: '新闻模板',
            children: (
              <>
                <Space style={{ marginBottom: 12 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={openNCreate} disabled={!canManage}>
                    新建新闻模板
                  </Button>
                  <Button icon={<ReloadOutlined />} onClick={loadNewsTemplates}>
                    刷新
                  </Button>
                </Space>
                <Table rowKey="id" loading={nLoading} dataSource={newsTemplates} columns={nColumns as any} pagination={false} size="middle" />
              </>
            ),
          },
        ]}
      />

      {/* 素材弹窗 */}
      <Modal
        title={mEditing ? '编辑素材' : '登记素材'}
        open={mModal}
        onOk={submitM}
        confirmLoading={mSaving}
        onCancel={() => setMModal(false)}
        destroyOnHidden
      >
        <Form form={mForm} layout="vertical">
          <Form.Item label="素材名称" name="materialName" rules={[{ required: true, message: '请输入素材名称' }]}>
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item label="所属目录" name="dirName" rules={[{ required: true, message: '请输入目录名' }]}>
            <Input placeholder="同名目录自动归组" maxLength={128} />
          </Form.Item>
          <Form.Item label="素材类型" name="materialType">
            <Select options={MATERIAL_TYPES} />
          </Form.Item>
          <Form.Item
            label="文件地址"
            name="fileUrl"
            rules={[{ required: true, message: '请输入文件访问地址（资源服务/OSS 路径）' }]}
          >
            <Input placeholder="https://... 或 /blade-resource/..." maxLength={512} />
          </Form.Item>
          <Form.Item label="文件大小（字节）" name="fileSize">
            <InputNumber min={0} style={{ width: 200 }} />
          </Form.Item>
          <Form.Item label="MIME类型" name="mimeType">
            <Input placeholder="如 image/png" maxLength={128} />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input maxLength={255} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 新闻模板弹窗 */}
      <Modal
        title={nEditing ? '编辑新闻模板' : '新建新闻模板'}
        open={nModal}
        onOk={submitN}
        confirmLoading={nSaving}
        onCancel={() => setNModal(false)}
        destroyOnHidden
        width={640}
      >
        <Form form={nForm} layout="vertical">
          <Form.Item label="模板名称" name="templateName" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item label="模板类型" name="templateType" rules={[{ required: true, message: '请选择模板类型' }]}>
            <Select options={NEWS_TEMPLATE_TYPES} />
          </Form.Item>
          <Form.Item label="版式HTML" name="layoutHtml" extra="占位符：{title} {summary} {time} {cover}">
            <Input.TextArea rows={6} placeholder="<div class='news-item'><h4>{title}</h4>...</div>" />
          </Form.Item>
          <Form.Item label="设为默认模板" name="isDefault" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input maxLength={255} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PortalMaterial;
