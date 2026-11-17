import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Drawer,
  Input,
  message,
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
  resolveModeId,
  saveAllRights,
  getRightVersion,
} from '@/services/formmode/rightApi';
import { fieldApi } from '@/services/formmode';
import type { FieldDefinition } from '@/services/formmode/typings';
import {
  itemsOfCategory,
  loadPersonOrgData,
  queryUsers,
  resolveItemNames,
} from '@/components/FormMode/personOrg';
import type { PersonOrgCategory, PersonOrgItem } from '@/components/FormMode/personOrg';

interface Props {
  /** 表单ID（workflow_bill.id）；权限按反查出的 modeId 落库 */
  formId?: string;
  open: boolean;
  onClose: () => void;
}

// objtype 编码已统一为 moderightinfo/modefieldauthorize 规范：1角色 2部门 3岗位 4人员
//（modedatasharerule 历史编码 1人员2部门3角色4岗位 已由 V2026.10.20_005 迁移 + 引擎对齐，三处一致）
const OBJTYPE_OPTS = [
  { value: 1, label: '角色' },
  { value: 2, label: '部门' },
  { value: 3, label: '岗位' },
  { value: 4, label: '人员' },
  { value: 5, label: '分部' },
  { value: 7, label: '矩阵' },
];
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

// objtype（统一编码 1角色2部门3岗位4人员）→ personOrg 类别
const OBJTYPE_TO_CATEGORY: Record<number, PersonOrgCategory> = {
  1: 'role',
  2: 'dept',
  3: 'post',
  4: 'hrm',
  5: 'branch',
  // 7=矩阵：objid 为矩阵ID，用现有 role 选择器近似（矩阵列表暂无独立浏览按钮）
  7: 'role',
};
const CATEGORY_PLACEHOLDER: Record<number, string> = {
  1: '选择角色',
  2: '选择部门',
  3: '选择岗位',
  4: '选择人员',
  5: '选择分部',
  7: '选择矩阵',
};

/**
 * 授权对象选择器：按 objtype 切换 角色/部门/岗位/人员。
 * - 角色/部门/岗位：loadPersonOrgData 内存缓存（一次性加载，本地过滤）
 * - 人员：queryUsers 服务端分页搜索
 * - 已选值名称经 resolveItemNames 反查，保证回显（懒加载/切换类别后 options 未含该值时）
 */
