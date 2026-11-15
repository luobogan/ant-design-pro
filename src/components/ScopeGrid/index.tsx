/**
 * ScopeGrid —— 数据权限体系下的通用列表组件
 *
 * 参考 Sword 的 Grid（页面容器）+ StandardTable（纯表格）两层封装与按钮元数据驱动，
 * 但改用本项目的 ProTable 体系，并补齐 Sword 缺失的能力：
 *   1) 列配置来自 blade_scope_field（勾选 = 前端列表展示），复用 useScopeFieldColumns；
 *   2) 叠加「按当前用户」的字段级权限（fieldPermApi），fail-open；
 *   3) 按钮/操作列权限来自 useAccess().getPageButtons，随 initialState 动态刷新；
 *   4) 列设置（个人显隐 / 排序 / 恢复默认）持久化到 localStorage；
 *   5) 全链路 fail-open：列配置为空或失败时回退 fallbackColumns，绝不白屏。
 *
 * 语义隔离（重要）：
 *   - 静态列配置（blade_scope_field.is_visible）：按菜单，不区分用户；
 *   - 用户字段权限（field-perm）：按当前用户，只能「收窄」不能「放开」；
 *   - 行级数据权限：后端 BladeDataScopeHandler 负责，前端不参与。
 *
 * 组件不直接写库：管理员「保存为默认列」通过 onSaveColumns 交给页面实现，
 * 保持纯展示组件的可复用性。
 */
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  EditOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { useAccess } from '@umijs/max';
import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Empty,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
} from 'antd';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useScopeFieldColumns } from '@/components/DynamicScopeTable';
import StandardTable from '@/components/StandardTable';
import {
  getFieldPermByForm,
  type FieldPerm,
} from '@/services/formmode/fieldPermApi';
import { useAutoMenuId } from './useAutoMenuId';
import { getFieldTypeLabel, mapFieldToControlType } from '@/components/FormMode/fieldTypes';
import {
  BROWSER_TYPE_META,
  resolveItemNames,
  splitIds,
  type PersonOrgCategory,
} from '@/components/FormMode/personOrg';
import type {
  ScopeGridActionPayload,
  ScopeGridButton,
  ScopeGridColumnPreference,
  ScopeGridProps,
} from './types';

/** 列控件类型（由 blade_scope_field 的类型元数据解析，避免按数字编码直接映射） */
export type ColumnControlType =
  | 'text' | 'textarea' | 'number' | 'date' | 'datetime' | 'select' | 'checkbox'
  | 'radio' | 'browser' | 'attachment' | 'custom' | 'odoc';

const CONTROL_TYPE_LABEL: Record<ColumnControlType, string> = {
  text: '文本', textarea: '多行文本', number: '数字', date: '日期',
  datetime: '日期时间', select: '选择框', checkbox: '复选框',
  radio: '单选框', browser: '浏览按钮', attachment: '附件', custom: '自定义', odoc: '正文',
};

const CONTROL_TYPES: ColumnControlType[] = [
  'text', 'textarea', 'number', 'date', 'datetime', 'select', 'checkbox',
  'radio', 'browser', 'attachment', 'custom', 'odoc',
];

/**
 * 可在单元格内直接编辑的控件类型。
 * 浏览按钮（人力资源/部门等）、选择框、附件在通用列表里没有可用的行内控件，
 * 强行渲染会退化成「空 Select」——这正是历史 bug 的根因，故一律只读展示。
 */
const INLINE_EDIT_CONTROLS: ColumnControlType[] = [
  'text', 'textarea', 'number', 'date', 'datetime', 'checkbox',
];

/**
 * 由列配置解析控件类型：优先 fieldDbType（无歧义、权威）；
 * fieldHtmlType 只有在存的是 ControlType 字符串时才采用 —— 本项目 fieldhtmltype
 * 数字存在多套互相冲突的编码，按数字直接映射会重演「人力资源字段渲染成空 Select」。
 */
