import React from 'react';
import { ProTable } from '@ant-design/pro-components';
import type { ProTableProps } from '@ant-design/pro-components';

export const DEFAULT_PAGE_SIZE = 10;

/**
 * 统一列表分页组件。
 *
 * 封装 ProTable 并固化分页默认行为，避免各页面散落 `pagination={{ pageSize: N }}`
 * 导致的受控分页 bug（pro-table 的 mergePagination 会在 pageSize 有值时写死该值，
 * 使「每页条数」切换失效）。
 *
 * 这里主动把 `pageSize` 归一化为非受控的 `defaultPageSize`，即使调用方仍写 `pageSize`
 * 也不会复发该问题；后续要调整分页默认值/选项只需改这一个文件。
 */
function StandardTable<T extends Record<string, any>, U extends Record<string, any> = any>(
  props: ProTableProps<T, U>,
) {
  const { pagination, ...rest } = props;

  // 调用方显式关闭分页时直接透传，不做任何归一化
  if (pagination === false) {
    return <ProTable<T, U> {...(rest as ProTableProps<T, U>)} pagination={false} />;
  }

  const normalized: Record<string, any> = { ...(pagination || {}) };
  if (normalized.pageSize != null) {
    if (normalized.defaultPageSize == null) {
      normalized.defaultPageSize = normalized.pageSize;
    }
    delete normalized.pageSize;
  }

  const merged = {
    defaultPageSize: DEFAULT_PAGE_SIZE,
    showSizeChanger: true,
    showQuickJumper: true,
    pageSizeOptions: ['10', '20', '50', '100'],
    ...normalized,
  };

  return (
    <ProTable<T, U>
      {...(rest as ProTableProps<T, U>)}
      pagination={merged as ProTableProps<T, U>['pagination']}
    />
  );
}

export default StandardTable;
