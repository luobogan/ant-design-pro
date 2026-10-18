import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { portalApi } from '@/services/portal';
import { usePageButtons } from '@/hooks/usePageButtons';
import type { PortalMenu, PortalMenuSaveData, PortalPageShare } from '@/services/portal';
import PortalShareEditor from '../components/PortalShareEditor';
import MenuDeptPerm from './MenuDeptPerm';

const { Text } = Typography;

/** 菜单类型元信息（front/top 为门户自有导航菜单，与系统 blade_menu 相互独立，见迁移 V2026.10.15_002） */
const MENU_TYPES: { value: string; label: string }[] = [
  { value: 'top', label: '后端菜单(顶部)' },
  { value: 'front', label: '前端菜单(左侧)' },
  { value: 'toolbar', label: '工具栏菜单' },
  { value: 'quick', label: '快捷入口' },
  { value: 'report', label: '报表菜单' },
];

/** 跨类型查看（自定义菜单页用）：后端 /menu/list 不传 menuType 即返回全部类型 */
const ALL_TYPES: { value: string; label: string }[] = [
  { value: 'all', label: '全部类型' },
  ...MENU_TYPES,
];

/** 各菜单类型在「新建菜单」表单里的说明文案 */
const TYPE_DESC: Record<string, string> = {
  front: '前端菜单 = 门户左侧导航（对标泛微 portalmenu leftmenu），menu_type=front',
  top: '后端菜单 = 门户顶部导航（对标泛微 portalmenu topmenu），menu_type=top',
  toolbar: '工具栏菜单 = 门户工具栏「更多」下拉（对标泛微 toolbarmore），menu_type=toolbar',
  quick: '快捷入口 = 门户快捷搜索入口，menu_type=quick',
  report: '报表菜单 = 我的报表树（对标 reportMenu），不进首页渲染',
  all: '自定义菜单 = 用户/管理员自建的门户菜单，可跨类型查看（顶部下拉可切换类型筛选）',
};

/** 门户菜单管理页参数：供「前端/后端/自定义/工具栏菜单」四个独立菜单页复用同一实现 */
export interface PortalMenuManageProps {
  /** 锁定菜单类型；'all' = 跨类型查看（自定义菜单页）；不传 = 保持顶部下拉可切换 */
  fixedMenuType?: 'front' | 'top' | 'toolbar' | 'quick' | 'report' | 'all';
  /** 页面标题 */
  title?: string;
  /** 标题下方补充说明 */
  desc?: string;
}

/**
 * 门户菜单管理（对标泛微 portalmenu §14）
 * 后端：/menu/list、/menu/submit、/menu/remove、/menu/share/list、/menu/share/set、/menu/tree(运行时)
 */
