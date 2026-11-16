/**
 * 可见字段选择器（数据权限配置中的「可见字段」区域）
 *
 * 勾选语义（唯一口径）：**勾选 = 该字段需在前端列表中展示**。
 * 勾选集合同时驱动两处，二者始终同源：
 *   ① blade_scope_data.scope_field —— SQL 层列裁剪，提交给数据权限规则；
 *   ② blade_scope_field.is_visible —— 前端列表动态列，由父组件在提交时同步。
 * 组件通过 onFieldsChange 把完整字段草稿交给父组件，父组件保存 DataScope 后
 * 调用 submitScopeFields 一次性写入，避免弹窗未提交就落库。
 *
 * 重要契约：后端 BladeDataScopeHandler 直接把 scopeField 原样拼进
 *   select {scopeField} from ({originalSql}) scope where scope.{scopeColumn} in (...)
 * 且不做任何转义与白名单校验。因此本组件产出**只能**是：
 *   - '*'（全部字段）
 *   - 英文逗号分隔的合法 SQL 标识符列名串，如 'id,user_name,dept_id'
 * 不能是 JSON / 数组 / 中文标签。列名顺序即 SELECT 列顺序，允许拖拽调整。
 *
 * 字段清单数据源：formApi.getAll()（表单列表） + fieldApi.getByFormId()（字段定义），
 * 并用 listScopeFields(menuId) 回显字段管理页维护过的中文名 / 顺序 / 可编辑等元数据。
 * 由于 blade_menu 与 DataScope 均没有 formId 绑定列，表单由用户手选，并用
 * localStorage 按 menuId 记住上次选择（不改变后端契约）。
 *
 * 本组件是 antd Form.Item 的受控子组件，接收 value / onChange / id。
 * 底部只保留 id="visibleField" 的「原始值」只读展示（便于查看与排障），
 * 手工录入列名、直接改写原始值均已禁用：scopeField 只能由上方勾选 / 拖拽生成。
 */
import {
  DeleteOutlined,
  HolderOutlined,
  SearchOutlined,
  TableOutlined,
} from '@ant-design/icons';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  App,
  Alert,
  Button,
  Checkbox,
  Empty,
  Input,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Tooltip,
} from 'antd';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  listScopeFields,
  type ScopeFieldConfig,
} from '@/services/authority/dataPermission';
import { fieldApi, formApi } from '@/services/formmode';
import { getFieldTypeLabel } from '@/components/FormMode/fieldTypes';

/** 合法 SQL 列标识符：字母/下划线开头，仅含字母数字下划线与 $ */
const SAFE_COLUMN = /^[A-Za-z_][A-Za-z0-9_$]*$/;

const isSafeColumn = (name: string): boolean => SAFE_COLUMN.test(name);

/** 拆分 scopeField 原始串为列名数组（去空白、去空项、去重、保序） */
const splitColumns = (value?: string): string[] => {
  const seen = new Set<string>();
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => {
      if (!s || s === '*' || seen.has(s)) return false;
      seen.add(s);
      return true;
    });
};

interface FieldOption {
  name: string;
  label: string;
  sort: number;
  /** 来自字段定义的类型元数据，保存时写入 blade_scope_field 供列表按类型加载能力 */
  fieldDbType?: string;
  fieldHtmlType?: string;
  fieldType?: string;
}

interface FieldRow {
  name: string;
  label: string;
  checked: boolean;
  fromForm: boolean;
}

export interface VisibleFieldSelectorProps {
  /** scopeField 原始串（由 Form.Item 注入） */
  value?: string;
  /** 回写 scopeField（由 Form.Item 注入） */
  onChange?: (value: string) => void;
  /** 输入框 id（由 Form.Item 注入，默认 visibleField） */
  id?: string;
  /** 当前菜单 ID，用于记住上次选择的表单 */
  menuId?: string;
  /** 权限字段 scopeColumn，用于提示「必须包含在可见字段中」 */
  scopeColumn?: string;
  /** 输出完整字段草稿（勾选即 isVisible=1），供父组件提交时同步 blade_scope_field */
  onFieldsChange?: (fields: ScopeFieldConfig[]) => void;
  /** 当前菜单 code，用于在无历史记录时智能匹配业务表单 */
  menuCode?: string;
  /** 新增场景：首次打开时把已保存的可见字段配置回显成勾选（编辑场景不传，避免覆盖原值） */
  restoreOnMount?: boolean;
  disabled?: boolean;
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 8px',
  borderBottom: '1px solid rgba(0,0,0,0.06)',
  minWidth: 0,
};

const ellipsis: React.CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

/** 用户在弹窗内直接编辑的字段元数据（覆盖服务端回显值） */
interface FieldMetaOverride {
  fieldLabel?: string;
  description?: string;
  isEditable?: number;
}

