import {
  EditOutlined,
  EyeOutlined,
  GiftOutlined,
  HistoryOutlined,
  RiseOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import {
  Button,
  Card,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  List,
  Modal,
  message,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useEffect, useState } from 'react';
import {
  adjustGrowth,
  adjustPoints,
  getGrowthLog,
  getMemberList,
  getPointsLog,
  updateMemberLevel,
  updateMemberStatus,
} from '@/services/mall/member';
import { getMemberLevelList } from '@/services/mall/memberLevel';
import type {
  GrowthLog,
  Member,
  MemberLevel,
  PointsLog,
} from '@/services/mall/typings';
import {
  formatDateTime,
  getMemberLevelColor,
  getMemberStatusColor,
  getMemberStatusText,
} from '@/utils/mall/format';

const { Search } = Input;
const { Option } = Select;
const { Text } = Typography;

/**
 * 会员管理页面
 */
const MemberList: React.FC = () => {
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [levelModalVisible, setLevelModalVisible] = useState(false);
  const [pointsModalVisible, setPointsModalVisible] = useState(false);
  const [growthModalVisible, setGrowthModalVisible] = useState(false);
  const [logDrawerVisible, setLogDrawerVisible] = useState(false);
  const [logType, setLogType] = useState<'points' | 'growth'>('points');
  const [logs, setLogs] = useState<PointsLog[] | GrowthLog[]>([]);
  const [memberLevels, setMemberLevels] = useState<MemberLevel[]>([]);
  const [form] = Form.useForm();

  const [data, setData] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // 加载会员等级
  useEffect(() => {
    const loadLevels = async () => {
      try {
        const res = await getMemberLevelList();
        setMemberLevels(res || []);
      } catch (error: any) {
        console.error('加载会员等级失败:', error);
      }
    };
    loadLevels();
  }, []);

  // 获取会员列表
  const fetchData = async (page = 1, pageSize = 10, filters: any = {}) => {
    setLoading(true);
    try {
      const params = {
        current: page,
        size: pageSize, // 后端使用的是 size 而不是 pageSize
        ...filters,
      };

      const result = await getMemberList(params);

      if (result) {
        setData(result.list || []);
        setPagination({
          current: result.current || page,
          pageSize: result.pageSize || pageSize,
          total: result.total || 0,
        });
      }
    } catch (error: any) {
      message.error(error.message || '获取会员列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (keyword: string) => {
    fetchData(1, pagination.pageSize, { keyword });
  };

  const handleTableChange = (pag: any) => {
    fetchData(pag.current, pag.pageSize);
  };

  // 获取会员等级名称
  const getLevelName = (levelId: number) => {
    const level = memberLevels.find((l) => l.id === levelId);
    return level?.name || '-';
  };

  // 查看详情
  const handleViewDetail = async (record: Member) => {
    setCurrentMember(record);
    setDetailVisible(true);
  };

  // 编辑等级
  const handleEditLevel = (record: Member) => {
    setCurrentMember(record);
    form.setFieldsValue({ levelId: record.levelId });
    setLevelModalVisible(true);
  };

  // 调整积分
  const handleAdjustPoints = (record: Member) => {
    setCurrentMember(record);
    form.resetFields();
    setPointsModalVisible(true);
  };

  // 调整成长值
  const handleAdjustGrowth = (record: Member) => {
    setCurrentMember(record);
    form.resetFields();
    setGrowthModalVisible(true);
  };

  // 查看日志
  const handleViewLogs = async (record: Member, type: 'points' | 'growth') => {
    setCurrentMember(record);
    setLogType(type);
    setLogDrawerVisible(true);

    try {
      if (type === 'points') {
        const res = await getPointsLog(record.userId, {
          current: 1,
          pageSize: 50,
        });
        setLogs(res || []);
      } else {
        const res = await getGrowthLog(record.userId, {
          current: 1,
          pageSize: 50,
        });
        setLogs(res || []);
      }
    } catch (error: any) {
      message.error(`加载日志失败：${error.message}`);
    }
  };

  // 提交等级修改
  const handleLevelSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!currentMember) return;

      await updateMemberLevel(currentMember.userId, {
        levelId: values.levelId,
      });
      message.success('会员等级更新成功');
      setLevelModalVisible(false);
      fetchData(pagination.current, pagination.pageSize);
    } catch (error: any) {
      message.error(`更新失败：${error.message}`);
    }
  };

  // 提交积分调整
  const handlePointsSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!currentMember) return;

      await adjustPoints(
        currentMember.userId,
        values.points,
        values.type,
        values.remark,
      );
      message.success('积分调整成功');
      setPointsModalVisible(false);
      fetchData(pagination.current, pagination.pageSize);
    } catch (error: any) {
      message.error(`调整失败：${error.message}`);
    }
  };

  // 提交成长值调整
  const handleGrowthSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!currentMember) return;

      await adjustGrowth(
        currentMember.userId,
        values.growth,
        values.type,
        values.remark,
      );
      message.success('成长值调整成功');
      setGrowthModalVisible(false);
      fetchData(pagination.current, pagination.pageSize);
    } catch (error: any) {
      message.error(`调整失败：${error.message}`);
    }
  };

  // 更新会员状态
  const _handleUpdateStatus = async (record: Member, status: number) => {
    try {
      await updateMemberStatus(record.userId, status);
      message.success(status === 1 ? '启用成功' : '禁用成功');
      fetchData(pagination.current, pagination.pageSize);
    } catch (error: any) {
      message.error(`操作失败：${error.message}`);
    }
  };

  const columns: ColumnsType<Member> = [
    {
      title: '用户 ID',
      dataIndex: 'userId',
      width: 100,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      width: 150,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      width: 200,
      ellipsis: true,
    },
    {
      title: '会员等级',
      dataIndex: 'levelId',
      width: 120,
      render: (levelId: number, record: Member) => (
        <Tag color={getMemberLevelColor(record.levelValue || 1)}>
          {getLevelName(levelId)}
        </Tag>
      ),
    },
    {
      title: '积分',
      dataIndex: 'points',
      width: 100,
      sorter: true,
    },
    {
      title: '成长值',
      dataIndex: 'growth',
      width: 100,
      sorter: true,
    },
    {
      title: '累计消费',
      dataIndex: 'totalConsumption',
      width: 120,
      render: (amount: number) => `¥${amount?.toFixed(2) || '0.00'}`,
      sorter: true,
    },
    {
      title: '订单数',
      dataIndex: 'orderCount',
      width: 100,
      sorter: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: number) => (
        <Tag color={getMemberStatusColor(status)}>
          {getMemberStatusText(status)}
        </Tag>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'registerTime',
      width: 180,
      render: (time: string) => formatDateTime(time),
      sorter: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditLevel(record)}
          >
            等级
          </Button>
          <Button
            type="link"
            icon={<GiftOutlined />}
            onClick={() => handleAdjustPoints(record)}
          >
            积分
          </Button>
          <Button
            type="link"
            icon={<RiseOutlined />}
            onClick={() => handleAdjustGrowth(record)}
          >
            成长值
          </Button>
          <Button
            type="link"
            icon={<HistoryOutlined />}
            onClick={() => handleViewLogs(record, 'points')}
          >
            日志
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer>
      <Card title="会员管理" bordered={false}>
        <Space style={{ marginBottom: 16 }}>
          <Search
            placeholder="搜索用户名、邮箱"
            allowClear
            onSearch={handleSearch}
            style={{ width: 300 }}
            prefix={<SearchOutlined />}
          />
        </Space>

        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
          rowKey="userId"
          scroll={{ x: 1600 }}
        />
      </Card>

      {/* 会员详情弹窗 */}
      <Modal
        title="会员详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={800}
      >
        {currentMember && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="用户 ID">
              {currentMember.userId}
            </Descriptions.Item>
            <Descriptions.Item label="用户名">
              {currentMember.username}
            </Descriptions.Item>
            <Descriptions.Item label="邮箱">
              {currentMember.email}
            </Descriptions.Item>
            <Descriptions.Item label="手机号">
              {currentMember.phone || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="昵称">
              {currentMember.nickname || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="会员等级">
              <Tag color={getMemberLevelColor(currentMember.levelValue || 1)}>
                {getLevelName(currentMember.levelId)}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="积分">
              {currentMember.points}
            </Descriptions.Item>
            <Descriptions.Item label="成长值">
              {currentMember.growth}
            </Descriptions.Item>
            <Descriptions.Item label="经验值">
              {currentMember.experience}
            </Descriptions.Item>
            <Descriptions.Item label="累计消费">
              ¥{currentMember.totalConsumption?.toFixed(2)}
            </Descriptions.Item>
            <Descriptions.Item label="订单数">
              {currentMember.orderCount}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={getMemberStatusColor(currentMember.status)}>
                {getMemberStatusText(currentMember.status)}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="注册时间">
              {formatDateTime(currentMember.registerTime)}
            </Descriptions.Item>
            <Descriptions.Item label="最后登录时间">
              {formatDateTime(currentMember.lastLoginTime)}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 修改等级弹窗 */}
      <Modal
        title="修改会员等级"
        open={levelModalVisible}
        onCancel={() => setLevelModalVisible(false)}
        onOk={handleLevelSubmit}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="levelId"
            label="会员等级"
            rules={[{ required: true, message: '请选择会员等级' }]}
          >
            <Select>
              {memberLevels.map((level) => (
                <Option key={level.id} value={level.id}>
                  <Tag color={getMemberLevelColor(level.levelValue)}>
                    {level.name}
                  </Tag>
                  {level.minGrowth > 0 && ` (≥${level.minGrowth}成长值)`}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 调整积分弹窗 */}
      <Modal
        title="调整积分"
        open={pointsModalVisible}
        onCancel={() => setPointsModalVisible(false)}
        onOk={handlePointsSubmit}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="points"
            label="积分数量"
            rules={[{ required: true, message: '请输入积分数量' }]}
          >
            <Input
              type="number"
              placeholder="正数增加，负数减少"
              addonAfter="积分"
            />
          </Form.Item>
          <Form.Item
            name="type"
            label="调整类型"
            rules={[{ required: true, message: '请选择调整类型' }]}
          >
            <Select>
              <Option value={1}>系统奖励</Option>
              <Option value={2}>活动赠送</Option>
              <Option value={3}>手动调整</Option>
              <Option value={4}>积分消费</Option>
              <Option value={5}>积分过期</Option>
              <Option value={6}>其他</Option>
            </Select>
          </Form.Item>
          <Form.Item name="remark" label="备注说明">
            <Input.TextArea rows={3} placeholder="请输入调整原因" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 调整成长值弹窗 */}
      <Modal
        title="调整成长值"
        open={growthModalVisible}
        onCancel={() => setGrowthModalVisible(false)}
        onOk={handleGrowthSubmit}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="growth"
            label="成长值数量"
            rules={[{ required: true, message: '请输入成长值数量' }]}
          >
            <Input
              type="number"
              placeholder="正数增加，负数减少"
              addonAfter="成长值"
            />
          </Form.Item>
          <Form.Item
            name="type"
            label="调整类型"
            rules={[{ required: true, message: '请选择调整类型' }]}
          >
            <Select>
              <Option value={1}>系统奖励</Option>
              <Option value={2}>活动赠送</Option>
              <Option value={3}>手动调整</Option>
              <Option value={4}>其他</Option>
            </Select>
          </Form.Item>
          <Form.Item name="remark" label="备注说明">
            <Input.TextArea rows={3} placeholder="请输入调整原因" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 日志查看抽屉 */}
      <Drawer
        title={logType === 'points' ? '积分日志' : '成长值日志'}
        placement="right"
        width={800}
        open={logDrawerVisible}
        onClose={() => setLogDrawerVisible(false)}
      >
        {currentMember && (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="用户名">
                  {currentMember.username}
                </Descriptions.Item>
                <Descriptions.Item label="当前{logType === 'points' ? '积分' : '成长值'}">
                  {logType === 'points'
                    ? currentMember.points
                    : currentMember.growth}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <List
              dataSource={logs}
              renderItem={(item: any) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text strong>
                          {logType === 'points'
                            ? item.pointsValue
                            : item.growthValue}{' '}
                          {logType === 'points' ? '积分' : '成长值'}
                        </Text>
                        <Tag color={item.type === 1 ? 'green' : 'red'}>
                          {item.typeText || (item.type === 1 ? '增加' : '减少')}
                        </Tag>
                        <Text type="secondary">
                          {formatDateTime(item.createdAt)}
                        </Text>
                      </Space>
                    }
                    description={
                      <>
                        <Space>
                          <Text>
                            变动前：
                            {logType === 'points'
                              ? item.beforePoints
                              : item.beforeGrowth}
                          </Text>
                          <Text>→</Text>
                          <Text>
                            变动后：
                            {logType === 'points'
                              ? item.afterPoints
                              : item.afterGrowth}
                          </Text>
                        </Space>
                        <Divider type="vertical" />
                        <Text type="secondary">
                          来源：{item.sourceType || '-'}
                        </Text>
                        {item.description && (
                          <>
                            <Divider type="vertical" />
                            <Text type="secondary">{item.description}</Text>
                          </>
                        )}
                      </>
                    }
                  />
                </List.Item>
              )}
            />

            {logs.length === 0 && <Empty description="暂无日志记录" />}
          </>
        )}
      </Drawer>
    </PageContainer>
  );
};

export default MemberList;
