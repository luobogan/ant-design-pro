/**
 * 可见字段 · 可编辑表格（移植自 antdprov5 的 Datascope/CreateForm）
 *
 * 保留源实现的交互形态：
 *   - EditableProTable 行内编辑（列名 / 字段名 / 是否显示 / 是否可编辑）
 *   - 「新增一行」记录创建、保存 / 取消 / 删除操作列
 *   - DndContext + SortableContext + 自定义 body.row 的拖拽手柄排序
 *
 * 适配目标项目（antd v6 / @ant-design/pro-components v3 / @dnd-kit v6）：
 *   - 数据模型对齐 FieldRow（与字段管理页共享），而非源项目的 dbFieldName/dbFieldTxt/isShowForm/isEdit
 *   - 去掉大段注释掉的死代码、console.log / debugger、maxLength=5 行数上限
 *   - 不用未在 package.json 声明的 @dnd-kit/modifiers，App.useApp() 取 message
 *
 * 本组件是纯受控组件（value / onChange），不掺入持久化逻辑。
 */
import { HolderOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { EditableProTable } from '@ant-design/pro-components';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { App, Button } from 'antd';
import React, { createContext, useContext, useMemo, useRef } from 'react';

/** 与字段管理页共享的行模型 */
export interface FieldRow {
  /** workflow_billfield.id；负数表示本页新增、尚未落库的草稿行 */
  id: number;
  fieldName: string;
  fieldLabel: string;
  fieldDbType: string;
  description: string;
  fieldHtmlType: string;
  order: number;
  visible: boolean;
  editable: boolean;
}

export interface EditableFieldTableProps {
  value?: FieldRow[];
  onChange?: (rows: FieldRow[]) => void;
  disabled?: boolean;
}

interface RowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  'data-row-key': string;
}

interface DragRowContextValue {
  setActivatorNodeRef?: (element: HTMLElement | null) => void;
  listeners?: Record<string, any>;
  attributes?: Record<string, any>;
}

const DragRowContext = createContext<DragRowContextValue>({});

/** 拖拽手柄：序号 + 抓手，通过 context 拿到 useSortable 的 activator */
const DragHandle: React.FC<{ index: number }> = ({ index }) => {
  const { setActivatorNodeRef, listeners } = useContext(DragRowContext);
  return (
    <Button
      type="text"
      size="small"
      icon={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          <HolderOutlined style={{ cursor: 'grab', color: '#faad14' }} />
          <span style={{ fontSize: 12 }}>{index + 1}</span>
        </span>
      }
      style={{ cursor: 'move', paddingInline: 4 }}
      ref={setActivatorNodeRef}
      data-testid={`ef-drag-${index}`}
      {...listeners}
    />
  );
};

/** 自定义 body.row：把 useSortable 的 transform 应用到 <tr> */
const SortableRow: React.FC<RowProps> = (props) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: props['data-row-key'] });

  const style: React.CSSProperties = {
    ...props.style,
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { position: 'relative', zIndex: 9999, opacity: 0.85 } : {}),
  };

  const ctx = useMemo<DragRowContextValue>(
    () => ({ setActivatorNodeRef, listeners, attributes }),
    [setActivatorNodeRef, listeners, attributes],
  );

  return (
    <DragRowContext.Provider value={ctx}>
      <tr {...props} ref={setNodeRef} style={style} {...attributes} />
    </DragRowContext.Provider>
  );
};

/** 生成不冲突的草稿行 id（负数，保存时会被过滤） */
let draftSeq = 0;
const nextDraftId = () => --draftSeq;

