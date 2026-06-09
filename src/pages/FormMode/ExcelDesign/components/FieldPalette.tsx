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

// 可拖拽的字段项组件 - 双列布局：标签 + 字段
const DraggableFieldItem: React.FC<{
  field: FieldDefinition;
  onFieldSelect: (field: any) => void;
  onFieldHover?: (field: any | null) => void;
}> = ({ field, onFieldSelect, onFieldHover }) => {
  // 获取字段名称，支持多种属性名
  const displayFieldName = field.fieldName || field.fieldDbName || field.name || field.columnName || '';
  // 获取字段标签，支持多种属性名
  const displayFieldLabel = field.fieldLabel || field.label || displayFieldName || '未命名字段';

  const [{ isDragging }, dragRef] = useDrag(() => ({
    type: 'FIELD',
    // 关键：传递完整 field 对象，确保 drop 时能获取所有属性
    item: {
      ...field,
      type: 'formField',
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [field]);

  /**
   * 原生拖拽开始事件处理器
   * 在 react-dnd 处理 dragstart 后，额外将字段数据写入 native dataTransfer
   * 使 Univer canvas 的原生 dragover/drop 事件能读取到字段数据
   */
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

    // ★★★ 核心修复：直接拖拽时设置 __pendingField ★★★
    (window as any).__pendingField = {
      ...fieldData,
      fieldLabel: displayFieldLabel,
    };

    e.dataTransfer.setData('application/json', JSON.stringify(fieldData));
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
        padding: '4px 0',
        borderRadius: 4,
        transition: 'background-color 0.2s',
        fontSize: '13px',
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
      {/* 第一列：图标 + 标签 */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingRight: 8 }}>
        <span style={{ marginRight: 8, color: '#1890ff' }}>{getFieldIcon(field)}</span>
        <span>{displayFieldLabel}</span>
      </div>

      {/* 第二列：字段名称 */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        color: '#999',
        fontSize: '12px',
        paddingLeft: 8,
        borderLeft: '1px solid #e8e8e8'
      }}>
        <span>{displayFieldName || '-'}</span>
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
          setFields(data);

          // 分离主表字段和明细表字段
          const mainFields = data.filter(f => f.isMain === 1 || f.detailTable === 0 || f.detailTable === undefined);
          const detailFields: Record<number, FieldDefinition[]> = {};

          data.forEach(f => {
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
