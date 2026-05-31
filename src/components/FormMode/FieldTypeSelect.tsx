import React, { useState, useEffect } from 'react';
import { Select, TreeSelect } from 'antd';
import { fieldApi } from '@/services/formmode';
import type { FieldTypeInfo } from '@/services/formmode/typings';

interface FieldTypeSelectProps {
  /** 选中值 */
  value?: string;
  /** 值变化回调 */
  onChange?: (value: string) => void;
  /** 占位符 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 选择模式：select-下拉选择，tree-树形选择 */
  mode?: 'select' | 'tree';
}

/**
 * 字段类型选择组件
 * 用于选择字段类型（fieldhtmltype + type）
 * 支持下拉选择和树形选择两种模式
 */
const FieldTypeSelect: React.FC<FieldTypeSelectProps> = ({
  value,
  onChange,
  placeholder = '请选择字段类型',
  disabled = false,
  mode = 'select',
}) => {
  const [fieldTypes, setFieldTypes] = useState<FieldTypeInfo[]>([]);
  const [loading, setLoading] = useState(false);

  // 获取字段类型列表
  const fetchFieldTypes = async () => {
    setLoading(true);
    try {
      const result = await fieldApi.getFieldTypes();
      setFieldTypes(result || []);
    } catch (error) {
      console.error('获取字段类型失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchFieldTypes();
  }, []);

  // 将字段类型转换为 Select 选项
  const selectOptions = fieldTypes.map((type) => ({
    value: `${type.htmlType}-${type.type}`,
    label: type.name,
    description: type.description,
  }));

  // 将字段类型转换为 TreeSelect 树形数据
  const treeData = [
    {
      value: '1',
      title: '文本字段',
      children: fieldTypes
        .filter((type) => type.htmlType === 1)
        .map((type) => ({
          value: `${type.htmlType}-${type.type}`,
          title: type.name,
        })),
    },
    {
      value: '2',
      title: '浏览按钮',
      children: fieldTypes
        .filter((type) => type.htmlType === 2)
        .map((type) => ({
          value: `${type.htmlType}-${type.type}`,
          title: type.name,
        })),
    },
    {
      value: '3',
      title: '选择框',
      children: fieldTypes
        .filter((type) => type.htmlType === 3)
        .map((type) => ({
          value: `${type.htmlType}-${type.type}`,
          title: type.name,
        })),
    },
    {
      value: '4',
      title: '附件上传',
      children: fieldTypes
        .filter((type) => type.htmlType === 4)
        .map((type) => ({
          value: `${type.htmlType}-${type.type}`,
          title: type.name,
        })),
    },
    {
      value: '5',
      title: '特殊字段',
      children: fieldTypes
        .filter((type) => type.htmlType === 5)
        .map((type) => ({
          value: `${type.htmlType}-${type.type}`,
          title: type.name,
        })),
    },
    {
      value: '6',
      title: '复选框',
      children: fieldTypes
        .filter((type) => type.htmlType === 6)
        .map((type) => ({
          value: `${type.htmlType}-${type.type}`,
          title: type.name,
        })),
    },
  ];

  if (mode === 'tree') {
    return (
      <TreeSelect
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        loading={loading}
        treeData={treeData}
        style={{ width: '100%' }}
        allowClear
      />
    );
  }

  return (
    <Select
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      loading={loading}
      options={selectOptions}
      style={{ width: '100%' }}
      allowClear
      showSearch
      optionFilterProp="label"
    />
  );
};

export default FieldTypeSelect;
