import React, { useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import {
  Table,
  Card,
  Space,
  Button,
  Drawer,
  Descriptions,
  Tag,
  Select,
  Input,
  message,
} from 'antd';
import { EyeOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getOrderList, getOrderById, updateOrderStatus } from '@/services/mall/order';
import type { Order } from '@/services/mall/typings';
import { formatMoney, formatDateTime, getOrderStatusText, getOrderStatusColor } from '@/utils/mall/format';

const { Option } = Select;
const { Search } = Input;

/**
 * 订单管理页面
 */
const OrderList: React.FC = () => {
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [filters, setFilters] = useState<Record<string, any>>({});

  const [data, setData] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // 获取订单列表
  const fetchData = async (page = 1, pageSize = 10, searchFilters: any = {}) => {
    setLoading(true);
    try {
      const params = {
        current: page,
        pageSize,
        ...searchFilters,
      };
      
      const result = await getOrderList(params);
      
      if (result) {
        setData(result.list || []);
        setPagination({
          current: result.current || page,
          pageSize: result.pageSize || pageSize,
          total: result.total || 0,
        });
      }
    } catch (error: any) {
      message.error(error.message || '获取订单列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (keyword: string) => {
    setFilters({ ...filters, keyword });
    fetchData(1, pagination.pageSize, { ...filters, keyword });
  };

  const handleStatusChange = (status: string) => {
    setFilters({ ...filters, status });
    fetchData(1, pagination.pageSize, { ...filters, status });
  };

  const handleTableChange = (pag: any) => {
    fetchData(pag.current, pag.pageSize, filters);
  };

  // 查看订单详情
  const handleViewDetail = async (order: Order) => {
    try {
      const detail = await getOrderById(order.id);
      setCurrentOrder(detail);
      setDetailVisible(true);
    } catch (error: any) {
      message.error('获取订单详情失败');
    }
  };

  // 更新订单状态
  const handleUpdateStatus = async (status: string) => {
    if (!currentOrder) return;

    try {
      await updateOrderStatus(currentOrder.id, status);
      message.success('状态更新成功');
      fetchData(pagination.current, pagination.pageSize, filters);

      const updatedOrder = await getOrderById(currentOrder.id);
      setCurrentOrder(updatedOrder);
    } catch (error: any) {
      message.error('状态更新失败');
    }
  };

  const columns: ColumnsType<Order> = [
    {
      title: '订单号',
      dataIndex: 'orderNo',
      width: 180,
      fixed: 'left',
    },
    {
      title: '用户',
      dataIndex: 'username',
      width: 120,
    },
    {
      title: '邮箱',
      dataIndex: 'userEmail',
      width: 200,
      ellipsis: true,
    },
    {
      title: '订单金额',
      dataIndex: 'total',
      width: 120,
      render: (total: number) => formatMoney(total),
    },
    {
      title: '支付方式',
      dataIndex: 'paymentMethod',
      width: 100,
      render: (method: string) => method || '-',
    },
    {
      title: '物流单号',
      dataIndex: 'trackingNo',
      width: 150,
      ellipsis: true,
      render: (no: string) => no || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={getOrderStatusColor(status)}>{getOrderStatusText(status)}</Tag>
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
      width: 150,
      fixed: 'right',
      render: (_: unknown, record: Order) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            查看
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer>
      <Card
        title="订单管理"
        extra={
          <Space>
            <Select
              placeholder="订单状态"
              style={{ width: 120 }}
              allowClear
              onChange={handleStatusChange}
            >
              <Option value="pending">待付款</Option>
              <Option value="paid">已付款</Option>
              <Option value="shipped">已发货</Option>
              <Option value="delivered">已完成</Option>
              <Option value="cancelled">已取消</Option>
            </Select>
            <Search
              placeholder="搜索订单号/用户名"
              allowClear
              enterButton
              style={{ width: 200 }}
              onSearch={handleSearch}
            />
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
          }}
          onChange={(pag) => handleTableChange(pag)}
          scroll={{ x: 1500 }}
        />
      </Card>

      {/* 订单详情抽屉 */}
      <Drawer
        title="订单详情"
        placement="right"
        width={800}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
      >
        {currentOrder && (
          <div>
            <Card title="订单信息" style={{ marginBottom: 16 }}>
              <Descriptions column={2} bordered>
                <Descriptions.Item label="订单号">{currentOrder.orderNo}</Descriptions.Item>
                <Descriptions.Item label="订单状态">
                  <Tag color={getOrderStatusColor(currentOrder.status)}>
                    {getOrderStatusText(currentOrder.status)}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="用户">{currentOrder.username}</Descriptions.Item>
                <Descriptions.Item label="邮箱">{currentOrder.userEmail}</Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {formatDateTime(currentOrder.createTime)}
                </Descriptions.Item>
                <Descriptions.Item label="支付时间">
                  {currentOrder.paymentTime ? formatDateTime(currentOrder.paymentTime) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="发货时间">
                  {currentOrder.shippingTime ? formatDateTime(currentOrder.shippingTime) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="备注">{currentOrder.remark || '-'}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="金额信息" style={{ marginBottom: 16 }}>
              <Descriptions column={2} bordered>
                <Descriptions.Item label="商品小计">
                  {formatMoney(currentOrder.subtotal)}
                </Descriptions.Item>
                <Descriptions.Item label="折扣">{formatMoney(currentOrder.discount)}</Descriptions.Item>
                <Descriptions.Item label="运费">{formatMoney(currentOrder.shipping)}</Descriptions.Item>
                <Descriptions.Item label="订单总额">
                  <span style={{ fontSize: 18, color: '#ff4d4f', fontWeight: 'bold' }}>
                    {formatMoney(currentOrder.total)}
                  </span>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="收货地址" style={{ marginBottom: 16 }}>
              {currentOrder.address ? (
                <Descriptions column={1} bordered>
                  <Descriptions.Item label="收货人">{currentOrder.address.name}</Descriptions.Item>
                  <Descriptions.Item label="联系电话">{currentOrder.address.phone}</Descriptions.Item>
                  <Descriptions.Item label="收货地址">
                    {currentOrder.address.province} {currentOrder.address.city}{' '}
                    {currentOrder.address.district} {currentOrder.address.detail}
                  </Descriptions.Item>
                  <Descriptions.Item label="邮编">{currentOrder.address.postalCode}</Descriptions.Item>
                </Descriptions>
              ) : (
                <span>无收货地址信息</span>
              )}
            </Card>

            <Card title="商品信息" style={{ marginBottom: 16 }}>
              <Table
                rowKey="id"
                columns={[
                  {
                    title: '商品',
                    dataIndex: 'productName',
                    render: (name: string, record: any) => (
                      <Space>
                        <img src={record.productImage} alt="" style={{ width: 50, height: 50 }} />
                        {name}
                      </Space>
                    ),
                  },
                  {
                    title: '单价',
                    dataIndex: 'price',
                    render: (price: number) => formatMoney(price),
                  },
                  {
                    title: '数量',
                    dataIndex: 'quantity',
                  },
                  {
                    title: '小计',
                    render: (_: unknown, record: any) => formatMoney(record.price * record.quantity),
                  },
                ]}
                dataSource={currentOrder.items}
                pagination={false}
                size="small"
              />
            </Card>

            <Card title="订单操作">
              <Space>
                {currentOrder.status === 'paid' && (
                  <Button type="primary" onClick={() => handleUpdateStatus('shipped')}>
                    标记为已发货
                  </Button>
                )}
                {currentOrder.status === 'shipped' && (
                  <Button type="primary" onClick={() => handleUpdateStatus('delivered')}>
                    标记为已完成
                  </Button>
                )}
                {currentOrder.status === 'pending' && (
                  <Button danger onClick={() => handleUpdateStatus('cancelled')}>
                    取消订单
                  </Button>
                )}
              </Space>
            </Card>
          </div>
        )}
      </Drawer>
    </PageContainer>
  );
};

export default OrderList;