const PortalMenuManage: React.FC<PortalMenuManageProps> = ({ fixedMenuType, title, desc }) => {
  const { buttons } = usePageButtons('portal');
  const canManage = buttons.some((b: any) => b.code === 'portal_menu_manage');

  const [menuType, setMenuType] = useState<string>(fixedMenuType || 'top');
  const [list, setList] = useState<PortalMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PortalMenu | null>(null);
  const [form] = Form.useForm<PortalMenuSaveData>();

  /* 可见范围（授权） */
  const [shareOpen, setShareOpen] = useState(false);
  const [shareMenu, setShareMenu] = useState<PortalMenu | null>(null);
  const [shareItems, setShareItems] = useState<PortalPageShare[]>([]);
  const [shareAll, setShareAll] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSaving, setShareSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await portalApi.getMenuList(menuType === 'all' ? undefined : menuType);
      setList(data || []);
    } catch (e) {
      console.error('[portal] 加载门户菜单失败', e);
      message.error('加载门户菜单失败');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [menuType]);

  useEffect(() => {
    load();
  }, [load]);

  const nameOf = (id?: number) => list.find((m) => m.id === id)?.menuName || '';

  /** 表单里当前选中的菜单类型（跨类型页默认落到 front），用于过滤「父菜单」候选：父菜单须同类型 */
  const watchType = Form.useWatch('menuType', form) as string | undefined;
  const formType = watchType || (menuType === 'all' ? 'front' : menuType);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    // 「自定义菜单」页（menuType=all）不锁定类型，新增时默认落到前端菜单
    const defaultType = menuType === 'all' ? 'front' : menuType;
    form.setFieldsValue({ menuType: defaultType, parentId: 0, linkMode: 1, sortOrder: 0, visible: 1 });
    setModalOpen(true);
  };

  const openEdit = (record: PortalMenu) => {
    setEditing(record);
    form.setFieldsValue({
      menuId: record.id,
      parentId: record.parentId ?? 0,
      menuName: record.menuName,
      icon: record.icon,
      routeUrl: record.routeUrl,
      menuType: record.menuType,
      linkMode: record.linkMode ?? 1,
      sortOrder: record.sortOrder ?? 0,
      visible: record.visible ?? 1,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const ok = await portalApi.submitMenu({
        menuId: editing?.id,
        parentId: values.parentId ?? 0,
        menuName: values.menuName,
        icon: values.icon,
        routeUrl: values.routeUrl,
        menuType: values.menuType,
        linkMode: values.linkMode ?? 1,
        sortOrder: values.sortOrder ?? 0,
        visible: values.visible ? 1 : 0,
      });
      if (ok) {
        message.success(editing ? '菜单已更新' : '菜单已创建');
        setModalOpen(false);
        load();
      } else {
        message.error('保存失败：请检查父菜单是否同类型、名称是否为空');
      }
    } catch (e) {
      console.error('[portal] 保存门户菜单失败', e);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (record: PortalMenu) => {
    try {
      const ok = await portalApi.removeMenu(record.id as number);
      if (ok) {
        message.success(`「${record.menuName}」已删除`);
        load();
      } else {
        message.error('删除失败：系统内置菜单不可删');
      }
    } catch (e) {
      console.error('[portal] 删除门户菜单失败', e);
      message.error('删除失败');
    }
  };

  /* ==================== 可见范围 ==================== */
  const openShare = async (record: PortalMenu) => {
    setShareMenu(record);
    setShareOpen(true);
    setShareLoading(true);
    try {
      const items = (await portalApi.getMenuShareList(record.id as number)) || [];
      setShareItems(items.filter((s) => s.shareType !== 1));
      setShareAll(items.some((s) => s.shareType === 1));
    } catch (e) {
      console.error('[portal] 加载菜单授权失败', e);
      message.error('加载授权失败');
      setShareItems([]);
      setShareAll(false);
    } finally {
      setShareLoading(false);
    }
  };

  const submitShare = async () => {
    if (!shareMenu) return;
    setShareSaving(true);
    try {
      const payload: PortalPageShare[] = shareAll
        ? [{ shareType: 1, shareId: 0 }]
        : shareItems.filter((s) => s.shareType === 2 || s.shareType === 3 || s.shareType === 4 || s.shareType === 5);
      const ok = await portalApi.saveMenuShare(shareMenu.id as number, payload);
      if (ok) {
        message.success('可见范围已更新');
        setShareOpen(false);
      } else {
        message.error('保存失败');
      }
    } catch (e) {
      console.error('[portal] 保存菜单授权失败', e);
      message.error('保存失败');
    } finally {
      setShareSaving(false);
    }
  };

  const columns = [
    {
      title: '菜单名称',
      dataIndex: 'menuName',
      key: 'menuName',
      render: (v: string, r: PortalMenu) => (
        <Space>
          <Text strong>{v}</Text>
          {r.parentId ? <Tag>父级：{nameOf(r.parentId)}</Tag> : <Tag color="blue">顶级</Tag>}
          {r.visible !== 1 && <Tag color="orange">隐藏</Tag>}
          {r.isSystem === 1 && <Tag color="red">内置</Tag>}
        </Space>
      ),
    },
    { title: '链接', dataIndex: 'routeUrl', key: 'routeUrl', ellipsis: true, render: (v: string, r: PortalMenu) => v || (r.linkMode === 2 ? '外部链接' : '-') },
    {
      title: '链接模式',
      dataIndex: 'linkMode',
      key: 'linkMode',
      width: 100,
      render: (v: number) => (v === 2 ? '外部链接' : '站内路由'),
    },
    { title: '排序', dataIndex: 'sortOrder', key: 'sortOrder', width: 70 },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_: any, record: PortalMenu) => (
        <Space size={4}>
          <Button type="link" size="small" disabled={!canManage} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Button type="link" size="small" disabled={!canManage} onClick={() => openShare(record)}>
            可见范围
          </Button>
          <Popconfirm
            title="删除菜单"
            description="将同时删除其子孙菜单，不可恢复。"
            okText="删除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={() => handleRemove(record)}
          >
            <Button type="link" size="small" danger disabled={!canManage || record.isSystem === 1}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const main = (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {title || '门户菜单管理'}
          </Typography.Title>
          <Text type="secondary">
            {desc || '维护门户自有菜单（前端/后端/工具栏/快捷入口/报表菜单）；系统导航菜单(blade_menu)在「系统管理→菜单管理」维护'}
          </Text>
        </Space>
        <Space>
          {!fixedMenuType && (
            <Select value={menuType} style={{ width: 140 }} onChange={setMenuType} options={ALL_TYPES} />
          )}
          <Button icon={<ReloadOutlined />} onClick={load}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} disabled={!canManage} onClick={openCreate}>
            新建菜单
          </Button>
        </Space>
      </Space>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="提示"
        description={`${TYPE_DESC[menuType] || ''}。本页菜单与系统导航菜单(blade_menu)相互独立。注意：首页顶部/左侧默认呈现系统菜单（blade_menu）；需在「门户应用设置 → 导航菜单源 = 门户私有菜单」切换后，本页维护的 front/top 才会在首页生效（对标泛微 portalmenu 自有导航语义，方案一：同表分型 + 源可配置）。未配置「可见范围」默认全员可见。`}
      />

      <Table
        rowKey="id"
        loading={loading}
        columns={columns as any}
        dataSource={list}
        pagination={false}
      />

      <Modal
        title={editing ? '编辑菜单' : '新建菜单'}
        open={modalOpen}
        onOk={handleSubmit}
        confirmLoading={saving}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="menuType" label="菜单类型" rules={[{ required: true, message: '请选择菜单类型' }]}>
            <Select options={MENU_TYPES} disabled={!!editing || fixedMenuType === 'all'} />
          </Form.Item>
          <Form.Item name="parentId" label="父菜单" extra="顶级菜单请选择「顶级」；父菜单须为同类型">
            <Select
              options={[
                { value: 0, label: '（顶级）' },
                ...list
                  .filter((m) => m.id !== editing?.id && (m.menuType == null || m.menuType === formType))
                  .map((m) => ({ value: m.id as number, label: m.menuName as string })),
              ]}
            />
          </Form.Item>
          <Form.Item name="menuName" label="菜单名称" rules={[{ required: true, message: '请输入菜单名称' }]}>
            <Input placeholder="如：工作台" maxLength={64} />
          </Form.Item>
          <Form.Item name="icon" label="图标" extra="antd 图标名（如 home/message/appstore）或图片URL">
            <Input placeholder="如：home" maxLength={255} />
          </Form.Item>
          <Form.Item name="routeUrl" label="链接地址" rules={[{ required: true, message: '请输入链接地址' }]}>
            <Input placeholder="站内路由如 /welcome，或外部 https://..." maxLength={512} />
          </Form.Item>
          <Form.Item name="linkMode" label="链接模式">
            <Select
              options={[
                { value: 1, label: '站内路由' },
                { value: 2, label: '外部链接' },
              ]}
            />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序号" extra="数字越小越靠前">
            <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
          </Form.Item>
          <Form.Item name="visible" label="是否可见" valuePropName="checked">
            <Switch checkedChildren="可见" unCheckedChildren="隐藏" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`可见范围 · ${shareMenu?.menuName || ''}`}
        open={shareOpen}
        onOk={submitShare}
        confirmLoading={shareSaving}
        onCancel={() => setShareOpen(false)}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="未配置授权 = 全员可见；配置后仅命中（全员/本部门/本人）的用户可见。"
        />
        <Spin spinning={shareLoading}>
          <PortalShareEditor
            all={shareAll}
            onAllChange={(v) => {
              setShareAll(v);
              if (v) setShareItems([]);
            }}
            items={shareItems}
            onItemsChange={setShareItems}
          />
        </Spin>
      </Modal>
    </div>
  );

  // 仅独立菜单页（/portal/menumanage）暴露「部门菜单权限」页签；
  // 前端菜单/后端菜单等分类页只维护菜单本身，避免在六个页面重复出现同一功能块。
  if (fixedMenuType) {
    return main;
  }

  return (
    <Tabs
      items={[
        { key: 'list', label: '菜单维护', children: main },
        { key: 'dept', label: '部门菜单权限', children: <MenuDeptPerm /> },
      ]}
    />
  );
};

export default PortalMenuManage;
