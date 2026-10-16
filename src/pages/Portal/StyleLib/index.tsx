import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tabs, Tag, Typography, message } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { portalApi, ELEMENT_TYPE_META } from '@/services/portal';
import { usePageButtons } from '@/hooks/usePageButtons';
import type {
  ElementType,
  PortalElementStyle,
  PortalElementStyleSaveData,
  PortalElementTemplate,
  PortalElementTemplateSaveData,
  PortalMenuStyle,
  PortalMenuStyleSaveData,
} from '@/services/portal';

const { Text } = Typography;

/** 菜单样式类型（对标 hpMenuStyle menuh/menuv） */
const MENU_STYLE_TYPES = [
  { value: 'menuv', label: '纵向 menuv' },
  { value: 'menuh', label: '横向 menuh' },
];

/** 元素样式分类（对标 §15.3 B3/B4） */
const ELEMENT_STYLE_KINDS = [
  { value: 'element', label: '元素样式' },
  { value: 'headline', label: '头条样式' },
];

/** 元素模板可选类型（与前端注册表一致） */
const TEMPLATE_TYPE_OPTIONS = (Object.keys(ELEMENT_TYPE_META) as ElementType[]).map((t) => ({
  value: t,
  label: ELEMENT_TYPE_META[t].label,
}));

/**
 * 门户样式库（对标泛微 §14.2 E menustylelib / §15.3 B3 elementstylelib /
 * B4 headlinestyle / B2 elementtemplate 四合一维护台）
 * 后端：/menu-style/*、/element-style/*、/element-template/*
 */
