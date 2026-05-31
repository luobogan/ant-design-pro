import { PlusOutlined, DeleteOutlined, SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useNavigate, useSearchParams } from '@umijs/max';
import { Button, Card, message, Form, Input, Select, InputNumber, Switch, Space, Table, Popconfirm, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useRef, useState, useEffect } from 'react';
import { fieldApi } from '@/services/formmode';
import type { FieldDefinitionFormData, FieldTypeInfo } from '@/services/formmode/typings';

const { Option } = Select;

/**
 * 批量新增字段页面
 * 参考泛微 modelAdd.jsp 中的 batchSetExcelField() 功能
 * 允许用户在一个界面中同时配置多个字段
 */
const FieldBatchAdd: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const formId = searchParams.get('formId');
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fieldTypes, setFieldTypes] = useState<FieldTypeInfo[]>([]);
  const [fieldList, setFieldList] = useState<FieldDefinitionFormData[]>([]);
  const [editingIndex, setEditingIndex] = useState<number>(-1);

  // 获取字段类型列表
  const fetchFieldTypes = async () => {
    try {
      const result = await fieldApi.getFieldTypes();
      setFieldTypes(result || []);
    } catch (error) {
      console.error('获取字段类型失败:', error);
    } finally {
      setFetchLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchFieldTypes();
  }, []);

  // 添加新的字段行
  const handleAddField = () => {
    setFieldList([
      ...fieldList,
      {
        fieldName: '',
        fieldLabel: '',
        fieldHtmlType: 1,
        fieldType: 1,
        fieldDbType: 'varchar',
        fieldLength: 255,
        isRequired: 0,
        isReadOnly: 0,
        isDisabled: 0,
        sort: fieldList.length,
        status: 1,
      },
    ]);
  };

  // 删除字段行
  const handleDeleteField = (index: number) => {
    const newList = [...fieldList];
    newList.splice(index, 1);
    setFieldList(newList);
  };

  // 更新字段行数据
  const handleFieldChange = (index: number, field: string, value: any) => {
    const newList = [...fieldList];
    (newList[index] as any)[field] = value;

    // 根据 fieldHtmlType 和 fieldType 自动设置 fieldDbType
    if (field === 'fieldHtmlType' || field === 'fieldType') {
      const htmlType = field === 'fieldHtmlType' ? value : newList[index].fieldHtmlType;
      const type = field === 'fieldType' ? value : newList[index].fieldType;
      (newList[index] as any).fieldDbType = getDbTypeByFieldType(htmlType, type);
    }

    setFieldList(newList);
  };

  // 根据字段类型确定数据库类型
  const getDbTypeByFieldType = (htmlType: number, type: number): string => {
    if (htmlType === 1) {
      return 'varchar';
    } else if (htmlType === 2) {
      return 'varchar';
    } else if (htmlType === 3) {
      return 'varchar';
    } else if (htmlType === 4) {
      return 'varchar';
    } else if (htmlType === 5) {
      if (type === 1) return 'date';
      if (type === 2) return 'datetime';
      return 'varchar';
    } else if (htmlType === 6) {
      return 'int';
    } else if (htmlType === 8) {
      return 'varchar';
    } else if (htmlType === 9) {
      return 'varchar';
    }
    return 'varchar';
  };

  // 批量保存
  const handleSave = async () => {
    if (!formId) {
      message.error('表单ID不能为空');
      return;
    }

    // 验证数据
    for (let i = 0; i < fieldList.length; i++) {
      const field = fieldList[i];
      if (!field.fieldName || !field.fieldLabel) {
        message.error(`第 ${i + 1} 个字段的名称和标签不能为空`);
        return;
      }
    }

    setLoading(true);
    try {
      // 批量创建字段
      for (const field of fieldList) {
        await fieldApi.create({
          ...field,
          formId: formId,
        });
      }

      message.success(`成功创建 ${fieldList.length} 个字段`);
      navigate(`/formmode/fieldmanage?formId=${formId}`);
    } catch (error) {
      console.error('批量创建失败:', error);
      message.error('批量创建失败');
    } finally {
      setLoading(false);
    }
  };

  // 表格列定义
  const columns: ColumnsType<FieldDefinitionFormData> = [
    {
      title: '序号',
      dataIndex: 'index',
      key: 'index',
      width: 80,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: '字段名称',
      dataIndex: 'fieldName',
      key: 'fieldName',
      width: 200,
      render: (_: any, record: FieldDefinitionFormData, index: number) => (
        <Input
          value={record.fieldName}
          onChange={(e) => handleFieldChange(index, 'fieldName', e.target.value)}
          placeholder="请输入字段名称"
          size="small"
        />
      ),
    },
    {
      title: '字段标签',
      dataIndex: 'fieldLabel',
      key: 'fieldLabel',
      width: 200,
      render: (_: any, record: FieldDefinitionFormData, index: number) => (
        <Input
          value={record.fieldLabel}
          onChange={(e) => handleFieldChange(index, 'fieldLabel', e.target.value)}
          placeholder="请输入字段标签"
          size="small"
        />
      ),
    },
    {
      title: '字段类型',
      dataIndex: 'fieldHtmlType',
      key: 'fieldHtmlType',
      width: 150,
      render: (_: any, record: FieldDefinitionFormData, index: number) => (
        <Select
          value={record.fieldHtmlType}
          onChange={(value) => handleFieldChange(index, 'fieldHtmlType', value)}
          size="small"
          style={{ width: '100%' }}
        >
          <Option value={1}>文本字段</Option>
          <Option value={2}>浏览按钮</Option>
          <Option value={3}>选择框</Option>
          <Option value={4}>附件上传</Option>
          <Option value={5}>特殊字段</Option>
          <Option value={6}>复选框</Option>
          <Option value={8}>下拉选择框</Option>
          <Option value={9}>树形选择</Option>
        </Select>
      ),
    },
    {
      title: '详细类型',
      dataIndex: 'fieldType',
      key: 'fieldType',
      width: 150,
      render: (_: any, record: FieldDefinitionFormData, index: number) => {
        // 根据 fieldHtmlType 动态生成选项
        let typeOptions: { value: number; label: string }[] = [];
        
        if (record.fieldHtmlType === 1) {
          typeOptions = [
            { value: 1, label: '单行文本' },
            { value: 2, label: '多行文本' },
            { value: 3, label: '保密字段' },
          ];
        } else if (record.fieldHtmlType === 2) {
          typeOptions = [
            { value: 1, label: '人力资源' },
            { value: 2, label: '部门' },
            { value: 3, label: '角色' },
          ];
        } else if (record.fieldHtmlType === 3) {
          typeOptions = [
            { value: 1, label: '单选框' },
            { value: 2, label: '多选框' },
            { value: 3, label: '下拉框' },
          ];
        }

        return (
          <Select
            value={record.fieldType}
            onChange={(value) => handleFieldChange(index, 'fieldType', value)}
            size="small"
            style={{ width: '100%' }}
          >
            {typeOptions.map(option => (
              <Option key={option.value} value={option.value}>{option.label}</Option>
            ))}
          </Select>
        );
      },
    },
    {
      title: '数据库类型',
      dataIndex: 'fieldDbType',
      key: 'fieldDbType',
      width: 120,
      render: (_: any, record: FieldDefinitionFormData) => (
        <Tag color="blue">{record.fieldDbType || 'varchar'}</Tag>
      ),
    },
    {
      title: '必填',
      dataIndex: 'isRequired',
      key: 'isRequired',
      width: 80,
      render: (_: any, record: FieldDefinitionFormData, index: number) => (
        <Switch
          checked={record.isRequired === 1}
          onChange={(checked) => handleFieldChange(index, 'isRequired', checked ? 1 : 0)}
          size="small"
        />
      ),
    },
    {
      title: '只读',
      dataIndex: 'isReadOnly',
      key: 'isReadOnly',
      width: 80,
      render: (_: any, record: FieldDefinitionFormData, index: number) => (
        <Switch
          checked={record.isReadOnly === 1}
          onChange={(checked) => handleFieldChange(index, 'isReadOnly', checked ? 1 : 0)}
          size="small"
        />
      ),
    },
    {
      title: '排序',
      dataIndex: 'sort',
      key: 'sort',
      width: 100,
      render: (_: any, record: FieldDefinitionFormData, index: number) => (
        <InputNumber
          value={record.sort}
          onChange={(value) => handleFieldChange(index, 'sort', value)}
          size="small"
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (__: any, _: any, index: number) => (
        <Popconfirm
          title="确认删除"
          description="确定要删除这个字段吗？"
          onConfirm={() => handleDeleteField(index)}
          okText="确认"
          cancelText="取消"
        >
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  // 如果没有 formId，显示错误提示
  if (!formId) {
    return (
      <PageContainer title="批量新增字段">
        <Card>
          <div style={{ textAlign: 'center', padding: '50px' }}>
            请先从表单管理页面进入
          </div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="批量新增字段"
      onBack={() => navigate(`/formmode/fieldmanage?formId=${formId}`)}
      extra={
        <Space>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={loading}
            onClick={handleSave}
          >
            保存全部
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={handleAddField}
          >
            添加字段
          </Button>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(`/formmode/fieldmanage?formId=${formId}`)}
          >
            返回列表
          </Button>
        </Space>
      }
    >
      <Card>
        {fetchLoading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>加载中...</div>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <Space>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleAddField}
                >
                  添加字段
                </Button>
                <span style={{ color: '#999' }}>
                  已添加 {fieldList.length} 个字段
                </span>
              </Space>
            </div>

            <Table
              rowKey={(_, index) => `field_${index}`}
              columns={columns}
              dataSource={fieldList}
              loading={loading}
              scroll={{ x: 1200 }}
              pagination={false}
              size="small"
            />
          </>
        )}
      </Card>
    </PageContainer>
  );
};

export default FieldBatchAdd;
