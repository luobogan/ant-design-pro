import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button, Drawer, Empty, Form, Input, InputNumber, message, Modal, Popconfirm, Select, Space, Steps, Table, Tag, Tree, TreeSelect,
} from 'antd';
import {
  CopyOutlined, DeleteOutlined, EditOutlined, PlusOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import { resolveItemNames, type PersonOrgCategory } from '@/components/FormMode/personOrg';
import * as roleApi from '@/services/authority/role';
import AuthObjectPicker from '@/components/FormMode/AuthObjectPicker';
import {
  deleteModeDir, listModeDirAuth, listModeDirs, moveFormToDir, saveModeDir, saveModeDirAuth,
  type ModeDir, type ModeDirAuth,
} from '@/services/formmode/modeDirApi';

interface Props {
  value?: string;
  onChange?: (dirId?: string) => void;
  onChanged?: () => void;
  movingFormId?: string;
  onMoved?: () => void;
}

const SUBJECT_TYPES = [
  { value: 1, label: '角色' },
  { value: 2, label: '部门' },
  { value: 3, label: '岗位' },
  { value: 4, label: '人员' },
  { value: 5, label: '分部' },
  { value: 7, label: '全员' },
];

const RIGHT_TYPES = [
  { value: 1, label: '详情' },
  { value: 2, label: '新增' },
  { value: 3, label: '编辑' },
  { value: 4, label: '删除' },
];

const DATA_SCOPE_TYPES = [
  { value: 1, label: '全部表单' },
  { value: 2, label: '本人创建' },
  { value: 3, label: '所在机构' },
  { value: 4, label: '所在机构及子级' },
  { value: 5, label: '自定义表单' },
];

const SUBJECT_CATEGORY: Record<number, PersonOrgCategory> = {
  1: 'role', 2: 'dept', 3: 'post', 4: 'hrm', 5: 'branch',
};

interface AuthSchemeGroup {
  key: string;
  schemeId: string;
  schemeName: string;
  priority: number;
  rows: ModeDirAuth[];
}

interface DirScope {
  key: string;
  rightTypes: number[];
  scopeType: number;
  scopeColumn?: string;
  scopeValue?: string;
}

const DIR_SCOPE_COLUMNS = [
  { fieldName: '编号', fieldLabel: '编号', fieldDbName: 'id', fieldDbType: 'bigint' },
  { fieldName: '表单名称', fieldLabel: '表单名称', fieldDbName: 'form_name', fieldDbType: 'varchar' },
  { fieldName: '数据库表名', fieldLabel: '数据库表名', fieldDbName: 'table_name', fieldDbType: 'varchar' },
  { fieldName: '表单类型', fieldLabel: '表单类型', fieldDbName: 'form_type', fieldDbType: 'tinyint' },
  { fieldName: '描述', fieldLabel: '描述', fieldDbName: 'description', fieldDbType: 'varchar' },
  { fieldName: '表单状态', fieldLabel: '表单状态', fieldDbName: 'status', fieldDbType: 'int' },
  { fieldName: '模块ID', fieldLabel: '模块ID', fieldDbName: 'module_id', fieldDbType: 'bigint' },
  { fieldName: '创建人', fieldLabel: '创建人', fieldDbName: 'create_user', fieldDbType: 'bigint' },
  { fieldName: '创建部门id', fieldLabel: '创建部门id', fieldDbName: 'create_dept', fieldDbType: 'bigint' },
  { fieldName: '创建时间', fieldLabel: '创建时间', fieldDbName: 'create_time', fieldDbType: 'datetime' },
  { fieldName: '更新人', fieldLabel: '更新人', fieldDbName: 'update_user', fieldDbType: 'bigint' },
  { fieldName: '更新时间', fieldLabel: '更新时间', fieldDbName: 'update_time', fieldDbType: 'datetime' },
  { fieldName: '租户编号', fieldLabel: '租户编号', fieldDbName: 'tenant_id', fieldDbType: 'varchar' },
  { fieldName: '明细表数', fieldLabel: '明细表数', fieldDbName: 'detailtablecount', fieldDbType: 'int' },
];

const newScopeKey = () => `scope-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const scopeTypeOptions = (subjectType?: number) => Number(subjectType) === 4
  ? DATA_SCOPE_TYPES.filter((item) => [1, 2, 5].includes(item.value))
  : DATA_SCOPE_TYPES;

async function resolveSubjectNames(type: number, ids: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return result;
  if (type === 7) {
    unique.forEach((id) => { result[id] = '所有登录用户'; });
    return result;
  }
  if (type === 1) {
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
        rows.forEach((row) => { result[row.id] = row.name || row.id; });
      } catch { }
    }
  }
  unique.forEach((id) => { if (!result[id]) result[id] = id; });
  return result;
}

const FormDirTree: React.FC<Props> = ({ value, onChange, onChanged, movingFormId, onMoved }) => {
  const [dirs, setDirs] = useState<ModeDir[]>([]);
  const [expandedDirKeys, setExpandedDirKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ModeDir | null>(null);
  const [form] = Form.useForm();
  const [authOpen, setAuthOpen] = useState(false);
  const [authDir, setAuthDir] = useState<ModeDir | null>(null);
  const [auths, setAuths] = useState<ModeDirAuth[]>([]);
  const [allAuthRows, setAllAuthRows] = useState<ModeDirAuth[]>([]);
  const [authView, setAuthView] = useState<'list' | 'wizard'>('list');
  const [selectedAuthSchemeIds, setSelectedAuthSchemeIds] = useState<string[]>([]);
  const [subjectNames, setSubjectNames] = useState<Record<string, string>>({});
  const [editingSchemeId, setEditingSchemeId] = useState<string | undefined>();
  const [authSchemeName, setAuthSchemeName] = useState('');
  const [authPriority, setAuthPriority] = useState(100);
  const [authStep, setAuthStep] = useState(0);
  const [authSubjectType, setAuthSubjectType] = useState<number>(4);
  const [authSubjectIds, setAuthSubjectIds] = useState<string[]>([]);
  const [authShowLevel, setAuthShowLevel] = useState<number | undefined>();
  const [authShowLevel2, setAuthShowLevel2] = useState<number | undefined>();
  const [authScopes, setAuthScopes] = useState<DirScope[]>([]);
  const [scopeColumnPickerIndex, setScopeColumnPickerIndex] = useState<number | null>(null);
  const [scopeColumnValue, setScopeColumnValue] = useState('');
  const [scopeColumnKeyword, setScopeColumnKeyword] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listModeDirs();
      setDirs(rows);
      setExpandedDirKeys(rows.map((d) => String(d.id)).filter(Boolean));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const byType = new Map<number, string[]>();
    allAuthRows.forEach((row) => {
      const type = Number(row.subjectType || 0);
      byType.set(type, [...(byType.get(type) || []), String(row.subjectId || '0')]);
    });
    let alive = true;
    Promise.all(Array.from(byType.entries()).map(async ([type, ids]) => ({
      type,
      names: await resolveSubjectNames(type, ids),
    }))).then((groups) => {
      if (!alive) return;
      const next: Record<string, string> = {};
      groups.forEach((g) => {
        Object.entries(g.names || {}).forEach(([id, name]) => {
          next[`${g.type}:${id}`] = name;
        });
      });
      setSubjectNames(next);
    });
    return () => { alive = false; };
  }, [allAuthRows]);

  useEffect(() => {
    if (!authOpen || authView !== 'wizard' || authSubjectType === 7 || !authSubjectIds.length) return;
    let alive = true;
    resolveSubjectNames(authSubjectType, authSubjectIds).then((names) => {
      if (!alive) return;
      const next: Record<string, string> = {};
      Object.entries(names).forEach(([id, name]) => { next[`${authSubjectType}:${id}`] = name; });
      setSubjectNames((prev) => ({ ...prev, ...next }));
    });
    return () => { alive = false; };
  }, [authOpen, authView, authSubjectType, authSubjectIds]);

  const treeData = useMemo(() => {
    const byParent = new Map<string, ModeDir[]>();
    dirs.forEach((d) => {
      const key = String(d.parentid || '0');
      byParent.set(key, [...(byParent.get(key) || []), d]);
    });
    const build = (parent: string): any[] => (byParent.get(parent) || []).map((d) => ({
      key: String(d.id),
      title: d.name || `目录${d.id}`,
      children: build(String(d.id)),
    }));
    return build('0');
  }, [dirs]);

  const disabledParentIds = useMemo(() => {
    const result = new Set<string>();
    if (!editing?.id) return result;
    result.add(String(editing.id));
    let changed = true;
    while (changed) {
      changed = false;
      dirs.forEach((d) => {
        const id = String(d.id);
        const parent = String(d.parentid || '0');
        if (!result.has(id) && result.has(parent)) {
          result.add(id);
          changed = true;
        }
      });
    }
    return result;
  }, [dirs, editing?.id]);

  const scopeColumnLabel = (value?: string) => {
    if (!value) return '选择权限列';
    const hit = DIR_SCOPE_COLUMNS.find((c) => c.fieldDbName === value);
    return hit ? `${hit.fieldLabel}（${value}）` : value;
  };

  const scopeColumnRows = useMemo(() => {
    const kw = scopeColumnKeyword.trim().toLowerCase();
    if (!kw) return DIR_SCOPE_COLUMNS;
    return DIR_SCOPE_COLUMNS.filter((c) => [c.fieldName, c.fieldLabel, c.fieldDbName]
      .some((v) => String(v || '').toLowerCase().includes(kw)));
  }, [scopeColumnKeyword]);

  const authSchemeGroups = useMemo<AuthSchemeGroup[]>(() => {
    const map = new Map<string, ModeDirAuth[]>();
    allAuthRows.forEach((row) => {
      const key = String(row.schemeId || row.id || '0');
      map.set(key, [...(map.get(key) || []), row]);
    });
    return Array.from(map.entries()).map(([key, rows]) => ({
      key,
      schemeId: key,
      schemeName: rows[0]?.schemeName || `目录权限方案-${key}`,
      priority: rows[0]?.priority ?? 100,
      rows,
    })).sort((a, b) => a.priority - b.priority || Number(a.schemeId) - Number(b.schemeId));
  }, [allAuthRows]);

  const parentTreeData = useMemo(() => {
    const convert = (nodes: any[]): any[] => nodes.map((node) => ({
      value: node.key,
      title: node.title,
      disabled: disabledParentIds.has(node.key),
      children: convert(node.children || []),
    }));
    return [{ value: '0', title: '根目录', children: convert(treeData) }];
  }, [treeData, disabledParentIds]);

  const openEdit = (dir?: ModeDir) => {
    setEditing(dir || null);
    form.setFieldsValue({
      name: dir?.name || '',
      parentid: dir ? String(dir.parentid || '0') : String(value || '0'),
      dsporder: dir?.dsporder ?? 0,
    });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    const values = await form.validateFields();
    await saveModeDir({
      ...(editing || {}),
      name: values.name,
      parentid: values.parentid === '0' ? 0 : Number(values.parentid),
      dsporder: Number(values.dsporder || 0),
    });
    message.success('目录已保存');
    setEditOpen(false);
    await load();
    onChanged?.();
  };

  const removeDir = async (dir: ModeDir) => {
    Modal.confirm({
      title: `删除目录「${dir.name}」？`,
      content: '请先删除子目录或把目录下表单移走',
      onOk: async () => {
        try {
          await deleteModeDir(String(dir.id));
          if (value === String(dir.id)) onChange?.();
          message.success('目录已删除');
          await load();
          onChanged?.();
        } catch (e: any) {
          message.error(e?.message || '删除失败');
        }
      },
    });
  };

  const openAuth = async (dir: ModeDir) => {
    const rows = await listModeDirAuth(String(dir.id));
    setAuthDir(dir);
    setAllAuthRows(rows);
    setSelectedAuthSchemeIds([]);
    setAuthView('list');
    setAuthOpen(true);
  };

  const startCreateAuth = () => {
    setEditingSchemeId(undefined);
    setAuthSchemeName(`目录权限方案-${Date.now().toString().slice(-6)}`);
    setAuthPriority(100);
    setAuthStep(0);
    setAuthSubjectType(4);
    setAuthSubjectIds([]);
    setAuthShowLevel(undefined);
    setAuthShowLevel2(undefined);
    setAuthScopes([{ key: newScopeKey(), rightTypes: [1], scopeType: 2, scopeColumn: 'create_user' }]);
    setAuthView('wizard');
  };

  const startEditAuth = (group: AuthSchemeGroup) => {
    const first = group.rows[0] || {};
    const subjectType = Number(first.subjectType || 4);
    setEditingSchemeId(group.schemeId);
    setAuthSchemeName(group.schemeName);
    setAuthPriority(group.priority);
    setAuthStep(0);
    setAuthSubjectType(subjectType);
    setAuthSubjectIds(Array.from(new Set(group.rows.map((r) => String(r.subjectId || '0')))));
    setAuthShowLevel(first.showlevel);
    setAuthShowLevel2(first.showlevel2);
    const scopeMap = new Map<string, DirScope>();
    group.rows.forEach((row) => {
      const key = [row.scopeType || 1, row.scopeColumn || '', row.scopeValue || ''].join('|');
      if (!scopeMap.has(key)) {
        scopeMap.set(key, {
          key: newScopeKey(),
          rightTypes: [],
          scopeType: Number(row.scopeType || 1),
          scopeColumn: row.scopeColumn,
          scopeValue: row.scopeValue,
        });
      }
      const rightType = Number(row.rightType);
      const current = scopeMap.get(key)!;
      if (rightType && !current.rightTypes.includes(rightType)) current.rightTypes.push(rightType);
    });
    setAuthScopes(Array.from(scopeMap.values()));
    setAuthView('wizard');
  };

  const persistAuthRows = async (rows: ModeDirAuth[]) => {
    if (!authDir) return;
    await saveModeDirAuth(String(authDir.id), rows);
    setAllAuthRows(rows);
  };

  const copyAuthScheme = async (group: AuthSchemeGroup) => {
    const schemeId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const copies = group.rows.map((row) => ({
      ...row,
      id: undefined,
      schemeId,
      schemeName: `${group.schemeName}（副本）`,
      priority: (group.priority || 100) + 1,
    }));
    await persistAuthRows([...allAuthRows, ...copies]);
    message.success('方案已复制');
  };

  const deleteAuthSchemes = async (schemeIds: string[]) => {
    await persistAuthRows(allAuthRows.filter((row) => !schemeIds.includes(String(row.schemeId || row.id || '0'))));
    setSelectedAuthSchemeIds([]);
    message.success('方案已删除');
  };

  const nextAuthStep = () => {
    if (authSubjectType !== 7 && !authSubjectIds.length) {
      message.warning('请选择授权对象');
      return;
    }
    setAuthStep(1);
  };

  const saveAuth = async () => {
    if (!authDir) return;
    if (!authScopes.length) {
      message.warning('请至少配置一条数据范围');
      return;
    }
    for (const scope of authScopes) {
      if (!scope.rightTypes.length) {
        message.warning('请选择数据范围的权限类型');
        return;
      }
      if (Number(scope.scopeType) === 5 && !scope.scopeValue) {
        message.warning('请填写自定义值域');
        return;
      }
    }
    const subjectIds = Array.from(new Set(authSubjectType === 7 ? ['0'] : authSubjectIds));
    const schemeId = editingSchemeId || `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const schemeName = authSchemeName.trim() || `目录权限方案-${schemeId}`;
    const payload: ModeDirAuth[] = [];
    const seen = new Set<string>();
    subjectIds.forEach((subjectId) => {
      authScopes.forEach((scope) => {
        Array.from(new Set(scope.rightTypes.map(Number))).forEach((rightType) => {
          const key = [subjectId, scope.scopeType, scope.scopeColumn || '', scope.scopeValue || '', rightType].join('|');
          if (seen.has(key)) return;
          seen.add(key);
          payload.push({
            dirId: String(authDir.id),
            subjectType: authSubjectType,
            subjectId,
            rightType,
            scopeType: scope.scopeType,
            scopeColumn: scope.scopeColumn,
            scopeValue: Number(scope.scopeType) === 5 ? scope.scopeValue : undefined,
            showlevel: authShowLevel,
            showlevel2: authShowLevel2,
            schemeId,
            schemeName,
            priority: authPriority,
          });
        });
      });
    });
    const nextRows = [...allAuthRows.filter((row) => String(row.schemeId || row.id || '0') !== schemeId), ...payload];
    await persistAuthRows(nextRows);
    setAuths(payload);
    message.success('目录权限方案已保存');
    setAuthView('list');
  };

  const doMove = async () => {
    if (!movingFormId) return;
    if (!value) {
      message.warning('请先选择目标目录');
      return;
    }
    await moveFormToDir(movingFormId, value);
    message.success('表单已移动到所选目录');
    onMoved?.();
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong>模块目录</strong>
        <Space size={0}>
          <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => openEdit()} />
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            disabled={!value}
            onClick={() => openEdit(dirs.find((d) => String(d.id) === value))}
          />
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            disabled={!value}
            onClick={() => {
              const dir = dirs.find((d) => String(d.id) === value);
              if (dir) removeDir(dir);
            }}
          />
          <Button
            type="text"
            size="small"
            icon={<SafetyCertificateOutlined />}
            disabled={!value}
            onClick={() => {
              const dir = dirs.find((d) => String(d.id) === value);
              if (dir) openAuth(dir);
            }}
          />
        </Space>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {treeData.length ? (
          <Tree
            loading={loading}
            treeData={treeData}
            expandedKeys={expandedDirKeys}
            onExpand={(keys) => setExpandedDirKeys(keys.map(String))}
            selectedKeys={value ? [value] : []}
            onSelect={(keys) => onChange?.(keys.length ? String(keys[0]) : undefined)}
          />
        ) : <Empty description="暂无目录" />}
      </div>
      {movingFormId ? (
        <Button type="primary" block style={{ marginTop: 8 }} onClick={doMove}>移动到所选目录</Button>
      ) : null}

      <Modal title={editing ? '编辑目录' : '新增目录'} open={editOpen} onCancel={() => setEditOpen(false)} onOk={submitEdit}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="目录名称" rules={[{ required: true, message: '请输入目录名称' }]}>
            <Input placeholder="请输入目录名称" />
          </Form.Item>
          <Form.Item name="parentid" label="上级目录">
            <TreeSelect
              treeData={parentTreeData}
              treeDefaultExpandAll
              placeholder="请选择上级目录"
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="dsporder" label="排序号">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={`目录权限 - ${authDir?.name || ''}`}
        open={authOpen}
        placement="right"
        onClose={() => setAuthOpen(false)}
        extra={authView === 'wizard' ? (
          <Space>
            <Button onClick={() => {
              setAuthStep(0);
              setAuthView('list');
            }}>
              返回列表
            </Button>
            <Button onClick={() => (authStep === 0 ? setAuthOpen(false) : setAuthStep(0))}>
              {authStep === 0 ? '取消' : '上一步'}
            </Button>
            <Button type="primary" onClick={authStep === 0 ? nextAuthStep : saveAuth}>
              {authStep === 0 ? '下一步' : '保存'}
            </Button>
          </Space>
        ) : null}
        footer={null}
        width="min(1200px, calc(100vw - 48px))"
        destroyOnHidden
      >
        {authView === 'list' ? (
          <div>
            <Space style={{ marginBottom: 12 }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={startCreateAuth}>新建方案</Button>
              <Popconfirm
                title={`确认删除选中的 ${selectedAuthSchemeIds.length} 个方案？`}
                disabled={!selectedAuthSchemeIds.length}
                onConfirm={() => deleteAuthSchemes(selectedAuthSchemeIds)}
              >
                <Button danger icon={<DeleteOutlined />} disabled={!selectedAuthSchemeIds.length}>批量删除</Button>
              </Popconfirm>
              <span style={{ color: '#999' }}>一次多选生成的方案会归为一组显示；同一用户可命中多组方案。</span>
            </Space>
            <Table
              rowKey="key"
              size="small"
              pagination={false}
              dataSource={authSchemeGroups}
              rowSelection={{
                selectedRowKeys: selectedAuthSchemeIds,
                onChange: (keys) => setSelectedAuthSchemeIds(keys.map(String)),
              }}
              locale={{ emptyText: <Empty description="暂无授权方案" /> }}
              columns={[
                {
                  title: '方案名称', dataIndex: 'schemeName',
                  render: (_v, r: AuthSchemeGroup) => `${r.schemeName}${r.rows.length > 1 ? `（${r.rows.length}个对象）` : ''}`,
                },
                {
                  title: '授权对象类型', width: 120,
                  render: (_v, r: AuthSchemeGroup) => SUBJECT_TYPES.find((t) => t.value === Number(r.rows[0]?.subjectType))?.label || r.rows[0]?.subjectType,
                },
                {
                  title: '授权对象', width: 260,
                  render: (_v, r: AuthSchemeGroup) => {
                    const type = Number(r.rows[0]?.subjectType || 0);
                    if (type === 7) return '所有登录用户';
                    return Array.from(new Set(r.rows.map((row) => String(row.subjectId || ''))))
                      .map((id) => subjectNames[`${type}:${id}`] || id).join('、');
                  },
                },
                { title: '优先级', dataIndex: 'priority', width: 90 },
                {
                  title: '操作', key: 'op', width: 160,
                  render: (_v, r: AuthSchemeGroup) => (
                    <Space size={2}>
                      <Button type="link" size="small" icon={<EditOutlined />} onClick={() => startEditAuth(r)}>编辑</Button>
                      <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => copyAuthScheme(r)}>复制</Button>
                      <Popconfirm title="确认删除该方案？" onConfirm={() => deleteAuthSchemes([r.schemeId])}>
                        <Button danger type="link" size="small" icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
            />
          </div>
        ) : (
          <>
            <Steps
              size="small"
              style={{ marginBottom: 20 }}
              current={authStep}
              items={[{ title: '授权对象' }, { title: '数据范围' }]}
            />
            <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', padding: 8, marginBottom: 16 }}>
              <Space wrap>
                <Tag color="blue">当前方案：{authSchemeName || '未命名'}</Tag>
                <Tag>授权对象类型：{SUBJECT_TYPES.find((t) => t.value === authSubjectType)?.label}</Tag>
                <Tag>
                  授权对象：{authSubjectType === 7
                    ? '所有登录用户'
                    : (authSubjectIds.length
                      ? authSubjectIds.map((id) => subjectNames[`${authSubjectType}:${id}`] || id).join('、')
                      : '待选择')}
                </Tag>
                {authShowLevel != null || authShowLevel2 != null
                  ? <Tag color="orange">安全级别：{authShowLevel ?? 0}~{authShowLevel2 ?? '不封顶'}</Tag>
                  : null}
                <Tag>布局优先级：{authPriority ?? 100}</Tag>
              </Space>
            </div>
            {authStep === 0 ? (
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <div>
                  <div style={{ marginBottom: 6 }}>方案名称</div>
                  <Input style={{ width: 360 }} value={authSchemeName} onChange={(e) => setAuthSchemeName(e.target.value)} />
                </div>
                <div>
                  <div style={{ marginBottom: 6 }}>授权对象类型</div>
                  <Select
                    style={{ width: 220 }}
                    value={authSubjectType}
                    options={SUBJECT_TYPES}
                    onChange={(v) => {
                      setAuthSubjectType(v);
                      setAuthSubjectIds([]);
                    }}
                  />
                </div>
                {authSubjectType === 7 ? (
                  <div style={{ color: '#666' }}>所有登录用户</div>
                ) : (
                  <div>
                    <div style={{ marginBottom: 6 }}>授权对象</div>
                    <AuthObjectPicker
                      multiple
                      objtype={authSubjectType}
                      value={authSubjectIds}
                      onChange={(v) => setAuthSubjectIds(Array.isArray(v) ? v.map(String) : v ? [String(v)] : [])}
                    />
                  </div>
                )}
                <Space wrap>
                  <div>
                    <div style={{ marginBottom: 6 }}>密级下限</div>
                    <InputNumber min={0} max={100} value={authShowLevel ?? null} onChange={(v) => setAuthShowLevel(v ?? undefined)} placeholder="不限" />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>密级上限</div>
                    <InputNumber min={0} max={100} value={authShowLevel2 ?? null} onChange={(v) => setAuthShowLevel2(v ?? undefined)} placeholder="不封顶" />
                  </div>
                  <div>
                    <div style={{ marginBottom: 6 }}>优先级</div>
                    <InputNumber min={0} value={authPriority} onChange={(v) => setAuthPriority(v ?? 100)} />
                  </div>
                </Space>
              </Space>
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <div style={{ color: '#666' }}>
                  数据范围自动使用当前方案的授权对象，无需重复配置。
                </div>
                {Number(authSubjectType) === 4 ? (
                  <div style={{ color: '#999' }}>人员方案仅提供“全部可见 / 本人可见 / 自定义”；机构范围请配置部门、分部或全员方案。</div>
                ) : null}
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  block
                  onClick={() => setAuthScopes([...authScopes, {
                    key: newScopeKey(),
                    rightTypes: [1],
                    scopeType: Number(authSubjectType) === 4 ? 2 : 3,
                    scopeColumn: Number(authSubjectType) === 4 ? 'create_user' : 'create_dept',
                  }])}
                >
                  新增数据范围
                </Button>
                <Table
                  rowKey="key"
                  size="small"
                  pagination={false}
                  dataSource={authScopes}
                  columns={[
                    {
                      title: '权限类型', dataIndex: 'rightTypes', width: 190,
                      render: (v, _r, i) => (
                        <Select
                          mode="multiple"
                          size="small"
                          style={{ width: 180 }}
                          value={v}
                          options={RIGHT_TYPES}
                          onChange={(next) => {
                            const rows = [...authScopes];
                            rows[i] = { ...rows[i], rightTypes: Array.from(new Set(next.map(Number))) };
                            setAuthScopes(rows);
                          }}
                        />
                      ),
                    },
                    {
                      title: '数据范围', dataIndex: 'scopeType', width: 190,
                      render: (v, _r, i) => (
                        <Select
                          size="small"
                          style={{ width: 170 }}
                          value={v}
                          options={scopeTypeOptions(authSubjectType)}
                          onChange={(next) => {
                            const rows = [...authScopes];
                            rows[i] = { ...rows[i], scopeType: next };
                            setAuthScopes(rows);
                          }}
                        />
                      ),
                    },
                    {
                      title: '权限列', dataIndex: 'scopeColumn', width: 180,
                      render: (v, _r, i) => (
                        <Space.Compact style={{ width: 160 }}>
                          <Button
                            size="small"
                            style={{ width: 126, textAlign: 'left' }}
                            onClick={() => {
                              setScopeColumnPickerIndex(i);
                              setScopeColumnValue(v || '');
                              setScopeColumnKeyword('');
                            }}
                          >
                            {scopeColumnLabel(v)}
                          </Button>
                          {v ? (
                            <Button size="small" danger onClick={() => {
                              const rows = [...authScopes];
                              rows[i] = { ...rows[i], scopeColumn: undefined };
                              setAuthScopes(rows);
                            }}>清</Button>
                          ) : null}
                        </Space.Compact>
                      ),
                    },
                    {
                      title: '自定义值域', dataIndex: 'scopeValue',
                      render: (v, r, i) => Number(r.scopeType) === 5 ? (
                        <Input
                          size="small"
                          value={v}
                          placeholder="where scope.dept_id in (1,2)"
                          onChange={(e) => {
                            const rows = [...authScopes];
                            rows[i] = { ...rows[i], scopeValue: e.target.value };
                            setAuthScopes(rows);
                          }}
                        />
                      ) : null,
                    },
                    {
                      title: '操作', width: 70,
                      render: (_v, _r, i) => (
                        <Button danger type="link" size="small" onClick={() => setAuthScopes(authScopes.filter((_x, idx) => idx !== i))}>删除</Button>
                      ),
                    },
                  ]}
                />
              </Space>
            )}
          </>
        )}
      </Drawer>

      <Modal
        title="选择权限列"
        open={scopeColumnPickerIndex != null}
        width={720}
        destroyOnHidden
        onCancel={() => setScopeColumnPickerIndex(null)}
        onOk={() => {
          if (scopeColumnPickerIndex == null || !scopeColumnValue) {
            message.warning('请选择权限列');
            return;
          }
          const rows = [...authScopes];
          rows[scopeColumnPickerIndex] = { ...rows[scopeColumnPickerIndex], scopeColumn: scopeColumnValue };
          setAuthScopes(rows);
          setScopeColumnPickerIndex(null);
        }}
      >
        <Input.Search
          allowClear
          style={{ marginBottom: 12 }}
          placeholder="搜索字段名称 / 数据库列名"
          value={scopeColumnKeyword}
          onChange={(e) => setScopeColumnKeyword(e.target.value)}
        />
        <Table
          rowKey="fieldDbName"
          size="small"
          pagination={false}
          scroll={{ y: 360 }}
          dataSource={scopeColumnRows}
          rowSelection={{
            type: 'radio',
            selectedRowKeys: scopeColumnValue ? [scopeColumnValue] : [],
            onChange: (keys) => setScopeColumnValue(String(keys[0] || '')),
          }}
          locale={{ emptyText: <Empty description="没有可用字段" /> }}
          columns={[
            { title: '字段名称', dataIndex: 'fieldLabel', width: 180 },
            { title: '字段名', dataIndex: 'fieldName', width: 160 },
            { title: '数据库列名', dataIndex: 'fieldDbName', width: 180 },
            { title: '字段类型', dataIndex: 'fieldDbType', width: 100 },
          ]}
        />
      </Modal>
    </div>
  );
};

export default FormDirTree;
