import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  SettingOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useNavigate, useSearchParams } from '@umijs/max';
import { usePageButtons } from '@/hooks/usePageButtons';
import {
  Button,
  Card,
  Form,
  Input,
  message,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useEffect, useState } from 'react';
import { formApi, fieldApi } from '@/services/formmode';
import type {
  FieldDefinition,
  WorkflowBill,
  PageParams,
} from '@/services/formmode/typings';

const { Search } = Input;

/**
 * 字段管理列表页面
 */
const FieldManageList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlFormId = searchParams.get('formId');
  const { buttons } = usePageButtons();

  const [searchForm] = Form.useForm();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [data, setData] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [formList, setFormList] = useState<FormDefinition[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>(urlFormId || '');

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  // 获取按钮权限
  const hasPermission = (code: string) => {
    return buttons.some((btn: any) => btn.code === code);
  };

  // 获取表单列表
  const fetchFormList = async () => {
    try {
      const result = await formApi.getAll();
      setFormList(result || []);

      // 如果 URL 中有 formId，优先选择该表单
      if (urlFormId && result && result.length > 0) {
        const targetForm = result.find((form: FormDefinition) => form.id === urlFormId);
        if (targetForm) {
          setSelectedFormId(urlFormId);
          return;
        }
      }

      // 如果没有选中表单，默认选择第一个
      if (result && result.length > 0 && !selectedFormId) {
        setSelectedFormId(result[0].id);
      }
    } catch (error) {
      console.error('获取表单列表失败:', error);
    }
  };

  // 获取字段列表
  const fetchData = async (
    params?: Partial<PageParams> & { fieldLabel?: string; fieldHtmlType?: number },
  ) => {
    if (!selectedFormId) return;

    setLoading(true);
    try {
      const values = searchForm.getFieldsValue();
      const queryParams = {
        current: params?.current || pagination.current,
        pageSize: params?.pageSize || pagination.pageSize,
        formId: selectedFormId,
        fieldLabel: values.fieldLabel || undefined,
        fieldHtmlType: values.fieldHtmlType || undefined,
      };

      const result = await fieldApi.getList(queryParams);
      setData(result.list || []);
      setPagination({
        current: result.current || 1,
        pageSize: result.pageSize || 20,
        total: result.total || 0,
      });
    } catch (error) {
      console.error('获取字段列表失败:', error);
      message.error('获取字段列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchFormList();
  }, []);

  // 表单选择变化时重新加载字段
  useEffect(() => {
    if (selectedFormId) {
      fetchData({ current: 1 });
    }
  }, [selectedFormId]);

  // 搜索
  const handleSearch = () => {
    fetchData({ current: 1 });
  };

  // 重置搜索
  const handleReset = () => {
    searchForm.resetFields();
    fetchData({ current: 1 });
  };

  // 刷新
  const handleRefresh = () => {
    fetchData();
  };

  // 新增
  const handleAdd = () => {
    if (!selectedFormId) {
      message.warning('请先选择表单');
      return;
    }
    navigate(`/formmode/fieldmanage/aae?mode=add&formId=${selectedFormId}`);
  };

  // 编辑
  const handleEdit = (record: FieldDefinition) => {
    navigate(`/formmode/fieldmanage/aae?mode=edit&id=${record.id}&formId=${record.formId}`);
  };

  // 查看
  const handleView = (record: FieldDefinition) => {
    navigate(`/formmode/fieldmanage/view/${record.id}?formId=${record.formId}`);
  };

  // 删除
  const handleDelete = async (id: string) => {
    try {
      await fieldApi.delete(id);
      message.success('删除成功');
      fetchData();
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的字段');
      return;
    }

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 个字段吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await fieldApi.batchDelete(selectedRowKeys as string[]);
          message.success('批量删除成功');
          setSelectedRowKeys([]);
          fetchData();
        } catch (error) {
          console.error('批量删除失败:', error);
          message.error('批量删除失败');
        }
      },
    });
  };

  // 获取字段类型文本
  const getFieldTypeText = (htmlType: number, type: number) => {
    const typeMap: Record<string, string> = {
      '1-1': '单行文本',
      '1-2': '多行文本',
      '1-3': '保密字段',
      '2-1': '人力资源浏览框',
      '2-2': '部门浏览框',
      '2-3': '角色浏览框',
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

  // 表格列定义
  const columns: ColumnsType<FieldDefinition> = [
    {
      title: '字段标签',
      dataIndex: 'fieldLabel',
      key: 'fieldLabel',
      width: 150,
      render: (text: string, record: FieldDefinition) => (
        <a onClick={() => handleView(record)}>{text}</a>
      ),
    },
    {
      title: '字段名称',
      dataIndex: 'fieldName',
      key: 'fieldName',
      width: 150,
    },
    {
      title: '字段类型',
      key: 'fieldType',
      width: 150,
      render: (_: any, record: FieldDefinition) =>
        getFieldTypeText(record.fieldHtmlType, record.fieldType),
    },
    {
      title: '数据库类型',
      dataIndex: 'fieldDbType',
      key: 'fieldDbType',
      width: 120,
    },
    {
      title: '是否必填',
      dataIndex: 'isRequired',
      key: 'isRequired',
      width: 100,
      render: (isRequired: number) => (
        <Tag color={isRequired === 1 ? 'red' : 'default'}>
          {isRequired === 1 ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '排序',
      dataIndex: 'sort',
      key: 'sort',
      width: 80,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_: any, record: FieldDefinition) => (
        <Space size="small">
          {hasPermission('fieldmanage_view') && (
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            >
              查看
            </Button>
          )}
          {hasPermission('fieldmanage_aae') && (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
          )}
          {hasPermission('fieldmanage_delete') && (
            <Popconfirm
              title="确认删除"
              description="确定要删除这个字段吗？"
              onConfirm={() => handleDelete(record.id)}
              okText="确认"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <PageContainer
      title="字段管理"
      extra={
        <Space>
          {hasPermission('fieldmanage_add') && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
              disabled={!selectedFormId}
            >
              新增
            </Button>
          )}
          {hasPermission('fieldmanage_batchadd') && (
            <Button
              icon={<PlusOutlined />}
              onClick={() => navigate(`/formmode/fieldmanage/batchadd?formId=${selectedFormId}`)}
              disabled={!selectedFormId}
            >
              批量新增
            </Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
            刷新
          </Button>
          {hasPermission('fieldmanage_delete') && selectedRowKeys.length > 0 && (
            <Button danger icon={<DeleteOutlined />} onClick={handleBatchDelete}>
              批量删除
            </Button>
          )}
        </Space>
      }
    >
      {/* 表单选择 */}
      <Card style={{ marginBottom: 16 }}>
        <Form layout="inline">
          <Form.Item label="选择表单">
            <Select
              value={selectedFormId}
              onChange={setSelectedFormId}
              placeholder="请选择表单"
              style={{ width: 300 }}
              options={formList.map((form) => ({
                value: form.id,
                label: form.formName,
              }))}
            />
          </Form.Item>
        </Form>
      </Card>

      {/* 搜索表单 */}
      <Card style={{ marginBottom: 16 }}>
        <Form form={searchForm} layout="inline">
          <Form.Item name="fieldLabel" label="字段标签">
            <Input placeholder="请输入字段标签" allowClear />
          </Form.Item>
          <Form.Item name="fieldHtmlType" label="字段类型">
            <Select
              placeholder="请选择字段类型"
              allowClear
              style={{ width: 150 }}
              options={[
                { value: 1, label: '文本字段' },
                { value: 2, label: '浏览按钮' },
                { value: 3, label: '选择框' },
                { value: 4, label: '附件上传' },
                { value: 5, label: '特殊字段' },
                { value: 6, label: '复选框' },
              ]}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                搜索
              </Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* 数据表格 */}
      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: 1200 }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => {
              fetchData({ current: page, pageSize });
            },
          }}
        />
      </Card>
    </PageContainer>
  );
};

export default FieldManageList;
