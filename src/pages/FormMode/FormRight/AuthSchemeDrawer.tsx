import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button, Drawer, Empty, Input, InputNumber, message, Modal, Popconfirm, Select, Space, Steps, Table, Tag,
} from 'antd';
import { CopyOutlined, DeleteOutlined, EditOutlined, PlusOutlined, TableOutlined } from '@ant-design/icons';
import AuthObjectPicker from '@/components/FormMode/AuthObjectPicker';
import { resolveItemNames, type PersonOrgCategory } from '@/components/FormMode/personOrg';
import * as roleApi from '@/services/authority/role';
import * as matrixApi from '@/pages/System/Matrix/service';
import ExcelDesign from '@/pages/FormMode/ExcelDesign/ExcelDesign';
import { fieldApi } from '@/services/formmode';
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

const SCOPE_RIGHT_TYPES = [
  { value: 1, label: '查看' },
  { value: 2, label: '新增' },
  { value: 3, label: '编辑' },
  { value: 4, label: '删除' },
  { value: 5, label: '详情' },
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
  menu: { formMenuName: '', menuShares: [], roleMenuNames: {} },
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
  const [scheme, setScheme] = useState<AuthScheme | null>(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [subjectNames, setSubjectNames] = useState<Record<string, string>>({});
  const [designGroup, setDesignGroup] = useState<number | null>(null);
  const [fieldSearch, setFieldSearch] = useState('');
  const [fieldScope, setFieldScope] = useState('main');
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
  }, [open, formId]);

  const update = (patch: Partial<AuthScheme>) => setScheme((prev) => prev ? { ...prev, ...patch } : prev);

  const normalizeSubjectIds = (value?: string | string[]) => {
    if (value == null) return [];
    const ids = Array.isArray(value) ? value : [value];
    return Array.from(new Set(ids.map((id) => String(id).trim()).filter((v) => v && v !== '0')));
  };

  const startCreate = () => {
    setSubjectIds([]);
    setScheme(ensureSingleFieldGroup(emptyScheme(formId)));
    setStep(0);
  };

  const startEdit = (item: AuthScheme) => {
    setSubjectIds(item.subjectId == null || item.subjectType === 7 ? [] : [String(item.subjectId)]);
    setScheme(ensureSingleFieldGroup({ ...item, formId }));
    setStep(0);
  };

  const cloneSchemeForSubject = (subjectId: string, index: number, name?: string): AuthScheme => {
    const cloned: AuthScheme = JSON.parse(JSON.stringify(scheme));
    const baseName = (scheme.schemeName || '').trim() || `${SUBJECT_TYPES.find((t) => t.value === scheme.subjectType)?.label || '授权'}方案`;
    cloned.id = undefined;
    cloned.subjectId = subjectId;
    cloned.subjectName = name || subjectNames[subjectNameKey(scheme.subjectType, subjectId)] || scheme.subjectName;
    cloned.schemeName = subjectIds.length > 1 ? `${baseName}-${subjectId}` : baseName;
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
      if (id && String(item.id) !== String(scheme.id)) existing.set(id, item.schemeName || String(item.id));
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
      if (scheme.id) {
        payloads.push({ ...scheme, subjectId: ids[0], subjectName: resolvedNames[ids[0]] || scheme.subjectName });
        for (let i = 1; i < ids.length; i++) {
          payloads.push(cloneSchemeForSubject(ids[i], i, resolvedNames[ids[i]]));
        }
      } else {
        for (let i = 0; i < ids.length; i++) {
          payloads.push(cloneSchemeForSubject(ids[i], i, resolvedNames[ids[i]]));
        }
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
      scopeType: 3,
      scopeColumn: 'create_dept',
      objtype: scheme?.subjectType,
      objid: scheme?.subjectId,
      rightTypes: [1, 5],
      subjects: [],
    }],
  });

  const numericColumns = useMemo(
    () => fields.filter((f) => ['int', 'bigint', 'decimal', 'number', 'integer'].includes(String((f as any).fieldDbType || '').toLowerCase())),
    [fields],
  );

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

  const subjectPickerType = scheme ? PICKER_TYPE[scheme.subjectType] : undefined;
  useEffect(() => {
    if (!scheme || scheme.subjectType !== 7) return;
    setSubjectIds((prev) => (prev.length === 1 && prev[0] === '0' ? prev : ['0']));
  }, [scheme?.subjectType]);

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
        <span style={{ color: '#999' }}>一个方案只配置一个授权对象；同一用户可命中多个方案。</span>
      </Space>
      <Table
        rowKey={(r) => String(r.id)}
        dataSource={schemes}
        rowSelection={{
          selectedRowKeys: selectedSchemeIds,
          onChange: (keys) => setSelectedSchemeIds(keys.map(String)),
        }}
        pagination={false}
        size="small"
        locale={{ emptyText: <Empty description="暂无授权方案" /> }}
        columns={[
          { title: '方案名称', dataIndex: 'schemeName' },
          { title: '授权对象类型', dataIndex: 'subjectType', width: 110, render: (v) => SUBJECT_TYPES.find((t) => t.value === v)?.label || v },
          { title: '授权对象', dataIndex: 'subjectName', width: 180, render: (v, r) => r.subjectType === 7
            ? '所有登录用户'
            : (v || subjectNames[subjectNameKey(r.subjectType, r.subjectId)] || String(r.subjectId ?? '')) },
          { title: '优先级', dataIndex: 'priority', width: 90 },
          {
            title: '操作', key: 'op', width: 160,
            render: (_v, r) => (
              <Space size={2}>
                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => startEdit(r)}>编辑</Button>
                <Button type="link" size="small" icon={<CopyOutlined />} onClick={async () => { await copyAuthScheme(String(r.id)); await load(); }}>复制</Button>
                <Popconfirm title="确认删除该方案？" onConfirm={async () => { await deleteAuthScheme(String(r.id)); await load(); }}>
                  <Button danger type="link" size="small" icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
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
      <div><div style={{ marginBottom: 6 }}>表单数据菜单名</div><Input style={{ width: 420 }} value={scheme.menu?.formMenuName} onChange={(e) => update({ menu: { ...scheme.menu, formMenuName: e.target.value } })} /></div>
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
        <Button size="small" icon={<TableOutlined />} onClick={() => setDesignGroup(0)}>Univer设计</Button>
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
              const rights = Array.isArray(v) && v.length ? v : (r.type === 2 ? [1, 3, 4] : [1, 5]);
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
            render: (v, _r, i) => <Select style={{ width: 170 }} value={v || 3} options={SCOPE_TYPES} onChange={(nv) => {
              const next = [...(scheme.dataScopes || [])]; next[i] = { ...next[i], scopeType: nv }; update({ dataScopes: next });
            }} />,
          },
          {
            title: '权限列', dataIndex: 'scopeColumn', width: 180,
            render: (v, r, i) => (
              <Select
                style={{ width: 160 }} value={v} allowClear showSearch optionFilterProp="label"
                options={numericColumns.map((f) => ({ value: f.fieldDbName || f.fieldName, label: f.fieldLabel || f.fieldName }))}
                onChange={(nv) => { const next = [...(scheme.dataScopes || [])]; next[i] = { ...next[i], scopeColumn: nv }; update({ dataScopes: next }); }}
              />
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
      styles={{ body: { paddingBottom: 80 } }}
      footer={
        scheme ? (
          <Space>
            <Button onClick={() => setScheme(null)}>返回方案列表</Button>
            <Button disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</Button>
            {step < 3 ? <Button type="primary" onClick={() => setStep(step + 1)}>下一步</Button> : null}
            <Button type="primary" loading={loading} onClick={save}>保存并完成</Button>
          </Space>
        ) : null
      }
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
        title={`Univer设计 - ${groupToDesign?.groupName || ''}`}
        open={designGroup != null}
        width="min(1500px, calc(100vw - 48px))"
        style={{ top: 12 }}
        styles={{ body: { height: 'calc(100vh - 150px)', padding: 0, overflow: 'hidden' } }}
        destroyOnHidden
        onCancel={() => { univerApiRef.current = null; setDesignGroup(null); }}
        onOk={async () => {
          if (designGroup == null) return;
          const ok = await univerApiRef.current?.save();
          if (ok) { message.success('布局已保存'); setDesignGroup(null); }
        }}
      >
        <div style={{ height: '100%', overflow: 'hidden' }}>
          {groupToDesign && designFieldIds.length > 0 && formId ? (
            <ExcelDesign
              key={`${groupToDesign.groupKey || 'default'}-${designFieldSignature}`}
              embedded
              formId={formId}
              formName={formName}
              nodeKey={groupToDesign.groupKey}
              allowedFieldIds={designFieldIds}
              onReady={(api) => { univerApiRef.current = api; }}
            />
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>请先为该字段组配置字段</div>
          )}
        </div>
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
