import React from 'react';
import { Card, Input, Tree, Badge } from 'antd';
import { useDrag } from 'react-dnd';
import {
  FontSizeOutlined,
  NumberOutlined,
  CalendarOutlined,
  DownOutlined,
  CheckSquareOutlined,
  RadiusBottomleftOutlined,
  FileTextOutlined,
  PaperClipOutlined,
  EditOutlined,
  GroupOutlined,
  NodeIndexOutlined,
  HighlightOutlined,
} from '@ant-design/icons';

/**
 * 字段面板组件
 * 显示可拖拽的字段类型
 * 参照迁移文档 §4.3 单元格操作 API 映射 + §6 数据验证类型
 */

interface FieldType {
  type: string;
  label: string;
  icon: React.ReactNode;
  category: string;
}

// 可拖拽的字段项组件
const DraggableFieldItem: React.FC<{
  field: FieldType;
  onFieldSelect: (field: any) => void;
}> = ({ field, onFieldSelect }) => {
  const [{ isDragging }, dragRef] = useDrag(() => ({
    type: 'FIELD',
    item: field,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={dragRef as any}
      style={{
        display: 'flex',
        alignItems: 'center',
        cursor: 'grab',
        opacity: isDragging ? 0.5 : 1,
        padding: '4px 8px',
        borderRadius: 4,
        transition: 'background-color 0.2s',
      }}
      onClick={() => onFieldSelect(field)}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      <span style={{ marginRight: 8 }}>{field.icon}</span>
      <span>{field.label}</span>
    </div>
  );
};

interface FieldPaletteProps {
  onFieldSelect: (field: any) => void;
}

const FieldPalette: React.FC<FieldPaletteProps> = ({ onFieldSelect }) => {
  const [searchText, setSearchText] = React.useState('');

  // 参照迁移文档 §6.2 支持的验证类型 - 完整字段类型列表
  const fieldTypes: FieldType[] = [
    { type: 'text', label: '单行文本', icon: <FontSizeOutlined />, category: '基础字段' },
    { type: 'number', label: '数字', icon: <NumberOutlined />, category: '基础字段' },
    { type: 'wholeNumber', label: '整数', icon: <NodeIndexOutlined />, category: '基础字段' },
    { type: 'date', label: '日期', icon: <CalendarOutlined />, category: '基础字段' },
    { type: 'datetime', label: '日期时间', icon: <CalendarOutlined />, category: '基础字段' },
    { type: 'select', label: '下拉框', icon: <DownOutlined />, category: '选择字段' },
    { type: 'checkbox', label: '复选框', icon: <CheckSquareOutlined />, category: '选择字段' },
    { type: 'radio', label: '单选框', icon: <RadiusBottomleftOutlined />, category: '选择字段' },
    { type: 'textarea', label: '多行文本', icon: <EditOutlined />, category: '文本字段' },
    { type: 'richtext', label: '富文本', icon: <FileTextOutlined />, category: '文本字段' },
    { type: 'attachment', label: '附件', icon: <PaperClipOutlined />, category: '高级字段' },
    { type: 'custom', label: '自定义', icon: <HighlightOutlined />, category: '高级字段' },
    { type: 'group', label: '分组框', icon: <GroupOutlined />, category: '布局字段' },
  ];

  const treeData = [
    {
      title: '基础字段',
      key: 'group-base',
      children: fieldTypes
        .filter(f => f.category === '基础字段')
        .map(f => ({
          title: <DraggableFieldItem field={f} onFieldSelect={onFieldSelect} />,
          key: 'field-' + f.type,
        })),
    },
    {
      title: '选择字段',
      key: 'group-select',
      children: fieldTypes
        .filter(f => f.category === '选择字段')
        .map(f => ({
          title: <DraggableFieldItem field={f} onFieldSelect={onFieldSelect} />,
          key: 'field-' + f.type,
        })),
    },
    {
      title: '文本字段',
      key: 'group-text',
      children: fieldTypes
        .filter(f => f.category === '文本字段')
        .map(f => ({
          title: <DraggableFieldItem field={f} onFieldSelect={onFieldSelect} />,
          key: 'field-' + f.type,
        })),
    },
    {
      title: '高级字段',
      key: 'group-advanced',
      children: fieldTypes
        .filter(f => f.category === '高级字段' || f.category === '布局字段')
        .map(f => ({
          title: <DraggableFieldItem field={f} onFieldSelect={onFieldSelect} />,
          key: 'field-' + f.type,
        })),
    },
  ];

  const filteredTreeData = searchText
    ? treeData
        .map(group => ({
          ...group,
          children: group.children?.filter((child: any) => {
            const fieldType = fieldTypes.find(ft => 'field-' + ft.type === child.key);
            return fieldType ? fieldType.label.includes(searchText) : true;
          }),
        }))
        .filter(group => group.children && group.children.length > 0)
    : treeData;

  return (
    <Card
      title={
        <span>
          <Badge count={fieldTypes.length} showZero={false} size="small" offset={[6, 0]}>
            字段面板
          </Badge>
        </span>
      }
      size="small"
      style={{ height: '100%', overflow: 'auto' }}
    >
      <Input
        placeholder="搜索字段类型"
        value={searchText}
        onChange={e => setSearchText(e.target.value)}
        style={{ marginBottom: 16 }}
        allowClear
      />
      <Tree
        treeData={filteredTreeData}
        defaultExpandAll
        showIcon={false}
        switcherIcon={<DownOutlined />}
      />
    </Card>
  );
};

export default FieldPalette;
