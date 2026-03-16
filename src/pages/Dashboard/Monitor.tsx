import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CpuOutlined,
  DatabaseOutlined,
  ServerOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-layout';
import {
  Alert,
  Card,
  Col,
  Progress,
  Row,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import React, { useEffect, useState } from 'react';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const { Title, Paragraph } = Typography;
const { Column } = Table;

const Monitor: React.FC = () => {
  const [serverStatus, setServerStatus] = useState<any[]>([]);
  const [cpuData, setCpuData] = useState<any[]>([]);
  const [memoryData, setMemoryData] = useState<any[]>([]);
  const [diskData, setDiskData] = useState<any[]>([]);
  const [networkData, setNetworkData] = useState<any[]>([]);

  useEffect(() => {
    // 模拟服务器状态数据
    const mockServerStatus = [
      {
        name: 'Web服务器1',
        status: 'online',
        cpu: 45,
        memory: 68,
        disk: 32,
        ip: '192.168.1.100',
      },
      {
        name: 'Web服务器2',
        status: 'online',
        cpu: 65,
        memory: 75,
        disk: 45,
        ip: '192.168.1.101',
      },
      {
        name: '应用服务器',
        status: 'online',
        cpu: 35,
        memory: 58,
        disk: 28,
        ip: '192.168.1.102',
      },
      {
        name: '数据库服务器',
        status: 'warning',
        cpu: 85,
        memory: 90,
        disk: 78,
        ip: '192.168.1.103',
      },
      {
        name: '缓存服务器',
        status: 'online',
        cpu: 25,
        memory: 45,
        disk: 15,
        ip: '192.168.1.104',
      },
    ];

    // 模拟性能数据
    const generatePerformanceData = (count: number, max: number) => {
      return Array.from({ length: count }, (_, i) => ({
        time: `${i}:00`,
        value: Math.floor(Math.random() * max) + 10,
      }));
    };

    setServerStatus(mockServerStatus);
    setCpuData(generatePerformanceData(24, 90));
    setMemoryData(generatePerformanceData(24, 80));
    setDiskData(generatePerformanceData(24, 70));
    setNetworkData(generatePerformanceData(24, 100));
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'green';
      case 'warning':
        return 'orange';
      case 'offline':
        return 'red';
      default:
        return 'blue';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'warning':
        return <WarningOutlined style={{ color: '#faad14' }} />;
      case 'offline':
        return <CloseCircleOutlined style={{ color: '#f5222d' }} />;
      default:
        return <ServerOutlined />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online':
        return '在线';
      case 'warning':
        return '警告';
      case 'offline':
        return '离线';
      default:
        return '未知';
    }
  };

  return (
    <PageContainer title="系统监控" subTitle="服务器状态和性能监控">
      <Alert
        message="监控概览"
        description="当前系统共有5台服务器，其中4台在线，1台警告状态。数据库服务器CPU和内存使用率较高，建议及时处理。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="在线服务器"
              value={4}
              prefix={<ServerOutlined />}
              suffix="台"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="警告服务器"
              value={1}
              prefix={<WarningOutlined />}
              suffix="台"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均CPU使用率"
              value={51}
              prefix={<CpuOutlined />}
              suffix="%"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均内存使用率"
              value={69}
              prefix={<DatabaseOutlined />}
              suffix="%"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title="CPU使用率趋势" bordered={false}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={cpuData}>
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#8884d8"
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="内存使用率趋势" bordered={false}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={memoryData}>
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#82ca9d"
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title="磁盘使用率趋势" bordered={false}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={diskData}>
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#ffc658"
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="网络流量趋势" bordered={false}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={networkData}>
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#ff8042"
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Card title="服务器状态列表" bordered={false}>
        <Table dataSource={serverStatus} rowKey="ip">
          <Column title="服务器名称" dataIndex="name" key="name" />
          <Column title="IP地址" dataIndex="ip" key="ip" />
          <Column
            title="状态"
            dataIndex="status"
            key="status"
            render={(status) => (
              <Tag color={getStatusColor(status)}>
                {getStatusIcon(status)} {getStatusText(status)}
              </Tag>
            )}
          />
          <Column
            title="CPU使用率"
            dataIndex="cpu"
            key="cpu"
            render={(cpu) => (
              <div>
                <Progress percent={cpu} size="small" />
                <span style={{ marginLeft: 8 }}>{cpu}%</span>
              </div>
            )}
          />
          <Column
            title="内存使用率"
            dataIndex="memory"
            key="memory"
            render={(memory) => (
              <div>
                <Progress percent={memory} size="small" />
                <span style={{ marginLeft: 8 }}>{memory}%</span>
              </div>
            )}
          />
          <Column
            title="磁盘使用率"
            dataIndex="disk"
            key="disk"
            render={(disk) => (
              <div>
                <Progress percent={disk} size="small" />
                <span style={{ marginLeft: 8 }}>{disk}%</span>
              </div>
            )}
          />
        </Table>
      </Card>
    </PageContainer>
  );
};

export default Monitor;
