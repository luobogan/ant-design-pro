import React, { useState, useEffect } from 'react';
import { Table, Card } from 'antd';
import type { TableProps } from 'antd';
import ToolBar, { ButtonConfig } from './ToolBar';
import SearchBox from './SearchBox';
import { getButton } from '@/utils/authority';

/**
 * Grid 组件属性
 */
export interface GridProps<T = any> extends Omit<TableProps<T>, 'dataSource'> {
  /** 页面代码，用于获取按钮权限 */
  code: string;
  /** 表格数据 */
  data: {
    list?: T[];
    records?: T[];
    pagination?: {
      total?: number;
      current?: number;
      pageSize?: number;
    };
  };
  /** 加载状态 */
  loading?: boolean;
  /** 搜索回调 */
  onSearch: (params: any) => void;
  /** 行选择回调 */
  onSelectRow?: (rows: T[]) => void;
  /** 自定义搜索表单 */
  renderSearchForm?: () => React.ReactNode;
  /** 自定义左侧按钮 */
  renderLeftButton?: () => React.ReactNode;
  /** 自定义右侧按钮 */
  renderRightButton?: () => React.ReactNode;
  /** 按钮回调 */
  btnCallBack?: (payload: { btn: ButtonConfig; keys: React.Key[]; rows: T[]; refresh: () => void }) => void;
}

/**
 * Grid 通用表格组件
 * 
 * 集成搜索、表格、分页、按钮等功能
 * 支持权限控制，自动过滤无权限按钮
 * 
 * @example
 * ```tsx
 * <Grid
 *   code="system.user"
 *   columns={columns}
 *   data={userData}
 *   loading={loading}
 *   onSearch={handleSearch}
 *   onSelectRow={handleSelectRow}
 * />
 * ```
 */
const Grid = <T extends Record<string, any>>({
  code,
  data,
  loading = false,
  onSearch,
  onSelectRow,
  renderSearchForm,
  renderLeftButton,
  renderRightButton,
  btnCallBack,
  ...tableProps
}: GridProps<T>) => {
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [buttons, setButtons] = useState<ButtonConfig[]>([]);

  useEffect(() => {
    const btns = getButton(code);
    setButtons(btns || []);
  }, [code]);

  // 处理表格分页变化
  const handleTableChange: TableProps<T>['onChange'] = (pagination, filters, sorter) => {
    setCurrent(pagination.current || 1);
    setPageSize(pagination.pageSize || 10);
    onSearch({
      current: pagination.current,
      size: pagination.pageSize,
      ...filters,
      sorter,
    });
  };

  // 处理行选择
  const handleRowSelection: TableProps<T>['rowSelection'] = {
    selectedRowKeys,
    onChange: (keys) => {
      setSelectedRowKeys(keys);
      // 获取选中的行数据
      const rows = data.list?.filter((item) => keys.includes(item.id)) || [];
      onSelectRow?.(rows);
    },
  };

  // 处理工具栏按钮点击
  const handleToolBarClick = (btn: ButtonConfig) => {
    const refresh = () => {
      onSearch({ current, size: pageSize });
    };
    btnCallBack?.({ btn, keys: selectedRowKeys, rows: [], refresh });
  };

  // 获取数据列表
  const dataSource = data.list || data.records || [];
  const pagination = {
    current,
    pageSize,
    total: data.pagination?.total || 0,
    onChange: (page: number, pageSize?: number) => {
      setCurrent(page);
      setPageSize(pageSize || 10);
    },
  };

  return (
    <Card bordered={false}>
      <div>
        {/* 搜索表单 */}
        {renderSearchForm && (
          <SearchBox onSubmit={() => {}} onReset={() => {}}>
            {renderSearchForm()}
          </SearchBox>
        )}

        {/* 工具栏 */}
        <ToolBar
          buttons={buttons}
          renderLeftButton={renderLeftButton}
          renderRightButton={renderRightButton}
          onClick={handleToolBarClick}
        />

        {/* 表格 */}
        <Table
          rowKey="id"
          loading={loading}
          dataSource={dataSource}
          pagination={pagination}
          rowSelection={handleRowSelection}
          onChange={handleTableChange}
          {...tableProps}
        />
      </div>
    </Card>
  );
};

export default Grid;