/** 字段类型只读展示：由 fieldDbType 映射中文名，无法识别时原样显示 */
const formatFieldType = (dbType?: string): string => {
  const db = String(dbType || '')
    .trim()
    .toLowerCase();
  if (!db) return '—';
  if (/datetime|timestamp/.test(db)) return '日期时间';
  if (/^date$|^time$/.test(db)) return '日期';
  if (/int|decimal|numeric|float|double|bigint/.test(db)) return '数字';
  if (/text|blob|json/.test(db)) return '长文本';
  return db;
};

interface SortableRowProps {
  row: FieldRow;
  meta: FieldMetaOverride;
  /** 数据库类型（只读，如 varchar / int / datetime） */
  dbType?: string;
  /** 组件类型（只读，来自字段定义 fieldHtmlType 大类，如 单行文本 / 浏览按钮 / 下拉框 / 日期） */
  compTypeLabel?: string;
  /** 表单字段类型（只读，来自字段定义 fieldHtmlType + fieldType，如 人力资源 / 部门 / 日期） */
  formTypeLabel?: string;
  onToggle: (name: string) => void;
  onRemove: (name: string) => void;
  onMetaChange: (name: string, patch: FieldMetaOverride) => void;
  disabled?: boolean;
}

/** 一体化字段配置行：勾选=前端展示 + 中文名/说明/可编辑 + 拖拽排序 */
const SortableRow: React.FC<SortableRowProps> = ({
  row,
  meta,
  dbType,
  compTypeLabel,
  formTypeLabel,
  onToggle,
  onRemove,
  onMetaChange,
  disabled,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: row.name,
  });

  const style: React.CSSProperties = {
    ...rowStyle,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    background: isDragging
      ? 'rgba(22,119,255,0.06)'
      : row.checked
        ? 'rgba(22,119,255,0.03)'
        : undefined,
    position: 'relative',
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} data-testid={`vfs-row-${row.name}`}>
      <Tooltip title="拖拽调整字段顺序">
        <span
          {...attributes}
          {...listeners}
          data-testid={`vfs-drag-${row.name}`}
          style={{ flex: '0 0 18px', cursor: 'grab', color: '#999' }}
        >
          <HolderOutlined />
        </span>
      </Tooltip>
      <Tooltip title="勾选 = 该字段在前端列表中展示（同时作为 SQL 可见字段）">
        <Checkbox
          checked={row.checked}
          onChange={() => onToggle(row.name)}
          disabled={disabled}
          data-testid={`vfs-check-${row.name}`}
          style={{ flex: '0 0 24px' }}
        />
      </Tooltip>
      <Tooltip title={row.name}>
        <span
          style={{ ...ellipsis, flex: '0 0 140px', fontFamily: 'monospace' }}
        >
          {row.name}
        </span>
      </Tooltip>
      <Tooltip title={`数据库类型（只读）：${dbType || '未识别'}`}>
        <span
          style={{ flex: '0 0 92px', minWidth: 0, whiteSpace: 'nowrap' }}
          data-testid={`vfs-dbtype-${row.name}`}
        >
          <Tag
            color="blue"
            style={{
              margin: 0,
              maxWidth: 88,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {formatFieldType(dbType)}
          </Tag>
        </span>
      </Tooltip>
      <Tooltip
        title={`组件类型（只读，来自表单设计 fieldHtmlType）：${compTypeLabel || '—'}`}
      >
        <span
          style={{ flex: '0 0 92px', minWidth: 0, whiteSpace: 'nowrap' }}
          data-testid={`vfs-comptype-${row.name}`}
        >
          <Tag
            color="cyan"
            style={{
              margin: 0,
              maxWidth: 88,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {compTypeLabel || '—'}
          </Tag>
        </span>
      </Tooltip>
      <Tooltip
        title={`字段类型（只读，来自表单设计）：${formTypeLabel || '—'}`}
      >
        <span
          style={{ flex: '0 0 100px', minWidth: 0, whiteSpace: 'nowrap' }}
          data-testid={`vfs-formtype-${row.name}`}
        >
          <Tag
            color="geekblue"
            style={{
              margin: 0,
              maxWidth: 96,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {formTypeLabel || '—'}
          </Tag>
        </span>
      </Tooltip>
      <Input
        size="small"
        placeholder="中文名"
        value={meta.fieldLabel ?? row.label}
        onChange={(e) => onMetaChange(row.name, { fieldLabel: e.target.value })}
        disabled={disabled}
        data-testid={`vfs-label-${row.name}`}
        style={{ flex: '1 1 170px', minWidth: 100 }}
      />
      <Input
        size="small"
        placeholder="说明"
        value={meta.description ?? ''}
        onChange={(e) =>
          onMetaChange(row.name, { description: e.target.value })
        }
        disabled={disabled}
        data-testid={`vfs-desc-${row.name}`}
        style={{ flex: '1 1 150px', minWidth: 90 }}
      />
      <Tooltip title="勾选 = 隐藏该字段（不在前端列表展示）；与「展示」互斥，两者联动同一份 isVisible">
        <span style={{ flex: '0 0 62px', whiteSpace: 'nowrap' }}>
          <Checkbox
            checked={!row.checked}
            disabled={disabled}
            onChange={() => onToggle(row.name)}
            data-testid={`vfs-hidden-${row.name}`}
          >
            <span style={{ fontSize: 12 }}>隐藏</span>
          </Checkbox>
        </span>
      </Tooltip>
      <Tooltip title="该字段在通用列表中是否可行内编辑（仅对已勾选展示的字段有效）；业务表单的字段隐藏/只读请在「表单建模 → 表单权限」按角色配置">
        <span style={{ flex: '0 0 68px', whiteSpace: 'nowrap' }}>
          <Checkbox
            checked={meta.isEditable === 1}
            disabled={disabled || !row.checked}
            onChange={(e) =>
              onMetaChange(row.name, { isEditable: e.target.checked ? 1 : 0 })
            }
            data-testid={`vfs-editable-${row.name}`}
          >
            <span style={{ fontSize: 12 }}>可编辑</span>
          </Checkbox>
        </span>
      </Tooltip>
      {!row.fromForm ? (
        <Tooltip title="移除该自定义列">
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onRemove(row.name)}
            data-testid={`vfs-remove-${row.name}`}
          />
        </Tooltip>
      ) : (
        <span style={{ flex: '0 0 24px' }} />
      )}
    </div>
  );
};

const VisibleFieldSelector: React.FC<VisibleFieldSelectorProps> = ({
  value,
  onChange,
  id,
  menuId,
  scopeColumn,
  onFieldsChange,
  menuCode,
  restoreOnMount,
  disabled,
}) => {
  const { message } = App.useApp();
  const [formOptions, setFormOptions] = useState<
    { value: string; label: string; tableName?: string }[]
  >([]);
  const [formId, setFormId] = useState<string | undefined>();
  const [fields, setFields] = useState<FieldOption[]>([]);
  const [savedConfigs, setSavedConfigs] = useState<ScopeFieldConfig[]>([]);
  // 弹窗内直接编辑的字段元数据（中文名 / 说明 / 可编辑），只记录被改过的键
  const [metaOverrides, setMetaOverrides] = useState<
    Record<string, FieldMetaOverride>
  >({});
  // 行显示顺序：勾选只切换状态、不重排行；只有拖拽才改这个顺序
  const [rowOrder, setRowOrder] = useState<string[]>([]);
  // 列配置是否已拉取完成 / 是否已有配置：决定「打开即显示字段」的数据来源
  const [configState, setConfigState] = useState<'loading' | 'ready'>(
    'loading',
  );
  const [hasSavedConfig, setHasSavedConfig] = useState(false);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  // 用 ref 持有回调，避免父组件传入箭头函数导致下方输出草稿的 effect 反复触发
  const fieldsChangeRef = useRef(onFieldsChange);
  fieldsChangeRef.current = onFieldsChange;
  // 初始化表单选择只跑一次；新增场景的可见性回显也只跑一次
  const didInitRef = useRef(false);
  const restoredRef = useRef(false);

  const storageKey = useMemo(
    () => `datascope:visibleField:form:${menuId || 'default'}`,
    [menuId],
  );

  /** 唯一真源：所有交互只 emit 新的 scopeField 串，rows 完全由 value + fields 派生 */
  const emit = useCallback(
    (next: string) => {
      onChange?.(next);
    },
    [onChange],
  );

  const loadFields = useCallback(
    async (fid: string) => {
      if (!fid) {
        setFields([]);
        return;
      }
      setLoading(true);
      try {
        // 只取主表字段（isMain=1）：明细表字段在 formtable_main_{bill}_dtN，
        // 动态列表查的是主表，混进来会永远显示「主表无此列」且无法编辑。
        const res: any = await fieldApi.getByFormIdAndIsMain(fid, 1);
        const list: any[] = Array.isArray(res) ? res : (res?.data ?? []);
        const options: FieldOption[] = list
          .map((f, idx) => {
            // 后端 fieldDbName 常为空字符串（物理列名实际落在 fieldName），
            // 必须用 || 而非 ??，否则空串会吞掉所有字段。
            const name = String(
              f?.fieldDbName ||
                f?.fielddbname ||
                f?.fieldName ||
                f?.fieldname ||
                '',
            ).trim();
            return {
              name,
              label: String(f?.fieldLabel || f?.fieldlabel || '').trim(),
              sort: Number(
                f?.dsOrder ?? f?.sort ?? f?.fieldOrder ?? f?.fieldorder ?? idx,
              ),
              fieldDbType: String(
                f?.fieldDbType ?? f?.fielddbtype ?? '',
              ).trim(),
              fieldHtmlType: String(
                f?.fieldHtmlType ?? f?.fieldhtmltype ?? '',
              ).trim(),
              fieldType: String(f?.fieldType ?? f?.fieldtype ?? '').trim(),
            };
          })
          .filter((o) => isSafeColumn(o.name));
        options.sort((a, b) => a.sort - b.sort);
        setFields(options);
        try {
          localStorage.setItem(storageKey, fid);
        } catch (_e) {
          // localStorage 不可用不影响功能
        }
      } catch (_e) {
        setFields([]);
        message.error('字段清单加载失败，请切换业务表单重试');
      } finally {
        setLoading(false);
      }
    },
    [message, storageKey],
  );

  /** ① 回显该菜单已保存的可见字段配置（blade_scope_field），并标记加载完成 */
  useEffect(() => {
    if (!menuId) {
      setSavedConfigs([]);
      setHasSavedConfig(false);
      setConfigState('ready');
      return;
    }
    let cancelled = false;
    setConfigState('loading');
    listScopeFields({ menuId, scopeId: 0 })
      .then((list) => {
        if (cancelled) return;
        const arr = Array.isArray(list) ? list : [];
        setSavedConfigs(arr);
        setHasSavedConfig(arr.length > 0);
      })
      .catch(() => {
        if (cancelled) return;
        setSavedConfigs([]);
        setHasSavedConfig(false);
      })
      .finally(() => {
        if (!cancelled) setConfigState('ready');
      });
    return () => {
      cancelled = true;
    };
  }, [menuId]);

  /**
   * ② 初始化表单下拉。等列配置加载完再决定，保证「打开即显示字段」：
   *   - 有历史选择 → 用它；
   *   - 已有可见字段配置 → 清单直接由配置生成，不自动选表单（避免混入无关表字段）；
   *   - 都没有 → 按菜单 code 智能匹配，再兜底第一个表单，立即列出字段。
   */
  useEffect(() => {
    if (configState !== 'ready' || didInitRef.current) return;
    didInitRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res: any = await formApi.getAll();
        const list: any[] = Array.isArray(res) ? res : (res?.data ?? []);
        if (cancelled) return;
        const options = list
          .map((b) => ({
            value: String(b?.id ?? ''),
            label: String(
              b?.formName ?? b?.tableName ?? b?.name ?? b?.id ?? '',
            ),
            tableName: b?.tableName,
          }))
          .filter((o) => !!o.value);
        setFormOptions(options);
        let last: string | null = null;
        try {
          last = localStorage.getItem(storageKey);
        } catch (_e) {
          // ignore
        }
        if (last && options.some((o) => o.value === last)) {
          setFormId(last);
          await loadFields(last);
          return;
        }
        if (hasSavedConfig) return;
        const key = String(menuCode || '')
          .toLowerCase()
          .replace(/[_\-\s]/g, '');
        const guess = key
          ? options.find((o) =>
              `${o.label}${o.tableName || ''}`
                .toLowerCase()
                .replace(/[_\-\s]/g, '')
                .includes(key),
            )
          : undefined;
        const fallback = guess || options[0];
        if (fallback) {
          setFormId(fallback.value);
          await loadFields(fallback.value);
        }
      } catch (_e) {
        // 表单列表加载失败时降级为纯手工输入 / 已保存配置
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configState, hasSavedConfig, menuCode, storageKey, loadFields]);

  /** '*' = 全部字段；空串 = 零列（不再视为全选，否则「清空」后所有行又自动勾上） */
  const all = useMemo(() => (value ?? '').trim() === '*', [value]);

  const checkedNames = useMemo(() => {
    const names = splitColumns(value);
    // 字段定义已加载时，只认当前表单的主表字段（fields 已按 isMain=1 过滤）。
    // 历史脏数据（明细表字段被误写进 scope_field）不能靠回显重新混进列表，
    // 否则这些列永远「主表无此列」且无法编辑；用户下次保存即被自然淘汰。
    if (!fields.length) return names;
    const valid = new Set(fields.map((f) => f.name));
    return names.filter((n) => valid.has(n));
  }, [value, fields]);
  const invalidNames = useMemo(
    () => checkedNames.filter((n) => !isSafeColumn(n)),
    [checkedNames],
  );

  /**
   * 字段清单：blade_scope_field 已保存配置优先（决定顺序 / 中文名），再并入业务表单字段。
   * 这样即使从未选过表单，打开「可见字段」也能直接列出该菜单已配置好的字段清单，
   * 而不是「选择业务表单加载字段」的空状态。
   */
  const catalog = useMemo<FieldOption[]>(() => {
    const result: FieldOption[] = [];
    const seen = new Set<string>();
    const push = (
      name: string | undefined,
      label: string,
      sort: number,
      meta: Partial<FieldOption> = {},
    ) => {
      const n = String(name || '').trim();
      if (!n || seen.has(n) || !isSafeColumn(n)) return;
      seen.add(n);
      result.push({ name: n, label, sort, ...meta });
    };
    // 字段定义已加载时，savedConfigs 里不在主表字段清单中的项（历史误导入的
    // 明细表字段）一律不进 catalog —— 否则它们会作为「自定义列」永远留在表格里。
    const validNames = fields.length
      ? new Set(fields.map((f) => f.name))
      : null;
    [...savedConfigs]
      .filter(
        (c) => !validNames || validNames.has(String(c?.fieldName || '').trim()),
      )
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
      .forEach((c, i) =>
        push(
          c?.fieldName,
          String(c?.fieldLabel || ''),
          typeof c?.sort === 'number' ? c.sort : i,
          {
            fieldDbType: c?.fieldDbType,
            fieldHtmlType: c?.fieldHtmlType,
            fieldType: c?.fieldType,
          },
        ),
      );
    fields.forEach((f) =>
      push(f.name, f.label, f.sort, {
        fieldDbType: f.fieldDbType,
        fieldHtmlType: f.fieldHtmlType,
        fieldType: f.fieldType,
      }),
    );
    // 字段定义是类型权威来源：对已由配置占位同名行回填类型（不改顺序）
    const byName = new Map(fields.map((f) => [f.name, f]));
    result.forEach((item) => {
      const def = byName.get(item.name);
      if (!def) return;
      item.fieldDbType = def.fieldDbType || item.fieldDbType;
      item.fieldHtmlType = def.fieldHtmlType || item.fieldHtmlType;
      item.fieldType = def.fieldType || item.fieldType;
    });
    return result;
  }, [fields, savedConfigs]);

  const catalogNames = useMemo(() => catalog.map((f) => f.name), [catalog]);
  const catalogByName = useMemo(
    () => new Map(catalog.map((f) => [f.name, f])),
    [catalog],
  );
  /** 表单字段类型：业务表单定义优先，未选表单时用已保存配置兜底（避免新列全显「—」） */
  const formTypeDefs = useMemo(() => {
    const m = new Map<string, FieldOption>();
    savedConfigs.forEach((c) => {
      if (!c?.fieldName) return;
      m.set(c.fieldName, {
        name: c.fieldName,
        label: c.fieldLabel ?? '',
        sort: c.sort ?? 0,
        fieldDbType: c.fieldDbType,
        fieldHtmlType: c.fieldHtmlType,
        fieldType: c.fieldType,
      });
    });
    fields.forEach((f) => m.set(f.name, f));
    return m;
  }, [fields, savedConfigs]);
  const formTypeOf = useCallback(
    (name: string): string => {
      const def = formTypeDefs.get(name);
      if (!def) return '—';
      const label = getFieldTypeLabel(def.fieldHtmlType, def.fieldType);
      // 回显态（savedConfigs 未记录 fieldType 子类型）时，浏览按钮类降级为干净的大类，避免「浏览按钮(-)」观感
      return label.endsWith('(-)') ? label.slice(0, -3) : label;
    },
    [formTypeDefs],
  );
  /** 组件类型大类（fieldHtmlType 维度）：浏览按钮 / 下拉框 / 单行文本 / 日期 / 附件 …（不含子类型） */
  const compTypeOf = useCallback(
    (name: string): string => {
      const def = formTypeDefs.get(name);
      if (!def) return '—';
      const label = getFieldTypeLabel(def.fieldHtmlType, undefined);
      return label.endsWith('(-)') ? label.slice(0, -3) : label;
    },
    [formTypeDefs],
  );

  /**
   * 稳定的行顺序：优先拖拽后的顺序，否则按配置 sort。
   * 关键：勾选/取消勾选**不改变这个顺序**，当前行始终停在原位置。
   */
  const orderedNames = useMemo(() => {
    const set = new Set(catalogNames);
    const kept = rowOrder.filter((n) => set.has(n));
    return [...kept, ...catalogNames.filter((n) => !kept.includes(n))];
  }, [rowOrder, catalogNames]);

  /** 行顺序 + 手动添加、不在字段清单中的自定义列 */
  const allOrderedNames = useMemo(
    () => [
      ...orderedNames,
      ...checkedNames.filter((n) => !orderedNames.includes(n)),
    ],
    [orderedNames, checkedNames],
  );

  /** 派生表格行：顺序固定，勾选只切换 checked 状态，绝不移除或重排当前行 */
  const rows: FieldRow[] = useMemo(() => {
    const byName = new Map<string, FieldOption>();
    catalog.forEach((f) => {
      if (!byName.has(f.name)) byName.set(f.name, f);
    });
    const checkedSet = new Set(checkedNames);
    const result: FieldRow[] = allOrderedNames.map((name) => ({
      name,
      label: byName.get(name)?.label || '',
      checked: all || checkedSet.has(name),
      fromForm: byName.has(name),
    }));
    return result;
  }, [catalog, allOrderedNames, checkedNames, all]);

  /** 服务端已保存配置按列名索引，供行编辑初值与草稿输出共用 */
  const savedByName = useMemo(() => {
    const map = new Map<string, ScopeFieldConfig>();
    savedConfigs.forEach((c) => {
      if (c?.fieldName && !map.has(c.fieldName)) map.set(c.fieldName, c);
    });
    return map;
  }, [savedConfigs]);

  /** 行内元数据编辑：只记「用户改过的键」，未改的仍取服务端回显值 */
  const updateMeta = useCallback((name: string, patch: FieldMetaOverride) => {
    setMetaOverrides((prev) => ({
      ...prev,
      [name]: { ...prev[name], ...patch },
    }));
  }, []);

  /** 某行最终展示的元数据（用户覆盖 > 服务端 > 字段清单） */
  const getMeta = useCallback(
    (name: string, label: string, checked: boolean): FieldMetaOverride => {
      const override = metaOverrides[name];
      const saved = savedByName.get(name);
      return {
        fieldLabel: override?.fieldLabel ?? saved?.fieldLabel ?? label ?? '',
        description: override?.description ?? saved?.description ?? '',
        // 不可见的字段一律不可编辑，与字段管理页的联动约束一致
        isEditable: checked
          ? (override?.isEditable ?? saved?.isEditable ?? 0)
          : 0,
      };
    },
    [metaOverrides, savedByName],
  );

  /**
   * 新增场景：把该菜单已保存的可见字段配置回显成勾选。
   * 默认 visibleField='*' 会让所有字段都勾选，体现不出「哪些字段要展示」的配置；
   * 这里一次性把 * 换成 isVisible!==0 的列名串。编辑场景不传 restoreOnMount，
   * 避免覆盖该条规则原本的 scopeField。
   */
  useEffect(() => {
    if (!restoreOnMount || restoredRef.current || configState !== 'ready')
      return;
    const raw = (value ?? '').trim();
    if (raw !== '' && raw !== '*') {
      restoredRef.current = true;
      return;
    }
    if (!savedConfigs.length) {
      restoredRef.current = true;
      return;
    }
    const names = [...savedConfigs]
      .filter(
        (c) => c?.fieldName && isSafeColumn(c.fieldName) && c.isVisible !== 0,
      )
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
      .map((c) => c.fieldName);
    restoredRef.current = true;
    if (names.length) emit(names.join(','));
  }, [restoreOnMount, configState, savedConfigs, value, emit]);

  /**
   * 输出完整字段草稿：勾选集合 = SQL scopeField = 前端列表展示列。
   * 未勾选字段也一并输出（isVisible=0），避免差集合并删掉其元数据。
   */
  useEffect(() => {
    const draft: ScopeFieldConfig[] = rows
      .map((r, idx) => {
        const saved = savedByName.get(r.name);
        const def = catalogByName.get(r.name);
        const meta = getMeta(r.name, r.label, r.checked);
        return {
          fieldName: r.name,
          fieldLabel: meta.fieldLabel || r.label || r.name,
          // 类型以字段定义为准，落到 blade_scope_field 后列表才能按类型加载能力
          fieldDbType: def?.fieldDbType || saved?.fieldDbType,
          fieldHtmlType: def?.fieldHtmlType || saved?.fieldHtmlType,
          fieldType: def?.fieldType || saved?.fieldType,
          description: meta.description,
          isVisible: r.checked ? 1 : 0,
          isEditable: meta.isEditable ?? 0,
          width: saved?.width,
          align: saved?.align,
          sort: idx,
        } as ScopeFieldConfig;
      })
      .filter((c) => isSafeColumn(c.fieldName));
    fieldsChangeRef.current?.(draft);
  }, [rows, savedByName, catalogByName, getMeta]);

  const visibleRows = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(k) ||
        (r.label || '').toLowerCase().includes(k),
    );
  }, [rows, keyword]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  /** 切换勾选：只改 scopeField 串，行顺序保持不变（当前行不移动、不移除） */
  const toggle = (name: string) => {
    if (disabled) return;
    const order = allOrderedNames.includes(name)
      ? allOrderedNames
      : [...allOrderedNames, name];
    const checkedSet = new Set(all ? allOrderedNames : checkedNames);
    if (checkedSet.has(name)) checkedSet.delete(name);
    else checkedSet.add(name);
    emit(order.filter((n) => checkedSet.has(n)).join(','));
  };

  /** 拖拽重排：改行顺序并同步 SQL 列顺序（只输出已勾选列） */
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (disabled || !over || active.id === over.id) return;
    const oldIndex = allOrderedNames.indexOf(String(active.id));
    const newIndex = allOrderedNames.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(allOrderedNames, oldIndex, newIndex);
    setRowOrder(next);
    const checkedSet = new Set(all ? allOrderedNames : checkedNames);
    emit(next.filter((n) => checkedSet.has(n)).join(','));
  };

  /** 切换「全部字段」：关掉时用当前字段清单显式展开，保证顺序可继续拖拽 */
  const onAllChange = (checked: boolean) => {
    if (disabled) return;
    if (checked) {
      emit('*');
    } else {
      emit(allOrderedNames.join(','));
    }
  };

  const removeCustom = (name: string) => {
    if (disabled) return;
    const base = all ? allOrderedNames : checkedNames;
    emit(base.filter((n) => n !== name).join(','));
  };

  const selectAll = () => emit(allOrderedNames.join(','));
  const clearAll = () => emit('');

  /** 反选：把当前勾选集合取反，行顺序保持不变 */
  const invertSelection = () => {
    const checkedSet = new Set(all ? allOrderedNames : checkedNames);
    emit(allOrderedNames.filter((n) => !checkedSet.has(n)).join(','));
  };

  /** 表头全选状态：全选 / 半选 / 全不选 */
  const headerCheckedSet = new Set(all ? allOrderedNames : checkedNames);
  const headerAllChecked =
    allOrderedNames.length > 0 &&
    allOrderedNames.every((n) => headerCheckedSet.has(n));
  const headerSomeChecked =
    !headerAllChecked && allOrderedNames.some((n) => headerCheckedSet.has(n));
  const handleHeaderCheck = (checked: boolean) => {
    if (checked) selectAll();
    else clearAll();
  };

  /**
   * 表头「隐藏」列的全选状态：与行内同义（勾选 = 隐藏该字段）。
   * 行内是 `checked={!row.checked}`，故「全部隐藏」= 所有行都未展示。
   */
  const headerHiddenAll = rows.length > 0 && rows.every((r) => !r.checked);
  const headerHiddenSome = !headerHiddenAll && rows.some((r) => !r.checked);

  /** 勾选 = 全部隐藏（清空展示集合）；取消勾选 = 全部展示 */
  const handleHeaderHiddenCheck = (checked: boolean) => {
    if (disabled) return;
    if (checked) clearAll();
    else selectAll();
  };

  /**
   * 表头「可编辑」列的全选状态：**仅统计「已勾选展示」的行**
   * （未展示的行本身不可编辑，行内 checkbox 也是 disabled）。
   */
  const editableRows = useMemo(() => rows.filter((r) => r.checked), [rows]);
  const headerEditableAll =
    editableRows.length > 0 &&
    editableRows.every((r) => getMeta(r.name, r.label, true).isEditable === 1);
  const headerEditableSome =
    !headerEditableAll &&
    editableRows.some((r) => getMeta(r.name, r.label, true).isEditable === 1);

  /** 勾选 = 全部可编辑；取消勾选 = 全部不可编辑（只作用于已展示的行） */
  const handleHeaderEditableCheck = (checked: boolean) => {
    if (disabled) return;
    setMetaOverrides((prev) => {
      const next = { ...prev };
      editableRows.forEach((r) => {
        next[r.name] = { ...next[r.name], isEditable: checked ? 1 : 0 };
      });
      return next;
    });
  };

  const needScopeColumn =
    !all &&
    !!scopeColumn &&
    isSafeColumn(scopeColumn) &&
    !checkedNames.includes(scopeColumn);

  return (
    <div
      data-testid="vfs-root"
      style={{
        width: '100%',
        border: '1px solid rgba(0,0,0,0.09)',
        borderRadius: 8,
        padding: 12,
        background: 'rgba(0,0,0,0.015)',
      }}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 10 }}
        message="勾选即表示该字段需在前端列表中展示"
        description="勾选集合同时作为 SQL 可见字段（scopeField）与前端列表动态列（blade_scope_field.is_visible），两者始终同源。字段中文名、说明、顺序、可编辑性直接在下方表格中编辑，随本弹窗「确定」一并保存，无需跳转其它页面。其中「可编辑」控制通用列表的行内编辑；业务表单的字段隐藏/只读是另一套配置，在「表单建模 → 表单权限」按角色设置。"
      />
      <Space size={8} wrap style={{ width: '100%', marginBottom: 10 }}>
        <Tooltip title="等价于 select *，新增字段自动包含">
          <span style={{ whiteSpace: 'nowrap' }}>
            <span style={{ marginRight: 6 }}>全部字段</span>
            <Switch
              size="small"
              checked={all}
              onChange={onAllChange}
              disabled={disabled}
              data-testid="vfs-all-switch"
            />
          </span>
        </Tooltip>
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="选择业务表单以加载字段"
          style={{ width: 240 }}
          value={formId}
          options={formOptions}
          onChange={(v) => {
            setFormId(v);
            if (v) loadFields(v);
            else setFields([]);
            // 切换业务表：清空之前的选择与字段清单，否则旧菜单已保存配置会同名字段残留、
            // 不同表的同名字段会保留旧勾选 / 拖拽顺序 / 行内元数据编辑
            setSavedConfigs([]);
            setHasSavedConfig(false);
            setRowOrder([]);
            setMetaOverrides({});
            emit(all ? '*' : '');
          }}
          disabled={disabled}
          data-testid="vfs-form-select"
        />
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="搜索字段名 / 中文名"
          style={{ width: 200 }}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          disabled={disabled}
          data-testid="vfs-search"
        />
        <Tag color={all ? 'green' : 'blue'} data-testid="vfs-selected-count">
          {all ? '全部字段 (*)' : `已选 ${checkedNames.length} 列`}
        </Tag>
        <Tag color="geekblue">勾选 = 前端列表展示</Tag>
        <Tag color="purple">字段元数据直接在下方编辑，无需跳转</Tag>
        {menuId && (
          <Button
            type="link"
            size="small"
            icon={<TableOutlined />}
            onClick={() =>
              window.open(
                `${window.location.origin}/authority/datascope/grid?menuId=${menuId}`,
                '_blank',
                'noopener,noreferrer',
              )
            }
            data-testid="vfs-grid-preview"
          >
            列表预览
          </Button>
        )}
      </Space>

      {invalidNames.length > 0 && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 8 }}
          message={`存在非法列名：${invalidNames.join(', ')}`}
          description="scopeField 会直接拼接进 SQL，仅允许字母、数字、下划线组成的列名，请修正原值。"
        />
      )}
      {needScopeColumn && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 8 }}
          message={`权限字段 ${scopeColumn} 不在可见字段中`}
          description="后端用 select {可见字段} from (原SQL) scope where scope.{权限字段} ...，派生表缺少该列会导致 SQL 报错，建议勾选该字段。"
        />
      )}

      {/* 表头与行放在同一横向滚动容器内，加列后保持对齐、不互相挤压 */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 1030 }}>
          <div
            style={{
              ...rowStyle,
              fontWeight: 600,
              color: '#666',
              background: 'rgba(0,0,0,0.03)',
              borderTop: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            <span style={{ flex: '0 0 18px' }} />
            <Tooltip title="全选 / 取消全选（勾选 = 前端列表展示）">
              <span
                style={{
                  flex: '0 0 24px',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                <Checkbox
                  checked={headerAllChecked}
                  indeterminate={headerSomeChecked}
                  onChange={(e) => handleHeaderCheck(e.target.checked)}
                  disabled={disabled || !allOrderedNames.length}
                  data-testid="vfs-check-all"
                />
              </span>
            </Tooltip>
            <span style={{ flex: '0 0 140px' }}>列名</span>
            <span style={{ flex: '0 0 92px' }}>数据库类型</span>
            <span style={{ flex: '0 0 92px' }}>组件类型</span>
            <span style={{ flex: '0 0 100px' }}>字段类型</span>
            <span style={{ flex: '1 1 150px' }}>中文名</span>
            <span style={{ flex: '1 1 130px' }}>说明</span>
            <Tooltip title="勾选 = 全部隐藏该字段（不在前端列表展示）；取消勾选 = 全部展示。作用于当前清单的全部字段">
              <span style={{ flex: '0 0 62px', whiteSpace: 'nowrap' }}>
                <Checkbox
                  checked={headerHiddenAll}
                  indeterminate={headerHiddenSome}
                  onChange={(e) => handleHeaderHiddenCheck(e.target.checked)}
                  disabled={disabled || !rows.length}
                  data-testid="vfs-hidden-all"
                >
                  <span style={{ fontSize: 12 }}>隐藏</span>
                </Checkbox>
              </span>
            </Tooltip>
            <Tooltip title="勾选 = 全部字段可编辑；取消勾选 = 全部不可编辑。仅对已勾选展示的字段生效（未展示的行本身不可编辑）">
              <span style={{ flex: '0 0 68px', whiteSpace: 'nowrap' }}>
                <Checkbox
                  checked={headerEditableAll}
                  indeterminate={headerEditableSome}
                  onChange={(e) => handleHeaderEditableCheck(e.target.checked)}
                  disabled={disabled || !editableRows.length}
                  data-testid="vfs-editable-all"
                >
                  <span style={{ fontSize: 12 }}>可编辑</span>
                </Checkbox>
              </span>
            </Tooltip>
            <span style={{ flex: '0 0 24px' }} />
          </div>

          <Spin spinning={loading} size="small">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={visibleRows.map((r) => r.name)}
                strategy={verticalListSortingStrategy}
              >
                <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                  {visibleRows.length ? (
                    visibleRows.map((row) => (
                      <SortableRow
                        key={row.name}
                        row={row}
                        meta={getMeta(row.name, row.label, row.checked)}
                        dbType={catalogByName.get(row.name)?.fieldDbType}
                        compTypeLabel={compTypeOf(row.name)}
                        formTypeLabel={formTypeOf(row.name)}
                        onToggle={toggle}
                        onRemove={removeCustom}
                        onMetaChange={updateMeta}
                        disabled={disabled}
                      />
                    ))
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        keyword
                          ? '无匹配字段'
                          : '该菜单暂无字段配置，可切换业务表单或在下方手动输入列名'
                      }
                      style={{ margin: '16px 0' }}
                    />
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </Spin>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ marginBottom: 4, color: '#666', fontSize: 12 }}>
          原始值（SQL 列清单，只读；由上方勾选自动生成）
        </div>
        <Input
          id={id || 'visibleField'}
          data-testid="vfs-raw"
          value={value ?? ''}
          readOnly
          style={{
            fontFamily: 'monospace',
            background: 'rgba(0,0,0,0.02)',
            cursor: 'default',
          }}
        />
        <Space size={8} wrap style={{ marginTop: 8, width: '100%' }}>
          <Button
            size="small"
            onClick={selectAll}
            disabled={disabled || !allOrderedNames.length}
            data-testid="vfs-select-all"
          >
            全选
          </Button>
          <Button
            size="small"
            onClick={invertSelection}
            disabled={disabled || !allOrderedNames.length}
            data-testid="vfs-invert"
          >
            反选
          </Button>
          <Button
            size="small"
            onClick={clearAll}
            disabled={disabled}
            data-testid="vfs-clear"
          >
            清空
          </Button>
          <Button size="small" onClick={() => emit('*')} disabled={disabled}>
            恢复 *
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default VisibleFieldSelector;
