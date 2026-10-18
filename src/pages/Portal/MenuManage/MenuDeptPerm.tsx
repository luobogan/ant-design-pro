/**
 * 部门菜单权限（对标泛微 ecology 门户菜单维护 leftmenu 页）
 *
 * 布局：左侧部门树（选择授权对象） + 右侧菜单树（勾选授权 + 顶部工具条增删改）
 * 顶部按钮口径与泛微对齐：添加 / 编辑 / 删除 / 使用限制 / 更多（批量操作）
 *
 * 后端：
 *   GET  /api/blade-portal/menu/dept/share?deptId=&menuType=   反查部门可见菜单
 *   POST /api/blade-portal/menu/dept/share/set                  批量保存部门授权
 *   POST /api/blade-portal/menu/submit、/menu/remove            菜单增删改
 *   GET|POST /api/blade-portal/menu/share/list|/set             菜单使用限制（可见范围）
 *
 * 数据模型要点（blade_portal_menu_share）：「无任何 share 记录」= 全员可见，
 * 所以单纯「取消勾选 → 删记录」会让菜单回落成全员可见、限制失效。服务端保存时会对
 * 未勾选菜单补写限定标记（shareType=6），使菜单从「全员可见」切换为「须命中才可见」。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Dropdown,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Row,
  Space,
  Spin,
  Tabs,
  Tag,
  Tooltip,
  Tree,
  Typography,
  message,
} from 'antd';
import { PlusOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { portalApi } from '@/services/portal';
import * as deptApi from '@/services/system/dept';
import PortalShareEditor from '../components/PortalShareEditor';
import PortalMenuFormModal, { type PortalMenuFormValues } from './PortalMenuFormModal';
import type { PortalDeptMenuVO, PortalMenu, PortalMenuSaveData, PortalPageShare } from '@/services/portal';

const { Text } = Typography;

/** 可授权的两类门户导航菜单 */
const MENU_TYPE_TABS = [
  { key: 'front', label: '前端菜单' },
  { key: 'top', label: '后端菜单' },
];

const MENU_TYPE_NAME: Record<string, string> = { front: '前端菜单', top: '后端菜单' };

interface DeptNode {
  id: string;
  parentId?: string;
  name: string;
  children?: DeptNode[];
}

/** 后端 /dept/tree 返回 DeptVO（deptName/fullName），兼容旧的 title 字段 */
const normalizeDepts = (raw: any): DeptNode[] => {
  const conv = (list: any[]): DeptNode[] =>
    (list || []).map((n: any) => ({
      id: String(n?.id ?? ''),
      parentId: n?.parentId != null ? String(n.parentId) : undefined,
      name: n?.deptName || n?.fullName || n?.name || n?.title || String(n?.id ?? ''),
      children: Array.isArray(n?.children) && n.children.length ? conv(n.children) : undefined,
    }));
  return conv(Array.isArray(raw) ? raw : raw?.data || []);
};

/** share_type=5 分部不在部门树上体现（分部=最浅非零祖先），这里只列部门/个人/角色 */
const SHARE_TYPES_KEPT = [2, 3, 4];

