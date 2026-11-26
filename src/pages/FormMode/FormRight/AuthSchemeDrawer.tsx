import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button, Checkbox, Drawer, Empty, Input, InputNumber, message, Modal, Popconfirm, Select, Space, Steps, Switch, Table, Tabs, Tag, TreeSelect,
} from 'antd';
import { CopyOutlined, DeleteOutlined, EditOutlined, PlusOutlined, SyncOutlined, TableOutlined } from '@ant-design/icons';
import AuthObjectPicker from '@/components/FormMode/AuthObjectPicker';
import { resolveItemNames, type PersonOrgCategory } from '@/components/FormMode/personOrg';
import * as roleApi from '@/services/authority/role';
import * as matrixApi from '@/pages/System/Matrix/service';
import * as menuApi from '@/services/system/menu';
import ExcelDesign from '@/pages/FormMode/ExcelDesign/ExcelDesign';
import { LAYOUT_TYPES, DEFAULT_LAYOUT_TYPE_NAMES, layoutTypeName } from '@/pages/FormMode/ExcelDesign/layoutTypes';
import {
  getFormLayout, getFormLayoutTypeNames, saveFormLayoutTypeName, syncFormLayout,
} from '@/services/formmode/formLayoutApi';
import { fieldApi, formApi } from '@/services/formmode';
import type { FieldDefinition } from '@/services/formmode/typings';
import {
  copyAuthScheme, deleteAuthScheme, deleteAuthSchemes, listAuthSchemes, saveAuthScheme, saveAuthSchemes, type AuthScheme,
} from '@/services/formmode/rightApi';

interface Props {
  formId?: string;
  formName?: string;
  open: boolean;
  onClose: () => void;
}

const SUBJECT_TYPES = [
  { value: 1, label: '角色' },
  { value: 2, label: '部门' },
  { value: 3, label: '岗位' },
  { value: 4, label: '人员' },
  { value: 5, label: '分部' },
  { value: 6, label: '矩阵' },
  { value: 7, label: '全员' },
];

const PICKER_TYPE: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 7 };

const MENU_ICON_OPTIONS = [
  { value: 'file-text', label: '文档' },
  { value: 'form', label: '表单' },
  { value: 'table', label: '表格' },
  { value: 'appstore', label: '应用' },
  { value: 'dashboard', label: '仪表盘' },
  { value: 'folder', label: '目录' },
  { value: 'setting', label: '设置' },
  { value: 'edit', label: '编辑' },
];

const SUBJECT_CATEGORY: Record<number, PersonOrgCategory> = {
  1: 'role',
  2: 'dept',
  3: 'post',
  4: 'hrm',
  5: 'branch',
};

const subjectNameKey = (type?: number | string, id?: string | number) => `${type ?? ''}:${id ?? ''}`;

async function resolveSubjectNames(type: number, ids: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const unique = Array.from(new Set(ids.filter((id) => id != null && id !== '')));
  if (!unique.length) return result;
  if (type === 7) {
    unique.forEach((id) => { result[id] = '所有登录用户'; });
    return result;
  }
  if (type === 6) {
    try {
      const res: any = await matrixApi.list();
      const rows = Array.isArray(res) ? res : (res?.data || []);
      for (const row of rows) {
        const id = String(row?.id ?? '');
        if (unique.includes(id)) result[id] = row?.matrixName || row?.name || id;
      }
    } catch { }
  } else if (type === 1) {
    try {
      const res: any = await roleApi.list({ current: 1, size: 1000 });
      const roots = Array.isArray(res) ? res : (res?.data?.records || res?.records || res?.data || []);
      const flatten = (rows: any[]) => {
        for (const row of rows || []) {
          const id = String(row?.id ?? '');
          if (unique.includes(id)) result[id] = row?.roleName || row?.roleAlias || row?.name || id;
          if (Array.isArray(row?.children)) flatten(row.children);
        }
      };
      flatten(roots);
    } catch { }
  } else {
    const category = SUBJECT_CATEGORY[type];
    if (category) {
      try {
        const rows = await resolveItemNames(category, unique);
        for (const row of rows) result[row.id] = row.name || row.id;
      } catch { }
    }
  }
  for (const id of unique) if (!result[id]) result[id] = id;
  return result;
}

const RIGHT_TYPES = [
  { value: 1, label: '可见' },
  { value: 2, label: '新建' },
  { value: 3, label: '编辑' },
  { value: 4, label: '删除' },
  { value: 5, label: '详情' },
  { value: 6, label: '导入' },
  { value: 7, label: '导出' },
];

const SCOPE_TYPES = [
  { value: 1, label: '全部可见' },
  { value: 2, label: '本人可见' },
  { value: 3, label: '所在机构可见' },
  { value: 4, label: '所在机构及子级可见' },
  { value: 5, label: '自定义' },
];

/** 人员方案按当前用户身份授权，机构维度由部门/分部等方案表达，不再提供机构档位。 */
const scopeTypeOptions = (subjectType?: number) => Number(subjectType) === 4
  ? SCOPE_TYPES.filter((item) => item.value === 1 || item.value === 2 || item.value === 5)
  : SCOPE_TYPES;

const SCOPE_RIGHT_TYPES = [
  { value: 1, label: '查看' },
  { value: 2, label: '新增' },
  { value: 3, label: '编辑' },
  { value: 4, label: '删除' },
];

const emptyScheme = (formId?: string): AuthScheme => ({
  formId,
  schemeName: '',
  subjectType: 4,
  subjectId: undefined,
  subjectName: undefined,
  includeSub: 0,
  showlevel: undefined,
  showlevel2: undefined,
  priority: 100,
  rights: [],
  fieldGroups: [],
  dataScopes: [],
  formManageScope: { scopeType: 1, scopeValue: '' },
  menu: {
    parentId: '0',
    formMenuName: '',
    menuPath: formId ? `/formmode/formview/${formId}` : '',
    menuIcon: 'file-text',
    menuAlias: '',
    menuSort: 5,
    menuStatus: 1,
    menuShares: [],
    roleMenuNames: {},
  },
});

