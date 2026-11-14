/**
 * 数据权限「可见字段」动态列表组件（统一封装）
 *
 * 目标：任意业务列表页只需传入 menuId 与 dataSource/request，即可按
 * 数据权限里配置的可见字段动态生成表头，无需在页面里硬编码列。
 *
 * 数据来源：blade_scope_field（ScopeFieldController /scope-field/list）。
 * 关联键：menuId（主）；可选 scopeId 精确到某条数据权限规则、resourceCode 按资源编号。
 *
 * 分层：
 *   - useScopeFieldColumns：只负责「取配置 → 生成 ProColumns」，可配合任意 ProTable
 *   - DynamicScopeTable：开箱即用列表，内部复用 StandardTable 的分页归一化
 *
 * 关键约定：
 *   1) 只有 isVisible === 1 的字段才生成列；按 sort 升序
 *   2) title 用 fieldLabel（中文名），回退 fieldName；dataIndex 用 fieldName
 *   3) fieldDbType 决定渲染类型（datetime→dateTime、数值→digit、其余 text）
 *   4) 未配置时（返回空）回退到 fallbackColumns，保证列表不会白屏（fail-open）
 *   5) 配置里的附加列（如操作列）通过 extraColumns 追加在末尾
 */
import type { ProColumns } from '@ant-design/pro-components';
import { Alert, Empty, Spin } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import StandardTable from '@/components/StandardTable';
import {
  listScopeFields,
  type ScopeFieldConfig,
} from '@/services/authority/dataPermission';

export interface ScopeFieldQuery {
  menuId?: string | number;
  scopeId?: string | number;
  resourceCode?: string;
}

export interface UseScopeFieldColumnsOptions<T> extends ScopeFieldQuery {
  /** 未配置时的回退列（建议传页面原本的静态列） */
  fallbackColumns?: ProColumns<T>[];
  /** 追加在动态列之后的固定列（如操作列） */
  extraColumns?: ProColumns<T>[];
  /** 是否隐藏不可见字段（默认 true） */
  onlyVisible?: boolean;
  /** 外部数据变更后改变此值即可重新拉取列配置（如字段管理页保存后） */
  refreshToken?: string | number;
}

/** 依数据库类型推导 ProTable 的 valueType */
const resolveValueType = (dbType?: string): string => {
  const t = (dbType || '').toLowerCase();
  if (!t) return 'text';
  if (/(datetime|timestamp)/.test(t)) return 'dateTime';
  if (/^date$|^time$/.test(t)) return t === 'date' ? 'date' : 'text';
  if (/(int|decimal|numeric|float|double|bigint)/.test(t)) return 'digit';
  if (/(text|blob|json)/.test(t)) return 'textarea';
  return 'text';
};

/** 把一条配置转成 ProColumns 列定义 */
export const toProColumn = <T extends Record<string, any>>(
  f: ScopeFieldConfig,
): ProColumns<T> => ({
  title: f.fieldLabel || f.fieldName,
  dataIndex: f.fieldName,
  key: f.fieldName,
  valueType: resolveValueType(f.fieldDbType) as any,
  // 后端 width 默认 -1（表示未设置），-1 是 truthy，直接透传会让 antd 把列压到几十像素
  width: typeof f.width === 'number' && f.width > 0 ? f.width : undefined,
  align: (f.align as any) || undefined,
  tooltip: f.description || undefined,
  ellipsis: true,
  hideInSearch: true,
});

export interface UseScopeFieldColumnsResult<T> {
  columns: ProColumns<T>[];
  /** 服务端返回的原始配置（未过滤） */
  configs: ScopeFieldConfig[];
  /** 是否使用了回退列 */
  usingFallback: boolean;
  loading: boolean;
  error?: Error;
  refresh: () => void;
}

/**
 * 只生成列的 hook：适合已有 ProTable、只想替换 columns 的页面。
 */
