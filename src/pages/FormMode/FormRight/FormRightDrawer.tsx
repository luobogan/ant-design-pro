import React, { useEffect, useMemo, useState } from 'react';
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
  Tabs,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
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
} from '@/services/formmode/rightApi';
import { fieldApi } from '@/services/formmode';
import type { FieldDefinition } from '@/services/formmode/typings';
import * as matrixApi from '@/pages/System/Matrix/service';
import AuthObjectPicker, { AUTH_OBJECT_TYPE_OPTIONS, AuthObjectTypeSelect } from '@/components/FormMode/AuthObjectPicker';

interface Props {
  /** 表单ID（workflow_bill.id）；权限按反查出的 modeId 落库 */
  formId?: string;
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

const FormRightDrawer: React.FC<Props> = ({ formId, open, onClose }) => {
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
  const [fieldModalSelected, setFieldModalSelected] = useState<number[]>([]);
  // 方案C：单个表单的数据菜单名 + 角色级显示名
  const [formMenuName, setFormMenuName] = useState<string>('');
  const [roleMenuNames, setRoleMenuNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !formId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFormMenuName('');
      setRoleMenuNames({});
      try {
        const [mid, flds] = await Promise.all([
          resolveModeId(formId),
          fieldApi.getByFormId(formId).catch(() => [] as FieldDefinition[]),
        ]);
        if (cancelled) return;
        setModeId(mid);
        setFields(flds || []);
        if (mid) {
          const [mr, fa, fg, ds, ver] = await Promise.all([
            getModeRights(mid),
            getFieldAuthorizes(mid),
            getFieldAuthGroups(mid),
            getModeDataScopes(mid),
            getRightVersion(mid),
          ]);
          if (cancelled) return;
          setModeRights(mr || []);
          setFieldAuths(fa || []);
          setFieldGroups(fg || []);
          setDataScopes(ds || []);
          setRightVersion(ver || 0);
        } else {
          setModeRights([]);
          setFieldAuths([]);
          setDataScopes([]);
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
  const toIds = (v?: number | number[]): number[] => Array.isArray(v) ? v.map(Number) : (v == null ? [] : [Number(v)]);

  const expandModeRightObjects = (index: number, values?: number | number[]) => {
    const ids = toIds(values).filter(Number.isFinite);
    setModeRights((prev) => {
      const row = prev[index];
      if (!row) return prev;
      if (!ids.length) return prev.map((r, i) => i === index ? { ...r, objid: undefined } : r);
      const rest = prev.filter((_, i) => i !== index);
      return [...rest, ...ids.map((id) => ({ ...row, objid: id }))];
    });
  };

  const expandAuthObjects = (index: number, values?: number | number[]) => {
    const ids = toIds(values).filter(Number.isFinite);
    setFieldAuths((prev) => {
      const row = prev[index];
      if (!row) return prev;
      if (!ids.length) return prev.map((a, i) => i === index ? { ...a, objid: undefined } : a);
      const rest = prev.filter((_, i) => i !== index);
      return [...rest, ...ids.map((id) => ({ ...row, id: undefined, objid: id } as ModeFieldAuthorize))];
    });
  };

  const expandScopeObjects = (index: number, values?: number | number[]) => {
    const ids = toIds(values).filter(Number.isFinite);
    setDataScopes((prev) => {
      const row = prev[index];
      if (!row) return prev;
      if (!ids.length) return prev.map((r, i) => i === index ? { ...r, objid: undefined } : r);
      const rest = prev.filter((_, i) => i !== index);
      return [...rest, ...ids.map((id) => ({ ...row, id: undefined, objid: id } as ModeDataShareRule))];
    });
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
          onChange={(ids) => expandModeRightObjects(i, ids as number[])} />
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
          onChange={(ids) => expandAuthObjects(i, ids as number[])} />
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
      width: 80,
      render: (_v, _r, i) => (
        <Button danger type="link" size="small" icon={<DeleteOutlined />} onClick={() => removeAuth(i)} disabled={disabled} />
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
          onChange={(ids) => expandScopeObjects(i, ids as number[])} />
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
  const addFieldGroup = () => setFieldGroups((prev) => [
    ...prev,
    { groupName: '授权对象组' + (prev.length + 1), subjects: [], fields: [] },
  ]);

  const updateFieldGroup = (idx: number, patch: Partial<FieldAuthGroupVO>) =>
    setFieldGroups((prev) => prev.map((g, i) => i === idx ? { ...g, ...patch } : g));

  const removeFieldGroup = (idx: number) => setFieldGroups((prev) => prev.filter((_, i) => i !== idx));

  const openGroupFieldModal = (idx: number) => {
    setFieldModalGroupIndex(idx);
    setFieldModalSearch('');
    setFieldModalSelected([]);
  };

  const activeGroup = fieldModalGroupIndex == null ? null : fieldGroups[fieldModalGroupIndex];

  const getGroupFieldRight = (fieldId: number): 0 | 1 | 2 | undefined => {
    if (!activeGroup) return undefined;
    const hit = (activeGroup.fields || []).find((f) => Number(f.fieldId) === Number(fieldId));
    return hit?.rightvalue;
  };

  const setGroupFieldRight = (fieldId: number, rightvalue?: 0 | 1 | 2) => {
    if (fieldModalGroupIndex == null) return;
    setFieldGroups((prev) => prev.map((g, i) => {
      if (i !== fieldModalGroupIndex) return g;
      const rest = (g.fields || []).filter((f) => Number(f.fieldId) !== Number(fieldId));
      return { ...g, fields: rightvalue == null ? rest : [...rest, { fieldId, rightvalue }] };
    }));
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
      width: 170,
      render: (_v, _r, i) => (
        <Space size={4}>
          <Button type="link" size="small" disabled={disabled || !(fieldGroups[i]?.subjects || []).length} onClick={() => openGroupFieldModal(i)}>配置字段</Button>
          <Button danger type="link" size="small" disabled={disabled} onClick={() => removeFieldGroup(i)}>删除</Button>
        </Space>
      ),
    },
  ];

  const modalFieldRows = useMemo(() => fields.filter((f) => {
    const kw = fieldModalSearch.trim().toLowerCase();
    return !kw || String(f.fieldName).toLowerCase().includes(kw) || String(f.fieldLabel || '').toLowerCase().includes(kw);
  }), [fields, fieldModalSearch]);

  const modalFieldColumns: ColumnsType<FieldDefinition> = [
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
      onOk={() => setFieldModalGroupIndex(null)} okText="完成" width={900}>
      <Space wrap style={{ marginBottom: 8 }}>
        <Input.Search allowClear size="small" style={{ width: 240 }} placeholder="搜索字段"
          value={fieldModalSearch} onChange={(e) => setFieldModalSearch(e.target.value)} />
        <Button size="small" onClick={() => setFieldModalSelected(modalFieldRows.map((f) => Number(f.id)))}>全选</Button>
        <Button size="small" onClick={() => setFieldModalSelected([])}>清空</Button>
        <Select size="small" style={{ width: 140 }} placeholder="批量设置"
          options={[{ value: 0, label: '隐藏' }, { value: 1, label: '只读' }, { value: 2, label: '可编辑' }]}
          onChange={(rv) => {
            const ids = fieldModalSelected.length ? fieldModalSelected : modalFieldRows.map((f) => Number(f.id));
            ids.forEach((id) => setGroupFieldRight(id, Number(rv) as 0 | 1 | 2));
          }} />
      </Space>
      <Table rowKey={(r) => String(r.id)} size="small" columns={modalFieldColumns}
        dataSource={modalFieldRows} pagination={false} scroll={{ y: 420 }}
        rowSelection={{ selectedRowKeys: fieldModalSelected.map(String), onChange: (keys) => setFieldModalSelected(keys.map(Number)) }} />
    </Modal>
  );

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
    {groupFieldModal}
    </Drawer>
  );
};

export default FormRightDrawer;