export const resolveColumnControlType = (cfg?: {
  fieldDbType?: string;
  fieldHtmlType?: string;
}): ColumnControlType => {
  const html = String(cfg?.fieldHtmlType || '').trim().toLowerCase();
  if (CONTROL_TYPES.includes(html as ColumnControlType)) return html as ColumnControlType;
  const db = String(cfg?.fieldDbType || '').trim().toLowerCase();
  if (/datetime|timestamp/.test(db)) return 'datetime';
  if (/^date$|^time$/.test(db)) return 'date';
  if (/int|decimal|numeric|float|double|bigint/.test(db)) return 'number';
  if (/text|blob|json/.test(db)) return 'textarea';
  return 'text';
};

/**
 * 按「组件字段类型」解析列控件类型：复用 components/FormMode/fieldTypes.ts 的
 * mapFieldToControlType（项目内字段类型编码的**单一权威**），使通用列表的列与
 * formmode/tabledesign 完全一致：
 *   - 浏览按钮(3) + 人力资源(1)/部门(2)… → browser（人员/部门组件）
 *   - 浏览按钮(3) + 日期(98)/时间(99)    → date / datetime
 *   - 选择框(4) / 复选框(6) / 附件(5) / 特殊字段(7) → select / checkbox / attachment / 自定义
 *
 * 组件类型缺失（未选业务表单、存量配置 field_type 为空）时退化为 text，
 * 绝不按数字编码硬猜（那正是「人力资源字段渲染成空 Select」的根因）。
 */
export const resolveComponentControlType = (cfg?: {
  fieldDbType?: string;
  fieldHtmlType?: string;
  fieldType?: string;
}): ColumnControlType => {
  const html = String(cfg?.fieldHtmlType ?? '').trim();
  // 没有组件类型（fieldHtmlType 为空）→ 无法判定，退回数据库类型推断
  if (!html || html.toLowerCase() === 'undefined' || html.toLowerCase() === 'null') {
    return resolveColumnControlType(cfg);
  }
  const ct = mapFieldToControlType({
    fieldHtmlType: html,
    fieldType: cfg?.fieldType,
  });
  switch (ct) {
    case 'textarea': return 'textarea';
    case 'number':
    case 'wholeNumber': return 'number';
    case 'date': return 'date';
    case 'datetime': return 'datetime';
    case 'select': return 'select';
    case 'radio': return 'radio';
    case 'checkbox': return 'checkbox';
    case 'attachment': return 'attachment';
    case 'browser': return 'browser';
    case 'custom': return 'custom';
    case 'odoc': return 'odoc';
    default: return 'text';
  }
};

/** 列头叠加「组件字段类型」标签（与 formmode/tabledesign 同源），便于预览对照 */
const renderFieldTypeTitle = (title: any, label: string): React.ReactNode => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
    <span>{title}</span>
    <Tag color="geekblue" style={{ marginInlineEnd: 0, lineHeight: '18px', fontSize: 12 }}>
      {label}
    </Tag>
  </span>
);

/**
 * 可编辑单元格：由 is_editable=1 驱动，且按字段类型加载对应控件
 * （日期→DatePicker、数字→InputNumber、多行→TextArea、复选→是/否 Select）。
 * 点击文本进入编辑，Enter / 失焦保存，Esc 取消；未配置 onCellSave 时退化为只读展示。
 */