export function useScopeFieldColumns<T extends Record<string, any>>(
  options: UseScopeFieldColumnsOptions<T>,
): UseScopeFieldColumnsResult<T> {
  const {
    menuId, scopeId, resourceCode, fallbackColumns, extraColumns,
    onlyVisible = true, refreshToken,
  } = options;

  // 显式 effect 拉取：配置在「字段管理」页保存后必须立即生效。
  // 不用 useRequest 的 cacheKey/refresh：其 refresh 与 refreshDeps 组合下
  // 可能保留挂载时的空结果，导致列表一直显示回退列。
  const [configs, setConfigs] = useState<ScopeFieldConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [reloadTick, setReloadTick] = useState(0);
  const refresh = useCallback(() => setReloadTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    if (!menuId && !scopeId && !resourceCode) {
      setConfigs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    listScopeFields({ menuId, scopeId, resourceCode })
      .then((res) => {
        if (cancelled) return;
        setConfigs(Array.isArray(res) ? res : []);
        setError(undefined);
      })
      .catch((e) => {
        if (cancelled) return;
        setConfigs([]);
        setError(e as Error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [menuId, scopeId, resourceCode, refreshToken, reloadTick]);

  const visible = useMemo(() => {
    const list = onlyVisible
      ? configs.filter((f) => f.isVisible === undefined || f.isVisible === 1)
      : configs;
    return [...list].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  }, [configs, onlyVisible]);

  const columns = useMemo<ProColumns<T>[]>(() => {
    const dynamic = visible.map((f) => toProColumn<T>(f));
    const base = dynamic.length ? dynamic : (fallbackColumns ?? []);
    return [...base, ...(extraColumns ?? [])];
  }, [visible, fallbackColumns, extraColumns]);

  return {
    columns,
    configs,
    usingFallback: visible.length === 0 && !!fallbackColumns?.length,
    loading,
    error,
    refresh,
  };
}

export interface DynamicScopeTableProps<T extends Record<string, any>>
  extends ScopeFieldQuery {
  /** 列表数据；与 request 二选一 */
  dataSource?: T[];
  /** ProTable 的 request，二选一 */
  request?: any;
  rowKey?: string;
  /** 未配置可见字段时的回退列 */
  fallbackColumns?: ProColumns<T>[];
  /** 追加在末尾的固定列（如操作列） */
  extraColumns?: ProColumns<T>[];
  /** 配置加载失败时是否提示（默认 true） */
  showError?: boolean;
  /** 无配置且无回退列时是否提示（默认 true） */
  showEmptyHint?: boolean;
  /** 透传给 ProTable 的其余属性 */
  tableProps?: Record<string, any>;
  onlyVisible?: boolean;
  /** 配置变更后改变此值可刷新动态列 */
  refreshToken?: string | number;
}

/**
 * 开箱即用的动态列列表。
 *
 * @example
 * <DynamicScopeTable
 *   menuId={currentMenu.id}
 *   rowKey="id"
 *   request={async (params) => queryBizData(params)}
 *   extraColumns={[{ title: '操作', valueType: 'option', render: (...) => [...] }]}
 *   fallbackColumns={defaultColumns}
 * />
 */
function DynamicScopeTable<T extends Record<string, any>>(
  props: DynamicScopeTableProps<T>,
) {
  const {
    menuId, scopeId, resourceCode,
    dataSource, request, rowKey = 'id',
    fallbackColumns, extraColumns,
    showError = true, showEmptyHint = true,
    tableProps, onlyVisible, refreshToken,
  } = props;

  const { columns, configs, usingFallback, loading, error, refresh } =
    useScopeFieldColumns<T>({
      menuId, scopeId, resourceCode, fallbackColumns, extraColumns, onlyVisible, refreshToken,
    });

  const hint = error && showError ? (
    <Alert
      type="warning"
      showIcon
      style={{ marginBottom: 12 }}
      message="可见字段配置加载失败，已使用默认列"
      action={<a onClick={refresh}>重试</a>}
    />
  ) : configs.length === 0 && usingFallback && showEmptyHint ? (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 12 }}
      message="当前菜单尚未配置可见字段，展示默认列"
      description="可在「数据权限 → 字段管理」中配置可见字段及其显示名称。"
    />
  ) : null;

  return (
    <div data-testid="dynamic-scope-table">
      {hint}
      <Spin spinning={loading}>
        {columns.length ? (
          <StandardTable<T>
            rowKey={rowKey}
            columns={columns}
            dataSource={dataSource}
            request={request}
            {...(tableProps as any)}
          />
        ) : (
          <Empty description="暂无可展示的字段" />
        )}
      </Spin>
    </div>
  );
}

export default DynamicScopeTable;
