import {
  ArrowUpOutlined,
  DollarOutlined,
  ShoppingOutlined,
  TrendingUpOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-layout';
import {
  Card,
  Col,
  DatePicker,
  Row,
  Statistic,
  Tooltip,
  Typography,
} from 'antd';
import type { Dayjs } from 'dayjs';
import React, { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';

const { RangePicker } = DatePicker;
const { Title, Paragraph } = Typography;

const Analysis: React.FC = () => {
  const [_dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [visitData, setVisitData] = useState<any[]>([]);
  const [orderData, setOrderData] = useState<any[]>([]);
  const [userData, setUserData] = useState<any[]>([]);

  useEffect(() => {
    // 模拟数据
    const mockSalesData = [
      { date: '1月', sales: 12000, revenue: 150000 },
      { date: '2月', sales: 19000, revenue: 220000 },
      { date: '3月', sales: 15000, revenue: 180000 },
      { date: '4月', sales: 25000, revenue: 300000 },
      { date: '5月', sales: 22000, revenue: 280000 },
      { date: '6月', sales: 30000, revenue: 350000 },
    ];

    const mockVisitData = [
      { date: '1月', visits: 10000, bounceRate: 40 },
      { date: '2月', visits: 15000, bounceRate: 35 },
      { date: '3月', visits: 12000, bounceRate: 38 },
      { date: '4月', visits: 18000, bounceRate: 32 },
      { date: '5月', visits: 16000, bounceRate: 30 },
      { date: '6月', visits: 20000, bounceRate: 28 },
    ];

    const mockOrderData = [
      { status: '已完成', value: 65 },
      { status: '处理中', value: 20 },
      { status: '已取消', value: 10 },
      { status: '退款', value: 5 },
    ];

    const mockUserData = [
      { name: '新用户', value: 35 },
      { name: '老用户', value: 65 },
    ];

    setSalesData(mockSalesData);
    setVisitData(mockVisitData);
    setOrderData(mockOrderData);
    setUserData(mockUserData);
  }, []);

  const handleDateRangeChange = (dates: [Dayjs, Dayjs] | null) => {
    setDateRange(dates);
  };

  const totalSales = salesData.reduce((sum, item) => sum + item.sales, 0);
  const totalRevenue = salesData.reduce((sum, item) => sum + item.revenue, 0);
  const avgOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;
  const conversionRate = 3.5; // 模拟转化率

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <PageContainer
      title="数据分析"
      subTitle="销售、访问和用户数据的综合分析"
      extra={[
        <RangePicker
          key="date-range"
          onChange={handleDateRangeChange}
          style={{ marginRight: 16 }}
        />,
      ]}
    >
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总销售额"
              value={totalRevenue.toLocaleString()}
              precision={2}
              prefix={<DollarOutlined />}
              suffix="元"
              valueStyle={{ color: '#3f8600' }}
              extra={
                <Tooltip title="较上月增长">
                  <span>
                    <ArrowUpOutlined /> 12.5%
                  </span>
                </Tooltip>
              }
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="订单数量"
              value={totalSales}
              prefix={<ShoppingOutlined />}
              suffix="单"
              valueStyle={{ color: '#3f8600' }}
              extra={
                <Tooltip title="较上月增长">
                  <span>
                    <ArrowUpOutlined /> 8.2%
                  </span>
                </Tooltip>
              }
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均订单价值"
              value={avgOrderValue.toFixed(2)}
              precision={2}
              prefix={<DollarOutlined />}
              suffix="元"
              valueStyle={{ color: '#3f8600' }}
              extra={
                <Tooltip title="较上月增长">
                  <span>
                    <ArrowUpOutlined /> 4.1%
                  </span>
                </Tooltip>
              }
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="转化率"
              value={conversionRate}
              precision={1}
              prefix={<TrendingUpOutlined />}
              suffix="%"
              valueStyle={{ color: '#3f8600' }}
              extra={
                <Tooltip title="较上月增长">
                  <span>
                    <ArrowUpOutlined /> 0.5%
                  </span>
                </Tooltip>
              }
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title="销售趋势" bordered={false}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Legend />
                <RechartsTooltip />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="sales"
                  name="订单数量"
                  stroke="#8884d8"
                  activeDot={{ r: 8 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="revenue"
                  name="销售额"
                  stroke="#82ca9d"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="访问趋势" bordered={false}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={visitData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Legend />
                <RechartsTooltip />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="visits"
                  name="访问量"
                  stroke="#8884d8"
                  fill="#8884d8"
                  fillOpacity={0.3}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="bounceRate"
                  name="跳出率"
                  stroke="#82ca9d"
                  fill="#82ca9d"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card title="订单状态分布" bordered={false}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={orderData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {orderData.map((_entry, index) => (
                    <cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Legend />
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="用户类型分布" bordered={false}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={userData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {userData.map((_entry, index) => (
                    <cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Legend />
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
};

// 为了兼容 Recharts 的 cell 组件
const _cell: React.FC<any> = (_props) => {
  return null;
};

export default Analysis;