const EditableCell: React.FC<{
  value: any;
  controlType?: ColumnControlType;
  /** 已解析好的展示文本（浏览按钮类：人名 / 部门名等）；有值则优先于原始值 */
  displayText?: string;
  /** 常驻编辑态：打开即显示输入控件，不显示文本 + 编辑图标 */
  alwaysEdit?: boolean;
  onSave?: (value: string) => void | Promise<void>;
}> = ({ value, controlType = 'text', displayText, alwaysEdit = false, onSave }) => {
  const [editing, setEditing] = useState(alwaysEdit);
  const [draft, setDraft] = useState('');
  const committedRef = useRef(false);

  useEffect(() => {
    setDraft(value == null ? '' : String(value));
  }, [value]);

  useEffect(() => {
    // 开关切换时同步编辑态：开启→常驻输入框，关闭→回到「点击才编辑」
    setEditing(alwaysEdit);
    committedRef.current = false;
  }, [alwaysEdit]);

  const truthy = String(value) === '1' || value === true || String(value) === 'true';
  const display = (): string => {
    // 浏览按钮类已反查出人名/部门名 → 直接展示名称，不再显示裸 ID
    if (displayText) return displayText;
    if (value == null || value === '') return '—';
    if (controlType === 'checkbox') return truthy ? '是' : '否';
    if (controlType === 'number' && !Number.isNaN(Number(value))) {
      return Number(value).toLocaleString('en-US');
    }
    return String(value);
  };

  /**
   * 只读形态：按组件类型给出对应展示。
   * browser（人力资源/部门等浏览按钮）→ 人员/部门标签；attachment → 文件标签。
   * 通用列表不解析 ID→名称（避免每行每列的 N+1 请求），展示值由数据源提供。
   */
  const readOnlyNode = (): React.ReactNode => {
    if (controlType === 'browser') {
      return (
        <Tag color="blue" style={{ margin: 0 }} data-testid="scope-grid-cell-browser">
          {display()}
        </Tag>
      );
    }
    if (controlType === 'attachment') {
      return (
        <Tag color="cyan" style={{ margin: 0 }} data-testid="scope-grid-cell-attachment">
          {display()}
        </Tag>
      );
    }
    return <span>{display()}</span>;
  };

  // 无保存回调 → 只读；控件类型不支持行内编辑（浏览按钮/选择框/附件…）→ 只读，
  // 避免渲染成没有 options 的空 Select
  if (!onSave || !INLINE_EDIT_CONTROLS.includes(controlType)) return readOnlyNode();

  const commit = async (next?: string) => {
    if (committedRef.current) return;
    committedRef.current = true;
    if (!alwaysEdit) setEditing(false);
    const val = next ?? draft;
    if (val === (value == null ? '' : String(value))) {
      if (alwaysEdit) committedRef.current = false;
      return;
    }
    await onSave(val);
    // 常驻编辑态下允许连续多次修改，重置防重入标记
    if (alwaysEdit) committedRef.current = false;
  };

  const cancel = () => {
    committedRef.current = true;
    setDraft(value == null ? '' : String(value));
    if (!alwaysEdit) setEditing(false);
    if (alwaysEdit) committedRef.current = false;
  };

  if (editing) {
    const testId = { 'data-testid': 'scope-grid-cell-input' } as any;
    if (controlType === 'number') {
      return (
        <InputNumber
          size="small" autoFocus {...testId}
          value={draft === '' ? undefined : Number(draft)}
          onChange={(v) => setDraft(v == null ? '' : String(v))}
          onBlur={() => commit()}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
        />
      );
    }
    if (controlType === 'date' || controlType === 'datetime') {
      const fmt = controlType === 'date' ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm:ss';
      return (
        <DatePicker
          size="small" autoFocus {...testId}
          showTime={controlType === 'datetime'}
          format={fmt}
          value={draft ? dayjs(draft) : undefined}
          onChange={(d) => setDraft(d ? d.format(fmt) : '')}
          onOpenChange={(open) => { if (!open) commit(); }}
        />
      );
    }
    if (controlType === 'checkbox') {
      return (
        <Select
          size="small" autoFocus {...testId}
          value={draft}
          options={[{ value: '1', label: '是' }, { value: '0', label: '否' }]}
          onChange={(v) => { setDraft(String(v)); commit(String(v)); }}
          onBlur={() => commit()}
        />
      );
    }
    if (controlType === 'textarea') {
      return (
        <Input.TextArea
          size="small" autoFocus {...testId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit()}
          onKeyDown={(e) => { if (e.key === 'Escape') cancel(); }}
        />
      );
    }
    return (
      <Input
        size="small" autoFocus {...testId}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onPressEnter={() => commit()}
        onBlur={() => commit()}
        onKeyDown={(e) => { if (e.key === 'Escape') cancel(); }}
      />
    );
  }

  return (
    <Tooltip title={`点击编辑（${CONTROL_TYPE_LABEL[controlType] ?? '文本'}）`}>
      <span
        onClick={() => {
          committedRef.current = false;
          setDraft(value == null ? '' : String(value));
          setEditing(true);
        }}
        style={{ cursor: 'text', borderBottom: '1px dashed #1677ff', display: 'inline-block', minWidth: 24 }}
        data-testid="scope-grid-cell-editable"
      >
        {controlType === 'checkbox'
          ? <Tag color={truthy ? 'green' : 'default'}>{display()}</Tag>
          : display()}
        <EditOutlined style={{ marginLeft: 6, color: '#1677ff', fontSize: 12 }} />
      </span>
    </Tooltip>
  );
};

