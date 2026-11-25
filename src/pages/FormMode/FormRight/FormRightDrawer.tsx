import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Drawer,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Checkbox,
  Tabs,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, EditOutlined, PlusOutlined, SyncOutlined, TableOutlined } from '@ant-design/icons';
import {
  getFieldAuthorizes,
  getModeDataScopes,
  getModeRights,
  ModeDataShareRule,
  ModeFieldAuthorize,
  ModeRightInfo,
  FieldAuthGroupVO,
  resolveModeId,
  saveAllRights,
  getRightVersion,
  getFieldAuthGroups,
  getFormMenuShares,
  MenuShare,
} from '@/services/formmode/rightApi';
import { fieldApi, formApi, fieldDefinitionApi } from '@/services/formmode';
import type { FieldDefinition } from '@/services/formmode/typings';
import * as matrixApi from '@/pages/System/Matrix/service';
import AuthObjectPicker, { AUTH_OBJECT_TYPE_OPTIONS, AuthObjectTypeSelect } from '@/components/FormMode/AuthObjectPicker';
import { usePageButtons } from '@/hooks/usePageButtons';
import ExcelDesign from '@/pages/FormMode/ExcelDesign/ExcelDesign';
import { LAYOUT_TYPES, DEFAULT_LAYOUT_TYPE_NAMES, layoutTypeName } from '@/pages/FormMode/ExcelDesign/layoutTypes';
import { getFormLayout, getFormLayoutTypeNames, saveFormLayoutTypeName, syncFormLayout } from '@/services/formmode/formLayoutApi';

interface Props {
  /** 表单ID（workflow_bill.id）；权限按反查出的 modeId 落库 */
  formId?: string;
  formName?: string;
  open: boolean;
  onClose: () => void;
}

// 权限项只列出后端真正校验的类型：
// 6导入/7导出在 blade-formmode 无业务数据导入/导出端点（导出仅为前端下载布局 JSON，
// ecology 表单结构导入属管理员建模操作、由 @PreAuth 门槛控制），配置后永不生效。
// 移除以免误导；后端 RightType 枚举保留 6/7 作为未来扩展位。
const RIGHTTYPE_OPTS = [
  { value: 1, label: '可见' },
  { value: 2, label: '新建' },
  { value: 3, label: '编辑' },
  { value: 4, label: '删除' },
  { value: 5, label: '详情' },
];
const RIGHTVALUE_OPTS = [
  { value: 0, label: '隐藏' },
  { value: 1, label: '可见' },
  { value: 2, label: '可编辑' },
];
const SCOPE_TYPE_OPTS = [
  { value: 1, label: '查看' },
  { value: 2, label: '维护' },
];
const CONDITION_OP_OPTS = [
  { value: 'eq', label: '等于' },
  { value: 'ne', label: '不等于' },
  { value: 'gt', label: '大于' },
  { value: 'ge', label: '大于等于' },
  { value: 'lt', label: '小于' },
  { value: 'le', label: '小于等于' },
  { value: 'like', label: '包含' },
  { value: 'in', label: '属于列表' },
];

/**
 * 矩阵结果字段下拉：按选中矩阵加载 field_type=1（结果维度）字段，避免手填 field_key。
 */
