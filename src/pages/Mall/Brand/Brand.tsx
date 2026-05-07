import React, { useEffect, useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import {
  Table,
  Space,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  Select,
  message,
  Card,
  Popconfirm,
  Layout,
  Tree,
  Spin,
  Tag,
} from 'antd';
const { Sider, Content } = Layout;
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, ApartmentOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd';
import { brandApi } from '@/services/mall/brand';
import { usePageButtons } from '@/hooks/usePageButtons';
import type { Brand, BrandFormData } from '@/services/mall/typings';
import ImageUploader from '@/components/ImageUploader';
import { list as tenantListApi } from '@/services/system/tenant';

const { Option } = Select;

/**
 * 品牌管理页面
 */
const BrandList: React.FC = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [currentBrand, setCurrentBrand] = useState<Brand | null>(null);
  const [form] = Form.useForm();
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [data, setData] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const { buttons } = usePageButtons('brand');

  // 租户相关状态
  const [tenantTreeData, setTenantTreeData] = useState<any[]>([]);
  const [tenantList, setTenantList] = useState<any[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('000000');
  const [tenantLoading, setTenantLoading] = useState(false);
  // 表单中选择的租户ID（用于图片上传）
  const [formTenantId, setFormTenantId] = useState<string>('000000');

  const fetchData = async (page: number = 1, pageSize: number = 10, tenantId?: string) => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (tenantId) {
        params.tenantId = tenantId;
      }
      const response = await brandApi.getList(params);
      setData(response.list || []);
      setPagination({
        current: response.current || 1,
        pageSize: response.pageSize || 10,
        total: response.total || 0,
      });
    } catch (error) {
      message.error('获取品牌列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchTenants = async () => {
    setTenantLoading(true);
    try {
      const result = await tenantListApi({ current: 1, size: 1000 });
      const tenants = result.data?.records || result.records || [];
      setTenantList(tenants);
      const treeData = tenants.map((tenant: any) => ({
        key: tenant.tenantId,
        title: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ApartmentOutlined />
            <span>{tenant.tenantName}</span>
            <Tag color="blue" style={{ marginLeft: 4, fontSize: 12 }}>
              {tenant.tenantId}
            </Tag>
          </div>
        ),
        isLeaf: true,
      }));
      setTenantTreeData([
        {
          key: 'all',
          title: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ApartmentOutlined />
              <span>全部租户</span>
            </div>
          ),
          children: treeData,
        },
      ]);
    } catch (error: any) {
      message.error(error.message || '获取租户列表失败');
    } finally {
      setTenantLoading(false);
    }
  };

  const handleTenantSelect = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length === 0) return;
    const tenantId = selectedKeys[0] as string;
    setSelectedTenantId(tenantId);
    fetchData(1, pagination.pageSize, tenantId === 'all' ? undefined : tenantId);
  };

  useEffect(() => {
    fetchTenants();
    fetchData(1, 10, '000000');
  }, []);

  const columns: ColumnsType<Brand> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
    },
    {
      title: '品牌名称',
      dataIndex: 'name',
      width: 150,
    },
    {
      title: '品牌LOGO',
      dataIndex: 'logo',
      width: 100,
      render: (logo: string) =>
        logo ? (
          <img
            src={logo}
            alt="品牌LOGO"
            style={{ width: 50, height: 50, objectFit: 'contain' }}
          />
        ) : (
          <span style={{ color: '#999' }}>暂无图片</span>
        ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
    },
    {
      title: '排序',
      dataIndex: 'sort',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (status: number) => (
        <span style={{ color: status === 1 ? '#52c41a' : '#ff4d4f' }}>
          {status === 1 ? '启用' : '禁用'}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_: unknown, record: Brand) => (
        <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
          {buttons.some((btn: any) => btn.code === 'brand_delete') && (
            <Popconfirm
              title="确认删除"
              description="确定要删除该品牌吗？"
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

  const handleAdd = () => {
    setCurrentBrand(null);
    setLogoUrl('');
    form.resetFields();
    const userInfo = JSON.parse(localStorage.getItem('sword-user-info') || '{}');
    const currentTenantId = userInfo?.tenantId || '000000';
    setFormTenantId(currentTenantId);
    form.setFieldsValue({
      status: 1,
      sort: 0,
      tenantId: currentTenantId,
    });
    setModalVisible(true);
  };

  const handleEdit = (brand: Brand) => {
    setCurrentBrand(brand);
    setLogoUrl(brand.logo || '');
    setFormTenantId(brand.tenantId || '000000');
    form.setFieldsValue({
      name: brand.name,
      description: brand.description,
      logo: brand.logo,
      status: brand.status,
      sort: brand.sort,
      tenantId: brand.tenantId,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await brandApi.delete(id);
      message.success('删除成功');
      fetchData(pagination.current, pagination.pageSize, selectedTenantId === 'all' ? undefined : selectedTenantId);
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      console.log('Form values:', values);
      const formData: BrandFormData = values;
      console.log('Form data:', formData);

      if (currentBrand) {
        await brandApi.update(currentBrand.id, formData);
        message.success('更新成功');
      } else {
        await brandApi.create(formData);
        message.success('创建成功');
      }

      setModalVisible(false);
      fetchData(pagination.current, pagination.pageSize, selectedTenantId === 'all' ? undefined : selectedTenantId);
    } catch (error) {
      console.error('Submit error:', error);
      message.error('操作失败');
    }
  };

  return (
    <PageContainer>
      <Layout style={{ background: '#f0f2f5' }}>
        <Sider
          width={280}
          style={{ background: '#fff', marginRight: 16, padding: 16 }}
        >
          <div style={{ marginBottom: 16, fontWeight: 600, fontSize: 16 }}>
            <ApartmentOutlined style={{ marginRight: 8 }} />
            租户列表
          </div>
          <Spin spinning={tenantLoading}>
            <Tree
              treeData={tenantTreeData}
              defaultExpandAll
              blockNode
              onSelect={handleTenantSelect}
              selectedKeys={[selectedTenantId]}
              style={{ background: '#fff' }}
            />
          </Spin>
        </Sider>
        <Content>
          <Card
            title="品牌管理"
            extra={
              <Space>
                <Button icon={<ReloadOutlined />} onClick={() => fetchData(pagination.current, pagination.pageSize, selectedTenantId === 'all' ? undefined : selectedTenantId)}>
                  刷新
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                  新增品牌
                </Button>
              </Space>
            }
          >
            <Table
              rowKey="id"
              columns={columns}
              dataSource={data}
              loading={loading}
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条`,
                onChange: (page, pageSize) => {
                  fetchData(page, pageSize, selectedTenantId === 'all' ? undefined : selectedTenantId);
                },
              }}
              scroll={{ x: 1200 }}
            />
          </Card>
        </Content>
      </Layout>

      <Modal
        title={currentBrand ? '编辑品牌' : '新增品牌'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
        okText="确认"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="品牌名称"
            name="name"
            rules={[{ required: true, message: '请输入品牌名称' }]}
          >
            <Input placeholder="请输入品牌名称" />
          </Form.Item>

          {(() => {
            const userInfo = JSON.parse(localStorage.getItem('sword-user-info') || '{}');
            const currentTenantId = userInfo?.tenantId || '000000';
            if (currentTenantId === '000000') {
              return (
                <Form.Item
                  label="所属租户"
                  name="tenantId"
                  rules={[{ required: true, message: '请选择所属租户' }]}
                >
                  <Select
                    placeholder="请选择所属租户"
                    disabled={!!currentBrand}
                    onChange={(value) => {
                      setFormTenantId(value || '000000');
                    }}
                  >
                    {tenantList.map((tenant: any) => (
                      <Option key={tenant.tenantId} value={tenant.tenantId}>
                        {tenant.tenantName} ({tenant.tenantId})
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              );
            }
            return null;
          })()}

          <Form.Item label="品牌LOGO" name="logo">
            <ImageUploader
              name="logo"
              value={logoUrl}
              onChange={(value) => {
                setLogoUrl(value);
                form.setFieldsValue({ logo: value });
              }}
              maxCount={1}
              accept=".jpg,.jpeg,.png"
              maxSize={10}
              uploadUrl="/api/blade-mall/admin/upload/image"
              supportDrag={true}
              showPreview={true}
              showProgress={true}
              height={120}
              useLocalUpload={false}
              returnBase64={false}
              uploadParams={{ type: 'brand' }}
              tenantId={formTenantId}
            />
          </Form.Item>

          <Form.Item label="描述" name="description">
            <Input.TextArea rows={4} placeholder="请输入品牌描述" />
          </Form.Item>

          <Form.Item
            label="排序"
            name="sort"
            rules={[{ required: true, message: '请输入排序' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入排序" />
          </Form.Item>

          <Form.Item
            label="状态"
            name="status"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select>
              <Select.Option value={1}>启用</Select.Option>
              <Select.Option value={0}>禁用</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default BrandList;
