import React, { useEffect, useState } from 'react';
import { Card, Input, Tree, Badge, Spin } from 'antd';
import { useDrag } from 'react-dnd';
import {
  FontSizeOutlined,
  EditOutlined,
  CalendarOutlined,
  DownOutlined,
  CheckSquareOutlined,
  PaperClipOutlined,
  TableOutlined,
  UnorderedListOutlined,
  NumberOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { fieldDefinitionApi } from '@/services/formmode';
import type { FieldDefinition } from '@/services/formmode/typings';

/**
 * 字段面板组件
 * 显示表单的主表字段和明细表字段
 * 支持从后端加载字段定义
 */

// 根据字段HTML类型和详细类型获取图标
const getFieldIcon = (field: FieldDefinition): React.ReactNode => {
  const { fieldHtmlType, fieldType } = field;

  // fieldhtmltype=1 文本字段
  if (fieldHtmlType === 1) {
    if (fieldType === 1) return <FontSizeOutlined />;  // 单行文本
    if (fieldType === 2) return <EditOutlined />;       // 多行文本
    return <FontSizeOutlined />;
  }
  // fieldhtmltype=2 浏览按钮
  if (fieldHtmlType === 2) return <TableOutlined />;
  // fieldhtmltype=3 选择框
  if (fieldHtmlType === 3) return <DownOutlined />;
  // fieldhtmltype=4 附件
  if (fieldHtmlType === 4) return <PaperClipOutlined />;
  // fieldhtmltype=5 特殊字段（日期、时间）
  if (fieldHtmlType === 5) return <CalendarOutlined />;
  // fieldhtmltype=6 复选框
  if (fieldHtmlType === 6) return <CheckSquareOutlined />;
  // fieldhtmltype=8 下拉选择框
  if (fieldHtmlType === 8) return <DownOutlined />;
  // fieldhtmltype=9 树形选择
  if (fieldHtmlType === 9) return <UnorderedListOutlined />;

  return <FontSizeOutlined />;
};

// 可拖拽的标签组件
const DraggableLabelItem: React.FC<{
  field: FieldDefinition;
  displayFieldLabel: string;
  displayFieldName: string;
}> = ({ field, displayFieldLabel, displayFieldName }) => {
  const [{ isDragging }, dragRef] = useDrag(() => ({
    type: 'FIELD',
    item: {
      ...field,
      type: 'formLabel', // 标识为标签类型
      fieldName: displayFieldName,
      fieldLabel: displayFieldLabel,
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [field, displayFieldLabel, displayFieldName]);

  const handleDragStart = (e: React.DragEvent) => {
    const labelData = {
      id: field.id,
      fieldId: field.id,
      fieldName: displayFieldName,
      fieldLabel: displayFieldLabel,
      fieldHtmlType: field.fieldHtmlType,
      fieldType: field.fieldType,
      type: 'formLabel', // 标识为标签类型
      required: field.required || false,
      readonly: field.readonly || false,
      defaultValue: '',
      placeholder: '',
      options: [],
    };

    (window as any).__pendingField = labelData;
    e.dataTransfer.setData('application/json', JSON.stringify(labelData));
    e.dataTransfer.setData('text/plain', displayFieldLabel);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      ref={dragRef as any}
      onDragStart={handleDragStart}
      style={{
        display: 'flex',
        alignItems: 'center',
        cursor: 'grab',
        opacity: isDragging ? 0.5 : 1,
        padding: '2px 4px',
        borderRadius: 4,
        transition: 'background-color 0.2s',
        fontSize: '13px',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#e6f7ff';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
      title="拖拽标签到表格"
    >
      <span style={{ marginRight: 6, color: '#1890ff' }}>{getFieldIcon(field)}</span>
      <span>{displayFieldLabel}</span>
    </div>
  );
};

// 可拖拽的字段组件
const DraggableFieldOnlyItem: React.FC<{
  field: FieldDefinition;
  displayFieldLabel: string;
  displayFieldName: string;
}> = ({ field, displayFieldLabel, displayFieldName }) => {
  const [{ isDragging }, dragRef] = useDrag(() => ({
    type: 'FIELD',
    item: {
      ...field,
      type: 'formField', // 标识为字段类型
      fieldName: displayFieldName,
      fieldLabel: displayFieldLabel,
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [field, displayFieldLabel, displayFieldName]);

  const handleDragStart = (e: React.DragEvent) => {
    const fieldData = {
      id: field.id,
      fieldId: field.id,
      fieldName: displayFieldName,
      fieldLabel: displayFieldLabel,
      fieldHtmlType: field.fieldHtmlType,
      fieldType: field.fieldType,
      type: 'formField',
      required: field.required || false,
      readonly: field.readonly || false,
      defaultValue: field.defaultValue || '',
      placeholder: field.placeholder || '',
      options: field.options || [],
    };

    (window as any).__pendingField = fieldData;
    e.dataTransfer.setData('application/json', JSON.stringify(fieldData));
    e.dataTransfer.setData('text/plain', displayFieldName);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      ref={dragRef as any}
      onDragStart={handleDragStart}
      style={{
        display: 'flex',
        alignItems: 'center',
        cursor: 'grab',
        opacity: isDragging ? 0.5 : 1,
        padding: '2px 4px',
        borderRadius: 4,
        transition: 'background-color 0.2s',
        fontSize: '12px',
        color: '#999',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#e6f7ff';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
      title="拖拽字段到表格"
    >
      <span>{displayFieldName || '-'}</span>
    </div>
  );
};

// 字段项组件 - 双列布局：标签 + 字段（各自可拖动）
const DraggableFieldItem: React.FC<{
  field: FieldDefinition;
  onFieldSelect: (field: any) => void;
  onFieldHover?: (field: any | null) => void;
}> = ({ field, onFieldSelect, onFieldHover }) => {
  // 获取字段名称，支持多种属性名
  const displayFieldName = field.fieldName || field.fieldDbName || field.name || field.columnName || '';
  // 获取字段标签，支持多种属性名
  const displayFieldLabel = field.fieldLabel || field.label || displayFieldName || '未命名字段';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '2px 0',
        borderRadius: 4,
        transition: 'background-color 0.2s',
        width: '100%',
      }}
      onClick={() => onFieldSelect(field)}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#f5f5f5';
        onFieldHover?.(field);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        onFieldHover?.(null);
      }}
    >
      {/* 第一列：可拖动的标签 */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingRight: 8 }}>
        <DraggableLabelItem
          field={field}
          displayFieldLabel={displayFieldLabel}
          displayFieldName={displayFieldName}
        />
      </div>

      {/* 第二列：可拖动的字段 */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 8,
        borderLeft: '1px solid #e8e8e8'
      }}>
        <DraggableFieldOnlyItem
          field={field}
          displayFieldLabel={displayFieldLabel}
          displayFieldName={displayFieldName}
        />
      </div>
    </div>
  );
};

interface FieldPaletteProps {
  onFieldSelect: (field: any) => void;
  onFieldHover?: (field: any | null) => void;
  formId?: string;
}

const FieldPalette: React.FC<FieldPaletteProps> = ({ onFieldSelect, onFieldHover, formId }) => {
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [mainTableFields, setMainTableFields] = useState<FieldDefinition[]>([]);
  const [detailTableFields, setDetailTableFields] = useState<Record<number, FieldDefinition[]>>({});

  // 加载表单字段
  useEffect(() => {
    if (!formId) {
      setFields([]);
      setMainTableFields([]);
      setDetailTableFields({});
      return;
    }

    const loadFields = async () => {
      setLoading(true);
      try {
        const data = await fieldDefinitionApi.getByFormId(formId);
        console.log('[FieldPalette] 原始字段数据:', data);
        if (data && data.length > 0) {
          console.log('[FieldPalette] 第一条字段完整数据:', data[0]);
          console.log('[FieldPalette] fieldName:', data[0]?.fieldName, '| fieldLabel:', data[0]?.fieldLabel);
        }
        if (data) {
          // 过滤掉已删除的字段（双重保障）
          // 兼容后端返回的字段命名：isDeleted（驼峰）或 is_deleted（下划线）
          const filteredData = data.filter(f => {
            // 兼容两种命名格式
            const deletedFlag = f.isDeleted !== undefined ? f.isDeleted : f.is_deleted;
            const statusValue = f.status;

            const isDeleted = deletedFlag === 1 || statusValue === -1;
            if (isDeleted) {
              console.log('[FieldPalette] 过滤已删除字段:', f.fieldName, f.fieldLabel, '| isDeleted:', deletedFlag, '| status:', statusValue);
            }
            return !isDeleted;
          });

          console.log('[FieldPalette] 原始字段数:', data.length, '过滤后字段数:', filteredData.length);
          setFields(filteredData);

          // 分离主表字段和明细表字段
          const mainFields = filteredData.filter(f => f.isMain === 1 || f.detailTable === 0 || f.detailTable === undefined);
          const detailFields: Record<number, FieldDefinition[]> = {};

          filteredData.forEach(f => {
            if (f.isMain === 0 && f.detailTable && f.detailTable > 0) {
              if (!detailFields[f.detailTable]) {
                detailFields[f.detailTable] = [];
              }
              detailFields[f.detailTable].push(f);
            }
          });

          setMainTableFields(mainFields);
          setDetailTableFields(detailFields);
        }
      } catch (error) {
        console.error('[FieldPalette] 加载字段失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFields();
  }, [formId]);

  // 构建树形数据
  const buildTreeData = () => {
    const groups: any[] = [];

    // 主表字段
    if (mainTableFields.length > 0) {
      const filteredMain = searchText
        ? mainTableFields.filter(f =>
            f.fieldLabel.includes(searchText) || f.fieldName.includes(searchText)
          )
        : mainTableFields;

      if (filteredMain.length > 0) {
        groups.push({
          title: `主表字段 (${filteredMain.length})`,
          key: 'group-main',
          children: filteredMain.map(f => ({
            title: <DraggableFieldItem field={f} onFieldSelect={onFieldSelect} onFieldHover={onFieldHover} />,
            key: 'field-' + f.id,
          })),
        });
      }
    }

    // 明细表字段
    Object.keys(detailTableFields).forEach(detailTableNum => {
      const num = Number(detailTableNum);
      const fields = detailTableFields[num];
      const filtered = searchText
        ? fields.filter(f =>
            f.fieldLabel.includes(searchText) || f.fieldName.includes(searchText)
          )
        : fields;

      if (filtered.length > 0) {
        groups.push({
          title: `明细表${num} (${filtered.length})`,
          key: `group-detail-${num}`,
          children: filtered.map(f => ({
            title: <DraggableFieldItem field={f} onFieldSelect={onFieldSelect} onFieldHover={onFieldHover} />,
            key: 'field-' + f.id,
          })),
        });
      }
    });

    return groups;
  };

  const treeData = buildTreeData();

  const totalCount = mainTableFields.length + Object.values(detailTableFields).reduce((sum, arr) => sum + arr.length, 0);

  if (!formId) {
    return (
      <Card
        title="字段面板"
        size="small"
        style={{ height: '100%', overflow: 'auto' }}
      >
        <div style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>
          请先选择表单
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={
        <span>
          <Badge count={totalCount} showZero={false} size="small" offset={[6, 0]}>
            字段面板
          </Badge>
        </span>
      }
      size="small"
      style={{ height: '100%', overflow: 'auto' }}
      extra={loading ? <Spin size="small" /> : null}
    >
      <Input
        placeholder="搜索字段（名称/标识）"
        value={searchText}
        onChange={e => setSearchText(e.target.value)}
        style={{ marginBottom: 16 }}
        allowClear
      />

      {/* 表头：标签 + 字段双列布局 */}
      <div style={{
        display: 'flex',
        padding: '8px 0',
        borderBottom: '1px solid #e8e8e8',
        marginBottom: 8,
        fontSize: '12px',
        color: '#666',
        fontWeight: 'bold'
      }}>
        <div style={{ flex: 1, paddingRight: 8 }}>标签</div>
        <div style={{ flex: 1, paddingLeft: 8, borderLeft: '1px solid #e8e8e8' }}>字段</div>
      </div>

      {/* 简单列表渲染，避免 Tree 组件的缩进影响双列布局 */}
      {treeData.length > 0 ? (
        <div>
          {treeData.map((group: any) => (
            <div key={group.key}>
              {/* 分组标题 */}
              <div style={{
                padding: '8px 0 4px 0',
                fontSize: '12px',
                color: '#1890ff',
                fontWeight: 'bold'
              }}>
                {group.title}
              </div>
              {/* 分组下的字段列表 */}
              {group.children?.map((child: any) => (
                <div key={child.key}>{child.title}</div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>
          {loading ? '加载中...' : '暂无字段数据'}
        </div>
      )}
    </Card>
  );
};

export default FieldPalette;