const PortalStyleLib: React.FC = () => {
  const { buttons } = usePageButtons('portal');
  const canManage = buttons.some((b: any) => b.code === 'portal_style_lib_manage');

  const [activeTab, setActiveTab] = useState('menu');

  /* ==================== 菜单样式 ==================== */
  const [menuStyles, setMenuStyles] = useState<PortalMenuStyle[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuModal, setMenuModal] = useState(false);
  const [menuEditing, setMenuEditing] = useState<PortalMenuStyle | null>(null);
  const [menuSaving, setMenuSaving] = useState(false);
  const [menuForm] = Form.useForm<PortalMenuStyleSaveData>();

  /* ==================== 元素/头条样式 ==================== */
  const [elementStyles, setElementStyles] = useState<PortalElementStyle[]>([]);
  const [esLoading, setEsLoading] = useState(true);
  const [esModal, setEsModal] = useState(false);
  const [esEditing, setEsEditing] = useState<PortalElementStyle | null>(null);
  const [esSaving, setEsSaving] = useState(false);
  const [esForm] = Form.useForm<PortalElementStyleSaveData>();

  /* ==================== 元素模板 ==================== */
  const [templates, setTemplates] = useState<PortalElementTemplate[]>([]);
  const [tplLoading, setTplLoading] = useState(true);
  const [tplModal, setTplModal] = useState(false);
  const [tplEditing, setTplEditing] = useState<PortalElementTemplate | null>(null);
  const [tplSaving, setTplSaving] = useState(false);
  const [tplForm] = Form.useForm<PortalElementTemplateSaveData>();

  const loadMenuStyles = useCallback(async () => {
    setMenuLoading(true);
    try {
      setMenuStyles((await portalApi.getMenuStyleList()) || []);
    } catch (e) {
      console.error('[portal] 加载菜单样式失败', e);
      message.error('加载菜单样式失败');
    } finally {
      setMenuLoading(false);
    }
  }, []);

  const loadElementStyles = useCallback(async () => {
    setEsLoading(true);
    try {
      setElementStyles((await portalApi.getElementStyleList()) || []);
    } catch (e) {
      console.error('[portal] 加载元素样式失败', e);
      message.error('加载元素样式失败');
    } finally {
      setEsLoading(false);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    setTplLoading(true);
    try {
      setTemplates((await portalApi.getElementTemplateList()) || []);
    } catch (e) {
      console.error('[portal] 加载元素模板失败', e);
      message.error('加载元素模板失败');
    } finally {
      setTplLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMenuStyles();
    loadElementStyles();
    loadTemplates();
  }, [loadMenuStyles, loadElementStyles, loadTemplates]);

  /* ==================== 菜单样式操作 ==================== */

  const openMenuCreate = () => {
    setMenuEditing(null);
    menuForm.resetFields();
    menuForm.setFieldsValue({ styleType: 'menuv' });
    setMenuModal(true);
  };

  const openMenuEdit = (row: PortalMenuStyle) => {
    setMenuEditing(row);
    menuForm.setFieldsValue({ id: row.id, styleName: row.styleName, styleDesc: row.styleDesc, styleType: row.styleType });
    setMenuModal(true);
  };

  const submitMenu = async () => {
    const values = await menuForm.validateFields();
    setMenuSaving(true);
    try {
      const ok = await portalApi.submitMenuStyle(values);
      if (ok) {
        message.success('已保存');
        setMenuModal(false);
        loadMenuStyles();
      } else {
        message.error('保存失败（同类型下样式名不可重复）');
      }
    } catch (e) {
      console.error('[portal] 保存菜单样式失败', e);
      message.error('保存失败');
    } finally {
      setMenuSaving(false);
    }
  };

  const removeMenu = async (id?: number) => {
    if (id == null) return;
    try {
      if (await portalApi.removeMenuStyle(id)) {
        message.success('已删除');
        loadMenuStyles();
      } else {
        message.error('删除失败');
      }
    } catch (e) {
      console.error('[portal] 删除菜单样式失败', e);
      message.error('删除失败');
    }
  };

  /* ==================== 元素/头条样式操作 ==================== */

  const openEsCreate = (kind: string) => {
    setEsEditing(null);
    esForm.resetFields();
    esForm.setFieldsValue({ styleKind: kind });
    setEsModal(true);
  };

  const openEsEdit = (row: PortalElementStyle) => {
    setEsEditing(row);
    esForm.setFieldsValue({
      id: row.id,
      styleKind: row.styleKind,
      styleName: row.styleName,
      styleDesc: row.styleDesc,
    });
    setEsModal(true);
  };

  const submitEs = async () => {
    const values = await esForm.validateFields();
    setEsSaving(true);
    try {
      const ok = await portalApi.submitElementStyle(values);
      if (ok) {
        message.success('已保存');
        setEsModal(false);
        loadElementStyles();
      } else {
        message.error('保存失败（同分类下样式名不可重复）');
      }
    } catch (e) {
      console.error('[portal] 保存元素样式失败', e);
      message.error('保存失败');
    } finally {
      setEsSaving(false);
    }
  };

  const removeEs = async (id?: number) => {
    if (id == null) return;
    try {
      if (await portalApi.removeElementStyle(id)) {
        message.success('已删除');
        loadElementStyles();
      } else {
        message.error('删除失败');
      }
    } catch (e) {
      console.error('[portal] 删除元素样式失败', e);
      message.error('删除失败');
    }
  };

  /* ==================== 元素模板操作 ==================== */

  const openTplCreate = () => {
    setTplEditing(null);
    tplForm.resetFields();
    setTplModal(true);
  };

  const openTplEdit = (row: PortalElementTemplate) => {
    setTplEditing(row);
    tplForm.setFieldsValue({
      id: row.id,
      elementType: row.elementType,
      templateName: row.templateName,
      remark: row.remark,
    });
    setTplModal(true);
  };

  const submitTpl = async () => {
    const values = await tplForm.validateFields();
    setTplSaving(true);
    try {
      const ok = await portalApi.submitElementTemplate(values);
      if (ok) {
        message.success('已保存');
        setTplModal(false);
        loadTemplates();
      } else {
        message.error('保存失败（模板名不可重复）');
      }
    } catch (e) {
      console.error('[portal] 保存元素模板失败', e);
      message.error('保存失败');
    } finally {
      setTplSaving(false);
    }
  };

  const removeTpl = async (id?: number) => {
    if (id == null) return;
    try {
      if (await portalApi.removeElementTemplate(id)) {
        message.success('已删除');
        loadTemplates();
      } else {
        message.error('删除失败');
      }
    } catch (e) {
      console.error('[portal] 删除元素模板失败', e);
      message.error('删除失败');
    }
  };

  /** 解析样式配置 JSON（失败降级为文本展示） */
  const configText = (json?: string) => {
    if (!json) return <Text type="secondary">-</Text>;
    try {
      return <Text code>{JSON.stringify(JSON.parse(json))}</Text>;
    } catch {
      return <Text code>{json}</Text>;
    }
  };

  const menuColumns = [
    { title: '样式名称', dataIndex: 'styleName', key: 'styleName' },
    {
      title: '类型',
      dataIndex: 'styleType',
      key: 'styleType',
      width: 120,
      render: (v: string) => MENU_STYLE_TYPES.find((t) => t.value === v)?.label || v,
    },
    { title: '描述', dataIndex: 'styleDesc', key: 'styleDesc' },
    { title: '配置', dataIndex: 'styleConfig', key: 'styleConfig', render: configText },
    {
      title: '操作',
      key: 'op',
      width: 140,
      render: (_: any, row: PortalMenuStyle) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => openMenuEdit(row)} disabled={!canManage}>
            编辑
          </Button>
          <Popconfirm title="确认删除该菜单样式？" onConfirm={() => removeMenu(row.id)} disabled={!canManage}>
            <Button type="link" size="small" danger disabled={!canManage}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const esColumns = [
    { title: '样式名称', dataIndex: 'styleName', key: 'styleName' },
    {
      title: '分类',
      dataIndex: 'styleKind',
      key: 'styleKind',
      width: 110,
      render: (v: string) =>
        v === 'headline' ? <Tag color="purple">头条样式</Tag> : <Tag color="blue">元素样式</Tag>,
    },
    { title: '描述', dataIndex: 'styleDesc', key: 'styleDesc' },
    { title: '配置', dataIndex: 'styleConfig', key: 'styleConfig', render: configText },
    {
      title: '操作',
      key: 'op',
      width: 140,
      render: (_: any, row: PortalElementStyle) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => openEsEdit(row)} disabled={!canManage}>
            编辑
          </Button>
          <Popconfirm title="确认删除该样式？" onConfirm={() => removeEs(row.id)} disabled={!canManage}>
            <Button type="link" size="small" danger disabled={!canManage}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tplColumns = [
    { title: '模板名称', dataIndex: 'templateName', key: 'templateName' },
    {
      title: '元素类型',
      dataIndex: 'elementType',
      key: 'elementType',
      width: 130,
      render: (v: string) => ELEMENT_TYPE_META[v as ElementType]?.label || v,
    },
    { title: '配置快照', dataIndex: 'configJson', key: 'configJson', render: configText },
    { title: '备注', dataIndex: 'remark', key: 'remark' },
    {
      title: '操作',
      key: 'op',
      width: 140,
      render: (_: any, row: PortalElementTemplate) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => openTplEdit(row)} disabled={!canManage}>
            编辑
          </Button>
          <Popconfirm title="确认删除该元素模板？" onConfirm={() => removeTpl(row.id)} disabled={!canManage}>
            <Button type="link" size="small" danger disabled={!canManage}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const renderToolbar = (create: () => void, reload: () => void, label: string) => (
    <Space style={{ marginBottom: 12 }}>
      <Button type="primary" icon={<PlusOutlined />} onClick={create} disabled={!canManage}>
        {label}
      </Button>
      <Button icon={<ReloadOutlined />} onClick={reload}>
        刷新
      </Button>
    </Space>
  );

  return (
    <div style={{ padding: 16 }}>
      {!canManage && (
        <Alert type="info" showIcon style={{ marginBottom: 12 }} message="只读模式：需要「门户样式库」按钮权限才能维护" />
      )}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'menu',
            label: '菜单样式',
            children: (
              <>
                {renderToolbar(openMenuCreate, loadMenuStyles, '新建菜单样式')}
                <Table rowKey="id" loading={menuLoading} dataSource={menuStyles} columns={menuColumns as any} pagination={false} size="middle" />
              </>
            ),
          },
          {
            key: 'element',
            label: '元素样式',
            children: (
              <>
                {renderToolbar(() => openEsCreate('element'), loadElementStyles, '新建元素样式')}
                <Table
                  rowKey="id"
                  loading={esLoading}
                  dataSource={elementStyles.filter((s) => s.styleKind !== 'headline')}
                  columns={esColumns as any}
                  pagination={false}
                  size="middle"
                />
              </>
            ),
          },
          {
            key: 'headline',
            label: '头条样式',
            children: (
              <>
                {renderToolbar(() => openEsCreate('headline'), loadElementStyles, '新建头条样式')}
                <Table
                  rowKey="id"
                  loading={esLoading}
                  dataSource={elementStyles.filter((s) => s.styleKind === 'headline')}
                  columns={esColumns as any}
                  pagination={false}
                  size="middle"
                />
              </>
            ),
          },
          {
            key: 'template',
            label: '元素模板',
            children: (
              <>
                {renderToolbar(openTplCreate, loadTemplates, '新建元素模板')}
                <Table rowKey="id" loading={tplLoading} dataSource={templates} columns={tplColumns as any} pagination={false} size="middle" />
              </>
            ),
          },
        ]}
      />

      {/* 菜单样式弹窗 */}
      <Modal
        title={menuEditing ? '编辑菜单样式' : '新建菜单样式'}
        open={menuModal}
        onOk={submitMenu}
        confirmLoading={menuSaving}
        onCancel={() => setMenuModal(false)}
        destroyOnHidden
      >
        <Form form={menuForm} layout="vertical">
          <Form.Item label="样式名称" name="styleName" rules={[{ required: true, message: '请输入样式名称' }]}>
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item label="样式类型" name="styleType" rules={[{ required: true, message: '请选择样式类型' }]}>
            <Select options={MENU_STYLE_TYPES} />
          </Form.Item>
          <Form.Item label="样式描述" name="styleDesc">
            <Input maxLength={255} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 元素/头条样式弹窗 */}
      <Modal
        title={esEditing ? (esEditing.styleKind === 'headline' ? '编辑头条样式' : '编辑元素样式') : '新建样式'}
        open={esModal}
        onOk={submitEs}
        confirmLoading={esSaving}
        onCancel={() => setEsModal(false)}
        destroyOnHidden
      >
        <Form form={esForm} layout="vertical">
          <Form.Item label="样式分类" name="styleKind" rules={[{ required: true, message: '请选择样式分类' }]}>
            <Select options={ELEMENT_STYLE_KINDS} />
          </Form.Item>
          <Form.Item label="样式名称" name="styleName" rules={[{ required: true, message: '请输入样式名称' }]}>
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item label="样式描述" name="styleDesc">
            <Input maxLength={255} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 元素模板弹窗 */}
      <Modal
        title={tplEditing ? '编辑元素模板' : '新建元素模板'}
        open={tplModal}
        onOk={submitTpl}
        confirmLoading={tplSaving}
        onCancel={() => setTplModal(false)}
        destroyOnHidden
      >
        <Form form={tplForm} layout="vertical">
          <Form.Item label="模板名称" name="templateName" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item label="元素类型" name="elementType" rules={[{ required: true, message: '请选择元素类型' }]}>
            <Select options={TEMPLATE_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input maxLength={255} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PortalStyleLib;