/** 取列的稳定标识：优先 dataIndex，其次 key，最后 title */
const columnKey = <T,>(c: ProColumns<T>): string => {
  const dataIndex = c.dataIndex;
  const idx = Array.isArray(dataIndex) ? dataIndex.join('.') : dataIndex;
  return String(idx ?? c.key ?? c.title ?? '');
};

/**
 * 未配置列宽时按渲染类型给「自适应最小宽度」：
 * 后端 width 默认 -1（已在 toProColumn 规范化为 undefined），若不给下限，
 * antd 会把十几列平均压到 30px 左右挤在一起。
 */
const defaultColumnWidth = <T,>(c: ProColumns<T>): number => {
  const vt = String(c.valueType ?? 'text');
  if (vt === 'dateTime') return 180;
  if (vt === 'date') return 150;
  if (vt === 'digit') return 120;
  if (vt === 'textarea') return 200;
  const titleLen = String(c.title ?? '').length;
  return Math.max(140, Math.min(240, titleLen * 12 + 60));
};

/** 按 alias 推导按钮的默认视觉样式（与 BusinessComponents/ToolBar 保持一致） */
const isDanger = (btn: ScopeGridButton) => btn.alias === 'delete';
const isPrimary = (btn: ScopeGridButton) =>
  btn.alias === 'add' || btn.alias === 'delete';

