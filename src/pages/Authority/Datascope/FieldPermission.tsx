/**
 * 数据权限 · 字段管理
 *
 * 展示所选业务表的全部字段（字段名 / 中文名 / 数据库类型 / 说明），
 * 为每个字段提供「是否可见」「是否可编辑」两个勾选项，支持表头全选、
 * 工具栏批量操作与行内单字段切换；配置一次提交、加载时完整回显。
 *
 * 持久化落点说明：
 *   blade_scope_data 无字段级配置列，且 /data-scope/submit 只反序列化
 *   DataScope 实体、未知字段静默丢弃，无法承载「可见+可编辑」两个维度。
 *   因此复用 blade-formmode 现成的字段权限存取链路
 *     GET/POST /api/blade-formmode/right/field/{key}
 *   以 formId 作为隔离 key，写入 modefieldauthorize 表，并使用专用命名空间：
 *     objtype = 99（自定义标记，不与 1角色/2部门/3岗位/4人员 冲突）
 *     objid   = -1（负数，matchAuthorizeObject 恒不匹配 → 不影响运行期权限聚合）
 *     rightvalue = 位编码：bit0(1)=可见，bit1(2)=可编辑
 *   注意该 POST 是「按 modeid 先删后插」的全量替换，故保存前必须先 GET，
 *   把非本命名空间的既有记录一并带回，避免误删。
 */
