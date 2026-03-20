import {
  CheckOutlined,
  CloseOutlined,
  DeleteFilled,
  DeleteOutlined,
  EditOutlined,
  FilterOutlined,
  FireOutlined,
  GiftOutlined,
  HistoryOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShoppingOutlined,
  StarOutlined,
  UndoOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useNavigate } from '@umijs/max';
import { usePageButtons } from '@/hooks/usePageButtons';
import {
  Badge,
  Button,
  Card,
  Col,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  Modal,
  message,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  TreeSelect,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useEffect, useState } from 'react';
import { getBrandList } from '@/services/mall/brand';
import { getCategoryTree } from '@/services/mall/category';
import {
  adjustSkuStock,
  batchDeleteProducts,
  batchUpdateStatus,
  deleteProduct,
  deleteSku,
  getProductList,
  getProductSkus,
  getProductStats,
  getRecycleList,
  getSkuStockLogs,
  publishProduct,
  restoreProduct,
  setHot,
  setNew,
  setRecommend,
  unpublishProduct,
} from '@/services/mall/product';
import type {
  Brand,
  Category,
  Product,
  ProductSku,
  SkuStockLog,
} from '@/services/mall/typings';
import {
  formatDateTime,
  formatMoney,
  getProductStatusText,
} from '@/utils/mall/format';

const { Option } = Select;

/**
 * 商品管理页面
 */
