import { PlusOutlined, ReloadOutlined, DeleteOutlined, EyeOutlined, EditOutlined, SearchOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useLocation, useNavigate, useParams, useSearchParams } from '@umijs/max';
import { usePageButtons } from '@/hooks/usePageButtons';
import {
  Button,
  Card,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useEffect, useState } from 'react';
import { formApi, dataApi, fieldDefinitionApi } from '@/services/formmode';
import { getUserRightTypes } from '@/services/formmode/rightApi';
import type {
  FieldDefinition,
  FormDataRecord,
  PageParams,
} from '@/services/formmode/typings';
import { PersonOrgValueText } from '@/components/FormMode/PersonOrgPicker';
import { resolveBrowserMeta } from '@/components/FormMode/personOrg';

const { Search } = Input;

/**
 * 表单数据列表页面
 */
const FormDataList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useParams<{ formId?: string }>();
  const location = useLocation();
  // 方案C：菜单 path=/formmode/formview/{formId} 是字面量路由，useParams 取不到；
  // 从 pathname 末段解析；同时兼容 :formId 动态路由与旧 query 形式。
  const pathFormId = /^\/formmode\/formview\/(\d+)$/.exec(location.pathname)?.[1];
  const formId = pathFormId || params?.formId || searchParams.get('formId');
  const { buttons } = usePageButtons();

  const [searchForm] = Form.useForm();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [data, setData] = useState<FormDataRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [formFields, setFormFields] = useState<FieldDefinition[]>([]);
  const [fieldConfigured, setFieldConfigured] = useState(false);
  const [formName, setFormName] = useState<string>('');
  // 建模权限码：1可见 2新建 3编辑 4删除 5详情；用于没有菜单按钮码时仍能控制操作
  const [userRightTypes, setUserRightTypes] = useState<number[]>([]);
  // 表单选择器（无 formId 时展示，供菜单入口直接进入）
  const [allForms, setAllForms] = useState<Array<{ id: string; formName: string; status?: number }>>([]);
  const [formsLoading, setFormsLoading] = useState(false);

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  // 按钮权限：菜单按钮码 OR 建模权限码（方案C菜单通常没有单独按钮码）
  const MODE_RIGHT_BY_BUTTON: Record<string, number> = {
    formmode_view: 1,
    formmode_detail: 5,
    formmode_add: 2,
    formmode_create: 2,
    formmode_edit: 3,
    formmode_update: 3,
    formmode_delete: 4,
    formmode_remove: 4,
  };
  const hasPermission = (code: string) => {
    // 字段配置未完成前，数据编辑界面不显示任何操作按钮
    if (!fieldConfigured) return false;
    if (buttons.some((btn: any) => btn.code === code)) return true;
    const rightType = MODE_RIGHT_BY_BUTTON[code];
    return rightType != null && userRightTypes.includes(rightType);
  };

  // 加载可选表单列表（无 formId 时由菜单入口展示选择器）
  useEffect(() => {
    if (formId) return;
    let alive = true;
    setFormsLoading(true);
    formApi.getAll()
      .then((list: any) => {
        if (!alive) return;
        const arr = Array.isArray(list) ? list : (Array.isArray(list?.data) ? list.data : []);
        setAllForms(arr.filter((f: any) => f && f.id && f.status !== 0));
      })
      .catch(() => { if (alive) setAllForms([]); })
      .finally(() => { if (alive) setFormsLoading(false); });
    return () => { alive = false; };
  }, [formId]);

  // 加载建模权限码（方案C菜单未必配置菜单按钮码）
  useEffect(() => {
    if (!formId) return;
    let alive = true;
    getUserRightTypes(formId)
      .then((types) => { if (alive) setUserRightTypes(Array.isArray(types) ? types : []); })
      .catch(() => { if (alive) setUserRightTypes([]); });
    return () => { alive = false; };
  }, [formId]);

  // 获取表单信息和字段定义
  const fetchFormInfo = async () => {
    if (!formId) return;

    try {
      // 获取表单详情
      const formDetail = await formApi.getById(formId);
      if (formDetail) {
        setFormName(formDetail.formName);
      }

      // 获取字段定义 + 配置完成状态（与后端写接口同一口径）
      const [fields, configured] = await Promise.all([
        dataApi.getFieldDefinitions(formId),
        fieldDefinitionApi.isConfigured(formId),
      ]);
      setFormFields(fields || []);
      setFieldConfigured(!!configured);
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
      // 后端 IPage 原生形态：records / total / size / current
      setData(result.records || result.list || []);
      setPagination({
        current: result.current || 1,
        pageSize: result.size || result.pageSize || 20,
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
    if (formId && fieldConfigured) {
      fetchData();
    }
  }, [formId, fieldConfigured]);

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

  // 查看：使用显示布局（layoutType=1），运行期由 AAE 页按当前用户命中组加载
  const handleView = (record: FormDataRecord) => {
    navigate(`/formmode/formview/aae?mode=view&id=${record.id}&formId=${formId}`);
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

    // 根据字段定义生成列（dataIndex 用 fieldDbName=DB 列名，与列表记录/保存/详情真键一致）
    formFields.forEach((field) => {
      columns.push({
        // 优先展示中文标签，fieldName 是数据库技术字段名
        title: field.fieldLabel || field.fieldName,
        dataIndex: field.fieldDbName || field.fieldName,
        key: field.fieldDbName || field.fieldName,
        width: 150,
        ellipsis: true,
        render: (text: any) => {
          if (text === null || text === undefined) return '-';
          // 浏览按钮字段：存 id 逗号串，列表展示名称
          if (field.fieldHtmlType === 2) {
            const meta = resolveBrowserMeta(field.fieldType, field.browType);
            return <PersonOrgValueText browserType={meta?.browserType} value={text} />;
          }
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

  // 没有 formId：显示表单选择器（供菜单入口直接进入，选中后带 formId 跳本页）
  if (!formId) {
    return (
      <PageContainer title="表单数据">
        <Card>
          <div style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center' }}>
            <div style={{ marginBottom: 16, color: '#666' }}>
              请选择要查看数据的表单
            </div>
            <Select
              showSearch
              style={{ width: '100%' }}
              placeholder="请选择表单"
              loading={formsLoading}
              optionFilterProp="label"
              options={allForms.map((f) => ({ value: f.id, label: f.formName }))}
              onChange={(id) => navigate(`/formmode/formview?formId=${id}`)}
              notFoundContent={formsLoading ? '加载中...' : '暂无可用表单'}
            />
            <div style={{ marginTop: 12, color: '#999', fontSize: 12 }}>
              仅显示已启用的表单；选中后进入该表单的数据列表
            </div>
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
