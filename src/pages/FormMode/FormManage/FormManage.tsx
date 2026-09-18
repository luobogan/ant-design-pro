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

  // 删除：先校验流程绑定，再二次确认（删除会级联清理关联数据）
  const handleDelete = async (record: FormDefinition) => {
    let check: any;
    try {
      check = await formApi.deleteCheck(record.id);
    } catch (error) {
      console.error('删除前检查失败:', error);
      return;
    }

    // 流程服务不可用：无法确认绑定关系，给出「强制删除」选项（用户已确认无绑定时使用）
    if (check?.checkFailed) {
      Modal.confirm({
        title: '无法校验流程绑定关系',
        okText: '强制删除',
        okButtonProps: { danger: true },
        cancelText: '取消',
        width: 560,
        content: (
          <div>
            <p>{check.message || check.failReason || '审批流程服务不可用，无法校验表单绑定关系。'}</p>
            <p>若已确认该表单未被任何流程使用，可强制删除（跳过绑定校验）；否则请稍后启动流程服务再试。</p>
          </div>
        ),
        onOk: async () => {
          try {
            await formApi.delete(record.id, true);
            message.success('删除成功');
            fetchData();
          } catch (error) {
            console.error('强制删除失败:', error);
          }
        },
      });
      return;
    }

    // 已被流程设计绑定 / 已产生流程实例：提示被哪个流程占用
    if (check?.bound) {
      Modal.error({
        title: '该表单已被流程绑定，无法删除',
        width: 560,
        content: (
          <div>
            <p style={{ marginBottom: 8 }}>{check.message}</p>
            {(check.definitionNames?.length ?? 0) > 0 && (
              <div>
                <div>绑定的流程：</div>
                <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                  {check.definitionNames.map((item: string) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {check.instanceCount > 0 && (
              <div style={{ marginTop: 4 }}>流程实例：{check.instanceCount} 个</div>
            )}
          </div>
        ),
      });
      return;
    }

    Modal.confirm({
      title: '确认删除',
      okText: '确认删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      width: 520,
      content: (
        <div>
          <p>删除后不可恢复，将同时清理以下关联数据：</p>
          <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
            <li>字段定义 {check?.fieldCount ?? 0} 个</li>
            {check?.layoutCount > 0 && <li>表单布局 {check.layoutCount} 个</li>}
            {(check?.extendCount ?? 0) + (check?.optionCount ?? 0) > 0 && (
              <li>字段扩展/选项 {(check?.extendCount ?? 0) + (check?.optionCount ?? 0)} 条</li>
            )}
            {check?.tableExists && (
              <li>
                数据表 {check.tableName}（含 {check.dataCount} 条数据）
              </li>
            )}
          </ul>
        </div>
      ),
      onOk: async () => {
        try {
          await formApi.delete(record.id);
          message.success('删除成功');
          fetchData();
        } catch (error) {
          console.error('删除失败:', error);
        }
      },
    });
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的表单');
      return;
    }

    Modal.confirm({
      title: '确认删除',
      okText: '确认删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      width: 520,
      content: `确定要删除选中的 ${selectedRowKeys.length} 个表单吗？删除将同时清理字段定义、布局配置与动态数据表，且不可恢复。`,
      onOk: async () => {
        try {
          const result = await formApi.batchDelete(selectedRowKeys as string[]);
          const deleted = result?.deleted ?? 0;
          const blocked = result?.blocked ?? [];
          if (deleted > 0) {
            message.success(`已删除 ${deleted} 个表单`);
          }
          if (blocked.length > 0) {
            Modal.warning({
              title: `${blocked.length} 个表单已被流程绑定，未删除`,
              width: 560,
              content: (
                <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                  {blocked.map((item: any) => (
                    <li key={item.id}>
                      {item.formName || item.id}：{item.reason}
                    </li>
                  ))}
                </ul>
              ),
            });
          }
          setSelectedRowKeys([]);
          fetchData();
        } catch (error) {
          console.error('批量删除失败:', error);
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
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            >
              删除
            </Button>
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
