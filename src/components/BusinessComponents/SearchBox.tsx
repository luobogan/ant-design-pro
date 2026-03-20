import React from 'react';
import { Form, Button, Space } from 'antd';

/**
 * SearchBox 组件属性
 */
export interface SearchBoxProps {
  /** 提交回调 */
  onSubmit: (e: React.FormEvent) => void;
  /** 重置回调 */
  onReset: () => void;
  /** 子内容（搜索表单字段） */
  children: React.ReactNode;
}

/**
 * SearchBox 搜索框组件
 * 
 * 用于封装搜索表单，提供统一的查询/重置按钮
 * 支持自定义搜索字段
 * 
 * @example
 * ```tsx
 * <SearchBox
 *   onSubmit={handleSearch}
 *   onReset={handleReset}
 * >
 *   <Input name="keyword" placeholder="请输入关键词" />
 * </SearchBox>
 * ```
 */
const SearchBox: React.FC<SearchBoxProps> = ({
  onSubmit,
  onReset,
  children,
}) => {
  return (
    <Form onFinish={onSubmit} style={{ marginBottom: 24 }}>
      {children}
      <Form.Item style={{ marginTop: 16 }}>
        <Space>
          <Button type="primary" htmlType="submit">
            查询
          </Button>
          <Button onClick={onReset}>重置</Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default SearchBox;
