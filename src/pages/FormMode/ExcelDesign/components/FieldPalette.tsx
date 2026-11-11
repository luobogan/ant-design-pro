import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Input, Badge, Spin, Segmented, Empty } from 'antd';
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
  RightOutlined,
} from '@ant-design/icons';
import { fieldDefinitionApi } from '@/services/formmode';
import type { FieldDefinition } from '@/services/formmode/typings';
import { getFieldTypeLabel } from '@/components/FormMode/fieldTypes';
import {
  FIELD_GROUP_MODE_OPTIONS,
  filterFieldsByKeyword,
  getFieldDisplayLabel,
  getFieldDisplayName,
  groupFieldsByTable,
  groupFieldsByType,
  groupFieldsByUsage,
  type FieldGroup,
  type FieldGroupMode,
} from '../utils/fieldGroup';

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
  disabled?: boolean;
}> = ({ field, displayFieldLabel, displayFieldName, disabled }) => {
  const [{ isDragging }, dragRef] = useDrag(() => ({
    type: 'FIELD',
    // 已拖入的字段禁止再次拖动（保证同一个字段只放置一次）
    canDrag: !disabled,
    item: {
      ...field,
      type: 'formLabel', // 标识为标签类型
      fieldName: displayFieldName,
      fieldLabel: displayFieldLabel,
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [field, displayFieldLabel, displayFieldName, disabled]);

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
      ref={disabled ? undefined : (dragRef as any)}
      onDragStart={handleDragStart}
      style={{
        display: 'flex',
        alignItems: 'center',
        cursor: disabled ? 'not-allowed' : 'grab',
        opacity: disabled ? 0.45 : 1,
        padding: '2px 4px',
        borderRadius: 4,
        // 置灰语义（三态要能一眼区分）：
        //   已拖入(禁用) = 浅灰 #bfbfbf ← 从表格删除后字段会「由灰变黑」回到可拖状态
        //   可拖入(静止) = 近黑 #262626
        //   拖动中       = 纯黑 #000 并加粗（释放后若已放置则回到浅灰）
        color: disabled ? '#bfbfbf' : (isDragging ? '#000' : '#262626'),
        fontWeight: isDragging ? 600 : 400,
        transition: 'background-color 0.2s, color 0.2s, opacity 0.2s',
        fontSize: '13px',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = disabled ? 'transparent' : '#e6f7ff';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
      title={disabled ? '该标签已拖入表格，不能重复拖动（清空原单元格后可再次拖入）' : '拖拽标签到表格'}
    >
      <span style={{ marginRight: 6, color: disabled ? '#d9d9d9' : '#1890ff' }}>{getFieldIcon(field)}</span>
      <span>{displayFieldLabel}</span>
    </div>
  );
};

// 可拖拽的字段组件
const DraggableFieldOnlyItem: React.FC<{
  field: FieldDefinition;
  displayFieldLabel: string;
  displayFieldName: string;
  disabled?: boolean;
}> = ({ field, displayFieldLabel, displayFieldName, disabled }) => {
  const [{ isDragging }, dragRef] = useDrag(() => ({
    type: 'FIELD',
    // 已拖入的字段禁止再次拖动（保证同一个字段只放置一次）
    canDrag: !disabled,
    item: {
      ...field,
      type: 'formField', // 标识为字段类型
      fieldName: displayFieldName,
      fieldLabel: displayFieldLabel,
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [field, displayFieldLabel, displayFieldName, disabled]);

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
      ref={disabled ? undefined : (dragRef as any)}
      onDragStart={handleDragStart}
      style={{
        display: 'flex',
        alignItems: 'center',
        cursor: disabled ? 'not-allowed' : 'grab',
        opacity: disabled ? 0.45 : 1,
        padding: '2px 4px',
        borderRadius: 4,
        // 置灰语义（三态要能一眼区分）：
        //   已拖入(禁用) = 浅灰 #bfbfbf ← 从表格删除后字段会「由灰变黑」回到可拖状态
        //   可拖入(静止) = 近黑 #262626
        //   拖动中       = 纯黑 #000 并加粗（释放后若已放置则回到浅灰）
        color: disabled ? '#bfbfbf' : (isDragging ? '#000' : '#262626'),
        fontWeight: isDragging ? 600 : 400,
        transition: 'background-color 0.2s, color 0.2s, opacity 0.2s',
        fontSize: '12px',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = disabled ? 'transparent' : '#e6f7ff';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
      title={disabled ? '该字段已拖入表格，不能重复拖动（清空原单元格后可再次拖入）' : '拖拽字段到表格'}
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
  usedFieldKeys?: Set<string>;
}> = ({ field, onFieldSelect, onFieldHover, usedFieldKeys }) => {
  // 获取字段名称，支持多种属性名
  const displayFieldName = getFieldDisplayName(field);
  // 获取字段标签，支持多种属性名
  const displayFieldLabel = getFieldDisplayLabel(field);

  // 该字段的标签/字段是否已被拖入表格（已拖入则禁止再次拖动）
  const fieldId = String((field as any).id ?? '');
  const labelUsed = !!usedFieldKeys?.has(`${fieldId}_label`);
  const fieldUsed = !!usedFieldKeys?.has(`${fieldId}_field`);

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
          disabled={labelUsed}
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
          disabled={fieldUsed}
        />
      </div>
    </div>
  );
};

interface FieldPaletteProps {
  onFieldSelect: (field: any) => void;
  onFieldHover?: (field: any | null) => void;
  formId?: string;
  /** 已拖入表格的字段集合，key 为 `${fieldId}_${cellType}`（已拖入的项会置灰且不可再拖） */
  usedFieldKeys?: Set<string>;
  /** 仅显示指定明细表序号的字段（用于明细表子画布）；不传则显示主表 + 全部明细表 */
  detailTableFilter?: number;
}

const FieldPalette: React.FC<FieldPaletteProps> = ({ onFieldSelect, onFieldHover, formId, usedFieldKeys, detailTableFilter }) => {
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [mainTableFields, setMainTableFields] = useState<FieldDefinition[]>([]);
  const [detailTableFields, setDetailTableFields] = useState<Record<number, FieldDefinition[]>>({});
  // 分组方式：按明细表 / 按类型 / 按使用状态
  const [groupMode, setGroupMode] = useState<FieldGroupMode>('table');
  // 已折叠的分组 key
  const [collapsedKeys, setCollapsedKeys] = useState<string[]>([]);

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
          // 判定规则（对齐后端语义：isMain=1 主表字段，isMain=0 且 detailTable>0 明细表字段）：
          //   - 明细字段：isMain===0，或 isMain 缺失但 detailTable>0
          //   - 其余（isMain===1，或 isMain 缺失且 detailTable 无效）= 主表字段
          // 这样可避免「明细表字段但 detailTable 为 0/undefined」被误归入主表分组。
          const toNum = (v: any) => (typeof v === 'number' ? v : Number(v));
          const isDetailField = (f: FieldDefinition) =>
            f.isMain === 0 || (f.isMain == null && toNum(f.detailTable) > 0);
          const mainFields = filteredData.filter(f => !isDetailField(f));
          const detailFields: Record<number, FieldDefinition[]> = {};

          filteredData.forEach(f => {
            if (isDetailField(f) && toNum(f.detailTable) > 0) {
              const num = toNum(f.detailTable);
              if (!detailFields[num]) {
                detailFields[num] = [];
              }
              detailFields[num].push(f);
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

  // ── 分组与搜索 ──────────────────────────────────────────────────────────
  // 展示范围（对齐 ecology「主表标记 + 子画布」模型）：
  //   - 主画布（detailTableFilter 未设定）：只展示【主表字段】（明细字段属于各自子画布）
  //   - 子画布（detailTableFilter 已设定）：只展示【该明细表】的字段
  const scopedFields = useMemo<FieldDefinition[]>(
    () => (detailTableFilter != null ? detailTableFields[detailTableFilter] ?? [] : mainTableFields),
    [detailTableFilter, detailTableFields, mainTableFields],
  );

  // 字段是否已放置到画布（标签格或字段格命中即算已放置）
  const isFieldUsed = useCallback(
    (f: FieldDefinition) => {
      const id = String((f as any).id ?? '');
      if (!id || !usedFieldKeys) return false;
      return usedFieldKeys.has(`${id}_label`) || usedFieldKeys.has(`${id}_field`);
    },
    [usedFieldKeys],
  );

  // 搜索：大小写不敏感 + 多关键词（空格分隔，AND）命中 标签/字段名/描述/类型名
  const filteredFields = useMemo(
    () =>
      filterFieldsByKeyword(scopedFields, searchText, (f) =>
        getFieldTypeLabel(f?.fieldHtmlType, f?.fieldType),
      ),
    [scopedFields, searchText],
  );

  // 分组：按明细表 / 按类型 / 按使用状态
  const groups = useMemo<FieldGroup<FieldDefinition>[]>(() => {
    if (groupMode === 'type') {
      return groupFieldsByType(filteredFields).map((g) => ({
        ...g,
        title: `${g.title} (${g.fields.length})`,
      }));
    }
    if (groupMode === 'usage') {
      return groupFieldsByUsage(filteredFields, isFieldUsed);
    }
    const tableTitle = () => (detailTableFilter != null ? `明细表${detailTableFilter}` : '主表字段');
    return groupFieldsByTable(filteredFields, tableTitle).map((g) => ({
      ...g,
      title: `${g.title} (${g.fields.length})`,
    }));
  }, [filteredFields, groupMode, isFieldUsed, detailTableFilter]);

  // 计数徽标反映当前可见范围：主画布只计主表字段，子画布只计该明细表字段
  const totalCount = scopedFields.length;
  // 搜索命中数（无搜索时等于总数）
  const matchedCount = filteredFields.length;

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
        placeholder="搜索字段（标签 / 字段名 / 类型）"
        value={searchText}
        onChange={e => setSearchText(e.target.value)}
        style={{ marginBottom: 8 }}
        allowClear
      />

      {/* 分组方式切换 */}
      <Segmented
        size="small"
        block
        value={groupMode}
        onChange={(v) => setGroupMode(v as FieldGroupMode)}
        options={FIELD_GROUP_MODE_OPTIONS}
        style={{ marginBottom: 12 }}
      />

      {/* 搜索命中提示 */}
      {searchText ? (
        <div style={{ fontSize: '12px', color: '#999', marginBottom: 6 }}>
          命中 {matchedCount} / {totalCount} 个字段
        </div>
      ) : null}

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
      {groups.length > 0 ? (
        <div>
          {groups.map((group) => {
            const collapsed = collapsedKeys.includes(group.key);
            return (
              <div key={group.key}>
                {/* 分组标题（点击折叠/展开） */}
                <div
                  onClick={() =>
                    setCollapsedKeys((prev) =>
                      prev.includes(group.key)
                        ? prev.filter((k) => k !== group.key)
                        : [...prev, group.key],
                    )
                  }
                  style={{
                    padding: '8px 0 4px 0',
                    fontSize: '12px',
                    color: '#1890ff',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <RightOutlined
                    style={{
                      fontSize: 10,
                      color: '#999',
                      transform: collapsed ? 'none' : 'rotate(90deg)',
                      transition: 'transform 0.2s',
                    }}
                  />
                  <span>{group.title}</span>
                </div>
                {/* 分组下的字段列表 */}
                {!collapsed &&
                  group.fields.map((f) => (
                    <DraggableFieldItem
                      key={f.id}
                      field={f}
                      onFieldSelect={onFieldSelect}
                      onFieldHover={onFieldHover}
                      usedFieldKeys={usedFieldKeys}
                    />
                  ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>
          {loading ? (
            '加载中...'
          ) : searchText ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无匹配字段" />
          ) : (
            '暂无字段数据'
          )}
        </div>
      )}
    </Card>
  );
};

export default FieldPalette;