const EditableFieldTable: React.FC<EditableFieldTableProps> = ({ value = [], onChange, disabled }) => {
  const { message } = App.useApp();
  // 用 ref 记录编辑态，避免把 EditableProTable 的 onChange 接到外部 state：
  // v3 的 onChange 在 state updater（渲染期）内触发，接外部 setState 会产生
  // "Cannot update a component while rendering a different component" 警告。
  const editingRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const emit = (rows: FieldRow[]) => onChange?.(rows);

  /** 拖拽排序：按 rowKey(id) 定位并重排 */
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || editingRef.current) {
      if (editingRef.current) message.warning('请先保存或取消正在编辑的行，再调整顺序');
      return;
    }
    const oldIndex = value.findIndex((r) => String(r.id) === String(active.id));
    const newIndex = value.findIndex((r) => String(r.id) === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    emit(arrayMove(value, oldIndex, newIndex).map((r, i) => ({ ...r, order: i })));
  };

  /** 联动约束：不可见则不可编辑；可编辑隐含可见 */
  const normalize = (r: FieldRow): FieldRow => {
    if (r.editable && !r.visible) return { ...r, visible: true };
    if (!r.visible && r.editable) return { ...r, editable: false };
    return r;
  };

  const columns: ProColumns<FieldRow>[] = [
    {
      title: '排序',
      key: 'sort',
      dataIndex: 'id',
      editable: false,
      width: 78,
      render: (_, __, index) => <DragHandle index={index} />,
    },
    {
      title: '列名',
      dataIndex: 'fieldName',
      key: 'fieldName',
      width: 190,
      formItemProps: {
        rules: [{ required: true, message: '列名为必填项' }],
      },
    },
    {
      title: '字段名',
      dataIndex: 'fieldLabel',
      key: 'fieldLabel',
      width: 190,
      formItemProps: {
        rules: [{ required: true, message: '字段名为必填项' }],
      },
    },
    {
      title: '类型',
      dataIndex: 'fieldDbType',
      key: 'fieldDbType',
      editable: false,
      width: 110,
      render: (v) => <span style={{ color: '#888', fontSize: 12 }}>{v || '-'}</span>,
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      editable: false,
      width: 160,
      render: (v, r) => <span style={{ color: '#888', fontSize: 12 }}>{v || r.fieldLabel || '-'}</span>,
    },
    {
      title: '是否显示',
      key: 'visible',
      dataIndex: 'visible',
      valueType: 'switch',
      width: 110,
      fieldProps: { checkedChildren: '开', unCheckedChildren: '关' },
    },
    {
      title: '是否可编辑',
      key: 'editable',
      dataIndex: 'editable',
      valueType: 'switch',
      width: 120,
      fieldProps: { checkedChildren: '开', unCheckedChildren: '关' },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      // 非编辑态由列自身的 render 提供「编辑」入口（v3 columnRender 会把
      // action + editableUtils 合并进第 4 个参数）；编辑态才交给 actionRender。
      render: (_, record, _index, action) => [
        <Button
          key="edit"
          type="link"
          size="small"
          onClick={() => action?.startEditable?.(record.id)}
        >
          编辑
        </Button>,
        <Button
          key="delete"
          type="link"
          size="small"
          danger
          onClick={() => emit(value.filter((r) => r.id !== record.id))}
        >
          删除
        </Button>,
      ],
    },
  ];

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={value.map((r) => String(r.id))} strategy={verticalListSortingStrategy}>
        <EditableProTable<FieldRow>
          rowKey="id"
          controlled
          value={value}
          onChange={(rows) => emit((rows as FieldRow[]).map(normalize))}
          columns={columns}
          headerTitle="可见字段 · 可编辑表格"
          recordCreatorProps={
            disabled
              ? false
              : {
                  position: 'bottom' as const,
                  // 默认 'cache' 只存内部缓存、不触发 onChange；
                  // 用 'dataSource' 让新增行进入受控 value，与勾选视图共享同一份数据。
                  newRecordType: 'dataSource' as const,
                  creatorButtonText: '新增一行',
                  record: () => ({
                    id: nextDraftId(),
                    fieldName: '',
                    fieldLabel: '',
                    fieldDbType: '',
                    description: '',
                    fieldHtmlType: '',
                    order: value.length,
                    visible: true,
                    editable: false,
                  }),
                }
          }
          editable={{
            type: 'multiple',
            // 不传 editableKeys：由 useEditableArray 内部托管，避免渲染期回调外部 setState
            onChange: (keys) => {
              editingRef.current = Array.isArray(keys) && keys.length > 0;
            },
            actionRender: (_row, _config, defaultDoms) => [
              defaultDoms.save,
              defaultDoms.cancel,
              defaultDoms.delete,
            ],
            onSave: async () => {
              // controlled 模式下 onChange 已同步数据，此处只需让编辑态退出
            },
          }}
          components={{ body: { row: SortableRow } }}
          pagination={false}
          search={false}
          options={false}
          toolBarRender={false}
          scroll={{ x: 1080 }}
        />
      </SortableContext>
    </DndContext>
  );
};

export default EditableFieldTable;
