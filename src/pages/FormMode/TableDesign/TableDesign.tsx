import {
  SaveOutlined,
  PlusOutlined,
  DeleteOutlined,
  EyeOutlined,
  CodeOutlined,
  MenuOutlined,
  HolderOutlined,
  DatabaseOutlined,
  FormOutlined,
  SearchOutlined,
  FileTextOutlined,
  ExportOutlined,
  BarChartOutlined,
  LinkOutlined,
  KeyOutlined,
  AppstoreOutlined,
  CloseOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useNavigate, useSearchParams } from '@umijs/max';
import {
  Button,
  Card,
  message,
  Modal,
  Tabs,
  Input,
  Select,
  InputNumber,
  Switch,
  Space,
  Tag,
  Tooltip,
  Table,
  Checkbox,
  Row,
  Col,
  Divider,
  Empty,
} from 'antd';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { formApi, fieldApi } from '@/services/formmode';
import type { WorkflowBill, FieldDefinitionFormData } from '@/services/formmode/typings';
import BrowserButtonPreview from './components/BrowserButtonPreview';
import BrowserTypePicker from './components/BrowserTypePicker';

// 导入 @dnd-kit 拖拽排序相关组件
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const { TabPane } = Tabs;
const { TextArea } = Input;

// 拖拽手柄上下文：将 setActivatorNodeRef/attributes/listeners 传递给列渲染器
interface DragHandleValue {
  setActivatorNodeRef: (node: HTMLElement | null) => void;
  attributes: Record<string, any>;
  listeners?: any;
}
const DragHandleContext = React.createContext<DragHandleValue | null>(null);

// ==================== 可编辑单元格组件 ====================
// 使用本地状态管理输入，只在失焦时更新父组件，避免每次按键都触发重新渲染导致焦点丢失

interface EditableCellProps {
  value: string | undefined;
  record: any;
  index: number;
  field: string;
  onChange: (index: number, field: string, value: any) => void;
}

const EditableCell: React.FC<EditableCellProps> = ({ value, record, index, field, onChange }) => {
  const [localValue, setLocalValue] = useState<string>(value || '');
  const localValueRef = useRef(localValue);
  
  // 缓存最新值，供 onBlur 使用
  useEffect(() => {
    localValueRef.current = localValue;
  }, [localValue]);

  // 当外部 value 变化时同步（如重置、加载新数据）
  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;

    // 如果是字段编码（fieldName），只允许字母、数字和下划线
    if (field === 'fieldName') {
      newValue = newValue.replace(/[^a-zA-Z0-9_]/g, '');
    }

    setLocalValue(newValue);
  };

  const handleBlur = () => {
    // 失焦时通知父组件更新数据
    onChange(index, field, localValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 回车键也触发保存
    if (e.key === 'Enter') {
      onChange(index, field, localValue);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleFocus = (e: React.FocusEvent) => {
    e.stopPropagation();
  };

  const handleMouseDownCapture = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <Input
      value={localValue}
      size="small"
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      onFocus={handleFocus}
      onMouseDownCapture={handleMouseDownCapture}
      placeholder={field === 'fieldName' ? '字段编码（字母、数字、下划线）' : '字段名称'}
      bordered={true}
      style={{ padding: '0 8px' }}
      disabled={Number(record.isSystemField) === 1}
    />
  );
};

// ==================== 可拖拽表格行组件 ====================

interface DragableTableRowProps {
  index: number;
  children: React.ReactNode;
  idPrefix?: string; // 拖拽 id 前缀，主表默认 'field'，明细表用 'detail-field'
}

const DragableTableRow: React.FC<DragableTableRowProps> = ({ index, children, idPrefix = 'field' }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `${idPrefix}-${index}` });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const contextValue: DragHandleValue = { setActivatorNodeRef, attributes, listeners };

  return (
    <DragHandleContext.Provider value={contextValue}>
      <tr ref={setNodeRef} style={style}>
        {children}
      </tr>
    </DragHandleContext.Provider>
  );
};

// 拖拽手柄子组件（在组件内调用 useContext，规避 Hooks 规则）
const DragHandle: React.FC<{ index: number }> = ({ index }) => {
  const ctx = React.useContext(DragHandleContext);
  if (!ctx) {
    return (
      <span>
        <HolderOutlined style={{ cursor: 'grab', color: '#999', marginRight: 6 }} />
        {index + 1}
      </span>
    );
  }
  const { setActivatorNodeRef, attributes, listeners } = ctx;
  return (
    <span ref={setActivatorNodeRef} {...attributes} {...listeners} style={{ cursor: 'grab', color: '#999', marginRight: 6 }}>
      <HolderOutlined />
      {index + 1}
    </span>
  );
};

/**
 * 低代码表设计器主页面
 * 支持可视化配置数据库表和字段，拖拽排序，实时预览
 */
