import React, { useState, useEffect, useRef } from 'react';
import { Select, Spin } from 'antd';
import type { SelectProps } from 'antd/es/select';
import { browserApi } from '@/services/formmode';

 interface BrowserSelectProps extends Omit<SelectProps<any>, 'onSearch' | 'onChange'> {
  /** 浏览框类型（对应泛微的 browserType） */
  browserType: number;
  /** 值 */
  value?: any;
  /** 值变化回调 */
  onChange?: (value: any) => void;
  /** 是否多选 */
  multiple?: boolean;
  /** 占位符 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
}

interface BrowserOption {
  value: string;
  label: string;
  [key: string]: any;
}

/**
 * 浏览框选择组件
 * 使用 Ant Design Select 组件替代泛微的浏览框
 * 支持单选、多选、搜索、分页加载
 */
const BrowserSelect: React.FC<BrowserSelectProps> = ({
  browserType,
  value,
  onChange,
  multiple = false,
  placeholder = '请选择',
  disabled = false,
  ...restProps
}) => {
  const [options, setOptions] = useState<BrowserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  
  const pageSize = 20;
  const triggerRef = useRef<any>(null);

  // 获取浏览框数据
  const fetchData = async (keyword?: string, pageNum: number = 1, append: boolean = false) => {
    setLoading(true);
    try {
      const params: any = {
        current: pageNum,
        pageSize,
      };
      
      if (keyword) {
        params.keyword = keyword;
      }

      const result = await browserApi.getList(browserType, params);
      
      const newOptions = (result.list || []).map((item: any) => ({
        value: item.id?.toString() || '',
        label: item.name || item.label || '',
        ...item,
      }));

      if (append) {
        setOptions(prev => [...prev, ...newOptions]);
      } else {
        setOptions(newOptions);
      }

      setTotal(result.total || 0);
      setHasMore(pageNum * pageSize < (result.total || 0));
    } catch (error) {
      console.error('获取浏览框数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    if (browserType) {
      fetchData();
    }
  }, [browserType]);

  // 搜索
  const handleSearch = (keyword: string) => {
    setSearchValue(keyword);
    setPage(1);
    fetchData(keyword, 1, false);
  };

  // 滚动加载更多
  const handlePopupScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    if (target.scrollHeight - target.scrollTop === target.clientHeight) {
      if (!loading && hasMore) {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchData(searchValue, nextPage, true);
      }
    }
  };

  return (
    <Select
      value={value}
      onChange={onChange}
      mode={multiple ? 'multiple' : undefined}
      placeholder={placeholder}
      disabled={disabled}
      showSearch
      filterOption={false}
      onSearch={handleSearch}
      notFoundContent={loading ? <Spin size="small" /> : '暂无数据'}
      {...restProps}
    >
      {options.map(option => (
        <Select.Option key={option.value} value={option.value} {...option}>
          {option.label}
        </Select.Option>
      ))}
      {loading && (
        <Select.Option disabled value="loading">
          <Spin size="small" /> 加载中...
        </Select.Option>
      )}
      {!loading && hasMore && options.length > 0 && (
        <Select.Option disabled value="loadMore">
          滚动加载更多...
        </Select.Option>
      )}
    </Select>
  );
};

export default BrowserSelect;