const ObjPicker: React.FC<{
  objtype: number;
  value?: number;
  disabled?: boolean;
  onChange: (v?: number) => void;
}> = ({ objtype, value, disabled, onChange }) => {
  const category = OBJTYPE_TO_CATEGORY[objtype];
  const isHrm = category === 'hrm';
  const [baseOptions, setBaseOptions] = useState<{ value: number; label: string }[]>([]);
  const [selectedName, setSelectedName] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const toOpts = (list: PersonOrgItem[]) => list.map((i) => ({ value: Number(i.id), label: i.name }));

  // 组织类（角色/部门/岗位）：一次性加载候选
  useEffect(() => {
    if (!category || isHrm) return;
    let cancelled = false;
    loadPersonOrgData()
      .then((data) => {
        if (!cancelled) setBaseOptions(toOpts(itemsOfCategory(data, category)));
      })
      .catch(() => {
        if (!cancelled) setBaseOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [category, isHrm]);

  // 人员：首次加载首页
  useEffect(() => {
    if (!isHrm) return;
    let cancelled = false;
    setLoading(true);
    queryUsers({ current: 1, size: 50 })
      .then((page) => {
        if (!cancelled) setBaseOptions(toOpts(page.records));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isHrm]);

  // 反查当前已选值名称
  useEffect(() => {
    if (value == null || !category) {
      setSelectedName('');
      return;
    }
    let cancelled = false;
    resolveItemNames(category, [String(value)]).then((res) => {
      if (cancelled) return;
      const name = res[0]?.name;
      setSelectedName(name && String(name) !== String(value) ? name : '');
    });
    return () => {
      cancelled = true;
    };
  }, [category, value]);

  const options =
    value != null && selectedName && !baseOptions.some((o) => o.value === value)
      ? [...baseOptions, { value, label: selectedName }]
      : baseOptions;

  const handleSearch = (kw: string) => {
    if (!isHrm) return; // 组织类本地过滤即可
    setLoading(true);
    queryUsers({ keyword: kw.trim() || undefined, current: 1, size: 50 })
      .then((page) => setBaseOptions(toOpts(page.records)))
      .finally(() => setLoading(false));
  };

  return (
    <Select
      showSearch
      optionFilterProp="label"
      filterOption={isHrm ? false : undefined}
      value={value}
      options={options}
      loading={loading}
      disabled={disabled}
      allowClear
      placeholder={CATEGORY_PLACEHOLDER[objtype]}
      onChange={(v) => onChange(v)}
      onSearch={handleSearch}
      style={{ width: 180 }}
    />
  );
};

const FormRightDrawer: React.FC<Props> = ({ formId, open, onClose }) => {
  const [modeId, setModeId] = useState<number | null>(null);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [modeRights, setModeRights] = useState<ModeRightInfo[]>([]);
  const [fieldAuths, setFieldAuths] = useState<ModeFieldAuthorize[]>([]);
  const [dataScopes, setDataScopes] = useState<ModeDataShareRule[]>([]);
  const [rightVersion, setRightVersion] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !formId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [mid, flds] = await Promise.all([
          resolveModeId(formId),
          fieldApi.getByFormId(formId).catch(() => [] as FieldDefinition[]),
        ]);
        if (cancelled) return;
        setModeId(mid);
        setFields(flds || []);
        if (mid) {
          const [mr, fa, ds, ver] = await Promise.all([
            getModeRights(mid),
            getFieldAuthorizes(mid),
            getModeDataScopes(mid),
            getRightVersion(mid),
          ]);
          if (cancelled) return;
          setModeRights(mr || []);
          setFieldAuths(fa || []);
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
        fieldAuthorizes: cleanAuths,
        dataScopes: cleanScopes,
        expectedVersion: rightVersion,
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
        <Select
          value={v}
          options={OBJTYPE_OPTS}
          onChange={(x) => {
            updateRight(i, 'objtype', x);
            updateRight(i, 'objid', undefined);
          }}
          style={{ width: 120 }}
          disabled={disabled}
        />
      ),
    },
    {
      title: '对象ID',
      dataIndex: 'objid',
      width: 200,
      render: (v, record, i) => (
        <ObjPicker
          objtype={record.objtype ?? 1}
          value={v}
          disabled={disabled}
          onChange={(x) => updateRight(i, 'objid', x)}
        />
      ),
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
        <Select
          value={v}
          options={OBJTYPE_OPTS}
          onChange={(x) => {
            updateAuth(i, 'objtype', x);
            updateAuth(i, 'objid', undefined);
          }}
          style={{ width: 120 }}
          disabled={disabled}
        />
      ),
    },
    {
      title: '对象ID',
      dataIndex: 'objid',
      width: 200,
      render: (v, record, i) => (
        <ObjPicker
          objtype={record.objtype ?? 1}
          value={v}
          disabled={disabled}
          onChange={(x) => updateAuth(i, 'objid', x)}
        />
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
        <Select
          value={v}
          options={OBJTYPE_OPTS}
          onChange={(x) => {
            updateScope(i, 'objtype', x);
            updateScope(i, 'objid', undefined);
          }}
          style={{ width: 120 }}
          disabled={disabled}
        />
      ),
    },
    {
      title: '对象ID',
      dataIndex: 'objid',
      width: 200,
      render: (v, record, i) => (
        <ObjPicker
          objtype={record.objtype ?? 1}
          value={v}
          disabled={disabled}
          onChange={(x) => updateScope(i, 'objid', x)}
        />
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
        <Input
          value={v ?? ''}
          placeholder="如 owner"
          onChange={(e) => updateScope(i, 'matrixValueField', e.target.value)}
          disabled={disabled || r.objtype !== 7}
          size="small"
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

  const tabItems = [
    {
      key: 'right',
      label: '模块权限',
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
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
          <Button type="dashed" icon={<PlusOutlined />} onClick={addAuth} disabled={disabled} block>
            新增字段权限
          </Button>
          <Table
            rowKey={(_, i) => `f-${i}`}
            columns={authColumns}
            dataSource={fieldAuths}
            pagination={false}
            size="small"
            scroll={{ x: 810 }}
            locale={{ emptyText: '暂无配置' }}
          />
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
            scroll={{ x: 1180 }}
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
    </Drawer>
  );
};

export default FormRightDrawer;