function ScopeGrid<T extends Record<string, any>>(props: ScopeGridProps<T>) {
  const {
    menuId, scopeId, resourceCode, pageCode, formId,
    rowKey = 'id',
    request, dataSource,
    fallbackColumns, extraColumns,
    renderSearchForm, renderLeftButton, renderRightButton,
    onButtonClick, onCellSave, rowActions, onSelectRow, onConfigsChange, onSaveColumns,
    defaultEditable = false,
    actionColumnTitle = '操作', actionColumnWidth = 180,
    enableColumnSetting = true,
    showFieldType = false,
    componentControl = false,
    refreshToken, tableProps,
  } = props;

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [fieldPerms, setFieldPerms] = useState<FieldPerm[]>([]);
  const [preference, setPreference] = useState<ScopeGridColumnPreference>({});
  const [settingOpen, setSettingOpen] = useState(false);
  const internalActionRef = useRef<any>(null);
  // 页面若通过 tableProps 传入自己的 actionRef，则复用它，
  // 使列配置刷新与页面自身的 reload / 批量删除共用一个句柄。
  const actionRef = (tableProps?.actionRef as any) || internalActionRef;

  const configsChangeRef = useRef(onConfigsChange);
  configsChangeRef.current = onConfigsChange;

  /**
   * menuId 显式传入优先，否则按当前路由从菜单树反查（业务页无需硬编码雪花 ID）。
   * scopeId 默认 0：后端 ScopeFieldServiceImpl.listByScope 是 AND 语义，
   * 而保存端固定写 scope_id=0；查询若不带该条件，会命中同菜单下其它 scope_id
   * 的记录，造成重复列与顺序错乱。
   */
  const effectiveMenuId = useAutoMenuId(menuId);
  const effectiveScopeId = scopeId ?? 0;

  /** ① 静态列配置（blade_scope_field），复用现有 hook，保留 fallback 语义 */
  const {
    columns: baseColumns,
    configs,
    usingFallback,
    loading,
    error,
    refresh: refreshColumns,
  } = useScopeFieldColumns<T>({
    menuId: effectiveMenuId,
    scopeId: effectiveScopeId,
    resourceCode, fallbackColumns,
    onlyVisible: true, refreshToken,
  });

  useEffect(() => {
    configsChangeRef.current?.(configs);
  }, [configs]);

  /** 静态列配置里 isEditable=1 的字段 —— 「可编辑」的唯一配置源 */
  const editableNames = useMemo(
    () => new Set(
      (configs || [])
        .filter((c) => c?.fieldName && c.isEditable === 1)
        .map((c) => c.fieldName),
    ),
    [configs],
  );

  /** 每列的控件类型：浏览按钮类始终按「组件字段类型」解析（人员/部门列要显示名称），
   *  其余列在 componentControl 开启时按组件类型，否则沿用数据库类型推断 */
  const controlTypeByName = useMemo(() => {
    const map = new Map<string, ColumnControlType>();
    (configs || []).forEach((c) => {
      if (c?.fieldName && !map.has(c.fieldName)) {
        const comp = resolveComponentControlType(c);
        map.set(
          c.fieldName,
          comp === 'browser' ? comp : (componentControl ? comp : resolveColumnControlType(c)),
        );
      }
    });
    return map;
  }, [configs, componentControl]);

  /**
   * 浏览按钮类列清单：fieldHtmlType=3 且 fieldType 命中浏览按钮类型表
   * （人力资源/部门/角色/岗位…）→ 单元格需要反查显示名称。
   */
  const browserCols = useMemo(() => {
    const cols = new Map<string, PersonOrgCategory>();
    (configs || []).forEach((c) => {
      if (!c?.fieldName) return;
      if (String(c.fieldHtmlType ?? '').trim() !== '3') return;
      const meta = BROWSER_TYPE_META[Number(c.fieldType)];
      if (!meta?.category) return;
      cols.set(c.fieldName, meta.category);
    });
    return cols;
  }, [configs]);

  /** 最近一次请求返回的行（request 模式下用于反查名称；dataSource 模式直接用 dataSource） */
  const [requestRows, setRequestRows] = useState<T[]>([]);
  const rows = useMemo(() => (Array.isArray(dataSource) ? dataSource : requestRows), [dataSource, requestRows]);

  /** 包装 request：记录最近一次返回的行，供浏览按钮类字段反查显示名称 */
  const wrappedRequest = useMemo(() => {
    if (!request) return undefined;
    return async (params: any, sort: any, filter: any) => {
      const res: any = await request(params, sort, filter);
      const list = Array.isArray(res?.data) ? (res.data as T[]) : [];
      setRequestRows(list);
      return res;
    };
  }, [request]);

  /** 字段名 → { id → 名称 }；人员走 /user/names 批量，部门/角色/岗位走内存字典
   *  （与表单预览 ExcelPreview 的 FieldControl 完全同一套解析） */
  const [displayNames, setDisplayNames] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    if (!browserCols.size || !rows.length) return;
    let alive = true;
    browserCols.forEach((category, fieldName) => {
      const ids = new Set<string>();
      rows.forEach((row: any) => {
        splitIds(row?.[fieldName]).forEach((id) => ids.add(id));
      });
      if (!ids.size) return;
      resolveItemNames(category, Array.from(ids))
        .then((items) => {
          if (!alive) return;
          const map: Record<string, string> = {};
          (items || []).forEach((it) => { map[String(it.id)] = it.name; });
          setDisplayNames((prev) => ({ ...prev, [fieldName]: { ...(prev[fieldName] || {}), ...map } }));
        })
        .catch(() => {
          // 名称反查失败 → 保留原始值展示（fail-open）
        });
    });
    return () => { alive = false; };
  }, [rows, browserCols]);

  /** 某字段的显示名称（多值以「、」连接）；查不到返回 undefined */
  const displayTextOf = useCallback((fieldName: string, value: any): string | undefined => {
    const dict = displayNames[fieldName];
    if (!dict) return undefined;
    const ids = splitIds(value);
    if (!ids.length) return undefined;
    const names = ids.map((id) => dict[id]).filter(Boolean);
    return names.length ? names.join('、') : undefined;
  }, [displayNames]);

  /** 每列的「组件字段类型」中文标签（单行文本 / 人力资源 / 下拉框 / 日期 …），
   * 由 fieldHtmlType + fieldType 经 getFieldTypeLabel 得出，与 formmode/tabledesign 同源。
   * 后端 blade_scope_field 仅存 fieldHtmlType、未存 fieldType 子类型，故浏览按钮类降级为「浏览按钮」。 */
  const fieldTypeLabelByName = useMemo(() => {
    const map = new Map<string, string>();
    (configs || []).forEach((c) => {
      if (!c?.fieldName || map.has(c.fieldName)) return;
      const label = getFieldTypeLabel(c.fieldHtmlType, (c as any).fieldType);
      // 回显态缺失子类型时，浏览按钮类降级为干净大类（避免「浏览按钮(-)」观感）
      map.set(c.fieldName, label.endsWith('(-)') ? label.slice(0, -3) : label);
    });
    return map;
  }, [configs]);

  /** ② 按钮权限：useAccess 随 initialState 更新，天然支持动态刷新（Sword 只在构造时读一次） */
  const { getPageButtons } = useAccess();
  const buttons = useMemo<ScopeGridButton[]>(
    () => (getPageButtons?.(pageCode) || []) as ScopeGridButton[],
    [getPageButtons, pageCode],
  );
  const topButtons = useMemo(
    () => buttons.filter((b) => b.action === 1 || b.action === 3),
    [buttons],
  );
  const rowButtons = useMemo(
    () => buttons.filter((b) => b.action === 2 || b.action === 3),
    [buttons],
  );

  /** ③ 用户字段权限（按当前用户），失败/空数组一律 fail-open */
  useEffect(() => {
    if (formId == null || formId === '') {
      setFieldPerms([]);
      return;
    }
    let alive = true;
    getFieldPermByForm(formId).then((list) => {
      if (alive) setFieldPerms(Array.isArray(list) ? list : []);
    });
    return () => { alive = false; };
  }, [formId]);

  const permByName = useMemo(() => {
    const map = new Map<string, FieldPerm>();
    fieldPerms.forEach((p) => {
      if (p?.fieldName && !map.has(p.fieldName)) map.set(p.fieldName, p);
    });
    return map;
  }, [fieldPerms]);

  /** ④ 个人列偏好：按 menuId + pageCode 隔离，只收窄不放大 */
  const preferenceKey = useMemo(
    () => `scope-grid-columns:${effectiveMenuId ?? ''}:${pageCode ?? ''}`,
    [effectiveMenuId, pageCode],
  );
  useEffect(() => {
    try {
      const raw = localStorage.getItem(preferenceKey);
      setPreference(raw ? (JSON.parse(raw) as ScopeGridColumnPreference) : {});
    } catch (_e) {
      setPreference({});
    }
  }, [preferenceKey]);

  const updatePreference = useCallback(
    (next: ScopeGridColumnPreference) => {
      setPreference(next);
      try {
        localStorage.setItem(preferenceKey, JSON.stringify(next));
      } catch (_e) {
        // 隐私模式下写入失败不影响使用
      }
    },
    [preferenceKey],
  );

  const refresh = useCallback(() => {
    refreshColumns();
    actionRef.current?.reload?.();
  }, [refreshColumns]);

  const handleReset = useCallback(() => {
    if (actionRef.current?.reloadAndRest) actionRef.current.reloadAndRest();
    else actionRef.current?.reload?.();
  }, []);

  /** ⑤ 生成最终列：字段权限过滤 → 个人偏好 → extraColumns → 自动操作列 */
  const columns = useMemo<ProColumns<T>[]>(() => {
    // 只有显式 visible === false 才隐藏（VO 字段缺省不能误判为无权限）
    const byPerm = baseColumns.filter((c) => {
      const name = columnKey(c);
      if (!name) return true;
      return permByName.get(name)?.visible !== false;
    });

    const hidden = new Set(preference.hidden ?? []);
    let ordered = byPerm.filter((c) => !hidden.has(columnKey(c)));
    if (preference.order?.length) {
      const rank = new Map(preference.order.map((k, i) => [k, i]));
      ordered = [...ordered].sort(
        (a, b) =>
          (rank.get(columnKey(a)) ?? Number.MAX_SAFE_INTEGER) -
          (rank.get(columnKey(b)) ?? Number.MAX_SAFE_INTEGER),
      );
    }

    // 补自适应最小宽度 + isEditable=1 的行内编辑渲染（用户字段权限 editable=false 时降级只读）
    const decorated = ordered.map((c) => {
      const name = columnKey(c);
      const width = typeof c.width === 'number' && c.width > 0
        ? c.width
        : defaultColumnWidth(c);
      const base: ProColumns<T> = { ...c, width };
      const typeLabel = showFieldType ? fieldTypeLabelByName.get(name) : undefined;
      const withTitle: ProColumns<T> = typeLabel
        ? { ...base, title: renderFieldTypeTitle(base.title, typeLabel) }
        : base;
      if (!name) return withTitle;
      const editable = editableNames.has(name) && permByName.get(name)?.editable !== false;
      if (!editable) {
        // 组件类型模式：不可编辑列同样按组件类型只读展示（人力资源/部门列显示对应标签）
        if (!componentControl) return withTitle;
        return {
          ...withTitle,
          render: (_dom: any, record: T) => (
            <EditableCell
              value={record[name]}
              controlType={controlTypeByName.get(name)}
              displayText={displayTextOf(name, record[name])}
            />
          ),
        } as ProColumns<T>;
      }
      return {
        ...withTitle,
        render: (_dom: any, record: T) => (
          <EditableCell
            value={record[name]}
            controlType={controlTypeByName.get(name)}
            displayText={displayTextOf(name, record[name])}
            alwaysEdit={defaultEditable}
            onSave={onCellSave
              ? (v: string) => onCellSave({ row: record, fieldName: name, value: v, refresh })
              : undefined}
          />
        ),
      } as ProColumns<T>;
    });

    const result: ProColumns<T>[] = [...decorated, ...(extraColumns ?? [])];

    /**
     * 操作栏由容器自动追加，业务 columns 只写数据列（Sword 的核心设计）。
     * 权限按钮（/menu/buttons，action=2/3）与页面自定义 rowActions 合并到同一列；
     * 即使该 pageCode 没有任何按钮配置，只要传了 rowActions 也会渲染操作列。
     */
    if (rowButtons.length || rowActions) {
      result.push({
        title: actionColumnTitle,
        key: '__scope_grid_action__',
        valueType: 'option',
        width: actionColumnWidth,
        fixed: 'right',
        hideInSearch: true,
        render: (_dom: any, record: T) => [
          ...rowButtons.map((btn) => (
            <Button
              key={`perm-${btn.code}`}
              type="link"
              size="small"
              danger={isDanger(btn)}
              onClick={() => {
                const payload: ScopeGridActionPayload<T> = {
                  btn,
                  keys: [record[rowKey] as React.Key],
                  rows: [record],
                  refresh,
                };
                onButtonClick?.(payload);
              }}
            >
              {btn.name || btn.code}
            </Button>
          )),
          ...(rowActions?.(record, refresh) ?? []),
        ],
      } as ProColumns<T>);
    }
    return result;
  }, [
    baseColumns, permByName, preference, extraColumns, rowButtons, editableNames,
    controlTypeByName, fieldTypeLabelByName, showFieldType, componentControl, displayTextOf,
    defaultEditable, onCellSave,
    rowActions, actionColumnTitle, actionColumnWidth, rowKey, onButtonClick, refresh,
  ]);

  /**
   * 多列时启用横向滚动：表格按各列宽度铺开，而不是把十几列硬压进容器。
   * 列少时保持原行为（自适应撑满容器）；页面可用 tableProps.scroll 覆盖。
   */
  const resolvedScroll = useMemo(() => {
    if ((tableProps as any)?.scroll !== undefined) return undefined;
    if (columns.length <= 6) return undefined;
    return { x: 'max-content' } as any;
  }, [columns.length, tableProps]);

  /** 列设置弹窗用的顺序（服务端基线列，不含自动操作列） */
  const settingOrder = useMemo(() => {
    const base = baseColumns.map(columnKey).filter(Boolean);
    const saved = (preference.order ?? []).filter((k) => base.includes(k));
    return [...saved, ...base.filter((k) => !saved.includes(k))];
  }, [baseColumns, preference.order]);

  const columnTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    baseColumns.forEach((c) => {
      map.set(columnKey(c), String(c.title ?? columnKey(c)));
    });
    return map;
  }, [baseColumns]);

  const moveColumn = (key: string, delta: number) => {
    const next = settingOrder.slice();
    const i = next.indexOf(key);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    updatePreference({ ...preference, order: next });
  };

  const toggleColumn = (key: string, checked: boolean) => {
    const hidden = new Set(preference.hidden ?? []);
    if (checked) hidden.delete(key);
    else hidden.add(key);
    updatePreference({ ...preference, hidden: [...hidden] });
  };

  const hint = error ? (
    <Alert
      type="warning"
      showIcon
      style={{ marginBottom: 12 }}
      message="可见字段配置加载失败，已使用默认列"
      action={<a onClick={refresh}>重试</a>}
    />
  ) : usingFallback ? (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 12 }}
      message="当前菜单尚未配置可见字段，展示默认列"
      description="可在「数据权限 → 可见字段」中勾选需要在前端列表中展示的字段。"
    />
  ) : null;

  const rowSelection = onSelectRow
    ? {
      selectedRowKeys,
      onChange: (keys: React.Key[], rows: T[]) => {
        setSelectedRowKeys(keys);
        onSelectRow(keys, rows);
      },
    }
    : undefined;

  return (
    <div data-testid="scope-grid">
      {hint}
      {renderSearchForm && (
        <div style={{ marginBottom: 12 }}>{renderSearchForm(handleReset)}</div>
      )}

      <div
        style={{
          marginBottom: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <Space size={8} wrap>
          {topButtons.map((btn) => (
            <Button
              key={btn.code}
              type={isPrimary(btn) ? 'primary' : 'default'}
              danger={isDanger(btn)}
              onClick={() =>
                onButtonClick?.({ btn, keys: selectedRowKeys, rows: [], refresh })
              }
            >
              {btn.name || btn.code}
            </Button>
          ))}
          {renderLeftButton?.()}
        </Space>
        <Space size={8} wrap>
          {enableColumnSetting && (
            <Tooltip title="个人列显隐与顺序偏好，仅影响当前浏览器">
              <Button
                icon={<SettingOutlined />}
                onClick={() => setSettingOpen(true)}
                data-testid="scope-grid-setting"
              >
                列设置
              </Button>
            </Tooltip>
          )}
          {renderRightButton?.()}
        </Space>
      </div>

      <Spin spinning={loading}>
        {columns.length ? (
          <StandardTable<T>
            rowKey={rowKey}
            columns={columns}
            dataSource={dataSource}
            request={wrappedRequest}
            actionRef={actionRef as any}
            rowSelection={rowSelection}
            scroll={resolvedScroll}
            {...(tableProps as any)}
          />
        ) : (
          <Empty description="暂无可展示的字段" />
        )}
      </Spin>

      <Modal
        title="列设置"
        open={settingOpen}
        onCancel={() => setSettingOpen(false)}
        destroyOnHidden
        width={520}
        footer={
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Button onClick={() => updatePreference({})}>恢复默认</Button>
            <Space>
              <Button onClick={() => setSettingOpen(false)}>关闭</Button>
              {onSaveColumns && (
                <Button
                  type="primary"
                  onClick={() => {
                    onSaveColumns(configs);
                    setSettingOpen(false);
                  }}
                >
                  保存为默认列
                </Button>
              )}
            </Space>
          </Space>
        }
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="此处的显隐/顺序是个人偏好，不会改动服务端可见字段配置"
          description="服务端基线由「数据权限 → 可见字段」的勾选决定；本设置只能隐藏已勾选的列，不能新增列。"
        />
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {settingOrder.length ? (
            settingOrder.map((key) => (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 0',
                  borderBottom: '1px solid rgba(0,0,0,0.06)',
                }}
              >
                <Checkbox
                  checked={!(preference.hidden ?? []).includes(key)}
                  onChange={(e) => toggleColumn(key, e.target.checked)}
                >
                  {columnTitleMap.get(key) || key}
                </Checkbox>
                <span style={{ flex: 1 }} />
                <Button
                  type="text"
                  size="small"
                  icon={<ArrowUpOutlined />}
                  onClick={() => moveColumn(key, -1)}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<ArrowDownOutlined />}
                  onClick={() => moveColumn(key, 1)}
                />
              </div>
            ))
          ) : (
            <Empty description="暂无列配置" />
          )}
        </div>
      </Modal>
    </div>
  );
}

export type {
  ScopeGridProps,
  ScopeGridButton,
  ScopeGridActionPayload,
  ScopeGridCellSavePayload,
  ScopeGridColumnPreference,
  ResolvedColumn,
} from './types';
export default ScopeGrid;