const ProductList: React.FC = () => {
  const navigate = useNavigate();
  const { buttons } = usePageButtons();
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  const [searchForm] = Form.useForm();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [stats, setStats] = useState<any>(null);

  // 编辑相关状态
  const [_editModalVisible, setEditModalVisible] = useState(false);
  const [_currentProduct, setCurrentProduct] = useState<Product | null>(null);

  // 回收站相关状态
  const [recycleModalVisible, setRecycleModalVisible] = useState(false);
  const [recycleData, setRecycleData] = useState<Product[]>([]);

  // SKU 管理相关状态
  const [skuDrawerVisible, setSkuDrawerVisible] = useState(false);
  const [currentProductForSku, setCurrentProductForSku] =
    useState<Product | null>(null);
  const [skuData, setSkuData] = useState<ProductSku[]>([]);

  // 库存日志相关状态
  const [stockLogModalVisible, setStockLogModalVisible] = useState(false);
  const [currentSkuForLog, setCurrentSkuForLog] = useState<ProductSku | null>(
    null,
  );
  const [stockLogs, setStockLogs] = useState<SkuStockLog[]>([]);

  const [data, setData] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  // 获取分类和品牌
  const fetchCategoriesAndBrands = async () => {
    try {
      const [categoryRes, brandRes] = await Promise.all([
        getCategoryTree(),
        getBrandList({ current: 1, pageSize: 100 }),
      ]);
      setCategories(categoryRes?.data || []);
      setBrands(
        Array.isArray(brandRes?.data)
          ? brandRes.data
          : brandRes?.data?.list || [],
      );
    } catch (error) {
      console.error('获取分类和品牌失败:', error);
    }
  };

  // 获取统计数据
  const fetchProductStats = async () => {
    try {
      const statsData = await getProductStats();
      setStats(statsData?.data || null);
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  };

  // 获取商品列表
  const fetchData = async (page = 1, pageSize = 20, filters: any = {}) => {
    setLoading(true);
    try {
      const params = {
        current: page,
        size: pageSize, // 后端使用的是 size 而不是 pageSize
        ...filters,
      };

      const result = await getProductList(params);

      if (result && result.success && result.data) {
        setData(result.data.list || []);
        setPagination({
          current: result.data.current || page,
          pageSize: result.data.pageSize || pageSize,
          total: result.data.total || 0,
        });
      }
    } catch (error: any) {
      message.error(error.message || '获取商品列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (values: any) => {
    const filters = {
      keyword: values.keyword,
      categoryId: values.categoryId,
      brandId: values.brandId,
      status: values.status,
      isNew: values.isNew,
      isHot: values.isHot,
      isRecommend: values.isRecommend,
    };
    fetchData(1, pagination.pageSize, filters);
  };

  const handleReset = () => {
    searchForm.resetFields();
    fetchData(1, pagination.pageSize);
  };

  useEffect(() => {
    fetchCategoriesAndBrands();
    fetchProductStats();
    fetchData();
  }, []);

  const handleTableChange = (pag: any) => {
    fetchData(pag.current, pag.pageSize);
  };

  const handleAdd = () => {
    navigate('/mall/products/add');
  };

  const handleEdit = async (product: Product) => {
    setCurrentProduct(product);
    setEditModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteProduct(id);
      message.success('删除成功');
      fetchData(pagination.current, pagination.pageSize);
      fetchProductStats();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的商品');
      return;
    }

    try {
      await batchDeleteProducts(selectedRowKeys.map(Number));
      message.success('批量删除成功');
      setSelectedRowKeys([]);
      fetchData(pagination.current, pagination.pageSize);
      fetchProductStats();
    } catch (error: any) {
      message.error(error.message || '批量删除失败');
    }
  };

  const handleBatchStatus = async (status: 'active' | 'inactive') => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择商品');
      return;
    }

    try {
      await batchUpdateStatus(selectedRowKeys.map(Number), status);
      message.success('批量更新状态成功');
      setSelectedRowKeys([]);
      fetchData(pagination.current, pagination.pageSize);
      fetchProductStats();
    } catch (error: any) {
      message.error(error.message || '批量更新状态失败');
    }
  };

  const handlePublish = async (id: number) => {
    try {
      await publishProduct(id);
      message.success('商品上架成功');
      fetchData(pagination.current, pagination.pageSize);
      fetchProductStats();
    } catch (error: any) {
      message.error(error.message || '上架失败');
    }
  };

  const handleUnpublish = async (id: number) => {
    try {
      await unpublishProduct(id);
      message.success('商品下架成功');
      fetchData(pagination.current, pagination.pageSize);
      fetchProductStats();
    } catch (error: any) {
      message.error(error.message || '下架失败');
    }
  };

  const handleToggleRecommend = async (id: number, currentValue: boolean) => {
    try {
      await setRecommend(id, !currentValue);
      message.success(`商品${!currentValue ? '设为推荐' : '取消推荐'}成功`);
      fetchData(pagination.current, pagination.pageSize);
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  const handleToggleNew = async (id: number, currentValue: boolean) => {
    try {
      await setNew(id, !currentValue);
      message.success(`商品${!currentValue ? '设为新品' : '取消新品'}成功`);
      fetchData(pagination.current, pagination.pageSize);
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  const handleToggleHot = async (id: number, currentValue: boolean) => {
    try {
      await setHot(id, !currentValue);
      message.success(`商品${!currentValue ? '设为热销' : '取消热销'}成功`);
      fetchData(pagination.current, pagination.pageSize);
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  // 回收站相关
  const fetchRecycleData = async () => {
    try {
      const result = await getRecycleList();
      setRecycleData(result?.data || []);
    } catch (error: any) {
      message.error(error.message || '获取回收站数据失败');
    }
  };

  const handleOpenRecycle = () => {
    setRecycleModalVisible(true);
    fetchRecycleData();
  };

  const handleRestoreProduct = async (id: number) => {
    try {
      await restoreProduct(id);
      message.success('商品恢复成功');
      fetchRecycleData();
      fetchData();
      fetchProductStats();
    } catch (error: any) {
      message.error(error.message || '恢复失败');
    }
  };

  // SKU 管理相关
  const fetchSkuData = async (productId: number) => {
    try {
      const result = await getProductSkus(productId);
      setSkuData(result?.data || []);
    } catch (error: any) {
      message.error(error.message || '获取 SKU 数据失败');
    }
  };

  const handleOpenSkuManager = (product: Product) => {
    setCurrentProductForSku(product);
    setSkuDrawerVisible(true);
    fetchSkuData(product.id);
  };

  const handleDeleteSku = async (skuId: number) => {
    try {
      await deleteSku(skuId);
      message.success('SKU 删除成功');
      if (currentProductForSku) {
        fetchSkuData(currentProductForSku.id);
      }
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  // 库存日志相关
  const fetchStockLogs = async (skuId: number) => {
    try {
      const result = await getSkuStockLogs(skuId);
      setStockLogs(result?.data || []);
    } catch (error: any) {
      message.error(error.message || '获取库存日志失败');
    }
  };

  const handleOpenStockLog = (sku: ProductSku) => {
    setCurrentSkuForLog(sku);
    setStockLogModalVisible(true);
    fetchStockLogs(sku.id);
  };

  const _handleAdjustStock = async (
    skuId: number,
    quantity: number,
    type: number,
    remark: string,
  ) => {
    try {
      await adjustSkuStock(skuId, quantity, type, remark);
      message.success('库存调整成功');
      fetchStockLogs(skuId);
      if (currentProductForSku) {
        fetchSkuData(currentProductForSku.id);
      }
    } catch (error: any) {
      message.error(error.message || '调整失败');
    }
  };

  const batchActionsMenu = [
    {
      key: 'publish',
      label: '批量上架',
      icon: <CheckOutlined />,
      onClick: () => handleBatchStatus('active'),
    },
    {
      key: 'unpublish',
      label: '批量下架',
      icon: <CloseOutlined />,
      onClick: () => handleBatchStatus('inactive'),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'delete',
      label: '批量删除',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: handleBatchDelete,
    },
  ];

  const getMoreActionsMenu = (record: Product) => [
    {
      key: 'publish',
      label: record.status === 'active' ? '下架' : '上架',
      icon: record.status === 'active' ? <CloseOutlined /> : <CheckOutlined />,
      onClick: () =>
        record.status === 'active'
          ? handleUnpublish(record.id)
          : handlePublish(record.id),
    },
    {
      key: 'recommend',
      label: record.isRecommend ? '取消推荐' : '设为推荐',
      icon: <StarOutlined />,
      onClick: () => handleToggleRecommend(record.id, !!record.isRecommend),
    },
    {
      key: 'new',
      label: record.isNew ? '取消新品' : '设为新品',
      icon: <GiftOutlined />,
      onClick: () => handleToggleNew(record.id, record.isNew),
    },
    {
      key: 'hot',
      label: record.isHot ? '取消热销' : '设为热销',
      icon: <FireOutlined />,
      onClick: () => handleToggleHot(record.id, !!record.isHot),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'sku',
      label: 'SKU 管理',
      icon: <ShoppingOutlined />,
      onClick: () => handleOpenSkuManager(record),
    },
  ];

  const columns: ColumnsType<Product> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      fixed: 'left',
    },
    {
      title: '商品信息',
      key: 'productInfo',
      width: 280,
      fixed: 'left',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src={record.image}
            alt={record.name}
            style={{
              width: 64,
              height: 64,
              objectFit: 'cover',
              borderRadius: 4,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 500,
                color: '#111827',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {record.name}
            </div>
            <div style={{ fontSize: 14, color: '#6b7280' }}>
              {record.categoryName || '未分类'}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '价格',
      key: 'price',
      width: 120,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#ef4444' }}>
            {formatMoney(record.price)}
          </div>
          {record.originalPrice && (
            <div
              style={{
                fontSize: 12,
                color: '#9ca3af',
                textDecoration: 'line-through',
              }}
            >
              {formatMoney(record.originalPrice)}
            </div>
          )}
        </div>
      ),
    },
    {
      title: '库存',
      dataIndex: 'totalSkuStock',
      width: 100,
      render: (stock: number) => (
        <span style={stock <= 10 ? { color: '#f97316', fontWeight: 500 } : {}}>
          {stock?.toLocaleString() || 0}
        </span>
      ),
    },
    {
      title: '销量',
      dataIndex: 'sales',
      width: 100,
      render: (sales: number) => sales?.toLocaleString() || 0,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => (
        <Badge
          status={status === 'active' ? 'success' : 'default'}
          text={getProductStatusText(status)}
        />
      ),
    },
    {
      title: '标签',
      key: 'tags',
      width: 150,
      render: (_, record) => (
        <Space size="small" wrap>
          {record.isNew && <Tag color="red">新品</Tag>}
          {record.isHot && <Tag color="orange">热销</Tag>}
          {record.isRecommend && <Tag color="blue">推荐</Tag>}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      width: 180,
      render: (time: string) => formatDateTime(time),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_: unknown, record: Product) => (
        <Space size="small">
          {buttons.some(btn => btn.code === 'product_edit') && (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
          )}

          <Dropdown
            menu={{ items: getMoreActionsMenu(record) }}
            placement="bottomRight"
          >
            <Button type="link" size="small" icon={<MoreOutlined />} />
          </Dropdown>

          {buttons.some(btn => btn.code === 'product_delete') && (
            <Popconfirm
              title="确认删除"
              description="确定要删除该商品吗？"
              onConfirm={() => handleDelete(record.id)}
              okText="确认"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
  };

  return (
    <PageContainer>
      <Card title="商品统计" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={8} md={6}>
            <Statistic
              title="商品总数"
              value={stats?.totalProducts || 0}
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <Statistic
              title="上架商品"
              value={stats?.activeProducts || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckOutlined />}
            />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <Statistic
              title="推荐商品"
              value={stats?.recommendProducts || 0}
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <Statistic
              title="库存预警"
              value={stats?.lowStockProducts || 0}
              valueStyle={{ color: '#faad14' }}
              prefix={<WarningOutlined />}
            />
          </Col>
        </Row>
      </Card>

      <Card
        title={
          <Space>
            <FilterOutlined />
            商品筛选
          </Space>
        }
        style={{ marginBottom: 16 }}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={() => searchForm.submit()}
            >
              搜索
            </Button>
          </Space>
        }
      >
        <Form
          form={searchForm}
          layout="inline"
          onFinish={handleSearch}
          style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}
        >
          <Form.Item name="keyword" label="关键词">
            <Input placeholder="商品名称/描述" style={{ width: 200 }} />
          </Form.Item>

          <Form.Item name="categoryId" label="分类">
            <TreeSelect
              placeholder="请选择分类"
              style={{ width: 180 }}
              allowClear
              treeData={categories}
            />
          </Form.Item>

          <Form.Item name="brandId" label="品牌">
            <Select placeholder="请选择品牌" style={{ width: 150 }} allowClear>
              {brands.map((brand) => (
                <Option key={brand.id} value={brand.id}>
                  {brand.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="status" label="状态">
            <Select placeholder="状态" style={{ width: 120 }} allowClear>
              <Option value={1}>上架</Option>
              <Option value={0}>下架</Option>
            </Select>
          </Form.Item>
        </Form>
      </Card>

      <Card
        title="商品管理"
        extra={
          <Space>
            {buttons.some(btn => btn.code === 'product_recycle') && (
              <Button icon={<DeleteFilled />} onClick={handleOpenRecycle}>
                回收站
              </Button>
            )}
            {selectedRowKeys.length > 0 && (
              <Dropdown
                menu={{ items: batchActionsMenu }}
                placement="bottomRight"
              >
                <Button icon={<SettingOutlined />}>
                  批量操作 ({selectedRowKeys.length})
                </Button>
              </Dropdown>
            )}
            {buttons.some(btn => btn.code === 'product_add') && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                新增商品
              </Button>
            )}
          </Space>
        }
      >
        <Table
          rowKey="id"
          rowSelection={rowSelection}
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
          onChange={(pag) => handleTableChange(pag)}
          scroll={{ x: 1600 }}
          locale={{
            emptyText: <Empty description="暂无商品数据" />,
          }}
        />
      </Card>

      {/* 回收站弹窗 */}
      <Modal
        title="回收站"
        open={recycleModalVisible}
        onCancel={() => setRecycleModalVisible(false)}
        width={1000}
        footer={null}
      >
        <Table
          rowKey="id"
          columns={[
            {
              title: 'ID',
              dataIndex: 'id',
              width: 80,
            },
            {
              title: '商品信息',
              key: 'productInfo',
              render: (_, record) => (
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                >
                  <img
                    src={record.image}
                    alt={record.name}
                    style={{
                      width: 48,
                      height: 48,
                      objectFit: 'cover',
                      borderRadius: 4,
                    }}
                  />
                  <div style={{ fontWeight: 500 }}>{record.name}</div>
                </div>
              ),
            },
            {
              title: '价格',
              dataIndex: 'price',
              render: (price: number) => formatMoney(price),
            },
            {
              title: '删除时间',
              dataIndex: 'updateTime',
              render: (time: string) => formatDateTime(time),
            },
            {
              title: '操作',
              key: 'action',
              render: (_, record) => (
                <Button
                  type="primary"
                  icon={<UndoOutlined />}
                  onClick={() => handleRestoreProduct(record.id)}
                >
                  恢复
                </Button>
              ),
            },
          ]}
          dataSource={recycleData}
          loading={false}
          pagination={false}
          locale={{
            emptyText: <Empty description="回收站暂无商品" />,
          }}
        />
      </Modal>

      {/* SKU 管理抽屉 */}
      <Drawer
        title={`SKU 管理 - ${currentProductForSku?.name}`}
        placement="right"
        width={1000}
        open={skuDrawerVisible}
        onClose={() => setSkuDrawerVisible(false)}
      >
        <Table
          rowKey="id"
          columns={[
            {
              title: 'SKU 名称',
              dataIndex: 'skuName',
              width: 180,
            },
            {
              title: 'SKU 编码',
              dataIndex: 'skuCode',
              width: 160,
            },
            {
              title: '规格',
              render: (_, record) => (
                <span style={{ wordBreak: 'break-all' }}>
                  {[record.spec1, record.spec2, record.spec3, record.spec4]
                    .filter(Boolean)
                    .join('/')}
                </span>
              ),
              width: 200,
            },
            {
              title: '销售价格',
              dataIndex: 'price',
              render: (price: number) => formatMoney(price),
              width: 100,
            },
            {
              title: '库存',
              dataIndex: 'stock',
              width: 80,
            },
            {
              title: '操作',
              key: 'action',
              width: 150,
              render: (_, record) => (
                <Space size="small">
                  <Button
                    type="link"
                    size="small"
                    icon={<HistoryOutlined />}
                    onClick={() => handleOpenStockLog(record)}
                  >
                    日志
                  </Button>
                  <Popconfirm
                    title="确认删除"
                    onConfirm={() => handleDeleteSku(record.id)}
                  >
                    <Button type="link" size="small" danger>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
          dataSource={skuData}
          loading={false}
          pagination={{ pageSize: 10 }}
          size="middle"
          scroll={{ y: 400 }}
          locale={{
            emptyText: <Empty description="暂无 SKU 数据" />,
          }}
        />
      </Drawer>

      {/* 库存日志弹窗 */}
      <Modal
        title={`库存日志 - ${currentSkuForLog?.skuName}`}
        open={stockLogModalVisible}
        onCancel={() => setStockLogModalVisible(false)}
        width={900}
        footer={null}
      >
        <Table
          rowKey="id"
          columns={[
            {
              title: '类型',
              dataIndex: 'typeText',
              render: (text: string, record: SkuStockLog) => (
                <Tag
                  color={
                    record.type === 1
                      ? 'success'
                      : record.type === 2
                        ? 'error'
                        : 'warning'
                  }
                >
                  {text}
                </Tag>
              ),
            },
            {
              title: '数量',
              dataIndex: 'quantity',
              render: (quantity: number) => (
                <span style={{ color: quantity > 0 ? '#52c41a' : '#ff4d4f' }}>
                  {quantity > 0 ? '+' : ''}
                  {quantity}
                </span>
              ),
            },
            {
              title: '变动前',
              dataIndex: 'beforeStock',
            },
            {
              title: '变动后',
              dataIndex: 'afterStock',
            },
            {
              title: '备注',
              dataIndex: 'remark',
              ellipsis: true,
            },
            {
              title: '时间',
              dataIndex: 'createdAt',
              render: (time: string) => formatDateTime(time),
            },
          ]}
          dataSource={stockLogs}
          loading={false}
          pagination={false}
          size="small"
          scroll={{ y: 300 }}
          locale={{
            emptyText: <Empty description="暂无库存变动记录" />,
          }}
        />
      </Modal>
    </PageContainer>
  );
};

export default ProductList;
