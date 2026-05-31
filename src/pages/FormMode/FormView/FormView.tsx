import { PlusOutlined, ReloadOutlined, DeleteOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useNavigate, useSearchParams } from '@umijs/max';
import { usePageButtons } from '@/hooks/usePageButtons';
import {
  Button,
  Card,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useEffect, useState } from 'react';
import { formApi, dataApi } from '@/services/formmode';
import type {
  FieldDefinition,
  FormDataRecord,
  PageParams,
} from '@/services/formmode/typings';

const { Search } = Input;

/**
 * 表单数据列表页面
 */
const FormDataList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const formId = searchParams.get('formId');
  const { buttons } = usePageButtons();

  const [searchForm] = Form.useForm();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [data, setData] = useState<FormDataRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [formFields, setFormFields] = useState<FieldDefinition[]>([]);
  const [formName, setFormName] = useState<string>('');

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  // 获取按钮权限
  const hasPermission = (code: string) => {
    return buttons.some((btn: any) => btn.code === code);
  };

  // 获取表单信息和字段定义
  const fetchFormInfo = async () => {
    if (!formId) return;

    try {
      // 获取表单详情
      const formDetail = await formApi.getById(formId);
      if (formDetail) {
        setFormName(formDetail.formName);
      }

      // 获取字段定义
      const fields = await dataApi.getFieldDefinitions(formId);
      setFormFields(fields || []);
    } catch (error) {
      console.error('获取表单信息失败:', error);
      message.error('获取表单信息失败');
    }
  };

  // 获取表单数据列表
  const fetchData = async (
    params?: Partial<PageParams> & Record<string, any>,
  ) => {
    if (!formId) return;

    setLoading(true);
    try {
      const values = searchForm.getFieldsValue();
      const queryParams = {
        current: params?.current || pagination.current,
        pageSize: params?.pageSize || pagination.pageSize,
        ...values,
      };

      const result = await dataApi.getList(formId, queryParams);
      setData(result.list || []);
      setPagination({
        current: result.current || 1,
        pageSize: result.pageSize || 20,
        total: result.total || 0,
      });
    } catch (error) {
      console.error('获取表单数据失败:', error);
      message.error('获取表单数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    if (formId) {
      fetchFormInfo();
    }
  }, [formId]);

  // 表单信息和字段定义加载完成后获取数据
  useEffect(() => {
    if (formId && formFields.length > 0) {
      fetchData();
    }
  }, [formId, formFields]);

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
    if (!formId) {
      message.warning('请先选择表单');
      return;
    }
    navigate(`/formmode/formview/aae?mode=add&formId=${formId}`);
  };

  // 编辑
  const handleEdit = (record: FormDataRecord) => {
    navigate(`/formmode/formview/aae?mode=edit&id=${record.id}&formId=${formId}`);
  };

  // 查看
  const handleView = (record: FormDataRecord) => {
    navigate(`/formmode/dataview/${record.id}?formId=${formId}`);
  };

  // 删除
  const handleDelete = async (id: string) => {
    if (!formId) return;

    try {
      await dataApi.delete(formId, id);
      message.success('删除成功');
      fetchData();
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (!formId) return;

    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的数据');
      return;
    }

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 条数据吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await dataApi.batchDelete(formId, selectedRowKeys as string[]);
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

  // 动态生成表格列
  const generateColumns = (): ColumnsType<FormDataRecord> => {
    const columns: ColumnsType<FormDataRecord> = [
      {
        title: 'ID',
        dataIndex: 'id',
        key: 'id',
        width: 80,
      },
    ];

    // 根据字段定义生成列
    formFields.forEach((field) => {
      columns.push({
        title: field.fieldLabel,
        dataIndex: field.fieldName,
        key: field.fieldName,
        width: 150,
        ellipsis: true,
        render: (text: any) => {
          if (text === null || text === undefined) return '-';
          return String(text);
        },
      });
    });

    // 操作列
    columns.push({
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_: any, record: FormDataRecord) => (
        <Space size="small">
          {hasPermission('formmode_view') && (
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            >
              查看
            </Button>
          )}
          {hasPermission('formmode_edit') && (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
          )}
          {hasPermission('formmode_delete') && (
            <Popconfirm
              title="确认删除"
              description="确定要删除这条数据吗？"
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
    });

    return columns;
  };

  // 如果没有 formId，显示错误提示
  if (!formId) {
    return (
      <PageContainer title="表单数据">
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
      title={`表单数据 - ${formName || '加载中...'}`}
      onBack={() => navigate('/formmode/formmanage')}
      extra={
        <Space>
          {hasPermission('formmode_add') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              新增
            </Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
            刷新
          </Button>
          {hasPermission('formmode_delete') && selectedRowKeys.length > 0 && (
            <Button danger icon={<DeleteOutlined />} onClick={handleBatchDelete}>
              批量删除
            </Button>
          )}
        </Space>
      }
    >
      {/* 搜索表单 */}
      <Card style={{ marginBottom: 16 }}>
        <Form form={searchForm} layout="inline">
          <Form.Item name="keyword" label="关键词">
            <Input placeholder="请输入关键词" allowClear />
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
          columns={generateColumns()}
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

export default FormDataList;