const MatrixValueFieldSelect: React.FC<{
  matrixId?: number;
  value?: string;
  disabled?: boolean;
  onChange: (v?: string) => void;
}> = ({ matrixId, value, disabled, onChange }) => {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (matrixId == null) { setOptions([]); return; }
    let cancelled = false;
    setLoading(true);
    matrixApi.fields(matrixId)
      .then((res: any) => {
        const arr = Array.isArray(res) ? res : res?.data;
        if (!cancelled && Array.isArray(arr)) {
          setOptions(arr
            .filter((f: any) => Number(f.fieldType) === 1)
            .map((f: any) => ({ value: f.fieldKey, label: f.displayName || f.fieldKey })));
        }
      })
      .catch(() => { if (!cancelled) setOptions([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [matrixId]);
  return (
    <Select
      value={value || undefined}
      options={options}
      loading={loading}
      disabled={disabled}
      allowClear
      showSearch
      optionFilterProp="label"
      onChange={(v) => onChange(v)}
      placeholder="选择结果字段"
      style={{ width: 120 }}
    />
  );
};

const FormRightDrawer: React.FC<Props> = ({ formId, formName: formNameProp, open, onClose }) => {
  const { buttons } = usePageButtons();
  // modeId 是雪花ID，必须按字符串保存，避免 JS Number 精度丢失导致查错模块
  const [modeId, setModeId] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [modeRights, setModeRights] = useState<ModeRightInfo[]>([]);
  const [fieldAuths, setFieldAuths] = useState<ModeFieldAuthorize[]>([]);
  const [dataScopes, setDataScopes] = useState<ModeDataShareRule[]>([]);
  const [rightVersion, setRightVersion] = useState<number>(0);
  // 字段权限：按主体配置视图
  const [fieldViewMode, setFieldViewMode] = useState<'subject' | 'field'>('subject');
  const [fieldGroups, setFieldGroups] = useState<FieldAuthGroupVO[]>([]);
  const [fieldModalGroupIndex, setFieldModalGroupIndex] = useState<number | null>(null);


  const [fieldModalSearch, setFieldModalSearch] = useState('');
  const [fieldModalScope, setFieldModalScope] = useState('main');
  const [fieldModalSelected, setFieldModalSelected] = useState<number[]>([]);
  const [univerModalOpen, setUniverModalOpen] = useState(false);
  // 当前 Univer 设计器实际使用的字段白名单：行内按钮用当前组，顶部按钮用全部组并集
  const [univerDesignFieldIds, setUniverDesignFieldIds] = useState<string[]>([]);
  const [univerDesignNodeKey, setUniverDesignNodeKey] = useState<string | undefined>(undefined);
  const [univerLayoutType, setUniverLayoutType] = useState<number>(0);
  const [layoutTypeNames, setLayoutTypeNames] = useState<Record<number, string>>({ ...DEFAULT_LAYOUT_TYPE_NAMES });
  const [configuredLayoutTypes, setConfiguredLayoutTypes] = useState<Set<number>>(new Set());
  const [layoutNameEditing, setLayoutNameEditing] = useState<number | null>(null);
  const [layoutNameDraft, setLayoutNameDraft] = useState('');
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncMode, setSyncMode] = useState<'groups' | 'types'>('groups');
  const [syncTargetNodes, setSyncTargetNodes] = useState<string[]>([]);
  const [syncTargetTypes, setSyncTargetTypes] = useState<number[]>([]);
  const [syncOverwrite, setSyncOverwrite] = useState(false);
  const univerApiRef = useRef<{ save: () => Promise<boolean> } | null>(null);
  // 方案C：单个表单的数据菜单名 + 角色级显示名
  const [formMenuName, setFormMenuName] = useState<string>('');
  const [roleMenuNames, setRoleMenuNames] = useState<Record<string, string>>({});
  const [menuShares, setMenuShares] = useState<MenuShare[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formName, setFormName] = useState(formNameProp || '');
  const [fieldConfigured, setFieldConfigured] = useState(false);

  useEffect(() => {
    if (!open || !formId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFormMenuName('');
      setRoleMenuNames({});
      setMenuShares([]);
      setFieldConfigured(false);
      try {
        const [mid, flds, configured, formDetail] = await Promise.all([
          resolveModeId(formId),
          fieldApi.getByFormId(formId).catch(() => [] as FieldDefinition[]),
          fieldDefinitionApi.isConfigured(formId).catch(() => false),
          formNameProp ? Promise.resolve(null) : formApi.getById(formId).catch(() => null),
        ]);
        if (cancelled) return;
        setModeId(mid);
        setFields(flds || []);
        setFieldConfigured(!!configured);
        setFormName(formNameProp || (formDetail as any)?.formName || '');
        if (mid) {
          const [mr, fa, fg, ds, ver, shares] = await Promise.all([
            getModeRights(mid),
            getFieldAuthorizes(mid),
            getFieldAuthGroups(mid),
            getModeDataScopes(mid),
            getRightVersion(mid),
            getFormMenuShares(mid).catch(() => [] as MenuShare[]),
          ]);
          if (cancelled) return;
          setModeRights(mr || []);
          setFieldAuths(fa || []);
          if (fg && fg.length) {
            setFieldGroups(fg);
          } else {
            // 老数据兼容：把旧的“一个字段一个主体”配置聚合成授权对象组展示，
            // 保存时会按新组模型落库，避免列表为空导致操作按钮无处显示。
            const legacyGroups = new Map<string, FieldAuthGroupVO>();
            (fa || []).forEach((a: ModeFieldAuthorize) => {
              if (a.groupId != null && a.groupId > 0) return; // 新组数据不重复聚合
              if (a.objtype == null || a.objid == null || a.fieldid == null || a.rightvalue == null) return;
              const key = a.objtype + '_' + a.objid;
              if (!legacyGroups.has(key)) {
                legacyGroups.set(key, {
                  groupKey: `legacy-${a.objtype}-${a.objid}`,
                  groupName: '旧配置-' + a.objid,
                  subjects: [{ objtype: Number(a.objtype), objid: String(a.objid), includesub: Number(a.includesub || 0) }],
                  fields: [],
                });
              }
              legacyGroups.get(key)!.fields!.push({
                fieldId: Number(a.fieldid),
                rightvalue: Number(a.rightvalue) as 0 | 1 | 2,
              });
            });
            setFieldGroups(Array.from(legacyGroups.values()));
          }
          setDataScopes(ds || []);
          setRightVersion(ver || 0);
          if (shares && shares.length) {
            setMenuShares(shares);
          } else {
            // 兼容旧数据：没有显式菜单共享时，按模块权限角色生成默认可见范围
            setMenuShares((mr || [])
              .filter((r) => r.objtype === 1 && r.objid != null)
              .map((r) => ({ shareType: 1, shareId: String(r.objid), includeSub: 0 })));
          }
        } else {
          setModeRights([]);
          setFieldAuths([]);
          setDataScopes([]);
          setMenuShares([]);
        }
      } catch (e) {
        message.error('加载权限配置失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, formId]);

  const disabled = !modeId;

  const updateRight = (idx: number, key: keyof ModeRightInfo, val: any) =>
    setModeRights((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));
  const removeRight = (idx: number) => setModeRights((prev) => prev.filter((_, i) => i !== idx));
  const addRight = () =>
    setModeRights((prev) => [...prev, { objtype: 1, righttype: 1, objid: undefined, includesub: 0 }]);

  const updateAuth = (idx: number, key: keyof ModeFieldAuthorize, val: any) =>
    setFieldAuths((prev) => prev.map((a, i) => (i === idx ? { ...a, [key]: val } : a)));
  const removeAuth = (idx: number) => setFieldAuths((prev) => prev.filter((_, i) => i !== idx));
  const addAuth = () =>
    setFieldAuths((prev) => [...prev, { fieldid: undefined, objtype: 1, objid: undefined, includesub: 0, rightvalue: 1 }]);

  const updateScope = (idx: number, key: keyof ModeDataShareRule, val: any) =>
    setDataScopes((prev) => prev.map((s, i) => (i === idx ? { ...s, [key]: val } : s)));
  const removeScope = (idx: number) => setDataScopes((prev) => prev.filter((_, i) => i !== idx));
  const addScope = () =>
    setDataScopes((prev) => [...prev, {
      type: 1, objtype: 1, objid: undefined, includeSub: 0, creatorSelf: 0,
      conditionEnabled: 0, conditionField: '', conditionOp: 'eq', conditionValue: '',
    }]);

  // 多选授权对象：展开为标准明细行，不把多个 objid 塞进同一字段
  const toIds = (v?: string | string[]): string[] => Array.isArray(v)
    ? Array.from(new Set(v.map((id) => String(id).trim()).filter(Boolean)))
    : (v == null || String(v).trim() === '' ? [] : [String(v).trim()]);

  const expandModeRightObjects = (index: number, values?: string | string[]) => {
    const ids = toIds(values);
    setModeRights((prev) => {
      const row = prev[index];
      if (!row) return prev;
      if (!ids.length) return prev.map((r, i) => i === index ? { ...r, objid: undefined } : r);
      const rest = prev.filter((_, i) => i !== index);
      return [...rest, ...ids.map((id) => ({ ...row, objid: id }))];
    });
  };

  const expandAuthObjects = (index: number, values?: string | string[]) => {
    const ids = toIds(values);
    setFieldAuths((prev) => {
      const row = prev[index];
      if (!row) return prev;
      if (!ids.length) return prev.map((a, i) => i === index ? { ...a, objid: undefined } : a);
      const rest = prev.filter((_, i) => i !== index);
      return [...rest, ...ids.map((id) => ({ ...row, id: undefined, objid: id } as ModeFieldAuthorize))];
    });
  };

  const expandScopeObjects = (index: number, values?: string | string[]) => {
    const ids = toIds(values);
    setDataScopes((prev) => {
      const row = prev[index];
      if (!row) return prev;
      if (!ids.length) return prev.map((r, i) => i === index ? { ...r, objid: undefined } : r);
      const rest = prev.filter((_, i) => i !== index);
      return [...rest, ...ids.map((id) => ({ ...row, id: undefined, objid: id } as ModeDataShareRule))];
    });
  };

  const canExcelDesign = buttons.some((btn: any) => btn.code === 'exceldesign');
  // 顶部总按钮：所有授权对象组的字段并集
  const allUniverAllowedFieldIds = useMemo(() => {
    const ids = new Set<string>();
    fieldGroups.forEach((g) => (g.fields || []).forEach((f) => {
      if (Number(f.rightvalue) >= 1) ids.add(String(f.fieldId));
    }));
    return Array.from(ids);
  }, [fieldGroups]);

  const fieldIdsOfGroup = (group?: FieldAuthGroupVO) => {
    const ids = new Set<string>();
    (group?.fields || []).forEach((f) => {
      if (Number(f.rightvalue) >= 1) ids.add(String(f.fieldId));
    });
    return Array.from(ids);
  };

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
      const configured = new Set<number>();
      LAYOUT_TYPES.forEach((t, i) => { if (checks[i]) configured.add(t.value); });
      setConfiguredLayoutTypes(configured);
    } catch { /* 默认值兜底 */ }
  };

  const handleOpenExcelDesign = (group?: FieldAuthGroupVO) => {
    const ids = group ? fieldIdsOfGroup(group) : allUniverAllowedFieldIds;
    if (!formId || !ids.length) {
      message.warning('请先配置字段权限，再设计新增/编辑页面');
      return;
    }
    univerApiRef.current = null;
    setUniverLayoutType(0);
    setLayoutNameEditing(null);
    setSyncModalOpen(false);
    setUniverDesignFieldIds(ids);
    // 行内按钮传了 group：按组隔离布局；顶部总按钮不传：使用表单级通用布局
    setUniverDesignNodeKey(group ? (group.groupKey || `group-${group.id || ''}`) : undefined);
    setUniverModalOpen(true);
    loadLayoutTypeMeta(group ? (group.groupKey || `group-${group.id || ''}`) : undefined);
  };

  const handleSaveLayoutTypeName = async (type: number) => {
    const name = layoutNameDraft.trim();
    if (!formId || !name) {
      message.warning('显示名不能为空');
      return;
    }
    const res: any = await saveFormLayoutTypeName({ formId, layoutType: type, layoutName: name });
    if (res?.success === false) {
      message.error(res?.msg || '显示名保存失败');
      return;
    }
    setLayoutTypeNames((prev) => ({ ...prev, [type]: name }));
    setLayoutNameEditing(null);
    message.success('布局显示名已保存');
  };

  const openSyncModal = (mode: 'groups' | 'types') => {
    setSyncMode(mode);
    setSyncTargetNodes([]);
    setSyncTargetTypes([]);
    setSyncOverwrite(false);
    setSyncModalOpen(true);
  };

  const handleSyncLayout = async () => {
    if (!formId) return;
    if (syncMode === 'groups' && !syncTargetNodes.length) {
      message.warning('请选择目标组');
      return;
    }
    if (syncMode === 'types' && !syncTargetTypes.length) {
      message.warning('请选择目标布局类型');
      return;
    }
    const res: any = await syncFormLayout({
      formId,
      sourceNodeKey: univerDesignNodeKey,
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
    loadLayoutTypeMeta(univerDesignNodeKey);
  };

  const handleSaveUniver = async () => {
    if (!univerApiRef.current) {
      message.warning('设计器尚未就绪');
      return;
    }
    const ok = await univerApiRef.current.save();
    if (ok) {
      message.success(`「${layoutTypeName(univerLayoutType, layoutTypeNames)}」布局已保存`);
      loadLayoutTypeMeta(univerDesignNodeKey);
      setUniverModalOpen(false);
    }
  };

  const handleSave = async () => {
    if (!modeId) {
      message.warning('该表单尚未创建模块，无法保存');
      return;
    }
    setSaving(true);
    try {
      const cleanRights = modeRights.filter((r) => r.objid != null);
      const cleanAuths = fieldAuths.filter((a) => a.objid != null && a.fieldid != null);
      const cleanScopes = dataScopes.filter((s) => s.objid != null);
      await saveAllRights(modeId, {
        rights: cleanRights,
        fieldAuthorizes: fieldViewMode === 'field' ? cleanAuths : [],
        fieldGroups: fieldViewMode === 'subject' ? fieldGroups : [],
        dataScopes: cleanScopes,
        expectedVersion: rightVersion,
        grantMenuAccess: true,
        formId: String(formId),
        formMenuName,
        roleMenuNames,
        menuShares: menuShares.filter((s) => {
          if (!s.shareType) return false;
          if (s.shareType === 7) return true;
          if (s.shareType === 6) return s.showlevel != null || s.showlevel2 != null;
          return s.shareId != null && String(s.shareId) !== '';
        }).map((s) => ({
          ...s,
          shareId: s.shareType === 7 ? 0 : (s.shareId == null || s.shareId === '' ? undefined : Number(s.shareId)),
          includeSub: s.shareType === 3 ? Number(s.includeSub || 0) : 0,
          showlevel: s.shareType === 6 ? s.showlevel : undefined,
          showlevel2: s.shareType === 6 ? s.showlevel2 : undefined,
        })),
      });
      setRightVersion((v) => v + 1);
      message.success('权限配置已保存');
      onClose();
    } catch (e: any) {
      const msg = e?.message || e?.msg || '';
      if (msg.includes('版本') || msg.includes('他人') || msg.includes('修改')) {
        message.warning('权限配置已被他人修改，请关闭后重新打开再编辑');
        setRightVersion(await getRightVersion(modeId).catch(() => rightVersion));
      } else {
        message.error('保存失败');
      }
    } finally {
      setSaving(false);
    }
  };

  // 字段按归属分组：主表 + 明细表1..N。字段权限的 scope 由后端按 isMain/detailTable 派生，
  // 这里只在下拉里标注归属，避免用户把明细字段误当主表字段配置。
  const fieldOptions = (() => {
    const groups = new Map<string, { value: string; label: string }[]>();
    groups.set('主表', []);
    for (const f of fields) {
      const isDetail = f.isMain === 0 || (f.detailTable != null && f.detailTable > 0);
      const group = isDetail ? `明细表${f.detailTable ?? '?'}` : '主表';
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push({
        value: f.id,
        label: f.fieldLabel ? `${f.fieldLabel}(${f.fieldName})` : f.fieldName,
      });
    }
    return Array.from(groups.entries())
      .filter(([, opts]) => opts.length > 0)
      .map(([label, opts]) => ({ label, options: opts }));
  })();

  const rightColumns: ColumnsType<ModeRightInfo> = [
    {
      title: '授权对象类型',
      dataIndex: 'objtype',
      width: 150,
      render: (v, _r, i) => (
        <AuthObjectTypeSelect value={v} disabled={disabled}
          onChange={(x) => { updateRight(i, 'objtype', x); updateRight(i, 'objid', undefined); }} />
      ),
    },
    {
      title: '对象ID',
      dataIndex: 'objid',
      width: 200,
      render: (v, record, i) => (
        <AuthObjectPicker objtype={record.objtype ?? 1} multiple value={v == null ? [] : [v]} disabled={disabled}
          onChange={(ids) => expandModeRightObjects(i, ids as string[])} />
      ),
    },
    {
      title: '菜单显示名',
      dataIndex: 'menuName',
      width: 180,
      render: (_v, record) => {
        if (record.objtype !== 1 || record.objid == null) return <span style={{ color: '#bbb' }}>仅角色可配</span>;
        const key = String(record.objid);
        return (
          <Input
            size="small"
            placeholder="留空用默认名"
            value={roleMenuNames[key] || ''}
            onChange={(e) => setRoleMenuNames((prev) => ({ ...prev, [key]: e.target.value }))}
            disabled={disabled}
          />
        );
      },
    },
    {
      title: '权限类型',
      dataIndex: 'righttype',
      width: 150,
      render: (v, _r, i) => (
        <Select
          value={v}
          options={RIGHTTYPE_OPTS}
          onChange={(x) => updateRight(i, 'righttype', x)}
          style={{ width: 120 }}
          disabled={disabled}
        />
      ),
    },
    {
      title: '含子级',
      dataIndex: 'includesub',
      width: 90,
      render: (v, _r, i) => (
        <Switch checked={v === 1} onChange={(c) => updateRight(i, 'includesub', c ? 1 : 0)} disabled={disabled} />
      ),
    },
    {
      title: '密级下限',
      dataIndex: 'showlevel',
      width: 90,
      render: (v, _r, i) => (
        <InputNumber min={0} max={100} value={v ?? null} placeholder="不限"
          onChange={(x) => updateRight(i, 'showlevel', x == null ? undefined : Number(x))}
          disabled={disabled} style={{ width: 80 }} />
      ),
    },
    {
      title: '密级上限',
      dataIndex: 'showlevel2',
      width: 90,
      render: (v, _r, i) => (
        <InputNumber min={0} max={100} value={v ?? null} placeholder="不封顶"
          onChange={(x) => updateRight(i, 'showlevel2', x == null ? undefined : Number(x))}
          disabled={disabled} style={{ width: 80 }} />
      ),
    },
    {
      title: '操作',
      width: 80,
      render: (_v, _r, i) => (
        <Button danger type="link" size="small" icon={<DeleteOutlined />} onClick={() => removeRight(i)} disabled={disabled} />
      ),
    },
  ];

  const authColumns: ColumnsType<ModeFieldAuthorize> = [
    {
      title: '字段',
      dataIndex: 'fieldid',
      width: 240,
      render: (v, _r, i) => (
        <Select
          value={v}
          showSearch
          optionFilterProp="label"
          options={fieldOptions}
          onChange={(x) => updateAuth(i, 'fieldid', x)}
          style={{ width: 220 }}
          placeholder="选择字段"
          disabled={disabled}
        />
      ),
    },
    {
      title: '授权对象类型',
      dataIndex: 'objtype',
      width: 150,
      render: (v, _r, i) => (
        <AuthObjectTypeSelect value={v} disabled={disabled}
          onChange={(x) => { updateAuth(i, 'objtype', x); updateAuth(i, 'objid', undefined); }} />
      ),
    },
    {
      title: '对象ID',
      dataIndex: 'objid',
      width: 200,
      render: (v, record, i) => (
        <AuthObjectPicker objtype={record.objtype ?? 1} multiple value={v == null ? [] : [v]} disabled={disabled}
          onChange={(ids) => expandAuthObjects(i, ids as string[])} />
      ),
    },
    {
      title: '含子级',
      dataIndex: 'includesub',
      width: 80,
      render: (v, r, i) => (
        <Switch
          checked={v === 1}
          onChange={(c) => updateAuth(i, 'includesub', c ? 1 : 0)}
          disabled={disabled || r.objtype !== 2}
          title={r.objtype === 2 ? '授权部门含子部门' : '仅部门授权可配置'}
        />
      ),
    },
    {
      title: '权限',
      dataIndex: 'rightvalue',
      width: 130,
      render: (v, _r, i) => (
        <Select
          value={v}
          options={RIGHTVALUE_OPTS}
          onChange={(x) => updateAuth(i, 'rightvalue', x)}
          style={{ width: 110 }}
          disabled={disabled}
        />
      ),
    },
    {
      title: '操作',
      width: fieldConfigured && canExcelDesign ? 170 : 80,
      render: (_v, _r, i) => (
        <Space size={4}>
          {fieldConfigured && canExcelDesign && (
            <Button type="link" size="small" icon={<TableOutlined />} onClick={handleOpenExcelDesign}>Univer设计</Button>
          )}
          <Button danger type="link" size="small" icon={<DeleteOutlined />} onClick={() => removeAuth(i)} disabled={disabled} />
        </Space>
      ),
    },
  ];

  const scopeColumns: ColumnsType<ModeDataShareRule> = [
    {
      title: '权限类型',
      dataIndex: 'type',
      width: 140,
      render: (v, _r, i) => (
        <Select
          value={v}
          options={SCOPE_TYPE_OPTS}
          onChange={(x) => updateScope(i, 'type', x)}
          style={{ width: 110 }}
          disabled={disabled}
        />
      ),
    },
    {
      title: '授权对象类型',
      dataIndex: 'objtype',
      width: 150,
      render: (v, _r, i) => (
        <AuthObjectTypeSelect value={v} disabled={disabled}
          onChange={(x) => { updateScope(i, 'objtype', x); updateScope(i, 'objid', undefined); }} />
      ),
    },
    {
      title: '对象ID',
      dataIndex: 'objid',
      width: 200,
      render: (v, record, i) => (
        <AuthObjectPicker objtype={record.objtype ?? 1} multiple value={v == null ? [] : [v]} disabled={disabled}
          onChange={(ids) => expandScopeObjects(i, ids as string[])} />
      ),
    },
    {
      title: '含子级',
      dataIndex: 'includeSub',
      width: 90,
      render: (v, _r, i) => (
        <Switch checked={v === 1} onChange={(c) => updateScope(i, 'includeSub', c ? 1 : 0)} disabled={disabled} />
      ),
    },
    {
      title: '密级下限',
      dataIndex: 'showlevel',
      width: 90,
      render: (v, _r, i) => (
        <InputNumber min={0} max={100} value={v ?? null} placeholder="不限"
          onChange={(x) => updateScope(i, 'showlevel', x == null ? undefined : Number(x))}
          disabled={disabled} style={{ width: 80 }} />
      ),
    },
    {
      title: '密级上限',
      dataIndex: 'showlevel2',
      width: 90,
      render: (v, _r, i) => (
        <InputNumber min={0} max={100} value={v ?? null} placeholder="不封顶"
          onChange={(x) => updateScope(i, 'showlevel2', x == null ? undefined : Number(x))}
          disabled={disabled} style={{ width: 80 }} />
      ),
    },
    {
      title: '仅本人创建可见',
      dataIndex: 'creatorSelf',
      width: 130,
      render: (v, _r, i) => (
        <Switch checked={v === 1} onChange={(c) => updateScope(i, 'creatorSelf', c ? 1 : 0)} disabled={disabled} />
      ),
    },
    {
      title: '条件授权',
      dataIndex: 'conditionEnabled',
      width: 90,
      render: (v, _r, i) => (
        <Switch checked={v === 1} onChange={(c) => updateScope(i, 'conditionEnabled', c ? 1 : 0)} disabled={disabled} />
      ),
    },
    {
      title: '条件字段',
      dataIndex: 'conditionField',
      width: 130,
      render: (v, _r, i) => (
        <Input
          value={v ?? ''}
          placeholder="数据库列名"
          onChange={(e) => updateScope(i, 'conditionField', e.target.value)}
          disabled={disabled || _r.conditionEnabled !== 1}
          size="small"
        />
      ),
    },
    {
      title: '操作符',
      dataIndex: 'conditionOp',
      width: 110,
      render: (v, _r, i) => (
        <Select
          value={v ?? 'eq'}
          options={CONDITION_OP_OPTS}
          onChange={(x) => updateScope(i, 'conditionOp', x)}
          disabled={disabled || _r.conditionEnabled !== 1}
          size="small"
          style={{ width: 100 }}
        />
      ),
    },
    {
      title: '条件值',
      dataIndex: 'conditionValue',
      width: 140,
      render: (v, _r, i) => (
        <Input
          value={v ?? ''}
          placeholder="in 用逗号分隔"
          onChange={(e) => updateScope(i, 'conditionValue', e.target.value)}
          disabled={disabled || _r.conditionEnabled !== 1}
          size="small"
        />
      ),
    },
    {
      title: '矩阵结果字段',
      dataIndex: 'matrixValueField',
      width: 130,
      render: (v, r, i) => (
        <MatrixValueFieldSelect
          matrixId={r.objtype === 7 ? Number(r.objid) : undefined}
          value={v}
          disabled={disabled || r.objtype !== 7}
          onChange={(x) => updateScope(i, 'matrixValueField', x)}
        />
      ),
    },
    {
      title: '操作',
      width: 80,
      render: (_v, _r, i) => (
        <Button danger type="link" size="small" icon={<DeleteOutlined />} onClick={() => removeScope(i)} disabled={disabled} />
      ),
    },
  ];


  // ===== 按授权对象组配置字段权限：一组对象共享一份字段权限 =====
  const makeGroupKey = () => {
    const rand = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    return `field-group-${rand}`;
  };

  const addFieldGroup = () => setFieldGroups((prev) => [
    ...prev,
    {
      groupKey: makeGroupKey(),
      groupName: '授权对象组' + (prev.length + 1),
      subjects: [],
      fields: [],
    },
  ]);

  const updateFieldGroup = (idx: number, patch: Partial<FieldAuthGroupVO>) =>
    setFieldGroups((prev) => prev.map((g, i) => i === idx ? { ...g, ...patch } : g));

  const removeFieldGroup = (idx: number) => setFieldGroups((prev) => prev.filter((_, i) => i !== idx));

  const openGroupFieldModal = (idx: number) => {
    setFieldModalGroupIndex(idx);
    setFieldModalSearch('');
    setFieldModalScope('main');
    setFieldModalSelected((fieldGroups[idx]?.fields || []).map((f) => Number(f.fieldId)));
  };

  const activeGroup = fieldModalGroupIndex == null ? null : fieldGroups[fieldModalGroupIndex];

  const getGroupFieldRight = (fieldId: number): 0 | 1 | 2 | undefined => {
    if (!activeGroup) return undefined;
    const hit = (activeGroup.fields || []).find((f) => Number(f.fieldId) === Number(fieldId));
    return hit?.rightvalue;
  };

  const setGroupFieldRight = (fieldId: number, rightvalue?: 0 | 1 | 2) => {
    if (fieldModalGroupIndex == null) return;
    setFieldModalSelected((prev) => rightvalue == null
      ? prev.filter((id) => Number(id) !== Number(fieldId))
      : (prev.some((id) => Number(id) === Number(fieldId)) ? prev : [...prev, Number(fieldId)]));
    setFieldGroups((prev) => prev.map((g, i) => {
      if (i !== fieldModalGroupIndex) return g;
      const rest = (g.fields || []).filter((f) => Number(f.fieldId) !== Number(fieldId));
      return { ...g, fields: rightvalue == null ? rest : [...rest, { fieldId, rightvalue }] };
    }));
  };

  // 勾选/取消勾选字段 = 加入/移出当前授权对象组
  const setGroupSelectedFields = (ids: number[]) => {
    if (fieldModalGroupIndex == null) return;
    const selected = Array.from(new Set(ids.map(Number)));
    setFieldModalSelected(selected);
    setFieldGroups((prev) => prev.map((g, i) => {
      if (i !== fieldModalGroupIndex) return g;
      const selectedSet = new Set(selected);
      const kept = (g.fields || []).filter((f) => selectedSet.has(Number(f.fieldId)));
      const keptIds = new Set(kept.map((f) => Number(f.fieldId)));
      const added = selected
        .filter((id) => !keptIds.has(id))
        .map((id) => ({ fieldId: id, rightvalue: 1 as const }));
      return { ...g, fields: [...kept, ...added] };
    }));
  };

  // 只替换某个主表/明细表页签内的勾选，避免切换页签后清掉其它表的字段
  const replaceScopeSelection = (scope: string, ids: number[]) => {
    const scopeIds = new Set(sortedConfigFields
      .filter((f) => fieldScopeOf(f) === scope)
      .map((f) => Number(f.id)));
    const others = fieldModalSelected.filter((id) => !scopeIds.has(Number(id)));
    setGroupSelectedFields([...others, ...ids.map(Number)]);
  };

  const groupColumns: ColumnsType<FieldAuthGroupVO> = [
    {
      title: '组名称',
      dataIndex: 'groupName',
      width: 160,
      render: (v, _r, i) => (
        <Input size="small" value={v || ''} disabled={disabled}
          onChange={(e) => updateFieldGroup(i, { groupName: e.target.value })} />
      ),
    },
    {
      title: '授权对象类型',
      key: 'objtype',
      width: 150,
      render: (_v, r, i) => {
        const objtype = r.subjects?.[0]?.objtype ?? 1;
        return <AuthObjectTypeSelect value={objtype} disabled={disabled}
          onChange={(x) => {
            const current = r.subjects || [];
            const next = current.length
              ? current.map((s) => ({ ...s, objtype: x, objid: '' }))
              : [{ objtype: x, objid: '', includesub: 0 }];
            updateFieldGroup(i, { subjects: next });
          }} />;
      },
    },
    {
      title: '授权对象（多选）',
      key: 'subjects',
      width: 260,
      render: (_v, r, i) => {
        const objtype = r.subjects?.[0]?.objtype ?? 1;
        return (
          <AuthObjectPicker
            objtype={objtype}
            multiple
            value={(r.subjects || []).filter((s) => s.objid !== '').map((s) => s.objid)}
            disabled={disabled}
            onChange={(ids) => {
              const list = (Array.isArray(ids) ? ids : []).map(String).filter(Boolean);
              const includesub = r.subjects?.[0]?.includesub ?? 0;
              updateFieldGroup(i, { subjects: list.map((id) => ({ objtype, objid: id, includesub })) });
            }}
          />
        );
      },
    },
    {
      title: '含子级',
      key: 'includesub',
      width: 90,
      render: (_v, r, i) => {
        const includesub = r.subjects?.[0]?.includesub ?? 0;
        return (
          <Switch size="small" checked={Number(includesub) === 1} disabled={disabled || (r.subjects?.[0]?.objtype ?? 1) !== 2}
            onChange={(c) => updateFieldGroup(i, { subjects: (r.subjects || []).map((s) => ({ ...s, includesub: c ? 1 : 0 })) })} />
        );
      },
    },
    {
      title: '已配置字段',
      key: 'fieldCount',
      width: 110,
      render: (_v, r) => <Tag color={(r.fields || []).length ? 'blue' : 'default'}>{(r.fields || []).length} 个</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: fieldConfigured && canExcelDesign ? 260 : 170,
      render: (_v, _r, i) => (
        <Space size={4}>
          <Button type="link" size="small" disabled={disabled} onClick={() => openGroupFieldModal(i)}>配置字段</Button>
          {fieldConfigured && canExcelDesign && (
            <Button type="link" size="small" icon={<TableOutlined />} onClick={() => handleOpenExcelDesign(fieldGroups[i])}>Univer设计</Button>
          )}
          <Button danger type="link" size="small" disabled={disabled} onClick={() => removeFieldGroup(i)}>删除</Button>
        </Space>
      ),
    },
  ];

  const fieldScopeOf = (f: FieldDefinition) => {
    const dt = Number(f.detailTable || 0);
    // 与后端 scopeOfField 对齐：isMain=1 或 detailTable<=0 都归主表
    return Number(f.isMain) === 1 || dt <= 0 ? 'main' : `dt${dt}`;
  };
  const fieldScopeLabel = (scope: string) => scope === 'main' ? '主表' : scope.replace('dt', '明细表');
  const fieldScopeRank = (scope: string) => scope === 'main' ? 0 : (Number(scope.replace('dt', '')) || 9999);

  // 字段按「主表 → 明细表1 → 明细表2 → ...」分组，组内按 fieldOrder 排序
  const sortedConfigFields = useMemo(() => [...fields].sort((a, b) => {
    const sa = fieldScopeOf(a), sb = fieldScopeOf(b);
    const rank = fieldScopeRank(sa) - fieldScopeRank(sb);
    if (rank !== 0) return rank;
    const oa = Number(a.fieldOrder ?? 0), ob = Number(b.fieldOrder ?? 0);
    if (oa !== ob) return oa - ob;
    return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
  }), [fields]);

  const fieldScopeTabs = useMemo(() => {
    const scopeSet = new Set(sortedConfigFields.map(fieldScopeOf));
    if (!scopeSet.size) scopeSet.add('main');
    return Array.from(scopeSet)
      .sort((a, b) => fieldScopeRank(a) - fieldScopeRank(b))
      .map((scope) => ({
        value: scope,
        label: `${fieldScopeLabel(scope)}（${sortedConfigFields.filter((f) => fieldScopeOf(f) === scope).length}）`,
      }));
  }, [sortedConfigFields]);

  const modalFieldRows = useMemo(() => sortedConfigFields.filter((f) => {
    const kw = fieldModalSearch.trim().toLowerCase();
    const scopeOk = fieldScopeOf(f) === fieldModalScope;
    return scopeOk && (!kw
      || String(f.fieldName).toLowerCase().includes(kw)
      || String(f.fieldLabel || '').toLowerCase().includes(kw));
  }), [sortedConfigFields, fieldModalSearch, fieldModalScope]);

  const modalFieldColumns: ColumnsType<FieldDefinition> = [
    {
      title: '字段归属',
      key: 'scope',
      width: 100,
      render: (_v, record) => <Tag>{fieldScopeLabel(fieldScopeOf(record))}</Tag>,
    },
    { title: '字段名', dataIndex: 'fieldName', width: 150 },
    { title: '字段名称', dataIndex: 'fieldLabel', width: 180 },
    { title: '字段ID', dataIndex: 'id', width: 100 },
    {
      title: '权限',
      key: 'rightvalue',
      width: 160,
      render: (_v, record) => (
        <Select size="small" style={{ width: 130 }} value={getGroupFieldRight(Number(record.id))}
          onChange={(rv) => setGroupFieldRight(Number(record.id), rv == null ? undefined : Number(rv) as 0 | 1 | 2)}
          options={[
            { value: undefined, label: '未设置' },
            { value: 0, label: '隐藏' },
            { value: 1, label: '只读' },
            { value: 2, label: '可编辑' },
          ]} />
      ),
    },
  ];

  const groupFieldModal = (
    <Modal title={'配置字段权限 - ' + (activeGroup?.groupName || '授权对象组')}
      open={fieldModalGroupIndex != null} onCancel={() => setFieldModalGroupIndex(null)}
      onOk={() => setFieldModalGroupIndex(null)} okText="完成"
      width="min(1100px, calc(100vw - 48px))"
      style={{ top: 12 }}
      bodyStyle={{ height: 'calc(100vh - 150px)', padding: 0, overflow: 'hidden' }}
      styles={{ body: { height: 'calc(100vh - 150px)', padding: 0, overflow: 'hidden' } }}>
      <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
        <div style={{ width: 190, minWidth: 190, borderRight: '1px solid #f0f0f0', overflow: 'auto', padding: 8 }}>
          <div style={{ color: '#999', fontSize: 12, margin: '4px 4px 8px' }}>表列表</div>
          {fieldScopeTabs.map((tab) => (
            <Button
              key={tab.value}
              type={fieldModalScope === tab.value ? 'primary' : 'text'}
              block
              style={{ textAlign: 'left', marginBottom: 4 }}
              onClick={() => setFieldModalScope(tab.value)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: 12 }}>
          <Space wrap style={{ marginBottom: 8 }}>
            <Input.Search allowClear size="small" style={{ width: 240 }} placeholder="搜索当前表字段"
              value={fieldModalSearch} onChange={(e) => setFieldModalSearch(e.target.value)} />
            <Button size="small" onClick={() => replaceScopeSelection(
              fieldModalScope,
              sortedConfigFields.filter((f) => fieldScopeOf(f) === fieldModalScope).map((f) => Number(f.id)),
            )}>全选当前表</Button>
            <Button size="small" onClick={() => replaceScopeSelection(fieldModalScope, [])}>清空当前表</Button>
            <Select size="small" style={{ width: 140 }} placeholder="批量设置"
              options={[{ value: 0, label: '隐藏' }, { value: 1, label: '只读' }, { value: 2, label: '可编辑' }]}
              onChange={(rv) => {
                if (!fieldModalSelected.length) {
                  message.warning('请先勾选要设置的字段');
                  return;
                }
                fieldModalSelected.forEach((id) => setGroupFieldRight(Number(id), Number(rv) as 0 | 1 | 2));
              }} />
            <span style={{ color: '#999', fontSize: 12 }}>勾选字段即加入当前组，取消勾选即移出；默认只读</span>
          </Space>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <Table
              rowKey={(r) => String(r.id)}
              size="small"
              columns={modalFieldColumns}
              dataSource={modalFieldRows}
              pagination={false}
              scroll={{ y: 'calc(100vh - 300px)' }}
              rowSelection={{
                selectedRowKeys: fieldModalSelected.map(String),
                onChange: (keys) => replaceScopeSelection(fieldModalScope, keys.map(Number)),
              }}
            />
          </div>
        </div>
      </div>
    </Modal>
  );

  // 菜单可见范围：复用通用授权对象类型常量，并补充安全级别/全员
  const MENU_SHARE_TYPE_OPTIONS = [
    ...AUTH_OBJECT_TYPE_OPTIONS
      .filter((o) => [1, 2, 3, 4, 5].includes(Number(o.value)))
      .map((o) => {
        const authType = Number(o.value);
        const map: Record<number, number> = { 1: 1, 4: 2, 2: 3, 5: 4, 3: 5 };
        return { value: map[authType], label: o.label };
      }),
    { value: 6, label: '安全级别' },
    { value: 7, label: '全员' },
  ];
  const SHARE_TYPE_TO_AUTH_TYPE: Record<number, number> = { 1: 1, 2: 4, 3: 2, 4: 5, 5: 3 };
  const AUTH_TYPE_TO_SHARE_TYPE: Record<number, number> = { 1: 1, 4: 2, 2: 3, 5: 4, 3: 5 };
  const updateMenuShare = (idx: number, patch: Partial<MenuShare>) =>
    setMenuShares((prev) => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  const removeMenuShare = (idx: number) => setMenuShares((prev) => prev.filter((_, i) => i !== idx));
  const addMenuShare = () => setMenuShares((prev) => [...prev, { shareType: 1, shareId: undefined, includeSub: 0 }]);

  const menuShareColumns: ColumnsType<MenuShare> = [
    {
      title: '可见类型',
      key: 'shareType',
      width: 150,
      render: (_v, r, i) => (
        <Select size="small" style={{ width: 130 }} value={r.shareType}
          options={MENU_SHARE_TYPE_OPTIONS}
          disabled={disabled}
          onChange={(v) => updateMenuShare(i, {
            shareType: Number(v),
            shareId: undefined,
            includeSub: 0,
            showlevel: undefined,
            showlevel2: undefined,
          })} />
      ),
    },
    {
      title: '可见对象',
      key: 'subject',
      render: (_v, r, i) => {
        if (r.shareType === 6) {
          return (
            <Space size={4}>
              <InputNumber size="small" min={0} max={100} placeholder="下限" value={r.showlevel ?? null}
                disabled={disabled} onChange={(v) => updateMenuShare(i, { showlevel: v == null ? undefined : Number(v) })} />
              <span>~</span>
              <InputNumber size="small" min={0} max={100} placeholder="上限" value={r.showlevel2 ?? null}
                disabled={disabled} onChange={(v) => updateMenuShare(i, { showlevel2: v == null ? undefined : Number(v) })} />
            </Space>
          );
        }
        if (r.shareType === 7) return <Tag color="green">所有登录用户</Tag>;
        const authType = SHARE_TYPE_TO_AUTH_TYPE[Number(r.shareType)];
        if (!authType) return null;
        return (
          <AuthObjectPicker
            objtype={authType}
            value={r.shareId ? String(r.shareId) : undefined}
            disabled={disabled}
            onChange={(v) => {
              const first = Array.isArray(v) ? v[0] : v;
              updateMenuShare(i, { shareId: first == null ? undefined : String(first) });
            }}
          />
        );
      },
    },
    {
      title: '含子级',
      key: 'includeSub',
      width: 80,
      render: (_v, r, i) => r.shareType === 3 ? (
        <Switch size="small" checked={r.includeSub === 1} disabled={disabled}
          onChange={(c) => updateMenuShare(i, { includeSub: c ? 1 : 0 })} />
      ) : null,
    },
    {
      title: '操作',
      key: 'action',
      width: 70,
      render: (_v, _r, i) => (
        <Button danger type="link" size="small" icon={<DeleteOutlined />} disabled={disabled} onClick={() => removeMenuShare(i)} />
      ),
    },
  ];

  const tabItems = [
    {
      key: 'right',
      label: '模块权限',
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 100, color: '#666' }}>表单数据菜单名</span>
            <Input
              size="small"
              style={{ width: 260 }}
              placeholder="留空则使用表单名+数据"
              value={formMenuName}
              onChange={(e) => setFormMenuName(e.target.value)}
              disabled={disabled}
            />
            <span style={{ color: '#999', fontSize: 12 }}>
              保存后创建/更新该表单专属菜单，路径 /formmode/formview/{formId}
            </span>
          </div>
          <div>
            <div style={{ marginBottom: 6, color: '#666', fontSize: 13 }}>菜单可见范围（不配则默认仅按模块权限中的角色授权）</div>
            <Table rowKey={(_, i) => 'ms-' + i} size="small" columns={menuShareColumns}
              dataSource={menuShares} pagination={false} locale={{ emptyText: '未配置菜单可见范围' }} />
            <Button type="dashed" icon={<PlusOutlined />} onClick={addMenuShare} disabled={disabled} block style={{ marginTop: 8 }}>
              新增菜单可见范围
            </Button>
          </div>
          <Button type="dashed" icon={<PlusOutlined />} onClick={addRight} disabled={disabled} block>
            新增模块权限
          </Button>
          <Table
            rowKey={(_, i) => `r-${i}`}
            columns={rightColumns}
            dataSource={modeRights}
            pagination={false}
            size="small"
            locale={{ emptyText: '暂无配置' }}
          />
        </Space>
      ),
    },
    {
      key: 'field',
      label: '字段权限',
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Select size="small" style={{ width: 180 }} value={fieldViewMode}
            options={[{ value: 'subject', label: '按主体配置' }, { value: 'field', label: '按字段明细' }]}
            onChange={(v) => setFieldViewMode(v)} />
          {fieldConfigured && canExcelDesign && (
            <Button type="primary" icon={<TableOutlined />} onClick={handleOpenExcelDesign}>
              配置新增/编辑页面（Univer Excel 设计）
            </Button>
          )}
          {fieldViewMode === 'subject' ? (
            <>
              <Button type="dashed" icon={<PlusOutlined />} onClick={addFieldGroup} disabled={disabled} block>
                新增授权对象组
              </Button>
              <Table rowKey={(_, i) => 'g-' + i} size="small" columns={groupColumns}
                dataSource={fieldGroups} pagination={false} locale={{ emptyText: '暂无配置' }} />
            </>
          ) : (
            <>
              <Button type="dashed" icon={<PlusOutlined />} onClick={addAuth} disabled={disabled} block>
                新增字段权限
              </Button>
              <Table rowKey={(_, i) => `f-${i}`} columns={authColumns} dataSource={fieldAuths}
                pagination={false} size="small" scroll={{ x: 810 }} locale={{ emptyText: '暂无配置' }} />
            </>
          )}
        </Space>
      ),
    },
    {
      key: 'scope',
      label: '数据范围',
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Button type="dashed" icon={<PlusOutlined />} onClick={addScope} disabled={disabled} block>
            新增数据范围
          </Button>
          <Table
            rowKey={(_, i) => `s-${i}`}
            columns={scopeColumns}
            dataSource={dataScopes}
            pagination={false}
            size="small"
            scroll={{ x: 1360 }}
            locale={{ emptyText: '暂无配置' }}
          />
        </Space>
      ),
    },
  ];

  return (
    <Drawer
      title="权限配置"
      width={920}
      open={open}
      onClose={onClose}
      destroyOnHidden
      extra={
        <Button type="primary" onClick={handleSave} loading={saving} disabled={disabled}>
          保存
        </Button>
      }
    >
      {disabled && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="该表单尚未创建模块（modeinfo）"
          description="权限以模块为单位配置。请先为该表单创建模块（通常在流程/建模中绑定），再回来配置权限。"
        />
      )}
      <Tabs items={tabItems} />
      {modeId != null && (
        <div style={{ marginTop: 12 }}>
          <Tag color="blue">模块ID：{modeId}</Tag>
        </div>
      )}
    <Modal
      title={`Univer设计 - ${formName || formId || ''} - ${layoutTypeName(univerLayoutType, layoutTypeNames)}`}
      open={univerModalOpen}
      onCancel={() => setUniverModalOpen(false)}
      afterClose={() => { univerApiRef.current = null; }}
      width="min(1500px, calc(100vw - 48px))"
      style={{ top: 12, maxWidth: 'calc(100vw - 48px)' }}
      bodyStyle={{ height: 'calc(100vh - 150px)', padding: 0, overflow: 'hidden' }}
      styles={{ body: { height: 'calc(100vh - 150px)', padding: 0, overflow: 'hidden' } }}
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={() => setUniverModalOpen(false)}>取消</Button>
          <Button type="primary" onClick={handleSaveUniver}>保存「{layoutTypeName(univerLayoutType, layoutTypeNames)}」布局</Button>
        </Space>
      }
    >
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
          <Space wrap size={4}>
            {LAYOUT_TYPES.map((t) => (
              <Button
                key={t.value}
                size="small"
                type={univerLayoutType === t.value ? 'primary' : 'default'}
                onClick={() => setUniverLayoutType(t.value)}
              >
                {layoutTypeName(t.value, layoutTypeNames)}{configuredLayoutTypes.has(t.value) ? ' •' : ''}
              </Button>
            ))}
            <Button size="small" icon={<EditOutlined />} onClick={() => {
              setLayoutNameEditing(univerLayoutType);
              setLayoutNameDraft(layoutTypeName(univerLayoutType, layoutTypeNames));
            }}>改名</Button>
            <Button size="small" icon={<SyncOutlined />} onClick={() => openSyncModal('groups')}
              disabled={!formId || fieldGroups.length < 2}>同步到其他组</Button>
            <Button size="small" icon={<SyncOutlined />} onClick={() => openSyncModal('types')}
              disabled={!formId}>同步到其他布局类型</Button>
          </Space>
          {layoutNameEditing != null && (
            <Space style={{ marginTop: 8 }}>
              <Input size="small" style={{ width: 220 }} value={layoutNameDraft}
                onChange={(e) => setLayoutNameDraft(e.target.value)}
                onPressEnter={() => handleSaveLayoutTypeName(layoutNameEditing)} />
              <Button size="small" type="primary" onClick={() => handleSaveLayoutTypeName(layoutNameEditing)}>保存名称</Button>
              <Button size="small" onClick={() => setLayoutNameEditing(null)}>取消</Button>
            </Space>
          )}
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <ExcelDesign
            embedded
            formId={formId}
            formName={formName}
            nodeKey={univerDesignNodeKey}
            allowedFieldIds={univerDesignFieldIds}
            layoutType={univerLayoutType}
            hideLayoutTypeSelect
            onReady={(api) => { univerApiRef.current = api; }}
          />
        </div>
      </div>
    </Modal>
    <Modal
      title={syncMode === 'groups' ? '同步布局到同表单其他组' : '同步布局到其他布局类型'}
      open={syncModalOpen}
      onCancel={() => setSyncModalOpen(false)}
      onOk={handleSyncLayout}
      okText="确认同步"
      cancelText="取消"
      destroyOnHidden
    >
      <div style={{ marginBottom: 8, color: '#666' }}>
        源布局：{layoutTypeName(univerLayoutType, layoutTypeNames)}（{univerDesignNodeKey || '表单级通用'}）
      </div>
      {syncMode === 'groups' ? (
        <Checkbox.Group
          value={syncTargetNodes}
          onChange={(v) => setSyncTargetNodes(v.map(String))}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          options={fieldGroups
            .filter((g) => (g.groupKey || `group-${g.id || ''}`) !== univerDesignNodeKey)
            .map((g) => ({
              value: g.groupKey || `group-${g.id || ''}`,
              label: `${g.groupName || '未命名组'}（${g.groupKey || g.id || ''}）`,
            }))}
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
    {groupFieldModal}
    </Drawer>
  );
};

export default FormRightDrawer;
