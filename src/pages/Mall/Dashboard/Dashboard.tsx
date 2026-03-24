import { PageContainer } from '@ant-design/pro-components';
import { Card } from 'antd';
import React from 'react';
import {
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

/**
 * 商城仪表盘页面
 */
const MallDashboard: React.FC = () => {
  const salesData = [
    { date: '1 月', sales: 12000, revenue: 150000 },
    { date: '2 月', sales: 19000, revenue: 220000 },
    { date: '3 月', sales: 15000, revenue: 180000 },
    { date: '4 月', sales: 25000, revenue: 300000 },
    { date: '5 月', sales: 22000, revenue: 280000 },
    { date: '6 月', sales: 30000, revenue: 350000 },
  ];

  const orderData = [
    { status: '已完成', value: 65 },
    { status: '处理中', value: 20 },
    { status: '已取消', value: 10 },
    { status: '退款', value: 5 },
  ];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <PageContainer title="商城仪表盘" subTitle="销售、订单和商品数据的综合分析">
      <Card title="销售趋势" style={{ marginBottom: 16 }}>
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

      <Card title="订单状态分布">
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
    </PageContainer>
  );
};

// 为了兼容 Recharts 的 cell 组件
const _cell: React.FC<any> = (_props) => {
  return null;
};

export default MallDashboard;