const MenuDeptPerm: React.FC = () => {
  /* ==================== 部门树 ==================== */
  const [deptTree, setDeptTree] = useState<DeptNode[]>([]);
  const [deptLoading, setDeptLoading] = useState(true);
  const [deptKeyword, setDeptKeyword] = useState('');
  const [selectedDept, setSelectedDept] = useState<string | undefined>(undefined);
  const [selectedDeptName, setSelectedDeptName] = useState('');

  /* ==================== 菜单（树 + 勾选授权） ==================== */
  const [menuType, setMenuType] = useState('front');
  const [items, setItems] = useState<PortalDeptMenuVO[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  /** key: menuType → 勾选集合：切页签时保留未保存的勾选状态 */
  const [draft, setDraft] = useState<Record<string, Set<number>>>({});
  /** 当前选中的树节点（用于编辑/删除/使用限制） */
  const [activeId, setActiveId] = useState<number | undefined>(undefined);

  /* ==================== 菜单增删改 ==================== */
  const [formOpen, setFormOpen] = useState(false);
  const [formEditing, setFormEditing] = useState<PortalMenu | null>(null);
  const [formSaving, setFormSaving] = useState(false);

  /* ==================== 使用限制（可见范围） ==================== */
  const [shareOpen, setShareOpen] = useState(false);
  const [shareItems, setShareItems] = useState<PortalPageShare[]>([]);
  const [shareAll, setShareAll] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSaving, setShareSaving] = useState(false);

  const loadDepts = useCallback(async () => {
    setDeptLoading(true);
    try {
      setDeptTree(normalizeDepts(await deptApi.treeScope({})));
    } catch (e) {
      console.error('[portal] 加载部门树失败', e);
      message.error('加载部门树失败');
    } finally {
      setDeptLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDepts();
  }, [loadDepts]);

  const deptTreeData = useMemo(() => {
    const kw = deptKeyword.trim().toLowerCase();
    const build = (nodes: DeptNode[]): any[] =>
      nodes
        .map((n) => ({ key: n.id, title: n.name, children: build(n.children || []) }))
        .filter((n) => !kw || n.title.toLowerCase().includes(kw) || n.children?.length);
    return build(deptTree);
  }, [deptTree, deptKeyword]);

  const loadMenus = useCallback(async (deptId: string, type: string) => {
    setItemsLoading(true);
    try {
      const data = (await portalApi.getDeptMenuShare(Number(deptId), type)) || [];
      setItems(data);
      // 服务端返回的 checked 反映真实可见性；仅在未缓存草稿时初始化，避免覆盖未保存勾选
      setDraft((prev) =>
        prev[type]
          ? prev
          : { ...prev, [type]: new Set(data.filter((m) => m.checked).map((m) => Number(m.id))) },
      );
    } catch (e) {
      console.error('[portal] 加载部门菜单权限失败', e);
      message.error('加载菜单权限失败');
      setItems([]);
    } finally {
      setItemsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedDept) return;
    setDraft({});
    loadMenus(selectedDept, menuType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDept]);

  useEffect(() => {
    if (!selectedDept) return;
    loadMenus(selectedDept, menuType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuType]);

  const checkedSet = draft[menuType] || new Set<number>();
  const activeMenu = useMemo(
    () => items.find((m) => Number(m.id) === activeId),
    [items, activeId],
  );

  const menuTreeData = useMemo(() => {
    const build = (parentId: number): any[] =>
      items
        .filter((m) => (m.parentId ?? 0) === parentId)
        .map((m) => {
          const id = Number(m.id);
          const children = build(id);
          return {
            key: String(id),
            title: (
              <Space size={6} wrap>
                <Text delete={m.visible === 0}>{m.menuName}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {m.routeUrl || '（分组）'}
                </Text>
                {m.visible === 0 && <Tag color="orange">已隐藏</Tag>}
                {m.limited ? (
                  <Tooltip title={`已配置 ${m.shareCount || 0} 条可见范围，未按范围授权的对象不可见`}>
                    <Tag color="blue">已限定</Tag>
                  </Tooltip>
                ) : (
                  <Tooltip title="没有任何可见范围记录，当前对所有人可见">
                    <Tag>全员可见</Tag>
                  </Tooltip>
                )}
              </Space>
            ),
            children: children.length ? children : undefined,
          };
        });
    return build(0);
  }, [items]);

  /* ==================== 保存部门授权 ==================== */
  const onCheck = (checked: any) => {
    const keys: number[] = (Array.isArray(checked) ? checked : checked.checked || [])
      .map((k: any) => Number(k))
      .filter((n: number) => !Number.isNaN(n));
    setDraft((prev) => ({ ...prev, [menuType]: new Set(keys) }));
  };

  const save = async () => {
    if (!selectedDept) {
      message.warning('请先在左侧选择部门');
      return;
    }
    setSaving(true);
    try {
      const ok = await portalApi.saveDeptMenuShare({
        deptId: Number(selectedDept),
        menuType,
        menuIds: Array.from(checkedSet),
      });
      if (ok) {
        message.success(`已保存「${selectedDeptName}」的${MENU_TYPE_NAME[menuType]}权限`);
        loadMenus(selectedDept, menuType);
      } else {
        message.error('保存失败');
      }
    } catch (e) {
      console.error('[portal] 保存部门菜单权限失败', e);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  /* ==================== 菜单增删改 ==================== */
  const openCreate = () => {
    setFormEditing(null);
    setFormOpen(true);
  };

  const openEdit = () => {
    if (!activeMenu) {
      message.warning('请先点击选中一个菜单');
      return;
    }
    setFormEditing({
      id: activeMenu.id,
      parentId: activeMenu.parentId,
      menuName: activeMenu.menuName,
      icon: activeMenu.icon,
      routeUrl: activeMenu.routeUrl,
      menuType: activeMenu.menuType,
      sortOrder: activeMenu.sortOrder,
      visible: activeMenu.visible,
    } as PortalMenu);
    setFormOpen(true);
  };

  const submitForm = async (values: PortalMenuFormValues) => {
    setFormSaving(true);
    try {
      const ok = await portalApi.submitMenu({
        menuId: values.menuId,
        parentId: values.parentId ?? 0,
        menuName: values.menuName,
        icon: values.icon,
        routeUrl: values.routeUrl,
        menuType,
        linkMode: values.linkMode ?? 1,
        sortOrder: values.sortOrder ?? 0,
        visible: values.visible ? 1 : 0,
      } as PortalMenuSaveData);
      if (ok) {
        message.success(values.menuId ? '菜单已更新' : '菜单已创建');
        setFormOpen(false);
        setActiveId(undefined);
        if (selectedDept) loadMenus(selectedDept, menuType);
      } else {
        message.error('保存失败：请检查上级菜单是否同类型、名称是否为空');
      }
    } catch (e) {
      console.error('[portal] 保存菜单失败', e);
      message.error('保存失败');
    } finally {
      setFormSaving(false);
    }
  };

  const remove = async () => {
    if (!activeMenu?.id) {
      message.warning('请先点击选中一个菜单');
      return;
    }
    try {
      const ok = await portalApi.removeMenu(activeMenu.id);
      if (ok) {
        message.success(`「${activeMenu.menuName}」已删除`);
        setActiveId(undefined);
        if (selectedDept) loadMenus(selectedDept, menuType);
      } else {
        message.error('删除失败：系统内置菜单不可删');
      }
    } catch (e) {
      console.error('[portal] 删除菜单失败', e);
      message.error('删除失败');
    }
  };

  /* ==================== 使用限制（菜单可见范围） ==================== */
  const openShare = async (menuId: number) => {
    setShareOpen(true);
    setShareLoading(true);
    try {
      const list = (await portalApi.getMenuShareList(menuId)) || [];
      setShareItems(list.filter((s: any) => SHARE_TYPES_KEPT.includes(s.shareType)) as PortalPageShare[]);
      setShareAll(list.some((s: any) => s.shareType === 1));
    } catch (e) {
      console.error('[portal] 加载菜单使用限制失败', e);
      message.error('加载使用限制失败');
      setShareItems([]);
      setShareAll(false);
    } finally {
      setShareLoading(false);
    }
  };

  const saveShare = async (menuId: number) => {
    setShareSaving(true);
    try {
      const payload: PortalPageShare[] = shareAll
        ? [{ shareType: 1, shareId: 0 } as PortalPageShare]
        : (shareItems.filter(
            (s: any) => s.shareType === 2 || s.shareType === 3 || s.shareType === 4 || s.shareType === 5,
          ) as PortalPageShare[]);
      const ok = await portalApi.saveMenuShare(menuId, payload);
      if (ok) {
        message.success('使用限制已更新');
        setShareOpen(false);
        if (selectedDept) loadMenus(selectedDept, menuType);
      } else {
        message.error('保存失败');
      }
    } catch (e) {
      console.error('[portal] 保存菜单使用限制失败', e);
      message.error('保存失败');
    } finally {
      setShareSaving(false);
    }
  };

  /** 更多：批量把勾选的菜单设为同样的使用限制（用「部门 = 当前选中部门」兜底表达） */
  const batchShareByDept = async () => {
    if (!selectedDept) {
      message.warning('请先在左侧选择部门');
      return;
    }
    if (!checkedSet.size) {
      message.warning('请先勾选要设置的菜单');
      return;
    }
    const hide = message.loading('批量设置中…', 0);
    try {
      for (const id of Array.from(checkedSet)) {
        await portalApi.saveMenuShare(id, [
          { shareType: 2, shareId: Number(selectedDept) } as PortalPageShare,
        ]);
      }
      message.success(`已把 ${checkedSet.size} 个菜单的使用限制设为「部门：${selectedDeptName}」`);
      if (selectedDept) loadMenus(selectedDept, menuType);
    } catch (e) {
      console.error('[portal] 批量设置使用限制失败', e);
      message.error('批量设置失败');
    } finally {
      hide();
    }
  };

  const renderTree = () =>
    items.length ? (
      <Tree
        checkable
        selectable
        defaultExpandAll
        treeData={menuTreeData}
        checkedKeys={Array.from(checkedSet).map(String)}
        selectedKeys={activeId != null ? [String(activeId)] : []}
        onCheck={onCheck}
        onSelect={(keys) => setActiveId(keys[0] != null ? Number(keys[0]) : undefined)}
        style={{ maxHeight: 480, overflow: 'auto' }}
      />
    ) : (
      <Empty description={`暂无${MENU_TYPE_NAME[menuType] || '菜单'}数据`} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 32 }} />
    );

  return (
    <Row gutter={16}>
      {/* ==================== 左：部门树 ==================== */}
      <Col xs={24} md={7}>
        <Card
          title="组织机构"
          size="small"
          extra={<Button type="link" icon={<ReloadOutlined />} onClick={loadDepts} />}
        >
          <Input.Search
            allowClear
            placeholder="搜索部门"
            value={deptKeyword}
            onChange={(e) => setDeptKeyword(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <Spin spinning={deptLoading}>
            <div style={{ maxHeight: 520, overflow: 'auto' }}>
              {deptTreeData.length ? (
                <Tree
                  treeData={deptTreeData}
                  defaultExpandAll
                  selectedKeys={selectedDept ? [selectedDept] : []}
                  onSelect={(keys, info: any) => {
                    const key = keys[0] as string;
                    setSelectedDept(key);
                    setSelectedDeptName(info?.node?.title || '');
                    setActiveId(undefined);
                  }}
                />
              ) : (
                <Empty description="暂无部门数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
          </Spin>
        </Card>
      </Col>

      {/* ==================== 右：菜单勾选区 ==================== */}
      <Col xs={24} md={17}>
        <Card
          size="small"
          title={selectedDept ? `菜单权限 · ${selectedDeptName}` : '菜单权限'}
          extra={
            <Space wrap>
              <Button icon={<PlusOutlined />} onClick={openCreate}>
                添加
              </Button>
              <Button onClick={openEdit} disabled={!activeMenu}>
                编辑
              </Button>
              <Popconfirm
                title={`删除菜单「${activeMenu?.menuName || ''}」`}
                description="将同时删除其子孙菜单，不可恢复。"
                okText="删除"
                okButtonProps={{ danger: true }}
                onConfirm={remove}
              >
                <Button danger disabled={!activeMenu}>
                  删除
                </Button>
              </Popconfirm>
              <Button onClick={() => activeMenu?.id && openShare(activeMenu.id)} disabled={!activeMenu}>
                使用限制
              </Button>
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'batch-share',
                      label: `批量使用限制（按勾选的 ${checkedSet.size} 项）`,
                      onClick: batchShareByDept,
                    },
                    {
                      key: 'clear-limit',
                      label: '恢复全员可见（清除勾选项的限制）',
                      onClick: async () => {
                        if (!checkedSet.size) {
                          message.warning('请先勾选菜单');
                          return;
                        }
                        const hide = message.loading('处理中…', 0);
                        try {
                          for (const id of Array.from(checkedSet)) {
                            await portalApi.saveMenuShare(id, []);
                          }
                          message.success('已恢复为全员可见');
                          if (selectedDept) loadMenus(selectedDept, menuType);
                        } finally {
                          hide();
                        }
                      },
                    },
                  ],
                }}
              >
                <Button>更多</Button>
              </Dropdown>
              <Button icon={<ReloadOutlined />} disabled={!selectedDept} onClick={() => selectedDept && loadMenus(selectedDept, menuType)}>
                刷新
              </Button>
              <Button type="primary" icon={<SaveOutlined />} loading={saving} disabled={!selectedDept} onClick={save}>
                保存
              </Button>
            </Space>
          }
        >
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="勾选 = 该部门可见。首次保存会把菜单从「全员可见」切换为「须授权才可见」：未勾选的部门将不再看到该菜单。"
            description="「全员可见」= 该菜单尚未配置任何可见范围；一旦在此勾选某菜单，它即变为限定状态，其余未授权部门自动不可见。"
          />

          {!selectedDept ? (
            <Empty description="请先在左侧选择部门" style={{ padding: 48 }} />
          ) : (
            <Spin spinning={itemsLoading}>
              <Tabs
                activeKey={menuType}
                onChange={(k) => {
                  setMenuType(k);
                  setActiveId(undefined);
                }}
                items={MENU_TYPE_TABS.map((t) => ({ key: t.key, label: t.label, children: renderTree() }))}
              />
              <Text type="secondary">
                当前勾选 {checkedSet.size} / {items.length} 项
                {activeMenu ? `；已选中「${activeMenu.menuName}」` : ''}
              </Text>
            </Spin>
          )}
        </Card>
      </Col>

      {/* ==================== 新增/编辑菜单 ==================== */}
      <PortalMenuFormModal
        open={formOpen}
        editing={formEditing}
        menuType={menuType}
        sameTypeList={items.map((m) => ({
          id: m.id,
          parentId: m.parentId,
          menuName: m.menuName,
          menuType: m.menuType,
        })) as PortalMenu[]}
        saving={formSaving}
        onSubmit={submitForm}
        onCancel={() => setFormOpen(false)}
      />

      {/* ==================== 使用限制 ==================== */}
      <Modal
        title={`使用限制 · ${activeMenu?.menuName || ''}`}
        open={shareOpen}
        onOk={() => activeMenu?.id && saveShare(activeMenu.id)}
        confirmLoading={shareSaving}
        onCancel={() => setShareOpen(false)}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
        width={560}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="未配置使用限制 = 全员可见；配置后仅命中（全员/本部门/本人/角色）的用户可见。"
          description="与「部门菜单权限」的关系：本弹窗配置的是菜单级范围；右侧勾选负责把某个部门加进/移出范围。"
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
    </Row>
  );
};

export default MenuDeptPerm;