const newGroupKey = () => `scheme-group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** 一个方案对应一个授权对象，因此只需要一个隐含字段组；不向用户暴露“新增组”。 */
const ensureSingleFieldGroup = (s: AuthScheme): AuthScheme => {
  const first = Array.isArray(s.fieldGroups) && s.fieldGroups.length ? s.fieldGroups[0] : null;
  return {
    ...s,
    fieldGroups: [{
      id: first?.id,
      groupKey: first?.groupKey || newGroupKey(),
      groupName: '字段配置',
      fields: first?.fields || [],
    }],
  };
};

const AuthSchemeDrawer: React.FC<Props> = ({ formId, formName, open, onClose }) => {
  const [schemes, setSchemes] = useState<AuthScheme[]>([]);
  const [selectedSchemeIds, setSelectedSchemeIds] = useState<string[]>([]);
  const [editingSchemeIds, setEditingSchemeIds] = useState<string[]>([]);
  const [scheme, setScheme] = useState<AuthScheme | null>(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [subjectNames, setSubjectNames] = useState<Record<string, string>>({});
  const [designGroup, setDesignGroup] = useState<number | null>(null);
  const [fieldSearch, setFieldSearch] = useState('');
  const [fieldScope, setFieldScope] = useState('main');
  const [menuTree, setMenuTree] = useState<any[]>([]);
  const [allForms, setAllForms] = useState<Array<{ id?: string; formName?: string }>>([]);
  const [columnPickerIndex, setColumnPickerIndex] = useState<number | null>(null);
  const [columnPickerValue, setColumnPickerValue] = useState('');
  const [columnKeyword, setColumnKeyword] = useState('');
  const [univerLayoutType, setUniverLayoutType] = useState<number>(0);
  const [layoutTypeNames, setLayoutTypeNames] = useState<Record<number, string>>({ ...DEFAULT_LAYOUT_TYPE_NAMES });
  const [configuredLayoutTypes, setConfiguredLayoutTypes] = useState<Set<number>>(new Set());
  const [layoutNameEditing, setLayoutNameEditing] = useState<number | null>(null);
  const [layoutNameDraft, setLayoutNameDraft] = useState('');
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncMode, setSyncMode] = useState<'groups' | 'types'>('types');
  const [syncTargetNodes, setSyncTargetNodes] = useState<string[]>([]);
  const [syncTargetTypes, setSyncTargetTypes] = useState<number[]>([]);
  const [syncOverwrite, setSyncOverwrite] = useState(false);
  const univerApiRef = useRef<{ save: () => Promise<boolean> } | null>(null);

  const load = async () => {
    if (!formId) return;
    setLoading(true);
    try {
      const list = await listAuthSchemes(formId);
      setSchemes(list || []);
      const ids = new Set((list || []).map((item) => String(item.id)));
      setSelectedSchemeIds((prev) => prev.filter((id) => ids.has(id)));
      const grouped = new Map<number, string[]>();
      for (const item of list || []) {
        const type = Number(item.subjectType);
        const id = item.subjectId == null ? '' : String(item.subjectId);
        if (!type || !id) continue;
        if (!grouped.has(type)) grouped.set(type, []);
        grouped.get(type)!.push(id);
      }
      const nextNames: Record<string, string> = {};
      await Promise.all(Array.from(grouped.entries()).map(async ([type, ids]) => {
        const names = await resolveSubjectNames(type, ids);
        for (const id of ids) nextNames[subjectNameKey(type, id)] = names[id] || id;
      }));
      setSubjectNames((prev) => ({ ...prev, ...nextNames }));
    } catch {
      message.error('加载授权方案失败');
    } finally {
      setLoading(false);
    }
  };

  const batchDelete = async () => {
    if (!selectedSchemeIds.length) return;
    try {
      const deleted = await deleteAuthSchemes(selectedSchemeIds);
      message.success(`已删除 ${deleted} 个授权方案`);
      setSelectedSchemeIds([]);
      await load();
    } catch (e: any) {
      message.error(e?.message || '批量删除失败');
    }
  };

  useEffect(() => {
    if (!open || !formId) return;
    load();
    fieldApi.getByFormId(formId).then((r: any) => setFields(Array.isArray(r) ? r : (r?.records || []))).catch(() => setFields([]));
    menuApi.tree({}).then((r: any) => {
      const rows = Array.isArray(r) ? r : (r?.data || []);
      setMenuTree(Array.isArray(rows) ? rows : []);
    }).catch(() => setMenuTree([]));
    formApi.getAll().then((rows: any) => setAllForms(Array.isArray(rows) ? rows : [])).catch(() => setAllForms([]));
  }, [open, formId]);

  const update = (patch: Partial<AuthScheme>) => setScheme((prev) => prev ? { ...prev, ...patch } : prev);

  const normalizeSubjectIds = (value?: string | string[]) => {
    if (value == null) return [];
    const ids = Array.isArray(value) ? value : [value];
    return Array.from(new Set(ids.map((id) => String(id).trim()).filter((v) => v && v !== '0')));
  };

  const startCreate = () => {
    setSubjectIds([]);
    setEditingSchemeIds([]);
    setScheme(ensureSingleFieldGroup(emptyScheme(formId)));
    setStep(0);
  };

  const startEdit = (items: AuthScheme[]) => {
    const first = items[0];
    if (!first) return;
    setEditingSchemeIds(items.map((item) => String(item.id)));
    setSubjectIds(first.subjectType === 7 ? ['0'] : items.map((item) => item.subjectId == null ? '' : String(item.subjectId)).filter(Boolean));
    setScheme(ensureSingleFieldGroup({ ...first, formId }));
    setStep(0);
  };

  const cloneSchemeForSubject = (subjectId: string, index: number, name?: string, existingId?: string): AuthScheme => {
    const cloned: AuthScheme = JSON.parse(JSON.stringify(scheme));
    const baseName = (scheme.schemeName || '').trim() || `${SUBJECT_TYPES.find((t) => t.value === scheme.subjectType)?.label || '授权'}方案`;
    cloned.id = existingId;
    cloned.subjectId = subjectId;
    cloned.subjectName = name || subjectNames[subjectNameKey(scheme.subjectType, subjectId)] || scheme.subjectName;
    cloned.schemeName = subjectIds.length > 1 ? `${baseName.replace(/-(\d+)$/, '')}-${subjectId}` : baseName;
    cloned.fieldGroups = (cloned.fieldGroups || []).map((g) => ({
      ...g,
      id: undefined,
      groupKey: index === 0 && scheme.id ? g.groupKey : newGroupKey(),
    }));
    cloned.rights = (cloned.rights || []).map((r) => ({ ...r, id: undefined }));
    cloned.dataScopes = (cloned.dataScopes || []).map((s) => ({ ...s, id: undefined }));
    cloned.menu = {
      ...cloned.menu,
      menuShares: (cloned.menu?.menuShares || []).map((s) => ({ ...s, id: undefined })),
    };
    return cloned;
  };

  const save = async () => {
    if (!scheme) return;
    const ids = scheme.subjectType === 7 ? ['0'] : subjectIds;
    if (!ids.length) {
      message.warning('请选择授权对象');
      return;
    }
    const existing = new Map<string, string>();
    for (const item of schemes) {
      if (Number(item.subjectType) !== Number(scheme.subjectType)) continue;
      const id = item.subjectId == null ? '' : String(item.subjectId);
      if (id && !editingSchemeIds.includes(String(item.id))) existing.set(id, item.schemeName || String(item.id));
    }
    const conflicts = ids.filter((id) => existing.has(id));
    if (conflicts.length) {
      const names = conflicts.map((id) => `${subjectNames[subjectNameKey(scheme.subjectType, id)] || id}（${existing.get(id)}）`);
      message.warning(`以下授权对象已有方案，不能重复创建：${names.join('、')}`);
      return;
    }

    setLoading(true);
    try {
      const resolvedNames = scheme.subjectType === 7
        ? { '0': '所有登录用户' }
        : await resolveSubjectNames(scheme.subjectType, ids);
      setSubjectNames((prev) => ({
        ...prev,
        ...Object.fromEntries(Object.entries(resolvedNames).map(([id, name]) => [subjectNameKey(scheme.subjectType, id), name])),
      }));
      const payloads: AuthScheme[] = [];
      for (let i = 0; i < ids.length; i++) {
        payloads.push(cloneSchemeForSubject(ids[i], i, resolvedNames[ids[i]], editingSchemeIds[i]));
      }
      await saveAuthSchemes(payloads);
      message.success(ids.length > 1 ? `已生成 ${ids.length} 个授权方案` : '授权方案已保存');
      setScheme(null);
      setSubjectIds([]);
      await load();
    } catch (e: any) {
      message.error(e?.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  const addRight = () => update({ rights: [...(scheme?.rights || []), { righttype: 1 }] });
  const addScope = () => update({
    dataScopes: [...(scheme?.dataScopes || []), {
      type: 1,
      scopeType: Number(scheme?.subjectType) === 4 ? 2 : 3,
      scopeColumn: Number(scheme?.subjectType) === 4 ? 'modedatacreator' : 'create_dept',
      objtype: scheme?.subjectType,
      objid: scheme?.subjectId,
      rightTypes: [1],
      subjects: [],
    }],
  });

  const numericColumns = useMemo(() => {
    const seen = new Set<string>();
    return fields
      .filter((f) => ['int', 'bigint', 'decimal', 'number', 'integer'].includes(String((f as any).fieldDbType || '').toLowerCase()))
      .filter((f) => {
        const key = String(f.fieldDbName || f.fieldName || f.id || '').trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [fields]);

  const scopeColumnLabel = (value?: string) => {
    if (!value) return '选择权限列';
    const hit = numericColumns.find((f) => (f.fieldDbName || f.fieldName) === value);
    return hit ? `${hit.fieldLabel || hit.fieldName}（${value}）` : value;
  };

  const scopeColumnRows = useMemo(() => {
    const kw = columnKeyword.trim().toLowerCase();
    if (!kw) return numericColumns;
    return numericColumns.filter((f) => [
      f.fieldName, f.fieldLabel, f.fieldDbName,
    ].some((v) => String(v || '').toLowerCase().includes(kw)));
  }, [numericColumns, columnKeyword]);

  const fieldScopeOf = (f: FieldDefinition) => {
    const dt = Number((f as any).detailTable || 0);
    return Number((f as any).isMain) === 1 || dt <= 0 ? 'main' : `dt${dt}`;
  };
  const fieldScopeLabel = (scope: string) => scope === 'main' ? '主表' : scope.replace('dt', '明细表');
  const fieldScopeRank = (scope: string) => scope === 'main' ? 0 : (Number(scope.replace('dt', '')) || 9999);
  const sortedConfigFields = useMemo(() => [...fields].sort((a, b) => {
    const rank = fieldScopeRank(fieldScopeOf(a)) - fieldScopeRank(fieldScopeOf(b));
    if (rank !== 0) return rank;
    const oa = Number((a as any).fieldOrder ?? 0), ob = Number((b as any).fieldOrder ?? 0);
    if (oa !== ob) return oa - ob;
    return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
  }), [fields]);
  const fieldScopeTabs = useMemo(() => {
    const set = new Set(sortedConfigFields.map(fieldScopeOf));
    if (!set.size) set.add('main');
    return Array.from(set).sort((a, b) => fieldScopeRank(a) - fieldScopeRank(b)).map((scope) => ({
      value: scope,
      label: `${fieldScopeLabel(scope)}（${sortedConfigFields.filter((f) => fieldScopeOf(f) === scope).length}）`,
    }));
  }, [sortedConfigFields]);
  const fieldRows = useMemo(() => sortedConfigFields.filter((f) => {
    const kw = fieldSearch.trim().toLowerCase();
    return fieldScopeOf(f) === fieldScope && (!kw
      || String(f.fieldName).toLowerCase().includes(kw)
      || String(f.fieldLabel || '').toLowerCase().includes(kw));
  }), [sortedConfigFields, fieldSearch, fieldScope]);

  const currentFieldIds = useMemo(
    () => Array.from(new Set((scheme?.fieldGroups?.[0]?.fields || []).map((f) => Number(f.fieldId)))),
    [scheme?.fieldGroups],
  );
  const currentFieldRight = (fieldId: number): 0 | 1 | 2 | undefined => {
    const hit = (scheme?.fieldGroups?.[0]?.fields || []).find((f) => Number(f.fieldId) === Number(fieldId));
    return hit?.rightvalue;
  };

  const setSchemeFields = (fieldsToSet: Array<{ fieldId: string; rightvalue: 0 | 1 | 2 }>) => {
    setScheme((prev) => {
      if (!prev) return prev;
      const groups = [...(prev.fieldGroups || [])];
      if (!groups.length) return prev;
      groups[0] = { ...groups[0], fields: fieldsToSet };
      return { ...prev, fieldGroups: groups };
    });
  };

  const setFieldRight = (fieldId: number, rightvalue?: 0 | 1 | 2) => {
    const current = scheme?.fieldGroups?.[0]?.fields || [];
    const rest = current.filter((f) => Number(f.fieldId) !== Number(fieldId));
    setSchemeFields(rightvalue == null ? rest : [...rest, { fieldId: String(fieldId), rightvalue }]);
  };

  const replaceScopeSelection = (scope: string, ids: number[]) => {
    const scopeIds = new Set(sortedConfigFields.filter((f) => fieldScopeOf(f) === scope).map((f) => Number(f.id)));
    const others = currentFieldIds.filter((id) => !scopeIds.has(Number(id)));
    const selected = Array.from(new Set([...others, ...ids.map(Number)]));
    const current = scheme?.fieldGroups?.[0]?.fields || [];
    const kept = current.filter((f) => selected.includes(Number(f.fieldId)));
    const keptIds = new Set(kept.map((f) => Number(f.fieldId)));
    const added = selected
      .filter((id) => !keptIds.has(id))
      .map((id) => ({ fieldId: String(id), rightvalue: 1 as const }));
    setSchemeFields([...kept, ...added]);
  };

  const menuParentOptions = useMemo(() => {
    const currentMenuId = scheme?.menu?.menuId == null ? '' : String(scheme.menu.menuId);
    const build = (nodes: any[]): any[] => (nodes || [])
      .filter((n) => Number(n.category ?? 1) === 1 && String(n.id ?? n.value) !== currentMenuId)
      .map((n) => {
        const id = String(n.id ?? n.value ?? '');
        return {
          title: n.title || n.name || n.code || id,
          value: id,
          children: build(n.children || []),
        };
      });
    return [{ title: '顶层菜单', value: '0' }, ...build(menuTree)];
  }, [menuTree, scheme?.menu?.menuId]);

  const subjectPickerType = scheme ? PICKER_TYPE[scheme.subjectType] : undefined;
  useEffect(() => {
    if (!scheme || scheme.subjectType !== 7) return;
    setSubjectIds((prev) => (prev.length === 1 && prev[0] === '0' ? prev : ['0']));
  }, [scheme?.subjectType]);

  const schemeGroups = useMemo(() => {
    const groups = new Map<string, AuthScheme[]>();
    for (const item of schemes) {
      const baseName = (item.schemeName || '').replace(/-(\d+)$/, '');
      const key = `${item.formId}|${item.subjectType}|${baseName}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return Array.from(groups.entries()).map(([key, items]) => ({ key, items, first: items[0] }));
  }, [schemes]);

  const schemeList = (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={startCreate}>新建方案</Button>
        <Popconfirm
          title={`确认删除选中的 ${selectedSchemeIds.length} 个方案？`}
          disabled={!selectedSchemeIds.length}
          onConfirm={batchDelete}
        >
          <Button danger icon={<DeleteOutlined />} disabled={!selectedSchemeIds.length}>批量删除</Button>
        </Popconfirm>
        <span style={{ color: '#999' }}>一次多选生成的方案会归为一组显示；同一用户可命中多组方案。</span>
      </Space>
      <Table
        rowKey={(r) => (r as any).key}
        dataSource={schemeGroups}
        rowSelection={{
          selectedRowKeys: schemeGroups
            .filter((g) => g.items.some((item) => selectedSchemeIds.includes(String(item.id))))
            .map((g) => g.key),
          onChange: (keys) => setSelectedSchemeIds((keys as string[]).flatMap((key) =>
            (schemeGroups.find((g) => g.key === key)?.items || []).map((item) => String(item.id)))),
        }}
        pagination={false}
        size="small"
        locale={{ emptyText: <Empty description="暂无授权方案" /> }}
        columns={[
          {
            title: '方案名称', dataIndex: 'key',
            render: (_v, r: any) => {
              const group = schemeGroups.find((g) => g.key === r.key)!;
              const base = (group.first.schemeName || '').replace(/-(\d+)$/, '');
              return group.items.length > 1 ? `${base}（${group.items.length}个对象）` : group.first.schemeName;
            },
          },
          {
            title: '授权对象类型', width: 110,
            render: (_v, r: any) => SUBJECT_TYPES.find((t) => t.value === schemeGroups.find((g) => g.key === r.key)?.first.subjectType)?.label
              || schemeGroups.find((g) => g.key === r.key)?.first.subjectType,
          },
          {
            title: '授权对象', width: 260,
            render: (_v, r: any) => {
              const group = schemeGroups.find((g) => g.key === r.key)!;
              if (group.first.subjectType === 7) return '所有登录用户';
              return group.items.map((item) => subjectNames[subjectNameKey(item.subjectType, item.subjectId)] || item.subjectName || String(item.subjectId ?? '')).join('、');
            },
          },
          {
            title: '优先级', width: 90,
            render: (_v, r: any) => schemeGroups.find((g) => g.key === r.key)?.first.priority,
          },
          {
            title: '操作', key: 'op', width: 160,
            render: (_v, r: any) => {
              const group = schemeGroups.find((g) => g.key === r.key)!;
              return (
                <Space size={2}>
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => startEdit(group.items)}>编辑</Button>
                  <Button type="link" size="small" icon={<CopyOutlined />} onClick={async () => { await copyAuthScheme(String(group.first.id)); await load(); }}>复制</Button>
                  <Popconfirm title={`确认删除该组 ${group.items.length} 个方案？`} onConfirm={async () => {
                    await deleteAuthSchemes(group.items.map((item) => String(item.id)));
                    await load();
                  }}>
                    <Button danger type="link" size="small" icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              );
            },
          },
        ]}
      />
    </div>
  );

  const step0 = scheme && (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <div>
        <div style={{ marginBottom: 6 }}>方案名称</div>
        <Input style={{ width: 360 }} value={scheme.schemeName} onChange={(e) => update({ schemeName: e.target.value })} placeholder="例如：人员授权方案-lh" />
      </div>
      <div>
        <div style={{ marginBottom: 6 }}>授权对象类型</div>
        <Select
          style={{ width: 220 }}
          value={scheme.subjectType}
          options={SUBJECT_TYPES}
          disabled={!!scheme.id}
          onChange={(v) => {
            setSubjectIds([]);
            update({ subjectType: v, subjectId: undefined, subjectName: undefined, matrixValueField: undefined });
          }}
        />
      </div>
      {scheme.subjectType !== 7 && (
        <div>
          <div style={{ marginBottom: 6 }}>
            授权对象
            <span style={{ color: '#999', marginLeft: 8 }}>
              {scheme.id ? '第一个为当前方案对象，其余对象将生成新方案' : '可多选；每个对象生成一个独立方案'}
            </span>
          </div>
          <AuthObjectPicker
            multiple
            objtype={subjectPickerType || 1}
            value={subjectIds}
            onChange={(v) => {
              let ids = normalizeSubjectIds(v as string | string[]);
              if (scheme.id && scheme.subjectId != null) {
                const current = String(scheme.subjectId);
                ids = [current, ...ids.filter((id) => id !== current)];
              }
              setSubjectIds(ids);
              update({ subjectId: ids[0], subjectName: undefined });
            }}
          />
        </div>
      )}
      {scheme.subjectType === 6 && (
        <div>
          <div style={{ marginBottom: 6 }}>矩阵结果字段</div>
          <Input style={{ width: 300 }} value={scheme.matrixValueField} onChange={(e) => update({ matrixValueField: e.target.value })} placeholder="矩阵结果字段 fieldKey" />
        </div>
      )}
      <Space>
        <div><div style={{ marginBottom: 6 }}>密级下限</div><InputNumber min={0} max={100} value={scheme.showlevel ?? null} onChange={(v) => update({ showlevel: v ?? undefined })} placeholder="不限" /></div>
        <div><div style={{ marginBottom: 6 }}>密级上限</div><InputNumber min={0} max={100} value={scheme.showlevel2 ?? null} onChange={(v) => update({ showlevel2: v ?? undefined })} placeholder="不封顶" /></div>
        <div><div style={{ marginBottom: 6 }}>布局优先级</div><InputNumber min={0} value={scheme.priority ?? 100} onChange={(v) => update({ priority: v ?? 100 })} /></div>
      </Space>
    </Space>
  );

  const step1 = scheme && (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <div style={{ border: '1px solid #f0f0f0', padding: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>菜单设置（门户左侧导航）</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <div>
            <div style={{ marginBottom: 6 }}>上级菜单</div>
            <TreeSelect
              style={{ width: '100%' }}
              value={scheme.menu?.parentId || '0'}
              treeData={menuParentOptions}
              treeDefaultExpandAll
              showSearch
              treeNodeFilterProp="title"
              onChange={(v) => update({ menu: { ...scheme.menu, parentId: String(v || '0') } })}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6 }}>菜单名称</div>
            <Input
              value={scheme.menu?.formMenuName}
              placeholder="表单数据"
              onChange={(e) => update({ menu: { ...scheme.menu, formMenuName: e.target.value } })}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6 }}>菜单图标</div>
            <Select
              style={{ width: '100%' }}
              value={scheme.menu?.menuIcon || 'file-text'}
              options={MENU_ICON_OPTIONS}
              onChange={(v) => update({ menu: { ...scheme.menu, menuIcon: v } })}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6 }}>菜单别名</div>
            <Input
              value={scheme.menu?.menuAlias}
              placeholder="可为空，默认同菜单名称"
              onChange={(e) => update({ menu: { ...scheme.menu, menuAlias: e.target.value } })}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6 }}>菜单排序</div>
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              value={scheme.menu?.menuSort ?? 5}
              onChange={(v) => update({ menu: { ...scheme.menu, menuSort: v ?? 5 } })}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6 }}>显示状态</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32 }}>
              <Switch
                checked={(scheme.menu?.menuStatus ?? 1) === 1}
                onChange={(checked) => update({ menu: { ...scheme.menu, menuStatus: checked ? 1 : 0 } })}
              />
              <span style={{ color: '#666' }}>{(scheme.menu?.menuStatus ?? 1) === 1 ? '显示' : '隐藏'}</span>
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1', color: '#999' }}>
            路由地址固定为 <code>/formmode/formview/{formId}</code>，新增编辑页自动作为其子菜单，避免动态路由组件无法定位。
          </div>
        </div>
      </div>
      <div style={{ border: '1px solid #f0f0f0', padding: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>表单建模数据范围（表单管理列表）</div>
        <Space wrap>
          <div>
            <div style={{ marginBottom: 6 }}>范围类型</div>
            <Select
              style={{ width: 180 }}
              value={scheme.formManageScope?.scopeType ?? 1}
              options={[
                { value: 1, label: '全部表单' },
                { value: 2, label: '本人创建' },
                { value: 3, label: '指定表单' },
              ]}
              onChange={(v) => update({ formManageScope: { ...scheme.formManageScope, scopeType: v } })}
            />
          </div>
          {Number(scheme.formManageScope?.scopeType) === 3 ? (
            <div style={{ minWidth: 360 }}>
              <div style={{ marginBottom: 6 }}>指定表单</div>
              <Select
                mode="multiple"
                style={{ width: '100%' }}
                value={(scheme.formManageScope?.scopeValue || '').split(',').filter(Boolean)}
                options={allForms.map((f) => ({
                  value: String(f.id),
                  label: `${f.formName || '未命名表单'}（${f.id}）`,
                }))}
                onChange={(values) => update({ formManageScope: { ...scheme.formManageScope, scopeValue: values.join(',') } })}
              />
            </div>
          ) : null}
        </Space>
        <div style={{ marginTop: 8, color: '#999' }}>
          此范围只控制“表单管理”列表能看到哪些表单，不影响第四步动态列表数据范围。
        </div>
      </div>
      <Button type="dashed" icon={<PlusOutlined />} onClick={addRight} block>新增模块权限</Button>
      <Table
        rowKey={(_r, i) => String(i)}
        size="small"
        pagination={false}
        dataSource={scheme.rights}
        columns={[
          {
            title: '权限类型', dataIndex: 'righttype', width: 160,
            render: (v, _r, i) => <Select style={{ width: 130 }} value={v} options={RIGHT_TYPES} onChange={(nv) => {
              const next = [...(scheme.rights || [])]; next[i] = { ...next[i], righttype: nv }; update({ rights: next });
            }} />,
          },
          { title: '授权对象', width: 200, render: () => <Tag>{SUBJECT_TYPES.find((t) => t.value === scheme.subjectType)?.label} · {scheme.subjectName || scheme.subjectId || '待选择'}</Tag> },
          {
            title: '操作', width: 70,
            render: (_v, _r, i) => <Button danger type="link" size="small" onClick={() => update({ rights: (scheme.rights || []).filter((_x, idx) => idx !== i) })}>删除</Button>,
          },
        ]}
      />
    </Space>
  );

  const step2 = scheme && (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ color: '#666' }}>
          当前方案的字段配置会自动归属于该授权对象；勾选字段即加入配置，取消勾选即移出。
        </div>
        <Button
          size="small"
          icon={<TableOutlined />}
          onClick={() => {
            const groupKey = scheme.fieldGroups?.[0]?.groupKey;
            univerApiRef.current = null;
            setUniverLayoutType(0);
            setLayoutNameEditing(null);
            setSyncModalOpen(false);
            setDesignGroup(0);
            loadLayoutTypeMeta(groupKey);
          }}
        >
          Univer设计
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 12, border: '1px solid #f0f0f0', padding: 12 }}>
        <div style={{ width: 190, minWidth: 190, borderRight: '1px solid #f0f0f0', paddingRight: 8 }}>
          <div style={{ color: '#999', fontSize: 12, margin: '4px 4px 8px' }}>表列表</div>
          {fieldScopeTabs.map((tab) => (
            <Button
              key={tab.value}
              type={fieldScope === tab.value ? 'primary' : 'text'}
              block
              style={{ textAlign: 'left', marginBottom: 4 }}
              onClick={() => setFieldScope(tab.value)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Space wrap style={{ marginBottom: 8 }}>
            <Input.Search allowClear size="small" style={{ width: 240 }} placeholder="搜索当前表字段"
              value={fieldSearch} onChange={(e) => setFieldSearch(e.target.value)} />
            <Button size="small" onClick={() => replaceScopeSelection(
              fieldScope,
              sortedConfigFields.filter((f) => fieldScopeOf(f) === fieldScope).map((f) => Number(f.id)),
            )}>全选当前表</Button>
            <Button size="small" onClick={() => replaceScopeSelection(fieldScope, [])}>清空当前表</Button>
            <Select size="small" style={{ width: 140 }} placeholder="批量设置"
              options={[{ value: 0, label: '隐藏' }, { value: 1, label: '只读' }, { value: 2, label: '可编辑' }]}
              onChange={(rv) => {
                if (!currentFieldIds.length) {
                  message.warning('请先勾选要设置的字段');
                  return;
                }
                currentFieldIds.forEach((id) => setFieldRight(Number(id), Number(rv) as 0 | 1 | 2));
              }} />
            <span style={{ color: '#999', fontSize: 12 }}>勾选字段即加入配置；未设置的字段按“隐藏”处理</span>
          </Space>
          <Table
            rowKey={(r) => String(r.id)}
            size="small"
            pagination={false}
            scroll={{ y: 'calc(100vh - 430px)' }}
            dataSource={fieldRows}
            rowSelection={{
              selectedRowKeys: currentFieldIds.map(String),
              onChange: (keys) => replaceScopeSelection(fieldScope, keys.map(Number)),
            }}
            locale={{ emptyText: '当前表没有字段' }}
            columns={[
              { title: '字段归属', width: 100, render: (_v, r) => <Tag>{fieldScopeLabel(fieldScopeOf(r as FieldDefinition))}</Tag> },
              { title: '字段名', dataIndex: 'fieldName', width: 150 },
              { title: '字段名称', dataIndex: 'fieldLabel', width: 180 },
              { title: '字段ID', dataIndex: 'id', width: 100 },
              {
                title: '权限', width: 160,
                render: (_v, r) => {
                  const id = Number((r as FieldDefinition).id);
                  return (
                    <Select size="small" style={{ width: 130 }} value={currentFieldRight(id) ?? 0}
                      onChange={(rv) => setFieldRight(id, Number(rv) as 0 | 1 | 2)}
                      options={[
                        { value: 0, label: '隐藏' },
                        { value: 1, label: '只读' },
                        { value: 2, label: '可编辑' },
                      ]} />
                  );
                },
              },
            ]}
          />
        </div>
      </div>
    </Space>
  );

  const step3 = scheme && (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <div style={{ color: '#666' }}>
        数据范围自动使用当前方案的授权对象：{scheme.subjectType === 7 ? '所有登录用户' : (scheme.subjectName || String(scheme.subjectId || '待选择'))}，无需重复配置。
      </div>
      {Number(scheme.subjectType) === 4 ? (
        <div style={{ color: '#999' }}>人员方案仅提供“全部可见 / 本人可见 / 自定义”；机构范围请配置部门、分部或全员方案。</div>
      ) : null}
      <Button type="dashed" icon={<PlusOutlined />} onClick={addScope} block>新增数据范围</Button>
      <Table
        rowKey={(_r, i) => String(i)}
        size="small"
        pagination={false}
        dataSource={scheme.dataScopes}
        columns={[
          {
            title: '权限类型', dataIndex: 'rightTypes', width: 190,
            render: (v, r, i) => {
              const rights = Array.isArray(v) && v.length ? v : (r.type === 2 ? [1, 3, 4] : [1]);
              return (
                <Select
                  mode="multiple"
                  size="small"
                  style={{ width: 180 }}
                  value={rights}
                  options={SCOPE_RIGHT_TYPES}
                  onChange={(nv) => {
                    const values = (nv || []).map(Number);
                    const next = [...(scheme.dataScopes || [])];
                    next[i] = { ...next[i], rightTypes: values, type: values.includes(2) || values.includes(3) || values.includes(4) ? 2 : 1 };
                    update({ dataScopes: next });
                  }}
                />
              );
            },
          },
          {
            title: '数据范围', dataIndex: 'scopeType', width: 190,
            render: (v, _r, i) => {
              const options = scopeTypeOptions(scheme.subjectType);
              return (
                <Select
                  style={{ width: 170 }}
                  value={v || (Number(scheme.subjectType) === 4 ? 2 : 3)}
                  options={options}
                  onChange={(nv) => {
                    const next = [...(scheme.dataScopes || [])];
                    next[i] = { ...next[i], scopeType: nv };
                    update({ dataScopes: next });
                  }}
                />
              );
            },
          },
          {
            title: '权限列', dataIndex: 'scopeColumn', width: 180,
            render: (v, _r, i) => (
              <Space.Compact style={{ width: 160 }}>
                <Button
                  style={{ width: 126, textAlign: 'left' }}
                  onClick={() => {
                    setColumnPickerIndex(i);
                    setColumnPickerValue(v || '');
                    setColumnKeyword('');
                  }}
                >
                  {scopeColumnLabel(v)}
                </Button>
                {v ? (
                  <Button
                    danger
                    onClick={() => {
                      const next = [...(scheme.dataScopes || [])];
                      next[i] = { ...next[i], scopeColumn: undefined };
                      update({ dataScopes: next });
                    }}
                  >
                    清
                  </Button>
                ) : null}
              </Space.Compact>
            ),
          },
          {
            title: '自定义值域', dataIndex: 'scopeValue',
            render: (v, r, i) => Number(r.scopeType) === 5 ? (
              <Input value={v} placeholder="where scope.dept_id in (1,2)" onChange={(e) => {
                const next = [...(scheme.dataScopes || [])]; next[i] = { ...next[i], scopeValue: e.target.value }; update({ dataScopes: next });
              }} />
            ) : null,
          },
          {
            title: '操作', width: 70,
            render: (_v, _r, i) => <Button danger type="link" size="small" onClick={() => update({ dataScopes: (scheme.dataScopes || []).filter((_x, idx) => idx !== i) })}>删除</Button>,
          },
        ]}
      />
    </Space>
  );

  const groupToDesign = designGroup == null ? null : scheme?.fieldGroups?.[designGroup];

  const loadLayoutTypeMeta = async (nodeKey?: string) => {
    if (!formId) return;
    try {
      const namesRes: any = await getFormLayoutTypeNames(formId);
      const rows = Array.isArray(namesRes?.data) ? namesRes.data : [];
      const names: Record<number, string> = { ...DEFAULT_LAYOUT_TYPE_NAMES };
      rows.forEach((r: any) => {
        const t = Number(r?.layoutType ?? r?.layout_type);
        const n = String(r?.layoutName ?? r?.layout_name ?? '').trim();
        if (n && [0, 1, 3, 4].includes(t)) names[t] = n;
      });
      setLayoutTypeNames(names);

      const checks = await Promise.all(LAYOUT_TYPES.map(async (t) => {
        try {
          const res: any = await getFormLayout(formId, t.value, nodeKey, false);
          return !!res?.data?.layoutJson;
        } catch { return false; }
      }));
      setConfiguredLayoutTypes(new Set(LAYOUT_TYPES.filter((_t, i) => checks[i]).map((t) => t.value)));
    } catch { /* 默认值兜底 */ }
  };

  const saveLayoutTypeName = async (type: number) => {
    const name = layoutNameDraft.trim();
    if (!formId || !name) {
      message.warning('布局名称不能为空');
      return;
    }
    const res: any = await saveFormLayoutTypeName({ formId, layoutType: type, layoutName: name });
    if (res?.success === false) {
      message.error(res?.msg || '布局名称保存失败');
      return;
    }
    setLayoutTypeNames((prev) => ({ ...prev, [type]: name }));
    setLayoutNameEditing(null);
    message.success('布局名称已保存');
  };

  const handleSyncLayout = async () => {
    if (!formId) return;
    if (syncMode === 'groups' && !syncTargetNodes.length) {
      message.warning('请选择目标方案组');
      return;
    }
    if (syncMode === 'types' && !syncTargetTypes.length) {
      message.warning('请选择目标布局类型');
      return;
    }
    const res: any = await syncFormLayout({
      formId,
      sourceNodeKey: groupToDesign?.groupKey,
      sourceLayoutType: univerLayoutType,
      targetNodeKeys: syncMode === 'groups' ? syncTargetNodes : undefined,
      targetLayoutTypes: syncMode === 'types' ? syncTargetTypes : undefined,
      overwrite: syncOverwrite,
    });
    if (res?.success === false) {
      message.error(res?.msg || '布局同步失败');
      return;
    }
    message.success(`已同步 ${res?.data ?? 0} 个目标`);
    setSyncModalOpen(false);
    await loadLayoutTypeMeta(groupToDesign?.groupKey);
  };

  const otherGroupOptions = useMemo(() => {
    const currentKey = groupToDesign?.groupKey;
    const options: Array<{ value: string; label: string }> = [];
    for (const item of schemes) {
      for (const g of item.fieldGroups || []) {
        const key = g.groupKey || `group-${g.id || ''}`;
        if (!key || key === currentKey) continue;
        options.push({
          value: key,
          label: `${item.schemeName || '未命名方案'} - ${g.groupName || '字段配置'}（${key}）`,
        });
      }
    }
    return options;
  }, [schemes, groupToDesign?.groupKey]);
  // 与旧权限抽屉一致：隐藏字段不进入 Univer 设计白名单。
  const designFieldIds = useMemo(
    () => Array.from(new Set((groupToDesign?.fields || [])
      .filter((f) => Number(f.rightvalue) >= 1)
      .map((f) => String(f.fieldId)))),
    [groupToDesign],
  );
  const designFieldSignature = designFieldIds.join(',');

  return (
    <Drawer
      title={`权限配置 - ${formName || formId || ''}`}
      open={open}
      onClose={() => { setScheme(null); onClose(); }}
      width="min(1200px, calc(100vw - 48px))"
      extra={scheme ? (
        <Space>
          <Button onClick={() => setScheme(null)}>返回方案列表</Button>
          <Button disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</Button>
          {step < 3 ? <Button type="primary" onClick={() => setStep(step + 1)}>下一步</Button> : null}
          <Button type="primary" loading={loading} onClick={save}>保存并完成</Button>
        </Space>
      ) : null}
      footer={null}
    >
      {scheme ? (
        <>
          <Steps
            current={step}
            style={{ marginBottom: 20 }}
            items={[
              { title: '授权对象' },
              { title: '模块权限与菜单' },
              { title: '字段权限' },
              { title: '数据范围' },
            ]}
          />
          <AlertInfo scheme={scheme} subjectIds={subjectIds} subjectNames={subjectNames} />
          {step === 0 && step0}
          {step === 1 && step1}
          {step === 2 && step2}
          {step === 3 && step3}
        </>
      ) : schemeList}

      <Modal
        title={`Univer设计 - ${groupToDesign?.groupName || ''} - ${layoutTypeName(univerLayoutType, layoutTypeNames)}`}
        open={designGroup != null}
        width="min(1500px, calc(100vw - 48px))"
        style={{ top: 12 }}
        styles={{ body: { height: 'calc(100vh - 150px)', padding: 0, overflow: 'hidden' } }}
        destroyOnHidden
        onCancel={() => { univerApiRef.current = null; setDesignGroup(null); }}
        onOk={async () => {
          if (designGroup == null) return;
          const ok = await univerApiRef.current?.save();
          if (ok) {
            message.success(`「${layoutTypeName(univerLayoutType, layoutTypeNames)}」布局已保存`);
            await loadLayoutTypeMeta(groupToDesign?.groupKey);
            setDesignGroup(null);
          }
        }}
      >
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
            <Tabs
              size="small"
              activeKey={String(univerLayoutType)}
              onChange={(key) => {
                setUniverLayoutType(Number(key));
                setLayoutNameEditing(null);
              }}
              items={LAYOUT_TYPES.map((t) => ({
                key: String(t.value),
                label: `${layoutTypeName(t.value, layoutTypeNames)}${configuredLayoutTypes.has(t.value) ? ' •' : ''}`,
              }))}
            />
            <Space wrap size={4} style={{ marginTop: -4 }}>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setLayoutNameEditing(univerLayoutType);
                  setLayoutNameDraft(layoutTypeName(univerLayoutType, layoutTypeNames));
                }}
              >
                改名
              </Button>
              <Button
                size="small"
                icon={<SyncOutlined />}
                onClick={() => {
                  setSyncMode('groups');
                  setSyncTargetNodes([]);
                  setSyncOverwrite(false);
                  setSyncModalOpen(true);
                }}
              >
                同步到其他方案组
              </Button>
              <Button
                size="small"
                icon={<SyncOutlined />}
                onClick={() => {
                  setSyncMode('types');
                  setSyncTargetTypes([]);
                  setSyncOverwrite(false);
                  setSyncModalOpen(true);
                }}
              >
                同步到其他布局类型
              </Button>
            </Space>
            {layoutNameEditing != null ? (
              <Space style={{ marginTop: 8 }}>
                <Input
                  size="small"
                  style={{ width: 220 }}
                  value={layoutNameDraft}
                  onChange={(e) => setLayoutNameDraft(e.target.value)}
                  onPressEnter={() => saveLayoutTypeName(layoutNameEditing)}
                />
                <Button size="small" type="primary" onClick={() => saveLayoutTypeName(layoutNameEditing)}>保存名称</Button>
                <Button size="small" onClick={() => setLayoutNameEditing(null)}>取消</Button>
              </Space>
            ) : null}
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {groupToDesign && designFieldIds.length > 0 && formId ? (
              <ExcelDesign
                key={`${groupToDesign.groupKey || 'default'}-${designFieldSignature}-${univerLayoutType}`}
                embedded
                formId={formId}
                formName={formName}
                nodeKey={groupToDesign.groupKey}
                allowedFieldIds={designFieldIds}
                layoutType={univerLayoutType}
                hideLayoutTypeSelect
                onReady={(api) => { univerApiRef.current = api; }}
              />
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>请先为该字段组配置字段</div>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        title={syncMode === 'groups' ? '同步布局到其它方案组' : '同步布局到其它布局类型'}
        open={syncModalOpen}
        onCancel={() => setSyncModalOpen(false)}
        onOk={handleSyncLayout}
        okText="确认同步"
        cancelText="取消"
        destroyOnHidden
      >
        <div style={{ marginBottom: 8, color: '#666' }}>
          源布局：{layoutTypeName(univerLayoutType, layoutTypeNames)}（{groupToDesign?.groupKey || '表单级通用'}）
        </div>
        {syncMode === 'groups' ? (
          <Checkbox.Group
            value={syncTargetNodes}
            onChange={(v) => setSyncTargetNodes(v.map(String))}
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            options={otherGroupOptions}
          />
        ) : (
          <Checkbox.Group
            value={syncTargetTypes}
            onChange={(v) => setSyncTargetTypes(v.map(Number))}
            options={LAYOUT_TYPES.filter((t) => t.value !== univerLayoutType).map((t) => ({
              value: t.value,
              label: layoutTypeName(t.value, layoutTypeNames),
            }))}
          />
        )}
        <div style={{ marginTop: 12 }}>
          <Switch checked={syncOverwrite} onChange={setSyncOverwrite} />
          <span style={{ marginLeft: 8 }}>覆盖目标已有布局</span>
        </div>
      </Modal>

      <Modal
        title="选择权限列"
        open={columnPickerIndex != null}
        width={720}
        destroyOnHidden
        onCancel={() => setColumnPickerIndex(null)}
        onOk={() => {
          if (columnPickerIndex == null || !columnPickerValue) {
            message.warning('请选择权限列');
            return;
          }
          const next = [...(scheme?.dataScopes || [])];
          next[columnPickerIndex] = { ...next[columnPickerIndex], scopeColumn: columnPickerValue };
          update({ dataScopes: next });
          setColumnPickerIndex(null);
        }}
      >
        <Input.Search
          allowClear
          style={{ marginBottom: 12 }}
          placeholder="搜索字段名称 / 数据库列名"
          value={columnKeyword}
          onChange={(e) => setColumnKeyword(e.target.value)}
        />
        <Table
          rowKey={(r) => String(r.fieldDbName || r.fieldName || r.id)}
          size="small"
          pagination={false}
          scroll={{ y: 360 }}
          dataSource={scopeColumnRows}
          rowSelection={{
            type: 'radio',
            selectedRowKeys: columnPickerValue ? [columnPickerValue] : [],
            onChange: (keys) => setColumnPickerValue(String(keys[0] || '')),
          }}
          locale={{ emptyText: <Empty description="没有可用字段" /> }}
          columns={[
            { title: '字段名称', dataIndex: 'fieldLabel', width: 180, render: (v, r) => v || r.fieldName },
            { title: '字段名', dataIndex: 'fieldName', width: 160 },
            { title: '数据库列名', dataIndex: 'fieldDbName', width: 180, render: (v, r) => v || r.fieldName },
            { title: '字段类型', dataIndex: 'fieldDbType', width: 100 },
          ]}
        />
      </Modal>
    </Drawer>
  );
};

const AlertInfo: React.FC<{ scheme: AuthScheme; subjectIds: string[]; subjectNames: Record<string, string> }> = ({ scheme, subjectIds, subjectNames }) => (
  <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', padding: 8, marginBottom: 16 }}>
    <Space wrap>
      <Tag color="blue">当前方案：{scheme.schemeName || '未命名'}</Tag>
      <Tag>授权对象类型：{SUBJECT_TYPES.find((t) => t.value === scheme.subjectType)?.label}</Tag>
      <Tag>
        授权对象：{scheme.subjectType === 7
          ? '所有登录用户'
          : (subjectIds.length > 1
            ? subjectIds.map((id) => subjectNames[subjectNameKey(scheme.subjectType, id)] || id).join('、')
            : (scheme.subjectName || subjectNames[subjectNameKey(scheme.subjectType, scheme.subjectId)] || String(scheme.subjectId || '待选择')))}
      </Tag>
      {scheme.showlevel != null || scheme.showlevel2 != null ? <Tag color="orange">安全级别：{scheme.showlevel ?? 0}~{scheme.showlevel2 ?? '不封顶'}</Tag> : null}
      <Tag>布局优先级：{scheme.priority ?? 100}</Tag>
    </Space>
  </div>
);

export default AuthSchemeDrawer;
