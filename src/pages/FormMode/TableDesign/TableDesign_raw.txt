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
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useNavigate } from '@umijs/max';
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
} from 'antd';
import React, { useState } from 'react';
import { formApi, fieldApi } from '@/services/formmode';
import type { FormDefinition, FieldDefinitionFormData } from '@/services/formmode/typings';

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

// ==================== 可拖拽表格行组件 ====================

interface DragableTableRowProps {
  index: number;
  children: React.ReactNode;
}

const DragableTableRow: React.FC<DragableTableRowProps> = ({ index, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `field-${index}` });

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
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('design');

  // 表配置
  const [tableConfig, setTableConfig] = useState<Partial<FormDefinition>>({
    id: '',
    formName: '',
    tableName: '',
    description: '',
    status: 1 as any,
  });

  // 字段列表 - 默认初始化8个系统字段
  const [fields, setFields] = useState<Partial<FieldDefinitionFormData>[]>(() => {
    const systemFields: Partial<FieldDefinitionFormData>[] = [
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
    return systemFields;
  });

  // 预览数据
  const [previewSql, setPreviewSql] = useState('');
  const [previewFormJson, setPreviewFormJson] = useState('');

  // 主表选中行
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 明细表配置
  const [detailTableConfig, setDetailTableConfig] = useState<Partial<FormDefinition>>({
    id: '',
    formName: '',
    tableName: '',
    description: '',
    status: 1 as any,
  });
  // 明细表字段列表
  const [detailFields, setDetailFields] = useState<Partial<FieldDefinitionFormData>[]>(() => {
    const mainTableName = tableConfig.tableName || 'main';
    const sysFields: Partial<FieldDefinitionFormData>[] = [
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
        fieldName: `${mainTableName}_id`,
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
    return sysFields;
  });

  // 当主表名变化时，自动更新明细表的外键字段名
  React.useEffect(() => {
    if (tableConfig.tableName) {
      const fkFieldName = `${tableConfig.tableName}_id`;
      setDetailFields(prev => {
        if (prev.length >= 2) {
          const newFields = [...prev];
          if (newFields[1]) {
            newFields[1] = { ...newFields[1], fieldName: fkFieldName, fieldLabel: '主表ID' };
          }
          return newFields;
        }
        return prev;
      });
    }
  }, [tableConfig.tableName]);
  // 明细表选中行
  const [detailSelectedRowKeys, setDetailSelectedRowKeys] = useState<React.Key[]>([]);


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
    const newField: Partial<FieldDefinitionFormData> = {
      fieldName: `field_${detailFields.length + 1}`,
      fieldLabel: `字段${detailFields.length + 1}`,
      fieldHtmlType: 1,
      fieldType: 1,
      fieldDbType: 'varchar',
      fieldLength: 255,
      isRequired: 0,
      isReadOnly: 0,
      sort: detailFields.length,
      status: 1,
      isSystemField: 0,
      listDisplay: 1,
    };
    setDetailFields([...detailFields, newField]);
  };

  // 明细表 - 删除单个字段
  const handleDeleteDetailField = (index: number) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除字段 "${detailFields[index]?.fieldLabel}" 吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        const newFields = [...detailFields];
        newFields.splice(index, 1);
        setDetailFields(newFields);
        message.success('字段已删除');
      },
    });
  };

  // 明细表 - 更新字段
  const handleDetailFieldChange = (index: number, field: string, value: any) => {
    const newFields = [...detailFields];
    (newFields[index] as any)[field] = value;
    if (field === 'fieldHtmlType' || field === 'fieldType') {
      const htmlType = field === 'fieldHtmlType' ? value : newFields[index].fieldHtmlType;
      const type = field === 'fieldType' ? value : newFields[index].fieldType;
      (newFields[index] as any).fieldDbType = getDbTypeByFieldType(htmlType, type);
    }
    setDetailFields(newFields);
  };

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

  // 更新字段
  const handleFieldChange = (index: number, field: string, value: any) => {
    const newFields = [...fields];
    (newFields[index] as any)[field] = value;

    if (field === 'fieldHtmlType' || field === 'fieldType') {
      const htmlType = field === 'fieldHtmlType' ? value : newFields[index].fieldHtmlType;
      const type = field === 'fieldType' ? value : newFields[index].fieldType;
      (newFields[index] as any).fieldDbType = getDbTypeByFieldType(htmlType, type);
    }

    setFields(newFields);
  };

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

  // 获取字段类型标签
  const getFieldTypeLabel = (htmlType: number | undefined, type: number | undefined): string => {
    const typeMap: Record<string, string> = {
      '1-1': '单行文本',
      '1-2': '多行文本',
      '1-3': '保密字段',
      '2-1': '人力资源',
      '3-1': '单选框',
      '3-2': '多选框',
      '3-3': '下拉框',
      '4-1': '附件上传',
      '5-1': '日期',
      '5-2': '时间',
      '6-1': '复选框',
    };
    return typeMap[`${htmlType}-${type}`] || `未知类型(${htmlType}-${type})`;
  };

  // 根据字段类型确定数据库类型
  const getDbTypeByFieldType = (htmlType: number, type: number): string => {
    if (htmlType === 1) return 'varchar';
    else if (htmlType === 2) return 'varchar';
    else if (htmlType === 3) return 'varchar';
    else if (htmlType === 4) return 'varchar';
    else if (htmlType === 5) {
      if (type === 1) return 'date';
      if (type === 2) return 'datetime';
      return 'varchar';
    } else if (htmlType === 6) return 'int';
    return 'varchar';
  };

  // 表格列定义
  const columns = [
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
        <Input
          value={value}
          size="small"
          onChange={(e) => handleFieldChange(index, 'fieldName', e.target.value)}
          placeholder="字段编码"
          bordered={false}
          style={{ padding: 0 }}
          disabled={record.isSystemField === 1}
        />
      ),
    },
    {
      title: '字段名称',
      dataIndex: 'fieldLabel',
      key: 'fieldLabel',
      width: 150,
      render: (value: string | undefined, record: any, index: number) => (
        <Input
          value={value}
          size="small"
          onChange={(e) => handleFieldChange(index, 'fieldLabel', e.target.value)}
          placeholder="字段名称"
          bordered={false}
          style={{ padding: 0 }}
          disabled={false}  // 字段名称始终可编辑
        />
      ),
    },
    {
      title: '字段类型',
      dataIndex: 'fieldHtmlType',
      key: 'fieldHtmlType',
      width: 130,
      render: (value: number | undefined, record: any, index: number) => (
        <Select
          value={value}
          size="small"
          onChange={(val) => handleFieldChange(index, 'fieldHtmlType', val)}
          style={{ width: '100%' }}
          bordered={false}
          disabled={record.isSystemField === 1}
        >
          <Select.Option value={1}>单行文本</Select.Option>
          <Select.Option value={2}>多行文本</Select.Option>
          <Select.Option value={3}>下拉框</Select.Option>
          <Select.Option value={4}>日期</Select.Option>
          <Select.Option value={5}>数字</Select.Option>
          <Select.Option value={6}>复选框</Select.Option>
        </Select>
      ),
    },
    {
      title: '数据库类型',
      dataIndex: 'fieldDbType',
      key: 'fieldDbType',
      width: 110,
      render: (value: string | undefined, record: any, index: number) => (
        <Select
          value={value}
          size="small"
          onChange={(val) => handleFieldChange(index, 'fieldDbType', val)}
          style={{ width: '100%' }}
          bordered={false}
          disabled={record.isSystemField === 1}
        >
          <Select.Option value="varchar">varchar</Select.Option>
          <Select.Option value="int">int</Select.Option>
          <Select.Option value="bigint">bigint</Select.Option>
          <Select.Option value="decimal">decimal</Select.Option>
          <Select.Option value="date">date</Select.Option>
          <Select.Option value="datetime">datetime</Select.Option>
          <Select.Option value="text">text</Select.Option>
        </Select>
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
      title: '字段长度',
      dataIndex: 'fieldLength',
      key: 'fieldLength',
      width: 90,
      render: (value: number | undefined, record: any, index: number) => (
        <InputNumber
          value={value}
          size="small"
          onChange={(val) => handleFieldChange(index, 'fieldLength', val)}
          min={0}
          bordered={false}
          style={{ width: '100%', padding: 0 }}
          disabled={record.isSystemField === 1}
        />
      ),
    },
    {
      title: '小数位数',
      dataIndex: 'fieldDecimals',
      key: 'fieldDecimals',
      width: 90,
      render: (value: number | undefined, record: any, index: number) => (
        <InputNumber
          value={value}
          size="small"
          onChange={(val) => handleFieldChange(index, 'fieldDecimals', val)}
          min={0}
          max={10}
          bordered={false}
          style={{ width: '100%', padding: 0 }}
          disabled={record.isSystemField === 1}
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
      width: 60,
      render: (_: any, record: any, index: number) => (
        record.isSystemField === 1 ? null : (
          <Tooltip title="删除">
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteField(index)}
            />
          </Tooltip>
        )
      ),
    },
  ];

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

  // 明细表列定义
  const detailColumns = [
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
        <Input
          value={value}
          size="small"
          onChange={(e) => handleDetailFieldChange(index, 'fieldName', e.target.value)}
          placeholder="字段编码"
          bordered={false}
          style={{ padding: 0 }}
          disabled={record.isSystemField === 1}
        />
      ),
    },
    {
      title: '字段名称',
      dataIndex: 'fieldLabel',
      key: 'fieldLabel',
      width: 150,
      render: (value: string | undefined, __: any, index: number) => (
        <Input
          value={value}
          size="small"
          onChange={(e) => handleDetailFieldChange(index, 'fieldLabel', e.target.value)}
          placeholder="字段名称"
          bordered={false}
          style={{ padding: 0 }}
          disabled={false}
        />
      ),
    },
    {
      title: '字段类型',
      dataIndex: 'fieldHtmlType',
      key: 'fieldHtmlType',
      width: 130,
      render: (value: number | undefined, record: any, index: number) => (
        <Select
          value={value}
          size="small"
          onChange={(val) => handleDetailFieldChange(index, 'fieldHtmlType', val)}
          style={{ width: '100%' }}
          bordered={false}
          disabled={record.isSystemField === 1}
        >
          <Select.Option value={1}>单行文本</Select.Option>
          <Select.Option value={2}>多行文本</Select.Option>
          <Select.Option value={3}>下拉框</Select.Option>
          <Select.Option value={4}>日期</Select.Option>
          <Select.Option value={5}>数字</Select.Option>
          <Select.Option value={6}>复选框</Select.Option>
        </Select>
      ),
    },
    {
      title: '数据库类型',
      dataIndex: 'fieldDbType',
      key: 'fieldDbType',
      width: 110,
      render: (value: string | undefined, record: any, index: number) => (
        <Select
          value={value}
          size="small"
          onChange={(val) => handleDetailFieldChange(index, 'fieldDbType', val)}
          style={{ width: '100%' }}
          bordered={false}
          disabled={record.isSystemField === 1}
        >
          <Select.Option value="varchar">varchar</Select.Option>
          <Select.Option value="int">int</Select.Option>
          <Select.Option value="bigint">bigint</Select.Option>
          <Select.Option value="decimal">decimal</Select.Option>
          <Select.Option value="date">date</Select.Option>
          <Select.Option value="datetime">datetime</Select.Option>
          <Select.Option value="text">text</Select.Option>
        </Select>
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
      title: '字段长度',
      dataIndex: 'fieldLength',
      key: 'fieldLength',
      width: 90,
      render: (value: number | undefined, record: any, index: number) => (
        <InputNumber
          value={value}
          size="small"
          onChange={(val) => handleDetailFieldChange(index, 'fieldLength', val)}
          min={0}
          bordered={false}
          style={{ width: '100%', padding: 0 }}
          disabled={record.isSystemField === 1}
        />
      ),
    },
    {
      title: '小数位数',
      dataIndex: 'fieldDecimals',
      key: 'fieldDecimals',
      width: 90,
      render: (value: number | undefined, record: any, index: number) => (
        <InputNumber
          value={value}
          size="small"
          onChange={(val) => handleDetailFieldChange(index, 'fieldDecimals', val)}
          min={0}
          max={10}
          bordered={false}
          style={{ width: '100%', padding: 0 }}
          disabled={record.isSystemField === 1}
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
      width: 60,
      render: (_: any, record: any, index: number) => (
        record.isSystemField === 1 ? null : (
          <Tooltip title="删除">
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteDetailField(index)}
            />
          </Tooltip>
        )
      ),
    },
  ];

  // 明细表行选择配置
  const detailRowSelection = {
    selectedRowKeys: detailSelectedRowKeys,
    onChange: (newSelectedKeys: React.Key[]) => {
      setDetailSelectedRowKeys(newSelectedKeys);
    },
    getCheckboxProps: (record: any) => ({
      disabled: record.isSystemField === 1,
      style: record.isSystemField === 1 ? { cursor: 'not-allowed' } : {},
    }),
  };

  // 明细表批量删除
  const handleBatchDeleteDetail = () => {
    if (detailSelectedRowKeys.length === 0) {
      message.warning('请先勾选要删除的字段');
      return;
    }
    const selectedIndices = detailSelectedRowKeys
      .map((key) => {
        const match = key.toString().match(/detail-field-(\d+)/);
        return match ? parseInt(match[1]) : -1;
      })
      .filter((idx) => idx >= 0);

    const hasSystemField = selectedIndices.some((idx) => detailFields[idx]?.isSystemField === 1);
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
        const newFields = detailFields.filter((_, idx) => !selectedIndices.includes(idx));
        setDetailFields(newFields);
        setDetailSelectedRowKeys([]);
        message.success('字段已删除');
      },
    });
  };

  // 明细表配置变更
  const handleDetailTableConfigChange = (field: string, value: any) => {
    setDetailTableConfig(prev => ({ ...prev, [field]: value }));
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
      if (!formId) {
        const result = await formApi.create({
          formName: tableConfig.formName,
          tableName: tableConfig.tableName,
          description: tableConfig.description,
          status: tableConfig.status,
        });
        formId = result.id;
        setTableConfig(prev => ({ ...prev, id: formId }));
        message.success('表单创建成功');
      } else {
        await formApi.update(formId, {
          formName: tableConfig.formName,
          tableName: tableConfig.tableName,
          description: tableConfig.description,
          status: tableConfig.status,
        });
        message.success('表单更新成功');
      }
      // 2. 保存字段
      for (const field of fields) {
        const fieldData = { ...field, formId } as FieldDefinitionFormData;
        if (field.id) {
          await fieldApi.update(field.id, fieldData);
        } else {
          await fieldApi.create(fieldData);
        }
      }
      message.success('保存成功');
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
            <Row gutter={[24, 16]}>
              <Col span={8}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
                  表名 <span style={{ color: '#ff4d4f' }}>*</span>
                </label>
                <Input
                  value={tableConfig.tableName}
                  onChange={(e) => handleTableConfigChange('tableName', e.target.value)}
                  placeholder="如：form_table_main"
                />
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

        {/* ============ 明细表 Tab ============ */}
        <TabPane
          tab={<span><AppstoreOutlined /> 明细表</span>}
          key="detail"
        >
          {/* ---- 明细表基本信息 ---- */}
          <Card title="明细表基本信息" size="small" style={{ marginBottom: 16 }}>
            <Row gutter={[24, 16]}>
              <Col span={8}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
                  明细表名 <span style={{ color: '#ff4d4f' }}>*</span>
                </label>
                <Input
                  value={detailTableConfig.tableName}
                  onChange={(e) => handleDetailTableConfigChange('tableName', e.target.value)}
                  placeholder="如：form_table_detail"
                />
              </Col>
              <Col span={8}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
                  明细表描述 <span style={{ color: '#ff4d4f' }}>*</span>
                </label>
                <Input
                  value={detailTableConfig.formName}
                  onChange={(e) => handleDetailTableConfigChange('formName', e.target.value)}
                  placeholder="输入明细表描述"
                />
              </Col>
              <Col span={4}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>状态</label>
                <Switch
                  checked={detailTableConfig.status === 1}
                  onChange={(checked) => handleDetailTableConfigChange('status', checked ? 1 : 0)}
                  checkedChildren="启用"
                  unCheckedChildren="禁用"
                />
              </Col>
            </Row>
          </Card>

          {/* ---- 明细表字段列表 ---- */}
          <Card
            title={
              <Space>
                <DatabaseOutlined />
                <span>明细表字段列表</span>
                <Tag color="blue">{detailFields.length}个字段</Tag>
              </Space>
            }
            size="small"
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
            <Table
              dataSource={detailFields}
              columns={detailColumns}
              rowKey={(_, index) => `detail-field-${index}`}
              pagination={false}
              size="small"
              bordered
              scroll={{ x: 1300 }}
              rowSelection={detailRowSelection}
              components={{
                body: {
                  row: (props: any) => {
                    const rowIndex = detailFields.findIndex(
                      (_, idx) => props['data-row-key'] === `detail-field-${idx}`
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
          </Card>
        </TabPane>
      </Tabs>
    </PageContainer>
  );
};

export default TableDesign;