const TableDesign: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('design');
  const [loading, setLoading] = useState(false);

  // 表配置
  const [tableConfig, setTableConfig] = useState<Partial<WorkflowBill>>({
    id: '',
    formName: '',
    tableName: '',
    description: '',
    status: 1 as any,
  });

  // 获取默认系统字段的辅助函数
  const getDefaultSystemFields = (): Partial<FieldDefinitionFormData>[] => {
    return [
      {
        fieldName: 'is_deleted',
        fieldLabel: '是否删除',
        fieldHtmlType: 6,
        fieldType: 1,
        fieldDbType: 'int',
        fieldLength: 0,
        fieldDecimals: 0,
        isRequired: 1,
        isReadOnly: 0,
        defaultValue: '0',
        sort: 0,
        status: 1,
        isSystemField: 1,
        listDisplay: 1,
      },
      {
        fieldName: 'update_time',
        fieldLabel: '更新时间',
        fieldHtmlType: 5,
        fieldType: 2,
        fieldDbType: 'datetime',
        fieldLength: 0,
        fieldDecimals: 0,
        isRequired: 1,
        isReadOnly: 0,
        defaultValue: '',
        sort: 1,
        status: 1,
        isSystemField: 1,
        listDisplay: 1,
      },
      {
        fieldName: 'update_user',
        fieldLabel: '更新人',
        fieldHtmlType: 2,
        fieldType: 1,
        fieldDbType: 'bigint',
        fieldLength: 128,
        fieldDecimals: 0,
        isRequired: 1,
        isReadOnly: 0,
        defaultValue: '',
        sort: 2,
        status: 1,
        isSystemField: 1,
        listDisplay: 1,
      },
      {
        fieldName: 'create_dept',
        fieldLabel: '创建部门id',
        fieldHtmlType: 2,
        fieldType: 2,
        fieldDbType: 'bigint',
        fieldLength: 128,
        fieldDecimals: 0,
        isRequired: 1,
        isReadOnly: 0,
        defaultValue: '',
        sort: 3,
        status: 1,
        isSystemField: 1,
        listDisplay: 1,
      },
      {
        fieldName: 'create_time',
        fieldLabel: '创建时间',
        fieldHtmlType: 5,
        fieldType: 2,
        fieldDbType: 'datetime',
        fieldLength: 0,
        fieldDecimals: 0,
        isRequired: 1,
        isReadOnly: 0,
        defaultValue: '',
        sort: 4,
        status: 1,
        isSystemField: 1,
        listDisplay: 1,
      },
      {
        fieldName: 'create_user',
        fieldLabel: '创建人',
        fieldHtmlType: 2,
        fieldType: 1,
        fieldDbType: 'bigint',
        fieldLength: 128,
        fieldDecimals: 0,
        isRequired: 1,
        isReadOnly: 0,
        defaultValue: '',
        sort: 5,
        status: 1,
        isSystemField: 1,
        listDisplay: 1,
      },
      {
        fieldName: 'tenant_id',
        fieldLabel: '租户编号',
        fieldHtmlType: 2,
        fieldType: 1,
        fieldDbType: 'bigint',
        fieldLength: 128,
        fieldDecimals: 0,
        isRequired: 1,
        isReadOnly: 0,
        defaultValue: '',
        sort: 6,
        status: 1,
        isSystemField: 1,
        listDisplay: 1,
      },
      {
        fieldName: 'id',
        fieldLabel: '主键',
        fieldHtmlType: 6,
        fieldType: 1,
        fieldDbType: 'bigint',
        fieldLength: 128,
        fieldDecimals: 0,
        isRequired: 1,
        isReadOnly: 1,
        defaultValue: '',
        sort: 7,
        status: 1,
        isSystemField: 1,
        listDisplay: 1,
      },
    ];
  };

  // 字段列表 - 默认初始化8个系统字段
  const [fields, setFields] = useState<Partial<FieldDefinitionFormData>[]>(() => getDefaultSystemFields());

  // 预览数据
  const [previewSql, setPreviewSql] = useState('');
  const [previewFormJson, setPreviewFormJson] = useState('');

  // 浏览按钮预览
  const [browserPreviewVisible, setBrowserPreviewVisible] = useState(false);
  const [browserPreviewField, setBrowserPreviewField] = useState<{ label: string; type: number } | null>(null);

  // 浏览按钮类型选择器（分类弹窗）
  const [typePickerVisible, setTypePickerVisible] = useState(false);
  const [pickerContext, setPickerContext] = useState<{
    index: number;
    isDetail?: boolean;
    currentType: number;
    fieldLabel: string;
    record: any;
  } | null>(null);

  // 主表选中行
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 明细表列表（支持多个明细表）
  const [detailTables, setDetailTables] = useState<Array<{
    key: string;
    config: Partial<WorkflowBill>;
    fields: Partial<FieldDefinitionFormData>[];
    selectedRowKeys: React.Key[];
  }>>([]);
  // 当前激活的明细表Tab
  const [activeDetailTab, setActiveDetailTab] = useState<string>('');
  // 明细表自增计数器
  const [detailTableCounter, setDetailTableCounter] = useState(0);

  // 已有表单列表（用于主表选择）
  const [existingForms, setExistingForms] = useState<WorkflowBill[]>([]);
  const [selectedSourceFormId, setSelectedSourceFormId] = useState<string>('');

  // 新建表单时，自动获取下一个表名
  useEffect(() => {
    const formId = searchParams.get('id');
    if (!formId) {
      // 新建模式：自动获取自增表名
      formApi.getNextTableName().then((name) => {
        setTableConfig(prev => ({ ...prev, tableName: name }));
      }).catch((err) => {
        console.error('获取表名失败:', err);
      });
    }
  }, [searchParams]);

  // 新建表单时，加载已有表单列表（用于主表选择）
  useEffect(() => {
    const formId = searchParams.get('id');
    if (!formId) {
      formApi.getAll().then((forms) => {
        setExistingForms(forms || []);
      }).catch((err) => {
        console.error('获取表单列表失败:', err);
      });
    }
  }, [searchParams]);

  // 加载已有表单数据
  // 使用 AbortController 防止 React 18 StrictMode 下 effect 多次执行导致数据重复
  useEffect(() => {
    const formId = searchParams.get('id');
    if (!formId) return;

    // 每次执行前先重置状态，确保切换表单时重新加载
    setLoading(true);
    setFields([]);
    setDetailTables([]);

    const abortController = new AbortController();

    const loadData = async (id: string) => {
      try {
        // 1. 加载表单定义
        const formData = await formApi.getById(id);
        if (abortController.signal.aborted) return;

        if (formData) {
          setTableConfig({
            id: formData.id,
            formName: formData.formName || '',
            tableName: formData.tableName || '',
            description: formData.description || '',
            status: formData.status || 1,
          });
        }

        // 2. 加载字段定义
        const fieldsData = await fieldApi.getByFormId(id);
        if (abortController.signal.aborted) return;

        if (fieldsData && fieldsData.length > 0) {
          // 系统保留字段，不应从数据库加载（这些是系统自动创建的）
          const systemFieldNames = new Set([
            'id',
            'request_id',
            'main_id',
            'is_deleted',
            'update_time',
            'update_user',
            'create_time',
            'create_user',
            'create_dept',
            'tenant_id',
          ]);

          // 分离主表字段和明细表字段
          const mainFields: Partial<FieldDefinitionFormData>[] = [];
          const detailFieldsMap: { [key: number]: Partial<FieldDefinitionFormData>[] } = {};
          // 记录所有出现过的明细表索引，包括只有系统字段的明细表
          const allDetailTableIndices = new Set<number>();

          for (const f of fieldsData) {
            const fieldName = f.fieldName || f.field_name || f.fieldname || '';
            // 不过滤系统字段，而是记录明细表索引
            const isMain = f.isMain !== undefined ? f.isMain : (f.is_main !== undefined ? f.is_main : f.ismain);
            const detailTable = f.detailTable !== undefined ? f.detailTable : (f.detail_table !== undefined ? f.detail_table : f.detailtable);

            if (isMain === 0 && detailTable) {
              allDetailTableIndices.add(Number(detailTable));
            }

            // 过滤系统保留字段（这些字段在新建/编辑时会自动创建）
            if (systemFieldNames.has(fieldName.toLowerCase())) {
              continue;
            }

            const fieldItem: Partial<FieldDefinitionFormData> = {
              id: f.id,
              fieldName: fieldName,
              fieldLabel: f.fieldLabel || f.field_label || f.fieldlabel || f.fieldDbName || f.field_db_name || f.fielddbname || '',
              fieldHtmlType: f.fieldHtmlType ?? f.field_html_type ?? f.fieldhtmltype ?? 1,
              fieldType: f.fieldType ?? f.field_type ?? f.fieldtype ?? 1,
              fieldDbType: f.fieldDbType ?? f.field_db_type ?? f.fielddbtype ?? 'varchar',
              fieldLength: f.fieldLength ?? f.field_length ?? f.fieldlen ?? 255,
              fieldDecimals: f.fieldDecimals ?? f.field_decimals ?? f.decimaldigit ?? 0,
              isRequired: f.isRequired ?? f.is_required ?? f.isnull ?? 0,
              isReadOnly: f.isReadOnly ?? f.is_read_only ?? f.isreadonly ?? 0,
              defaultValue: f.defaultValue ?? f.default_value ?? f.defaultvalue ?? '',
              sort: f.sort ?? f.ds_order ?? f.dsOrder ?? 0,
              status: f.status ?? 1,
              isSystemField: f.isSystemField ?? f.is_system_field ?? f.issystemfield ?? 0,
              listDisplay: f.listDisplay ?? f.list_display ?? f.listdisplay ?? 1,
              isMain: isMain,
              detailTable: detailTable,
            };

            if (isMain === 0 && detailTable) {
              const dtIdx = Number(detailTable);
              if (!detailFieldsMap[dtIdx]) detailFieldsMap[dtIdx] = [];
              detailFieldsMap[dtIdx].push(fieldItem);
            } else {
              mainFields.push(fieldItem);
            }
          }

          // 设置主表字段（直接替换，不追加，避免重复）
          const defaultSystemFields = getDefaultSystemFields();
          setFields([...defaultSystemFields, ...mainFields]);

          // 设置明细表：合并所有明细表索引（包括只有系统字段的）
          const mainTableName = formData.tableName || 'main';
          const allIndices = new Set<number>([
            ...Array.from(allDetailTableIndices),
            ...Object.keys(detailFieldsMap).map(Number),
          ]);
          const sortedIndices = Array.from(allIndices).sort((a, b) => a - b);

          const newDetailTables: Array<{
            key: string;
            config: Partial<WorkflowBill>;
            fields: Partial<FieldDefinitionFormData>[];
            selectedRowKeys: React.Key[];
          }> = [];

          sortedIndices.forEach((dtIdx, arrayIndex) => {
            const counter = arrayIndex + 1;
            const defaultDetailFields = createDefaultDetailFields(mainTableName);
            const userDetailFields = detailFieldsMap[dtIdx] || [];
            newDetailTables.push({
              key: `dt-${Date.now()}-${counter}`,
              config: {
                id: '',
                formName: `明细表${counter}`,
                tableName: `${mainTableName}_dt${counter}`,
                description: '',
                status: 1,
              },
              fields: [...defaultDetailFields, ...userDetailFields],
              selectedRowKeys: [],
            });
          });

          setDetailTables(newDetailTables);
          setActiveDetailTab(newDetailTables[0]?.key || '');
          setDetailTableCounter(newDetailTables.length);
        } else {
          // 没有字段数据时，重置为默认状态
          const defaultSystemFields = getDefaultSystemFields();
          setFields(defaultSystemFields);
          setDetailTables([]);
          setDetailTableCounter(0);
        }

        message.success('数据加载成功');
      } catch (error: any) {
        if (error.name === 'AbortError') return;
        console.error('加载数据失败:', error);
        message.error('加载数据失败');
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadData(formId);

    // 清理函数：下次 effect 执行时取消上一次的请求
    return () => {
      abortController.abort();
    };
  }, [searchParams]);

  // 创建明细表默认字段（id + 主表外键）
  const createDefaultDetailFields = (mainTableName: string): Partial<FieldDefinitionFormData>[] => [
    {
      fieldName: 'id',
      fieldLabel: '主键',
      fieldHtmlType: 6,
      fieldType: 1,
      fieldDbType: 'bigint',
      fieldLength: 128,
      fieldDecimals: 0,
      isRequired: 1,
      isReadOnly: 1,
      defaultValue: '',
      sort: 0,
      status: 1,
      isSystemField: 1,
      listDisplay: 1,
    },
    {
      fieldName: 'main_id',
      fieldLabel: '主表ID',
      fieldHtmlType: 2,
      fieldType: 1,
      fieldDbType: 'bigint',
      fieldLength: 128,
      fieldDecimals: 0,
      isRequired: 1,
      isReadOnly: 0,
      defaultValue: '',
      sort: 1,
      status: 1,
      isSystemField: 1,
      listDisplay: 1,
    },
  ];

  // 新增明细表
  const handleAddDetailTable = () => {
    const counter = detailTableCounter + 1;
    const mainTableName = tableConfig.tableName || 'main';
    const newTableName = `${mainTableName}_dt${counter}`;
    const newDetailTable = {
      key: `dt-${counter}`,
      config: {
        id: '',
        formName: `明细表${counter}`,
        tableName: newTableName,
        description: '',
        status: 1 as any,
      } as Partial<WorkflowBill>,
      fields: createDefaultDetailFields(mainTableName),
      selectedRowKeys: [],
    };
    setDetailTables([...detailTables, newDetailTable]);
    setActiveDetailTab(newDetailTable.key);
    setDetailTableCounter(counter);
    message.success(`已添加明细表：${newTableName}`);
  };

  // 删除明细表
  const handleRemoveDetailTable = (key: string) => {
    if (detailTables.length <= 0) {
      message.warning('请先添加明细表');
      return;
    }
    Modal.confirm({
      title: '确认删除明细表',
      content: `确定要删除明细表 "${detailTables.find(dt => dt.key === key)?.config.tableName}" 吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        const newTables = detailTables.filter(dt => dt.key !== key);
        setDetailTables(newTables);
        if (activeDetailTab === key) {
          setActiveDetailTab(newTables[0]?.key || '');
        }
        message.success('明细表已删除');
      },
    });
  };

  // 当主表名变化时，自动更新所有明细表的外键字段名
  React.useEffect(() => {
    if (tableConfig.tableName) {
      const fkFieldName = `${tableConfig.tableName}_id`;
      setDetailTables(prev => prev.map(dt => {
        if (dt.fields.length >= 2) {
          const newFields = [...dt.fields];
          if (newFields[1]) {
            newFields[1] = { ...newFields[1], fieldName: fkFieldName, fieldLabel: '主表ID' };
          }
          return { ...dt, fields: newFields };
        }
        return dt;
      }));
    }
  }, [tableConfig.tableName]);


  // 功能配置
  const [featureConfig, setFeatureConfig] = useState({
    enableAdd: true,
    enableEdit: true,
    enableDelete: true,
    enableView: true,
    enableImport: false,
    enableExport: false,
    enablePrint: false,
  });

  // 拖拽传感器（添加 distance 约束，避免点击复选框时被拖拽拦截）
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 处理表配置变更
  const handleTableConfigChange = (field: string, value: any) => {
    setTableConfig(prev => ({ ...prev, [field]: value }));
  };

  // 选择已有主表，加载其字段和明细表
  const handleSelectExistingForm = async (formId: string) => {
    setSelectedSourceFormId(formId);
    if (!formId) {
      // 清空选择
      setFields([]);
      setDetailTables([]);
      return;
    }
    try {
      // 1. 加载表单定义
      const formData = await formApi.getById(formId);
      if (!formData) return;

      // 2. 设置基本信息（不复制ID和表名，表名用自动生成的新值）
      setTableConfig(prev => ({
        ...prev,
        formName: formData.formName || '',
        description: formData.description || '',
        status: formData.status || 1,
      }));

      // 3. 加载所有字段
      const fieldsData = await fieldApi.getByFormId(formId);
      if (!fieldsData || fieldsData.length === 0) {
        setFields([]);
        setDetailTables([]);
        return;
      }

      // 系统保留字段，不复制到新表单
      const systemFieldNames = new Set([
        'id',
        'request_id',
        'main_id',
        'is_deleted',
        'update_time',
        'update_user',
        'create_time',
        'create_user',
        'create_dept',
        'tenant_id',
      ]);

      // 分离主表字段和明细表字段
      // 兼容下划线格式（MyBatis-Plus 返回）和驼峰格式
      const mainFields: Partial<FieldDefinitionFormData>[] = [];
      const detailFieldsMap: { [key: number]: Partial<FieldDefinitionFormData>[] } = {};

      for (const f of fieldsData) {
        // 兼容多种可能的字段名格式（驼峰、下划线、全小写）
        const fieldName = f.fieldName || f.field_name || f.fieldname || '';
        // 过滤系统保留字段
        if (systemFieldNames.has(fieldName.toLowerCase())) {
          continue;
        }
        const isMain = f.isMain !== undefined ? f.isMain : (f.is_main !== undefined ? f.is_main : f.ismain);
        const detailTable = f.detailTable !== undefined ? f.detailTable : (f.detail_table !== undefined ? f.detail_table : f.detailtable);

        // 字段标签兼容：fieldLabel, field_label, fieldlabel, fieldDbName
        const fieldLabel = f.fieldLabel ?? f.field_label ?? f.fieldlabel ?? f.fieldDbName ?? f.field_db_name ?? f.fielddbname ?? '';
        // HTML类型兼容
        const fieldHtmlType = f.fieldHtmlType ?? f.field_html_type ?? f.fieldhtmltype ?? 1;
        // 字段类型兼容
        const fieldType = f.fieldType ?? f.field_type ?? f.fieldtype ?? 1;
        // 数据库字段类型兼容
        const fieldDbType = f.fieldDbType ?? f.field_db_type ?? f.fielddbtype ?? 'varchar';
        // 字段长度兼容
        const fieldLength = f.fieldLength ?? f.field_length ?? f.fieldlen ?? 255;
        // 小数位数兼容
        const fieldDecimals = f.fieldDecimals ?? f.field_decimals ?? f.decimaldigit ?? 0;
        // 是否必填兼容
        const isRequired = f.isRequired ?? f.is_required ?? f.isnull ?? 0;
        // 默认值兼容
        const defaultValue = f.defaultValue ?? f.default_value ?? f.defaultvalue ?? '';
        // 排序兼容
        const sort = f.sort ?? f.ds_order ?? f.dsOrder ?? 0;

        const fieldItem: Partial<FieldDefinitionFormData> = {
          fieldName: fieldName,
          fieldLabel: fieldLabel,
          fieldHtmlType: fieldHtmlType,
          fieldType: fieldType,
          fieldDbType: fieldDbType,
          fieldLength: fieldLength,
          fieldDecimals: fieldDecimals,
          isRequired: isRequired,
          isReadOnly: 0,
          defaultValue: defaultValue,
          sort: sort,
          status: 1,
          isSystemField: 0,
          listDisplay: 1,
          id: undefined, // 新建表单不保留原ID
        };
        if (isMain === 0 && detailTable) {
          const dtIdx = detailTable;
          if (!detailFieldsMap[dtIdx]) detailFieldsMap[dtIdx] = [];
          detailFieldsMap[dtIdx].push(fieldItem);
        } else {
          mainFields.push(fieldItem);
        }
      }

      // 4. 设置主表字段（保留系统默认字段）
      const defaultSystemFields = getDefaultSystemFields();
      setFields([...defaultSystemFields, ...mainFields]);

      // 5. 设置明细表
      const mainTableName = tableConfig.tableName || 'main';
      const newDetailTables: Array<{
        key: string;
        config: Partial<WorkflowBill>;
        fields: Partial<FieldDefinitionFormData>[];
        selectedRowKeys: React.Key[];
      }> = [];
      const sortedKeys = Object.keys(detailFieldsMap).sort((a, b) => Number(a) - Number(b));
      sortedKeys.forEach((key, index) => {
        const counter = index + 1;
        // 获取明细表默认系统字段（id + main_id）
        const defaultDetailFields = createDefaultDetailFields(mainTableName);
        // 合并：默认系统字段 + 从已有主表加载的用户字段
        const userDetailFields = detailFieldsMap[Number(key)] || [];
        newDetailTables.push({
          key: `dt-${Date.now()}-${counter}`,
          config: {
            id: '',
            formName: `明细表${counter}`,
            tableName: `${mainTableName}_dt${counter}`,
            description: '',
            status: 1,
          },
          fields: [...defaultDetailFields, ...userDetailFields],
          selectedRowKeys: [],
        });
      });
      setDetailTables(newDetailTables);
      setActiveDetailTab(newDetailTables[0]?.key || '');
      setDetailTableCounter(newDetailTables.length);

      message.success('已加载主表数据');
    } catch (error) {
      console.error('加载主表数据失败:', error);
      message.error('加载主表数据失败');
    }
  };

  // 添加字段
  const handleAddField = () => {
    const newField: Partial<FieldDefinitionFormData> = {
      fieldName: `field_${fields.length + 1}`,
      fieldLabel: `字段${fields.length + 1}`,
      fieldHtmlType: 1,
      fieldType: 1,
      fieldDbType: 'varchar',
      fieldLength: 255,
      isRequired: 0,
      isReadOnly: 0,
      sort: fields.length,
      status: 1,
    };
    setFields([...fields, newField]);
  };

  // 批量删除字段
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先勾选要删除的字段');
      return;
    }
    // 解析选中的行索引
    const selectedIndices = selectedRowKeys
      .map((key) => {
        const match = key.toString().match(/field-(\d+)/);
        return match ? parseInt(match[1]) : -1;
      })
      .filter((idx) => idx >= 0);

    // 校验：禁止删除系统默认字段
    const hasSystemField = selectedIndices.some((idx) => fields[idx]?.isSystemField === 1);
    if (hasSystemField) {
      message.error('系统默认字段禁止删除');
      return;
    }

    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedIndices.length} 个字段吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        const newFields = fields.filter((_, idx) => !selectedIndices.includes(idx));
        setFields(newFields);
        setSelectedRowKeys([]);
        message.success('字段已删除');
      },
    });
  };

  // 明细表 - 新增字段
  const handleAddDetailField = () => {
    const currentTable = detailTables.find(dt => dt.key === activeDetailTab);
    if (!currentTable) return;
    const newField: Partial<FieldDefinitionFormData> = {
      fieldName: `field_${currentTable.fields.length + 1}`,
      fieldLabel: `字段${currentTable.fields.length + 1}`,
      fieldHtmlType: 1,
      fieldType: 1,
      fieldDbType: 'varchar',
      fieldLength: 255,
      isRequired: 0,
      isReadOnly: 0,
      sort: currentTable.fields.length,
      status: 1,
      isSystemField: 0,
      listDisplay: 1,
    };
    setDetailTables(prev => prev.map(dt =>
      dt.key === activeDetailTab
        ? { ...dt, fields: [...dt.fields, newField] }
        : dt
    ));
  };

  // 明细表 - 删除单个字段
  const handleDeleteDetailField = (index: number) => {
    const currentTable = detailTables.find(dt => dt.key === activeDetailTab);
    if (!currentTable) return;
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除字段 "${currentTable.fields[index]?.fieldLabel}" 吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        const newFields = [...currentTable.fields];
        newFields.splice(index, 1);
        setDetailTables(prev => prev.map(dt =>
          dt.key === activeDetailTab
            ? { ...dt, fields: newFields }
            : dt
        ));
        message.success('字段已删除');
      },
    });
  };

  // 明细表 - 更新字段（使用 useCallback 缓存）
  const handleDetailFieldChange = useCallback((index: number, field: string, value: any) => {
    setDetailTables(prev => prev.map(dt => {
      if (dt.key !== activeDetailTab) return dt;
      
      const newFields = [...dt.fields];
      (newFields[index] as any)[field] = value;
      if (field === 'fieldHtmlType' || field === 'fieldType') {
        const htmlType = field === 'fieldHtmlType' ? value : newFields[index].fieldHtmlType;
        const type = field === 'fieldType' ? value : newFields[index].fieldType;
        (newFields[index] as any).fieldDbType = getDbTypeByFieldType(htmlType, type);
      }
      return { ...dt, fields: newFields };
    }));
  }, [activeDetailTab]);

  // 删除单个字段
  const handleDeleteField = (index: number) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除字段 "${fields[index]?.fieldLabel}" 吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        const newFields = [...fields];
        newFields.splice(index, 1);
        setFields(newFields);
        message.success('字段已删除');
      },
    });
  };

  // 更新字段（使用 useCallback 缓存，避免每次渲染都创建新的函数实例）
  const handleFieldChange = useCallback((index: number, field: string, value: any) => {
    setFields(prevFields => {
      const newFields = [...prevFields];
      (newFields[index] as any)[field] = value;

      if (field === 'fieldHtmlType' || field === 'fieldType') {
        const htmlType = field === 'fieldHtmlType' ? value : newFields[index].fieldHtmlType;
        const type = field === 'fieldType' ? value : newFields[index].fieldType;
        (newFields[index] as any).fieldDbType = getDbTypeByFieldType(htmlType, type);
      }

      return newFields;
    });
  }, []);

  // 拖拽结束
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFields((items) => {
        const oldIndex = items.findIndex((_, idx) => `field-${idx}` === active.id);
        const newIndex = items.findIndex((_, idx) => `field-${idx}` === over.id);
        if (oldIndex === -1 || newIndex === -1) return items;
        const newFields = [...items];
        const [moved] = newFields.splice(oldIndex, 1);
        newFields.splice(newIndex, 0, moved);
        return newFields.map((f, i) => ({ ...f, sort: i }));
      });
    }
  };

  // 明细表拖拽结束
  const handleDetailDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setDetailTables(prev => prev.map(dt => {
        if (dt.key !== activeDetailTab) return dt;
        const items = [...dt.fields];
        const oldIndex = items.findIndex((_, idx) => `detail-field-${idx}` === active.id);
        const newIndex = items.findIndex((_, idx) => `detail-field-${idx}` === over.id);
        if (oldIndex === -1 || newIndex === -1) return dt;
        const [moved] = items.splice(oldIndex, 1);
        items.splice(newIndex, 0, moved);
        return { ...dt, fields: items.map((f, i) => ({ ...f, sort: i })) };
      }));
    }
  };

  // 获取字段类型标签
  // 泛微E9标准：根据 fieldHtmlType 和 fieldType 获取字段类型标签
  const getFieldTypeLabel = (htmlType: number | undefined, type: number | undefined): string => {
    if (!htmlType) return '请选择';
    switch (htmlType) {
      case 1: // 文本字段
        const textTypeMap: Record<number, string> = { 1: '单行文本', 2: '多行文本', 3: '保密字段', 4: '整数', 5: '浮点数', 6: '金额转换', 7: '金额千分位' };
        return textTypeMap[type || 1] || '单行文本';
      case 2: // 多行文本
        return '多行文本';
      case 3: // 浏览按钮
        const browserTypeMap: Record<number, string> = { 1: '人力资源', 2: '部门', 3: '角色', 4: '岗位', 8: '项目', 16: '相关客户', 24: '文档', 30: '流程', 57: '附件', 98: '日期', 99: '时间', 164: '自定义浏览按钮', 256: '自定义树形单选', 257: '自定义树形多选' };
        return browserTypeMap[type || 1] || `浏览按钮(${type})`;
      case 4: // 选择框
        const selectTypeMap: Record<number, string> = { 1: '下拉框', 2: '单选框', 3: '复选框' };
        return selectTypeMap[type || 1] || '下拉框';
      case 5: // 附件上传
        return '附件上传';
      case 6: // 复选框
        return '复选框';
      case 7: // 特殊字段
        const specialTypeMap: Record<number, string> = { 1: '自定义链接', 2: '描述性文字', 3: '日期', 4: '时间' };
        return specialTypeMap[type || 1] || '日期';
      case 8: // 布局组件
        return '布局组件';
      default:
        return `未知类型(${htmlType}-${type})`;
    }
  };

  // 泛微E9标准：根据字段类型确定数据库类型
  const getDbTypeByFieldType = (htmlType: number, type: number): string => {
    switch (htmlType) {
      case 1: // 文本字段
        if (type === 2 || type === 3) return 'text'; // 多行文本、保密字段
        if (type === 4 || type === 7) return 'varchar'; // 金额转换、金额千分位
        if (type === 5) return 'decimal'; // 浮点数
        return 'varchar';
      case 2: // 多行文本
        return 'text';
      case 3: // 浏览按钮
        return 'varchar';
      case 4: // 选择框
        return 'varchar';
      case 5: // 附件上传
        return 'varchar';
      case 6: // 复选框
        return 'int';
      case 7: // 特殊字段
        if (type === 3) return 'date'; // 日期
        if (type === 4) return 'datetime'; // 时间
        return 'varchar';
      case 8: // 布局组件
        return 'varchar';
      default:
        return 'varchar';
    }
  };

  // 表格列定义（用 useMemo 缓存，避免每次渲染重新创建导致输入框失焦）
  const columns = useMemo(() => [
    {
      title: '序号',
      dataIndex: 'sort',
      key: 'sort',
      width: 70,
      render: (_: any, __: any, index: number) => <DragHandle index={index} />,
    },
    {
      title: '字段编码',
      dataIndex: 'fieldName',
      key: 'fieldName',
      width: 150,
      render: (value: string | undefined, record: any, index: number) => (
        <EditableCell
          value={value}
          record={record}
          index={index}
          field="fieldName"
          onChange={handleFieldChange}
        />
      ),
    },
    {
      title: '字段名称',
      dataIndex: 'fieldLabel',
      key: 'fieldLabel',
      width: 150,
      render: (value: string | undefined, record: any, index: number) => (
        <EditableCell
          value={value}
          record={record}
          index={index}
          field="fieldLabel"
          onChange={handleFieldChange}
        />
      ),
    },
    {
      title: '字段类型',
      dataIndex: 'fieldHtmlType',
      key: 'fieldHtmlType',
      width: 120,
      render: (value: number | undefined, record: any, index: number) => (
        <Select
          value={value}
          size="small"
          onChange={(val) => {
            handleFieldChange(index, 'fieldHtmlType', val);
            // 根据 htmltype 设置默认的 fieldType
            const defaultTypeMap: Record<number, number> = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 3, 8: 14 };
            handleFieldChange(index, 'fieldType', defaultTypeMap[val] || 1);
            // 自动设置数据库类型
            const dbType = getDbTypeByFieldType(val, defaultTypeMap[val] || 1);
            handleFieldChange(index, 'fieldDbType', dbType);
          }}
          style={{ width: '100%' }}
          bordered={false}
          disabled={record.isSystemField === 1}
        >
          <Select.Option value={1}>文本字段</Select.Option>
          <Select.Option value={2}>多行文本</Select.Option>
          <Select.Option value={3}>浏览按钮</Select.Option>
          <Select.Option value={4}>选择框</Select.Option>
          <Select.Option value={5}>附件上传</Select.Option>
          <Select.Option value={6}>复选框</Select.Option>
          <Select.Option value={7}>特殊字段</Select.Option>
          <Select.Option value={8}>布局组件</Select.Option>
        </Select>
      ),
    },
    {
      title: '类型',
      dataIndex: 'fieldType',
      key: 'fieldType',
      width: 130,
      render: (value: number | undefined, record: any, index: number) => {
        const htmlType = record.fieldHtmlType;
        // 根据 fieldHtmlType 动态渲染 fieldType 选项
        let options: React.ReactNode[] = [];
        switch (htmlType) {
          case 1: // 文本字段
            options = [
              <Select.Option key={1} value={1}>单行文本</Select.Option>,
              <Select.Option key={2} value={2}>多行文本</Select.Option>,
              <Select.Option key={3} value={3}>保密字段</Select.Option>,
              <Select.Option key={4} value={4}>整数</Select.Option>,
              <Select.Option key={5} value={5}>浮点数</Select.Option>,
              <Select.Option key={6} value={6}>金额转换</Select.Option>,
              <Select.Option key={7} value={7}>金额千分位</Select.Option>,
            ];
            break;
          case 2: // 多行文本
            options = [<Select.Option key={1} value={1}>多行文本</Select.Option>];
            break;
          case 3: // 浏览按钮
            options = [
              <Select.Option key={1} value={1}>人力资源</Select.Option>,
              <Select.Option key={2} value={2}>部门</Select.Option>,
              <Select.Option key={3} value={3}>角色</Select.Option>,
              <Select.Option key={4} value={4}>岗位</Select.Option>,
              <Select.Option key={8} value={8}>项目</Select.Option>,
              <Select.Option key={16} value={16}>相关客户</Select.Option>,
              <Select.Option key={24} value={24}>文档</Select.Option>,
              <Select.Option key={30} value={30}>流程</Select.Option>,
              <Select.Option key={57} value={57}>附件</Select.Option>,
              <Select.Option key={98} value={98}>日期</Select.Option>,
              <Select.Option key={99} value={99}>时间</Select.Option>,
              <Select.Option key={164} value={164}>自定义浏览按钮</Select.Option>,
              <Select.Option key={256} value={256}>自定义树形单选</Select.Option>,
              <Select.Option key={257} value={257}>自定义树形多选</Select.Option>,
            ];
            break;
          case 4: // 选择框
            options = [
              <Select.Option key={1} value={1}>下拉框</Select.Option>,
              <Select.Option key={2} value={2}>单选框</Select.Option>,
              <Select.Option key={3} value={3}>复选框</Select.Option>,
            ];
            break;
          case 5: // 附件上传
            options = [
              <Select.Option key={1} value={1}>附件上传</Select.Option>,
              <Select.Option key={2} value={2}>图片上传</Select.Option>,
            ];
            break;
          case 6: // 复选框
            options = [<Select.Option key={1} value={1}>复选框</Select.Option>];
            break;
          case 7: // 特殊字段
            options = [
              <Select.Option key={1} value={1}>自定义链接</Select.Option>,
              <Select.Option key={2} value={2}>描述性文字</Select.Option>,
              <Select.Option key={3} value={3}>日期</Select.Option>,
              <Select.Option key={4} value={4}>时间</Select.Option>,
            ];
            break;
          case 8: // 布局组件
            options = [<Select.Option key={14} value={14}>布局组件</Select.Option>];
            break;
          default:
            options = [<Select.Option key={0} value={0}>请先选择字段类型</Select.Option>];
        }
        // 浏览按钮类型：值区域点击预览，箭头点击类型选择
        if (htmlType === 3) {
          const typeLabelMap: Record<number, string> = {
            1: '人力资源', 2: '部门', 3: '角色', 4: '岗位', 8: '项目',
            16: '相关客户', 24: '文档', 30: '流程', 57: '附件',
            98: '日期', 99: '时间', 164: '自定义浏览按钮',
            161: '多人力资源', 17: '多部门', 18: '分部', 31: '多流程',
            26: '多文档', 167: '分权单人力资源', 168: '分权多人力资源',
            19: '分权单部门', 20: '分权多部门', 257: '自定义树形多选',
          };
          const currentLabel = typeLabelMap[value as number] || '未知类型';
          return (
            <div style={{ display: 'inline-block', width: '100%', position: 'relative' }}>
              {/* 值区域覆盖层：点击文字弹出预览，带下划线 */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setBrowserPreviewField({
                    label: currentLabel,
                    type: (value as number) || 1,
                  });
                  setBrowserPreviewVisible(true);
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: 'calc(100% - 28px)',
                  height: '100%',
                  zIndex: 2,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#1890ff',
                  textDecoration: 'underline',
                  paddingLeft: 8,
                  fontSize: 13,
                }}
                title="点击预览"
              >
                {currentLabel}
              </div>
              <Select
                value={value}
                size="small"
                onChange={(val) => {
                  handleFieldChange(index, 'fieldType', val);
                  const dbType = getDbTypeByFieldType(htmlType, val);
                  handleFieldChange(index, 'fieldDbType', dbType);
                }}
                style={{ width: '100%', opacity: 0 }}
                bordered={false}
                disabled={record.isSystemField === 1 || !htmlType}
                suffixIcon={null}
              >
                {options}
              </Select>
              {/* 箭头区域覆盖层：仅点击向下箭头才弹出类型选择弹窗 */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setPickerContext({
                    index,
                    isDetail: false,
                    currentType: (value as number) || 1,
                    fieldLabel: record.fieldLabel || currentLabel,
                    record,
                  });
                  setTypePickerVisible(true);
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: 28,
                  height: '100%',
                  zIndex: 2,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#999',
                  background: '#fff',
                }}
                title="点击选择浏览按钮类型"
              >
                <DownOutlined />
              </div>
            </div>
          );
        }
        return (
          <Select
            value={value}
            size="small"
            onChange={(val) => {
              handleFieldChange(index, 'fieldType', val);
              // 自动设置数据库类型
              const dbType = getDbTypeByFieldType(htmlType, val);
              handleFieldChange(index, 'fieldDbType', dbType);
            }}
            style={{ width: '100%' }}
            bordered={false}
            disabled={record.isSystemField === 1 || !htmlType}
          >
            {options}
          </Select>
        );
      },
    },
    {
      title: '数据库类型',
      dataIndex: 'fieldDbType',
      key: 'fieldDbType',
      width: 110,
      // 泛微E9标准：数据库类型根据字段类型自动确定，只读显示
      render: (value: string | undefined) => (
        <span style={{ padding: '0 8px' }}>{value || '-'}</span>
      ),
    },
    {
      title: '默认值',
      dataIndex: 'defaultValue',
      key: 'defaultValue',
      width: 120,
      render: (value: string | undefined, record: any, index: number) => (
        <Input
          value={value}
          size="small"
          onChange={(e) => handleFieldChange(index, 'defaultValue', e.target.value)}
          placeholder="默认值"
          bordered={false}
          style={{ padding: 0 }}
          disabled={record.isSystemField === 1}
        />
      ),
    },
    {
      title: '文本长度',
      dataIndex: 'fieldLength',
      key: 'fieldLength',
      width: 90,
      // 泛微E9标准：仅文本字段（htmlType=1）可设置文本长度
      render: (value: number | undefined, record: any, index: number) => (
        <InputNumber
          value={value}
          size="small"
          onChange={(val) => handleFieldChange(index, 'fieldLength', val)}
          min={0}
          max={4000}
          bordered={false}
          style={{ width: '100%', padding: 0 }}
          disabled={record.isSystemField === 1 || record.fieldHtmlType !== 1}
          placeholder={record.fieldHtmlType === 1 ? '长度' : '仅文本字段'}
        />
      ),
    },
    {
      title: '小数位数',
      dataIndex: 'fieldDecimals',
      key: 'fieldDecimals',
      width: 90,
      // 泛微E9标准：仅浮点数（htmlType=1, type=5）可设置小数位数
      render: (value: number | undefined, record: any, index: number) => (
        <InputNumber
          value={value}
          size="small"
          onChange={(val) => handleFieldChange(index, 'fieldDecimals', val)}
          min={0}
          max={10}
          bordered={false}
          style={{ width: '100%', padding: 0 }}
          disabled={record.isSystemField === 1 || !(record.fieldHtmlType === 1 && record.fieldType === 5)}
          placeholder={(record.fieldHtmlType === 1 && record.fieldType === 5) ? '小数位' : '仅浮点数'}
        />
      ),
    },
    {
      title: '必填',
      dataIndex: 'isRequired',
      key: 'isRequired',
      width: 60,
      render: (value: number | undefined, record: any, index: number) => (
        <Checkbox
          checked={value === 1}
          onChange={(e) => handleFieldChange(index, 'isRequired', e.target.checked ? 1 : 0)}
          disabled={record.isSystemField === 1}
        />
      ),
    },
    {
      title: '列表显示',
      dataIndex: 'listDisplay',
      key: 'listDisplay',
      width: 80,
      render: (value: number | undefined, record: any, index: number) => (
        <Switch
          checked={value === 1}
          size="small"
          onChange={(checked) => handleFieldChange(index, 'listDisplay', checked ? 1 : 0)}
          disabled={record.isSystemField === 1}
        />
      ),
    },
    {
      title: '前端显示',
      dataIndex: 'isReadOnly',
      key: 'isReadOnly',
      width: 80,
      render: (value: number | undefined, __: any, index: number) => (
        <Switch
          checked={value !== 1}
          size="small"
          onChange={(checked) => handleFieldChange(index, 'isReadOnly', checked ? 0 : 1)}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 90,
      render: (_: any, record: any, index: number) => (
        record.isSystemField === 1 ? null : (
          <Space size={0}>
            <Tooltip title="删除">
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => handleDeleteField(index)}
              />
            </Tooltip>
          </Space>
        )
      ),
    },
  ], [handleFieldChange]);

  // 表格行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedKeys);
    },
    getCheckboxProps: (record: any) => ({
      disabled: record.isSystemField === 1, // 系统字段禁止勾选
      style: record.isSystemField === 1 ? { cursor: 'not-allowed' } : {},
    }),
  };

  // 明细表列定义（用 useMemo 缓存）
  const detailColumns = useMemo(() => [
    {
      title: '序号',
      dataIndex: 'sort',
      key: 'sort',
      width: 70,
      render: (_: any, __: any, index: number) => <DragHandle index={index} />,
    },
    {
      title: '字段编码',
      dataIndex: 'fieldName',
      key: 'fieldName',
      width: 150,
      render: (value: string | undefined, record: any, index: number) => (
        <EditableCell
          value={value}
          record={record}
          index={index}
          field="fieldName"
          onChange={(index, field, value) => handleDetailFieldChange(index, field, value)}
        />
      ),
    },
    {
      title: '字段名称',
      dataIndex: 'fieldLabel',
      key: 'fieldLabel',
      width: 150,
      render: (value: string | undefined, record: any, index: number) => (
        <EditableCell
          value={value}
          record={record}
          index={index}
          field="fieldLabel"
          onChange={(index, field, value) => handleDetailFieldChange(index, field, value)}
        />
      ),
    },
    {
      title: '字段类型',
      dataIndex: 'fieldHtmlType',
      key: 'fieldHtmlType',
      width: 120,
      render: (value: number | undefined, record: any, index: number) => (
        <Select
          value={value}
          size="small"
          onChange={(val) => {
            handleDetailFieldChange(index, 'fieldHtmlType', val);
            // 根据 htmltype 设置默认的 fieldType
            const defaultTypeMap: Record<number, number> = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 3, 8: 14 };
            handleDetailFieldChange(index, 'fieldType', defaultTypeMap[val] || 1);
            // 自动设置数据库类型
            const dbType = getDbTypeByFieldType(val, defaultTypeMap[val] || 1);
            handleDetailFieldChange(index, 'fieldDbType', dbType);
          }}
          style={{ width: '100%' }}
          bordered={false}
          disabled={record.isSystemField === 1}
        >
          <Select.Option value={1}>文本字段</Select.Option>
          <Select.Option value={2}>多行文本</Select.Option>
          <Select.Option value={3}>浏览按钮</Select.Option>
          <Select.Option value={4}>选择框</Select.Option>
          <Select.Option value={5}>附件上传</Select.Option>
          <Select.Option value={6}>复选框</Select.Option>
          <Select.Option value={7}>特殊字段</Select.Option>
          <Select.Option value={8}>布局组件</Select.Option>
        </Select>
      ),
    },
    {
      title: '类型',
      dataIndex: 'fieldType',
      key: 'fieldType',
      width: 130,
      render: (value: number | undefined, record: any, index: number) => {
        const htmlType = record.fieldHtmlType;
        // 根据 fieldHtmlType 动态渲染 fieldType 选项
        let options: React.ReactNode[] = [];
        switch (htmlType) {
          case 1: // 文本字段
            options = [
              <Select.Option key={1} value={1}>单行文本</Select.Option>,
              <Select.Option key={2} value={2}>多行文本</Select.Option>,
              <Select.Option key={3} value={3}>保密字段</Select.Option>,
              <Select.Option key={4} value={4}>整数</Select.Option>,
              <Select.Option key={5} value={5}>浮点数</Select.Option>,
              <Select.Option key={6} value={6}>金额转换</Select.Option>,
              <Select.Option key={7} value={7}>金额千分位</Select.Option>,
            ];
            break;
          case 2: // 多行文本
            options = [<Select.Option key={1} value={1}>多行文本</Select.Option>];
            break;
          case 3: // 浏览按钮
            options = [
              <Select.Option key={1} value={1}>人力资源</Select.Option>,
              <Select.Option key={2} value={2}>部门</Select.Option>,
              <Select.Option key={3} value={3}>角色</Select.Option>,
              <Select.Option key={4} value={4}>岗位</Select.Option>,
              <Select.Option key={8} value={8}>项目</Select.Option>,
              <Select.Option key={16} value={16}>相关客户</Select.Option>,
              <Select.Option key={24} value={24}>文档</Select.Option>,
              <Select.Option key={30} value={30}>流程</Select.Option>,
              <Select.Option key={57} value={57}>附件</Select.Option>,
              <Select.Option key={98} value={98}>日期</Select.Option>,
              <Select.Option key={99} value={99}>时间</Select.Option>,
              <Select.Option key={164} value={164}>自定义浏览按钮</Select.Option>,
              <Select.Option key={256} value={256}>自定义树形单选</Select.Option>,
              <Select.Option key={257} value={257}>自定义树形多选</Select.Option>,
            ];
            break;
          case 4: // 选择框
            options = [
              <Select.Option key={1} value={1}>下拉框</Select.Option>,
              <Select.Option key={2} value={2}>单选框</Select.Option>,
              <Select.Option key={3} value={3}>复选框</Select.Option>,
            ];
            break;
          case 5: // 附件上传
            options = [
              <Select.Option key={1} value={1}>附件上传</Select.Option>,
              <Select.Option key={2} value={2}>图片上传</Select.Option>,
            ];
            break;
          case 6: // 复选框
            options = [<Select.Option key={1} value={1}>复选框</Select.Option>];
            break;
          case 7: // 特殊字段
            options = [
              <Select.Option key={1} value={1}>自定义链接</Select.Option>,
              <Select.Option key={2} value={2}>描述性文字</Select.Option>,
              <Select.Option key={3} value={3}>日期</Select.Option>,
              <Select.Option key={4} value={4}>时间</Select.Option>,
            ];
            break;
          case 8: // 布局组件
            options = [<Select.Option key={14} value={14}>布局组件</Select.Option>];
            break;
          default:
            options = [<Select.Option key={0} value={0}>请先选择字段类型</Select.Option>];
        }
        // 浏览按钮类型：值区域点击预览，箭头点击类型选择
        if (htmlType === 3) {
          const typeLabelMap: Record<number, string> = {
            1: '人力资源', 2: '部门', 3: '角色', 4: '岗位', 8: '项目',
            16: '相关客户', 24: '文档', 30: '流程', 57: '附件',
            98: '日期', 99: '时间', 164: '自定义浏览按钮',
            161: '多人力资源', 17: '多部门', 18: '分部', 31: '多流程',
            26: '多文档', 167: '分权单人力资源', 168: '分权多人力资源',
            19: '分权单部门', 20: '分权多部门', 257: '自定义树形多选',
          };
          const currentLabel = typeLabelMap[value as number] || '未知类型';
          return (
            <div style={{ display: 'inline-block', width: '100%', position: 'relative' }}>
              {/* 值区域覆盖层：点击文字弹出预览，带下划线 */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setBrowserPreviewField({
                    label: currentLabel,
                    type: (value as number) || 1,
                  });
                  setBrowserPreviewVisible(true);
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: 'calc(100% - 28px)',
                  height: '100%',
                  zIndex: 2,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#1890ff',
                  textDecoration: 'underline',
                  paddingLeft: 8,
                  fontSize: 13,
                }}
                title="点击预览"
              >
                {currentLabel}
              </div>
              <Select
                value={value}
                size="small"
                onChange={(val) => {
                  handleDetailFieldChange(index, 'fieldType', val);
                  const dbType = getDbTypeByFieldType(htmlType, val);
                  handleDetailFieldChange(index, 'fieldDbType', dbType);
                }}
                style={{ width: '100%', opacity: 0 }}
                bordered={false}
                disabled={record.isSystemField === 1 || !htmlType}
                suffixIcon={null}
              >
                {options}
              </Select>
              {/* 箭头区域覆盖层：仅点击向下箭头才弹出类型选择弹窗 */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setPickerContext({
                    index,
                    isDetail: true,
                    currentType: (value as number) || 1,
                    fieldLabel: record.fieldLabel || currentLabel,
                    record,
                  });
                  setTypePickerVisible(true);
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: 28,
                  height: '100%',
                  zIndex: 2,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#999',
                  background: '#fff',
                }}
                title="点击选择浏览按钮类型"
              >
                <DownOutlined />
              </div>
            </div>
          );
        }
        return (
          <Select
            value={value}
            size="small"
            onChange={(val) => {
              handleDetailFieldChange(index, 'fieldType', val);
              // 自动设置数据库类型
              const dbType = getDbTypeByFieldType(htmlType, val);
              handleDetailFieldChange(index, 'fieldDbType', dbType);
            }}
            style={{ width: '100%' }}
            bordered={false}
            disabled={record.isSystemField === 1 || !htmlType}
          >
            {options}
          </Select>
        );
      },
    },
    {
      title: '数据库类型',
      dataIndex: 'fieldDbType',
      key: 'fieldDbType',
      width: 110,
      // 泛微E9标准：数据库类型根据字段类型自动确定，只读显示
      render: (value: string | undefined) => (
        <span style={{ padding: '0 8px' }}>{value || '-'}</span>
      ),
    },
    {
      title: '默认值',
      dataIndex: 'defaultValue',
      key: 'defaultValue',
      width: 120,
      render: (value: string | undefined, record: any, index: number) => (
        <Input
          value={value}
          size="small"
          onChange={(e) => handleDetailFieldChange(index, 'defaultValue', e.target.value)}
          placeholder="默认值"
          bordered={false}
          style={{ padding: 0 }}
          disabled={record.isSystemField === 1}
        />
      ),
    },
    {
      title: '文本长度',
      dataIndex: 'fieldLength',
      key: 'fieldLength',
      width: 90,
      // 泛微E9标准：仅文本字段（htmlType=1）可设置文本长度
      render: (value: number | undefined, record: any, index: number) => (
        <InputNumber
          value={value}
          size="small"
          onChange={(val) => handleDetailFieldChange(index, 'fieldLength', val)}
          min={0}
          max={4000}
          bordered={false}
          style={{ width: '100%', padding: 0 }}
          disabled={record.isSystemField === 1 || record.fieldHtmlType !== 1}
          placeholder={record.fieldHtmlType === 1 ? '长度' : '仅文本字段'}
        />
      ),
    },
    {
      title: '小数位数',
      dataIndex: 'fieldDecimals',
      key: 'fieldDecimals',
      width: 90,
      // 泛微E9标准：仅浮点数（htmlType=1, type=5）可设置小数位数
      render: (value: number | undefined, record: any, index: number) => (
        <InputNumber
          value={value}
          size="small"
          onChange={(val) => handleDetailFieldChange(index, 'fieldDecimals', val)}
          min={0}
          max={10}
          bordered={false}
          style={{ width: '100%', padding: 0 }}
          disabled={record.isSystemField === 1 || !(record.fieldHtmlType === 1 && record.fieldType === 5)}
          placeholder={(record.fieldHtmlType === 1 && record.fieldType === 5) ? '小数位' : '仅浮点数'}
        />
      ),
    },
    {
      title: '必填',
      dataIndex: 'isRequired',
      key: 'isRequired',
      width: 60,
      render: (value: number | undefined, record: any, index: number) => (
        <Checkbox
          checked={value === 1}
          onChange={(e) => handleDetailFieldChange(index, 'isRequired', e.target.checked ? 1 : 0)}
          disabled={record.isSystemField === 1}
        />
      ),
    },
    {
      title: '列表显示',
      dataIndex: 'listDisplay',
      key: 'listDisplay',
      width: 80,
      render: (value: number | undefined, record: any, index: number) => (
        <Switch
          checked={value === 1}
          size="small"
          onChange={(checked) => handleDetailFieldChange(index, 'listDisplay', checked ? 1 : 0)}
          disabled={record.isSystemField === 1}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 90,
      render: (_: any, record: any, index: number) => (
        record.isSystemField === 1 ? null : (
          <Space size={0}>
            <Tooltip title="删除">
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => handleDeleteDetailField(index)}
              />
            </Tooltip>
          </Space>
        )
      ),
    },
  ], [handleDetailFieldChange]);

  // 获取当前激活明细表的行选择配置
  const getDetailRowSelection = () => {
    const currentTable = detailTables.find(dt => dt.key === activeDetailTab);
    if (!currentTable) return undefined;
    return {
      selectedRowKeys: currentTable.selectedRowKeys,
      onChange: (newSelectedKeys: React.Key[]) => {
        setDetailTables(prev => prev.map(dt =>
          dt.key === activeDetailTab ? { ...dt, selectedRowKeys: newSelectedKeys } : dt
        ));
      },
      getCheckboxProps: (record: any) => ({
        disabled: record.isSystemField === 1,
        style: record.isSystemField === 1 ? { cursor: 'not-allowed' } : {},
      }),
    };
  };

  // 明细表批量删除
  const handleBatchDeleteDetail = () => {
    const currentTable = detailTables.find(dt => dt.key === activeDetailTab);
    if (!currentTable) return;
    if (currentTable.selectedRowKeys.length === 0) {
      message.warning('请先勾选要删除的字段');
      return;
    }
    const selectedIndices = currentTable.selectedRowKeys
      .map((key) => {
        const match = key.toString().match(/detail-field-(\d+)/);
        return match ? parseInt(match[1]) : -1;
      })
      .filter((idx) => idx >= 0);

    const hasSystemField = selectedIndices.some((idx) => currentTable.fields[idx]?.isSystemField === 1);
    if (hasSystemField) {
      message.error('系统默认字段禁止删除');
      return;
    }

    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedIndices.length} 个字段吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        const newFields = currentTable.fields.filter((_, idx) => !selectedIndices.includes(idx));
        setDetailTables(prev => prev.map(dt =>
          dt.key === activeDetailTab
            ? { ...dt, fields: newFields, selectedRowKeys: [] }
            : dt
        ));
        message.success('字段已删除');
      },
    });
  };

  // 生成 SQL
  const generatePreviewSql = () => {
    if (!tableConfig.tableName) {
      message.warning('请先填写表名');
      return;
    }
    let sql = `CREATE TABLE IF NOT EXISTS \`${tableConfig.tableName}\` (\n`;
    sql += `  \`id\` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '主键',\n`;
    fields.forEach((field) => {
      const dbType = field.fieldDbType || 'varchar';
      const length = field.fieldLength || 255;
      const nullable = field.isRequired === 1 ? 'NOT NULL' : 'DEFAULT NULL';
      const defaultVal = field.defaultValue ? ` DEFAULT '${field.defaultValue}'` : '';
      const comment = field.fieldLabel ? ` COMMENT '${field.fieldLabel}'` : '';
      sql += `  \`${field.fieldName}\` ${dbType}(${length}) ${nullable}${defaultVal}${comment},\n`;
    });
    sql += `  PRIMARY KEY (\`id\`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='${tableConfig.formName || ''}';\n`;
    setPreviewSql(sql);
  };

  // 生成 JSON
  const generatePreviewFormJson = () => {
    const formJson = {
      formName: tableConfig.formName,
      tableName: tableConfig.tableName,
      description: tableConfig.description,
      fields: fields.map(f => ({
        name: f.fieldName,
        label: f.fieldLabel,
        type: getFieldTypeLabel(f.fieldHtmlType, f.fieldType),
        dbType: f.fieldDbType,
        length: f.fieldLength,
        required: f.isRequired === 1,
        readOnly: f.isReadOnly === 1,
        defaultValue: f.defaultValue,
        sort: f.sort,
      })),
    };
    setPreviewFormJson(JSON.stringify(formJson, null, 2));
  };

  // 保存
  const handleSave = async () => {
    if (!tableConfig.formName || !tableConfig.tableName) {
      message.error('请填写表单名称和表名');
      return;
    }
    if (fields.length === 0) {
      message.error('请至少添加一个字段');
      return;
    }
    setSaving(true);
    try {
      // 1. 保存表单定义
      let formId = tableConfig.id;
      const detailCount = detailTables.length;
      if (!formId) {
        const result = await formApi.create({
          formName: tableConfig.formName,
          tableName: tableConfig.tableName,
          description: tableConfig.description,
          status: tableConfig.status,
          detailTableCount: detailCount,
        } as any);
        formId = result.id;
        setTableConfig(prev => ({ ...prev, id: formId }));
        message.success('表单创建成功');
      } else {
        await formApi.update(formId, {
          formName: tableConfig.formName,
          tableName: tableConfig.tableName,
          description: tableConfig.description,
          status: tableConfig.status,
          detailTableCount: detailCount,
        } as any);
        message.success('表单更新成功');
      }

      // 2. 保存主表字段
      for (const field of fields) {
        const fieldData = { ...field, formId, isMain: 1 } as FieldDefinitionFormData;
        if (field.id) {
          await fieldApi.update(field.id, fieldData);
        } else {
          await fieldApi.create(fieldData);
        }
      }

      // 3. 保存明细表字段
      for (let dtIndex = 0; dtIndex < detailTables.length; dtIndex++) {
        const detailTable = detailTables[dtIndex];
        const detailIndex = dtIndex + 1; // 明细表索引从1开始
        for (const field of detailTable.fields) {
          const fieldData = {
            ...field,
            formId,
            detailTable: detailIndex,
            isMain: 0, // 明细表字段
          } as FieldDefinitionFormData;
          if (field.id) {
            await fieldApi.update(field.id, fieldData);
          } else {
            await fieldApi.create(fieldData);
          }
        }
      }
      message.success('表单定义保存成功');

      // 4. 创建数据库表
      Modal.confirm({
        title: '创建数据库表',
        content: '表单定义已保存，是否立即创建数据库表？',
        okText: '创建',
        cancelText: '稍后',
        onOk: async () => {
          try {
            if (!formId) {
              message.error('表单ID不存在');
              return;
            }
            const result = await formApi.createTable(formId);
            if (result.success) {
              message.success(result.msg || '数据库表创建成功');
            } else {
              message.error(result.msg || '数据库表创建失败');
            }
          } catch (error) {
            console.error('创建数据库表失败:', error);
            message.error('创建数据库表失败');
          }
        },
      });
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 导出
  const handleExport = () => {
    const data = {
      table: tableConfig,
      fields: fields,
      sql: previewSql,
      formJson: previewFormJson ? JSON.parse(previewFormJson) : null,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tableConfig.tableName || 'table'}_design.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('导出成功');
  };

  // ==================== 渲染 ====================

  return (
    <PageContainer
      title="低代码表设计器"
      extra={
        <Space>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            保存
          </Button>
          <Button icon={<EyeOutlined />} onClick={() => { generatePreviewSql(); generatePreviewFormJson(); setActiveTab('preview'); }}>
            预览
          </Button>
          <Button icon={<CodeOutlined />} onClick={handleExport}>
            导出
          </Button>
          <Button onClick={() => navigate('/formmode/formmanage')}>
            返回
          </Button>
        </Space>
      }
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        {/* ============ 设计器 Tab ============ */}
        <TabPane
          tab={<span><MenuOutlined /> 设计器</span>}
          key="design"
        >
          {/* ---- 表基本信息 ---- */}
          <Card title="表基本信息" size="small" style={{ marginBottom: 16 }}>
            {/* 新建表单时显示主表选择器 */}
            {!searchParams.get('id') && (
              <Row gutter={[24, 16]} style={{ marginBottom: 16 }}>
                <Col span={12}>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
                    基于已有主表
                  </label>
                  <Select
                    showSearch
                    value={selectedSourceFormId || undefined}
                    onChange={handleSelectExistingForm}
                    placeholder="选择已有主表，自动带出字段和明细表..."
                    allowClear
                    style={{ width: '100%' }}
                    filterOption={(input, option) =>
                      (option?.label as string || '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={(existingForms || []).map(f => ({
                      value: f.id,
                      label: `${f.formName} (${f.tableName})`,
                    }))}
                  />
                  <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                    选中后自动加载该表单的所有字段和明细表信息
                  </div>
                </Col>
              </Row>
            )}
            <Row gutter={[24, 16]}>
              <Col span={8}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
                  表名 <span style={{ color: '#ff4d4f' }}>*</span>
                </label>
                <Input
                  value={tableConfig.tableName}
                  readOnly={true}
                  placeholder="自动生成，不可修改"
                  style={{ backgroundColor: '#f5f5f5' }}
                />
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                  命名规则：formtable_main_{'{'}N{'}'}，N 自动累加
                </div>
              </Col>
              <Col span={8}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
                  表描述 <span style={{ color: '#ff4d4f' }}>*</span>
                </label>
                <Input
                  value={tableConfig.formName}
                  onChange={(e) => handleTableConfigChange('formName', e.target.value)}
                  placeholder="输入表描述"
                />
              </Col>
              <Col span={4}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>表类型</label>
                <Select defaultValue="1" style={{ width: '100%' }}>
                  <Select.Option value="1">普通表</Select.Option>
                  <Select.Option value="2">树形表</Select.Option>
                  <Select.Option value="3">关联表</Select.Option>
                </Select>
              </Col>
              <Col span={4}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>状态</label>
                <Switch
                  checked={tableConfig.status === 1}
                  onChange={(checked) => handleTableConfigChange('status', checked ? 1 : 0)}
                  checkedChildren="启用"
                  unCheckedChildren="禁用"
                />
              </Col>
            </Row>
            <Row gutter={[24, 16]} style={{ marginTop: 8 }}>
              <Col span={8}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>表描述</label>
                <TextArea
                  value={tableConfig.description}
                  onChange={(e) => handleTableConfigChange('description', e.target.value)}
                  placeholder="输入表描述"
                  rows={2}
                />
              </Col>
              <Col span={8}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>表分类</label>
                <Select defaultValue="1" style={{ width: '100%' }}>
                  <Select.Option value="1">业务表</Select.Option>
                  <Select.Option value="2">系统表</Select.Option>
                  <Select.Option value="3">字典表</Select.Option>
                </Select>
              </Col>
              <Col span={8}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>主题类型</label>
                <Select defaultValue="default" style={{ width: '100%' }}>
                  <Select.Option value="default">默认主题</Select.Option>
                  <Select.Option value="dark">深色主题</Select.Option>
                  <Select.Option value="light">浅色主题</Select.Option>
                </Select>
              </Col>
            </Row>
          </Card>

          {/* ---- 功能配置 ---- */}
          <Card title="功能配置" size="small" style={{ marginBottom: 16 }}>
            <Row gutter={[16, 8]}>
              <Col span={3}>
                <Checkbox
                  checked={featureConfig.enableAdd}
                  onChange={(e) => setFeatureConfig(prev => ({ ...prev, enableAdd: e.target.checked }))}
                >
                  新增
                </Checkbox>
              </Col>
              <Col span={3}>
                <Checkbox
                  checked={featureConfig.enableEdit}
                  onChange={(e) => setFeatureConfig(prev => ({ ...prev, enableEdit: e.target.checked }))}
                >
                  修改
                </Checkbox>
              </Col>
              <Col span={3}>
                <Checkbox
                  checked={featureConfig.enableDelete}
                  onChange={(e) => setFeatureConfig(prev => ({ ...prev, enableDelete: e.target.checked }))}
                >
                  删除
                </Checkbox>
              </Col>
              <Col span={3}>
                <Checkbox
                  checked={featureConfig.enableView}
                  onChange={(e) => setFeatureConfig(prev => ({ ...prev, enableView: e.target.checked }))}
                >
                  查看
                </Checkbox>
              </Col>
              <Col span={3}>
                <Checkbox
                  checked={featureConfig.enableImport}
                  onChange={(e) => setFeatureConfig(prev => ({ ...prev, enableImport: e.target.checked }))}
                >
                  导入
                </Checkbox>
              </Col>
              <Col span={3}>
                <Checkbox
                  checked={featureConfig.enableExport}
                  onChange={(e) => setFeatureConfig(prev => ({ ...prev, enableExport: e.target.checked }))}
                >
                  导出
                </Checkbox>
              </Col>
              <Col span={3}>
                <Checkbox
                  checked={featureConfig.enablePrint}
                  onChange={(e) => setFeatureConfig(prev => ({ ...prev, enablePrint: e.target.checked }))}
                >
                  打印
                </Checkbox>
              </Col>
            </Row>
          </Card>

          {/* ---- 字段列表表格 ---- */}
          <Card
            title={
              <Space>
                <DatabaseOutlined />
                <span>字段列表</span>
                <Tag color="blue">{fields.length}个字段</Tag>
              </Space>
            }
            size="small"
            extra={
              <Space>
                <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAddField}>
                  新增字段
                </Button>
                <Button size="small" icon={<DeleteOutlined />} onClick={handleBatchDelete}>
                  批量删除
                </Button>
              </Space>
            }
          >
            {/* 字段属性子标签 */}
            <Tabs
              size="small"
              tabBarStyle={{ marginBottom: 12 }}
              items={[
                { key: 'db', label: <span><DatabaseOutlined />数据库属性</span> },
                { key: 'page', label: <span><FormOutlined />页面属性</span> },
                { key: 'query', label: <span><SearchOutlined />查询属性</span> },
                { key: 'dict', label: <span><FileTextOutlined />字典配置</span> },
                { key: 'import', label: <span><ExportOutlined />导入导出</span> },
                { key: 'stats', label: <span><BarChartOutlined />统计配置</span> },
                { key: 'fk', label: <span><LinkOutlined />外键</span> },
                { key: 'index', label: <span><KeyOutlined />索引</span> },
              ]}
            />

            {/* 字段表格 */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={fields.map((_, idx) => `field-${idx}`)}
                strategy={verticalListSortingStrategy}
              >
                <Table
                  dataSource={fields}
                  columns={columns}
                  rowKey={(_, index) => `field-${index}`}
                  pagination={false}
                  size="small"
                  bordered
                  scroll={{ x: 1300 }}
                  rowSelection={rowSelection}
                  components={{
                    body: {
                      row: (props: any) => {
                        const rowIndex = fields.findIndex(
                          (_, idx) => props['data-row-key'] === `field-${idx}`
                        );
                        if (rowIndex === -1) return <tr {...props} />;
                        return <DragableTableRow index={rowIndex}>{props.children}</DragableTableRow>;
                      },
                    },
                  }}
                  onRow={(_, index) => ({
                    style: { cursor: 'grab' },
                  })}
                  locale={{
                    emptyText: (
                      <div style={{ padding: 20 }}>
                        <p>暂无字段，点击"新增字段"开始设计</p>
                      </div>
                    ),
                  }}
                />
              </SortableContext>
            </DndContext>

            <Divider />

            {/* ---- 明细表区域 ---- */}
            <Card
              title={
                <Space>
                  <AppstoreOutlined />
                  <span>明细表</span>
                  <Tag color="blue">{detailTables.length}个明细表</Tag>
                </Space>
              }
              size="small"
              style={{ marginTop: 16 }}
              extra={
                <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAddDetailTable}>
                  新增明细表
                </Button>
              }
            >
              {detailTables.length > 0 ? (
                <Tabs
                  activeKey={activeDetailTab}
                  onChange={setActiveDetailTab}
                  type="card"
                >
                  {detailTables.map(dt => (
                    <TabPane
                      tab={
                        <span>
                          {dt.config.tableName}
                          <CloseOutlined
                            style={{ marginLeft: 8, fontSize: 10, color: '#999', cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveDetailTable(dt.key);
                            }}
                          />
                        </span>
                      }
                      key={dt.key}
                    >
                      {/* 明细表基本信息 */}
                      <Card title="明细表基本信息" size="small" style={{ marginBottom: 16 }} bordered={false}>
                        <Row gutter={[24, 16]}>
                          <Col span={8}>
                            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
                              明细表名 <span style={{ color: '#ff4d4f' }}>*</span>
                            </label>
                            <Input
                              value={dt.config.tableName}
                              onChange={(e) => {
                                setDetailTables(prev => prev.map(t =>
                                  t.key === dt.key ? { ...t, config: { ...t.config, tableName: e.target.value } } : t
                                ));
                              }}
                              placeholder="如：form_table_detail"
                            />
                          </Col>
                          <Col span={8}>
                            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
                              明细表描述 <span style={{ color: '#ff4d4f' }}>*</span>
                            </label>
                            <Input
                              value={dt.config.formName}
                              onChange={(e) => {
                                setDetailTables(prev => prev.map(t =>
                                  t.key === dt.key ? { ...t, config: { ...t.config, formName: e.target.value } } : t
                                ));
                              }}
                              placeholder="输入明细表描述"
                            />
                          </Col>
                          <Col span={4}>
                            <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>状态</label>
                            <Switch
                              checked={dt.config.status === 1}
                              onChange={(checked) => {
                                setDetailTables(prev => prev.map(t =>
                                  t.key === dt.key ? { ...t, config: { ...t.config, status: checked ? 1 : 0 } } : t
                                ));
                              }}
                              checkedChildren="启用"
                              unCheckedChildren="禁用"
                            />
                          </Col>
                        </Row>
                      </Card>

                      {/* 明细表字段列表 */}
                      <Card
                        title={
                          <Space>
                            <DatabaseOutlined />
                            <span>明细表字段列表</span>
                            <Tag color="blue">{dt.fields.length}个字段</Tag>
                          </Space>
                        }
                        size="small"
                        bordered={false}
                        extra={
                          <Space>
                            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAddDetailField}>
                              新增字段
                            </Button>
                            <Button size="small" icon={<DeleteOutlined />} onClick={handleBatchDeleteDetail}>
                              批量删除
                            </Button>
                          </Space>
                        }
                      >
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDetailDragEnd}>
                          <SortableContext
                            items={dt.fields.map((_, idx) => `detail-field-${idx}`)}
                            strategy={verticalListSortingStrategy}
                          >
                            <Table
                              dataSource={dt.fields}
                              columns={detailColumns}
                              rowKey={(_, index) => `detail-field-${index}`}
                              pagination={false}
                              size="small"
                              bordered
                              scroll={{ x: 1300 }}
                              rowSelection={getDetailRowSelection()}
                              components={{
                                body: {
                                  row: (props: any) => {
                                    const rowIndex = dt.fields.findIndex(
                                      (_, idx) => props['data-row-key'] === `detail-field-${idx}`
                                    );
                                    if (rowIndex === -1) return <tr {...props} />;
                                    return <DragableTableRow index={rowIndex} idPrefix="detail-field">{props.children}</DragableTableRow>;
                                  },
                                },
                              }}
                              onRow={(_, index) => ({
                                style: { cursor: 'grab' },
                              })}
                              locale={{
                                emptyText: (
                                  <div style={{ padding: 20 }}>
                                    <p>暂无字段，点击"新增字段"开始设计</p>
                                  </div>
                                ),
                              }}
                            />
                          </SortableContext>
                        </DndContext>
                      </Card>
                    </TabPane>
                  ))}
                </Tabs>
              ) : (
                <Empty description="暂无明细表，点击右上角 + 按钮新增" />
              )}
            </Card>
          </Card>
        </TabPane>

        {/* ============ 预览 Tab ============ */}
        <TabPane
          tab={<span><EyeOutlined /> 预览</span>}
          key="preview"
        >
          <Tabs>
            <TabPane tab={<span><CodeOutlined /> SQL</span>} key="sql">
              <div>
                <Button type="primary" style={{ marginBottom: 12 }} onClick={generatePreviewSql}>
                  生成 SQL
                </Button>
                <pre
                  style={{
                    padding: 16,
                    background: '#1e1e1e',
                    color: '#d4d4d4',
                    borderRadius: 4,
                    overflow: 'auto',
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  {previewSql || '点击生成 SQL 按钮预览'}
                </pre>
              </div>
            </TabPane>
            <TabPane tab={<span><FileTextOutlined /> JSON</span>} key="json">
              <div>
                <Button type="primary" style={{ marginBottom: 12 }} onClick={generatePreviewFormJson}>
                  生成表单 JSON
                </Button>
                <pre
                  style={{
                    padding: 16,
                    background: '#f5f5f5',
                    borderRadius: 4,
                    overflow: 'auto',
                    maxHeight: 500,
                  }}
                >
                  {previewFormJson || '点击生成表单 JSON 按钮预览'}
                </pre>
              </div>
            </TabPane>
          </Tabs>
        </TabPane>

      </Tabs>

      {/* 浏览按钮预览弹窗 */}
      <BrowserButtonPreview
        visible={browserPreviewVisible}
        fieldLabel={browserPreviewField?.label || ''}
        browserType={browserPreviewField?.type || 1}
        onClose={() => setBrowserPreviewVisible(false)}
      />

      {/* 浏览按钮类型选择器（分类弹窗） */}
      <BrowserTypePicker
        visible={typePickerVisible}
        currentTypeId={pickerContext?.currentType}
        onConfirm={(typeId, typeLabel) => {
          // 更新字段类型值
          if (pickerContext) {
            if (pickerContext.isDetail) {
              handleDetailFieldChange(pickerContext.index, 'fieldType', typeId);
              const dbType = getDbTypeByFieldType(3, typeId);
              handleDetailFieldChange(pickerContext.index, 'fieldDbType', dbType);
            } else {
              handleFieldChange(pickerContext.index, 'fieldType', typeId);
              const dbType = getDbTypeByFieldType(3, typeId);
              handleFieldChange(pickerContext.index, 'fieldDbType', dbType);
            }
          }
          // 关闭选择器并打开预览
          setTypePickerVisible(false);
          setBrowserPreviewField({
            label: pickerContext?.fieldLabel || typeLabel,
            type: typeId,
          });
          setBrowserPreviewVisible(true);
        }}
        onCancel={() => setTypePickerVisible(false)}
      />
    </PageContainer>
  );
};

export default TableDesign;
