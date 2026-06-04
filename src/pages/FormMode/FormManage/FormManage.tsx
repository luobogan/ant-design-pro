import { PlusOutlined, ReloadOutlined, DeleteOutlined, EditOutlined, EyeOutlined, SettingOutlined, SearchOutlined, TableOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useNavigate } from '@umijs/max';
import { usePageButtons } from '@/hooks/usePageButtons';
import {
  Badge,
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  message,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Switch,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useEffect, useState } from 'react';
import { formApi } from '@/services/formmode';
import type { WorkflowBill, PageParams } from '@/services/formmode/typings';

const { Search } = Input;

/**
 * 表单管理列表页面
 */
const FormManageList: React.FC = () => {
  const navigate = useNavigate();
  const { buttons } = usePageButtons();

  const [searchForm] = Form.useForm();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [data, setData] = useState<FormDefinition[]>([]);
  const [loading, setLoading] = useState(false);
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
  const fetchData = async (params?: Partial<PageParams> & { formName?: string; status?: number }) => {
    setLoading(true);
    try {
      const values = searchForm.getFieldsValue();
      const queryParams = {
        current: params?.current || pagination.current,
        pageSize: params?.pageSize || pagination.pageSize,
        formName: values.formName || undefined,
        status: values.status !== undefined ? values.status : undefined,
      };

      const result = await formApi.getList(queryParams);
      // 后端返回的是 records，而不是 list
      setData(result.records || result.list || []);
      setPagination({
        current: result.current || 1,
        pageSize: result.size || result.pageSize || 20,
        total: result.total || 0,
      });
    } catch (error) {
      console.error('获取表单列表失败:', error);
      message.error('获取表单列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchData();
  }, []);

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
    navigate('/formmode/formmanage/aae?mode=add');
  };

  // 编辑 - 跳转到表设计器并回显数据
  const handleEdit = (record: FormDefinition) => {
    navigate(`/formmode/tabledesign?id=${record.id}`);
  };

  // 查看
  const handleView = (record: FormDefinition) => {
    navigate(`/formmode/formview/${record.id}`);
  };

  // Excel设计
  const handleExcelDesign = (record: FormDefinition) => {
    navigate(`/formmode/exceldesign/ExcelDesign?formId=${record.id}&formName=${encodeURIComponent(record.formName)}`);
  };

  // 删除
  const handleDelete = async (id: string) => {
    try {
      await formApi.delete(id);
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
      message.warning('请选择要删除的表单');
      return;
    }

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 个表单吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await formApi.batchDelete(selectedRowKeys as string[]);
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

  // 更新状态
  const handleStatusChange = async (record: FormDefinition, checked: boolean) => {
    try {
      await formApi.updateStatus(record.id, checked ? 1 : 0);
      message.success('状态更新成功');
      fetchData();
    } catch (error) {
      console.error('状态更新失败:', error);
      message.error('状态更新失败');
    }
  };

  // 表格列定义
  const columns: ColumnsType<FormDefinition> = [
    {
      title: '表单名称',
      dataIndex: 'formName',
      key: 'formName',
      width: 200,
      render: (text: string, record: FormDefinition) => (
        <a onClick={() => handleView(record)}>{text}</a>
      ),
    },
    {
      title: '数据库表名',
      dataIndex: 'tableName',
      key: 'tableName',
      width: 200,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 250,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: number, record: FormDefinition) => (
        <Switch
          checked={status === 1}
          checkedChildren="启用"
          unCheckedChildren="禁用"
          onChange={(checked) => handleStatusChange(record, checked)}
          disabled={!hasPermission('formmode_edit')}
        />
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 180,
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      fixed: 'right',
      render: (_: any, record: FormDefinition) => (
        <Space size="small">
          {hasPermission('formmanage_view') && (
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            >
              查看
            </Button>
          )}
          {hasPermission('formmanage_aae') && (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
          )}
          {hasPermission('exceldesign') && (
            <Button
              type="link"
              size="small"
              icon={<TableOutlined />}
              onClick={() => handleExcelDesign(record)}
            >
              Excel设计
            </Button>
          )}
          {hasPermission('formmanage_delete') && (
            <Popconfirm
              title="确认删除"
              description="确定要删除这个表单吗？"
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
      title="表单管理"
      extra={
        <Space>
          {hasPermission('formmanage_aae') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              新增
            </Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
            刷新
          </Button>
          {hasPermission('formmanage_delete') && selectedRowKeys.length > 0 && (
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
          <Form.Item name="formName" label="表单名称">
            <Input placeholder="请输入表单名称" allowClear />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              placeholder="请选择状态"
              allowClear
              style={{ width: 120 }}
              options={[
                { value: 1, label: '启用' },
                { value: 0, label: '禁用' },
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

export default FormManageList;