import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { history, useLocation } from '@umijs/max';
import {
  App,
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Input,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import type { TableProps } from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DynamicScopeTable from '@/components/DynamicScopeTable';
import {
  listScopeFields,
  submitScopeFields,
  type ScopeFieldConfig,
} from '@/services/authority/dataPermission';
import * as menuApi from '@/services/system/menu';
import { fieldApi, formApi } from '@/services/formmode';
import {
  getFieldAuthorizes,
  type ModeFieldAuthorize,
} from '@/services/formmode/rightApi';
import EditableFieldTable, { type FieldRow } from './components/EditableFieldTable';

/** 隔离命名空间，避免与真实字段权限记录混淆 */
const NS_OBJTYPE = 99;
const NS_OBJID = -1;
const BIT_VISIBLE = 1;
const BIT_EDITABLE = 2;

const STORAGE_KEY = 'datascope:fieldPermission:lastFormId';
const MENU_STORAGE_KEY = 'datascope:fieldPermission:lastMenuId';

interface FormOption {
  value: string;
  label: string;
  tableName?: string;
}

interface MenuOption {
  value: string;
  label: string;
  code?: string;
}

const isNsRecord = (a: ModeFieldAuthorize): boolean =>
  Number(a.objtype) === NS_OBJTYPE && Number(a.objid) === NS_OBJID;

/** 位编码 → 两个布尔 */
const decodePerm = (rv: number): { visible: boolean; editable: boolean } => ({
  visible: !!(rv & BIT_VISIBLE),
  editable: !!(rv & BIT_EDITABLE),
});

const FieldPermissionPage: React.FC = () => {
  const { message, modal } = App.useApp();
  const location = useLocation();
  // 从数据权限配置点进来时，URL 带入当前菜单 id，优先默认选中。
  // Umi Max 的 useLocation() 不带 query 属性，必须自行解析 search。
  const queryMenuId = useMemo(
    () => new URLSearchParams(location.search || '').get('menuId') || undefined,
    [location.search],
  );
  const [forms, setForms] = useState<FormOption[]>([]);
  const [formId, setFormId] = useState<string>();
  const [rows, setRows] = useState<FieldRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [viewMode, setViewMode] = useState<'checkbox' | 'editable'>('checkbox');
  const [menus, setMenus] = useState<MenuOption[]>([]);
  const [menuId, setMenuId] = useState<string>();
  const [menuCode, setMenuCode] = useState<string>();
  const [previewToken, setPreviewToken] = useState(0);
  // load 是 useCallback（避免 effect 反复重建），用 ref 读取最新 menuId
  const currentMenuIdRef = useRef<string>();
  // 记录初始化时恢复的表单 id，菜单确定后据此重新回显列配置
  const restoredFormIdRef = useRef<string>();
  useEffect(() => {
    currentMenuIdRef.current = menuId;
  }, [menuId]);

  /** 加载字段清单 + 已保存配置，合并出每行勾选状态 */
  const load = useCallback(
    async (fid: string) => {
      if (!fid) return;
      setLoading(true);
      try {
        const [definitions, auths] = await Promise.all([
          fieldApi.getByFormId(fid) as Promise<any>,
          getFieldAuthorizes(fid),
        ]);
        const list: any[] = Array.isArray(definitions) ? definitions : definitions?.data ?? [];
        const authList: ModeFieldAuthorize[] = Array.isArray(auths) ? auths : [];

        const saved = new Map<number, number>();
        authList.filter(isNsRecord).forEach((a) => {
          const id = Number(a.fieldid);
          if (Number.isFinite(id)) saved.set(id, Number(a.rightvalue) || 0);
        });
        const everSaved = saved.size > 0;

        // blade_scope_field（新表）是列表动态列的数据源，优先按其回显，
        // 这样可编辑表格里改过的中文名 / 说明 / 顺序也能保存与还原。
        let tableConfigs: ScopeFieldConfig[] = [];
        try {
          tableConfigs = await listScopeFields({ menuId: currentMenuIdRef.current, scopeId: 0 });
        } catch (_e) {
          tableConfigs = [];
        }
        const configByName = new Map<string, ScopeFieldConfig>();
        tableConfigs.forEach((c) => configByName.set(c.fieldName, c));
        const hasTableConfig = configByName.size > 0;

        const merged: FieldRow[] = list
          .map((f, idx) => {
            const id = Number(f?.id ?? f?.fieldId);
            const fieldName = String(f?.fieldName || f?.fieldname || '').trim();
            const cfg = configByName.get(fieldName);
            const rv = saved.get(id);
            const perm = hasTableConfig
              ? { visible: cfg?.isVisible !== 0, editable: cfg?.isEditable === 1 }
              : rv === undefined
                ? { visible: true, editable: false }
                : decodePerm(rv);
            return {
              id,
              fieldName,
              fieldLabel: String(cfg?.fieldLabel || f?.fieldLabel || f?.fieldlabel || '').trim(),
              fieldDbType: String(cfg?.fieldDbType || f?.fieldDbType || f?.fielddbtype || '').trim(),
              description: String(cfg?.description || f?.description || f?.remark || '').trim(),
              fieldHtmlType: String(f?.fieldHtmlType ?? f?.fieldhtmltype ?? '').trim(),
              order: cfg?.sort ?? (Number(f?.dsOrder ?? f?.sort ?? f?.fieldOrder ?? idx) || idx),
              ...(hasTableConfig || everSaved ? perm : { visible: true, editable: false }),
            };
          })
          .filter((r) => r.fieldName && Number.isSafeInteger(r.id) && r.id > 0);
        merged.sort((a, b) => a.order - b.order);
        setRows(merged);
        setSelectedRowKeys([]);
        setDirty(false);
      } catch (_e) {
        message.error('字段清单或已保存配置加载失败');
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [message],
  );

  /** 初始化表单下拉并恢复上次选择 */
  useEffect(() => {
    (async () => {
      try {
        const res: any = await formApi.getAll();
        const list: any[] = Array.isArray(res) ? res : res?.data ?? [];
        const options: FormOption[] = list
          .map((b) => ({
            value: String(b?.id ?? ''),
            label: String(b?.formName || b?.tableName || b?.name || b?.id || ''),
            tableName: b?.tableName,
          }))
          .filter((o) => !!o.value);
        setForms(options);
        let last: string | null = null;
        try {
          last = localStorage.getItem(STORAGE_KEY);
        } catch (_e) {
          // localStorage 不可用不影响功能
        }
        if (last && options.some((o) => o.value === last)) {
          restoredFormIdRef.current = last;
          setFormId(last);
          await load(last);
        }
      } catch (_e) {
        message.error('表单列表加载失败');
      }
      // 关联菜单下拉（新表以 menuId 关联数据权限配置）
      try {
        const res: any = await menuApi.list({ tenantId: '000000' });
        const records: any[] = Array.isArray(res)
          ? res
          : res?.records || res?.data?.records || res?.data || [];
        const menuOptions: MenuOption[] = records
          .map((m) => ({
            value: String(m?.id ?? m?.menuId ?? ''),
            label: String(m?.name || m?.menuName || m?.title || m?.id || ''),
            code: m?.code || m?.menuCode,
          }))
          .filter((o) => !!o.value);
        setMenus(menuOptions);
        // 菜单初始值优先级：URL 带入（从数据权限配置点进来）> 本地记忆
        let lastMenu: string | null = null;
        try {
          lastMenu = localStorage.getItem(MENU_STORAGE_KEY);
        } catch (_e) {
          // ignore
        }
        const initialMenu =
          (queryMenuId && menuOptions.some((o) => o.value === queryMenuId)
            ? queryMenuId
            : null) ||
          (lastMenu && menuOptions.some((o) => o.value === lastMenu) ? lastMenu : null);
        if (initialMenu) {
          currentMenuIdRef.current = initialMenu;
          setMenuId(initialMenu);
          setMenuCode(menuOptions.find((o) => o.value === initialMenu)?.code);
          // 若表单已恢复，按新菜单重新拉取列配置回显 blade_scope_field
          if (restoredFormIdRef.current) {
            load(restoredFormIdRef.current);
          }
        }
      } catch (_e) {
        // 菜单加载失败不阻塞字段配置
      }
    })();
  }, [load, message]);

  const selectForm = (fid?: string) => {
    setFormId(fid);
    if (fid) {
      try {
        localStorage.setItem(STORAGE_KEY, fid);
      } catch (_e) {
        // ignore
      }
      load(fid);
    } else {
      setRows([]);
      setDirty(false);
    }
  };

  const updateRows = (next: FieldRow[]) => {
    setRows(next);
    setDirty(true);
  };

  /** 单个字段切换；取消可见时联动取消可编辑（不可见的字段不应可编辑） */
  const toggle = (id: number, key: 'visible' | 'editable', checked: boolean) => {
    updateRows(
      rows.map((r) => {
        if (r.id !== id) return r;
        if (key === 'visible') {
          return { ...r, visible: checked, editable: checked ? r.editable : false };
        }
        return { ...r, editable: checked, visible: checked ? true : r.visible };
      }),
    );
  };

  /** 批量应用到全部字段或仅选中行 */
  const applyBatch = (
    patch: Partial<Pick<FieldRow, 'visible' | 'editable'>>,
    scope: 'all' | 'selected',
  ) => {
    const target = new Set(scope === 'selected' ? selectedRowKeys.map(Number) : rows.map((r) => r.id));
    if (!target.size) {
      message.warning('请先选择要操作的字段');
      return;
    }
    updateRows(
      rows.map((r) => {
        if (!target.has(r.id)) return r;
        const next = { ...r, ...patch };
        // 联动只按「本次操作显式指定的键」判定，不能无条件跑两条规则：
        // 否则 {visible:false} 遇上原本 editable=true 的行会被重新改回可见。
        if (patch.visible === false) {
          next.editable = false;
        } else if (patch.editable === true) {
          next.visible = true;
        }
        return next;
      }),
    );
  };

  const invert = () => {
    updateRows(
      rows.map((r) => {
        const visible = !r.visible;
        return { ...r, visible, editable: visible ? !r.editable : false };
      }),
    );
  };

  /**
   * 提交：只写 blade_scope_field（列表动态列的唯一数据源）。
   *
   * 不再写 modefieldauthorize：该表是「表单字段级限制」，由 FormRightDrawer
   * 按角色/部门/人员（objtype 1-4）维护；本页旧实现写的 objtype=99/objid=-1
   * 是运行期不消费的配置存储（且把 formId 当 modeid 传，参数也不对），
   * 继续写只会制造死数据，接口还是全量替换，可能误删真实授权。
   */
  const handleSave = async () => {
    if (!formId || !rows.length) {
      message.warning('请先选择业务表单并加载字段');
      return;
    }
    setSaving(true);
    try {
      // 同步写入 blade_scope_field 的「元数据」部分。
      // 可见性唯一入口是数据权限弹窗的「可见字段」区域（勾选同时写 scopeField 与 is_visible），
      // 因此本页保存时 isVisible 必须沿用服务端现值，避免两处交替保存造成失配。
      if (menuId) {
        let serverConfigs: ScopeFieldConfig[] = [];
        try {
          serverConfigs = await listScopeFields({ menuId, scopeId: 0 });
        } catch (_e) {
          serverConfigs = [];
        }
        const serverByName = new Map<string, ScopeFieldConfig>();
        serverConfigs.forEach((c) => {
          if (c?.fieldName && !serverByName.has(c.fieldName)) {
            serverByName.set(c.fieldName, c);
          }
        });
        const configs: ScopeFieldConfig[] = rows
          .filter((r) => /^[A-Za-z_][A-Za-z0-9_$]*$/.test(r.fieldName))
          .map((r, idx) => {
            const server = serverByName.get(r.fieldName);
            return {
              fieldId: String(r.id),
              fieldName: r.fieldName,
              fieldLabel: r.fieldLabel || r.fieldName,
              fieldDbType: r.fieldDbType,
              fieldHtmlType: r.fieldHtmlType,
              description: r.description,
              // 可见性沿用服务端，忽略本页表格里的勾选
              isVisible: server?.isVisible ?? 0,
              isEditable: r.editable ? 1 : 0,
              width: server?.width,
              align: server?.align,
              sort: idx,
            } as ScopeFieldConfig;
          });
        // 后端按差集合并：补全服务端有、但本页字段清单里没有的记录，避免误删
        const submitted = new Set(configs.map((c) => c.fieldName));
        const preserved = serverConfigs.filter(
          (c) => c?.fieldName && !submitted.has(c.fieldName),
        );
        await submitScopeFields({
          scopeId: 0,
          menuId,
          resourceCode: menuCode,
          fields: [...configs, ...preserved],
        });
        const changedVisible = rows.some((r) => {
          const server = serverByName.get(r.fieldName);
          if (!server) return false;
          const serverVisible = server.isVisible === undefined || server.isVisible === 1;
          return serverVisible !== r.visible;
        });
        if (changedVisible) {
          message.warning('字段是否展示由「可见字段」区域统一管理，本页的可见勾选不会生效');
        }
      }
      // 重新拉取，验证落库并回显
      await load(formId);
      setPreviewToken((n) => n + 1);
      message.success(
        menuId
          ? `已保存 ${rows.length} 个字段元数据，列表动态列已同步（可见性由「可见字段」区域决定）`
          : `已保存 ${rows.length} 个字段配置（未关联菜单，列表动态列未同步）`,
      );
    } catch (_e) {
      message.error('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleLeave = () => {
    if (!dirty) {
      history.push('/authority/datascope');
      return;
    }
    modal.confirm({
      title: '有未保存的修改',
      content: '字段配置尚未保存，确定离开吗？',
      okText: '离开',
      cancelText: '继续编辑',
      onOk: () => history.push('/authority/datascope'),
    });
  };

  const visibleCount = useMemo(() => rows.filter((r) => r.visible).length, [rows]);
  const editableCount = useMemo(() => rows.filter((r) => r.editable).length, [rows]);
  const allVisible = rows.length > 0 && visibleCount === rows.length;
  const someVisible = visibleCount > 0 && !allVisible;
  const allEditable = rows.length > 0 && editableCount === rows.length;
  const someEditable = editableCount > 0 && !allEditable;

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return rows;
    return rows.filter((r) =>
      [r.fieldName, r.fieldLabel, r.description, r.fieldDbType]
        .some((s) => (s || '').toLowerCase().includes(k)),
    );
  }, [rows, keyword]);

  const columns: TableProps<FieldRow>['columns'] = [
    {
      title: '序号',
      key: 'index',
      width: 68,
      render: (_, __, i) => i + 1,
    },
    {
      title: '字段名',
      dataIndex: 'fieldName',
      key: 'fieldName',
      width: 200,
      render: (v: string) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{v}</span>
      ),
    },
    {
      title: '字段名称 / 说明',
      key: 'label',
      width: 220,
      responsive: ['md'],
      render: (_, r) => (
        <Tooltip title={r.description || r.fieldLabel || r.fieldName}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <div>{r.fieldLabel || '-'}</div>
            {r.description && <div style={{ color: '#999', fontSize: 12 }}>{r.description}</div>}
          </div>
        </Tooltip>
      ),
    },
    {
      title: '类型',
      dataIndex: 'fieldDbType',
      key: 'fieldDbType',
      width: 120,
      responsive: ['sm'],
      render: (v: string) => <Tag color="blue">{v || '-'}</Tag>,
    },
    {
      title: '字段ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      responsive: ['lg'],
      render: (v: number) => <span style={{ color: '#999', fontSize: 12 }}>{v}</span>,
    },
    {
      title: (
        <Space size={4}>
          <Checkbox
            checked={allVisible}
            indeterminate={someVisible}
            onChange={(e) => applyBatch({ visible: e.target.checked }, 'all')}
            data-testid="fp-all-visible"
          />
          <span>是否可见</span>
        </Space>
      ),
      key: 'visible',
      width: 130,
      align: 'center',
      render: (_, r) => (
        <Checkbox
          checked={r.visible}
          onChange={(e) => toggle(r.id, 'visible', e.target.checked)}
          data-testid={`fp-visible-${r.fieldName}`}
        />
      ),
    },
    {
      title: (
        <Space size={4}>
          <Checkbox
            checked={allEditable}
            indeterminate={someEditable}
            onChange={(e) => applyBatch({ editable: e.target.checked }, 'all')}
            data-testid="fp-all-editable"
          />
          <span>是否可编辑</span>
        </Space>
      ),
      key: 'editable',
      width: 140,
      align: 'center',
      render: (_, r) => (
        <Checkbox
          checked={r.editable}
          onChange={(e) => toggle(r.id, 'editable', e.target.checked)}
          data-testid={`fp-editable-${r.fieldName}`}
        />
      ),
    },
    {
      title: '状态',
      key: 'state',
      width: 120,
      responsive: ['md'],
      render: (_, r) => {
        if (!r.visible) return <Tag>隐藏</Tag>;
        return r.editable ? <Tag color="green">可见 · 可编辑</Tag> : <Tag color="blue">仅可见</Tag>;
      },
    },
  ];

  const currentForm = forms.find((f) => f.value === formId);

  /** 预览数据：按动态列的 fieldName 造两行示例值，用于直观验证表头渲染 */
  const previewData = useMemo(() => {
    const make = (i: number) => {
      const record: Record<string, any> = { id: String(i) };
      rows.filter((r) => r.visible).forEach((r) => {
        const t = (r.fieldDbType || '').toLowerCase();
        record[r.fieldName] = /(int|decimal|numeric|bigint|float|double)/.test(t)
          ? i * 100
          : /(datetime|date|timestamp)/.test(t)
            ? `2026-11-${String(10 + i).padStart(2, '0')} 10:00:00`
            : `${r.fieldLabel || r.fieldName} 示例${i}`;
      });
      return record;
    };
    return [make(1), make(2)];
  }, [rows]);

  return (
    <PageContainer
      title="数据权限 · 字段元数据（高级）"
      subTitle="维护字段中文名、类型、说明、顺序与可编辑性；是否展示由「可见字段」勾选决定"
      extra={[
        <Button key="back" icon={<ArrowLeftOutlined />} onClick={handleLeave}>
          返回数据权限
        </Button>,
      ]}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="字段是否展示，请在数据权限配置弹窗的「可见字段」区域勾选"
        description="勾选集合同时写入 SQL 可见字段 scopeField 与前端列表动态列 is_visible。本页仅维护中文名 / 类型 / 说明 / 顺序 / 可编辑性（作用域是通用列表的行内编辑），保存时可见性恒取服务端现值；表格里的「是否可见」只反映当前状态，请到「可见字段」区域修改。业务表单的字段级隐藏 / 只读是另一套配置，请在「表单建模 → 表单权限」中按角色设置。"
      />
      <Card variant="outlined" size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={6} lg={5}>
            <div style={{ marginBottom: 4, color: '#666', fontSize: 12 }}>选择业务表（字段来源）</div>
            <Select
              showSearch
              allowClear
              optionFilterProp="label"
              placeholder="请选择业务表"
              style={{ width: '100%' }}
              options={forms}
              value={formId}
              onChange={selectForm}
              data-testid="fp-form-select"
            />
          </Col>
          <Col xs={24} sm={12} md={6} lg={5}>
            <div style={{ marginBottom: 4, color: '#666', fontSize: 12 }}>关联菜单（列表动态列作用域）</div>
            <Select
              showSearch
              allowClear
              optionFilterProp="label"
              placeholder="请选择菜单"
              style={{ width: '100%' }}
              options={menus}
              value={menuId}
              onChange={(v) => {
                currentMenuIdRef.current = v;
                setMenuId(v);
                setMenuCode(menus.find((m) => m.value === v)?.code);
                try {
                  if (v) localStorage.setItem(MENU_STORAGE_KEY, v);
                  else localStorage.removeItem(MENU_STORAGE_KEY);
                } catch (_e) {
                  // ignore
                }
                if (formId) load(formId);
              }}
              data-testid="fp-menu-select"
            />
          </Col>
          <Col xs={24} sm={12} md={3} lg={3}>
            <Statistic title="字段总数" value={rows.length} data-testid="fp-total" />
          </Col>
          <Col xs={12} sm={6} md={3} lg={3}>
            <Statistic title="可见" value={visibleCount} styles={{ content: { color: '#1677ff' } }} data-testid="fp-stat-visible" />
          </Col>
          <Col xs={12} sm={6} md={3} lg={3}>
            <Statistic title="可编辑" value={editableCount} styles={{ content: { color: '#52c41a' } }} data-testid="fp-stat-editable" />
          </Col>
          <Col xs={24} md={4} lg={6} style={{ textAlign: { md: 'right' } as any }}>
            <Space wrap>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => formId && load(formId)}
                disabled={!formId || loading}
                data-testid="fp-reload"
              >
                重新加载
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saving}
                disabled={!formId || !rows.length}
                onClick={handleSave}
                data-testid="fp-save"
              >
                保存配置
              </Button>
            </Space>
          </Col>
        </Row>
        {currentForm?.tableName && (
          <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
            <AppstoreOutlined style={{ marginRight: 4 }} />
            物理表：<span style={{ fontFamily: 'monospace' }}>{currentForm.tableName}</span>
            <span style={{ marginLeft: 12 }}>共 {rows.length} 个字段</span>
          </div>
        )}
      </Card>

      {dirty && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title="有未保存的修改"
          description="点击「保存配置」后才会写入服务端；「重新加载」可放弃修改并恢复上次保存的状态。"
        />
      )}

      <Card variant="outlined" size="small">
        <div style={{ marginBottom: 12 }}>
          <Segmented
            value={viewMode}
            onChange={(v) => setViewMode(v as 'checkbox' | 'editable')}
            options={[
              { label: '勾选视图', value: 'checkbox' },
              { label: '可编辑表格', value: 'editable' },
            ]}
            data-testid="fp-view-switch"
          />
        </div>

        {viewMode === 'checkbox' && (
          <>
            <Space size={8} wrap style={{ marginBottom: 12, width: '100%' }}>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="搜索字段名 / 说明 / 类型"
                style={{ width: 240 }}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                data-testid="fp-search"
              />
              <Button size="small" onClick={() => applyBatch({ visible: true }, 'all')} data-testid="fp-batch-visible">
                全部设为可见
              </Button>
              <Button size="small" onClick={() => applyBatch({ editable: true }, 'all')} data-testid="fp-batch-editable">
                全部设为可编辑
              </Button>
              <Button size="small" onClick={() => applyBatch({ visible: false }, 'all')} data-testid="fp-batch-clear">
                全部清空
              </Button>
              <Button size="small" onClick={invert} data-testid="fp-batch-invert">
                可见项反选
              </Button>
              <span style={{ color: '#999', fontSize: 12, marginLeft: 4 }}>
                不可见的字段会自动取消「可编辑」；勾选「可编辑」会自动保证可见。
              </span>
            </Space>

            <Space size={8} wrap style={{ marginBottom: 12 }}>
              <span style={{ color: '#666', fontSize: 12 }}>对选中行批量操作：</span>
              <Button
                size="small"
                disabled={!selectedRowKeys.length}
                onClick={() => applyBatch({ visible: true }, 'selected')}
              >
                设为可见
              </Button>
              <Button
                size="small"
                disabled={!selectedRowKeys.length}
                onClick={() => applyBatch({ editable: true }, 'selected')}
              >
                设为可编辑
              </Button>
              <Button
                size="small"
                disabled={!selectedRowKeys.length}
                onClick={() => applyBatch({ visible: false }, 'selected')}
              >
                设为隐藏
              </Button>
              {selectedRowKeys.length > 0 && <Tag color="processing">已选 {selectedRowKeys.length} 行</Tag>}
            </Space>
          </>
        )}

        {viewMode === 'editable' && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            title="可编辑表格（自 antdprov5 移植）"
            description="支持行内编辑列名 / 字段名、是否显示 / 是否可编辑开关、拖拽手柄排序与新增行。新增的草稿行只在本页生效、不写入服务端；修改后请点击上方「保存配置」。"
          />
        )}

        <Spin spinning={loading}>
          {!formId ? (
            <Empty description="请先在上方选择业务表" style={{ padding: '48px 0' }} />
          ) : viewMode === 'editable' ? (
            <div data-testid="fp-editable-table">
              <EditableFieldTable value={rows} onChange={updateRows} />
            </div>
          ) : (
            <Table<FieldRow>
              rowKey="id"
              size="small"
              columns={columns}
              dataSource={filtered}
              pagination={false}
              scroll={{ x: 900, y: 480 }}
              rowSelection={{
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys),
              }}
              locale={{ emptyText: <Empty description="该表暂无字段或无匹配结果" /> }}
              data-testid="fp-table"
            />
          )}
        </Spin>
      </Card>

      <Card
        variant="outlined"
        size="small"
        title="列表动态列预览（统一组件 DynamicScopeTable）"
        extra={
          <span style={{ color: '#999', fontSize: 12 }}>
            {menuId ? '表头由 blade_scope_field 配置实时生成' : '请先选择关联菜单'}
          </span>
        }
      >
        {menuId ? (
          <DynamicScopeTable
            menuId={menuId}
            scopeId={0}
            rowKey="id"
            refreshToken={previewToken}
            dataSource={previewData}
            tableProps={{ pagination: false, search: false, options: false, toolBarRender: false }}
            fallbackColumns={[
              { title: 'ID', dataIndex: 'id', hideInSearch: true },
              { title: '名称', dataIndex: 'name', hideInSearch: true },
            ]}
            showEmptyHint={false}
          />
        ) : (
          <Empty description="选择关联菜单后可预览列表动态列" style={{ padding: '24px 0' }} />
        )}
      </Card>
    </PageContainer>
  );
};

export default FieldPermissionPage;
